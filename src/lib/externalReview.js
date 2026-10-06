// 공간랜드 밖 공사 후기(지인 공사 등 · 151) — 대표 결정 09-28 «1번: 따로 표시, 평점·온도에 넣지 않음».
//   업체가 «후기 부탁 링크»(/p/주소?write=1&ref=코드)를 보내면, 받은 사람이 로그인해 별점·한 줄을 남긴다.
//   로그인 전이면 기기에 «어느 업체에 쓰려 했는지»를 남겨 두고, 로그인 뒤 그 페이지로 되돌린다.
import { SITE_URL } from "../utils/siteSeo.js";
import { withRefCode } from "./referral.js";

export const EXTERNAL_REVIEW_LABEL = "공간랜드 밖 공사 후기";
export const EXTERNAL_REVIEW_NOTE = "계약 기록이 없는 후기예요 · 평점과 공간온도에는 들어가지 않아요";
const PENDING_KEY = "gonggan_pending_review";
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

// 입력 확인 — 틀리면 화면에 보일 한국어, 맞으면 null (서버 151 과 같은 한도)
export function externalReviewProblem({ rating, content, workTitle } = {}) {
  if (!(Number(rating) >= 1 && Number(rating) <= 5)) return "별점을 골라 주세요";
  const c = String(content ?? "").trim();
  if (c.length < 5) return "한 줄(5자 이상) 적어 주세요";
  if (c.length > 500) return "500자까지 쓸 수 있어요";
  if (String(workTitle ?? "").trim().length > 40) return "공사 이름은 40자까지예요";
  return null;
}

export function reviewReasonText(reason) {
  return ({
    OWN_COMPANY: "내 업체에는 후기를 남길 수 없어요",
    ALREADY: "이 업체에는 이미 후기를 남기셨어요",
    COMPANY_NOT_FOUND: "업체를 찾을 수 없어요",
    BAD_RATING: "별점을 골라 주세요",
    BAD_CONTENT: "한 줄(5자 이상 500자 이하) 적어 주세요",
  })[reason] ?? "남기지 못했어요 — 잠시 뒤 다시 시도해 주세요";
}

// 업체가 보내는 «후기 부탁» 링크 · 메시지
export function reviewRequestUrl(companyIdOrSlug, code) {
  if (!companyIdOrSlug) return SITE_URL;
  return withRefCode(`${SITE_URL}/p/${encodeURIComponent(companyIdOrSlug)}?write=1`, code);
}
export function reviewRequestMessage(companyName, url) {
  return `${companyName ? `${companyName}입니다. ` : ""}공사 어떠셨어요? 아래 링크에서 별점과 한 줄 후기를 남겨 주시면 큰 힘이 돼요. (1분)\n${url}`;
}

// 로그인 전 — 어느 업체 페이지에서 쓰려 했는지 기억(로그인 뒤 App 이 되돌린다)
export function rememberPendingReview(ref, now = Date.now()) {
  if (!ref) return;
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ ref: String(ref), at: now })); } catch { /* noop */ }
}
export function takePendingReview(now = Date.now()) {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null");
    localStorage.removeItem(PENDING_KEY);
    if (!v?.ref || !(now - Number(v.at) < KEEP_MS)) return null;
    return `/p/${encodeURIComponent(v.ref)}?write=1`;
  } catch { return null; }
}
