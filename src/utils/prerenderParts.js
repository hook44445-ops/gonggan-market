// 프리렌더 조각 — 봇(api/prerender.js)과 빌드 때 index.html 에 심는 홈 본문(vite.config.js)이 «같은 함수»를 쓴다.
//
// 왜(10-02 로컬 점검): 네이버(Yeti)에게 홈 «/» 본문이 0자였다. vercel.json 의 봇 rewrite(/ → /api/prerender?page=home)는
//   Vercel 이 «파일이 있으면 rewrite 보다 먼저 낸다» — «/» 는 정적 index.html 이 있어 rewrite 가 안 먹는다(/partner 등은 파일이 없어 정상).
//   그래서 빌드 때 이 홈 본문을 index.html #root 안에 넣는다(새 서버 함수 없음 · 12/12).
// ⚠️ 클로킹 금지: 문장은 화면(LandingScreen)이 실제로 보여주는 것과 같다 — FAQ·설명·사업자정보는 utils/siteSeo.js 의 같은 값.
import {
  BIZ, BIZ_ROWS, ESCROW_STAGES, consumerFaq, pageSeo, SITE_URL, IP_FOOTER_LINE,
} from './siteSeo.js';
import {
  LEGAL_DOCS, SAFE_PAYMENT_NOT_LIVE, safePaymentH1, SAFE_PAYMENT_INTRO, SAFE_PAYMENT_STAGES, SAFE_PAYMENT_AMOUNT_PLANS,
  SAFE_PAYMENT_GUARANTEE_NOTE, SAFE_PAYMENT_PERIOD, SAFE_PAYMENT_PRICE_LINES, SAFE_PAYMENT_BROKER, SAFE_PAYMENT_REFUND,
  SAFE_PAYMENT_AFTER_CONFIRM_TITLE, SAFE_PAYMENT_AFTER_CONFIRM, SAFE_PAYMENT_AFTER_CONFIRM_NOTE,
  SAFE_PAYMENT_CTA_NOTE, TOKEN_NOT_LIVE, TOKEN_INTRO, TOKEN_PERIOD, TOKEN_MAX_PRICE, TOKEN_USES, TOKEN_REFUND,
  DOWNLOAD_INTRO, DOWNLOAD_STEPS, downloadTrust, segHtml,
} from '../content/publicPages.js';
import { TOKEN_PACKAGES } from '../constants/lounge.js';

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function faqHtml(items) {
  if (!items || !items.length) return '';
  return `<section>
<h2>자주 묻는 질문</h2>
${items.map(({ q, a }) => `<h3>${esc(q)}</h3>\n<p>${esc(a)}</p>`).join('\n')}
</section>`;
}

// 사업자 정보 — 전자상거래법상 공개 의무. 검색·답변엔진의 개체(entity) 인식에도 쓰인다.
// ip — 특허·상표 출원 한 줄. 화면(AppFooter showIp)처럼 홈(고객 랜딩)에서만 켠다.
export function bizHtml({ ip = false } = {}) {
  return `<footer>
<h2>사업자 정보</h2>
<ul>${BIZ_ROWS.map(([k, v]) => `<li>${esc(k)}: ${esc(v)}</li>`).join('')}</ul>
${ip ? `<p>${esc(IP_FOOTER_LINE)}</p>\n` : ''}<p>${esc(BIZ.legalName)}(${esc(BIZ.serviceName)})는 통신판매중개자로서 시공 계약의 당사자가 아닙니다.</p>
</footer>`;
}


// 홈(/) 본문 — 화면(LandingScreen)의 「소개문 → 흐름 세 마디 → FAQ」 구조를 그대로 따른다.
export function homeBodyHtml({ site = SITE_URL, beta = true } = {}) {
  const seo = pageSeo(beta)['/'];
  const faq = consumerFaq(beta);
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

  return `<main>
<h1>${esc(seo.h1)}</h1>
<p>${esc(seo.description)}</p>

<section>
<h2>공간랜드는 어떤 서비스인가요?</h2>
<p>공간랜드는 우리 동네 집수리·인테리어·리모델링 업체를 쉽고 편하게 비교하고 상담할 수 있는 플랫폼입니다.</p>
<p>집수리, 도배, 장판, 욕실, 주방, 리모델링, 상업공간, 부분시공 등 견적이 필요한 다양한 시공에 맞는 업체를 찾아 견적을 비교하고 상담할 수 있습니다.</p>
</section>

<section>
<h2>공간랜드 이용 흐름</h2>
<ol>${flow.map(([t, d]) => `<li><strong>${esc(t)}</strong> — ${esc(d)}</li>`).join('')}</ol>
</section>
${escrowHtml}
${faqHtml(faq)}

<section>
<h2>인테리어 업체이신가요?</h2>
<p>공간랜드 공간파트너는 가입비·광고비 없이 바로 시작하고, 증빙을 낼수록 더 큰 공사를 받습니다.</p>
<p><a href="${site}/partner">파트너 입점 안내 보기</a></p>
</section>

<p><a href="${site}/lounge">공간랜드 라운지 — 공간 이야기 보기</a></p>
${bizHtml({ ip: true })}
</main>`;
}

// ── 공개 페이지(10-02) — /safe-payment · /tokens · /privacy · /terms · /refund · /download ──
//   네이버(Yeti)에게 빈 페이지였다(봇 rewrite 가 없었다). 글은 content/publicPages.js — 화면과 같은 데이터.
//   결제·토큰 판매가 열리기 전(beta)에는 «정식 오픈 후 … 예정» 문단을 h1 바로 다음 «첫 문단»에 둔다.

export const PUBLIC_PAGES = ['safe-payment', 'tokens', 'privacy', 'terms', 'refund', 'download'];

const won = (n) => Number(n).toLocaleString('ko-KR');

export function publicPageBodyHtml(page, { site = SITE_URL, beta = true } = {}) {
  const live = !beta;
  if (page === 'safe-payment') {
    return `<main>
<h1>${esc(safePaymentH1(live))}</h1>
${live ? '' : `<p>${segHtml(SAFE_PAYMENT_NOT_LIVE)}</p>\n`}<p>${segHtml(SAFE_PAYMENT_INTRO)}</p>
<section>
<h2>단계별 안전지급 구조</h2>
<ol>${SAFE_PAYMENT_STAGES.map(([name, desc, pct]) => `<li><strong>${esc(name)}</strong> ${esc(pct)} — ${esc(desc)}</li>`).join('')}</ol>
</section>
<section>
<h2>${esc(SAFE_PAYMENT_AFTER_CONFIRM_TITLE)}</h2>
<ul>${SAFE_PAYMENT_AFTER_CONFIRM.map(([name, desc]) => `<li><strong>${esc(name)}</strong> — ${esc(desc)}</li>`).join('')}</ul>
<p>${esc(SAFE_PAYMENT_AFTER_CONFIRM_NOTE)}</p>
</section>
<section>
<h2>공사 금액별 지급 구조</h2>
<ul>${SAFE_PAYMENT_AMOUNT_PLANS.map(([band, plan, who]) => `<li><strong>${esc(band)}</strong> — ${esc(plan)} · ${esc(who)}</li>`).join('')}</ul>
<p>${esc(SAFE_PAYMENT_GUARANTEE_NOTE)}</p>
</section>
<section><h2>서비스 제공기간</h2><p>${segHtml(SAFE_PAYMENT_PERIOD)}</p></section>
<section><h2>결제 금액 및 수단</h2><p>${SAFE_PAYMENT_PRICE_LINES.map(segHtml).join('<br>')}</p></section>
<section><h2>통신판매중개자 고지</h2><p>${esc(SAFE_PAYMENT_BROKER)}</p></section>
<section><h2>환불 정책</h2><p>${esc(SAFE_PAYMENT_REFUND)}</p><p><a href="${site}/refund">환불 정책 자세히 보기</a></p></section>
<p>${esc(SAFE_PAYMENT_CTA_NOTE)} <a href="${site}/">공간랜드에서 견적 요청하기</a></p>
${bizHtml()}
</main>`;
  }
  if (page === 'tokens') {
    return `<main>
<h1>공간토큰 (공간라운지 이용권)</h1>
${live ? '' : `<p>${segHtml(TOKEN_NOT_LIVE)}</p>\n`}<p>${segHtml(TOKEN_INTRO)}</p>
<section><h2>서비스 제공기간</h2><p>${segHtml(TOKEN_PERIOD)}</p></section>
<section>
<h2>패키지 및 가격</h2>
<ul>${TOKEN_PACKAGES.map((p) => `<li>공간토큰 ${won(p.tokens + (p.bonus ?? 0))}개 — ${won(p.price)}원</li>`).join('')}</ul>
<p>단건 결제 기준 상품 금액 최고가 : <strong>${won(TOKEN_MAX_PRICE)}원</strong><br>결제수단 : 신용·체크카드, 계좌이체, 가상계좌</p>
</section>
<section><h2>토큰 사용처</h2><ul>${TOKEN_USES.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>
<section><h2>환불 정책</h2><p>${segHtml(TOKEN_REFUND)}</p><p><a href="${site}/refund">환불 정책 자세히 보기</a></p></section>
${bizHtml()}
</main>`;
  }
  if (page === 'download') {
    return `<main>
<h1>공간랜드 시작하기</h1>
<p>${segHtml(DOWNLOAD_INTRO)}</p>
<p><a href="${site}/">웹에서 바로 시작하기</a></p>
<h2>앱으로 받고 싶다면</h2>
<p>${segHtml(DOWNLOAD_STEPS.join('\n'))}</p>
<p>${segHtml(downloadTrust(beta).join('\n'))}</p>
${bizHtml()}
</main>`;
  }
  const doc = LEGAL_DOCS[page];
  if (!doc) return null;
  return `<main>
<h1>${esc(doc.title)}</h1>
${doc.intro ? `<p>${esc(doc.intro)}</p>` : ''}
${doc.sections.map((sec) => `<section>
<h2>${esc(sec.h)}</h2>
${sec.lead ? `<p>${esc(sec.lead)}</p>` : ''}${sec.items ? `<ul>${sec.items.map((it) => `<li>${esc(it)}</li>`).join('')}</ul>` : ''}${sec.body ? `<p>${esc(sec.body).replace(/\n/g, '<br>')}</p>` : ''}
</section>`).join('\n')}
${bizHtml()}
</main>`;
}
