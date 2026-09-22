import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeShowcases, showcaseTypes } from "./showcases.js";

test("사진 없는 리뷰는 사례에서 빠진다", () => {
  const out = normalizeShowcases({ topReviews: [{ id: 1, content: "좋아요" }], seedReviews: [] });
  assert.equal(out.length, 0);
});

test("실제 리뷰: after 우선 · before 따로 · 업체 이름 가림", () => {
  const out = normalizeShowcases({
    topReviews: [{ id: 7, content: " 깔끔 ", after_image_urls: ["a1", "a2"], before_image_urls: ["b1"], image_urls: ["a2", "x"],
      companies: { name: "공간인테리어" }, company_id: "c1", space_type: "욕실", region: "성남시", rating: 5 }],
    maskName: (n) => n.slice(0, 2) + "○○",
  });
  assert.equal(out[0].photo, "a1");
  assert.equal(out[0].before, "b1");
  assert.deepEqual(out[0].gallery, ["a1", "a2", "x"]);
  assert.equal(out[0].company, "공간○○");
  assert.equal(out[0].text, "깔끔");
  assert.equal(out[0].title, "욕실");
  assert.equal(out[0].meta, "성남시 · 공간○○");
});

test("예시 리뷰는 isSeed 로 표시되고 업체 연결이 없다", () => {
  const out = normalizeShowcases({ seedReviews: [{ id: 3, after_image_url: "s1", masked_company_name: "공간○○", category: "주방" }] });
  assert.equal(out[0].id, "seed_3");
  assert.equal(out[0].isSeed, true);
  assert.equal(out[0].companyId, null);
  assert.equal(out[0].spaceType, "주방");
});

test("필터 칩은 실제 있는 유형만, 순서대로", () => {
  assert.deepEqual(showcaseTypes([{ spaceType: "욕실" }, { spaceType: null }, { spaceType: "주방" }, { spaceType: "욕실" }]), ["욕실", "주방"]);
});
