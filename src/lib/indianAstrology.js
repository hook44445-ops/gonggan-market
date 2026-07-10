// ════════════════════════════════════════════════════════════════════
// 공간라운지 오늘의 인도점성술 — 월별(1~12월생) 운세 (Phase 24)
//
//   개인 생년월일/차트 없음. 월별(1월생~12월생)로만. 쉽고 짧게, 전문 용어 최소화.
//   공유하기 좋은 형식. 하루 1회 자동 생성. 인도점성술은 쉽고 재미있게(공간 관점 미적용).
//
//   ⚠️ Regression Zero: 순수 함수 · DB/API/Cron 없음. 생성 프롬프트/구조/공유 메타만 조립.
// ════════════════════════════════════════════════════════════════════

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const fmt = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일(${WD[d.getDay()]})`;

export const BIRTH_MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}월생`);

export function astrologyTitle(now = Date.now()) {
  return `🔮 ${fmt(new Date(now))} 오늘의 인도점성술`;
}

export function astrologyPrompt(now = Date.now()) {
  const d = new Date(now);
  return [
    `"${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 오늘의 인도점성술"을 작성한다.`,
    `개인 생년월일/차트를 사용하지 않고, 태어난 "월"별로만 운세를 제공한다. 공간 관점을 넣지 않는다.`,
    `형식:`,
    `- 1월생, 2월생, 3월생 … 12월생 순서로 각 2~3문장.`,
    `- 각 항목: 오늘의 흐름 + 관계/일/재물 중 하나의 팁 + 행운 포인트(색/숫자/키워드 중 1개).`,
    `원칙: 쉽고 짧게 · 전문 용어 최소화 · 밝고 재미있게 · 공유하기 좋게. 겁주는 표현/단정 금지.`,
  ].join("\n");
}

export function astrologyMeta(now = Date.now()) {
  return {
    contentType: "astrology",
    title: astrologyTitle(now),
    months: BIRTH_MONTHS,
    shareCopy: "🔮 오늘의 인도점성술 — 나는 몇 월생? 오늘 운세 확인해보세요.",
    seoFirst: true,
  };
}
