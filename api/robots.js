// ─────────────────────────────────────────────────────
// 공간마켓 robots.txt (Vercel Serverless)
//   라운지 공개 경로 허용 + sitemap 절대 URL 안내
// ─────────────────────────────────────────────────────

function getSiteUrl(req) {
  if (process.env.SITE_URL) return String(process.env.SITE_URL).replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return `${proto}://${host}`;
}

export default function handler(req, res) {
  const site = getSiteUrl(req);
  const body = [
    'User-agent: *',
    'Allow: /lounge/posts',
    'Allow: /lounge/category',
    'Allow: /lounge/region',
    'Disallow: /api/',
    '',
    `Sitemap: ${site}/sitemap.xml`,
    '',
  ].join('\n');

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
  res.end(body);
}
