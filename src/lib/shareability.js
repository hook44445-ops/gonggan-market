// ════════════════════════════════════════════════════════════════════
// 공간라운지 Shareability Engine — 공유하고 싶게 만드는 점수 (Phase 24)
//
//   공유 "버튼"이 아니라 공유하고 "싶게" 만드는 게 목표. 모든 콘텐츠는
//   Read Score / Save Score / Shareability Score 를 가진다.
//   평가: 저장가치·공유가치·공감·실용성·희소성·제목클릭률예상·SNS 적합성.
//   공유 카드 메타(shareTitle/shareSubtitle/shareSummary/shareImageText) 생성.
//
//   ⚠️ Regression Zero: 순수 함수(결정론적) · DB/API/Cron 없음. 기존 점수 엔진과 독립(추가).
// ════════════════════════════════════════════════════════════════════

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
const has = (re, s) => (re.test(s) ? 1 : 0);

// 타입별 기본 공유 성향(뉴스/큐티/운세/트렌드는 공유·저장 성향이 태생적으로 높다).
const TYPE_BASE = {
  morning_brief: { share: 82, save: 88 },
  qt:            { share: 78, save: 90 },
  astrology:     { share: 88, save: 66 },
  breaking:      { share: 80, save: 60 },
  trend_present: { share: 74, save: 70 },
  trend_past:    { share: 70, save: 78 },
  trend_future:  { share: 76, save: 80 },
  space_market:  { share: 60, save: 74 },
  series:        { share: 66, save: 82 },
};

// content: { title, body|content, contentType, tags }
export function scoreShareability(content = {}) {
  const type = content.contentType || "trend_present";
  const base = TYPE_BASE[type] || { share: 65, save: 68 };
  const title = String(content.title ?? "");
  const body = String(content.body ?? content.content ?? "");
  const len = body.length;

  // 제목 클릭률 예상 — 숫자/리스트/질문/구체 표현이 있으면 가산.
  const ctr = clamp(52
    + has(/\d/, title) * 10
    + has(/[?？]/, title) * 6
    + has(/n가지|가지|정리|총정리|핵심|한눈|5분|비교|방법|이유/, title) * 10
    + (title.length >= 12 && title.length <= 42 ? 8 : -6));

  // 실용성/희소성 — 본문 길이·구조(소제목)·리스트.
  const headings = (body.match(/^##?\s/gm) ?? []).length;
  const bullets = (body.match(/^[-*·]\s/gm) ?? []).length;
  const utility = clamp(45 + Math.min(20, headings * 5) + Math.min(15, bullets * 2) + (len >= 700 ? 12 : len >= 400 ? 4 : -8));

  // 공감/저장 가치 — 타입 기본 + 실용성 반영.
  const saveScore = clamp(base.save * 0.7 + utility * 0.3);
  const readScore = clamp(50 + Math.min(30, len / 40) + headings * 3);
  const shareScore = clamp(base.share * 0.55 + ctr * 0.3 + utility * 0.15);

  return {
    readScore, saveScore, shareScore,
    factors: { ctr, utility, headings, bullets, length: len, typeBase: base },
  };
}

// 타입별 공유 카피(예시 톤). content 로 제목 반영.
export function shareCopy(content = {}) {
  const type = content.contentType || "trend_present";
  const map = {
    morning_brief: "📌 오늘 아침 5분이면 끝.\n11개 신문사설, 주요신문 헤드라인, 매-세-지까지 한 번에 보기.",
    qt:            "📖 오늘 하루, 이 말씀 한 구절로 시작해보세요.",
    astrology:     "🔮 오늘의 인도점성술 — 나는 몇 월생? 오늘 운세가 딱 맞네.",
    breaking:      "🚨 지금 이 뉴스, 핵심만 빠르게.",
    trend_past:    "10년 전에는 이렇게 생각했지만, 지금 다시 보면 다릅니다.",
    trend_present: "지금 사람들이 이걸 왜 찾을까? 배경을 정리했습니다.",
    trend_future:  "10년 전에는 이렇게 생각했지만,\n10년 뒤는 이렇게 바뀝니다.",
    space_market:  "🏠 공간을 바꾸기 전에, 이건 꼭 확인하세요.",
    series:        "📚 다음 화가 기다려지는 이야기.",
  };
  return map[type] || "이 글, 저장해두면 두고두고 쓸모 있어요.";
}

// 공유 카드 메타.
export function shareCard(content = {}) {
  const title = String(content.title ?? "").trim();
  const body = String(content.body ?? content.content ?? "").replace(/\s+/g, " ").trim();
  const summary = body.slice(0, 90) + (body.length > 90 ? "…" : "");
  const copy = shareCopy(content);
  return {
    shareTitle: title || "공간라운지 오늘의 글",
    shareSubtitle: copy.split("\n")[0],
    shareSummary: summary,
    shareImageText: (title || copy).slice(0, 40),
  };
}
