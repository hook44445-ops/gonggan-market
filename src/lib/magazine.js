// ════════════════════════════════════════════════════════════════════
// 공간라운지 Magazine — 매거진 홈 구성 (Phase 5 · Space Media)
//
//   공간라운지를 "게시판"이 아니라 "매거진"으로 구성한다. 이 파일은 화면을 그리지 않고,
//   기존 글 목록에서 매거진 섹션들을 조립하는 순수 함수다(UI 분리 · PC Version First).
//   Phase 3/4 엔진(Space Graph · Community)을 재사용한다 — 새 판단 로직을 만들지 않는다.
//
//   섹션: 오늘의 Space · Editor's Pick · Deep Article · 인기 글 · 새로운 글 ·
//         Trending(상승) · 이번 주 Best · Space Insight(요약 지표)
//
//   결정론적 · 저장/Migration 없음 · 기존 lounge_posts 데이터로만 계산(Regression Zero).
// ════════════════════════════════════════════════════════════════════

import { todaysSpace, editorsPick } from "./spaceGraph.js";
import { todaysLivingSpace, rankByCommunity, evergreenPosts } from "./communityScore.js";
import { communityTemperature } from "./communityTemperature.js";
import { readingTime } from "./readingExperience.js";
import { authorBadge } from "./authorSystem.js";

const withinDays = (post, days, now) => {
  const t = post?.created_at ? new Date(post.created_at).getTime() : 0;
  return t > 0 && now - t <= days * 864e5;
};

// 카드 표시에 필요한 최소 메타를 글에 얹는다(제목/카테고리/이미지/읽는시간/작성자 배지).
export function toMagazineCard(post = {}) {
  const imgs = Array.isArray(post.image_urls) ? post.image_urls : [];
  return {
    id: post.id,
    title: post.title || "",
    category: post.category || null,
    cover: imgs[0] || null,
    imageCount: imgs.length,
    readingLabel: readingTime(post.content ?? "", imgs.length).label,
    author: authorBadge(post),
    views: post.view_count ?? 0,
    likes: post.like_count ?? 0,
    comments: post.comment_count ?? 0,
    createdAt: post.created_at ?? null,
  };
}

// 매거진 홈 전체 구성. posts: 발행된 라운지 글 목록.
//   반환: { hero, editorsPick, sections:[{ id, title, cards:[] }], insight }
export function composeMagazine(posts = [], { now = Date.now() } = {}) {
  const list = (posts || []).filter((p) => p && p.id != null && p.title);

  const living = todaysLivingSpace(list, { n: 8, now });
  const spaceTop = todaysSpace(list, 10);
  const pick = editorsPick(list);
  const deep = evergreenPosts(list, now).slice(0, 6);
  const popular = rankByCommunity(list, "engagement", 8, now);
  const fresh = list.slice().sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0)).slice(0, 8);
  const weekBest = rankByCommunity(list.filter((p) => withinDays(p, 7, now)), "community", 8, now);
  const temp = communityTemperature(list, now);

  const hero = living[0] ? toMagazineCard(living[0]) : (spaceTop[0] ? toMagazineCard(spaceTop[0]) : null);

  const sections = [
    { id: "today",    title: "오늘의 Space",   cards: living.map(toMagazineCard) },
    { id: "deep",     title: "Deep Article",   cards: deep.map(toMagazineCard) },
    { id: "popular",  title: "인기 글",         cards: popular.map(toMagazineCard) },
    { id: "week",     title: "이번 주 Best",    cards: weekBest.map(toMagazineCard) },
    { id: "fresh",    title: "새로운 글",       cards: fresh.map(toMagazineCard) },
  ].filter((s) => s.cards.length > 0);

  return {
    hero,
    editorsPick: pick ? toMagazineCard(pick) : null,
    sections,
    trending: temp.risingTopics,      // Trending(상승 카테고리)
    insight: {                        // Space Insight — 매거진 헤더용 요약 지표
      temperature: temp.temperature,
      totalPosts: temp.totalPosts,
      todayPosts: temp.todayPosts,
      popularCount: temp.popularCount,
    },
  };
}
