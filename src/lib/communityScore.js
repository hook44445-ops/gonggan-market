// ════════════════════════════════════════════════════════════════════
// 공간라운지 Community Score — 커뮤니티 점수 (Phase 4)
//
//   각 게시글에 "사람의 반응"으로 매기는 점수. AI Editor 의 콘텐츠 점수(글 내용 기반)와
//   짝을 이루는, 커뮤니티(사용자 신호) 기반 점수다.
//     · engagementScore — 조회 대비 반응률(좋아요·댓글·저장·공유)
//     · discussionScore — 댓글이 붙어 토론이 일어나는 정도
//     · trustScore      — 신고/숨김이 적어 신뢰되는 정도
//     · communityScore  — 위를 종합한 총점(0~100)
//     · evergreen       — 오래 지나도 계속 읽히는 글(저장·반응이 나이에 비해 높음)
//
//   결정론적 순수 함수 · 저장/Migration 없음 · 있는 데이터로만 계산(Regression Zero).
//   Phase 4-6 저장 데이터가 붙으면 saveSignal 이 자동 반영된다(코드 변경 없음).
// ════════════════════════════════════════════════════════════════════

import { extractSignals, reactionTotal, engagementRate, saveSignal, ageInDays } from "./userSignals.js";

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
// 로그 스케일 — 소수 대박글이 척도를 지배하지 않도록 완만하게 압축한다.
const logScale = (v, k) => clamp((Math.log10(1 + Math.max(0, v)) / Math.log10(1 + k)) * 100);

// 글 1건의 커뮤니티 점수 묶음.
export function communityScore(post = {}, now = Date.now()) {
  const sig = extractSignals(post, now);
  const save = saveSignal(sig);

  // 관여도 — 반응률(조회 대비) + 반응 총량. 반응률이 핵심(조회만 많고 반응 없는 글을 배제).
  const rate = engagementRate(sig);
  const engagementScore = clamp(rate * 260 + logScale(reactionTotal(sig), 120) * 0.35);

  // 토론 — 댓글 중심. 댓글이 붙는 글이 살아있는 글이다.
  const discussionScore = clamp(logScale(sig.comments, 40) * 0.8 + (sig.comments >= 3 ? 20 : 0));

  // 신뢰 — 신고/숨김이 적을수록 높다. 숨김은 강한 감점.
  const trustScore = clamp(100 - sig.reports * 12 - (sig.hidden ? 60 : 0));

  // evergreen — 나이가 든(7일+) 글인데도 반응/저장이 살아있으면 오래 읽히는 글.
  const days = ageInDays(post, now);
  const evergreen = days >= 7 && (save.proxySaves >= 5 || rate >= 0.25);

  const community = clamp(
    engagementScore * 0.42 +
    discussionScore * 0.28 +
    trustScore      * 0.18 +
    (evergreen ? 12 : logScale(save.proxySaves, 30) * 0.12)
  );

  return {
    id: sig.id,
    communityScore: community,
    engagementScore,
    discussionScore,
    trustScore,
    engagementRate: Math.round(rate * 1000) / 1000,
    evergreen,
    saves: save.proxySaves,
    hasRealSaveData: save.hasRealSaveData,
    signals: sig,
  };
}

// 여러 글을 커뮤니티 점수(또는 지정 축)로 정렬. key ∈ community|engagement|discussion|trust|saves
export function rankByCommunity(posts = [], key = "community", n = 10, now = Date.now()) {
  const field = {
    community: "communityScore", engagement: "engagementScore",
    discussion: "discussionScore", trust: "trustScore", saves: "saves",
  }[key] || "communityScore";
  return posts
    .map((p) => ({ ...p, _c: communityScore(p, now) }))
    .sort((a, b) => b._c[field] - a._c[field])
    .slice(0, n);
}

// ── Today's Living Space (4-3) ─────────────────────────────────────
// "오늘 살아 움직이는 글" — 최근성(오늘 반응/댓글이 붙는) + 커뮤니티 점수를 함께 본다.
//   graphDegree(Space Graph 연결 수)를 넘겨주면 네트워크 허브를 살짝 우대한다(선택).
//   반환: [{ ...post, _c, _liveScore }]  (내림차순)
export function todaysLivingSpace(posts = [], { n = 10, now = Date.now(), degreeOf = null } = {}) {
  return posts
    .map((p) => {
      const c = communityScore(p, now);
      const days = ageInDays(p, now);
      // 최근 가중 — 오늘~3일 이내 글/반응에 프리미엄, 오래될수록 감쇠(단 evergreen 은 방어).
      const recency = c.evergreen ? 0.75 : Math.max(0.25, 1 - days / 14);
      const degree = degreeOf ? (degreeOf(p) || 0) : 0;
      const live = c.communityScore * recency + c.discussionScore * 0.3 + degree * 4;
      return { ...p, _c: c, _liveScore: Math.round(live) };
    })
    .sort((a, b) => b._liveScore - a._liveScore)
    .slice(0, n);
}

// evergreen 콘텐츠 목록(4-6) — PC 아카이브/Editor's Pick/Deep Article 후보.
export function evergreenPosts(posts = [], now = Date.now()) {
  return posts.map((p) => ({ ...p, _c: communityScore(p, now) })).filter((p) => p._c.evergreen);
}
