// 업체 짧은 주소(/p/짧은이름 · 대표 09-28) — 명함·인스타 프로필에 넣을 수 있게.
//   규칙(서버 149 company_set_slug 와 같다): 2~20자 · 한글/영문 소문자/숫자/하이픈 · 하이픈으로 시작·끝 X · 예약어 X.
//   영문 주소를 권한다 — 한글 주소는 일부 앱에서 %EA%B3%B5… 로 길게 보인다.

export const SLUG_RE = /^[가-힣a-z0-9](?:[가-힣a-z0-9-]{0,18}[가-힣a-z0-9])?$/;
// 앱 경로·운영 이름과 겹치는 것
export const RESERVED_SLUGS = ["admin", "api", "app", "download", "testers", "lounge", "partner", "privacy", "terms", "refund",
  "tokens", "my", "p", "login", "gongganmarket", "공간마켓", "공간사이", "운영자", "관리자", "test", "테스트"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v) => UUID_RE.test(String(v ?? ""));

export function normalizeSlug(raw) {
  return String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "-");
}

// 틀리면 화면에 보일 한국어, 맞으면 null
export function slugProblem(raw) {
  const s = normalizeSlug(raw);
  if (s.length < 2) return "2자 이상 적어 주세요";
  if (s.length > 20) return "20자까지 쓸 수 있어요";
  if (!SLUG_RE.test(s)) return "한글·영문 소문자·숫자·하이픈(-)만 쓸 수 있어요(하이픈으로 시작·끝 X)";
  if (RESERVED_SLUGS.includes(s)) return "쓸 수 없는 주소예요 — 다른 이름을 골라 주세요";
  return null;
}
