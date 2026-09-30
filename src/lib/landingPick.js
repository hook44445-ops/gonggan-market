// 랜딩 «30초 요청서 미리 해 보기»에서 고른 것 — 로그인 뒤 요청서에 그대로 채운다(대표 09-30 「비교견적 하고 싶게」).
//   고른 것을 버리고 빈 요청서를 다시 내밀면, 랜딩의 그 칩들은 «눌러 봐도 아무 일 없는» 장식이 된다(없는 기능 약속 금지).
//   저장은 이 기기 localStorage 한 칸 · 3시간 지나면 버린다 · 한 번 꺼내면 지운다(다음 요청서를 오염시키지 않게).
import { SPACE_TYPES } from "../constants/index.js";

export const LANDING_PICK_KEY = "gm_landing_pick_v1";
export const LANDING_PICK_TTL_MS = 3 * 60 * 60 * 1000;
// 요청서(RequestModalBeta)의 WORK_TAGS 와 같은 이름 — 요청서의 칩 판정이 이 이름으로 켜진다.
export const LANDING_WORK_TAGS = ["도배", "바닥", "욕실", "주방", "필름", "타일", "페인트", "조명·전기", "창호", "철거"];

export function normalizePick({ type, tags } = {}) {
  const t = SPACE_TYPES.includes(type) ? type : "";
  const tg = [...new Set((Array.isArray(tags) ? tags : []).filter((x) => LANDING_WORK_TAGS.includes(x)))].slice(0, 5);
  return { type: t, tags: tg };
}

// 요청서 initialData 모양 — desc 는 «도배, 바닥 — » 머리(요청서 splitDesc 가 칩으로 되읽는 모양)
export function pickToPrefill(pick) {
  const { type, tags } = normalizePick(pick);
  if (!type && !tags.length) return null;
  return { ...(type ? { type } : {}), ...(tags.length ? { desc: `${tags.join(", ")} — ` } : {}) };
}

function store() {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
}

export function saveLandingPick(pick, now = Date.now(), ls = store()) {
  const p = normalizePick(pick);
  if (!ls) return false;
  try {
    if (!p.type && !p.tags.length) { ls.removeItem(LANDING_PICK_KEY); return false; }
    ls.setItem(LANDING_PICK_KEY, JSON.stringify({ ...p, at: now }));
    return true;
  } catch { return false; }
}

// 꺼내면서 지운다. 오래됐거나 모양이 틀리면 null.
export function takeLandingPick(now = Date.now(), ls = store()) {
  if (!ls) return null;
  let raw = null;
  try { raw = ls.getItem(LANDING_PICK_KEY); ls.removeItem(LANDING_PICK_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v.at !== "number" || now - v.at > LANDING_PICK_TTL_MS || v.at > now + 60_000) return null;
    return pickToPrefill(v);
  } catch { return null; }
}
