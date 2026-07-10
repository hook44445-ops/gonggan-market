// ════════════════════════════════════════════════════════════════════
// 공간라운지 Auto Publish Gate — 자동발행 게이트 (Phase 17.5)
//
//   90점 이상의 "검증된" 콘텐츠만 자동 발행하기 위한 관문. 모든 조건을 통과해야 pass.
//     품질(Quality≥90) · Confidence≥90 · 금칙어 없음 · SEO 통과 · 중복검사 통과 ·
//     AI 검사(본문 구조/길이) 통과 · Review 상태.
//
//   ⚠️ Regression Zero: 기존 엔진을 수정하지 않고 export 함수만 호출한다
//   (scoreUsefulness=Phase8, isDuplicateTopic=Phase2). 순수 함수 · 저장/API/Cron 없음.
// ════════════════════════════════════════════════════════════════════

import { scoreUsefulness } from "./contentUsefulness.js";
import { isDuplicateTopic } from "./duplicateChecker.js";

export const QUALITY_MIN = 90;
export const CONFIDENCE_MIN = 90;

// 금칙어(운영 예시) — 발행 전 자동 차단. 필요 시 확장.
export const BANNED_WORDS = [
  "씨발", "시발", "개새끼", "병신", "좆", "지랄", "fuck", "shit",
  "마약", "필로폰", "도박사이트", "불법도박", "몸캠", "성매매",
  "보이스피싱", "대출사기", "먹튀", "카지노 추천",
];

export function checkBannedWords(text) {
  const t = String(text ?? "").toLowerCase();
  return BANNED_WORDS.filter((w) => t.includes(String(w).toLowerCase()));
}

// SEO — 제목 길이(8~40) + 소제목 최소 1개.
export function checkSeo({ title = "", body = "" } = {}) {
  const titleLen = String(title).length;
  const headings = (String(body).match(/^##\s/gm) ?? []).length;
  const ok = titleLen >= 8 && titleLen <= 40 && headings >= 1;
  return { ok, titleLen, headings };
}

// 자동발행 게이트 평가.
//   post: { title, content, category, ai_topic }
//   opts: { confidence, existing:[{ai_topic|title,created_at}], stage:'review'|'approved'|... }
//   반환: { pass, checks, reasons, quality, confidence }
//   cfg(선택 · Phase 24): { minQuality, minConfidence, dupHours, minBodyLength, minHeadings,
//     seoCheck, humanizationCheck, reviewRequired } — 미지정 시 기존 기본값(회귀 없음).
export function evaluateGate(post = {}, { confidence = null, existing = [], stage = null, cfg = {} } = {}) {
  // Phase 24 — 테스트모드: Quality 70 · Confidence/중복/Review 는 경고만(발행 허용).
  const testMode      = !!cfg.testMode;
  const minQuality    = Number.isFinite(cfg.minQuality)    ? cfg.minQuality    : (testMode ? 70 : QUALITY_MIN);
  const minConfidence = Number.isFinite(cfg.minConfidence) ? cfg.minConfidence : CONFIDENCE_MIN;
  const dupHours      = Number.isFinite(cfg.dupHours)      ? cfg.dupHours      : 48;
  const dupOn         = dupHours > 0;
  const minBody       = Number.isFinite(cfg.minBodyLength) ? cfg.minBodyLength : 400;
  const minHeadings   = Number.isFinite(cfg.minHeadings)   ? cfg.minHeadings   : 2;
  const seoOn         = cfg.seoCheck !== false;          // 기본 ON
  const reviewOn      = cfg.reviewRequired !== false;    // 기본 ON

  const u = scoreUsefulness({ title: post.title, content: post.content, category: post.category });
  const full = `${post.title ?? ""}\n${post.content ?? ""}`;
  const banned = checkBannedWords(full);
  const seo = checkSeo({ title: post.title, body: post.content });
  const dup = dupOn && isDuplicateTopic(post.ai_topic || post.title, existing, dupHours);
  const bodyLen = String(post.content ?? "").length;
  const headings = (String(post.content ?? "").match(/^##\s/gm) ?? []).length;
  const aiOk = bodyLen >= minBody && headings >= minHeadings; // AI 검사: 구조/길이 sanity
  const reviewOk = !reviewOn || stage === "review" || stage === "approved";

  const checks = {
    quality:      { ok: u.total >= minQuality, value: u.total },
    // 테스트모드에서는 Confidence/중복/Review 를 통과 처리(경고로만 수집).
    confidence:   { ok: testMode || (confidence != null && confidence >= minConfidence), value: confidence },
    banned:       { ok: banned.length === 0, value: banned },
    seo:          { ok: !seoOn || seo.ok, value: seo },
    duplicate:    { ok: testMode || !dup, value: dup },
    aiCheck:      { ok: aiOk, value: { bodyLen, headings } },
    reviewStatus: { ok: testMode || reviewOk, value: stage },
  };
  const pass = Object.values(checks).every((c) => c.ok);

  const reasons = [], warnings = [];
  const push = (soft, msg) => (soft ? warnings : reasons).push(msg);
  if (!checks.quality.ok) reasons.push(`Quality ${u.total} < ${minQuality}`);
  if (confidence == null || confidence < minConfidence) push(testMode, `Confidence ${confidence ?? "없음"} < ${minConfidence}`);
  if (!checks.banned.ok) reasons.push(`금칙어(${banned.join(", ")})`);
  if (!checks.seo.ok) reasons.push("SEO 미통과(제목 길이/소제목)");
  if (dup) push(testMode, `${dupHours}시간 내 중복`);
  if (!checks.aiCheck.ok) reasons.push("본문 길이/구조 부족");
  if (!reviewOk) push(testMode, "Review/Approved 상태 아님");

  return { pass, testMode, checks, reasons, warnings, quality: u.total, confidence };
}
