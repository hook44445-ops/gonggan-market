// Approval Dossier · Image · Chief Secretary 단위 테스트 (Phase 48)
//   실행: node --test src/lib/approvalDossier.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickRepresentativeImage, ensureImageUrls, imageCategoryOf } from "./approvalImage.js";
import { buildDossier, dossierNumber, dossierStage } from "./approvalDossier.js";

const STRONG = ["## 도입","리모델링 예산을 어떻게 잡을지 정리합니다.","","## 예산 기준","- 도배 장판","- 욕실","- 주방","일반적으로 알려진 기준과 참고 자료를 확인했습니다.","","## 업체 선택","견적을 어떻게 비교할까요? 무엇을 확인할까요?","- 실제 사례와 절차","- 주의사항 체크리스트","","## 결론","정리하면 아래 체크리스트로 준비하세요."].join("\n");

// ── 대표이미지(§11·§12) ─────────────────────────────
test("빈 image_urls 금지 — 항상 대표이미지 채움", () => {
  const urls = ensureImageUrls({ title: "장마철 욕실 곰팡이 예방법", content: STRONG });
  assert.equal(urls.length, 1); assert.ok(urls[0].startsWith("/"));
});
test("기존 이미지 있으면 유지", () => {
  assert.deepEqual(ensureImageUrls({ image_urls: ["/x.jpg"] }), ["/x.jpg"]);
});
test("이미지 카테고리 매핑 + ALT 생성", () => {
  assert.equal(imageCategoryOf({ title: "강서구 32평 리모델링 시공", content_type: "space_market" }), "SPACE_MARKET");
  const img = pickRepresentativeImage({ title: "속보 집중호우 통제", content_type: "breaking" });
  assert.equal(img.category, "BREAKING"); assert.equal(img.source, "brand_default"); // 사건 오인 방지 브랜드 이미지
  assert.ok(img.alt.length > 0 && img.url.startsWith("/"));
});

// ── 품의서(§5) ──────────────────────────────────────
test("품의번호 형식 AI-YYYYMMDD-XXXX", () => {
  assert.match(dossierNumber({ id: "abc123", created_at: "2026-07-12T04:00:00Z" }), /^AI-\d{8}-\d{4}$/);
});
test("강한 콘텐츠 → 4인 서명·BOARD_APPROVED·총괄비서실장 인수", () => {
  const rec = { id: "d1", title: "강서구 32평 리모델링 비용 총정리 가이드", content: STRONG, category: "interior", publish_status: "draft", created_at: "2026-07-12T04:00:00Z", updated_at: "2026-07-12T04:00:00Z", is_seed: true };
  const d = buildDossier(rec, { now: Date.parse("2026-07-12T05:00:00Z") });
  assert.equal(d.reviewers.length, 4);
  assert.ok(d.reviewers.every((r) => r.signed), "4인 전원 서명");
  assert.ok(d.reviewers.every((r) => r.signedAt), "서명 시각 존재");
  assert.equal(d.boardApproved, true);
  assert.equal(d.chiefSecretary.received, true, "총괄비서실장 자동 인수");
  assert.equal(d.reviewMode, "heuristic", "정직 표기");
  assert.ok(d.image.url.startsWith("/"));
  assert.ok(["IMMEDIATE", "SCHEDULED"].includes(d.publishMode));
  assert.ok(d.timeline.some((t) => t.label === "BOARD_APPROVED" && t.done));
});
test("Hard Fail(위험 단정) → 서명 미완료·미승인·예외함", () => {
  const rec = { id: "bad", title: "이 약은 반드시 낫는다 100% 완치", content: "## 소개\n이 약은 반드시 낫는다. 무조건 오른다. 반드시 성공합니다. " + STRONG, category: "health", publish_status: "draft", created_at: "2026-07-12T04:00:00Z", is_seed: true };
  const d = buildDossier(rec, { now: Date.parse("2026-07-12T05:00:00Z") });
  assert.equal(d.hardFail, true);
  assert.equal(d.boardApproved, false);
  assert.equal(d.chiefSecretary.received, false);
  assert.equal(dossierStage(d), "예외함");
});
test("dossierStage — 상태별 버킷", () => {
  const base = { id: "x", title: "장마철 욕실 곰팡이 예방법 총정리", content: STRONG, created_at: "2026-07-12T04:00:00Z", is_seed: true };
  assert.equal(dossierStage(buildDossier({ ...base, publish_status: "published", updated_at: "2026-07-12T05:00:00Z" })), "발행완료");
  assert.equal(dossierStage(buildDossier({ ...base, publish_status: "scheduled", scheduled_at: "2026-07-13T05:00:00Z" })), "총괄비서실장");
});
