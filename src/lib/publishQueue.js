// ════════════════════════════════════════════════════════════════════
// 공간마켓 Publish Queue — AI Autopilot 발행 큐 (Phase 35)
//
//   승인된 콘텐츠의 발행 상태를 명확히 관리한다:
//     draft → review → approval_pending → approved → scheduled → publishing → published / failed
//   기존 Automation Queue 와 별개(무수정) — 발행 단계만 담당한다(additive).
//
//   ⚠️ DB/Migration/API 없음 · localStorage. 실제 발행은 기존 publish API 를 executor 로 주입.
//   Regression Zero.
// ════════════════════════════════════════════════════════════════════

const KEY = "space_publish_queue_v1";
const CFG_KEY = "space_autopilot_cfg_v1";
const CAP = 200;

export const PUB_STATUS = {
  draft: "초안", review: "검수", approval_pending: "승인대기", approved: "승인됨",
  scheduled: "예약", publishing: "발행중", published: "발행완료", failed: "실패",
};

export const DEFAULT_AUTOPILOT_CFG = { autoPublishOn: false, emergencyStop: false, minQuality: 90, maxRetry: 3 };

export function getAutopilotConfig() {
  try { return { ...DEFAULT_AUTOPILOT_CFG, ...(JSON.parse(localStorage.getItem(CFG_KEY) ?? "{}") || {}) }; }
  catch { return { ...DEFAULT_AUTOPILOT_CFG }; }
}
export function setAutopilotConfig(patch) {
  const next = { ...getAutopilotConfig(), ...patch };
  try { localStorage.setItem(CFG_KEY, JSON.stringify(next)); } catch {}
  return next;
}

export function getPublishQueue() {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, CAP))); } catch {} return list; }

// 승인된 콘텐츠를 발행 큐에 넣는다(상태 approved).
export function enqueuePublish({ loungeId = null, title, contentType = null, quality = null } = {}) {
  const job = {
    id: `pub_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    loungeId, title: String(title || "").trim() || "(무제)", contentType, quality,
    status: "approved", scheduledAt: null, retries: 0, error: null,
    createdAt: Date.now(), updatedAt: Date.now(), publishedAt: null,
  };
  save([job, ...getPublishQueue()]);
  return job;
}
export function updatePublishJob(id, patch) {
  const list = getPublishQueue().map((j) => (j.id === id ? { ...j, ...patch, updatedAt: Date.now() } : j));
  save(list);
  return list.find((j) => j.id === id) || null;
}
export function removePublishJob(id) { save(getPublishQueue().filter((j) => j.id !== id)); }

const isToday = (ts, now) => ts && new Date(ts).toDateString() === new Date(now).toDateString();

export function publishSummary(now = Date.now()) {
  const q = getPublishQueue();
  const by = (s) => q.filter((j) => j.status === s).length;
  return {
    approved: by("approved"), scheduled: by("scheduled"), publishing: by("publishing"),
    publishedToday: q.filter((j) => j.status === "published" && isToday(j.publishedAt, now)).length,
    failed: by("failed"),
    retries: q.reduce((n, j) => n + (j.retries || 0), 0),
  };
}
