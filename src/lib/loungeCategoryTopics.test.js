import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_TOPICS, CATEGORY_ROTATION, pickCategoryTopics, composeCategoryPost } from "../constants/loungeCategoryTopics.js";
import { LOUNGE_CATEGORIES } from "../constants/lounge.js";
import { generateDraft } from "../constants/aiContentFactory.js";

test("모든 차례 카테고리가 라운지에 있고 주제가 있다", () => {
  const ids = new Set(LOUNGE_CATEGORIES.map((c) => c.id));
  for (const c of CATEGORY_ROTATION) { assert.ok(ids.has(c), c); assert.ok(CATEGORY_TOPICS[c]?.length > 0, c); }
});

test("날마다 다른 카테고리 · 연속 14일 동안 모든 카테고리가 한 번 이상", () => {
  const seen = new Set();
  let prev = null;
  for (let d = 20000; d < 20014; d++) {
    const cats = pickCategoryTopics(3, d).map((t) => t.category);
    assert.equal(new Set(cats).size, 3);
    if (prev) assert.notDeepEqual(cats, prev);
    prev = cats; cats.forEach((c) => seen.add(c));
  }
  assert.equal(seen.size, CATEGORY_ROTATION.length);
});

test("한 달 동안 같은 제목+본문이 두 번 나오지 않는다", () => {
  const bodies = new Set();
  for (let d = 20000; d < 20030; d++) {
    for (const t of pickCategoryTopics(3, d)) {
      const p = composeCategoryPost(t, { day: d });
      const key = p.title + "|" + p.content;
      assert.ok(!bodies.has(key), p.title);
      bodies.add(key);
      assert.ok(p.title.length >= 8 && p.title.length <= 40, p.title);
      assert.ok(/^## /m.test(p.content));
      assert.ok(!/\(와\)|\(를\)|\(는\)|\(가\)/.test(p.content + p.title));
    }
  }
});

test("건강·주식 글엔 안내 문구", () => {
  const h = composeCategoryPost({ ...CATEGORY_TOPICS.health[0], category: "health" });
  const s = composeCategoryPost({ ...CATEGORY_TOPICS.stock[0], category: "stock" });
  assert.match(h.content, /의료진/);
  assert.match(s.content, /투자 권유가 아닌/);
});

test("기본 각도의 조사 — 폭우와 / 부동산 대책과", () => {
  assert.ok(!generateDraft({ issue: "폭우" }).title.includes("(와)"));
  assert.ok(!generateDraft({ issue: "부동산 대책" }).title.includes("(와)"));
});
