// ─────────────────────────────────────────────────────
// 공간마켓 사이트 전역 SEO / AEO / GEO 단일 소스
//
// 왜 한 파일인가:
//   · 화면(React)과 봇 프리렌더(api/prerender.js)가 **같은 문장**을 써야 한다.
//     봇에게만 다른 내용을 보이면 클로킹(cloaking)이 되어 색인에서 불이익을 받는다.
//   · 그래서 FAQ·사업자정보·수주 한도 같은 "사실"은 여기 한 곳에만 둔다.
//
// ⚠️ 순수 JS 전용 — React / import.meta / DOM 을 쓰지 않는다.
//    Vercel 서버리스(api/*)에서도 그대로 import 되기 때문이다.
//    베타 여부는 호출자가 인자로 넘긴다(브라우저는 SHOW_BETA_UI, 서버는 isBetaServer()).
// ─────────────────────────────────────────────────────

import { LADDER, limitText } from '../lib/partnerTier.js';

export const SITE_URL = 'https://gongganmarket.com';

// ── 정식 호스트 고정 (www ↔ apex) ─────────────────────
// 2026-09-24 서치콘솔: 홈이 「중복 페이지, Google에서 사용자와 다른 표준을 선택함」으로
// 색인되지 않았다. 참조 페이지가 https://www.gongganmarket.com/ 이었다.
//
// 원인: canonical 을 «요청 호스트»로 만들고 있었다(서버는 x-forwarded-host,
// 브라우저는 window.location.origin). 그래서 www 와 apex 가 각자 자기 자신을
// 정식이라고 선언했고, 구글은 둘 중 하나를 스스로 골랐다.
// JSON-LD 는 SITE_URL(apex) 로 고정돼 있어 신호까지 서로 엇갈렸다.
//
// → 운영 도메인(www 포함)으로 들어온 요청은 언제나 apex 하나로 고정한다.
//   preview(*.vercel.app)·localhost 는 요청 호스트를 그대로 써야 링크가 끊기지 않는다.
export const SITE_HOSTS = ['gongganmarket.com', 'www.gongganmarket.com'];

export function canonicalSite(host, proto = 'https') {
  const raw = String(host || '').trim();
  if (!raw) return SITE_URL;
  const bare = raw.toLowerCase().split(':')[0];
  if (SITE_HOSTS.includes(bare)) return SITE_URL;
  return `${String(proto).replace(/:$/, '')}://${raw}`;
}

// ── 사업자 정보 — 전자상거래법상 공개 의무 정보. AppFooter / 사업자정보 모달 /
//    법적고지 / JSON-LD(Organization) 가 모두 이 값을 참조한다.
export const TELECOM_SALES_NO = '2026-성남중원-0463';

export const BIZ = {
  serviceName: '공간마켓',
  legalName: '공간사이',
  ceo: '김태웅',
  bizNo: '270-53-00885',
  telecomSalesNo: TELECOM_SALES_NO,
  address: '경기도 성남시 중원구 성남대로1151번길 5, 2층 202호',
  addressLocality: '성남시 중원구',
  addressRegion: '경기도',
  addressCountry: 'KR',
  tel: '070-7954-2740',
  email: 'biz@gonggansai.com',
};

// 푸터/모달이 렌더하는 순서 그대로. (기존 AppFooter.BIZ_ROWS 를 여기로 옮긴 것)
export const BIZ_ROWS = [
  ['상호', BIZ.legalName],
  ['대표자', BIZ.ceo],
  ['사업자등록번호', BIZ.bizNo],
  ['통신판매업신고번호', BIZ.telecomSalesNo],
  ['주소', BIZ.address],
  ['고객센터', BIZ.tel],
  ['이메일', BIZ.email],
];

// ── 검색엔진 사이트 소유확인 ──────────────────────────
// 봇 user-agent 로 / 를 요청하면 index.html 이 아니라 프리렌더가 나간다.
// 그래서 소유확인 메타는 «양쪽 모두»에 같은 값으로 있어야 한다 — 한쪽만 있으면
// 확인이 조용히 풀린다. siteSeo.test.js 가 index.html 과의 일치를 검사한다.
//
// 네이버는 HTML 파일 방식(public/naver*.html)도 함께 쓰고 있다.
// 구글은 아직 미설정 — 서치콘솔에서 「HTML 태그」 방식 코드를 받아 아래에 넣으면
// index.html · 프리렌더 양쪽에 동시에 반영된다(빈 문자열이면 태그를 내지 않는다).
export const NAVER_SITE_VERIFICATION = '0b2e655f5bb483edebab3e18bc7faf4712328734';
export const GOOGLE_SITE_VERIFICATION = '';

// <meta name="..." content="..."> 목록 — 값이 빈 것은 건너뛴다.
export function verificationMetas() {
  return [
    ['naver-site-verification', NAVER_SITE_VERIFICATION],
    ['google-site-verification', GOOGLE_SITE_VERIFICATION],
  ].filter(([, v]) => v);
}

// ── 베타 모드 ─────────────────────────────────────────
// 토스페이먼츠 승인 전 무료 베타. 브라우저는 constants/release.js 의 SHOW_BETA_UI,
// 서버(프리렌더/사이트맵)는 아래 isBetaServer() 로 같은 값을 읽는다.
// 이 플래그가 true 면 "에스크로 안전결제가 현재 운영 중"이라고 쓰지 않는다 —
// 검색·답변엔진이 사실이 아닌 문장을 인용하게 두면 안 된다.
export function isBetaServer(env) {
  const e = env || (typeof process !== 'undefined' ? process.env : {}) || {};
  if (e.VITE_SHOW_BETA_UI === 'true') return true;
  return (e.VITE_APP_MODE || 'beta') === 'beta';
}

// ── 파트너(공급자) — 증빙과 수주 한도 ─────────────────
// 수수료는 입구에서 말하지 않는다(대표 2026-09-24: 「수수료를 처음부터 보여줄 필요 없다」).
// 한도는 lib/partnerTier.js 의 계단 하나에서 뽑는다 — 화면·프리렌더·AI 요약이 같은 숫자를 쓴다.
// (예전 PARTNER_GRADES 는 「프리미엄 200만원 → 2,000만원」처럼 면허 상한·보험 조건이 빠진 옛 표였다.)

export const PARTNER_LADDER = LADDER.map((r) => ({
  name: r.label.replace(/^\+ /, ''),
  limit: r.key === 'license' ? `최대 ${limitText(r.limit)}` : `${limitText(r.limit)}까지`,
}));
export const PARTNER_DEPOSIT_NOTE = '보증금은 공사 금액의 10%(시공보험이 없으면 20%)';

// 신청부터 수주까지 — 화면(PartnerLandingScreen 의 STEPS)과 «같은 4단계».
// 예전 프리렌더는 「1~2 영업일 내 연락 → 가입 승인 → 보증금 예치 등급 설정」이라는
// 옛 모델 6단계를 따로 들고 있었다. 화면은 「승인 기다림 없이 바로 입찰」이라
// 봇이 읽는 문서와 사람이 보는 화면이 정면으로 어긋나 있었다.
export const PARTNER_STEPS = [
  ['간편 가입', '업체명 · 연락처 · 영업 지역 · 공종만 적으면 1분이면 끝납니다.'],
  ['바로 입찰', `승인을 기다리지 않고 바로 공사 1건 ${PARTNER_LADDER[0].limit} 입찰합니다.`],
  ['서류를 낼수록', `사업자등록증을 내면 ${PARTNER_LADDER[1].limit}, 시공보험까지 내면 ${PARTNER_LADDER[2].limit} 한도가 커집니다.`],
  ['프리미엄 파트너', '보증금까지 증빙하면 의뢰인 화면에서 대표 시공 사진이 카드의 얼굴이 되고 금테가 붙습니다.'],
];

// ── 에스크로 단계 — SafePaymentScreen / EscrowScreen 과 동일 비율 ──
export const ESCROW_STAGES = [
  ['자재비 선지급', '계약 완료 즉시 업체에 자재비 지급', '10%'],
  ['착공 확인', '착공 사진을 고객이 확인·승인하면 지급', '20%'],
  ['중간 점검', '중간 점검 사진을 고객이 확인·승인하면 지급', '40%'],
  ['완료 확인', '완료 사진을 고객이 확인·승인하면 잔금 지급', '30%'],
];

// ─────────────────────────────────────────────────────
// FAQ — AEO(답변엔진 최적화)의 핵심.
//   질문을 그대로 두고, 답은 첫 문장에서 결론부터 말한다(인용되기 좋은 형태).
//   화면과 프리렌더가 같은 배열을 쓰므로 문구가 갈라질 수 없다.
// ─────────────────────────────────────────────────────

export function consumerFaq(beta) {
  return [
    {
      // AEO 는 «사람이 실제로 검색창에 치는 문장»을 질문으로 둬야 인용된다.
      // 「인테리어 비교견적」은 이 서비스의 핵심 검색어라 첫 질문으로 올린다.
      q: '인테리어 비교견적은 어떻게 받나요?',
      a: '어떤 공간을 어디까지 고칠지 한 번만 적으면 됩니다. 사업자등록을 확인한 업체들이 같은 조건을 보고 견적을 보내고, 금액·공정·기간을 나란히 놓고 비교합니다. 발품을 팔거나 업체마다 따로 연락할 필요가 없어요.',
    },
    { q: '견적 요청은 무료인가요?', a: '네. 견적 요청과 업체 비교는 무료입니다.' },
    {
      q: '업체마다 견적 금액이 다른데 왜 그런가요?',
      a: '같은 공사도 자재 등급·공정 범위·기간이 다르면 금액이 달라집니다. 공간마켓은 업체들이 같은 요청서를 보고 견적을 쓰기 때문에, 금액만이 아니라 무엇이 포함되고 빠졌는지를 나란히 비교할 수 있습니다.',
    },
    {
      q: '공간안전결제는 무엇인가요?',
      a: beta
        ? '공사비를 단계마다 확인한 뒤 지급하는 구조로, 토스페이먼츠 승인 뒤 열립니다. 지금은 계약서에 적은 단계대로 업체와 직접 주고받고, 계약·사진·진행 기록이 공간마켓에 남습니다.'
        : '공사비를 바로 지급하지 않고 단계 확인 후 안전하게 정산하는 구조입니다.',
    },
    {
      q: '업체는 어떻게 검증되나요?',
      a: '업체마다 확인된 증빙이 카드에 엠블럼으로 보여요 — 사업자등록·시공보험·보증금. 셋을 모두 증빙한 업체는 「프리미엄 파트너」로 표시되고, 증빙이 적은 업체는 작은 공사만 입찰할 수 있습니다. 시공 사례·고객 후기는 업체 프로필에서 직접 확인할 수 있어요.',
    },
    {
      q: '공사가 시작되면 무엇을 볼 수 있나요?',
      a: '진행 화면에 착공·중간·완료 단계가 보이고, 현장 사진과 주고받은 말이 그날짜에 붙습니다. 지금 어디까지 왔는지 연락하지 않아도 확인할 수 있어요.',
    },
    { q: '분쟁이 생기면 어떻게 하나요?', a: '계약, 채팅, 사진, 진행기록이 저장되어 프로젝트 기록을 확인할 수 있습니다.' },
  ];
}

export function partnerFaq() {
  return [
    {
      q: '가입은 어떻게 하나요?',
      a: '업체명·연락처·영업 지역·공종만 적으면 바로 시작합니다. 가입비·광고비·월정액은 없습니다.',
    },
    {
      q: '가입하면 바로 입찰할 수 있나요?',
      a: `네. 가입만으로 공사 1건 ${PARTNER_LADDER[0].limit} 입찰할 수 있어요. 사업자등록증을 내면 ${PARTNER_LADDER[1].limit}, 시공보험까지 내면 ${PARTNER_LADDER[2].limit} 커집니다.`,
    },
    {
      q: '보증금은 꼭 내야 하나요?',
      a: `아니요. 보증금은 더 큰 공사를 받고 싶을 때 거는 선택입니다. ${PARTNER_DEPOSIT_NOTE}이고, 사업자등록·시공보험과 함께 내면 「프리미엄 파트너」가 됩니다.`,
    },
    {
      q: '프리미엄 파트너는 무엇이 다른가요?',
      a: '의뢰인 화면에서 업체의 대표 시공 사진이 카드의 얼굴이 되고, 금테와 신뢰 엠블럼이 붙습니다. 사업자등록·시공보험·보증금을 모두 증빙한 업체만 될 수 있어요.',
    },
    {
      q: '예치보증금은 돌려받을 수 있나요?',
      a: '예치보증금은 가입비가 아니라 신뢰를 보증하는 예치금입니다. 공간파트너 활동 종료 시 100% 환급 가능합니다.',
    },
  ];
}

// ─────────────────────────────────────────────────────
// 페이지별 메타 — 화면(useDocumentMeta)과 프리렌더가 공유.
// 제목은 「핵심어 — 브랜드」 형태로 60자 안쪽, 설명은 160자 안쪽.
// ─────────────────────────────────────────────────────
export function pageSeo(beta) {
  return {
    '/': {
      // 예전 제목은 「공간마켓 — 좋은 공간과 좋은 이야기가 모이는 곳」이었다.
      // 브랜드 인지도가 아직 없는데 검색어가 하나도 없어서, 「인테리어 비교견적」을
      // 찾는 사람에게 걸릴 방법이 없었다(Play 스토어 제목도 같은 문제였다).
      // 제목은 검색어를 담고, 끌림은 설명이 맡는다.
      title: '인테리어 비교견적 — 공간마켓 · 집수리 리모델링 견적',
      description: beta
        ? '인테리어 견적, 여러 곳을 나란히 놓고 비교하세요. 사업자등록을 확인한 업체가 같은 조건으로 견적을 보내고, 공사 사진과 대화가 기록으로 남습니다. 견적 요청 무료.'
        : '인테리어 견적, 여러 곳을 나란히 놓고 비교하세요. 사업자등록을 확인한 업체가 같은 조건으로 견적을 보내고, 공간안전결제(에스크로)로 단계마다 확인한 뒤 지급합니다. 견적 요청 무료.',
      h1: '인테리어, 아무에게나 맡길 수 없으니까',
    },
    '/partner': {
      title: '인테리어 업체 입점 — 공간마켓 공간파트너',
      description: beta
        ? '인테리어 업체 입점 안내. 업체명·지역·공종만 적고 바로 견적 요청을 받으세요. 증빙을 낼수록 더 큰 공사를, 프리미엄 파트너까지.'
        : '공간마켓 인테리어 파트너 업체 입점 안내. 검증된 고객 매칭, 에스크로 안전정산, 시공 기록 보호까지 함께합니다.',
      h1: '광고비 없이 수주하는 공간파트너',
    },
  };
}

// ─────────────────────────────────────────────────────
// 구조화 데이터(JSON-LD) 빌더
//   Google 리치결과보다 AEO/GEO 가 주목적 — 답변엔진이 "공간마켓이 무엇이고
//   누가 운영하며 비용이 얼마인지"를 헷갈리지 않게 개체(entity)를 고정한다.
// ─────────────────────────────────────────────────────

export function organizationSchema(site = SITE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${site}/#organization`,
    name: BIZ.serviceName,
    legalName: BIZ.legalName,
    url: `${site}/`,
    logo: { '@type': 'ImageObject', url: `${site}/favicon-v3.png` },
    image: `${site}/og-space-v2.png`,
    email: BIZ.email,
    telephone: BIZ.tel,
    founder: { '@type': 'Person', name: BIZ.ceo },
    taxID: BIZ.bizNo,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BIZ.address,
      addressLocality: BIZ.addressLocality,
      addressRegion: BIZ.addressRegion,
      addressCountry: BIZ.addressCountry,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: BIZ.tel,
      email: BIZ.email,
      contactType: 'customer service',
      areaServed: 'KR',
      availableLanguage: ['ko'],
    },
  };
}

export function websiteSchema(site = SITE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${site}/#website`,
    url: `${site}/`,
    name: BIZ.serviceName,
    inLanguage: 'ko-KR',
    publisher: { '@id': `${site}/#organization` },
  };
}

// 중개 서비스 자체. 베타에서는 에스크로를 제공 목록에 넣지 않는다(아직 미운영).
export function serviceSchema(beta, site = SITE_URL) {
  const offers = [
    '무료 비교견적 요청',
    '사업자등록 확인 업체 매칭',
    '앱 내 상담 채팅',
    '시공 사진·진행 기록 보관',
  ];
  if (!beta) offers.push('공간안전결제(단계별 에스크로 정산)');

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${site}/#service`,
    name: '인테리어 비교견적 중개',
    serviceType: '인테리어·리모델링 업체 비교견적 중개',
    provider: { '@id': `${site}/#organization` },
    areaServed: { '@type': 'Country', name: '대한민국' },
    audience: [
      { '@type': 'Audience', audienceType: '인테리어·집수리를 맡기려는 개인·사업자' },
      { '@type': 'Audience', audienceType: '인테리어·리모델링 시공 업체' },
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: '공간마켓 제공 서비스',
      itemListElement: offers.map((name) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name },
        price: '0',
        priceCurrency: 'KRW',
      })),
    },
  };
}

export function faqSchema(items, site = SITE_URL, path = '/') {
  if (!Array.isArray(items) || !items.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${site}${path}#faq`,
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

export function breadcrumbSchema(trail, site = SITE_URL) {
  if (!Array.isArray(trail) || !trail.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: `${site}${path}`,
    })),
  };
}
