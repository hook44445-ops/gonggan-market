import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { orderLoungeTabs, tallyCategories, SPACE_CATEGORY_IDS } from "./loungeTabs.js";

const CATS = ["all", "popular", "interior", "review", "quote_worry", "room_deco", "move_in", "realestate", "marriage",
  "stock", "local", "humor", "free"].map((id) => ({ id, label: id }));

test("첫 줄 = 전체·인기 + 공간 6칸(이사입주·동네가 더보기에서 나온다)", () => {
  const { row } = orderLoungeTabs(CATS);
  assert.deepEqual(row.map((c) => c.id), ["all", "popular", ...SPACE_CATEGORY_IDS]);
});

test("숫자를 못 받으면 생활 칸은 예전 순서로 더보기 · 조용한 칸 없음", () => {
  const { extra, quiet } = orderLoungeTabs(CATS);
  assert.deepEqual(extra.map((c) => c.id), ["realestate", "marriage", "stock", "humor", "free"]);
  assert.deepEqual(quiet, []);
});

test("숫자가 있으면 — 글 있는 생활 칸은 많은 순 · 0 은 조용한 칸(지우지 않음)", () => {
  const { extra, quiet } = orderLoungeTabs(CATS, { counts: { stock: 2, free: 5, humor: 2, interior: 9 } });
  assert.deepEqual(extra.map((c) => c.id), ["free", "stock", "humor"]);
  assert.deepEqual(quiet.map((c) => c.id), ["realestate", "marriage"]);
  // 전부 어딘가에 있다 — 지운 칸 없음
  const all = orderLoungeTabs(CATS, { counts: {} });
  assert.equal(all.row.length + all.extra.length + all.quiet.length, CATS.length);
});

test("생활 칸을 고르면 첫 줄 끝에도 보인다 · 비활성 칸은 뺀다", () => {
  const { row } = orderLoungeTabs(CATS, { selected: "stock" });
  assert.equal(row.at(-1).id, "stock");
  const r2 = orderLoungeTabs([...CATS, { id: "game", label: "게임" }], { inactive: ["game"] });
  assert.ok(![...r2.row, ...r2.extra, ...r2.quiet].some((c) => c.id === "game"));
});

test("글 수 세기", () => {
  assert.deepEqual(tallyCategories([{ category: "free" }, { category: "free" }, { category: "stock" }, {}]), { free: 2, stock: 1 });
});

test("업체 카드 «메시지» — 대표 10-01 끄기(되돌리기는 상수 하나)", () => {
  const c = readFileSync(new URL("../constants/lounge.js", import.meta.url), "utf8");
  assert.match(c, /export const LOUNGE_COMPANY_MESSAGE = false;/);
  const pop = readFileSync(new URL("../components/lounge/LoungeProfilePopover.jsx", import.meta.url), "utf8");
  assert.match(pop, /LOUNGE_COMPANY_MESSAGE \?/);
  assert.match(pop, /우리 동네 견적 받아보기/);
});
