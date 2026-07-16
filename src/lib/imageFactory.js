// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI 이미지공장 (Image Factory) — Phase 58-1
//
//   AI 지식매거진신문사의 이미지 조직. 기사를 분석해 필요한 이미지 수(0~3장)와 스타일을
//   자동 결정(Image Router)하고, 생성된 이미지를 4단계로 품의(PASS/NOTE/REVISE/HARD_FAIL)한다.
//
//   조직 흐름: AI 기자 → Fusion → 이미지공장 → 이미지 품의 → 편집국 → 총괄비서실장 → 발행
//
//   ⚠️ 기존 Workflow Engine 무수정 · Additive. 순수 함수 · DB/외부 API 없음.
//     실제 이미지 생성 모델(Flux 등)은 미연결 — 이 모듈은 라우팅·스펙·품의 규칙만 담당한다.
//     기존 approvalImage(imageCategoryOf/pickRepresentativeImage) 재사용(무수정).
// ════════════════════════════════════════════════════════════════════

import { imageCategoryOf, pickRepresentativeImage } from "./approvalImage.js";

// ── 카테고리 → 이미지 스타일(지시서 예시 반영) ──────────────────────────
//   뉴스→인포그래픽 / 경제→차트 / 공간→인테리어 / 건강→의료 일러스트 /
//   신앙→따뜻한 감성 / AI→미래지향
export const IMAGE_STYLES = {
  BREAKING:      { style: "infographic",   label: "인포그래픽", tone: "명료·중립" },
  NEWS:          { style: "infographic",   label: "인포그래픽", tone: "명료·중립" },
  MORNING_BRIEF: { style: "infographic",   label: "인포그래픽", tone: "정리·요약" },
  BUSINESS:      { style: "chart",         label: "차트·그래프", tone: "데이터" },
  SPACE_MARKET:  { style: "interior",      label: "인테리어",   tone: "공간·따뜻함" },
  INTERIOR:      { style: "interior",      label: "인테리어",   tone: "공간·따뜻함" },
  LIFESTYLE:     { style: "medical_illust",label: "의료 일러스트", tone: "건강·안심" },
  QT:            { style: "warm_emotional",label: "따뜻한 감성", tone: "신앙·위로" },
  ASTROLOGY:     { style: "warm_emotional",label: "따뜻한 감성", tone: "감성·신비" },
  TECH:          { style: "futuristic",    label: "미래지향",   tone: "AI·미래" },
  TIME_TREND:    { style: "editorial",     label: "에디토리얼", tone: "트렌드" },
  EDITORIAL:     { style: "editorial",     label: "에디토리얼", tone: "칼럼" },
  DEFAULT:       { style: "brand",         label: "브랜드 기본", tone: "공간라운지" },
};

export function styleFor(category) {
  return IMAGE_STYLES[category] || IMAGE_STYLES.DEFAULT;
}

// ── Image Router — 기사 분석 → 이미지 필요 여부/장수(0~3)/스타일 결정 ────
//   본문 길이·유형으로 장수를 정한다. 짧은 글=0~1장, 심층/공간/뉴스=2~3장.
export function imageRouter(article = {}) {
  const category = imageCategoryOf(article);
  const style = styleFor(category);
  const body = String(article.content ?? article.body ?? "");
  const len = body.replace(/\s/g, "").length;

  // 이미지 필요 여부.
  const needsImage = len >= 120; // 사실상 빈 글은 이미지 불필요.
  let count = 0;
  if (needsImage) {
    if (len >= 1600) count = 3;
    else if (len >= 700) count = 2;
    else count = 1;
    // 공간/인테리어/뉴스는 시각 비중이 커서 최소 1장 보정.
    if (["SPACE_MARKET", "INTERIOR", "BREAKING", "NEWS", "BUSINESS"].includes(category)) count = Math.max(count, 1);
    // QT/운세는 감성 1장이면 충분(과다 방지).
    if (["QT", "ASTROLOGY"].includes(category)) count = Math.min(count, 1);
  }

  // 슬롯 구성 — 대표(hero) + 본문 보조(body) + 마무리(closing).
  const roles = ["hero", "body", "closing"];
  const slots = Array.from({ length: count }, (_, i) => ({
    index: i,
    role: roles[i] || "body",
    style: style.style,
    styleLabel: style.label,
    placement: i === 0 ? "top" : "inline",
    prompt: buildImagePrompt(article, category, style, roles[i] || "body"),
  }));

  return { needed: needsImage && count > 0, count, category, style: style.style, styleLabel: style.label, tone: style.tone, slots };
}

// 이미지 생성 프롬프트(스펙) — 실제 이미지 모델 주입 시 사용. 사건 사진 오인 금지.
export function buildImagePrompt(article, category, style, role) {
  const title = String(article.title ?? "").slice(0, 60);
  const base = `${style.label} 스타일, ${style.tone} 톤, "${title}" 주제의 ${role} 이미지`;
  const guard = "실제 인물/사건 사진 합성 금지 · 저작권 안전 · 브랜드(공간라운지) 톤";
  return `${base}. ${guard}.`;
}

// ── 이미지 품의(§검토 항목 5) — PASS / NOTE / REVISE / HARD_FAIL ─────────
//   ① 기사와 일치 ② 오해 소지 없음 ③ 저작권 위험 없음 ④ 브랜드 톤 ⑤ 본문 위치 적절
export const IMAGE_DECISION = { PASS: "PASS", NOTE: "PASS_WITH_NOTE", REVISE: "REVISE", HARD_FAIL: "HARD_FAIL" };

export function reviewImage(image = {}, article = {}, { expectedCategory = null } = {}) {
  const cat = expectedCategory || imageCategoryOf(article);
  const url = String(image.url ?? "");
  const alt = String(image.alt ?? "");
  const source = String(image.source ?? "");
  const style = String(image.style ?? "");
  const expectStyle = styleFor(cat).style;

  const checks = {
    // ① 기사 일치 — 카테고리/스타일 일치.
    matchesArticle: !image.category || image.category === cat,
    // ② 오해 소지 — 뉴스/속보에 실사(사건사진) 오인 소지 금지(브랜드 자료만 허용).
    noMisleading: !(["BREAKING", "NEWS"].includes(cat) && /photo|real|사진합성/i.test(source)),
    // ③ 저작권 — 외부검색 이미지에 출처 없음 = 위험.
    noCopyrightRisk: !(source === "external_search" && !image.license),
    // ④ 브랜드 톤 — 스타일이 카테고리 기대 스타일과 부합(빈 값은 통과).
    onBrand: !style || style === expectStyle,
    // ⑤ 위치 적절 — placement 유효.
    goodPlacement: !image.placement || ["top", "inline", "bottom"].includes(image.placement),
    // 무결성 — URL/ALT 존재(비어있으면 발행 불가).
    hasUrlAlt: url.length > 0 && alt.length > 0,
  };

  // Hard Fail 조건: 저작권 위험, 뉴스 오인, URL/ALT 공백.
  const hardFail = !checks.noCopyrightRisk || !checks.noMisleading || !checks.hasUrlAlt;
  const issues = [];
  if (!checks.matchesArticle) issues.push("기사 카테고리와 이미지 불일치");
  if (!checks.noMisleading) issues.push("뉴스/속보 실사 오인 소지");
  if (!checks.noCopyrightRisk) issues.push("저작권 출처 불명");
  if (!checks.onBrand) issues.push("브랜드 톤/스타일 불일치");
  if (!checks.goodPlacement) issues.push("본문 위치 부적절");
  if (!checks.hasUrlAlt) issues.push("URL/ALT 공백");

  let decision;
  if (hardFail) decision = IMAGE_DECISION.HARD_FAIL;
  else if (!checks.matchesArticle || !checks.onBrand) decision = IMAGE_DECISION.REVISE;
  else if (!checks.goodPlacement) decision = IMAGE_DECISION.NOTE;
  else decision = IMAGE_DECISION.PASS;

  return { decision, checks, issues, category: cat, publishable: decision === IMAGE_DECISION.PASS };
}

// 이미지 세트 품의 게이트 — 전원 PASS 여야 발행 가능. (NOTE 는 메모 후 통과 허용)
export function imageApprovalGate(reviews = []) {
  if (!reviews.length) return { approved: true, reason: "NO_IMAGE", passCount: 0, total: 0 };
  const hardFail = reviews.some((r) => r.decision === IMAGE_DECISION.HARD_FAIL);
  const revise = reviews.filter((r) => r.decision === IMAGE_DECISION.REVISE).length;
  const passOrNote = reviews.every((r) => r.decision === IMAGE_DECISION.PASS || r.decision === IMAGE_DECISION.NOTE);
  const approved = passOrNote && !hardFail;
  return {
    approved,
    reason: hardFail ? "HARD_FAIL" : revise ? "REVISE_PENDING" : approved ? "APPROVED" : "INCOMPLETE",
    passCount: reviews.filter((r) => r.decision === IMAGE_DECISION.PASS).length,
    reviseCount: revise,
    total: reviews.length,
  };
}

// 편의: 기사 → 라우팅 → 대표이미지 선정 → 품의까지 한 번에(결정론 파이프라인).
export function runImagePipeline(article = {}) {
  const route = imageRouter(article);
  if (!route.needed) return { route, images: [], reviews: [], gate: imageApprovalGate([]) };
  const rep = pickRepresentativeImage(article);
  const images = route.slots.map((s, i) => ({
    ...s,
    url: i === 0 ? rep.url : rep.url, // 실제 생성 모델 주입 전까지 대표이미지 재사용(빈 이미지 금지).
    alt: rep.alt,
    source: rep.source,
    category: rep.category,
    placement: s.placement,
    license: rep.source === "external_search" ? null : "brand",
  }));
  const reviews = images.map((img) => reviewImage(img, article, { expectedCategory: rep.category }));
  return { route, images, reviews, gate: imageApprovalGate(reviews) };
}
