// ─────────────────────────────────────────────────────
// 공간마켓 robots.txt (Vercel Serverless)
//
// ⚠️ public/robots.txt 를 만들면 안 된다. Vercel 은 rewrites 를 «파일시스템 확인 뒤»에
//    적용하므로 정적 파일이 있으면 이 함수가 영영 호출되지 않는다(예전에 그 상태였다).
//
// 방침
//   · 공개 경로는 전부 크롤링 허용 — 막을 이유가 없고, 막으면 색인이 안 된다.
//   · 앱 전용/개인 화면은 차단 — 어차피 SPA catch-all 이라 랜딩이 뜨는 soft 404 이고,
//     색인되면 중복 콘텐츠가 된다.
//   · 생성형 답변엔진(GEO) 크롤러는 «명시적으로» 허용한다. 기본값이 허용이라도
//     이름을 적어두면 운영자 의도가 분명해지고, 나중에 선별 차단할 자리가 생긴다.
// ─────────────────────────────────────────────────────

// 정식 호스트 고정 — www 와 apex 가 각자 자기를 canonical 이라 선언하면
// 구글이 「중복 페이지」로 보고 색인을 건너뛴다(2026-09-24 실제 발생).
// canonicalSite() 가 운영 도메인을 apex 하나로 모으고, preview/localhost 는 그대로 둔다.
import { canonicalSite } from '../src/utils/siteSeo.js';

function getSiteUrl(req) {
  if (process.env.SITE_URL) return String(process.env.SITE_URL).replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return canonicalSite(host, proto);
}

// 앱 전용·개인 화면 — 라우트가 없어 SPA catch-all 로 떨어지거나(soft 404),
// 로그인해야 의미가 있는 경로들.
const DISALLOW = [
  '/api/',
  '/mypage',
  '/login',
  '/chat',
  '/admin',
  '/delete-account',
  '/*?app=1',       // 인앱 웹뷰 전환용 쿼리 — 같은 문서의 중복 URL
  '/*?login=',      // 역할 선택 복귀용 쿼리
];

// 검색엔진 — 네이버(Yeti)·다음(Daum)은 국내 유입의 핵심이라 이름을 따로 적는다.
const SEARCH_BOTS = ['Yeti', 'Daum', 'Daumoa', 'Googlebot', 'bingbot'];

// 생성형 답변엔진(AEO/GEO) — 인용되려면 먼저 읽혀야 한다.
const ANSWER_BOTS = [
  'GPTBot',            // OpenAI 크롤러
  'OAI-SearchBot',     // ChatGPT 검색
  'ChatGPT-User',      // ChatGPT 사용자 요청 페치
  'ClaudeBot',         // Anthropic 크롤러
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',   // Gemini 그라운딩
  'Applebot-Extended',
];

function block(agent, lines) {
  return [`User-agent: ${agent}`, ...lines, ''].join('\n');
}

export default function handler(req, res) {
  const site = getSiteUrl(req);
  const allowAll = ['Allow: /', ...DISALLOW.map((p) => `Disallow: ${p}`)];

  const body = [
    block('*', allowAll),
    ...SEARCH_BOTS.map((a) => block(a, allowAll)),
    ...ANSWER_BOTS.map((a) => block(a, ['Allow: /', 'Disallow: /api/'])),
    `Sitemap: ${site}/sitemap.xml`,
    '',
  ].join('\n');

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
  res.end(body);
}
