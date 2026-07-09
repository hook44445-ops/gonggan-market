// ════════════════════════════════════════════════════════════════════
// 공간라운지 Reading Experience — 읽기 경험 (Phase 5 · Space Media)
//
//   "YouTube 가 영상을 기록했다면, Space Lounge 는 글과 사진으로 세상을 기록한다."
//   Phase 5 는 기능이 아니라 사용자 경험(UX)이다. 긴 글도 편하게 읽을 수 있도록
//   예상 읽는 시간 · 목차 · 태그 · 다음 글의 "구조"를 준비한다.
//
//   결정론적 순수 함수(외부 API·저장·Migration 없음). UI 와 분리 — 모바일 글 상세와
//   향후 PC Magazine 이 같은 함수를 호출한다(PC Version First).
// ════════════════════════════════════════════════════════════════════

// 본문에서 마크다운 마커를 제거한 순수 텍스트 길이(문자 수).
function plainLength(content = "") {
  return String(content)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-•]\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim().length;
}

// 예상 읽는 시간(분). 한국어 성인 평균 묵독 ~550자/분 + 이미지당 약 12초.
//   최소 1분. 반환: { minutes, chars, images, label }
export function readingTime(content = "", imageCount = 0) {
  const chars = plainLength(content);
  const minutes = Math.max(1, Math.round(chars / 550 + (imageCount * 12) / 60));
  return { minutes, chars, images: imageCount, label: `약 ${minutes}분` };
}

const slugify = (text) =>
  String(text ?? "").toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");

// 목차(TOC) — 본문의 "## / ###" 소제목을 추출한다. 소제목이 2개 미만이면 목차를 만들지 않는다.
//   반환: [{ level(2|3), text, id, index }]
export function tableOfContents(content = "") {
  const lines = String(content).replace(/\r\n/g, "\n").split("\n");
  const toc = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    const m3 = line.match(/^###\s+(.+)/);
    const m2 = line.match(/^##\s+(.+)/);
    if (m3) toc.push({ level: 3, text: m3[1].trim(), id: `h-${slugify(m3[1])}-${i}`, index: i });
    else if (m2) toc.push({ level: 2, text: m2[1].trim(), id: `h-${slugify(m2[1])}-${i}`, index: i });
  });
  return toc.length >= 2 ? toc : [];
}

// 태그 — 글의 tags 배열을 정규화(중복 제거·공백 제거). 없으면 카테고리/공간 키워드로 최소 1개 확보는
//   호출부(authorSystem/spaceGraph)에서 처리. 여기서는 순수하게 tags 만 다룬다.
export function normalizeTags(post = {}) {
  const raw = Array.isArray(post.tags) ? post.tags : [];
  const seen = new Set();
  const out = [];
  for (const t of raw) {
    const s = String(t ?? "").trim().replace(/^#/, "");
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out;
}

// 다음 글 — 같은 카테고리에서 현재 글보다 "이전(오래된)" 글 중 가장 최근 것을 다음 읽을거리로.
//   목록이 시간순이 아닐 수 있으므로 created_at 으로 판단하며, 없으면 첫 후보를 쓴다.
export function nextArticle(post, candidates = []) {
  if (!post) return null;
  const curTime = post.created_at ? new Date(post.created_at).getTime() : 0;
  const sameCat = candidates.filter((c) => c && c.id !== post.id && c.category === post.category);
  const pool = sameCat.length ? sameCat : candidates.filter((c) => c && c.id !== post.id);
  const older = pool
    .filter((c) => (c.created_at ? new Date(c.created_at).getTime() : 0) < curTime)
    .sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0));
  return older[0] ?? pool[0] ?? null;
}

// 읽기 경험 한 번에 조립 — 글 상세/매거진이 이 하나만 부르면 된다.
//   반환: { readingTime, toc, tags, hasToc }
export function readingExperience(post = {}) {
  const imgs = Array.isArray(post.image_urls) ? post.image_urls.length : 0;
  const toc = tableOfContents(post.content ?? "");
  return {
    readingTime: readingTime(post.content ?? "", imgs),
    toc,
    hasToc: toc.length > 0,
    tags: normalizeTags(post),
  };
}
