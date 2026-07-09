// ════════════════════════════════════════════════════════════════════
// 공간라운지 Community Temperature — 공간 온도 (Phase 4)
//
//   공간라운지 전체가 얼마나 "살아있는가"를 하나의 온도로 요약한다. 개별 글의 커뮤니티
//   점수가 미시 지표라면, 이건 라운지 전체의 거시 활성도다.
//     · lounge_temperature — 전체 활성도(36.5 기준 체온형 온도)
//     · active_categories  — 오늘 활발한 카테고리
//     · rising_topics      — 반응이 오르는 카테고리(후속 생성 추천의 입력)
//     · quiet_categories   — 조용한 카테고리(콘텐츠 보강 필요)
//
//   결정론적 순수 함수 · 저장/Migration 없음. 있는 데이터로만 계산(Regression Zero).
//   공간 온도(SPACE_TEMPERATURE_BASE 36.5)는 기존 라운지 정체성과 맞춘 표현이다.
// ════════════════════════════════════════════════════════════════════

import { extractSignals, reactionTotal, ageInDays } from "./userSignals.js";
import { communityScore } from "./communityScore.js";
import { SPACE_TEMPERATURE_BASE } from "../constants/lounge.js";
import { CATEGORY_LABEL } from "../constants/lounge.js";

const RECENT_DAYS = 3; // "오늘" 활성 판단 창(최근 3일)

// 카테고리별 반응/최근 활동 집계.
//   반환: [{ category, label, posts, recentPosts, reactions, comments, avgCommunity, momentum }]
export function categoryActivity(posts = [], now = Date.now()) {
  const map = new Map();
  for (const p of posts) {
    const sig = extractSignals(p, now);
    const cat = sig.category || "free";
    if (!map.has(cat)) map.set(cat, { category: cat, label: CATEGORY_LABEL[cat] || cat, posts: 0, recentPosts: 0, reactions: 0, comments: 0, _cSum: 0 });
    const row = map.get(cat);
    const days = ageInDays(p, now);
    row.posts += 1;
    row.reactions += reactionTotal(sig);
    row.comments += sig.comments;
    row._cSum += communityScore(p, now).communityScore;
    if (days <= RECENT_DAYS) row.recentPosts += 1;
  }
  return Array.from(map.values()).map((r) => ({
    category: r.category,
    label: r.label,
    posts: r.posts,
    recentPosts: r.recentPosts,
    reactions: r.reactions,
    comments: r.comments,
    avgCommunity: r.posts ? Math.round(r._cSum / r.posts) : 0,
    // momentum — 최근 글 비중 + 반응 밀도(글당 반응). 상승/조용 판단에 쓴다.
    momentum: Math.round((r.posts ? (r.recentPosts / r.posts) * 50 : 0) + (r.posts ? Math.min((r.reactions / r.posts), 30) : 0)),
  }));
}

// 라운지 전체 온도. 최근 활동(글/댓글/반응)과 신뢰(신고·숨김 비율)를 반영한다.
//   반환: { temperature, activeCategories, risingTopics, quietCategories, todayPosts, totalComments, totalReactions, hiddenRatio, popularCount }
export function communityTemperature(posts = [], now = Date.now()) {
  const list = posts.filter((p) => p && p.id != null);
  const total = list.length;
  const acts = categoryActivity(list, now).sort((a, b) => b.momentum - a.momentum);

  let todayPosts = 0, totalComments = 0, totalReactions = 0, hidden = 0, popularCount = 0;
  for (const p of list) {
    const sig = extractSignals(p, now);
    if (ageInDays(p, now) <= 1) todayPosts += 1;
    totalComments += sig.comments;
    totalReactions += reactionTotal(sig);
    if (sig.hidden) hidden += 1;
    if (communityScore(p, now).communityScore >= 70) popularCount += 1;
  }
  const hiddenRatio = total ? hidden / total : 0;

  // 온도 — 체온(36.5)을 기준으로 활동량에 따라 오르내린다. 활동이 활발할수록 따뜻하다.
  //   과열 방지 위해 로그 스케일, 신고/숨김 비율은 냉각 요인.
  const activityHeat = Math.log10(1 + totalReactions + totalComments * 2 + todayPosts * 3);
  let temperature = SPACE_TEMPERATURE_BASE + activityHeat * 1.4 - hiddenRatio * 8;
  temperature = Math.round(Math.max(30, Math.min(42, temperature)) * 10) / 10;

  const activeCategories = acts.filter((c) => c.recentPosts > 0 || c.reactions > 0).slice(0, 8);
  const risingTopics = acts.filter((c) => c.momentum >= 30 && c.posts >= 1).slice(0, 6);
  const quietCategories = acts.filter((c) => c.recentPosts === 0 && c.momentum < 15).sort((a, b) => a.momentum - b.momentum).slice(0, 6);

  return {
    temperature,
    activeCategories,
    risingTopics,
    quietCategories,
    todayPosts,
    totalComments,
    totalReactions,
    hiddenRatio: Math.round(hiddenRatio * 100) / 100,
    popularCount,
    totalPosts: total,
  };
}
