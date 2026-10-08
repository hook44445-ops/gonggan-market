// 랜딩 «30초 요청서 미리 해 보기»에서 고른 것 — 로그인 뒤 요청서에 그대로 채운다(대표 09-30 「비교견적 하고 싶게」).
//   고른 것을 버리고 빈 요청서를 다시 내밀면, 랜딩의 그 칩들은 «눌러 봐도 아무 일 없는» 장식이 된다(없는 기능 약속 금지).
//   저장은 이 기기 localStorage 한 칸 · 3시간 지나면 버린다 · 한 번 꺼내면 지운다(다음 요청서를 오염시키지 않게).
import { SPACE_TYPES } from "../constants/index.js";

export const LANDING_PICK_KEY = "gm_landing_pick_v1";
export const LANDING_PICK_TTL_MS = 3 * 60 * 60 * 1000;
// 요청서(RequestModalBeta)의 WORK_TAGS 와 같은 이름 — 요청서의 칩 판정이 이 이름으로 켜진다.
export const LANDING_WORK_TAGS = ["도배", "바닥", "욕실", "주방", "필름", "타일", "페인트", "조명·전기", "창호", "철거"];

// 요청서(RequestModalBeta)의 SIZE_QUICK · BUDGET_QUICK 와 같은 값 — 랜딩에서 고른 값이 요청서 칩으로 그대로 켜진다(시험이 맞춰 본다).
export const LANDING_SIZES = ["평수 무관(작은 수리)", "10평대", "20평대", "30평대", "40평 이상"];
export const LANDING_BUDGETS = ["50만원 이하", "50~300만원", "300~500만원", "500~1,000만원", "1,000~3,000만원", "3,000~5,000만원", "5,000만원 이상", "상담 후 결정"];
export const LANDING_MEMO_MAX = 500;

// 10-09 «먼저 쓰고, 보낼 때 인증»(일감 2): 평수·예산·메모까지 랜딩에서 쓴다. send=true 는 «견적 요청 보내기»를 누른 것 —
//   번호 확인이 끝나면 MainApp 이 쓴 그대로 보낸다(보내기 전까지 서버에는 아무것도 가지 않는다).
export function normalizePick({ type, tags, size, budget, memo, send } = {}) {
  const t = SPACE_TYPES.includes(type) ? type : "";
  const tg = [...new Set((Array.isArray(tags) ? tags : []).filter((x) => LANDING_WORK_TAGS.includes(x)))].slice(0, 5);
  const out = { type: t, tags: tg };
  if (LANDING_SIZES.includes(size)) out.size = size;
  if (LANDING_BUDGETS.includes(budget)) out.budget = budget;
  const m = typeof memo === "string" ? memo.trim().slice(0, LANDING_MEMO_MAX) : "";
  if (m) out.memo = m;
  if (send === true && isDraftComplete(out)) out.send = true;
  return out;
}

// 보낼 수 있는 요청서 = 요청서(RequestModalBeta)의 필수 칸(공간·평수·예산·공사 내용)이 다 찼다.
export function isDraftComplete(p) {
  return !!(p && p.type && p.size && p.budget && Array.isArray(p.tags) && p.tags.length);
}

// 요청서 initialData 모양 — desc 는 «도배, 바닥 — » 머리(요청서 splitDesc 가 칩으로 되읽는 모양)
export function pickToPrefill(pick) {
  const { type, tags, size, budget, memo } = normalizePick(pick);
  if (!type && !tags.length) return null;
  const desc = tags.length ? `${tags.join(", ")} — ${memo ?? ""}` : (memo ?? "");
  return { ...(type ? { type } : {}), ...(size ? { size } : {}), ...(budget ? { budget } : {}), ...(desc ? { desc } : {}) };
}

function store() {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
}

export function saveLandingPick(pick, now = Date.now(), ls = store()) {
  const p = normalizePick(pick);
  if (!ls) return false;
  try {
    if (!p.type && !p.tags.length) { ls.removeItem(LANDING_PICK_KEY); return false; }
    // 덮어쓰기 — send 없이 다시 저장하면 send 도 빠진다(누르지 않은 요청을 보내지 않게).
    ls.setItem(LANDING_PICK_KEY, JSON.stringify({ ...p, at: now }));
    return true;
  } catch { return false; }
}

function readPick(now, ls, remove) {
  if (!ls) return null;
  let raw = null;
  try { raw = ls.getItem(LANDING_PICK_KEY); if (remove) ls.removeItem(LANDING_PICK_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v.at !== "number" || now - v.at > LANDING_PICK_TTL_MS || v.at > now + 60_000) return null;
    return normalizePick(v);
  } catch { return null; }
}

// 꺼내면서 지운다. 오래됐거나 모양이 틀리면 null.
export function takeLandingPick(now = Date.now(), ls = store()) {
  const p = readPick(now, ls, true);
  return p ? pickToPrefill(p) : null;
}

// 요청서 모양 + 보낼지(send). 꺼내면서 지운다 — 같은 요청이 두 번 나가지 않게.
export function takeLandingDraft(now = Date.now(), ls = store()) {
  const p = readPick(now, ls, true);
  const form = p ? pickToPrefill(p) : null;
  if (!form) return null;
  return { form, send: !!p.send };
}

// 인증 화면 안내용 — 지우지 않고 엿보기만. «보내기»를 눌러 온 사람에게만 «이 요청을 보내려면 번호 확인» 문구를 보인다.
export function hasLandingSend(now = Date.now(), ls = store()) {
  return !!readPick(now, ls, false)?.send;
}
