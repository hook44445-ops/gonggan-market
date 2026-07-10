// ════════════════════════════════════════════════════════════════════
// 공간마켓 Day Runner — 오늘 하루 실제 자동 운영 (Phase 37)
//
//   오늘 편성(QT·인도점성술·Morning Brief·공간마켓·Time Trend)을 실제로 생성 → 검수 →
//   품질 통과분 자동 승인(초안 저장) → 예약. 이후 Autopilot Worker 가 실제 발행한다.
//   ⚠️ 테스트 글이 아니라 "실제 라운지 글"이다.
//
//   ⚠️ 기존 엔진 재사용(무수정): callLLM · fusionRunner · automationSteps.autoReview ·
//   publishQueue · publishScheduler · 아침 콘텐츠 프롬프트(morningBrief/todayWord/indianAstrology) ·
//   timeTrend. 실제 저장(createDraft)은 주입. DB/Migration 없음. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { callLLM } from "./llmClient.js";
import { runFusion } from "./fusionRunner.js";
import { autoReview } from "./automationSteps.js";
import { enqueuePublish, updatePublishJob, getAutopilotConfig } from "./publishQueue.js";
import { schedulePublishAt } from "./publishScheduler.js";
import { morningBriefPrompt, morningBriefTitles } from "./morningBrief.js";
import { todayWordPrompt, todayWordTitle } from "./todayWord.js";
import { astrologyPrompt, astrologyTitle } from "./indianAstrology.js";
import { timeTrendCandidates } from "./timeTrend.js";
import { logActivity } from "./activityLog.js";

// 오늘 자동 운영할 편성(고정 아침 3 + 공간마켓 1 + Time Trend 1). 확장 가능.
export const DAY_PROGRAM = ["qt", "astrology", "morning_brief", "space_market", "trend_present"];

const SYS = "당신은 공간마켓(공간라운지)의 전문 에디터입니다. 담백하고 신뢰감 있게, 첫 줄은 제목으로 씁니다.";
const splitTB = (text) => {
  const lines = String(text || "").split(/\r?\n/); const i = lines.findIndex((l) => l.trim());
  if (i === -1) return { title: "", body: String(text || "").trim() };
  return { title: lines[i].replace(/^#+\s*/, "").trim(), body: lines.slice(i + 1).join("\n").trim() || lines[i].trim() };
};
const costOf = (usage) => Math.round((((Number(usage?.promptTokens) || 0) / 1e6) * 3 + ((Number(usage?.completionTokens) || 0) / 1e6) * 15) * 1350);

// 타입별 실제 생성. 반환 { ok, title, body, contentType, costKRW, error }
async function generateItem(type, { published = [], signal = null } = {}) {
  try {
    if (type === "morning_brief") {
      const { text, usage } = await callLLM({ system: SYS, user: morningBriefPrompt(), temperature: 0.35, maxTokens: 2400, signal });
      return { ok: !!text, title: morningBriefTitles().editorials, body: text, contentType: type, costKRW: costOf(usage) };
    }
    if (type === "qt") {
      const { text, usage } = await callLLM({ system: SYS, user: todayWordPrompt(), temperature: 0.55, maxTokens: 1400, signal });
      return { ok: !!text, title: todayWordTitle(), body: text, contentType: type, costKRW: costOf(usage) };
    }
    if (type === "astrology") {
      const { text, usage } = await callLLM({ system: SYS, user: astrologyPrompt(), temperature: 0.75, maxTokens: 2000, signal });
      return { ok: !!text, title: astrologyTitle(), body: text, contentType: type, costKRW: costOf(usage) };
    }
    // 주제형은 Fusion(다단계) 재사용.
    const topic = type === "space_market" ? "오늘의 공간·인테리어 실전 팁"
      : (timeTrendCandidates({ published })[1]?.topic || "지금 사람들이 찾는 주제");
    const fusion = await runFusion(topic, { signal });
    if (!fusion.ok || !fusion.final?.body) return { ok: false, error: "Fusion 실패", contentType: type };
    return { ok: true, title: fusion.final.title, body: fusion.final.body, contentType: type, costKRW: fusion.totalCostKRW || 0 };
  } catch (e) {
    return { ok: false, error: e?.message ?? String(e), contentType: type };
  }
}

// 하루 실제 자동 운영. deps: { createDraft(draft)->{data:{id},error} }.
//   opts: { types, mode('realtime'|'scheduled'), onItem(type,status,extra), published, signal }
//   mode realtime: 지금부터 1~2분 간격으로 예약(오늘 바로 발행되게). scheduled: 편성 시간.
export async function runDay(deps = {}, { types = DAY_PROGRAM, mode = "realtime", onItem = () => {}, published = [], signal = null, now = Date.now() } = {}) {
  const cfg = getAutopilotConfig();
  const { createDraft } = deps;
  const result = { generated: 0, approved: 0, pendingReview: 0, failed: 0, costKRW: 0, items: [] };
  let slot = 0;

  for (const type of types) {
    if (signal?.aborted) break;
    onItem(type, "generating");
    const gen = await generateItem(type, { published, signal });
    if (!gen.ok || !gen.body) { result.failed += 1; result.items.push({ type, status: "failed", error: gen.error }); onItem(type, "failed", { error: gen.error }); continue; }
    result.generated += 1; result.costKRW += gen.costKRW || 0;

    onItem(type, "reviewing");
    const scores = autoReview({ title: gen.title, body: gen.body, contentType: type });

    // 실제 초안 저장(주입된 기존 API).
    if (!createDraft) { result.items.push({ type, status: "no_executor" }); continue; }
    const cr = await createDraft({ title: gen.title, body: gen.body, contentType: type, aiTopic: gen.title });
    if (cr.error || !cr.data?.id) { result.failed += 1; result.items.push({ type, status: "save_failed", error: cr.error?.message }); onItem(type, "failed", { error: cr.error?.message }); continue; }
    const loungeId = cr.data.id;

    const passed = scores.composite >= (cfg.minQuality ?? 90);
    const job = enqueuePublish({ loungeId, title: gen.title, contentType: type, quality: scores.composite });
    if (passed) {
      const at = mode === "realtime" ? new Date(now + (++slot) * 60 * 1000) : schedulePublishAt(type, { now });
      updatePublishJob(job.id, { status: "scheduled", scheduledAt: at.toISOString() });
      result.approved += 1;
      result.items.push({ type, status: "scheduled", loungeId, quality: scores.composite, scheduledAt: at.toISOString(), title: gen.title });
      logActivity("scheduled", { title: gen.title, contentType: type, note: `자동 승인·예약 (품질 ${scores.composite})`, ok: true });
      onItem(type, "scheduled", { quality: scores.composite, title: gen.title });
    } else {
      // 품질 미달 → 승인대기(사람 확인). 발행하지 않는다(Safety).
      updatePublishJob(job.id, { status: "approved" });
      result.pendingReview += 1;
      result.items.push({ type, status: "needs_review", loungeId, quality: scores.composite, title: gen.title });
      onItem(type, "needs_review", { quality: scores.composite, title: gen.title });
    }
  }
  return result;
}
