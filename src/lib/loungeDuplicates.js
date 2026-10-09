// ─────────────────────────────────────────────────────
// 라운지 «같은 글 반복» 막기 (10-08)
//
// 10-06 점검: sitemap 415개 중 라운지 글 387개, 고유 제목은 133개뿐이었다.
//   「폭우와 공간의 관계」 같은 글이 48시간마다 다시 만들어져(중복 검사 창이 48시간)
//   같은 제목·같은 본문 253장이 각자 자기 주소를 canonical 로 내걸었다 → 구글 색인 8/415.
//
// 여기는 순수 함수만 둔다 — sitemap·prerender(api)·자동 발행(서버·관리자 화면) 이 같이 쓴다.
//   제목 정규화 규칙은 docs/sql/lounge-duplicates-check-2026-10-08.sql 의 SQL 과 같아야 한다.
// ─────────────────────────────────────────────────────

// 같은 제목을 다시 발행하지 않는 기간(일)
export const TITLE_REPEAT_DAYS = 30;

// 공백·문장부호·꼬리 번호 «(2)» «[3]» 를 빼고 소문자로 — 표기만 다른 같은 제목을 하나로 본다.
export function normalizeLoungeTitle(title) {
  return String(title ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s*[([]\d+[)\]]\s*$/u, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

// 본문 비교용 — 공백 차이만 무시한다.
export function normalizeLoungeBody(content) {
  return String(content ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

const timeOf = (p) => {
  const t = p?.created_at ? new Date(p.created_at).getTime() : NaN;
  return Number.isFinite(t) ? t : Infinity;
};
// 먼저 만든 글이 앞(같으면 id 순) — SQL 의 order by created_at, id 와 같은 기준
const olderFirst = (a, b) => timeOf(a) - timeOf(b) || String(a?.id ?? '').localeCompare(String(b?.id ?? ''));

// 제목마다 한 편만 — 대표는 «가장 먼저 만든 글», 순서는 입력에서 그 제목이 처음 나온 자리.
//   최신순 목록을 넣으면 «최근 제목 순서 · 링크는 원본 글»이 된다. 제목 없는 글은 그대로 둔다.
export function uniqueByTitle(posts = []) {
  const groups = new Map();
  const order = [];
  for (const p of posts) {
    if (!p) continue;
    const key = normalizeLoungeTitle(p.title);
    if (!key) { order.push({ single: p }); continue; }
    const cur = groups.get(key);
    if (!cur) { groups.set(key, p); order.push({ key }); }
    else if (olderFirst(p, cur) < 0) groups.set(key, p);
  }
  return order.map((o) => (o.single ? o.single : groups.get(o.key)));
}

// 자동 발행 직전 검사 — days 일 안에 같은 제목 글이 있으면 그 글을 돌려준다(없으면 null).
//   posts: [{ id, title, created_at }] · excludeId: 지금 발행하려는 글 자신
export function findSameTitleWithin(title, posts = [], { days = TITLE_REPEAT_DAYS, now = Date.now(), excludeId = null } = {}) {
  const key = normalizeLoungeTitle(title);
  if (!key) return null;
  const cutoff = now - days * 864e5;
  for (const p of posts) {
    if (!p || (excludeId != null && String(p.id) === String(excludeId))) continue;
    const t = timeOf(p);
    if (t === Infinity || t < cutoff) continue;
    if (normalizeLoungeTitle(p.title) === key) return p;
  }
  return null;
}

// 봇 프리렌더 — 이 글을 어디로 보낼지.
//   original: 같은 제목의 «공개» 글 중 가장 먼저 만든 글(없으면 null)
//   · 숨긴 글(is_hidden) 인데 원본이 있다 → 'redirect'(301) — 이미 퍼진 주소를 원본으로 모은다
//   · 공개 글인데 더 먼저 만든 원본과 본문까지 같다 → 'canonical' — 마이그레이션 전에도 «같은 글 253장»을 한 장으로
//   · 그 밖(제목만 같고 내용이 다른 글 등) → null — 따로 둔다
export function duplicateTarget(post, original) {
  if (!post || !original || String(original.id) === String(post.id)) return null;
  const key = normalizeLoungeTitle(post.title);
  if (!key || key !== normalizeLoungeTitle(original.title)) return null;
  if (post.is_deleted) return null;
  if (post.is_hidden) return { action: 'redirect', target: original };
  if (olderFirst(original, post) < 0 && normalizeLoungeBody(original.content) === normalizeLoungeBody(post.content)) {
    return { action: 'canonical', target: original };
  }
  return null;
}
