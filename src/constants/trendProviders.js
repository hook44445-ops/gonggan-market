import { pickDailyTopics, dayIndexOf } from "./loungeTopicPool.js";
import { pickCategoryTopics } from "./loungeCategoryTopics.js";

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

// 유일한 "활성" 소스 — 실제 검색 API 연결(Phase 3) 전까지 파이프라인을 끝까지 돌린다.
/* ⚠️ 2026-09-23: 예전에는 여기 여섯 개(폭우·폭염·부동산 대책·한파·전세사기·장마)가 박혀 있어
   매 호출마다 같은 목록이 돌아왔다 — 자동 글쓰기가 «맨날 같은 글»을 쓰던 첫 번째 원인이다.
   이제 주제는 loungeTopicPool 이 날짜로 돌려 준다(같은 날은 같은 결과 · 중복검사와 잘 맞는다). */
async function collectManual() {
  const now = new Date();
  /* 09-26 대표 「라운지 카테고리 주제에 맞게」 — 공간 주제와 라운지 카테고리 주제를 번갈아 낸다.
     카테고리 쪽은 부동산·건강·연애·맛집·주식… 을 날마다 세 칸씩 차례로 돈다(loungeCategoryTopics). */
  //   대표 「인테리어 수요자와 공급자를 위한 글은 특히 자주」 — 공간 4 : 카테고리 2(공간 글이 앞에).
  const space = pickDailyTopics(4, now);
  const cats = pickCategoryTopics(2, dayIndexOf(now));
  const mixed = [space[0], cats[0], space[1], space[2], cats[1], space[3]].filter(Boolean);
  return mixed.map((t) => ({
    providerId: "manual",
    topic:      t.topic,
    angle:      t.angle,
    category:   t.category,
    audience:   t.audience,
    brand:      t.brand ?? null,
    region:     t.region ?? null,
    variant:    t.variant ?? 0,   // 같은 주제가 다시 나올 때 형식·제목을 바꾸는 순번
    rotation:   t.rotation ?? 0,
    sourceUrl:  null,
    collectedAt: now.toISOString(),
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
