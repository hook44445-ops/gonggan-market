// 라운지 카테고리 탭 순서(2026-10-01 · docs/LOUNGE-USP 점검 C) — 순수 JS.
//
// 왜: 20칸 중 14칸이 생활(연애·주식·취업·여행…)이고, 공간 이야기 «이사입주»·«동네»는 «더보기» 속 결혼·주식 사이에 묻혀 있었다.
//     사람이 적을 때 빈 칸이 많으면 «죽은 곳»처럼 보이고 «공간»라운지 정체성이 흐려진다.
// 지키는 것: **아무 칸도 지우지 않는다**(전부 고를 수 있다). 순서와 접는 자리만 바꾼다.
//   첫 줄   = 전체·인기 + 공간 이야기 6칸
//   더보기  = 생활 칸 중 최근 글이 있는 칸(많은 순)
//   조용한 칸 = 최근 글이 0인 생활 칸(흐리게 · 맨 뒤) — 숫자를 못 받았으면 나누지 않는다(예전 순서)

export const SPACE_CATEGORY_IDS = ["interior", "review", "quote_worry", "room_deco", "move_in", "local"];
const HEAD_IDS = ["all", "popular"];

export function orderLoungeTabs(categories = [], { counts = null, selected = null, inactive = [] } = {}) {
  const cats = (Array.isArray(categories) ? categories : []).filter((c) => c && !inactive.includes(c.id));
  const byId = new Map(cats.map((c) => [c.id, c]));
  const head = HEAD_IDS.map((id) => byId.get(id)).filter(Boolean);
  const space = SPACE_CATEGORY_IDS.map((id) => byId.get(id)).filter(Boolean);
  const life = cats.filter((c) => !HEAD_IDS.includes(c.id) && !SPACE_CATEGORY_IDS.includes(c.id));

  let extra = life, quiet = [];
  if (counts && typeof counts === "object") {
    const n = (id) => Number(counts[id]) || 0;
    extra = life.filter((c) => n(c.id) > 0).sort((a, b) => n(b.id) - n(a.id));   // sort 는 안정 — 같은 수면 원래 순서
    quiet = life.filter((c) => n(c.id) === 0);
  }

  const row = [...head, ...space];
  // 생활 칸을 골랐으면 첫 줄 끝에도 보여 준다(무엇을 보고 있는지 안 보이면 길을 잃는다)
  const sel = selected ? byId.get(selected) : null;
  if (sel && !row.includes(sel)) row.push(sel);
  return { row, extra, quiet };
}

// lounge_posts 의 category 목록 → { id: 글 수 }
export function tallyCategories(rows = []) {
  const out = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    const id = r?.category;
    if (id) out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}
