import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { maskName, shareableReviews, clampReview, stars } from "./reviewShare.js";

test("이름은 첫 글자만", () => {
  assert.equal(maskName("김민수"), "김○○");
  assert.equal(maskName("익명"), "고객");
  assert.equal(maskName(""), "고객");
});

test("별 4개 이상 · 짧은 글 빼기 · 별 → 최근 순", () => {
  const rows = [
    { id: 1, rating: 5, content: "꼼꼼하게 해 주셨어요 감사합니다", user_name: "김민수", created_at: "2026-09-01", region: "서울 강서구", space_type: "욕실" },
    { id: 2, rating: 3, content: "보통이에요 그냥저냥", user_name: "이", created_at: "2026-09-02" },
    { id: 3, rating: 4, content: "좋아요 추천해요", user_name: "박", created_at: "2026-09-03" },
    { id: 6, rating: 4, content: "좋아요", user_name: "정", created_at: "2026-09-07" },
    { id: 4, rating: 5, content: "시간 잘 지키셨어요", user_name: "최영", created_at: "2026-09-05" },
    { id: 5, rating: 5, content: "굿", created_at: "2026-09-06" },
  ];
  const out = shareableReviews(rows);
  assert.deepEqual(out.map((r) => r.id), [4, 1, 3]);
  assert.equal(out[1].who, "김○○ 고객");
  assert.equal(out[1].region, "강서구");
  assert.equal(out[0].text, "시간 잘 지키셨어요");
});

test("긴 글 자르기 · 별", () => {
  assert.equal([...clampReview("가".repeat(200))].length, 110);
  assert.ok(clampReview("가".repeat(200)).endsWith("…"));
  assert.equal(stars(4), "★★★★☆");
});

test("업체 마이에 «⭐ 후기 카드» 입구", () => {
  const my = readFileSync(new URL("../screens/v3/MyPageV3.jsx", import.meta.url), "utf8");
  assert.match(my, /<ReviewShareCard /);
  assert.match(my, /label="후기 카드"/);
});
