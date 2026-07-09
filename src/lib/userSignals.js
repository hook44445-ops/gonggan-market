// ════════════════════════════════════════════════════════════════════
// 공간라운지 User Signal Engine — 사용자 활동 신호 (Phase 4)
//
//   Phase 1~3 이 "AI 가 글을 만들고 연결하는" 단계였다면, Phase 4 는 "사람이 반응하고,
//   그 반응이 다시 AI 의 다음 기획으로 돌아가는" 살아있는 커뮤니티를 만드는 단계다.
//
//   이 파일은 글 1건에서 사용자 활동 신호를 정규화해 추출한다. AI Editor·Space Graph 가
//   글의 "내용"만 보던 것을 넘어, "사용자 반응"까지 콘텐츠 가치 계산에 반영할 수 있게 한다.
//
//   구현 원칙(Phase 1~3 과 동일):
//     · 결정론적 순수 함수(외부 API·저장·Migration 없음). 있는 컬럼만 읽고 없으면 0/false 로 폴백.
//     · UI 와 분리 — 향후 PC 버전(Magazine/Archive/Knowledge/Community Insight)에서 그대로 호출.
//     · 저장(bookmark) 테이블이 아직 없으므로 save_count 는 있으면 쓰고 없으면 0 으로 둔다(4-6 구조 준비).
// ════════════════════════════════════════════════════════════════════

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// 글의 나이(일). created_at 없으면 0.
export function ageInDays(post, now = Date.now()) {
  const t = post?.created_at ? new Date(post.created_at).getTime() : 0;
  if (!t) return 0;
  return Math.max(0, (now - t) / 864e5);
}

// 글 1건 → 정규화된 사용자 신호. 존재하지 않는 컬럼은 안전하게 0/false.
//   반환: { id, category, views, likes, comments, saves, shares, reports, hidden, ageDays, isSeed }
export function extractSignals(post = {}, now = Date.now()) {
  return {
    id:       post.id,
    category: post.category || null,
    views:    num(post.view_count),
    likes:    num(post.like_count),
    comments: num(post.comment_count),
    // 아래 3개는 저장/공유/신고 카운트 컬럼이 있으면 사용, 없으면 0(향후 확장 대비 구조만).
    saves:    num(post.save_count ?? post.bookmark_count),
    shares:   num(post.share_count),
    reports:  num(post.report_count),
    hidden:   Boolean(post.is_hidden === true),
    ageDays:  Math.round(ageInDays(post, now) * 10) / 10,
    isSeed:   Boolean(post.is_seed),
  };
}

// 반응 합계 — 좋아요/댓글/저장/공유에 가중을 둔 "관여 총량"(조회는 제외, 반응률 계산에 쓰임).
export function reactionTotal(sig) {
  return sig.likes * 1 + sig.comments * 2 + sig.saves * 3 + sig.shares * 2;
}

// 조회 대비 반응률(0~1) — 조회는 있으나 반응이 없는 글을 가려낸다. 조회가 적으면 과대평가되므로
//   최소 조회수(minViews)로 완충한다.
export function engagementRate(sig, minViews = 20) {
  const denom = Math.max(sig.views, minViews);
  return denom > 0 ? reactionTotal(sig) / denom : 0;
}

// 저장 신호 분류(4-6) — 저장이 많은 글은 evergreen(오래 읽히는) 후보. 저장 데이터가 없으면
//   좋아요+댓글을 완화된 프록시로 사용한다(구조만 준비, UI 없음).
export function saveSignal(sig) {
  const proxy = sig.saves > 0 ? sig.saves : Math.round(sig.likes * 0.4 + sig.comments * 0.6);
  return { saves: sig.saves, proxySaves: proxy, hasRealSaveData: sig.saves > 0 };
}
