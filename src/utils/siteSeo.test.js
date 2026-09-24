import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  BIZ,
  BIZ_ROWS,
  PARTNER_LADDER,
  PARTNER_STEPS,
  verificationMetas,
  canonicalSite,
  SITE_URL,
  consumerFaq,
  partnerFaq,
  pageSeo,
  isBetaServer,
  organizationSchema,
  websiteSchema,
  serviceSchema,
  faqSchema,
  breadcrumbSchema,
} from './siteSeo.js';

import prerender from '../../api/prerender.js';
import robotsHandler from '../../api/robots.js';
import sitemapHandler from '../../api/sitemap.js';

// ── 핸들러 호출용 최소 mock ───────────────────────────
function invoke(handler, query = {}) {
  const req = {
    headers: { host: 'gongganmarket.com', 'x-forwarded-proto': 'https' },
    query,
    url: '/',
  };
  const out = { statusCode: 200, headers: {}, body: '' };
  const res = {
    set statusCode(v) { out.statusCode = v; },
    get statusCode() { return out.statusCode; },
    setHeader(k, v) { out.headers[k] = v; },
    end(b) { out.body = b; },
  };
  return Promise.resolve(handler(req, res)).then(() => out);
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(([, json]) => JSON.parse(json.replace(/\\u003c/g, '<')));
}

// ─────────────────────────────────────────────────────
// 사업자 정보 — 법적 공개 의무 + JSON-LD 개체 식별의 근거
// ─────────────────────────────────────────────────────

test('BIZ_ROWS 는 BIZ 와 같은 값을 노출한다(푸터·모달·JSON-LD 단일 소스)', () => {
  const row = (label) => BIZ_ROWS.find(([l]) => l === label)?.[1];
  assert.equal(row('상호'), BIZ.legalName);
  assert.equal(row('대표자'), BIZ.ceo);
  assert.equal(row('사업자등록번호'), BIZ.bizNo);
  assert.equal(row('통신판매업신고번호'), BIZ.telecomSalesNo);
  assert.equal(row('주소'), BIZ.address);
  assert.equal(row('고객센터'), BIZ.tel);
  assert.equal(row('이메일'), BIZ.email);
});

test('Organization 스키마가 검색·답변엔진이 요구하는 필드를 갖춘다', () => {
  const org = organizationSchema();
  assert.equal(org['@type'], 'Organization');
  assert.equal(org.name, BIZ.serviceName);
  assert.equal(org.legalName, BIZ.legalName);
  assert.equal(org.address['@type'], 'PostalAddress');
  assert.equal(org.address.addressCountry, 'KR');
  assert.equal(org.contactPoint.telephone, BIZ.tel);
  assert.ok(org['@id'].endsWith('#organization'));
});

test('WebSite 스키마가 Organization 을 publisher 로 참조한다', () => {
  const site = websiteSchema();
  assert.equal(site.inLanguage, 'ko-KR');
  assert.equal(site.publisher['@id'], organizationSchema()['@id']);
});

// ─────────────────────────────────────────────────────
// 베타 게이팅 — 아직 열지 않은 기능을 «운영 중»이라 말하지 않는다.
// 답변엔진이 사실이 아닌 문장을 인용하게 두면 안 된다.
// ─────────────────────────────────────────────────────

test('isBetaServer: 기본은 베타, VITE_APP_MODE=production 이면 해제', () => {
  assert.equal(isBetaServer({}), true);
  assert.equal(isBetaServer({ VITE_APP_MODE: 'beta' }), true);
  assert.equal(isBetaServer({ VITE_APP_MODE: 'production' }), false);
  assert.equal(isBetaServer({ VITE_APP_MODE: 'production', VITE_SHOW_BETA_UI: 'true' }), true);
});

test('베타에서는 Service 스키마에 에스크로를 넣지 않는다', () => {
  const names = (beta) =>
    serviceSchema(beta).hasOfferCatalog.itemListElement.map((o) => o.itemOffered.name);

  assert.ok(!names(true).some((n) => n.includes('에스크로')));
  assert.ok(names(false).some((n) => n.includes('에스크로')));
});

test('베타 FAQ·설명은 에스크로를 «예정»으로만 말한다', () => {
  const betaAnswer = consumerFaq(true).find((f) => f.q.includes('공간안전결제')).a;
  assert.match(betaAnswer, /토스페이먼츠 승인 뒤 열립니다/);

  assert.ok(!pageSeo(true)['/'].description.includes('에스크로'));
  assert.ok(pageSeo(false)['/'].description.includes('에스크로'));
});

// ─────────────────────────────────────────────────────
// AEO — FAQ 구조화
// ─────────────────────────────────────────────────────

test('faqSchema 는 Question/acceptedAnswer 쌍으로 변환한다', () => {
  const items = partnerFaq();
  const schema = faqSchema(items, 'https://gongganmarket.com', '/partner');
  assert.equal(schema['@type'], 'FAQPage');
  assert.equal(schema.mainEntity.length, items.length);
  for (const [i, entry] of schema.mainEntity.entries()) {
    assert.equal(entry['@type'], 'Question');
    assert.equal(entry.name, items[i].q);
    assert.equal(entry.acceptedAnswer.text, items[i].a);
    assert.ok(entry.acceptedAnswer.text.length > 0);
  }
});

test('faqSchema/breadcrumbSchema 는 빈 입력에 null 을 준다(조건문 없이 나열 가능)', () => {
  assert.equal(faqSchema([]), null);
  assert.equal(faqSchema(undefined), null);
  assert.equal(breadcrumbSchema([]), null);
});

test('파트너 FAQ 는 수수료를 말하지 않고, 한도는 계단(partnerTier)에서 가져온다', () => {
  const all = partnerFaq().map((f) => f.q + f.a).join(' ');
  assert.ok(!all.includes('수수료'), '입구에서 수수료를 말하지 않는다(대표 2026-09-24)');
  assert.ok(!all.includes('4.4'));
  const bid = partnerFaq().find((f) => f.q.includes('바로 입찰')).a;
  assert.ok(bid.includes(PARTNER_LADDER[0].limit));
});

// ─────────────────────────────────────────────────────
// 클로킹 방지 — 프리렌더(봇)와 화면(사람)이 같은 문장을 써야 한다.
// 화면 쪽 FAQ 는 consumerFaq()/partnerFaq() 를 그대로 렌더하므로,
// 프리렌더 HTML 이 같은 배열을 담고 있는지 확인하면 양쪽이 묶인다.
// ─────────────────────────────────────────────────────

test('프리렌더 홈이 화면과 같은 FAQ·사업자정보를 담는다', async () => {
  const { statusCode, body } = await invoke(prerender, { page: 'home' });
  assert.equal(statusCode, 200);

  for (const { q, a } of consumerFaq(isBetaServer())) {
    assert.ok(body.includes(q), `질문 누락: ${q}`);
    assert.ok(body.includes(a.slice(0, 20)), `답변 누락: ${q}`);
  }
  assert.ok(body.includes(BIZ.bizNo));
  assert.ok(body.includes(BIZ.telecomSalesNo));
  assert.match(body, /<h1>/);
  assert.match(body, /rel="canonical" href="https:\/\/gongganmarket\.com\/"/);
  assert.match(body, /name="robots" content="index, follow"/);
});

test('프리렌더 홈이 Organization·WebSite·Service·FAQPage 를 모두 낸다', async () => {
  const { body } = await invoke(prerender, { page: 'home' });
  const types = jsonLdBlocks(body).map((b) => b['@type']);
  assert.deepEqual(types, ['Organization', 'WebSite', 'Service', 'FAQPage']);
});

test('프리렌더 파트너가 한도 계단을 숫자 그대로 담고, 수수료는 말하지 않는다', async () => {
  const { statusCode, body } = await invoke(prerender, { page: 'partner' });
  assert.equal(statusCode, 200);
  assert.ok(!body.includes('4.4%'), '수수료를 입구에서 말하지 않는다');
  for (const g of PARTNER_LADDER) {
    assert.ok(body.includes(g.name), `단계 누락: ${g.name}`);
    assert.ok(body.includes(g.limit), `한도 누락: ${g.name}`);
  }
  for (const { q } of partnerFaq()) assert.ok(body.includes(q), `질문 누락: ${q}`);
  assert.match(body, /rel="canonical" href="https:\/\/gongganmarket\.com\/partner"/);
});

// ─────────────────────────────────────────────────────
// robots / sitemap
// ─────────────────────────────────────────────────────

test('robots 가 비공개 경로를 막고 사이트맵을 절대 URL 로 알린다', async () => {
  const { body, headers } = await invoke(robotsHandler);
  assert.match(headers['Content-Type'], /text\/plain/);
  assert.match(body, /^User-agent: \*/m);
  for (const p of ['/api/', '/mypage', '/login', '/admin']) {
    assert.ok(body.includes(`Disallow: ${p}`), `차단 누락: ${p}`);
  }
  assert.ok(body.includes('Sitemap: https://gongganmarket.com/sitemap.xml'));
});

test('robots 가 네이버(Yeti)와 생성형 답변엔진 크롤러를 명시 허용한다', async () => {
  const { body } = await invoke(robotsHandler);
  for (const a of ['Yeti', 'Daum', 'GPTBot', 'ClaudeBot', 'PerplexityBot', 'OAI-SearchBot', 'Google-Extended']) {
    assert.ok(body.includes(`User-agent: ${a}`), `누락: ${a}`);
  }
});

test('sitemap 이 실재하는 라우트만 싣는다(soft 404 재발 방지)', async () => {
  const { body, headers } = await invoke(sitemapHandler);
  assert.match(headers['Content-Type'], /application\/xml/);

  for (const p of ['/', '/partner', '/safe-payment', '/tokens', '/refund', '/terms', '/privacy']) {
    assert.ok(body.includes(`<loc>https://gongganmarket.com${p}</loc>`), `누락: ${p}`);
  }
  // App.jsx 에 분기가 없는 경로들 — 예전 정적 사이트맵이 싣던 soft 404.
  for (const dead of ['/request', '/company', '/login', '/mypage']) {
    assert.ok(!body.includes(`<loc>https://gongganmarket.com${dead}</loc>`), `죽은 URL 재등장: ${dead}`);
  }
});

test('llms.txt 가 베타 사실과 양면(수요·공급) 요약을 담는다', async () => {
  const { body, headers } = await invoke(prerender, { page: 'llms' });
  assert.match(headers['Content-Type'], /text\/plain/);
  assert.match(body, /^# 공간마켓/);
  assert.ok(body.includes('의뢰인(수요자)이 받는 것'));
  assert.ok(body.includes('시공 업체(공급자)가 받는 것'));
  assert.ok(!body.includes('4.4%'));
  assert.ok(body.includes(PARTNER_LADDER[0].limit));
  assert.ok(body.includes('통신판매중개자'));
  if (isBetaServer()) assert.ok(body.includes('베타'));
});

test('소유확인 메타가 index.html 과 프리렌더 양쪽에 같은 값으로 있다', async () => {
  // 봇이 / 를 요청하면 index.html 이 아니라 프리렌더가 나간다.
  // 한쪽에만 있으면 서치어드바이저·서치콘솔 소유확인이 조용히 풀린다.
  const html = indexHtml();
  const metas = verificationMetas();
  assert.ok(metas.length > 0, '소유확인 메타가 하나도 없다');

  for (const [name, value] of metas) {
    assert.ok(
      html.includes(`name="${name}" content="${value}"`),
      `index.html 에 ${name} 이 없거나 값이 다르다`,
    );
    for (const page of ['home', 'partner']) {
      const { body } = await invoke(prerender, { page });
      assert.ok(
        body.includes(`name="${name}" content="${value}"`),
        `프리렌더(${page}) 에 ${name} 이 없거나 값이 다르다`,
      );
    }
  }

  // 반대 방향 — index.html 에만 몰래 추가된 소유확인이 없어야 한다.
  const inHtml = [...html.matchAll(/<meta name="([a-z-]*site-verification)" content="([^"]*)"/g)]
    .map(([, n, v]) => `${n}=${v}`);
  assert.deepEqual(inHtml.sort(), metas.map(([n, v]) => `${n}=${v}`).sort());
});

test('index.html 의 정적 JSON-LD 가 siteSeo 모듈과 일치한다', () => {
  // index.html 은 정적 파일이라 모듈을 import 할 수 없다 — 값이 조용히 갈라지기 쉽다.
  // 여기서 묶어두면 siteSeo.js 만 고치고 index.html 을 잊는 사고를 잡는다.
  const indexHtml = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf-8');
  const blocks = [...indexHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(([, json]) => JSON.parse(json.replace(/\\u003c/g, '<')));

  assert.deepEqual(blocks, [organizationSchema(), websiteSchema()]);
});

test('index.html 은 페이지별 스키마를 전역으로 내지 않는다(중복 방지)', () => {
  // Service/FAQPage/BreadcrumbList 는 각 화면이 useJsonLd 로 붙인다.
  const indexHtml = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf-8');
  const types = [...indexHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(([, json]) => JSON.parse(json.replace(/\\u003c/g, '<'))['@type']);

  assert.deepEqual(types, ['Organization', 'WebSite']);
});

// ─────────────────────────────────────────────────────
// index.html 정적 메타 — 프리렌더를 타지 않는 크롤러가 읽는 값.
// 단일 소스와 갈라지면 «사실과 다른 문장»이 색인된다(예전에 에스크로가 그랬다).
// ─────────────────────────────────────────────────────

function indexHtml() {
  return readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf-8');
}

test('index.html 의 제목·설명이 pageSeo 단일 소스와 일치한다', () => {
  const html = indexHtml();
  const seo = pageSeo(isBetaServer())['/'];

  assert.equal(html.match(/<title>([\s\S]*?)<\/title>/)?.[1], seo.title);
  for (const re of [
    /<meta name="description" content="([^"]*)"/,
    /<meta property="og:description" content="([^"]*)"/,
    /<meta name="twitter:description" content="([^"]*)"/,
  ]) {
    assert.equal(html.match(re)?.[1], seo.description, `불일치: ${re}`);
  }
  for (const re of [
    /<meta property="og:title" content="([^"]*)"/,
    /<meta name="twitter:title" content="([^"]*)"/,
  ]) {
    assert.equal(html.match(re)?.[1], seo.title, `불일치: ${re}`);
  }
});

test('베타에서는 정적 메타도 에스크로를 운영 중인 기능처럼 쓰지 않는다', () => {
  if (!isBetaServer()) return;
  const html = indexHtml();
  const head = html.slice(0, html.indexOf('</head>'));
  const metas = [...head.matchAll(/<meta (?:name|property)="(?:description|og:description|twitter:description|og:title|twitter:title)" content="([^"]*)"/g)]
    .map(([, v]) => v);
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '';

  for (const text of [title, ...metas]) {
    assert.ok(!/에스크로|안전결제/.test(text), `베타에 쓰면 안 되는 문구: ${text}`);
  }
});

// ─────────────────────────────────────────────────────
// 검색어 — 「인테리어 비교견적」이 제목에 걸려야 한다.
// 예전 제목(「좋은 공간과 좋은 이야기가 모이는 곳」)은 검색어가 하나도 없었다.
// ─────────────────────────────────────────────────────

test('홈 제목·설명에 핵심 검색어가 들어 있다', () => {
  const seo = pageSeo(isBetaServer())['/'];
  assert.match(seo.title, /인테리어/);
  assert.match(seo.title, /견적/);
  assert.match(seo.description, /인테리어 견적/);
  // 제목이 길면 검색결과에서 잘린다 — 한글 기준 35자 안쪽으로 유지.
  assert.ok(seo.title.length <= 35, `제목이 너무 길다(${seo.title.length}자)`);
});

test('파트너 제목에 공급자 검색어가 들어 있다', () => {
  const seo = pageSeo(isBetaServer())['/partner'];
  assert.match(seo.title, /인테리어 업체/);
  assert.ok(seo.title.length <= 35, `제목이 너무 길다(${seo.title.length}자)`);
});

// ─────────────────────────────────────────────────────
// 파트너 단계 — 화면과 프리렌더가 같은 4단계를 써야 한다.
// 예전 프리렌더는 「1~2 영업일 내 연락 → 가입 승인 → 보증금 예치 등급」이라는
// 옛 모델 6단계를 따로 들고 있어, 화면의 「승인 기다림 없이」와 정면으로 어긋났다.
// ─────────────────────────────────────────────────────

test('프리렌더 파트너 단계가 단일 소스와 같고 옛 모델 문구가 없다', async () => {
  const { body } = await invoke(prerender, { page: 'partner' });

  for (const [title] of PARTNER_STEPS) {
    assert.ok(body.includes(title), `단계 누락: ${title}`);
  }
  for (const stale of ['1~2 영업일', '보증금 예치 등급', '가입 승인']) {
    assert.ok(!body.includes(stale), `옛 모델 문구가 남아 있다: ${stale}`);
  }
});

test('프리렌더 파트너에 화면에 없는 업종 목록이 들어가지 않는다', async () => {
  // 봇에게만 보이는 문단은 클로킹이다. 업종 나열은 화면(PartnerLandingScreen)에서 사라졌다.
  const { body } = await invoke(prerender, { page: 'partner' });
  assert.ok(!body.includes('어떤 업체가 신청할 수 있나요'));
});

test('의뢰인 FAQ 가 핵심 검색어 질문을 첫머리에 둔다', () => {
  const faq = consumerFaq(isBetaServer());
  assert.match(faq[0].q, /인테리어 비교견적/);
  assert.ok(faq.length >= 6, 'AEO 용 질문이 너무 적다');
});

// ─────────────────────────────────────────────────────
// 스토어 문안(ASO) — 코드와 갈라지면 스토어에 옛 모델이 남는다.
// 실제로 파트너 모델이 「보증금 등급 5단계」에서 「증빙 계단」으로 바뀌었을 때
// 이 문서만 옛 설명을 들고 있었다.
// ─────────────────────────────────────────────────────

test('ASO 문안이 코드의 사실과 어긋나지 않는다', () => {
  const full = readFileSync(fileURLToPath(new URL('../../store/ASO-ko.md', import.meta.url)), 'utf-8');
  // 실제 스토어에 올라가는 문안만 검사한다 — 맨 위 변경 이력 메모는 옛 모델을
  // «무엇이 바뀌었는지» 설명하려고 일부러 언급하므로 제외한다.
  const aso = full.slice(full.indexOf('## 앱 이름'));

  // 폐기된 옛 모델 문구
  for (const stale of ['예치보증금 등급', '수주 한도 500만 원까지', '4.4%', '엔터프라이즈', '시그니처']) {
    assert.ok(!aso.includes(stale), `옛 모델 문구가 남아 있다: ${stale}`);
  }
  // 살아 있는 사실
  assert.ok(aso.includes(BIZ.tel), '고객센터 번호 불일치');
  assert.ok(aso.includes('프리미엄 파트너'));
  assert.ok(aso.includes('보증금은 선택'), '보증금이 선택이라는 사실이 빠졌다');
  // 검색어를 스토어와 웹이 공유한다
  assert.ok(aso.includes('인테리어 비교견적'));
  assert.ok(aso.includes(pageSeo(isBetaServer())['/'].title), '웹 제목과 대조표가 어긋난다');
});

test('ASO 문안이 베타에서 에스크로를 운영 중이라 말하지 않는다', () => {
  if (!isBetaServer()) return;
  const aso = readFileSync(fileURLToPath(new URL('../../store/ASO-ko.md', import.meta.url)), 'utf-8');
  assert.ok(aso.includes('정식 서비스에서 제공'), '에스크로가 아직 열리지 않았다는 안내가 빠졌다');
});

// ─────────────────────────────────────────────────────
// 봇 rewrite — 어떤 수집기가 프리렌더를 받는가.
// Googlebot 과 서치콘솔 URL 검사(Google-InspectionTool)가 서로 다른 문서를 보면
// 클로킹으로 오해받는다. 사람은 반드시 SPA 를 그대로 받아야 한다.
// ─────────────────────────────────────────────────────

function botRegexes() {
  const cfg = JSON.parse(readFileSync(fileURLToPath(new URL('../../vercel.json', import.meta.url)), 'utf-8'));
  return cfg.rewrites
    .filter((r) => Array.isArray(r.has))
    .map((r) => r.has.find((h) => h.key === 'user-agent')?.value)
    .filter(Boolean);
}

test('봇 판별 정규식이 rewrite 규칙마다 갈라지지 않는다', () => {
  const list = botRegexes();
  assert.ok(list.length >= 3, `UA 조건 rule 이 너무 적다(${list.length})`);
  assert.equal(new Set(list).size, 1, 'rewrite 규칙마다 UA 정규식이 다르다');
});

test('JS 를 실행하지 않는 수집기는 프리렌더를, 사람은 SPA 를 받는다', () => {
  const re = new RegExp(botRegexes()[0]);

  const bots = {
    Googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Google-InspectionTool': 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0)',
    Yeti: 'Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)',
    Daum: 'Mozilla/5.0 (compatible; Daum/4.1)',
    bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0)',
    GPTBot: 'Mozilla/5.0 (compatible; GPTBot/1.0)',
    'OAI-SearchBot': 'Mozilla/5.0 (compatible; OAI-SearchBot/1.0)',
    'ChatGPT-User': 'Mozilla/5.0 (compatible; ChatGPT-User/1.0)',
    ClaudeBot: 'Mozilla/5.0 (compatible; ClaudeBot/1.0)',
    'Claude-User': 'Mozilla/5.0 (compatible; Claude-User/1.0)',
    PerplexityBot: 'Mozilla/5.0 (compatible; PerplexityBot/1.0)',
    'Perplexity-User': 'Mozilla/5.0 (compatible; Perplexity-User/1.0)',
    kakaotalk: 'Mozilla/5.0 (compatible; kakaotalk-scrap/1.0)',
  };
  for (const [name, ua] of Object.entries(bots)) {
    assert.ok(re.test(ua), `프리렌더를 받아야 하는데 안 받는다: ${name}`);
  }

  const humans = {
    iPhone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    Android: 'Mozilla/5.0 (Linux; Android 14; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    Desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
  for (const [name, ua] of Object.entries(humans)) {
    assert.ok(!re.test(ua), `사람인데 프리렌더를 받는다: ${name}`);
  }
});

// ─────────────────────────────────────────────────────
// 정식 호스트 고정 — www ↔ apex 중복 색인 방지.
// 2026-09-24 서치콘솔: 홈이 「중복 페이지, Google에서 사용자와 다른 표준을
// 선택함」으로 색인되지 않았다(참조 페이지가 www). canonical 을 요청 호스트로
// 만들고 있어 두 호스트가 각자 자기를 정식이라 선언한 것이 원인이었다.
// ─────────────────────────────────────────────────────

test('canonicalSite 는 운영 도메인을 apex 하나로 모은다', () => {
  for (const h of ['gongganmarket.com', 'www.gongganmarket.com', 'WWW.GonggangMarket.com'.toLowerCase().replace('gonggangmarket', 'gongganmarket')]) {
    assert.equal(canonicalSite(h), SITE_URL, `고정 실패: ${h}`);
  }
  // 포트가 붙어도 운영 도메인이면 고정
  assert.equal(canonicalSite('www.gongganmarket.com:443'), SITE_URL);
  // 값이 없으면 안전하게 정식 주소
  assert.equal(canonicalSite(''), SITE_URL);
  assert.equal(canonicalSite(undefined), SITE_URL);
});

test('canonicalSite 는 preview·localhost 는 건드리지 않는다', () => {
  // 여기서 apex 로 고정해 버리면 미리보기 배포의 링크가 전부 운영으로 샌다.
  assert.equal(canonicalSite('gonggan-market-abc123.vercel.app'), 'https://gonggan-market-abc123.vercel.app');
  assert.equal(canonicalSite('localhost:5173', 'http'), 'http://localhost:5173');
  // window.location.protocol 처럼 콜론이 붙어 와도 처리한다
  assert.equal(canonicalSite('localhost:5173', 'http:'), 'http://localhost:5173');
});

test('www 로 들어온 봇 요청도 canonical·og:url 이 apex 를 가리킨다', async () => {
  const req = {
    headers: { host: 'www.gongganmarket.com', 'x-forwarded-host': 'www.gongganmarket.com', 'x-forwarded-proto': 'https' },
    query: { page: 'home' },
    url: '/',
  };
  const out = { statusCode: 200, headers: {}, body: '' };
  const res = {
    set statusCode(v) { out.statusCode = v; },
    get statusCode() { return out.statusCode; },
    setHeader(k, v) { out.headers[k] = v; },
    end(b) { out.body = b; },
  };
  await prerender(req, res);

  assert.ok(out.body.includes(`rel="canonical" href="${SITE_URL}/"`), 'canonical 이 apex 가 아니다');
  assert.ok(out.body.includes(`property="og:url" content="${SITE_URL}/"`), 'og:url 이 apex 가 아니다');
  assert.ok(!out.body.includes('www.gongganmarket.com'), 'www 주소가 문서에 남아 있다');
});

test('사이트맵·robots 도 www 요청에서 apex URL 만 낸다', async () => {
  const mk = () => {
    const out = { body: '', headers: {} };
    return [
      { headers: { host: 'www.gongganmarket.com', 'x-forwarded-host': 'www.gongganmarket.com', 'x-forwarded-proto': 'https' }, query: {}, url: '/' },
      { set statusCode(v) {}, get statusCode() { return 200; }, setHeader(k, v) { out.headers[k] = v; }, end(b) { out.body = b; } },
      out,
    ];
  };

  const [rq1, rs1, o1] = mk();
  await sitemapHandler(rq1, rs1);
  assert.ok(!o1.body.includes('www.gongganmarket.com'), '사이트맵에 www URL 이 섞였다');
  assert.ok(o1.body.includes(`<loc>${SITE_URL}/</loc>`));

  const [rq2, rs2, o2] = mk();
  await robotsHandler(rq2, rs2);
  assert.ok(o2.body.includes(`Sitemap: ${SITE_URL}/sitemap.xml`), 'robots 의 Sitemap 이 apex 가 아니다');
});

// ─────────────────────────────────────────────────────
// 사업자 이메일 단일화 (2026-09-24, 대표 결정: biz@gonggansai.com)
// 예전에는 푸터·JSON-LD·llms.txt 는 gmail, 앱 문의·법적고지는 회사 도메인이라
// 전자상거래법상 공개 의무 항목이 두 가지로 갈라져 있었다.
// ─────────────────────────────────────────────────────

test('사업자 이메일은 회사 도메인 하나만 쓴다', () => {
  assert.equal(BIZ.email, 'biz@gonggansai.com');
  assert.ok(!BIZ.email.includes('gmail'), '개인 메일 주소가 사업자정보에 들어갔다');
});

test('폐기된 gmail 주소가 코드·문서 어디에도 남아 있지 않다', () => {
  const root = new URL('../../', import.meta.url);
  const files = [
    'index.html',
    'src/utils/siteSeo.js',
    'src/screens/LegalScreen.jsx',
    'store/ASO-ko.md',
    'docs/SEO_AEO_GEO.md',
  ];
  for (const f of files) {
    const text = readFileSync(fileURLToPath(new URL(f, root)), 'utf-8');
    assert.ok(!text.includes('gongganmarket.biz@gmail.com'), `옛 주소가 남아 있다: ${f}`);
  }
});

test('법적고지 화면이 사업자정보를 따로 들고 있지 않다', () => {
  // 값을 하드코딩하면 푸터와 또 갈라진다 — siteSeo 에서만 가져와야 한다.
  const legal = readFileSync(fileURLToPath(new URL('../screens/LegalScreen.jsx', import.meta.url)), 'utf-8');
  assert.ok(legal.includes('from "../utils/siteSeo"'), 'siteSeo 를 단일 소스로 쓰지 않는다');
  for (const literal of [BIZ.bizNo, BIZ.telecomSalesNo, BIZ.tel, BIZ.email, BIZ.address]) {
    assert.ok(!legal.includes(`"${literal}"`), `값을 하드코딩했다: ${literal}`);
  }
});

test('프리렌더·llms.txt 도 같은 이메일을 낸다', async () => {
  const { body: home } = await invoke(prerender, { page: 'home' });
  assert.ok(home.includes(BIZ.email));
  assert.ok(!home.includes('gmail.com'));

  const { body: llms } = await invoke(prerender, { page: 'llms' });
  assert.ok(llms.includes(BIZ.email));
  assert.ok(!llms.includes('gmail.com'));
});

// ─────────────────────────────────────────────────────
// 「사업자등록을 확인한 업체가 견적을 보낸다」는 사실이 아니다.
// 새 정책에서는 가입만 한 업체도 300만원까지 입찰한다(partnerTier LIMITS.NONE).
// 이 문장이 설명에 들어가면 title·OG·프리렌더·llms.txt 에 실려 색인되고,
// 같은 페이지 FAQ(「증빙이 적은 업체는 작은 공사만」)와 정면으로 모순된다.
// ─────────────────────────────────────────────────────

test('없는 검증을 광고하지 않는다 — 「사업자등록을 확인한 업체」 문구 금지', () => {
  const banned = /사업자등록을 확인한 업체/;

  for (const beta of [true, false]) {
    for (const [path, seo] of Object.entries(pageSeo(beta))) {
      assert.ok(!banned.test(seo.title), `${path} 제목에 금지 문구(beta=${beta})`);
      assert.ok(!banned.test(seo.description), `${path} 설명에 금지 문구(beta=${beta})`);
    }
    for (const { q, a } of consumerFaq(beta)) {
      assert.ok(!banned.test(q) && !banned.test(a), `의뢰인 FAQ 에 금지 문구: ${q}`);
    }
  }
  for (const { q, a } of partnerFaq()) {
    assert.ok(!banned.test(q) && !banned.test(a), `파트너 FAQ 에 금지 문구: ${q}`);
  }
});

test('프리렌더·llms.txt 에도 금지 문구가 실리지 않는다', async () => {
  for (const page of ['home', 'partner', 'llms']) {
    const { body } = await invoke(prerender, { page });
    assert.ok(!body.includes('사업자등록을 확인한 업체'), `프리렌더(${page}) 에 금지 문구`);
  }
});
