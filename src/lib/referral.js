// 친구 초대 — 초대 링크(?ref=코드)로 들어온 새 사용자가 가입하면 누가 데려왔는지 남긴다(대표 09-28 · 146).
//   · 링크를 누른 순간 코드를 기기에 30일 보관 → 가입·로그인 뒤 한 번 서버에 알린다(referral_claim).
//   · 서버가 «가입 7일 안 · 처음 · 자기 자신 아님»을 판정한다. 여기선 코드 모양만 본다.
//   · 보상은 아직 없다(대표 결정 뒤). 화면은 «몇 명 데려왔는지»만 보여 준다.
import { SITE_URL } from "../utils/siteSeo.js";

// 초대 보상(148) — 서버 referral_claim 이 지급한다. 여기 값은 화면 안내용(SQL 과 같아야 한다 · referral.test.js 가 대조).
export const REFERRAL_REWARD = { inviter: 30, invitee: 20, monthlyCap: 20 };

const KEY = "gonggan_pending_ref";
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
// 서버(146)가 만드는 코드와 같은 글자 — 헷갈리는 0/O · 1/I/L 없음
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

export function normalizeRefCode(raw) {
  const code = String(raw ?? "").trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

// 초대 링크 미리보기(카카오톡·문자 카드) — 봇 프리렌더(api/prerender)가 ?ref= 가 붙은 주소에 쓴다.
//   받은 사람이 카드만 보고도 «가입 선물»을 알게. 코드가 틀리면 null(평소 카드 그대로).
// 초대한 사람 표시(159 referral_inviter) — «김○○» 모양만 받는다(다른 글자가 오면 무시)
export function inviterName(data) {
  const n = String(data?.name ?? "");
  return data?.ok && /^[^\s○]○○$/.test(n) ? n : null;
}

export function inviteOg(kind, rawCode, companyName, inviter = null) {
  if (!normalizeRefCode(rawCode)) return null;
  const gift = `이 링크로 가입하면 공간토큰 ${REFERRAL_REWARD.invitee}개`;
  const who = inviterName({ ok: true, name: inviter });
  if (kind === "partner") return {
    title: who ? `${who} 사장님이 공간마켓 파트너로 초대했어요` : "동료 사장님이 공간마켓 파트너로 초대했어요",
    description: `가입비·광고비 없이 우리 동네 인테리어·집수리 요청을 받아 보세요. ${gift}.`,
  };
  if (kind === "company") return {
    title: `${String(companyName ?? "").trim() || "업체"} — ${who ? `${who}님이` : "지인이"} 추천한 업체예요 | 공간마켓`,
    description: `실제 공사한 지인이 추천했어요. 시공 사례·후기를 보고 무료로 견적을 받아 보세요. ${gift}.`,
  };
  return {
    title: who ? `${who}님이 공간마켓에 초대했어요 🎁` : "친구가 공간마켓에 초대했어요 🎁",
    description: `${gift}. 인테리어·집수리 견적을 여러 업체에서 받아 나란히 비교해 보세요.`,
  };
}

// 주소의 ?ref= 에서 코드 — 없거나 모양이 틀리면 null
export function refCodeFromSearch(search) {
  try { return normalizeRefCode(new URLSearchParams(search ?? "").get("ref")); } catch { return null; }
}

export function inviteUrl(code, isCompany = false) {
  // 동료 사장님 초대는 파트너 소개(/partner)로 — 카카오톡 카드도 «파트너로 초대했어요»(api/prerender inviteOg)
  const c = normalizeRefCode(code);
  const path = isCompany ? "/partner" : "/";
  return c ? `${SITE_URL}${path}?ref=${c}` : isCompany ? `${SITE_URL}/partner` : SITE_URL;
}

export function inviteMessage(code, isCompany = false) {
  return isCompany
    ? `공간마켓에서 동네 인테리어·집수리 요청을 받아 보세요. 가입비 없이 바로 견적을 보낼 수 있고, 이 링크로 가입하면 공간토큰 ${REFERRAL_REWARD.invitee}개를 드려요.\n${inviteUrl(code, true)}`
    : `인테리어·집수리 견적을 여러 곳에서 나란히 비교해 볼 수 있어요. 이 링크로 가입하면 공간토큰 ${REFERRAL_REWARD.invitee}개를 드려요.\n${inviteUrl(code)}`;
}

// 안드로이드 앱 테스터 모집(09-28) — Play 정식 출시 전에는 비공개 테스트 참여자가 있어야 한다.
//   /download(테스트 참여 안내)로 보내되 ?ref= 는 그대로 붙여, 참여자가 가입하면 초대 수에도 잡히게 한다.
//   TWA 앱은 휴대폰의 크롬 저장소를 같이 써서, 웹에서 보관한 코드가 앱 첫 로그인까지 이어진다.
export function testerUrl(code) {
  const c = normalizeRefCode(code);
  return `${SITE_URL}/download${c ? `?ref=${c}` : ""}`;
}

export function testerMessage(code) {
  return `공간마켓 안드로이드 앱 테스트에 참여해 주실 수 있을까요? 아래 링크에서 「테스트 참여」를 누르고 설치해 2주 정도만 지워지지 않게 두시면 큰 도움이 돼요. 참여가 안 된다고 나오면 쓰시는 구글(Gmail) 주소를 알려 주세요.\n${testerUrl(code)}`;
}

// 고객 → 아는 사장님 초대(09-30 업체 초대 바퀴) — 동네에 업체가 적거나 견적이 아직 없을 때.
//   파트너 소개(/partner?ref=)로 보낸다. 사장님이 가입하면 초대로 잡힌다(보상은 서버 규칙 그대로 · 여기서 약속하지 않는다).
export function proInviteMessage(code) {
  return `사장님, 제가 쓰는 공간마켓에 우리 동네 집수리·인테리어 요청이 올라와요. 가입비 없이 견적을 보낼 수 있으니 한번 보세요.\n${inviteUrl(code, true)}`;
}

// 견적 요청 직후 «가족에게 알리기»(09-28) — 인테리어는 가족이 같이 정한다. 요청 내용(주소·예산)은 싣지 않는다(개인정보).
export function familyMessage(code) {
  return `우리 집 인테리어·집수리 견적을 공간마켓에서 받고 있어요. 업체 견적이 오면 같이 비교해 봐요! 이 링크로 가입하면 공간토큰 ${REFERRAL_REWARD.invitee}개도 받아요.\n${inviteUrl(code)}`;
}

// 좋은 후기 직후 «이 업체 추천» 문자 — 업체 페이지(/p/…?ref=내코드)로 보낸다. 받은 사람이 가입하면 초대로 잡힌다.
export function recommendMessage(companyName, companyIdOrSlug, code) {
  const name = String(companyName ?? "").trim() || "이 업체";
  return `우리 집 공사한 ${name}, 꼼꼼하게 잘해 줬어요. 집 고칠 일 있으면 공간마켓에서 견적 받아 봐요. 이 링크로 가입하면 공간토큰 ${REFERRAL_REWARD.invitee}개도 받아요.\n${companyPageUrl(companyIdOrSlug, code)}`;
}

// 업체 공개 페이지 주소(/p/짧은주소 또는 /p/업체ID) — 업체가 블로그·인스타·명함에 건다. 코드가 있으면 ?ref= 도(업체가 데려온 가입 = 초대).
export function companyPageUrl(companyIdOrSlug, code) {
  if (!companyIdOrSlug) return SITE_URL;
  return withRefCode(`${SITE_URL}/p/${encodeURIComponent(companyIdOrSlug)}`, code);
}

// 공유 링크에 내 초대 코드를 붙인다(라운지 글 공유 등 · 09-28) — 공유가 곧 초대가 된다.
// 이미 ?ref 가 있으면 내 코드로 바꾸고, 코드가 없거나 모양이 틀리면 주소를 그대로 둔다.
export function withRefCode(url, code) {
  const c = normalizeRefCode(code);
  if (!c || !url) return url;
  try {
    const u = new URL(url, SITE_URL);
    u.searchParams.set("ref", c);
    return u.toString();
  } catch { return url; }
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
