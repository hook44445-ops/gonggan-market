// ════════════════════════════════════════════════════════════════════
// 공간라운지 Space Coverage — 공간 커버리지 (Phase 6)
//
//   "Space is Everything." 공간은 세상의 모든 이야기를 담는 최상위 개념이다. 이 파일은
//   철학이 말하는 다양한 삶의 영역(인테리어·연애·MBTI·경제·종교·AI·인도점성술 …)을
//   콘텐츠가 얼마나 커버하고 있는지 측정한다. 부족한 영역은 "추천만" 한다 —
//   자동 생성/자동 카테고리 생성은 하지 않는다(작업지시서 원칙).
//
//   영역(area)은 라운지 카테고리보다 넓은 "개념 공간"이다. 실제 카테고리가 있으면 그 id 로,
//   없으면(MBTI·종교·인도점성술 등) 제목/토픽 키워드 매칭으로 커버리지를 센다.
//
//   결정론적 순수 함수 · 저장/Migration 없음 · 기존 데이터로만 계산(Regression Zero).
// ════════════════════════════════════════════════════════════════════

// 커버리지 영역 정의 — 작업지시서의 예시 영역을 그대로 반영.
//   category: 대응하는 라운지 카테고리 id(있으면). keywords: 제목/토픽 매칭 보조어.
export const SPACE_COVERAGE_AREAS = [
  { id: "interior",  label: "인테리어",   category: "interior",   keywords: ["인테리어", "리모델링", "시공"] },
  { id: "room_deco", label: "집꾸미기",   category: "room_deco",  keywords: ["집꾸미기", "홈스타일링", "가구"] },
  { id: "review",    label: "시공후기",   category: "review",     keywords: ["후기", "비포", "애프터"] },
  { id: "quote",     label: "견적고민",   category: "quote_worry", keywords: ["견적", "비용", "예산"] },
  { id: "dating",    label: "연애",       category: "dating",     keywords: ["연애", "데이트", "소개팅"] },
  { id: "mbti",      label: "MBTI",       category: null,          keywords: ["mbti", "성격유형", "16personalities"] },
  { id: "cert",      label: "자격증",     category: null,          keywords: ["자격증", "시험", "합격", "취득"] },
  { id: "religion",  label: "종교",       category: null,          keywords: ["종교", "교회", "절", "사찰", "명상", "기도"] },
  { id: "economy",   label: "경제",       category: "realestate",  keywords: ["경제", "금리", "부동산", "물가"] },
  { id: "society",   label: "사회",       category: null,          keywords: ["사회", "이슈", "정책", "복지", "고령화"] },
  { id: "stock",     label: "주식",       category: "stock",       keywords: ["주식", "증시", "투자", "코스피"] },
  { id: "ai",        label: "AI",         category: null,          keywords: ["ai", "인공지능", "챗gpt", "로봇", "자동화"] },
  { id: "travel",    label: "여행",       category: "travel",      keywords: ["여행", "숙소", "호텔", "펜션"] },
  { id: "food",      label: "맛집",       category: "restaurant",  keywords: ["맛집", "식당", "카페"] },
  { id: "health",    label: "건강",       category: "health",      keywords: ["건강", "운동", "수면", "다이어트"] },
  { id: "startup",   label: "창업",       category: "startup",     keywords: ["창업", "상가", "매장", "자영업"] },
  { id: "pet",       label: "반려동물",   category: "pet",         keywords: ["반려동물", "강아지", "고양이", "펫"] },
  { id: "astrology", label: "인도점성술", category: null,          keywords: ["점성술", "사주", "타로", "별자리", "운세"] },
];

const norm = (s) => String(s ?? "").toLowerCase();

// 한 글이 특정 영역에 속하는지 — 카테고리 일치 우선, 없으면 제목/토픽 키워드 매칭.
function postMatchesArea(post, area) {
  if (area.category && post.category === area.category) return true;
  const hay = `${norm(post.title)} ${norm(post.ai_topic)}`;
  return area.keywords.some((k) => hay.includes(norm(k)));
}

// 공간 커버리지 — 각 영역의 콘텐츠 수 + 상태(비어있음/부족/충분).
//   반환: { areas:[{ id, label, count, status, hasCategory }], covered, gaps:[area], recommendations:[{area,reason}] }
export function spaceCoverage(published = [], { thinThreshold = 2 } = {}) {
  const list = (published || []).filter((p) => p && p.title);
  const areas = SPACE_COVERAGE_AREAS.map((area) => {
    const count = list.filter((p) => postMatchesArea(p, area)).length;
    let status = "covered";
    if (count === 0) status = "empty";
    else if (count <= thinThreshold) status = "thin";
    return { id: area.id, label: area.label, count, status, hasCategory: Boolean(area.category) };
  });

  const covered = areas.filter((a) => a.status === "covered").length;
  const gaps = areas.filter((a) => a.status !== "covered");

  // 추천(추천만) — 비어있는 영역 우선, 그다음 부족 영역. 카테고리가 없는 개념 영역은 "자유/해당 카테고리로 커버" 안내.
  const recommendations = gaps
    .sort((a, b) => a.count - b.count)
    .slice(0, 8)
    .map((a) => ({
      area: a.label,
      reason: a.status === "empty" ? "콘텐츠 없음 — 공간 관점으로 첫 글 추천" : "콘텐츠 부족 — 관련 글 보강 추천",
      hasCategory: a.hasCategory,
    }));

  return {
    areas,
    total: areas.length,
    covered,
    coverageRate: areas.length ? Math.round((covered / areas.length) * 100) : 0,
    gaps,
    recommendations,
  };
}
