// ════════════════════════════════════════════════════════════════════
// 공간마켓 E2E Validator — 실제 Production 검증 (Phase 36)
//
//   실제 OpenRouter 호출로 전 과정을 수행한다:
//     ① Research → ② Fusion → ③ SEO → ④ Review → ⑤ Approval(초안 저장) →
//     ⑥ Schedule → ⑦ Publish(Retry 1~3) → ⑧ Verification(발행 확인) → ⑨ History.
//
//   ⚠️ 기존 엔진 재사용(무수정): autoResearch/autoSeo/autoReview(automationSteps),
//   runFusion(fusionRunner), publishQueue/scheduler. 실제 저장/발행/검증은 주입(injected)
//   기존 API 로 수행 — Fusion/Approval/Autopilot 로직 무변경. DB/Migration 없음. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { autoResearch, autoSeo, autoReview } from "./automationSteps.js";
import { runFusion } from "./fusionRunner.js";
import { enqueuePublish, updatePublishJob } from "./publishQueue.js";
import { schedulePublishAt } from "./publishScheduler.js";
import { appendValidationRun } from "./validationHistory.js";
import { classifyContentType } from "./contentTypes.js";

const STEPS = ["research", "fusion", "seo", "review", "approval", "schedule", "publish", "verification", "history"];
export const STEP_LABEL = {
  research: "① Research", fusion: "② Fusion", seo: "③ SEO", review: "④ Review",
  approval: "⑤ Approval", schedule: "⑥ Schedule", publish: "⑦ Publish", verification: "⑧ Verification", history: "⑨ History",
};

// deps: { createDraft(draft)->{data:{id},error}, publishDraft(id)->{error}, verifyPublished(id)->{verified,status}, maxRetry }
//   onStep(stepKey, status, extra) — status: running/pass/fail/skip
export async function runE2E(topic, deps = {}, { onStep = () => {}, now = Date.now() } = {}) {
  const t = String(topic || "").trim() || "Morning Brief E2E 검증";
  const { createDraft, publishDraft, verifyPublished, maxRetry = 3 } = deps;
  const t0 = Date.now();
  const result = { title: t, steps: {}, summary: {}, retry: { count: 0, recovered: false }, url: null, quality: null, costKRW: 0 };
  const mark = (k, status, extra = {}) => { result.steps[k] = { status, ...extra }; onStep(k, status, extra); };
  const fail = (k, msg) => { mark(k, "fail", { error: msg }); result.durationMs = Date.now() - t0; result.productionReady = false; finalize(result); return result; };

  try {
    // ① Research
    mark("research", "running");
    const research = await autoResearch(t);
    mark("research", research.ok ? "pass" : "skip", { note: research.ok ? "참고자료 확보" : "리서치 생략(작성 진행)" });

    // ② Fusion (실제 OpenRouter)
    mark("fusion", "running");
    const writeTopic = research.notes ? `${t}\n\n[참고자료]\n${research.notes}` : t;
    const fusion = await runFusion(writeTopic, {});
    if (!fusion.ok || !fusion.final?.body) return fail("fusion", "Fusion 실패(본문 없음)");
    result.costKRW += fusion.totalCostKRW || 0;
    mark("fusion", "pass", { note: `${fusion.mode} · ${(fusion.totalMs / 1000).toFixed(1)}s · ₩${fusion.totalCostKRW}` });
    const contentType = fusion.contentType || classifyContentType(t);

    // ③ SEO
    mark("seo", "running");
    const seo = autoSeo({ title: fusion.final.title, body: fusion.final.body, contentType });
    mark("seo", "pass", { note: `${seo.seoTitle} · 태그 ${(seo.tags || []).length}` });

    // ④ Review
    mark("review", "running");
    const scores = autoReview({ title: fusion.final.title, body: fusion.final.body, contentType });
    result.quality = scores.composite;
    mark("review", "pass", { note: `종합 ${scores.composite}점 (게이트 ${scores.pass ? "통과" : "경고"})` });

    // ⑤ Approval (초안 저장 — 기존 API 주입)
    mark("approval", "running");
    if (!createDraft) return fail("approval", "createDraft 미주입");
    const cr = await createDraft({ title: fusion.final.title, body: fusion.final.body, contentType, aiTopic: t });
    if (cr.error || !cr.data?.id) return fail("approval", cr.error?.message || "초안 저장 실패");
    const loungeId = cr.data.id;
    mark("approval", "pass", { note: `초안 저장 · id ${String(loungeId).slice(0, 8)}` });

    // ⑥ Schedule (즉시 발행 슬롯)
    mark("schedule", "running");
    const job = enqueuePublish({ loungeId, title: fusion.final.title, contentType, quality: scores.composite });
    const at = schedulePublishAt("breaking", { now }); // 검증은 즉시 발행 슬롯
    updatePublishJob(job.id, { status: "scheduled", scheduledAt: at.toISOString() });
    mark("schedule", "pass", { note: "즉시 발행 예약" });

    // ⑦ Publish (Retry 1~3)
    mark("publish", "running");
    if (!publishDraft) return fail("publish", "publishDraft 미주입");
    updatePublishJob(job.id, { status: "publishing" });
    let published = false, lastErr = null, pubT0 = Date.now();
    for (let attempt = 1; attempt <= maxRetry; attempt++) {
      try {
        const pr = await publishDraft(loungeId);
        if (pr && pr.error) throw new Error(pr.error.message || String(pr.error));
        published = true; result.retry.count = attempt - 1; result.retry.recovered = attempt > 1; break;
      } catch (e) { lastErr = e?.message ?? String(e); result.retry.count = attempt; }
    }
    const pubDuration = Date.now() - pubT0;
    if (!published) { updatePublishJob(job.id, { status: "failed", error: lastErr }); return fail("publish", `발행 실패(재시도 ${maxRetry}): ${lastErr}`); }
    const publishedAt = Date.now();
    updatePublishJob(job.id, { status: "published", publishedAt });
    mark("publish", "pass", { note: `발행 · ${pubDuration}ms${result.retry.recovered ? ` · Recovered(재시도 ${result.retry.count})` : ""}`, publishedAt, durationMs: pubDuration });

    // ⑧ Verification (발행 확인)
    mark("verification", "running");
    let verified = false, vStatus = "unknown";
    if (verifyPublished) {
      try { const v = await verifyPublished(loungeId); verified = !!v.verified; vStatus = v.status || (verified ? "published" : "not_found"); result.url = v.url || null; }
      catch (e) { vStatus = "error:" + (e?.message ?? e); }
    } else vStatus = "verify 미주입";
    mark("verification", verified ? "pass" : "fail", { note: verified ? `Verified (${vStatus})` : `미검증 (${vStatus})` });

    // ⑨ History
    result.durationMs = Date.now() - t0;
    result.productionReady = STEPS.filter((s) => s !== "history").every((s) => ["pass", "skip"].includes(result.steps[s]?.status));
    mark("history", "pass", { note: "이력 저장" });
    finalize(result);
    return result;
  } catch (e) {
    const running = STEPS.find((s) => result.steps[s]?.status === "running") || "fusion";
    return fail(running, e?.message ?? String(e));
  }
}

function finalize(result) {
  const S = result.steps;
  result.summary = {
    Fusion: S.fusion?.status === "pass" ? "PASS" : "FAIL",
    SEO: S.seo?.status === "pass" ? "PASS" : "FAIL",
    Review: S.review?.status === "pass" ? "PASS" : "FAIL",
    Approval: S.approval?.status === "pass" ? "PASS" : "FAIL",
    Publish: S.publish?.status === "pass" ? "PASS" : "FAIL",
    Verification: S.verification?.status === "pass" ? "PASS" : "FAIL",
    Retry: result.retry.count === 0 || result.retry.recovered ? "PASS" : "FAIL",
  };
  try { appendValidationRun(result); } catch { /* */ }
}
