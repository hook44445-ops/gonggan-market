// ════════════════════════════════════════════════════════════════════
// Duplicate Check (Phase 2) — title/slug/topic 기준, 48시간 이내 동일 이슈
//   재생성 금지. 슬러그화(소문자+영숫자/한글만 남기고 하이픈)로 표기 차이를
//   흡수해 비교한다.
// ════════════════════════════════════════════════════════════════════

export function slugify(text) {
  return String(text ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

// existingItems: [{ ai_topic, title, created_at }] — 최근 draft/scheduled/published 공통 조회 결과.
export function isDuplicateTopic(candidateTopic, existingItems = [], windowHours = 48) {
  const candSlug = slugify(candidateTopic);
  if (!candSlug) return false;
  const cutoff = Date.now() - windowHours * 36e5;
  return existingItems.some((item) => {
    const itemTime = item.created_at ? new Date(item.created_at).getTime() : 0;
    if (itemTime < cutoff) return false;
    const itemTopic = item.ai_topic ?? item.title ?? "";
    const itemTitle = item.title ?? "";
    return slugify(itemTopic) === candSlug || slugify(itemTitle) === candSlug;
  });
}

// 후보 목록에서 (1) 같은 배치 내 중복 (2) 기존 저장분과 48h 이내 중복을 모두 제거.
export function filterNewTopics(candidateTopics = [], existingItems = [], windowHours = 48) {
  const seen = new Set();
  const result = [];
  for (const c of candidateTopics) {
    const slug = slugify(c.topic);
    if (!slug || seen.has(slug)) continue;
    if (isDuplicateTopic(c.topic, existingItems, windowHours)) continue;
    seen.add(slug);
    result.push(c);
  }
  return result;
}
