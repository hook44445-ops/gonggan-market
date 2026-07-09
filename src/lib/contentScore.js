// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI 편집국 — 콘텐츠 점수 시스템 (Phase 2·AI Editor)
//
//   생성된 글을 AI 가 스스로 평가한다. 7개 축을 0~100 으로 채점해 가중 총점을 낸다.
//     공간 관련성 · 정보 가치 · 검색 가치 · 공감 · 독창성 · 저장 가치 · 공유 가치
//   총점 90점 미만이면 재작성 대상(needsRewrite=true) 으로 표시한다.
//
//   핵심 게이트: "이 글은 공간라운지에서만 볼 수 있는 글인가?" — 공간 관련성이 낮으면
//   총점을 강하게 끌어내려 재작성을 유도한다(브랜드 정체성 보호).
//
//   Phase 2 는 결정론적 휴리스틱이다(글 구조/키워드/길이 기반). Phase 3 에서 LLM 자기평가로
//   scoreContent() 내부만 교체하면 되고, 반환 형태(축별 점수 + total + needsRewrite)는 유지한다.
// ════════════════════════════════════════════════════════════════════

const SPACE_WORDS = ["공간", "집", "방", "주거", "인테리어", "리모델링", "거실", "구조", "생활", "동네"];
const CTA_WORDS   = ["공간마켓", "라운지", "견적", "상담", "비교"];

const WEIGHTS = {
  spaceRelevance: 0.28, // 공간 관련성 — 가장 중요(브랜드 게이트)
  infoValue:      0.16, // 정보 가치
  searchValue:    0.14, // 검색 가치
  empathy:        0.12, // 공감
  originality:    0.12, // 독창성
  saveValue:      0.10, // 저장 가치
  shareValue:     0.08, // 공유 가치
};

export const REWRITE_THRESHOLD = 90;

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const countHits = (text, words) => words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);

// title/content/category 로부터 7개 축을 채점.
export function scoreContent({ title = "", content = "", category = "" } = {}) {
  const T = String(title);
  const B = String(content);
  const full = `${T}\n${B}`;
  const len = B.length;
  const headings = (B.match(/^##\s/gm) ?? []).length;
  const checks   = (B.match(/- \[ \]/g) ?? []).length;

  const spaceHits = countHits(full, SPACE_WORDS);
  const ctaHits   = countHits(full, CTA_WORDS);

  // 공간 관련성 — 공간 어휘 밀도. 브랜드 게이트라 없으면 크게 감점.
  const spaceRelevance = clamp(spaceHits === 0 ? 20 : 55 + spaceHits * 9);
  // 정보 가치 — 소제목/체크리스트/본문 길이(구조가 있으면 정보성 높음).
  const infoValue = clamp(40 + headings * 12 + checks * 5 + Math.min(len / 20, 20));
  // 검색 가치 — 제목에 이슈 키워드 + 카테고리 존재(검색 유입 가능성).
  const searchValue = clamp((T.length >= 8 ? 60 : 40) + (category ? 20 : 0) + Math.min(spaceHits * 4, 20));
  // 공감 — 독자를 향한 어휘("우리", "당신", "요즘", "고민")로 근사.
  const empathy = clamp(45 + countHits(full, ["우리", "당신", "요즘", "고민", "함께"]) * 12);
  // 독창성 — 공간 관점 재해석 문구가 있는지("공간 관점", "다시 보")로 근사.
  const originality = clamp(50 + countHits(full, ["공간 관점", "다시 보", "재해석", "관계"]) * 15 + (headings >= 3 ? 10 : 0));
  // 저장 가치 — 체크리스트/실행 가능한 목록이 있으면 저장하고 싶어진다.
  const saveValue = clamp(45 + checks * 10 + (B.includes("체크리스트") ? 15 : 0));
  // 공유 가치 — CTA/공감 요소가 있으면 공유로 이어진다.
  const shareValue = clamp(40 + ctaHits * 12 + (empathy >= 70 ? 15 : 0));

  const axes = { spaceRelevance, infoValue, searchValue, empathy, originality, saveValue, shareValue };
  const total = clamp(
    spaceRelevance * WEIGHTS.spaceRelevance +
    infoValue      * WEIGHTS.infoValue +
    searchValue    * WEIGHTS.searchValue +
    empathy        * WEIGHTS.empathy +
    originality    * WEIGHTS.originality +
    saveValue      * WEIGHTS.saveValue +
    shareValue     * WEIGHTS.shareValue
  );

  return { axes, total, needsRewrite: total < REWRITE_THRESHOLD };
}

export const AXIS_LABELS = {
  spaceRelevance: "공간 관련성",
  infoValue:      "정보 가치",
  searchValue:    "검색 가치",
  empathy:        "공감",
  originality:    "독창성",
  saveValue:      "저장 가치",
  shareValue:     "공유 가치",
};

// "공간라운지에서만 볼 수 있는 글인가?" — 브랜드 유니크 게이트(공간 관련성 축이 기준 미달이면 NO).
export function isLoungeUnique(scoreResult) {
  return (scoreResult?.axes?.spaceRelevance ?? 0) >= 60;
}
