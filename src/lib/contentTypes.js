// ════════════════════════════════════════════════════════════════════
// 공간라운지 Content Types — 콘텐츠 성격 분류 + 일일 편성 (Phase 24 Morning Brief)
//
//   핵심 철학: "뉴스는 뉴스로, 공간마켓 글은 공간마켓 글로, 연재는 연재로."
//   모든 글을 억지로 공간 관점으로 연결하지 않는다. 타입별로 공간관점 적용 여부를 명시한다.
//
//   하루 최대 11개(상한선, 목표 아님). 품질 통과분만 발행.
//   고정 아침 3개(큐티/인도점성술/모닝브리핑) + 긴급뉴스 3 + 공간마켓 1 + 연재 1 + 타임트렌드 3.
//
//   ⚠️ Regression Zero: 순수 함수 · DB/API/Cron/Migration 없음. 편성/분류 데이터만 조립한다.
// ════════════════════════════════════════════════════════════════════

// 콘텐츠 타입 정의. spacePerspective=true 인 타입에만 공간 관점을 기본 적용한다.
export const CONTENT_TYPES = {
  qt:            { id: "qt",            label: "오늘 큐티 말씀",     icon: "📖", slot: "05:00", spacePerspective: false, seoFirst: true,  news: false },
  astrology:     { id: "astrology",     label: "오늘의 인도점성술",  icon: "🔮", slot: "06:00", spacePerspective: false, seoFirst: true,  news: false },
  morning_brief: { id: "morning_brief", label: "Morning Brief",       icon: "📰", slot: "07:00", spacePerspective: false, seoFirst: true,  news: true  },
  breaking:      { id: "breaking",      label: "실시간 긴급뉴스",    icon: "🚨", slot: "수시",  spacePerspective: false, seoFirst: false, news: true  },
  space_market:  { id: "space_market",  label: "공간마켓 콘텐츠",    icon: "🏠", slot: "낮",    spacePerspective: true,  seoFirst: false, news: false },
  series:        { id: "series",        label: "연재 스토리",        icon: "📚", slot: "저녁",  spacePerspective: false, seoFirst: false, news: false },
  trend_past:    { id: "trend_past",    label: "Time Trend · Past",  icon: "⏮️", slot: "낮",    spacePerspective: false, seoFirst: false, news: false },
  trend_present: { id: "trend_present", label: "Time Trend · Present",icon: "⏺️", slot: "낮",    spacePerspective: false, seoFirst: false, news: false },
  trend_future:  { id: "trend_future",  label: "Time Trend · Future", icon: "⏭️", slot: "낮",    spacePerspective: false, seoFirst: false, news: false },
};

export const TYPE_ORDER = ["qt", "astrology", "morning_brief", "breaking", "space_market", "series", "trend_past", "trend_present", "trend_future"];

// 하루 편성 상한(타입별 최대 개수). 총합은 상한선(11), 목표 아님.
export const DAILY_QUOTA = {
  qt: 1, astrology: 1, morning_brief: 1,
  breaking: 3, space_market: 1, series: 1,
  trend_past: 1, trend_present: 1, trend_future: 1,
};

const NEWS_WORDS = /속보|긴급|발표|금리|정책|전쟁|재난|사고|증시|주가|환율|규제|선거|판결|엔비디아|삼성|openai|claude|반도체|실적|국제|정부|한은|연준|fed/i;
const QT_WORDS = /큐티|말씀|묵상|성경|기도|은혜|믿음|신앙|하나님|예수/i;
const ASTRO_WORDS = /점성|운세|별자리|띠|사주|타로|astrology/i;
const SPACE_WORDS = /인테리어|시공|견적|집수리|리모델|입주|이사|공간마켓|평면|셀프인테리어|집꾸미|업체|고객사례/i;
const STORY_WORDS = /연재|이야기|소설|에세이|씨의|하루|시즌|episode|스토리/i;

// 주제/힌트 텍스트 → 콘텐츠 타입 추정(명시 typeHint 우선).
export function classifyContentType(topic, { typeHint = null } = {}) {
  if (typeHint && CONTENT_TYPES[typeHint]) return typeHint;
  const t = String(topic ?? "");
  if (QT_WORDS.test(t)) return "qt";
  if (ASTRO_WORDS.test(t)) return "astrology";
  if (/사설|헤드라인|매-?세-?지|모닝\s?브리핑|morning\s?brief/i.test(t)) return "morning_brief";
  if (STORY_WORDS.test(t)) return "series";
  if (SPACE_WORDS.test(t)) return "space_market";
  if (NEWS_WORDS.test(t)) return "breaking";
  return "trend_present"; // 기본: 현재 트렌드형
}

// 이 타입에 공간 관점을 적용해야 하는가? (Space Perspective Rule)
export function shouldApplySpacePerspective(typeId) {
  return !!CONTENT_TYPES[typeId]?.spacePerspective;
}

export function contentTypeMeta(typeId) {
  return CONTENT_TYPES[typeId] || { id: typeId, label: typeId, icon: "•", spacePerspective: false, seoFirst: false, news: false };
}

// 오늘의 편성표 — 타입별 목표 슬롯과 현재 발행 수(published 에서 집계). 상한 대비 잔여 표시.
//   published: [{ content_type|category, created_at }] · toggles: { [typeId]: bool } (OFF 면 편성 제외)
export function dailyComposition({ published = [], toggles = {}, now = Date.now() } = {}) {
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const todays = published.filter((p) => {
    const t = p.created_at ? new Date(p.created_at).getTime() : 0;
    return t >= startOfDay.getTime();
  });
  const countOf = (typeId) => todays.filter((p) => (p.content_type || p.contentType) === typeId).length;

  const rows = TYPE_ORDER
    .filter((typeId) => toggles[typeId] !== false) // 토글 OFF 제외(기본 ON)
    .map((typeId) => {
      const meta = CONTENT_TYPES[typeId];
      const quota = DAILY_QUOTA[typeId] || 1;
      const done = countOf(typeId);
      return { typeId, label: meta.label, icon: meta.icon, slot: meta.slot, quota, done, remaining: Math.max(0, quota - done),
        spacePerspective: meta.spacePerspective, seoFirst: meta.seoFirst, news: meta.news };
    });

  const cap = rows.reduce((n, r) => n + r.quota, 0);
  const publishedToday = rows.reduce((n, r) => n + r.done, 0);
  return { rows, cap: Math.min(11, cap), publishedToday, remaining: Math.max(0, Math.min(11, cap) - publishedToday) };
}
