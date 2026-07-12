// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI 운영 로그 (Phase 49 §11) — localStorage(클라이언트, DB 무관)
//
//   품의·결재·집행 과정을 표준 태그로 기록한다. AI 사장실 UI 타임라인/로그 표시에 쓴다.
//   순수 클라이언트 저장 — DB Schema/Migration/서버 무관(Regression Zero).
// ════════════════════════════════════════════════════════════════════

const KEY = "ai_ops_log_v1";
const CAP = 500;

export const OPS_TAGS = [
  "FUSION", "DOSSIER_CREATED", "WRITER_SIGN", "QUALITY_SIGN", "FACT_SIGN",
  "SEO_SIGN", "EDITOR_SIGN", "BOARD_APPROVED", "CHIEF_SECRETARY", "PUBLISH", "PUBLISHED",
];

export function getOpsLog(limit = 200) {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.slice(0, limit) : [];
  } catch { return []; }
}

// tag: OPS_TAGS 중 하나. detail: 부가 정보. at 는 호출부에서 Date.now() 를 넘겨도 되고 생략 가능.
export function logOps(tag, { contentId = null, dossierNo = null, detail = "", at } = {}) {
  const ts = Number.isFinite(at) ? at : Date.now();
  const entry = { tag: String(tag), contentId, dossierNo, detail: String(detail).slice(0, 300), at: ts };
  try {
    const cur = getOpsLog(CAP);
    localStorage.setItem(KEY, JSON.stringify([entry, ...cur].slice(0, CAP)));
  } catch { /* 저장 실패 무해 */ }
  return entry;
}

// 품의서 하나의 진행을 표준 태그로 일괄 기록(멱등적으로 상태만 반영).
export function logDossierProgress(dossier, { at } = {}) {
  if (!dossier) return;
  const base = { contentId: dossier.contentId, dossierNo: dossier.dossierNo, at };
  logOps("DOSSIER_CREATED", { ...base, detail: dossier.title });
  const signMap = { writer: "WRITER_SIGN", fact_checker: "FACT_SIGN", seo: "SEO_SIGN", chief_editor: "EDITOR_SIGN" };
  for (const r of dossier.reviewers || []) {
    if (r.signed && signMap[r.role]) logOps(signMap[r.role], { ...base, detail: `${r.name} ${r.decision}` });
  }
  if (dossier.boardApproved) logOps("BOARD_APPROVED", { ...base });
  if (dossier.chiefSecretary?.received) logOps("CHIEF_SECRETARY", { ...base, detail: dossier.chiefSecretary.action });
  if (dossier.publishStatus === "scheduled" || dossier.publishStatus === "published") logOps("PUBLISH", { ...base, detail: dossier.publishMode });
  if (dossier.publishStatus === "published") logOps("PUBLISHED", { ...base, detail: dossier.publishURL });
}

export function clearOpsLog() { try { localStorage.removeItem(KEY); } catch {} }
