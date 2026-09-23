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

// 핵심 정적 페이지 — App.jsx 가 «실제로 분기하는» 경로만 싣는다.
// 예전 public/sitemap.xml 은 /request /company /login /mypage 를 싣고 있었는데
// 넷 다 라우트가 없어 catch-all 로 랜딩이 뜨는 soft 404 였다(색인 낭비 + 중복 콘텐츠).
//
// 수요(고객) 쪽과 공급(업체) 쪽 진입점에 우선순위를 나눠 준다:
//   · 홈(/)      — 수요 진입
//   · /partner   — 공급 진입
//   · /safe-payment, /tokens — 결제·상품 설명(비회원 열람 가능, 토스 심사 공개 페이지)
const STATIC_PAGES = [
  { path: '/',              changefreq: 'daily',   priority: '1.0' },
  { path: '/partner',       changefreq: 'weekly',  priority: '0.9' },
  { path: '/safe-payment',  changefreq: 'monthly', priority: '0.7' },
  { path: '/tokens',        changefreq: 'monthly', priority: '0.6' },
  { path: '/download',      changefreq: 'monthly', priority: '0.6' },
  { path: '/refund',        changefreq: 'yearly',  priority: '0.3' },
  { path: '/terms',         changefreq: 'yearly',  priority: '0.3' },
  { path: '/privacy',       changefreq: 'yearly',  priority: '0.3' },
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
