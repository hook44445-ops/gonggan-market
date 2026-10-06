// 10-02 로컬 점검 — 네이버(Yeti)에게 홈 «/» 본문 0자 · 공개 페이지 6개 빈 화면 · 구글 AI 개요가 «예치할 수 있다»고 답함
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import prerender from '../../api/prerender.js';
import { staticHomeHtml, STATIC_HOME_CLASS } from './staticHome.js';
import { homeBodyHtml, publicPageBodyHtml, PUBLIC_PAGES } from './prerenderParts.js';
import { pageSeo, consumerFaq } from './siteSeo.js';

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf-8');

function invoke(query = {}) {
  const req = { headers: { host: 'gongganmarket.com', 'x-forwarded-proto': 'https' }, query, url: '/' };
  const out = { statusCode: 200, headers: {}, body: '' };
  const res = { set statusCode(v) { out.statusCode = v; }, get statusCode() { return out.statusCode; },
    setHeader(k, v) { out.headers[k] = v; }, end(b) { out.body = b; } };
  return Promise.resolve(prerender(req, res)).then(() => out);
}
const plain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('빌드 때 index.html #root 안에 홈 본문(봇 프리렌더와 같은 함수)이 들어간다', () => {
  const src = read('../../index.html');
  assert.ok(src.includes('<div id="root"></div>'), '원본 index.html 의 #root 모양이 바뀌면 이 장치가 조용히 꺼진다');
  const out = staticHomeHtml(src, { beta: true });
  assert.ok(out.includes(`<div id="root"><div class="${STATIC_HOME_CLASS}">${homeBodyHtml({ beta: true })}</div></div>`));
  // USP 문장(설명 · FAQ)이 JS 없이 보인다
  assert.ok(plain(out).includes(pageSeo(true)['/'].description));
  for (const { q } of consumerFaq(true)) assert.ok(out.includes(q), `FAQ 누락: ${q}`);
  // 사람(JS)에게는 숨긴다 — <head> 맨 앞 한 줄
  assert.match(out, /<head>\s*<script>document\.documentElement\.className\+=' gm-js'<\/script><style>\.gm-js \.gm-seo-static\{display:none\}<\/style>/);
  assert.equal(staticHomeHtml(out, { beta: true }), out, '두 번 넣지 않는다');
  // vite 설정이 빌드 때 이 장치를 쓴다
  assert.match(read('../../vite.config.js'), /seoStaticHome\(isBetaServer\(/);
});

test('봇 홈 프리렌더도 같은 본문을 낸다(화면 · 정적 본문 · 봇이 한 문장)', async () => {
  const { body } = await invoke({ page: 'home' });
  assert.ok(body.includes(homeBodyHtml({ site: 'https://gongganmarket.com', beta: true })));
});

test('공개 페이지 6개 — 봇 rewrite 가 있고 본문이 비지 않는다', async () => {
  const cfg = JSON.parse(read('../../vercel.json'));
  const rule = cfg.rewrites.find((r) => r.destination === '/api/prerender?page=:page');
  assert.ok(rule, 'vercel.json 에 공개 페이지 봇 rewrite 가 없다');
  for (const p of PUBLIC_PAGES) assert.ok(rule.source.includes(p), `rewrite 에 ${p} 가 없다`);
  for (const p of PUBLIC_PAGES) {
    const { statusCode, body } = await invoke({ page: p });
    assert.equal(statusCode, 200);
    assert.ok(body.includes(`<title>${pageSeo(true)[`/${p}`].title.replace(/&/g, '&amp;')}</title>`), `제목: ${p}`);
    assert.match(body, new RegExp(`rel="canonical" href="https://gongganmarket.com/${p}"`));
    const main = body.slice(body.indexOf('<main>'));
    assert.ok(plain(main).length > 300, `${p} 본문이 너무 짧다`);
    assert.ok(main.includes('통신판매중개자'), `${p} 사업자 정보 누락`);
  }
});

test('결제·토큰 판매 전: «정식 오픈 후 … 예정»이 제목 · 설명 · h1 다음 첫 문단 · llms.txt 에 «먼저»', async () => {
  const seo = pageSeo(true)['/safe-payment'];
  assert.match(seo.title, /정식 오픈 후 제공 예정/);
  assert.match(seo.description, /^공간안전결제는 정식 오픈 후 제공 예정입니다\. 지금은 계약서에 적은 단계대로 업체와 직접 진행합니다\./);
  const first = (html) => html.slice(html.indexOf('<main>')).match(/<\/h1>\s*<p>([\s\S]*?)<\/p>/)[1];
  assert.match(first(publicPageBodyHtml('safe-payment', { beta: true })), /정식 오픈 후 제공 예정/);
  assert.match(first(publicPageBodyHtml('safe-payment', { beta: true })), /계약서에 적은 단계대로 업체와 직접/);
  assert.match(first(publicPageBodyHtml('tokens', { beta: true })), /정식 오픈 후 판매 예정/);
  // 정식 오픈 뒤에는 안내가 빠진다
  assert.ok(!/오픈 후 제공 예정/.test(publicPageBodyHtml('safe-payment', { beta: false })));
  // 결제 «약속 문장»은 그대로(대표 10-02)
  assert.match(publicPageBodyHtml('safe-payment', { beta: true }), /공간안전결제\(단계별 안전지급\)<\/strong>로 예치하면/);
  const { body: llms } = await invoke({ page: 'llms' });
  const lines = llms.split('\n');
  assert.equal(lines[2], '> 결제 안내: 공간안전결제는 정식 오픈 후 제공 예정입니다. 지금은 계약서에 적은 단계대로 업체와 직접 진행합니다.');
  assert.ok(llms.includes('- 공간안전결제 안내(정식 오픈 후 제공 예정): https://gongganmarket.com/safe-payment'));
});

test('화면과 봇이 같은 글 — 화면은 content/publicPages 를 읽고, 옛 문장을 따로 들고 있지 않다', () => {
  const legal = read('../screens/LegalScreen.jsx');
  const pay = read('../screens/SafePaymentScreen.jsx');
  const tok = read('../screens/TokenProductScreen.jsx');
  const dl = read('../screens/DownloadScreen.jsx');
  assert.match(legal, /import \{ PRIVACY, TERMS, REFUND \} from "\.\.\/content\/publicPages"/);
  assert.ok(!/const PRIVACY = \{/.test(legal));
  assert.match(pay, /<RichText segs=\{SAFE_PAYMENT_NOT_LIVE\} \/>/);
  assert.match(pay, /\{safePaymentH1\(PAYMENTS_LIVE\)\}/);
  assert.ok(!pay.includes('공간랜드는 인테리어·집수리 시공이 필요한 고객과'));
  assert.match(tok, /<RichText segs=\{TOKEN_NOT_LIVE\} \/>/);
  assert.match(dl, /<RichText segs=\{DOWNLOAD_INTRO\}/);
  // 제목·설명도 pageSeo 한 곳
  for (const src of [legal, pay, tok, dl]) assert.match(src, /pageSeo\(/);
});

test("안전결제·토큰 안내(고객 문구)에 «에스크로»가 없다 — 법적고지 원문은 그대로", async () => {
  const m = await import('../content/publicPages.js');
  const visible = [m.safePaymentH1(true), m.safePaymentH1(false), m.segText(m.SAFE_PAYMENT_NOT_LIVE), m.segText(m.SAFE_PAYMENT_INTRO),
    ...m.SAFE_PAYMENT_STAGES.flat(), ...m.SAFE_PAYMENT_AMOUNT_PLANS.flat(), m.SAFE_PAYMENT_GUARANTEE_NOTE, m.SAFE_PAYMENT_BROKER, m.SAFE_PAYMENT_REFUND,
    m.segText(m.TOKEN_NOT_LIVE), m.segText(m.TOKEN_INTRO), ...Object.values(pageSeo(true)).map((x) => `${x.title} ${x.description}`)].join(' ');
  assert.doesNotMatch(visible, /에스크로/);
});
