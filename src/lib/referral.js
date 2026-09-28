// 친구 초대 — 초대 링크(?ref=코드)로 들어온 새 사용자가 가입하면 누가 데려왔는지 남긴다(대표 09-28 · 146).
//   · 링크를 누른 순간 코드를 기기에 30일 보관 → 가입·로그인 뒤 한 번 서버에 알린다(referral_claim).
//   · 서버가 «가입 7일 안 · 처음 · 자기 자신 아님»을 판정한다. 여기선 코드 모양만 본다.
//   · 보상은 아직 없다(대표 결정 뒤). 화면은 «몇 명 데려왔는지»만 보여 준다.
import { SITE_URL } from "../utils/siteSeo.js";

const KEY = "gonggan_pending_ref";
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
// 서버(146)가 만드는 코드와 같은 글자 — 헷갈리는 0/O · 1/I/L 없음
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

export function normalizeRefCode(raw) {
  const code = String(raw ?? "").trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

// 주소의 ?ref= 에서 코드 — 없거나 모양이 틀리면 null
export function refCodeFromSearch(search) {
  try { return normalizeRefCode(new URLSearchParams(search ?? "").get("ref")); } catch { return null; }
}

export function inviteUrl(code) {
  const c = normalizeRefCode(code);
  return c ? `${SITE_URL}/?ref=${c}` : SITE_URL;
}

export function inviteMessage(code, isCompany = false) {
  return isCompany
    ? `공간마켓에서 동네 인테리어·집수리 요청을 받아 보세요. 가입비 없이 바로 견적을 보낼 수 있어요.\n${inviteUrl(code)}`
    : `인테리어·집수리 견적을 여러 곳에서 나란히 비교해 볼 수 있어요. 공간마켓 써 보세요.\n${inviteUrl(code)}`;
}

// 링크로 들어왔을 때 보관(먼저 받은 코드를 지키지 않고 마지막 링크를 따른다 — 가장 최근에 권한 사람)
export function stashRefCode(code, now = Date.now()) {
  const c = normalizeRefCode(code);
  if (!c) return;
  try { localStorage.setItem(KEY, JSON.stringify({ code: c, at: now })); } catch { /* 저장 못 해도 진행 */ }
}

export function pendingRefCode(now = Date.now()) {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!v?.code || !(now - Number(v.at) < KEEP_MS)) return null;
    return normalizeRefCode(v.code);
  } catch { return null; }
}

export function clearRefCode() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

// 서버 답 → 보관한 코드를 지울까. 로그인 토큰이 없어 못 보낸 경우(다음 로그인에 다시)만 남긴다.
export function shouldClearAfterClaim({ data, error } = {}) {
  if (error) return !/LOGIN_REQUIRED|JWT|401|referral_claim/.test(String(error.message ?? ""));
  return !!data;
}
