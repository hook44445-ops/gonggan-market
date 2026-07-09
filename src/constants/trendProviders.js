// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI 콘텐츠 공장 — Trend Provider 인터페이스 (Phase 2)
//   실제 외부 API 연결은 Phase 3. 여기서는 "구조"만 정의한다 — 각 Provider 는
//   동일한 형태(collect() → TrendItem[])를 반환하는 함수만 있으면 되고,
//   enabled=false 인 Provider 는 trendCollector 가 호출조차 하지 않는다
//   (Phase 3 에서 enabled:true 로 바꾸고 collect() 내부만 실제 API 호출로 교체).
//
//   TrendItem = { providerId, topic, sourceUrl, collectedAt, raw }
// ════════════════════════════════════════════════════════════════════

export const TREND_PROVIDER_KIND = {
  SEARCH_TREND: "search_trend",
  NEWS:         "news",
  WEATHER:      "weather",
  GOVERNMENT:   "government",
  MANUAL:       "manual",
};

// Phase 2 데모/테스트용 시드 — 실 API 연결 전까지 파이프라인이 끝까지 동작하도록
// 보장하는 유일한 "활성" 소스. 이슈 자체는 예시이며 매 수집 호출마다 동일 목록을 반환한다
// (Phase 3: 실제 검색 트렌드로 교체).
const MANUAL_SEED_TOPICS = [
  { topic: "폭우",         region: null },
  { topic: "폭염",         region: null },
  { topic: "부동산 대책", region: null },
  { topic: "한파",         region: null },
  { topic: "전세사기",     region: null },
  { topic: "장마",         region: null },
];

async function collectManual() {
  const now = new Date().toISOString();
  return MANUAL_SEED_TOPICS.map((t) => ({
    providerId: "manual",
    topic:      t.topic,
    sourceUrl:  null,
    collectedAt: now,
    raw:        t,
  }));
}

// Phase 3 연결 지점 — 지금은 항상 빈 배열(구조만 정의, enabled=false 라 실제로 호출되지 않음).
async function collectStub() {
  return [];
}

export const TREND_PROVIDERS = [
  { id: "google_trends", label: "Google Trends", kind: TREND_PROVIDER_KIND.SEARCH_TREND, enabled: false, collect: collectStub },
  { id: "naver_news",    label: "네이버 뉴스",     kind: TREND_PROVIDER_KIND.NEWS,         enabled: false, collect: collectStub },
  { id: "daum_news",     label: "다음 뉴스",       kind: TREND_PROVIDER_KIND.NEWS,         enabled: false, collect: collectStub },
  { id: "weather",       label: "날씨",           kind: TREND_PROVIDER_KIND.WEATHER,      enabled: false, collect: collectStub },
  { id: "government",    label: "정부 발표",       kind: TREND_PROVIDER_KIND.GOVERNMENT,   enabled: false, collect: collectStub },
  { id: "manual",        label: "수동 이슈",       kind: TREND_PROVIDER_KIND.MANUAL,       enabled: true,  collect: collectManual },
];
