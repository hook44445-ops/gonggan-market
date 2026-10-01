// 관리자 소분류 줄 — 자주 쓰는 탭만 앞에, 나머지는 «더 보기»(10-01 대표 «관리자 페이지 보기 쉽게»).
//   · tab.more = true 인 탭은 접힌 칸 안에 · 지금 보는 탭이 접힌 칸에 있으면 자동으로 펼친다.
//   · 권한(운영자)으로 걸러진 뒤의 탭만 다룬다 — 숨길 앞 탭이 없으면 «더 보기» 없이 다 보인다.
// 순수 JS.
export function splitTabs(tabs = [], { mainTab = null, open = false } = {}) {
  const list = Array.isArray(tabs) ? tabs : [];
  const front = list.filter((t) => !t.more);
  const rest = list.filter((t) => t.more);
  if (!rest.length) return { front: list, rest: [], showMore: false, expanded: true };
  if (!front.length) return { front: rest, rest: [], showMore: false, expanded: true };
  const expanded = open || rest.some((t) => t.key === mainTab);
  return { front, rest, showMore: true, expanded };
}
