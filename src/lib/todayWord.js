// ════════════════════════════════════════════════════════════════════
// 공간라운지 오늘 큐티 말씀 — 하루를 여는 말씀/묵상 (Phase 24)
//
//   하루를 말씀으로 시작. 공유/저장 가치 · 검색 노출. 말씀은 말씀답게(공간 관점 미적용).
//   구조: 오늘의 말씀(구절) → 짧은 묵상 → 오늘의 기도 → 적용 한 줄.
//
//   ⚠️ Regression Zero: 순수 함수 · DB/API/Cron 없음. 생성 프롬프트/구조/공유 메타만 조립.
// ════════════════════════════════════════════════════════════════════

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const fmt = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일(${WD[d.getDay()]})`;

export function todayWordTitle(now = Date.now()) {
  return `📖 오늘 큐티 말씀 · ${fmt(new Date(now))}`;
}

export function todayWordPrompt(now = Date.now()) {
  return [
    `"오늘 큐티 말씀" 콘텐츠를 작성한다. 하루를 여는 짧은 말씀과 묵상이다. 공간 관점을 넣지 않는다.`,
    `구조:`,
    `1) 오늘의 말씀 — 성경 구절 1개(출처 표기).`,
    `2) 짧은 묵상 — 3~5문장, 따뜻하고 담백하게.`,
    `3) 오늘의 기도 — 2~3문장.`,
    `4) 오늘의 적용 — 실천 한 줄.`,
    `톤: 차분하고 은혜로운 묵상형. 과장/설교조 지양. 저장·공유하고 싶은 담백함.`,
  ].join("\n");
}

export function todayWordMeta(now = Date.now()) {
  return {
    contentType: "qt",
    title: todayWordTitle(now),
    shareCopy: "📖 오늘 하루, 이 말씀 한 구절로 시작해보세요.",
    seoFirst: true,
  };
}
