// ─────────────────────────────────────────────────────
// 공간마켓 라운지 봇 프리렌더 (Vercel Serverless)
//
// vercel.json 의 user-agent 기반 rewrite 로 "크롤러만" 이 함수에 도달한다.
// 실제 사용자는 /index.html (SPA) 를 그대로 받는다.
// 여기서는 메타태그 + 읽을 수 있는 본문이 채워진 정적 HTML 을 반환한다.
// ─────────────────────────────────────────────────────

import {
  SEO_CATEGORY,
  buildPostMeta,
  buildRegionMeta,
  buildPostPath,
  buildCategoryPath,
  buildRegionPath,
  isPostPublic,
  detectPII,
  slugToRegion,
  DEFAULT_OG_PATH,
} from '../src/utils/loungeSeo.js';
import {
  BIZ,
  BIZ_ROWS,
  ESCROW_STAGES,
  PARTNER_LADDER,
  PARTNER_DEPOSIT_NOTE,
  PARTNER_STEPS,
  verificationMetas,
  canonicalSite,
  consumerFaq,
  partnerFaq,
  pageSeo,
  isBetaServer,
  organizationSchema,
  websiteSchema,
  serviceSchema,
  faqSchema,
  breadcrumbSchema,
} from '../src/utils/siteSeo.js';

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// 정식 호스트 고정 — www 와 apex 가 각자 자기를 canonical 이라 선언하면
// 구글이 「중복 페이지」로 보고 색인을 건너뛴다(2026-09-24 실제 발생).
// canonicalSite() 가 운영 도메인을 apex 하나로 모으고, preview/localhost 는 그대로 둔다.
function getSiteUrl(req) {
  if (process.env.SITE_URL) return String(process.env.SITE_URL).replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return canonicalSite(host, proto);
}

async function sb(path) {
  if (!SB_URL || !SB_KEY) return null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// OG 이미지 절대경로 통일 헬퍼(htmlShell 내부 계산과 JSON-LD 양쪽에서 재사용).
function resolveOgImage(site, ogImage) {
  return ogImage?.startsWith('http') ? ogImage : `${site}${ogImage || DEFAULT_OG_PATH}`;
}

// JSON-LD 안전 직렬화 — </script> 이스케이프로 마크업 탈출(XSS) 방지.
// 배열을 주면 스키마마다 script 태그를 따로 낸다(하나가 깨져도 나머지는 읽힌다).
function jsonLdScript(data) {
  if (!data) return '';
  const list = (Array.isArray(data) ? data : [data]).filter(Boolean);
  return list
    .map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`)
    .join('\n');
}

function getPathParts(req) {
  let p = req.query && req.query.path;
  if (Array.isArray(p)) p = p.join('/');
  if (!p) {
    try {
      const u = new URL(req.url, 'http://x');
      p = u.pathname.replace(/^\/lounge\/?/, '').replace(/^\/api\/prerender\/?/, '');
    } catch { p = ''; }
  }
  return String(p || '')
    .split('/')
    .filter(Boolean)
    .map((seg) => { try { return decodeURIComponent(seg); } catch { return seg; } });
}

// 공통 HTML 셸
function htmlShell({ site, canonical, robots, title, description, ogImage, ogType = 'article', bodyHtml, publishedTime, modifiedTime, structuredData }) {
  const img = resolveOgImage(site, ogImage);
  const articleTimeTags = ogType === 'article'
    ? [
        publishedTime ? `<meta property="article:published_time" content="${esc(publishedTime)}" />` : '',
        modifiedTime  ? `<meta property="article:modified_time" content="${esc(modifiedTime)}" />` : '',
      ].join('\n')
    : '';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<script>(function(){try{var u=navigator.userAgent||"";/* 카카오/라인/인스타/페북/네이버/다음 등 인앱 웹뷰(사람)만 앱(SPA) 라우트로 전환. 검색봇은 JS 미실행 → OG/미리보기·색인 유지 */if(/kakaotalk|kakaostory|naver\\(inapp|line\\/|instagram|fban|fbav|daumapps/i.test(u)){var q=location.search?location.search+"&app=1":"?app=1";location.replace(location.pathname+q);}}catch(e){}})();</script>
${verificationMetas().map(([n, v]) => `<meta name="${n}" content="${esc(v)}" />`).join('\n')}
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta name="robots" content="${esc(robots)}" />
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:type" content="${esc(ogType)}" />
<meta property="og:site_name" content="공간마켓" />
<meta property="og:locale" content="ko_KR" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(img)}" />
<meta property="og:url" content="${esc(canonical)}" />
${articleTimeTags}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(img)}" />
${jsonLdScript(structuredData)}
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function ctaHtml(site) {
  return `<section>
<h2>비슷한 공간 고민이 있으신가요?</h2>
<p>공간마켓에서 안전하게 비교견적을 받아보세요.</p>
<p><a href="${site}/">무료 견적 요청하기</a></p>
</section>`;
}

function notFound(req, res, site, msg) {
  const html = htmlShell({
    site,
    canonical: `${site}/lounge`,
    robots: 'noindex, nofollow',
    title: '공간마켓 라운지',
    description: msg || '요청하신 글을 찾을 수 없어요.',
    ogImage: DEFAULT_OG_PATH,
    ogType: 'website',
    bodyHtml: `<main><h1>공간마켓 라운지</h1><p>${esc(msg || '요청하신 글을 찾을 수 없어요.')}</p><p><a href="${site}/lounge">라운지로 가기</a></p>${ctaHtml(site)}</main>`,
  });
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

async function renderPost(req, res, site, id) {
  const rows = await sb(
    `lounge_posts?id=eq.${encodeURIComponent(id)}&select=id,title,content,image_urls,category,region,created_at,updated_at,is_deleted,is_hidden,is_visible,view_count,like_count,comment_count&limit=1`
  );
  const post = rows && rows[0];
  if (!post) return notFound(req, res, site, '삭제됐거나 존재하지 않는 글이에요.');

  const meta = buildPostMeta(post);
  const canonical = `${site}${buildPostPath(post)}`;

  // noindex 조건: 비공개 / 개인정보·외부거래 의심 / 직거래 신고 누적
  let indexable = isPostPublic(post);
  if (indexable && detectPII(`${post.title ?? ''} ${post.content ?? ''}`)) indexable = false;
  if (indexable) {
    const reports = await sb(`direct_deal_reports?post_id=eq.${encodeURIComponent(id)}&select=id&limit=1`);
    if (Array.isArray(reports) && reports.length > 0) indexable = false;
  }
  const robots = indexable ? 'index, follow' : 'noindex, nofollow';

  // 관련 글 (같은 카테고리 최신 공개글)
  let relatedHtml = '';
  if (post.category) {
    const related = await sb(
      `lounge_posts?category=eq.${encodeURIComponent(post.category)}&is_story=eq.false&is_deleted=not.eq.true&is_hidden=not.eq.true&is_visible=not.eq.false&id=neq.${encodeURIComponent(id)}&select=id,title,content&order=created_at.desc&limit=5`
    );
    if (Array.isArray(related) && related.length) {
      relatedHtml = `<section><h2>관련 글</h2><ul>${related
        .map((r) => `<li><a href="${site}${buildPostPath(r)}">${esc((r.title && r.title.trim()) || String(r.content ?? '').slice(0, 40))}</a></li>`)
        .join('')}</ul></section>`;
    }
  }

  // 이미지 alt — 앱(React) 상세 화면과 동일 규칙(다중 이미지 시 번호 표기)으로 정합성 유지.
  const imgCount = Array.isArray(post.image_urls) ? post.image_urls.length : 0;
  const imagesHtml = Array.isArray(post.image_urls)
    ? post.image_urls.map((u, i) => `<img src="${esc(u)}" alt="${esc(meta.title)}${imgCount > 1 ? ` (${i + 1})` : ''}" loading="lazy" />`).join('')
    : '';

  const dateStr = post.created_at ? new Date(post.created_at).toISOString().slice(0, 10) : '';
  const publishedTime = post.created_at ? new Date(post.created_at).toISOString() : null;
  const modifiedTime  = post.updated_at ? new Date(post.updated_at).toISOString() : publishedTime;

  const bodyHtml = `<main>
<article>
<h1>${esc((post.title && post.title.trim()) || String(post.content ?? '').slice(0, 40))}</h1>
<p><time datetime="${esc(post.created_at ?? '')}">${esc(dateStr)}</time>${post.category ? ` · ${esc(post.category)}` : ''}${post.region ? ` · ${esc(post.region)}` : ''}</p>
${imagesHtml}
<div>${esc(post.content ?? '').replace(/\n/g, '<br/>')}</div>
</article>
${relatedHtml}
${ctaHtml(site)}
<p><a href="${canonical}">공간마켓 앱에서 보기</a></p>
</main>`;

  // 구조화 데이터(JSON-LD Article) — Google 리치 결과용. 라운지는 익명 기반이라 author 는
  // 개인 식별 없이 사이트(Organization)로 표기(개인정보 노출 없음, 기존 데이터 필드만 사용).
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: meta.title.replace(/\s*\|\s*공간마켓 라운지$/, ''),
    description: meta.description,
    image: [resolveOgImage(site, meta.imagePath)],
    datePublished: publishedTime || undefined,
    dateModified: modifiedTime || undefined,
    author: { '@type': 'Organization', name: '공간마켓' },
    publisher: {
      '@type': 'Organization',
      name: '공간마켓',
      logo: { '@type': 'ImageObject', url: `${site}/favicon-v2.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
  };

  const html = htmlShell({
    site,
    canonical,
    robots,
    title: meta.title,
    description: meta.description,
    ogImage: meta.imagePath,
    ogType: 'article',
    bodyHtml,
    publishedTime,
    modifiedTime,
    structuredData,
  });
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

async function renderCategory(req, res, site, seoSlug) {
  const cfg = SEO_CATEGORY[seoSlug];
  if (!cfg) return notFound(req, res, site, '존재하지 않는 카테고리예요.');
  const canonical = `${site}${buildCategoryPath(seoSlug)}`;

  const posts = await sb(
    `lounge_posts?category=eq.${encodeURIComponent(cfg.id)}&is_story=eq.false&is_deleted=not.eq.true&is_hidden=not.eq.true&is_visible=not.eq.false&select=id,title,content&order=created_at.desc&limit=30`
  );
  const listHtml = Array.isArray(posts) && posts.length
    ? `<ul>${posts.map((p) => `<li><a href="${site}${buildPostPath(p)}">${esc((p.title && p.title.trim()) || String(p.content ?? '').slice(0, 40))}</a></li>`).join('')}</ul>`
    : '<p>아직 등록된 글이 없어요.</p>';

  const html = htmlShell({
    site,
    canonical,
    robots: 'index, follow',
    title: `${cfg.title} | 공간마켓 라운지`,
    description: cfg.desc,
    ogImage: DEFAULT_OG_PATH,
    ogType: 'website',
    bodyHtml: `<main><h1>${esc(cfg.title)}</h1><p>${esc(cfg.desc)}</p>${listHtml}${ctaHtml(site)}</main>`,
  });
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}

async function renderRegion(req, res, site, regionSlug) {
  const region = slugToRegion(regionSlug);
  if (!region) return notFound(req, res, site, '존재하지 않는 지역이에요.');
  const meta = buildRegionMeta(region);
  const canonical = `${site}${buildRegionPath(region)}`;

  const posts = await sb(
    `lounge_posts?region=eq.${encodeURIComponent(region)}&is_story=eq.false&is_deleted=not.eq.true&is_hidden=not.eq.true&is_visible=not.eq.false&select=id,title,content&order=created_at.desc&limit=30`
  );
  const listHtml = Array.isArray(posts) && posts.length
    ? `<ul>${posts.map((p) => `<li><a href="${site}${buildPostPath(p)}">${esc((p.title && p.title.trim()) || String(p.content ?? '').slice(0, 40))}</a></li>`).join('')}</ul>`
    : '<p>아직 등록된 글이 없어요.</p>';

  const html = htmlShell({
    site,
    canonical,
    robots: 'index, follow',
    title: meta.title,
    description: meta.description,
    ogImage: DEFAULT_OG_PATH,
    ogType: 'website',
    bodyHtml: `<main><h1>${esc(region)} 공간 이야기</h1><p>${esc(meta.description)}</p>${listHtml}${ctaHtml(site)}</main>`,
  });
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html);
}


// ─────────────────────────────────────────────────────
// 정적 랜딩 프리렌더 (홈 · 파트너)
//
// 왜 필요한가: 네이버 Yeti 는 자바스크립트를 사실상 실행하지 않는다. SPA 인 공간마켓은
// 홈/파트너 페이지가 네이버에 «빈 문서»로 보였다(제목·설명 외에 본문이 없다).
// 라운지에 이미 쓰고 있던 user-agent 기반 봇 rewrite 를 이 두 페이지에도 확장한다.
//
// ⚠️ 클로킹 금지 원칙: 여기 들어가는 문장은 화면이 실제로 보여주는 것과 같아야 한다.
//    그래서 FAQ·사업자정보·수수료는 utils/siteSeo.js 의 같은 배열을 읽는다.
//    베타(토스 승인 전)에는 에스크로를 «운영 중»이라고 쓰지 않는다 — isBetaServer().
// ─────────────────────────────────────────────────────

function faqHtml(items) {
  if (!items || !items.length) return '';
  return `<section>
<h2>자주 묻는 질문</h2>
${items.map(({ q, a }) => `<h3>${esc(q)}</h3>\n<p>${esc(a)}</p>`).join('\n')}
</section>`;
}

// 사업자 정보 — 전자상거래법상 공개 의무. 검색·답변엔진의 개체(entity) 인식에도 쓰인다.
function bizHtml() {
  return `<footer>
<h2>사업자 정보</h2>
<ul>${BIZ_ROWS.map(([k, v]) => `<li>${esc(k)}: ${esc(v)}</li>`).join('')}</ul>
<p>${esc(BIZ.legalName)}(${esc(BIZ.serviceName)})는 통신판매중개자로서 시공 계약의 당사자가 아닙니다.</p>
</footer>`;
}

async function renderHome(req, res, site) {
  const beta = isBetaServer();
  const seo = pageSeo(beta)['/'];
  const faq = consumerFaq(beta);
  const canonical = `${site}/`;

  // 화면(LandingScreen)의 「소개문 → 흐름 세 마디 → FAQ」 구조를 그대로 따른다.
  const flow = [
    ['견적을 모은다', '요청 한 번으로 우리 동네 업체들의 견적을 받고, 금액·기간·기록을 나란히 비교합니다.'],
    ['이야기를 나눈다', '업체와 앱 안에서 상담하고, 현장 사진과 주고받은 말이 그대로 남습니다.'],
    beta
      ? ['기록으로 남긴다', '착공·중간·완료 사진과 계약 내용이 단계마다 쌓여, 나중에 다시 볼 수 있습니다.']
      : ['단계로 정산한다', '착공·중간·완료를 확인할 때마다 단계별로 정산합니다.'],
  ];

  const escrowHtml = beta
    ? ''
    : `<section>
<h2>공간안전결제 단계별 지급 비율</h2>
<ul>${ESCROW_STAGES.map(([name, desc, pct]) => `<li>${esc(name)} ${esc(pct)} — ${esc(desc)}</li>`).join('')}</ul>
</section>`;

  const bodyHtml = `<main>
<h1>${esc(seo.h1)}</h1>
<p>${esc(seo.description)}</p>

<section>
<h2>공간마켓은 어떤 서비스인가요?</h2>
<p>공간마켓은 우리 동네 집수리·인테리어·리모델링 업체를 쉽고 편하게 비교하고 상담할 수 있는 플랫폼입니다.</p>
<p>집수리, 도배, 장판, 욕실, 주방, 리모델링, 상업공간, 부분시공 등 견적이 필요한 다양한 시공에 맞는 업체를 찾아 견적을 비교하고 상담할 수 있습니다.</p>
</section>

<section>
<h2>공간마켓 이용 흐름</h2>
<ol>${flow.map(([t, d]) => `<li><strong>${esc(t)}</strong> — ${esc(d)}</li>`).join('')}</ol>
</section>
${escrowHtml}
${faqHtml(faq)}

<section>
<h2>인테리어 업체이신가요?</h2>
<p>공간마켓 공간파트너는 가입비·광고비 없이 바로 시작하고, 증빙을 낼수록 더 큰 공사를 받습니다.</p>
<p><a href="${site}/partner">파트너 입점 안내 보기</a></p>
</section>

<p><a href="${site}/lounge">공간마켓 라운지 — 공간 이야기 보기</a></p>
${bizHtml()}
</main>`;

  const html = htmlShell({
    site,
    canonical,
    robots: 'index, follow',
    title: seo.title,
    description: seo.description,
    ogImage: '/og-space-v2.png',
    ogType: 'website',
    bodyHtml,
    structuredData: [
      organizationSchema(site),
      websiteSchema(site),
      serviceSchema(beta, site),
      faqSchema(faq, site, '/'),
    ],
  });
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.end(html);
}

async function renderPartner(req, res, site) {
  const beta = isBetaServer();
  const seo = pageSeo(beta)['/partner'];
  const faq = partnerFaq();
  const canonical = `${site}/partner`;

  const bodyHtml = `<main>
<h1>${esc(seo.h1)}</h1>
<p>${esc(seo.description)}</p>

<section>
<h2>가입은 어떻게 하나요?</h2>
<p>업체명·연락처·영업 지역·공종만 적으면 바로 시작합니다. 가입비·광고비·월정액은 없습니다.</p>
</section>

<section>
<h2>증빙과 수주 한도</h2>
<p>가입만으로 공사 1건 ${esc(PARTNER_LADDER[0].limit)} 입찰할 수 있고, 계약은 사업자등록 확인 뒤에 열립니다. 증빙을 하나씩 낼수록 한도가 커집니다. ${esc(PARTNER_DEPOSIT_NOTE)}이며, 사업자등록·시공보험·보증금을 모두 증빙하면 프리미엄 파트너가 됩니다.</p>
<ul>${PARTNER_LADDER.map((g) => `<li>${esc(g.name)} — 공사 1건 ${esc(g.limit)}</li>`).join('')}</ul>
</section>

<section>
<h2>신청부터 수주까지</h2>
<ol>${PARTNER_STEPS.map(([t, d]) => `<li><strong>${esc(t)}</strong> — ${esc(d)}</li>`).join('')}</ol>
</section>
${faqHtml(faq)}

<p><a href="${site}/">공간마켓 홈</a></p>
${bizHtml()}
</main>`;

  const html = htmlShell({
    site,
    canonical,
    robots: 'index, follow',
    title: seo.title,
    description: seo.description,
    ogImage: '/og-space-v2.png',
    ogType: 'website',
    bodyHtml,
    structuredData: [
      organizationSchema(site),
      faqSchema(faq, site, '/partner'),
      breadcrumbSchema([['공간마켓', '/'], ['파트너 입점 안내', '/partner']], site),
    ],
  });
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.end(html);
}


// ─────────────────────────────────────────────────────
// /llms.txt — 생성형 답변엔진(GEO)용 요약.
//
// 솔직한 위치: llms.txt 는 «제안된 관례»일 뿐 표준이 아니고, 현재 이를 공식적으로
// 읽는다고 밝힌 주요 AI 크롤러는 없다. 비용이 거의 없고, 답변엔진이 사람 대신
// 요약할 때 참고할 «정확한 사실 한 장»을 남겨두는 값이 있어서 넣는다.
//
// 정적 파일(public/llms.txt)로 두지 않는 이유: 수수료·사업자정보가 바뀌면 조용히
// 갈라진다. utils/siteSeo.js 한 곳에서 생성해 항상 화면과 같은 숫자를 말하게 한다.
// ─────────────────────────────────────────────────────
function renderLlms(req, res, site) {
  const beta = isBetaServer();
  const seo = pageSeo(beta);
  const lines = [
    `# ${BIZ.serviceName}`,
    '',
    `> ${seo['/'].description}`,
    '',
    `${BIZ.serviceName}은 인테리어·집수리·리모델링을 맡기려는 «의뢰인»과 시공 «업체»를 연결하는 통신판매중개 플랫폼입니다. 운영사는 ${BIZ.legalName}(대표 ${BIZ.ceo}, 사업자등록번호 ${BIZ.bizNo}, 통신판매업신고 ${BIZ.telecomSalesNo})입니다.`,
    '',
    '## 의뢰인(수요자)이 받는 것',
    '- 견적 요청과 업체 비교는 무료입니다.',
    '- 업체마다 확인된 증빙(사업자등록·시공보험·보증금)이 표시되고, 셋을 모두 증빙한 업체는 프리미엄 파트너로 보입니다. 증빙이 적은 업체는 작은 공사만 입찰할 수 있습니다.',
    '- 상담 채팅, 현장 사진, 계약 내용, 진행 단계가 앱에 기록으로 남습니다.',
    beta
      ? '- 공간안전결제(단계별 에스크로)는 토스페이먼츠 승인 후 제공 예정이며, 현재 베타에서는 제공되지 않습니다. 지금은 계약서에 적은 단계대로 업체와 직접 대금을 주고받습니다.'
      : `- 공간안전결제(에스크로)로 시공대금을 예치하고, 단계 확인 후 나눠 지급합니다 — 500만원 미만은 착공 30% · 완료 70%, 500만원 이상은 착공 30%(자재비 포함) · 중간 40% · 완료 30%, 공간보증(보증금) 업체는 결제 직후 자재비 10%를 먼저 받습니다.`,
    '',
    '## 시공 업체(공급자)가 받는 것',
    '- 가입비·광고비·월정액이 없습니다. 업체명·연락처·영업 지역·공종만 적으면 바로 시작합니다.',
    `- 증빙을 낼수록 공사 1건 입찰 한도가 커집니다. ${PARTNER_DEPOSIT_NOTE}이며, 보증금은 가입비가 아니고 활동 종료 시 환급됩니다:`,
    ...PARTNER_LADDER.map((g) => `  - ${g.name}: 공사 1건 ${g.limit}`),
    '',
    '## 자주 묻는 질문 (의뢰인)',
    ...consumerFaq(beta).flatMap(({ q, a }) => [`- Q. ${q}`, `  A. ${a}`]),
    '',
    '## 자주 묻는 질문 (업체)',
    ...partnerFaq().flatMap(({ q, a }) => [`- Q. ${q}`, `  A. ${a}`]),
    '',
    '## 주요 링크',
    `- 홈(의뢰인): ${site}/`,
    `- 파트너 입점 안내(업체): ${site}/partner`,
    `- 공간안전결제 안내: ${site}/safe-payment`,
    `- 라운지(공간 이야기): ${site}/lounge`,
    `- 환불 정책: ${site}/refund`,
    `- 이용약관: ${site}/terms`,
    `- 개인정보처리방침: ${site}/privacy`,
    '',
    '## 연락처',
    `- 고객센터: ${BIZ.tel}`,
    `- 이메일: ${BIZ.email}`,
    `- 주소: ${BIZ.address}`,
    '',
    '## 인용 시 유의',
    `- ${BIZ.serviceName}은 통신판매중개자로서 시공 계약의 당사자가 아닙니다. 시공 이행·품질·하자보수 책임은 해당 시공업체에 있습니다.`,
    beta ? '- 현재 무료 베타 운영 중입니다. 결제·에스크로 기능은 아직 열려 있지 않습니다.' : '',
    '',
  ].filter((l) => l !== '');

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
  res.end(lines.join('\n'));
}

export default async function handler(req, res) {
  const site = getSiteUrl(req);
  const parts = getPathParts(req);

  // vercel.json 이 /, /partner 봇 요청을 ?page=home|partner 로 넘긴다.
  const page = req.query && req.query.page;

  try {
    if (page === 'llms')    return renderLlms(req, res, site);
    if (page === 'home')    return await renderHome(req, res, site);
    if (page === 'partner') return await renderPartner(req, res, site);

    if (parts[0] === 'posts' && parts[1]) {
      return await renderPost(req, res, site, parts[1]);
    }
    if (parts[0] === 'category' && parts[1]) {
      return await renderCategory(req, res, site, parts[1]);
    }
    if (parts[0] === 'region' && parts[1]) {
      return await renderRegion(req, res, site, parts[1]);
    }
    return notFound(req, res, site, '공간마켓 라운지입니다.');
  } catch {
    return notFound(req, res, site, '잠시 후 다시 시도해주세요.');
  }
}
