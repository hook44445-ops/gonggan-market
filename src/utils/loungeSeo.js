// ─────────────────────────────────────────────────────
// 공간마켓 라운지 SEO 공용 유틸
//
// 이 파일은 클라이언트(React)와 서버리스 함수(/api/*) 양쪽에서 import 한다.
// 따라서 의존성 0, import.meta / react / DOM 사용 금지 (순수 ESM).
// ─────────────────────────────────────────────────────

// 기본 OG 이미지 (절대경로는 호출부에서 site origin 과 합성)
// 공유 미리보기 기본 그림 — 카카오톡·페이스북은 SVG 미리보기를 못 띄운다(09-26). 사이트 대표 PNG 와 같은 것.
export const DEFAULT_OG_PATH = '/og-space-v2.png';

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
  'staff-talk': { id: 'staff-talk', title: '인테리어 사장님 수다', desc: '인테리어 업체 사장님들의 진솔한 이야기, 현장 에피소드, 고객 이야기, 업체 운영 고민을 나눠보세요.' },
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
// ── 본문 구조 읽기(SEO·AEO) ───────────────────────────────────────────────
// AI 글 생성기(aiDraftWriter)는 이미 AI 답변 엔진이 인용하기 좋은 모양으로 쓴다:
//   첫 줄 「**한 줄 답**: …」 · 「## 소제목」 · 끝에 「## 자주 묻는 질문」 + 「### 질문\n답」 세 쌍.
// 그런데 검색엔진용 화면(prerender)은 본문 앞 110자를 잘라 설명문으로 쓰고(별표째 「**한 줄 답**」),
// 본문은 「## …」「| … |」 날것 그대로 내보냈다 — 재료를 다 버리고 있었다(09-26).
const stripInline = (t) => String(t ?? '')
  .replace(/\*\*(.+?)\*\*/g, '$1')
  .replace(/^#{1,6}\s+/, '')
  .replace(/\s+/g, ' ')
  .trim();

const clip = (t, n) => {
  const x = String(t ?? '').trim();
  if (x.length <= n) return x;
  const cut = x.slice(0, n);
  const at = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' '));
  return `${(at > n * 0.6 ? cut.slice(0, at) : cut).trim()}…`;
};

/** 본문 → { answer(한 줄 답), headings[{level,text}], faq[{q,a}], lead(첫 일반 문단) } */
export function seoOutline(content = '') {
  const lines = String(content ?? '').replace(/\r\n/g, '\n').split('\n');
  let answer = null;
  let lead = null;
  const headings = [];
  const faq = [];
  let inFaq = false;
  let curQ = null;
  let curA = [];
  const pushQA = () => {
    if (curQ && curA.length) faq.push({ q: curQ, a: curA.join(' ').trim() });
    curQ = null;
    curA = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!answer) {
      const m = line.match(/^\*{0,2}\s*한\s*줄\s*답\s*\*{0,2}\s*[:：]\s*(.+)$/);
      if (m) { answer = stripInline(m[1]); continue; }
    }
    const h = line.match(/^(#{2,3})\s+(.+)$/);
    if (h) {
      const level = h[1].length;
      const text = stripInline(h[2]);
      pushQA();
      if (level === 2) {
        inFaq = /자주\s*묻는\s*질문|FAQ/i.test(text);
        headings.push({ level, text });
      } else if (inFaq) {
        curQ = text;
      } else {
        headings.push({ level, text });
      }
      continue;
    }
    if (inFaq) {
      // 답은 빈 줄에서 끊는다 — 뒤에 붙는 안내 문장(「비슷한 고민과 시공 후기는…」)이 섞이지 않게.
      if (!line) { if (curQ && curA.length) pushQA(); continue; }
      if (curQ && !line.startsWith('|')) curA.push(stripInline(line));
      continue;
    }
    if (!lead && line && !line.startsWith('|') && !/^[-•]\s|^\d+\.\s/.test(line) && line.length >= 12) {
      lead = stripInline(line);
    }
  }
  pushQA();
  return { answer, headings, faq, lead };
}

export function buildPostMeta(post) {
  const titleBase = (post?.title && String(post.title).trim())
    || String(post?.content ?? '').trim().slice(0, 40)
    || '라운지 글';
  const title = `${titleBase} | 공간마켓 라운지`;
  // 설명문 — 「한 줄 답」이 있으면 그것(검색 결과·AI 답변에 그대로 인용되는 문장), 없으면 첫 일반 문단.
  const o = seoOutline(post?.content);
  const plain = stripInline(String(post?.content ?? '').replace(/^\|.*$/gm, ' ').replace(/^#{1,6}\s+/gm, ''));
  const description = clip(o.answer || o.lead || plain, 150) || '공간마켓 라운지에서 공간 이야기를 나눠보세요.';
  // 대표 그림 — SVG 는 건너뛴다(이미 발행된 AI 글 일부가 SVG 를 첫 그림으로 가졌다).
  const firstRaster = (Array.isArray(post?.image_urls) ? post.image_urls : []).find((u) => u && !/\.svg(\?|#|$)/i.test(u));
  const imagePath = firstRaster || DEFAULT_OG_PATH;
  return { title, description, imagePath };
}

/** 검색엔진용 본문 HTML — 소제목 h2/h3, 목록 ul/ol, 표 table, **굵게** strong. esc 는 호출하는 쪽의 HTML 이스케이프. */
export function renderSeoBodyHtml(content = '', esc = (x) => String(x)) {
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const lines = String(content ?? '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let list = null;
  let listTag = null;
  let table = null;
  const flushList = () => {
    if (!list) return;
    out.push(`<${listTag}>${list.map((x) => `<li>${inline(x)}</li>`).join('')}</${listTag}>`);
    list = null;
    listTag = null;
  };
  const cells = (r) => r.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const flushTable = () => {
    if (!table) return;
    const rows = table.filter((r) => !/^\|?\s*:?-{2,}/.test(r));
    if (rows.length) {
      const [head, ...body] = rows;
      out.push(`<table><thead><tr>${cells(head).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body
        .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    }
    table = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('|')) { flushList(); (table ??= []).push(line); continue; }
    flushTable();
    const h = line.match(/^(#{2,3})\s+(.+)$/);
    if (h) { flushList(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
    const ul = line.match(/^[-•]\s+(.+)$/);
    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ul || ol) {
      const tag = ul ? 'ul' : 'ol';
      if (listTag && listTag !== tag) flushList();
      listTag = tag;
      (list ??= []).push((ul || ol)[1]);
      continue;
    }
    flushList();
    if (line) out.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  flushTable();
  return out.join('\n');
}

/** 구조화 데이터 묶음 — Article(+분류·지역·언어·키워드) · 빵부스러기 · FAQ(문답 2쌍 이상일 때). */
export function buildPostStructuredData({ post, site, canonical, meta, ogImageUrl }) {
  const o = seoOutline(post?.content);
  const seoSlug = CATEGORY_ID_TO_SEO[post?.category];
  const catTitle = seoSlug ? SEO_CATEGORY[seoSlug]?.title : null;
  const publishedTime = post?.created_at ? new Date(post.created_at).toISOString() : undefined;
  const modifiedTime = post?.updated_at ? new Date(post.updated_at).toISOString() : publishedTime;
  const headline = meta.title.replace(/\s*\|\s*공간마켓 라운지$/, '');
  const keywords = [catTitle, post?.region, ...o.headings.filter((h) => h.level === 2).map((h) => h.text)]
    .filter((k) => k && !/자주\s*묻는\s*질문|^정리$/.test(k));
  const list = [{
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description: meta.description,
    image: [ogImageUrl],
    datePublished: publishedTime,
    dateModified: modifiedTime,
    inLanguage: 'ko-KR',
    articleSection: catTitle || undefined,
    keywords: keywords.length ? keywords.join(', ') : undefined,
    ...(post?.region ? { contentLocation: { '@type': 'Place', name: post.region } } : {}),
    author: { '@type': 'Organization', name: '공간마켓' },
    publisher: { '@type': 'Organization', name: '공간마켓', logo: { '@type': 'ImageObject', url: `${site}/favicon-v2.png` } },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  }, {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '공간마켓 라운지', item: `${site}/lounge` },
      ...(seoSlug ? [{ '@type': 'ListItem', position: 2, name: catTitle, item: `${site}${buildCategoryPath(seoSlug)}` }] : []),
      { '@type': 'ListItem', position: seoSlug ? 3 : 2, name: headline, item: canonical },
    ],
  }];
  if (o.faq.length >= 2) {
    list.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: o.faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    });
  }
  return list;
}

// 지역 랜딩 메타
export function buildRegionMeta(region) {
  const r = String(region ?? '').trim();
  return {
    title: `${r} 인테리어 이야기 | 공간마켓 라운지`,
    description: `${r}의 인테리어·리모델링·이사 고민과 공간 이야기를 모은 공간마켓 라운지입니다.`,
  };
}
