// ─────────────────────────────────────────────────────
// 공간마켓 라운지 sitemap.xml (Vercel Serverless)
//   공개 글(is_deleted/false·is_hidden/false·is_visible≠false) + 카테고리/지역 랜딩 URL
// ─────────────────────────────────────────────────────

import { SEO_CATEGORY, buildPostPath, buildCategoryPath, buildRegionPath } from '../src/utils/loungeSeo.js';

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
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function urlEntry(site, path, lastmod, opts = {}) {
  const loc = `${site}${path}`.split('/').map((seg, i) => (i < 3 ? seg : encodeURIComponent(seg))).join('/');
  const { changefreq, priority } = opts;
  return `<url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${esc(new Date(lastmod).toISOString())}</lastmod>` : ''}${changefreq ? `<changefreq>${changefreq}</changefreq>` : ''}${priority != null ? `<priority>${priority}</priority>` : ''}</url>`;
}

// 핵심 정적 페이지 — 홈/다운로드/파트너/약관/개인정보(SEO 메타데이터 개선 대상과 동일 범위).
const STATIC_PAGES = [
  { path: '/',          changefreq: 'daily',   priority: '1.0' },
  { path: '/download',  changefreq: 'monthly', priority: '0.6' },
  { path: '/partner',   changefreq: 'monthly', priority: '0.6' },
  { path: '/terms',     changefreq: 'yearly',  priority: '0.3' },
  { path: '/privacy',   changefreq: 'yearly',  priority: '0.3' },
];

export default async function handler(req, res) {
  const site = getSiteUrl(req);
  const entries = [];

  // 핵심 정적 페이지
  for (const p of STATIC_PAGES) {
    entries.push(urlEntry(site, p.path, null, { changefreq: p.changefreq, priority: p.priority }));
  }

  // 카테고리 랜딩
  for (const slug of Object.keys(SEO_CATEGORY)) {
    entries.push(urlEntry(site, buildCategoryPath(slug)));
  }

  // 공개 글 + 지역 랜딩
  const posts = await sb(
    `lounge_posts?is_story=eq.false&is_deleted=not.eq.true&is_hidden=not.eq.true&is_visible=not.eq.false&select=id,title,content,region,updated_at,created_at&order=created_at.desc&limit=2000`
  );
  const regions = new Set();
  if (Array.isArray(posts)) {
    for (const p of posts) {
      entries.push(urlEntry(site, buildPostPath(p), p.updated_at || p.created_at));
      if (p.region && String(p.region).trim()) regions.add(String(p.region).trim());
    }
  }
  for (const region of regions) {
    entries.push(urlEntry(site, buildRegionPath(region)));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.end(xml);
}
