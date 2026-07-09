// ════════════════════════════════════════════════════════════════════
// Topic Score (Phase 2) — 관련성/검색량/시의성/인테리어 관련도/지역성 5개 축을
//   0~100 점으로 계산해 가중합(total)과 우선순위(priority)를 산출한다.
//   Phase 2 는 결정론적 휴리스틱이다(외부 API 없이도 파이프라인이 끝까지 동작해야
//   하므로). Phase 3 에서 실제 검색량/트렌드 API가 붙으면 searchVolume/timeliness
//   계산 부분만 교체하면 된다 — scoreTopic() 의 입출력 형태는 그대로 유지.
// ════════════════════════════════════════════════════════════════════

const INTERIOR_KEYWORDS = [
  "집", "공간", "인테리어", "리모델링", "이사", "부동산", "수리",
  "집수리", "방수", "단열", "누수", "침수", "도배", "시공",
];

const WEIGHTS = {
  relevance:         0.25,
  searchVolume:      0.20,
  timeliness:        0.25,
  interiorRelevance: 0.20,
  locality:          0.10,
};

// 수집 시각으로부터 얼마나 최근인지 → 시의성 점수. 오래될수록 감점.
function timelinessFromAge(collectedAt) {
  if (!collectedAt) return 50;
  const ageHours = (Date.now() - new Date(collectedAt).getTime()) / 36e5;
  if (ageHours <= 3) return 100;
  if (ageHours <= 24) return 70;
  if (ageHours <= 48) return 40;
  return 20;
}

export function scoreTopic({ topic, region, collectedAt } = {}) {
  const t = String(topic ?? "").trim();
  const relevance = t.length > 0 ? 60 : 0; // Phase2: 이슈 텍스트 존재 여부 기준. Phase3: 실제 연관도 모델.
  const interiorRelevance = INTERIOR_KEYWORDS.some((k) => t.includes(k)) ? 90 : 40;
  const timeliness = timelinessFromAge(collectedAt);
  const searchVolume = 50; // Phase2 플레이스홀더(실 검색량 데이터 없음) — Phase3 트렌드 API 연결 지점.
  const locality = region ? 80 : 30;

  const total = Math.round(
    relevance * WEIGHTS.relevance +
    searchVolume * WEIGHTS.searchVolume +
    timeliness * WEIGHTS.timeliness +
    interiorRelevance * WEIGHTS.interiorRelevance +
    locality * WEIGHTS.locality
  );

  return { relevance, searchVolume, timeliness, interiorRelevance, locality, total };
}

export function priorityFromScore(total) {
  if (total >= 80) return "breaking";
  if (total >= 60) return "high";
  if (total >= 40) return "medium";
  return "low";
}

export const PRIORITY_LABEL = {
  breaking: "🔴 Breaking",
  high:     "🟠 High",
  medium:   "🟡 Medium",
  low:      "⚪ Low",
};
