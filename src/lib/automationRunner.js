// ════════════════════════════════════════════════════════════════════
// 공간마켓 Automation Runner — 작업 1건 전체 자동 처리 (Phase 32)
//
//   주제 → 리서치 → 작성(Fusion) → SEO → 이미지 프롬프트 → 검수 → 승인대기.
//   실패 시 자동 재시도(최대 3회). 발행은 절대 자동으로 하지 않는다(승인대기에서 멈춤).
//
//   ⚠️ 기존 엔진 재사용(무수정): fusionRunner.runFusion · automationSteps · automationQueue.
//   Regression Zero: DB/API/Cron/ENV 변경 없음.
// ════════════════════════════════════════════════════════════════════

import { runFusion } from "./fusionRunner.js";
import { autoResearch, autoSeo, autoImagePrompt, autoReview } from "./automationSteps.js";
import { updateJob } from "./automationQueue.js";
import { logActivity } from "./activityLog.js";

const MAX_RETRY = 3;

// 작업 1건 처리. onStage(stageKey) 로 진행 알림. 반환: 갱신된 job.
export async function processJob(job, { onStage = null, signal = null } = {}) {
  const t = String(job.topic || "").trim();
  if (!t) return updateJob(job.id, { status: "failed", error: "빈 주제" });
  let attempt = job.retries || 0;

  while (attempt < MAX_RETRY) {
    try {
      updateJob(job.id, { status: "running", stage: "research", error: null });
      onStage?.("research");
      const research = await autoResearch(t, { signal });

      updateJob(job.id, { stage: "write" });
      onStage?.("write");
      const writeTopic = research.notes ? `${t}\n\n[참고자료]\n${research.notes}` : t;
      const fusion = await runFusion(writeTopic, { signal });
      if (!fusion.ok || !fusion.final?.body) throw new Error("작성 실패(본문 없음)");

      updateJob(job.id, { stage: "seo" });
      onStage?.("seo");
      const seo = autoSeo({ title: fusion.final.title, body: fusion.final.body, contentType: fusion.contentType });

      updateJob(job.id, { stage: "image" });
      onStage?.("image");
      const image = autoImagePrompt({ title: fusion.final.title, body: fusion.final.body });

      updateJob(job.id, { stage: "review" });
      onStage?.("review");
      const scores = autoReview({ title: fusion.final.title, body: fusion.final.body, contentType: fusion.contentType });

      const draft = { title: fusion.final.title, body: fusion.final.body, contentType: fusion.contentType, mode: fusion.mode, totalCostKRW: fusion.totalCostKRW, totalMs: fusion.totalMs };
      const updated = updateJob(job.id, {
        status: "approval_pending", stage: "done", retries: attempt,
        draft, research: research.notes || null, seo, imagePrompt: image, scores, error: null,
      });
      logActivity("published", { title: `자동화 준비완료: ${t}`.slice(0, 60), note: `승인대기 · 종합 ${scores.composite}점 · ₩${draft.totalCostKRW}`, ok: true });
      return updated;
    } catch (e) {
      attempt += 1;
      const err = e?.message ?? String(e);
      logActivity("retry", { title: `자동화 재시도 ${attempt}/${MAX_RETRY}: ${t}`.slice(0, 60), ok: false, note: err });
      updateJob(job.id, { retries: attempt, error: err, status: attempt < MAX_RETRY ? "queued" : "failed", stage: null });
      if (attempt >= MAX_RETRY) return updateJob(job.id, { status: "failed", error: err });
    }
  }
  return updateJob(job.id, { status: "failed", error: "재시도 초과" });
}

// 대기열 순차 처리(queued 상태를 하나씩). onJob(job) 콜백.
export async function processQueue(jobs, { onStage = null, onJob = null, signal = null, limit = 5 } = {}) {
  const queued = jobs.filter((j) => j.status === "queued").slice(0, limit);
  const results = [];
  for (const j of queued) {
    if (signal?.aborted) break;
    const r = await processJob(j, { onStage, signal });
    results.push(r); onJob?.(r);
  }
  return results;
}
