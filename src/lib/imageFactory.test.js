// AI 이미지공장 단위 테스트 (Phase 58-1)
//   실행: node --test src/lib/imageFactory.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  imageRouter, styleFor, reviewImage, imageApprovalGate, runImagePipeline, IMAGE_DECISION,
} from "./imageFactory.js";

const LONG = "인테리어 시공을 시작하기 전에 확인해야 할 핵심 항목을 정리합니다. ".repeat(20);

test("styleFor — 카테고리별 스타일(뉴스=인포그래픽/경제=차트/공간=인테리어/신앙=감성/AI=미래지향)", () => {
  assert.equal(styleFor("NEWS").style, "infographic");
  assert.equal(styleFor("BUSINESS").style, "chart");
  assert.equal(styleFor("SPACE_MARKET").style, "interior");
  assert.equal(styleFor("QT").style, "warm_emotional");
  assert.equal(styleFor("TECH").style, "futuristic");
});

test("imageRouter — 본문 길이/카테고리로 0~3장 결정", () => {
  assert.equal(imageRouter({ title: "제목", content: "" }).count, 0); // 빈 본문 → 0장
  const space = imageRouter({ title: "인테리어 시공 가이드", content: LONG });
  assert.ok(space.count >= 1 && space.count <= 3);
  assert.equal(space.style, "interior");
  assert.equal(space.slots.length, space.count);
  // QT는 감성 1장으로 제한.
  const qt = imageRouter({ title: "오늘 큐티 말씀", content: LONG });
  assert.ok(qt.count <= 1);
});

test("reviewImage — 저작권/오인/공백은 HARD_FAIL, 정상은 PASS", () => {
  const article = { title: "인테리어 시공", content: LONG };
  const good = reviewImage({ url: "/mock/after-kitchen.svg", alt: "인테리어 대표", source: "category_default", category: "SPACE_MARKET", style: "interior", placement: "top" }, article);
  assert.equal(good.decision, IMAGE_DECISION.PASS);
  assert.equal(good.publishable, true);

  const noAlt = reviewImage({ url: "/x.svg", alt: "", source: "category_default" }, article);
  assert.equal(noAlt.decision, IMAGE_DECISION.HARD_FAIL);

  const copyright = reviewImage({ url: "http://ext/img.jpg", alt: "외부", source: "external_search" }, article);
  assert.equal(copyright.decision, IMAGE_DECISION.HARD_FAIL); // license 없음

  const news = reviewImage({ url: "/x.svg", alt: "속보", source: "photo-real" }, { title: "속보 침수 통제", content: LONG });
  assert.equal(news.decision, IMAGE_DECISION.HARD_FAIL); // 뉴스 실사 오인
});

test("imageApprovalGate — 전원 PASS/NOTE만 승인, REVISE/HARD_FAIL 차단", () => {
  const p = { decision: IMAGE_DECISION.PASS }, n = { decision: IMAGE_DECISION.NOTE };
  assert.equal(imageApprovalGate([p, n]).approved, true);
  assert.equal(imageApprovalGate([p, { decision: IMAGE_DECISION.REVISE }]).approved, false);
  assert.equal(imageApprovalGate([p, { decision: IMAGE_DECISION.HARD_FAIL }]).approved, false);
  assert.equal(imageApprovalGate([]).reason, "NO_IMAGE");
});

test("runImagePipeline — 라우팅→선정→품의 일괄, 빈 이미지 없음", () => {
  const r = runImagePipeline({ title: "인테리어 시공 완벽 가이드", content: LONG });
  assert.ok(r.route.needed);
  assert.equal(r.images.length, r.route.count);
  assert.ok(r.images.every((i) => i.url && i.alt));
  assert.equal(r.reviews.length, r.images.length);
  assert.equal(typeof r.gate.approved, "boolean");
});
