// ─────────────────────────────────────────────────────
// 공간마켓 사이트 전역 SEO / AEO / GEO 단일 소스
//
// 왜 한 파일인가:
//   · 화면(React)과 봇 프리렌더(api/prerender.js)가 **같은 문장**을 써야 한다.
//     봇에게만 다른 내용을 보이면 클로킹(cloaking)이 되어 색인에서 불이익을 받는다.
//   · 그래서 FAQ·사업자정보·수수료 같은 "사실"은 여기 한 곳에만 둔다.
//
// ⚠️ 순수 JS 전용 — React / import.meta / DOM 을 쓰지 않는다.
//    Vercel 서버리스(api/*)에서도 그대로 import 되기 때문이다.
//    베타 여부는 호출자가 인자로 넘긴다(브라우저는 SHOW_BETA_UI, 서버는 isBetaServer()).
// ─────────────────────────────────────────────────────

export const SITE_URL = 'https://gongganmarket.com';

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
  email: 'gongganmarket.biz@gmail.com',
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

// ── 파트너(공급자) 비용 구조 ──────────────────────────
export const PARTNER_FEE_RATE = '4.4%';
export const PARTNER_FEE_NOTE = '계약이 성사된 프로젝트에만 부과(VAT 포함)';

export const PARTNER_GRADES = [
  { name: '베이직', deposit: '50만 원', limit: '500만 원까지' },
  { name: '스탠다드', deposit: '100만 원', limit: '1,000만 원까지' },
  { name: '프리미엄', deposit: '200만 원', limit: '2,000만 원까지' },
  { name: '엔터프라이즈', deposit: '500만 원', limit: '5,000만 원까지' },
  { name: '시그니처', deposit: '1,000만 원', limit: '1억 원까지' },
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
    { q: '견적 요청은 무료인가요?', a: '네. 견적 요청과 업체 비교는 무료입니다.' },
    {
      q: '공간안전결제는 무엇인가요?',
      a: beta
        ? '공사비를 단계마다 확인한 뒤 지급하는 구조로, 토스페이먼츠 승인 뒤 열립니다. 지금은 계약서에 적은 단계대로 업체와 직접 주고받고, 계약·사진·진행 기록이 공간마켓에 남습니다.'
        : '공사비를 바로 지급하지 않고 단계 확인 후 안전하게 정산하는 구조입니다.',
    },
    {
      q: '업체는 어떻게 검증되나요?',
      a: '사업자등록증을 확인한 업체만 견적을 보낼 수 있어요. 시공보험·시공 사례·고객 후기는 업체 프로필에서 직접 확인할 수 있습니다.',
    },
    { q: '분쟁이 생기면 어떻게 하나요?', a: '계약, 채팅, 사진, 진행기록이 저장되어 프로젝트 기록을 확인할 수 있습니다.' },
  ];
}

export function partnerFaq() {
  return [
    {
      q: '가입할 때 비용이 드나요?',
      a: '가입비는 없습니다. 광고비·월정액도 없으며, 견적 요청 수신도 무료입니다. 비용은 계약이 실제로 성사된 프로젝트에만 발생합니다.',
    },
    {
      q: '수수료는 얼마인가요?',
      a: `계약이 성사된 프로젝트에 한해 ${PARTNER_FEE_RATE}(VAT 포함)의 이용수수료만 부과됩니다. 그 외 어떤 명목의 비용도 없습니다.`,
    },
    {
      q: '수주에 실패하면 비용이 나가나요?',
      a: '아니요. 견적이 채택되지 않거나 수주에 실패한 경우에는 어떤 비용도 청구되지 않습니다. 부담 없이 견적에 참여하세요.',
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
      title: '공간마켓 — 좋은 공간과 좋은 이야기가 모이는 곳',
      description: beta
        ? '믿을 수 있는 인테리어 업체 비교부터 계약, 공사 사진·진행 기록까지. 집·상가·리모델링을 한곳에서 진행하세요.'
        : '믿을 수 있는 인테리어 업체 비교부터 계약, 에스크로 안전결제, 시공 기록까지. 집·상가·리모델링을 안전하게 진행하세요.',
      h1: '인테리어, 아무에게나 맡길 수 없으니까',
    },
    '/partner': {
      title: '공간마켓 파트너(업체) 입점 안내',
      description: beta
        ? `인테리어 업체 입점 안내. 광고비·월정액 0원, 계약 성사 시 ${PARTNER_FEE_RATE} 수수료만. 검증된 의뢰인 견적 요청을 무료로 받아보세요.`
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
