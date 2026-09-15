// 역할별 테마 전환 — 루트 <html> 의 data-role 속성만 바꾸면
// src/styles/theme.css 의 CSS 변수 세트가 통째로 전환된다.
//   · 고객(consumer)  : 기존 그린 톤 (공간사이 아이덴티티)
//   · 파트너(company) : 네이비 톤 (신뢰·전문성 강조)
// 컴포넌트는 기존처럼 C.* 를 쓰면 되고, 개별 수정이 필요 없다.

export const PARTNER_THEME_COLOR  = "#24406B";
export const CONSUMER_THEME_COLOR = "#2E5F4B";

export function applyRoleTheme(role) {
  if (typeof document === "undefined") return;
  const isPartner = role === "company";
  const el = document.documentElement;
  if (isPartner) el.setAttribute("data-role", "company");
  else el.removeAttribute("data-role");

  // 모바일 브라우저 상단바 색상도 함께 전환
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", isPartner ? PARTNER_THEME_COLOR : CONSUMER_THEME_COLOR);
}
