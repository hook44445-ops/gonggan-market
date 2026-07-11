// ════════════════════════════════════════════════════════════════════
// 공간라운지 Quality Evaluator — 품질 자동평가(9항목 · 유형별 루브릭) (Phase 42)
//
//   초안을 100점 기준 9개 항목으로 평가한다. 점수를 임의로 올리거나 기준을 낮추지 않는다 —
//   실제 본문 신호(길이·구조·근거어휘·질문충족·중복·문체 등)로 결정론적으로 계산한다.
//   유형(뉴스/공간마켓/QT/인도점성술/Time Trend)별로 평가 포인트를 달리 적용한다.
//
//   ⚠️ Regression Zero: 기존 Safety Gate(autoPublishGate.evaluateGate)는 그대로 두고(무수정),
//     기존 scoreUsefulness/checkSeo/checkBannedWords 신호만 재사용한다. 순수 함수 · 저장/API 없음.
//   반환 구조(요청 스펙):
//     { totalScore, passed, band, breakdown{항목:{score,max}}, weakPoints[], revisions[], factuality, ... }
// ════════════════════════════════════════════════════════════════════

import { scoreUsefulness } from "./contentUsefulness.js";
import { checkSeo, checkBannedWords } from "./autoPublishGate.js";
import { classifyContentType } from "./contentTypes.js";

export const QUALITY_PASS = 85;        // 승인대기 통과 기준
export const FACTUALITY_MIN = 10;      // 자동발행 최소 사실성 점수(15점 만점 중)

// 9개 평가항목 만점(합계 100).
export const RUBRIC_MAX = {
  contentDepth: 20, structure: 15, factuality: 15, searchIntent: 15,
  seoNatural: 10, titleQuality: 10, dedupe: 5, toneNatural: 5, ctaClosing: 5,
};
export const RUBRIC_LABELS = {
  contentDepth: "내용 충실도", structure: "구조와 가독성", factuality: "사실성·근거",
  searchIntent: "검색 의도 충족", seoNatural: "SEO 자연스러움", titleQuality: "제목 완성도",
  dedupe: "중복·군더더기 제거", toneNatural: "문체 자연스러움", ctaClosing: "CTA·마무리",
};

// 자동 보완 제안 — 항목별 처방(요청 스펙의 "자동 보완 규칙").
const REVISION_HINT = {
  contentDepth: "사례·절차·체크리스트·주의사항을 보강",
  structure: "도입·핵심요약·H2/H3·결론으로 구조 재정리",
  factuality: "검증되지 않은 문장 제거 또는 출처 필요 표시",
  searchIntent: "독자가 실제로 궁금해할 질문과 답 추가",
  seoNatural: "핵심키워드·연관어를 제목·소제목·본문에 자연스럽게 반영",
  titleQuality: "구체적 대상·숫자를 넣어 제목을 명료하게",
  dedupe: "반복 문장·군더더기 제거",
  toneNatural: "기계적 표현·번역투·반복 제거",
  ctaClosing: "마무리 요약·다음 행동(CTA) 추가",
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const countHits = (t, ws) => ws.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);

const HEDGE = ["무조건", "반드시 성공", "확실히 오른다", "100%", "대박", "틀림없이", "확정", "반드시"];
const RELIABLE = ["일반적으로", "알려진", "참고", "출처", "사례", "데이터", "기준", "확인", "according", "기록"];
const QUESTION_CUES = ["?", "어떻게", "무엇", "왜", "얼마", "언제", "어디", "방법", "비용", "차이", "고르는", "준비"];
const CLOSING_CUES = ["정리하면", "마무리", "결론", "요약", "도움이", "확인해", "참고하세요", "체크리스트", "다음 단계"];
const TRANSLATIONESE = ["것을 통해", "에 대한 것", "그것은", "라는 것을", "하는 것에 대해", "에 의해"];
const PROMO = ["최저가", "무조건 싸", "강력 추천", "지금 바로 신청", "1위 업체", "홍보"];
const OPINION = ["내 생각", "개인적으로", "~인 것 같다", "느낌이다", "듯하다"];

// 문장 배열(마침표/줄바꿈 기준 근사).
function sentences(body) {
  return String(body).split(/(?<=[.!?…])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length >= 6);
}
// 중복 문장 비율(0~1).
function repetitionRatio(body) {
  const ss = sentences(body);
  if (ss.length < 2) return 0;
  const seen = new Set(); let dup = 0;
  for (const s of ss) { const k = s.slice(0, 40); if (seen.has(k)) dup++; else seen.add(k); }
  return dup / ss.length;
}
// 최다 단어 반복 비율(SEO 과다삽입 근사).
function maxWordShare(full) {
  const words = String(full).toLowerCase().split(/[\s,·:;!?()[\]"'.]+/).filter((w) => w.length >= 2);
  if (words.length < 10) return 0;
  const freq = {}; let max = 0;
  for (const w of words) { freq[w] = (freq[w] || 0) + 1; if (freq[w] > max) max = freq[w]; }
  return max / words.length;
}

// 유형 정규화 → 평가군.
function typeGroup(typeId) {
  if (["morning_brief", "breaking"].includes(typeId)) return "news";
  if (["trend_past", "trend_present", "trend_future"].includes(typeId)) return "trend";
  if (typeId === "qt") return "qt";
  if (typeId === "astrology") return "astrology";
  if (typeId === "space_market") return "space_market";
  return "general";
}

// 메인 평가. draft: { title, content|body, category, type?|content_type?, ai_topic? }
export function evaluateQuality(draft = {}) {
  const title = String(draft.title ?? "");
  const body = String(draft.content ?? draft.body ?? "");
  const category = draft.category ?? "";
  const typeId = draft.type || draft.content_type || classifyContentType(title || draft.ai_topic || "");
  const group = typeGroup(typeId);
  const full = `${title}\n${body}`;

  const u = scoreUsefulness({ title, content: body, category });      // 기존 유용성 신호 재사용
  const seo = checkSeo({ title, body });
  const banned = checkBannedWords(full);
  const len = body.length;
  const headings = (body.match(/^#{1,3}\s/gm) ?? []).length;
  const bullets = (body.match(/^[-*·]\s/gm) ?? []).length;
  const paras = body.split(/\n{2,}/).filter((p) => p.trim().length > 0).length;
  const titleLen = title.length;

  // ── 항목별 원점수(각 만점 기준) ──
  // 내용 충실도(20): 유용성 정보/실용 + 충분한 길이.
  let contentDepth = clamp(Math.round((u.axes.infoValue * 0.5 + u.axes.realHelp * 0.5) / 100 * 16 + Math.min(len / 120, 4)), 0, 20);
  // 구조와 가독성(15): 소제목·목록·문단.
  let structure = clamp(Math.round(4 + headings * 3 + Math.min(bullets, 4) * 1.2 + Math.min(paras, 4) * 1), 0, 15);
  // 사실성·근거(15): 근거어휘 가점, 과장/단정 감점.
  let factuality = clamp(Math.round(8 + countHits(full, RELIABLE) * 2 - countHits(full, HEDGE) * 3), 0, 15);
  // 검색 의도 충족(15): 질문 신호 + 카테고리 적합성.
  const qCues = countHits(full, QUESTION_CUES);
  let searchIntent = clamp(Math.round(5 + Math.min(qCues, 5) * 1.4 + u.axes.categoryFit / 100 * 3), 0, 15);
  // SEO 자연스러움(10): 제목/소제목 기본 + 과다삽입 감점.
  const stuffing = maxWordShare(full);
  let seoNatural = clamp(Math.round((seo.ok ? 8 : 4) + (stuffing > 0.06 ? -4 : 2)), 0, 10);
  // 제목 완성도(10): 길이 적정 + 구체성(숫자/지역/대상).
  const titleSpecific = /\d|구|동|평|비용|방법|후기|가이드|체크/.test(title);
  let titleQuality = clamp(Math.round((titleLen >= 8 && titleLen <= 40 ? 6 : 3) + (titleSpecific ? 4 : 1)), 0, 10);
  // 중복·군더더기 제거(5): 반복 적을수록 높음.
  let dedupe = clamp(Math.round(5 - repetitionRatio(body) * 10), 0, 5);
  // 문체 자연스러움(5): 번역투·억지 공간연결 감점.
  let toneNatural = clamp(Math.round(5 - countHits(full, TRANSLATIONESE) * 1.2 - (u.forcedLinks || 0) * 1.5), 0, 5);
  // CTA·마무리(5): 마무리/행동 유도 존재.
  let ctaClosing = clamp(Math.round(1 + Math.min(countHits(full, CLOSING_CUES), 4)), 0, 5);

  // ── 유형별 별도 평가(가감점 + 약점 사유) ──
  const typeNotes = [];
  if (group === "news") {
    const hasDate = /\d{4}[.\-년]|\d{1,2}월|\d{1,2}일|오늘|어제/.test(full);
    const hasSource = /출처|보도|according|기자|뉴스|발표/.test(full);
    if (!hasDate) { searchIntent = clamp(searchIntent - 3, 0, 15); typeNotes.push("뉴스형: 날짜 표기 부족"); }
    if (!hasSource) { factuality = clamp(factuality - 4, 0, 15); typeNotes.push("뉴스형: 출처 부족"); }
    if (countHits(full, OPINION) > 0) { factuality = clamp(factuality - 3, 0, 15); typeNotes.push("뉴스형: 과도한 해석"); }
  } else if (group === "space_market") {
    if (u.spaceRelevanceAux < 40) { searchIntent = clamp(searchIntent - 3, 0, 15); typeNotes.push("공간마켓형: 공간 관점 약함"); }
    if (countHits(full, PROMO) > 0) { toneNatural = clamp(toneNatural - 2, 0, 5); typeNotes.push("공간마켓형: 과도한 홍보"); }
  } else if (group === "qt") {
    const hasScripture = /[0-9]:[0-9]|장\s?\d|편|말씀|성경/.test(full);
    const hasApply = /적용|질문|묵상|오늘/.test(full);
    if (!hasScripture) { factuality = clamp(factuality - 3, 0, 15); typeNotes.push("QT형: 본문 성구 부족"); }
    if (!hasApply) { ctaClosing = clamp(ctaClosing - 2, 0, 5); typeNotes.push("QT형: 적용 질문 부족"); }
  } else if (group === "astrology") {
    const hasDisclaimer = /오락|참고|재미|엔터/.test(full);
    const deterministic = /반드시|틀림없이|확정|예언|무조건/.test(full);
    if (!hasDisclaimer) { toneNatural = clamp(toneNatural - 2, 0, 5); typeNotes.push("인도점성술형: 오락·참고 고지 필요"); }
    if (deterministic) { factuality = clamp(factuality - 4, 0, 15); typeNotes.push("인도점성술형: 단정적 예언 표현"); }
  } else if (group === "trend") {
    const hasPast = /과거|예전|이전|했었/.test(full), hasNow = /현재|지금|요즘/.test(full), hasFuture = /미래|전망|예상|앞으로/.test(full);
    if (!(hasPast && hasNow && hasFuture)) { structure = clamp(structure - 2, 0, 15); typeNotes.push("Time Trend형: 과거·현재·미래 구분 부족"); }
  }

  const breakdown = {
    contentDepth: { score: contentDepth, max: 20 },
    structure: { score: structure, max: 15 },
    factuality: { score: factuality, max: 15 },
    searchIntent: { score: searchIntent, max: 15 },
    seoNatural: { score: seoNatural, max: 10 },
    titleQuality: { score: titleQuality, max: 10 },
    dedupe: { score: dedupe, max: 5 },
    toneNatural: { score: toneNatural, max: 5 },
    ctaClosing: { score: ctaClosing, max: 5 },
  };
  const totalScore = Object.values(breakdown).reduce((s, x) => s + x.score, 0);

  // 약점 = 만점 대비 70% 미만 항목.
  const weakKeys = Object.keys(breakdown).filter((k) => breakdown[k].score < breakdown[k].max * 0.7);
  const weakPoints = [...weakKeys.map((k) => RUBRIC_LABELS[k]), ...typeNotes];
  const revisions = weakKeys.map((k) => REVISION_HINT[k]);

  // 밴드(요청 스펙).
  const band = totalScore >= 90 ? "우수" : totalScore >= 85 ? "통과" : totalScore >= 80 ? "보완1" : totalScore >= 70 ? "보완2" : "재생성";
  // 통과 = 총점 기준 + 사실성 최소 + 금칙어 없음(점수 조작 아님 — 실제 신호 기반).
  const passed = totalScore >= QUALITY_PASS && factuality >= FACTUALITY_MIN && banned.length === 0;

  return {
    totalScore, passed, band, threshold: QUALITY_PASS,
    type: typeId, typeGroup: group,
    breakdown, factuality, weakPoints, revisions,
    banned, seoOk: seo.ok,
    maxBoosts: band === "보완1" ? 1 : band === "보완2" ? 2 : 0,
  };
}
