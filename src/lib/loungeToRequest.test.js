import { test } from "node:test";
import assert from "node:assert/strict";
import { tagsFromPost, requestPrefillFromPost } from "./loungeToRequest.js";

test("작은 수리 글 → 작은 수리 칩 + 평수 무관·50만원 이하", () => {
  const p = requestPrefillFromPost({ title: "욕실 실리콘 곰팡이 어떻게 지우나요", content: "세면대 수전도 물이 새요" });
  assert.deepEqual(tagsFromPost({ title: "욕실 실리콘 곰팡이", content: "세면대 수전" }), ["수전·세면대", "실리콘", "욕실"]);
  assert.ok(p.desc.startsWith("수전·세면대, 실리콘, 욕실 — 라운지 글 «"));
  assert.equal(p.size, undefined);   // 욕실은 작은 수리 칩이 아니라 평수·예산은 비워 둔다
});

test("작은 수리 칩만이면 평수 무관·50만원 이하까지", () => {
  const p = requestPrefillFromPost({ title: "변기 교체 비용", content: "" });
  assert.equal(p.desc, "변기 — 라운지 글 «변기 교체 비용» 보고 요청해요");
  assert.equal(p.size, "평수 무관(작은 수리)");
  assert.equal(p.budget, "50만원 이하");
});

test("인테리어 낱말이 없으면 null(링크 숨김) · 칩은 최대 3개", () => {
  assert.equal(requestPrefillFromPost({ title: "강아지 산책 코스 추천", content: "한강" }), null);
  assert.equal(tagsFromPost({ title: "도배 장판 타일 필름 몰딩 전부" }).length, 3);
});

test("칩 이름이 요청서(RequestModalBeta) 칩과 같다 — 다르면 요청서가 칩으로 못 알아본다", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../components/RequestModalBeta.jsx", import.meta.url), "utf-8");
  const all = ["수전 교체 세면대 변기 실리콘 곰팡이 손잡이 욕실 주방 필름 도배 바닥 타일 줄눈 누수 방수 페인트 조명 창호 중문 몰딩 단열"];
  for (const tag of tagsFromPost({ title: all[0] }).concat(tagsFromPost({ title: "주방 필름 도배" }), tagsFromPost({ title: "바닥 타일 줄눈" }),
    tagsFromPost({ title: "누수 방수 페인트" }), tagsFromPost({ title: "조명 창호 중문" }), tagsFromPost({ title: "몰딩 단열" }))) {
    assert.ok(src.includes(`"${tag}"`), `요청서에 없는 칩: ${tag}`);
  }
});
