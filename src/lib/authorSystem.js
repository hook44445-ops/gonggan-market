// ════════════════════════════════════════════════════════════════════
// 공간라운지 Author System — 작성자 체계 (Phase 5 · Space Media)
//
//   Space Media 에서는 "누가 썼는가"가 신뢰의 일부다. 작성자를 명확히 표현한다:
//     · AI Editor  — AI 콘텐츠 공장/편집국이 만든 글(is_seed + ai_topic)
//     · Official   — 운영이 직접 발행한 글(is_seed, ai_topic 없음)
//     · Partner    — 업체(전문가) 글(is_expert)
//     · Community   — 일반 사용자 글(기본)
//
//   핵심 원칙(작업지시서 §16): "AI 는 뒤에서만." AI 는 콘텐츠를 돕고, 주인공은 사람이다.
//   따라서 AI Editor 배지는 과시하지 않고 담백하게 표시한다(설명 라벨만).
//
//   결정론적 순수 함수 · 저장/Migration 없음 · 기존 플래그(is_seed/ai_topic/is_expert)만 읽는다.
// ════════════════════════════════════════════════════════════════════

export const AUTHOR_TYPES = {
  ai_editor: { id: "ai_editor", label: "AI Editor", emoji: "✍️", tone: "#3a6b5a", desc: "AI 편집국이 공간 관점으로 정리한 글" },
  official:  { id: "official",  label: "Official",  emoji: "🏛️", tone: "#4a5a7a", desc: "공간라운지 운영이 발행한 글" },
  partner:   { id: "partner",   label: "Partner",   emoji: "🛠️", tone: "#8a5a2a", desc: "검증된 업체(전문가)가 쓴 글" },
  community: { id: "community", label: "Community", emoji: "🙌", tone: "#6a4a7a", desc: "라운지 이웃이 쓴 글" },
};

// 글 → 작성자 유형 id. 우선순위: partner(전문가) > ai_editor(AI 생성) > official(운영) > community.
export function authorTypeOf(post = {}) {
  if (post.is_expert === true) return "partner";
  if (post.is_seed === true) return post.ai_topic ? "ai_editor" : "official";
  return "community";
}

// 배지 메타(라벨/이모지/색/설명) 반환. UI 는 이 값만 그리면 된다.
export function authorBadge(post = {}) {
  return AUTHOR_TYPES[authorTypeOf(post)] || AUTHOR_TYPES.community;
}

// 표시용 작성자 이름 힌트 — 실제 신원 해석(익명 닉네임/업체명)은 기존 identityResolver 가 담당하므로
//   여기서는 "유형 라벨"만 제공한다(AI 는 앞에 나서지 않는다는 원칙에 맞춰 이름을 지어내지 않는다).
export function authorDisplayHint(post = {}) {
  const t = authorTypeOf(post);
  if (t === "ai_editor") return "AI Editor";
  if (t === "official") return "공간라운지";
  return null; // partner/community 는 기존 신원 해석을 그대로 사용
}
