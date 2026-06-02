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

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

function getSiteUrl(req) {
  if (process.env.SITE_URL) return String(process.env.SITE_URL).replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return `${proto}://${host}`;
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
function htmlShell({ site, canonical, robots, title, description, ogImage, ogType = 'article', bodyHtml }) {
  const img = ogImage?.startsWith('http') ? ogImage : `${site}${ogImage || DEFAULT_OG_PATH}`;
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta name="robots" content="${esc(robots)}" />
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:type" content="${esc(ogType)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:image" content="${esc(img)}" />
<meta property="og:url" content="${esc(canonical)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(img)}" />
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

  const imagesHtml = Array.isArray(post.image_urls)
    ? post.image_urls.map((u) => `<img src="${esc(u)}" alt="${esc(meta.title)}" loading="lazy" />`).join('')
    : '';

  const dateStr = post.created_at ? new Date(post.created_at).toISOString().slice(0, 10) : '';

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

  const html = htmlShell({
    site,
    canonical,
    robots,
    title: meta.title,
    description: meta.description,
    ogImage: meta.imagePath,
    ogType: 'article',
    bodyHtml,
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

export default async function handler(req, res) {
  const site = getSiteUrl(req);
  const parts = getPathParts(req);

  try {
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
