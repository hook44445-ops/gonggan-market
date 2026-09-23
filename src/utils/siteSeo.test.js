import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  BIZ,
  BIZ_ROWS,
  PARTNER_FEE_RATE,
  PARTNER_GRADES,
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

test('파트너 FAQ 가 수수료율을 단일 소스에서 가져온다', () => {
  const feeAnswer = partnerFaq().find((f) => f.q.includes('수수료')).a;
  assert.ok(feeAnswer.includes(PARTNER_FEE_RATE));
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

test('프리렌더 파트너가 수수료·보증금 등급을 숫자 그대로 담는다', async () => {
  const { statusCode, body } = await invoke(prerender, { page: 'partner' });
  assert.equal(statusCode, 200);
  assert.ok(body.includes(PARTNER_FEE_RATE));
  for (const g of PARTNER_GRADES) {
    assert.ok(body.includes(g.name), `등급 누락: ${g.name}`);
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
  assert.ok(body.includes(PARTNER_FEE_RATE));
  assert.ok(body.includes('통신판매중개자'));
  if (isBetaServer()) assert.ok(body.includes('베타'));
});

test('프리렌더 HTML 의 네이버 소유확인 메타가 index.html 과 일치한다', async () => {
  // 봇이 / 를 요청하면 index.html 이 아니라 프리렌더가 나간다.
  // 두 값이 갈라지면 서치어드바이저 소유확인이 조용히 풀린다.
  const indexHtml = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf-8');
  const expected = indexHtml.match(/name="naver-site-verification" content="([^"]+)"/)?.[1];
  assert.ok(expected, 'index.html 에 naver-site-verification 이 없다');

  for (const page of ['home', 'partner']) {
    const { body } = await invoke(prerender, { page });
    assert.ok(
      body.includes(`name="naver-site-verification" content="${expected}"`),
      `프리렌더(${page}) 의 소유확인 값이 index.html 과 다르다`,
    );
  }
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
