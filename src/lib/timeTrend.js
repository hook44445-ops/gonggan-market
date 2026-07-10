// ════════════════════════════════════════════════════════════════════
// 공간라운지 Time Trend Engine — 과거·현재·미래 인사이트 (Phase 24)
//
//   단순 인기글이 아니라 "시간축 기반 인사이트". 하루 3개 후보(Past/Present/Future).
//     Past    — 과거 이슈/역사/경제사건/부동산/기술 변화에서 오늘 다시 읽을 가치.
//     Present — 현재 많이 읽히는 글/검색어/트렌드(TrendDiscovery 재사용).
//     Future  — 앞으로 바뀔 산업/기술/직업/도시/공간/경제 전망.
//   공간 관점은 억지 적용하지 않는다. 각 주제 본질에 맞게.
//
//   ⚠️ Regression Zero: 순수 함수 · TrendDiscovery 호출만 · DB/API/Cron 없음.
// ════════════════════════════════════════════════════════════════════

import { discoverTrendingTopics } from "./trendDiscovery.js";

const AXES = {
  past:    { id: "trend_past",    label: "Past",    icon: "⏮️", frame: "과거의 이 사건/흐름을 오늘 다시 읽으면 무엇을 배우는가" },
  present: { id: "trend_present", label: "Present", icon: "⏺️", frame: "지금 사람들이 왜 이 주제를 찾는가 — 배경과 맥락" },
  future:  { id: "trend_future",  label: "Future",  icon: "⏭️", frame: "이 흐름은 앞으로 산업/기술/직업/도시/공간/경제를 어떻게 바꾸는가" },
};

// 현재 트렌드 상위 주제(Present 후보 seed).
function presentTopic(published, seed) {
  const cands = discoverTrendingTopics({ recentPublished: published, limit: 8, seed });
  return cands[0]?.topic || "오늘의 관심 주제";
}

// axis 별 생성 프롬프트.
export function timeTrendPrompt(axis, topic) {
  const a = AXES[axis];
  return [
    `주제: ${topic}`,
    `관점(Time Trend · ${a.label}): ${a.frame}`,
    `단순 인기글이 아니라 시간축 기반 인사이트로 작성한다. 주제 본질에 맞게 쓰고, 공간 관점은 억지로 넣지 않는다.`,
    axis === "past" ? "과거를 이해하게 한다." : axis === "future" ? "미래를 준비하게 한다." : "현재를 정확히 읽게 한다.",
  ].join("\n");
}

// 오늘의 Time Trend 3후보(Past/Present/Future).
//   presentTopicText 를 주면 Present 를 그것으로 고정, 아니면 TrendDiscovery 상위 사용.
export function timeTrendCandidates({ published = [], seed = 0, pastTopic = null, futureTopic = null, presentTopicText = null } = {}) {
  const present = presentTopicText || presentTopic(published, seed);
  const items = [
    { axis: "past",    topic: pastTopic   || `${new Date().getFullYear() - 10}년, 그때 우리는` },
    { axis: "present", topic: present },
    { axis: "future",  topic: futureTopic || "10년 뒤, 무엇이 바뀔까" },
  ];
  return items.map(({ axis, topic }) => {
    const a = AXES[axis];
    return { axis, typeId: a.id, label: a.label, icon: a.icon, topic, prompt: timeTrendPrompt(axis, topic) };
  });
}
