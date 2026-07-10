// ════════════════════════════════════════════════════════════════════
// 공간라운지 Morning Brief — 아침 뉴스 정리 콘텐츠 (Phase 24)
//
//   창작/칼럼/에세이가 아니다. 검색 노출용 "정리" 콘텐츠다. 뉴스는 뉴스다.
//   1순위: 11개 신문사설 주요내용 · 2순위: 주요신문 헤드라인(경제/금융/기업/부동산/사회/국제)
//   3순위: 매경이 전하는 세상의 지식(매-세-지) 스타일 5개 요약.
//
//   원칙: AI 의견 금지 · 공간 관점 금지 · 감성적 해석 금지 · 과도한 재가공 금지 ·
//         신문사명/날짜/카테고리/제목 명확 유지 · 원문 제목 핵심 표현 유지 · SEO 우선.
//
//   ⚠️ 실제 뉴스 데이터 수집(스크래핑/뉴스API)은 새 서버리스 함수가 필요해 이번 범위 밖.
//   여기서는 생성 프롬프트/제목/구조/공유 메타만 조립한다(LLM 이 정리 형식으로 작성).
//   ⚠️ Regression Zero: 순수 함수 · DB/API/Cron 없음.
// ════════════════════════════════════════════════════════════════════

const WD = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
const fmtDate = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WD[d.getDay()]}`;
const mmdd = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}월${String(d.getDate()).padStart(2, "0")}일`;

export const BRIEF_SECTIONS = [
  { id: "editorials", label: "11개 신문사설 주요내용", priority: 1 },
  { id: "headlines",  label: "주요신문 헤드라인",      priority: 2, cats: ["경제", "금융", "기업", "부동산", "사회", "국제"] },
  { id: "maseji",     label: "매경이 전하는 세상의 지식(매-세-지)", priority: 3 },
];

// 오늘의 Morning Brief 제목 3종(사설/헤드라인/매-세-지).
export function morningBriefTitles(now = Date.now()) {
  const d = new Date(now);
  return {
    editorials: `《${fmtDate(d)} 11개 신문사설 주요내용》`,
    headlines: `★★${mmdd(d)} 주요신문 헤드라인★★`,
    maseji: `매경이 전하는 세상의 지식 (매-세-지, ${d.getMonth() + 1}월 ${d.getDate()}일)`,
  };
}

// LLM 에 넣을 생성 프롬프트(정리형·SEO·의견 금지). generateForWorkbench 의 issue 로 사용.
export function morningBriefPrompt(now = Date.now()) {
  const t = morningBriefTitles(now);
  return [
    `아래 형식의 "아침 뉴스 정리" 콘텐츠를 작성한다. 창작/칼럼/에세이/공간 관점/AI 의견을 절대 넣지 않는다.`,
    `검색 노출(SEO)을 위한 정리 콘텐츠이며, 신문사명·날짜·카테고리·제목을 명확히 유지한다.`,
    ``,
    `# ${t.editorials}`,
    `- 오늘자 주요 11개 종합일간지/경제지 사설의 핵심 논지를 신문사명과 함께 1~2줄로 정리한다(총 11개).`,
    ``,
    `# ${t.headlines}`,
    `- 카테고리별(경제/금융/기업/부동산/사회/국제)로 주요 헤드라인을 신문사명과 함께 나열한다.`,
    ``,
    `# ${t.maseji}`,
    `- 오늘 알아두면 좋은 세상의 지식/이슈 5가지를 짧고 명확하게 요약한다(매-세-지 스타일).`,
    ``,
    `제약: 사실·시점·수치 중심. 감성적 해석/재창작/과도한 재가공 금지. 원문 제목의 핵심 표현 유지.`,
  ].join("\n");
}

// 화면 표시용 메타(제목/섹션/공유 카피). 공유는 shareability 와 함께 사용.
export function morningBriefMeta(now = Date.now()) {
  const t = morningBriefTitles(now);
  return {
    contentType: "morning_brief",
    title: t.editorials,
    titles: t,
    sections: BRIEF_SECTIONS,
    shareCopy: "📌 오늘 아침 5분이면 끝.\n11개 신문사설, 주요신문 헤드라인, 매-세-지까지 한 번에.",
    seoFirst: true,
  };
}
