// ════════════════════════════════════════════════════════════════════
// 공간마켓 Automation Queue — AI 자동화 작업 대기열 (Phase 32)
//
//   주제 하나를 넣으면 리서치→작성→SEO→이미지→검수→승인대기까지 흐르는 "작업(job)"으로 관리한다.
//   상태: queued → running → approval_pending → scheduled → published / failed
//   (running 중 세부 stage: research/write/seo/image/review)
//
//   ⚠️ 발행은 자동으로 하지 않는다(승인 후 기존 흐름). DB/Migration/API 없음 · localStorage.
//   Regression Zero: 순수 저장/상태 관리.
// ════════════════════════════════════════════════════════════════════

const KEY = "space_automation_queue_v1";
const CAP = 200;

export const JOB_STATUS = {
  queued: "예약중", running: "진행중", approval_pending: "승인대기",
  scheduled: "발행대기", published: "완료", failed: "실패", rejected: "반려",
};
export const JOB_STAGE = {
  research: "리서치", write: "작성", seo: "SEO", image: "이미지", review: "검수", done: "완료",
};

export function getQueue() {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function saveQueue(list) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, CAP))); } catch {} return list; }

// 새 작업 추가.
export function enqueueJob(topic, { provider = "auto" } = {}) {
  const job = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    topic: String(topic || "").trim(), status: "queued", stage: null,
    provider, retries: 0, scores: null, draft: null, research: null, imagePrompt: null, seo: null,
    scheduledAt: null, error: null, createdAt: Date.now(), updatedAt: Date.now(),
  };
  const list = getQueue();
  saveQueue([job, ...list]);
  return job;
}

export function updateJob(id, patch) {
  const list = getQueue().map((j) => (j.id === id ? { ...j, ...patch, updatedAt: Date.now() } : j));
  saveQueue(list);
  return list.find((j) => j.id === id) || null;
}

export function removeJob(id) { saveQueue(getQueue().filter((j) => j.id !== id)); }
export function getJob(id) { return getQueue().find((j) => j.id === id) || null; }
export function nextQueued() { return getQueue().filter((j) => j.status === "queued").slice(-1)[0] || null; }

const isToday = (ts, now) => { const d = new Date(ts), n = new Date(now); return d.toDateString() === n.toDateString(); };

// 대시보드 요약.
export function queueSummary(now = Date.now()) {
  const q = getQueue();
  const by = (s) => q.filter((j) => j.status === s).length;
  const today = q.filter((j) => isToday(j.createdAt, now));
  const scored = q.filter((j) => j.scores?.composite != null);
  const avgQ = scored.length ? Math.round(scored.reduce((n, j) => n + j.scores.composite, 0) / scored.length) : null;
  const retries = q.reduce((n, j) => n + (j.retries || 0), 0);
  const costKRW = q.reduce((n, j) => n + (j.draft?.totalCostKRW || 0), 0);
  return {
    todayCreated: today.length,
    queued: by("queued"), running: by("running"), approvalPending: by("approval_pending"),
    scheduled: by("scheduled"), published: by("published"), failed: by("failed"),
    retries, avgQuality: avgQ, costKRW,
  };
}
