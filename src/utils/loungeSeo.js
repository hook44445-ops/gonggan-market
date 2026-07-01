// ─────────────────────────────────────────────────────
// 공간마켓 라운지 SEO 공용 유틸
//
// 이 파일은 클라이언트(React)와 서버리스 함수(/api/*) 양쪽에서 import 한다.
// 따라서 의존성 0, import.meta / react / DOM 사용 금지 (순수 ESM).
// ─────────────────────────────────────────────────────

// 기본 OG 이미지 (절대경로는 호출부에서 site origin 과 합성)
export const DEFAULT_OG_PATH = '/mock-reviews/after-cafe.svg';

// SEO 카테고리 슬러그 ↔ 내부 카테고리 id 매핑
//  요청서 슬러그(좌) → 앱 내부 LOUNGE_CATEGORIES id(우)
export const SEO_CATEGORY = {
  interior: { id: 'interior',    title: '인테리어 고민과 시공 이야기',     desc: '인테리어 시공·자재·공간 활용 고민을 나누는 공간마켓 라운지입니다.' },
  estimate: { id: 'quote_worry', title: '인테리어 견적 고민 모음',         desc: '리모델링·인테리어 견적과 비용 고민을 모은 공간마켓 라운지입니다.' },
  review:   { id: 'review',      title: '실제 시공후기와 공간 이야기',     desc: '실제 시공 전후 후기와 공간 변화 이야기를 모은 공간마켓 라운지입니다.' },
  company:  { id: 'recommend',   title: '믿을 수 있는 인테리어 업체 이야기', desc: '인테리어 업체 추천과 경험담을 나누는 공간마켓 라운지입니다.' },
  moving:   { id: 'move_in',     title: '이사·입주 준비와 공간 정보',       desc: '이사·입주 준비와 새 공간 꾸미기 정보를 나누는 공간마켓 라운지입니다.' },
  humor:    { id: 'humor',       title: '인테리어 유머',                   desc: '인테리어 현장에서 있었던 재미있는 이야기와 공감되는 에피소드를 만나보세요.' },
  startup:  { id: 'startup',     title: '인테리어 창업 이야기',             desc: '인테리어 업체 운영, 창업, 마케팅 경험을 공유합니다.' },
};

// 내부 id → SEO 슬러그 (역매핑)
export const CATEGORY_ID_TO_SEO = Object.fromEntries(
  Object.entries(SEO_CATEGORY).map(([slug, v]) => [v.id, slug])
);

export function seoSlugToCategoryId(slug) {
  return SEO_CATEGORY[slug]?.id ?? null;
}
export function categoryIdToSeoSlug(id) {
  return CATEGORY_ID_TO_SEO[id] ?? null;
}

// 한글 그대로 허용하는 슬러그 생성 (공백→하이픈, URL 파괴 문자 제거)
export function slugify(text) {
  return String(text ?? '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[\/\\?#%&"'<>:|]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'post';
}

export function buildPostSlug(post) {
  const base = (post?.title && String(post.title).trim())
    || String(post?.content ?? '').trim().slice(0, 30);
  return slugify(base);
}

// SEO URL 경로 (id 가 항상 포함되므로 슬러그 중복과 무관하게 고유)
export function buildPostPath(post) {
  if (!post?.id) return '/lounge';
  return `/lounge/posts/${post.id}/${buildPostSlug(post)}`;
}

export function buildCategoryPath(seoSlug) {
  return `/lounge/category/${seoSlug}`;
}

export function regionToSlug(region) {
  return slugify(region);
}
export function slugToRegion(slug) {
  return String(slug ?? '').replace(/-/g, ' ').trim();
}
export function buildRegionPath(region) {
  return `/lounge/region/${regionToSlug(region)}`;
}

// 개인정보/외부거래 유도 패턴 감지 → noindex 처리 + 관리자 검토 대상
export function detectPII(text) {
  const t = String(text ?? '');
  if (!t) return false;
  const phone    = /(01[016789])[-.\s]?\d{3,4}[-.\s]?\d{4}/;                 // 휴대폰
  const account  = /\d{2,6}[-\s]\d{2,6}[-\s]\d{2,7}/;                        // 계좌번호 형태
  const kakao    = /(카톡|카카오톡|오픈채팅|오픈톡|kakao|채팅으로\s*연락|아이디\s*[:：])/i; // 카톡 ID 유도
  const external = /(직거래|현금가|계좌로|입금\s*하|송금|외부로\s*연락|직접\s*연락|전화\s*주세요|문자\s*주세요)/; // 외부거래 유도
  const address  = /\S+(시|도)\s?\S+(구|군)\s?\S*(동|로|길)\s?\d+/;          // 상세주소
  return phone.test(t) || account.test(t) || kakao.test(t) || external.test(t) || address.test(t);
}

// 게시글 공개(검색 노출) 가능 여부 — is_deleted/false, is_hidden/false, is_visible≠false
export function isPostPublic(post) {
  if (!post) return false;
  if (post.is_deleted === true) return false;
  if (post.is_hidden === true) return false;
  if (post.is_visible === false) return false;
  return true;
}

// 글 상세 메타(title/description/og image path) 생성
export function buildPostMeta(post) {
  const titleBase = (post?.title && String(post.title).trim())
    || String(post?.content ?? '').trim().slice(0, 40)
    || '라운지 글';
  const title = `${titleBase} | 공간마켓 라운지`;
  const description = String(post?.content ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 110) || '공간마켓 라운지에서 공간 이야기를 나눠보세요.';
  const imagePath = (Array.isArray(post?.image_urls) && post.image_urls[0]) || DEFAULT_OG_PATH;
  return { title, description, imagePath };
}

// 지역 랜딩 메타
export function buildRegionMeta(region) {
  const r = String(region ?? '').trim();
  return {
    title: `${r} 인테리어 이야기 | 공간마켓 라운지`,
    description: `${r}의 인테리어·리모델링·이사 고민과 공간 이야기를 모은 공간마켓 라운지입니다.`,
  };
}
