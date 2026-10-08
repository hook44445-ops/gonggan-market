// ─────────────────────────────────────────────────────
// 공간랜드 사이트 전역 SEO / AEO / GEO 단일 소스
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

export const SITE_URL = 'https://gongganland.com';

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
// 2026-10-07 도메인 이전(공간랜드) — 옛 gongganmarket.com 으로 들어와도 정식은 새 주소 하나.
//   옛 주소는 앱(iOS WebView·TWA)이 새 주소를 아는 판으로 바뀐 뒤 301 로 넘긴다.
export const SITE_HOSTS = ['gongganland.com', 'www.gongganland.com', 'gongganmarket.com', 'www.gongganmarket.com'];

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
  serviceName: '공간랜드',
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

// ── 특허·상표 출원 표시 (대표 10-07) — 고객 랜딩 «주 CTA 위 배지 + 푸터 한 줄» 두 곳에만 쓴다.
// ⚠️ 등록 전이다. 반드시 «출원»을 붙인다 — «특허 받은/특허 기술/특허 등록/Patent/®» 처럼 등록으로
//    읽히는 말은 특허법 224조(허위표시) 위반. 심사청구 전이라 «심사중»도 쓰지 않는다. 상표도 ® 금지.
export const IP_FILINGS = {
  patentNo: '10-2026-0192050',
  patentFiledAt: '2026.10.07',
  patentTopic: '공사 단계별 사진을 확인하고 고객 승인 후 그 단계만큼 지급되는 방식',
  trademarkNo: '40-2026-0209520',
};
export const PATENT_LABEL = `특허출원 ${IP_FILINGS.patentNo}`;
export const PATENT_DETAIL = `${PATENT_LABEL} · ${IP_FILINGS.patentFiledAt} 출원`;
export const IP_FOOTER_LINE = `${PATENT_LABEL} · 상표출원 ${IP_FILINGS.trademarkNo}`;

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
  limit: r.key === 'license' ? `최대 ${limitText(r.limit)}` : r.limit > 0 ? `${limitText(r.limit)}까지` : '카드 보기(입찰은 사업자등록 뒤)',
}));
export const PARTNER_DEPOSIT_NOTE = '보증금은 공사 금액의 10%(시공보험이 없으면 20%)';

// 신청부터 수주까지 — 화면(PartnerLandingScreen 의 STEPS)과 «같은 4단계».
// 예전 프리렌더는 「1~2 영업일 내 연락 → 가입 승인 → 보증금 예치 등급 설정」이라는
// 옛 모델 6단계를 따로 들고 있었다. 화면은 「승인 기다림 없이 바로 입찰」이라
// 봇이 읽는 문서와 사람이 보는 화면이 정면으로 어긋나 있었다.
export const PARTNER_STEPS = [
  ['간편 가입', '업체명 · 연락처 · 영업 지역 · 공종만 적으면 1분이면 끝납니다.'],
  ['사업자등록 뒤 입찰', `가입하면 500만원까지 공사 카드를 볼 수 있고, 사업자등록증이 확인되면 공사 1건 ${PARTNER_LADDER[1].limit} 입찰합니다.`],
  ['서류를 낼수록', `사업자등록증을 내면 ${PARTNER_LADDER[1].limit}, 시공보험까지 내면 ${PARTNER_LADDER[2].limit} 한도가 커집니다.`],
  ['프리미엄 파트너', '보증금까지 증빙하면 의뢰인 화면에서 대표 시공 사진이 카드의 얼굴이 되고 금테가 붙습니다.'],
];

// ── 에스크로 단계 — SafePaymentScreen / EscrowScreen 과 동일 비율 ──
export const ESCROW_STAGES = [
  ['착공 확인', '착공 사진을 고객이 확인·승인하면 지급 — 500만원 이상 공사는 자재비 포함', '30%'],
  ['중간 점검', '500만원 이상 공사 — 중간 점검 사진을 고객이 확인·승인하면 지급', '40%'],
  ['완료 확인', '완료 사진을 고객이 확인·승인하면 잔금 지급 — 500만원 미만 공사는 70%', '30%'],
  ['공간보증 업체', '보증금을 건 업체는 500만원 이상 공사에서 결제 직후 자재비 10%를 먼저 받고, 착공 확인 때 20%', '자재비 10%'],
  ['1,000만원 초과 공사', '시공보험과 공사 구간 보증금(10% 이상)을 갖춘 업체만 맡고, 결제 직후 자재비 10% · 착공 20% · 중간 40% · 완료 30%', '보증금 10%+'],
];

// ─────────────────────────────────────────────────────
// USP 12 요약 — docs/USP-2026-10-02.md 3절의 «문제 → 공간랜드는» 을 답변엔진이 그대로 인용할 수 있는 문장으로.
//   llms.txt 가 이 배열을 쓴다. 사실만(근거 코드는 USP 문서 칸). 결제 이야기는 넣지 않는다(USP 4절).
//   SQL 202(떨어진 업체 결과 알림)는 운영 확인 전이라 넣지 않았다.
// ─────────────────────────────────────────────────────
export const USP_SUMMARY = {
  oneLine: '집 고칠 일이 생긴 사람이 동네 업체 견적을 «같은 조건»으로 받아 한 화면에서 비교하고, 계약 뒤 공사가 사진으로 남는 곳입니다. 업체에게는 가입비 없이 동네 요청에 견적을 보내고, 증빙이 쌓일수록 큰 공사를 맡는 곳입니다.',
  consumer: [
    ['무엇을 써야 할지 모른다', '공간과 고칠 곳을 고르면 30초 만에 요청서가 됩니다.'],
    ['업체마다 다른 걸 보고 견적을 쓴다', '현장 사진과 빠진 칸 안내로 모든 업체가 같은 조건을 보고 견적을 씁니다.'],
    ['견적끼리 비교가 안 된다', '금액·공사 기간·하루당 금액·주요 자재·포함 항목(부가세·철거·폐기물 처리·자재비·AS)·증빙을 업체마다 한 줄씩 나란히 놓은 비교표(최대 3곳)를 보여 줍니다. 업체가 안 적은 칸은 «안 적음»으로 보입니다.'],
    ['적정가를 모른다', '공간랜드 완공 견적이 5건 이상 쌓인 공사는 비슷한 공사의 평균 평당 금액을 견적 옆에 보여 줍니다.'],
    ['업체를 믿어도 되는지 모른다', '관리자가 서류로 확인한 증빙(사업자등록·시공보험·보증금)이 엠블럼으로 붙고, 입찰은 사업자등록이 확인된 업체에만 열리며, 증빙만큼만 큰 공사에 입찰할 수 있습니다.'],
    ['아무나와 계약할까 걱정된다', '계약은 사업자등록이 확인된 업체와만 할 수 있고(화면과 서버 모두에서 막음), 직거래를 유도하는 문구를 감지합니다.'],
    ['나중에 추가금이 붙는다', '입찰 때부터 항목마다 포함·별도를 적게 하고, 현장 확인 뒤 최종 견적서(공정·기간·사진·AS 메모)를 받으며, 추가공사는 업체가 앱에 금액을 올리고 고객이 승인해야 기록됩니다.'],
    ['공사 진행을 모르고, 끝나면 잊는다', '착공·중간·완료 사진이 단계마다 남고, 하자보수 기간이 끝나기 전에 알림이 오며, 내 집 관리 수첩에 기록이 남습니다.'],
  ],
  partner: [
    ['광고비를 내도 일이 안 온다', '가입비·광고비 없이 우리 동네 고객이 올린 요청에 견적을 보내고, 월요일마다 동네 새 요청 소식을 받습니다.'],
    ['진짜 할 사람인지 모르는 요청', '사진과 범위가 채워진 요청을 받고, 고객이 내 견적을 열면 «고객이 내 견적을 확인했어요» 알림을 받습니다.'],
    ['실력을 증명할 수단이 없다', '사업자등록·시공보험·보증금·실내건축공사업 등록을 낼수록 공사 1건 입찰 한도가 커집니다.'],
    ['입소문이 남지 않는다', '내 업체 페이지(짧은 주소)·후기 카드·QR 명함·전후 카드를 버튼 한 번으로 공유합니다.'],
  ],
};

// 운영사 공식 사이트 — Organization.sameAs · llms.txt 에서 같은 글자로(엔티티 일관성)
export const COMPANY_SITE = 'https://gonggansai.com';

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
      a: '어떤 공간을 어디까지 고칠지 고르면 30초 만에 요청서가 됩니다. 현장 사진을 붙이면 업체들이 같은 사진·같은 범위를 보고 견적을 보내고, 금액·기간·주요 자재·포함 항목을 나란히 놓고 비교합니다. 계약은 사업자등록을 확인한 업체와만 하고, 시공보험·보증금을 어디까지 냈는지도 카드에서 함께 보입니다.',
    },
    { q: '견적 요청은 무료인가요?', a: '네. 견적 요청과 업체 비교는 무료입니다.' },
    {
      q: '업체마다 견적 금액이 다른데 왜 그런가요?',
      a: '같은 공사도 자재 등급·공정 범위·기간이 다르면 금액이 달라집니다. 공간랜드는 업체들이 같은 요청서를 보고 견적을 쓰기 때문에, 금액만이 아니라 무엇이 포함되고 빠졌는지를 나란히 비교할 수 있습니다.',
    },
    {
      // USP 3·7(docs/USP-2026-10-02.md) — 본질 ② 포함 항목(bids.includes · lib/bidIncludes · 비교표 «포함 항목» 줄)
      q: '인테리어 견적을 비교할 때 무엇을 봐야 하나요?',
      a: '금액보다 먼저 포함 항목을 보세요. 부가세·철거·폐기물 처리·자재비가 포함인지 별도인지, AS는 몇 개월인지에 따라 계약 때 금액이 달라집니다. 공간랜드 비교표는 이 항목을 업체마다 한 줄로 보여 주고, 업체가 안 적은 칸은 «안 적음»으로 표시해 계약 전에 물어볼 것을 짚어 줍니다.',
    },
    {
      q: '공간안전결제는 무엇인가요?',
      a: beta
        ? '공사비를 단계마다 확인한 뒤 지급하는 구조로, 토스페이먼츠 승인 뒤 열립니다. 지금은 계약서에 적은 단계대로 업체와 직접 주고받고, 계약·사진·진행 기록이 공간랜드에 남습니다.'
        : '공사비를 바로 지급하지 않고 단계 확인 후 안전하게 정산하는 구조입니다.',
    },
    {
      // USP 5·6 — 입찰도 사업자등록 확인 뒤에 열린다(SQL 124 · partnerTier LIMITS.NONE = 0)
      q: '인테리어 업체, 믿어도 되는지 어떻게 아나요?',
      a: '업체마다 관리자가 서류로 확인한 증빙이 카드에 엠블럼으로 보여요 — 사업자등록·시공보험·보증금. 입찰은 사업자등록이 확인된 업체에만 열리고, 증빙이 적은 업체는 작은 공사만 입찰할 수 있으며, 셋을 모두 증빙한 업체는 「프리미엄 파트너」로 표시됩니다. 시공 사례·고객 후기는 업체 프로필에서 직접 확인할 수 있어요.',
    },
    {
      // USP 7 — lib/finalQuote · change_order_approve
      q: '공사 중에 추가금이 생기면 어떻게 하나요?',
      a: '현장을 본 뒤 업체가 최종 견적서(공정·기간·사진·AS 메모)를 앱으로 보냅니다. 공사 중 추가공사가 생기면 업체가 앱에 금액을 올리고, 고객이 승인해야 기록됩니다. 말로만 오간 추가금이 남지 않습니다.',
    },
    {
      // 검색 유입 — 작은 수리(스토어 06 · RequestModalBeta)
      q: '수전 교체 같은 작은 수리도 견적을 받을 수 있나요?',
      a: '네. 수전 교체·실리콘·줄눈·방문 필름처럼 작은 수리도 똑같이 요청하면 동네 집수리 업체가 견적을 보냅니다. 요청과 비교는 무료입니다.',
    },
    {
      q: '공사가 시작되면 무엇을 볼 수 있나요?',
      a: '진행 화면에 착공·중간·완료 단계가 보이고, 현장 사진과 주고받은 말이 그날짜에 붙습니다. 지금 어디까지 왔는지 연락하지 않아도 확인할 수 있어요. 끝난 뒤에는 하자보수 기간이 끝나기 전에 알림이 먼저 오고, 내 집 관리 수첩에 기록이 남습니다.',
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
      // 대표 10-07 — 사장님은 PG사에 따로 가입하지 않는다(공간랜드가 PG 계약). 결제 미개통이라 열리기 전 방식도 함께 적는다
      q: 'PG(카드 결제)사에 따로 가입해야 하나요?',
      a: '아니요. 카드 결제는 공간랜드가 PG사와 계약해 연결하는 구조라, 사장님이 PG사에 따로 가입하거나 심사를 받을 필요가 없습니다. 결제가 열리기 전에는 계약서에 적은 단계대로 고객과 직접 주고받습니다.',
    },
    {
      // USP 9·10(docs/USP-2026-10-02.md) — 171 월요일 동네 요청 · 173 «고객이 내 견적을 확인했어요»
      q: '인테리어 업체가 광고비 없이 일감을 얻을 수 있나요?',
      a: '네. 광고비를 먼저 쓰지 않고, 우리 동네 고객이 올린 견적 요청에 견적을 보냅니다. 월요일마다 동네 새 요청 소식이 오고, 고객이 내 견적을 열어 보면 «고객이 내 견적을 확인했어요» 알림이 옵니다. 입찰은 사업자등록증 확인 뒤에 열립니다.',
    },
    {
      q: '가입하면 바로 입찰할 수 있나요?',
      a: `가입하면 500만원까지 공사 카드를 볼 수 있고, 입찰은 사업자등록증을 확인한 뒤에 열려요(홈택스에서 당일 발급). 사업자등록증이면 공사 1건 ${PARTNER_LADDER[1].limit}, 시공보험까지 내면 ${PARTNER_LADDER[2].limit} 입찰할 수 있어요.`,
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
      // USP 12 — /p/<slug> · ReviewShareCard · BeforeAfterCard · lib/qr
      q: '끝낸 공사를 홍보에 쓸 수 있나요?',
      a: '네. 내 업체 페이지(짧은 주소)와 후기 카드·전후 카드·QR 명함을 버튼 한 번으로 공유할 수 있습니다. 후기 카드에는 업체 페이지 QR이 들어가 단톡방·명함·가게 앞 어디든 붙일 수 있어요.',
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
      // 예전 제목은 「공간랜드 — 좋은 공간과 좋은 이야기가 모이는 곳」이었다.
      // 브랜드 인지도가 아직 없는데 검색어가 하나도 없어서, 「인테리어 비교견적」을
      // 찾는 사람에게 걸릴 방법이 없었다(Play 스토어 제목도 같은 문제였다).
      // 제목은 검색어를 담고, 끌림은 설명이 맡는다.
      //
      // ⚠️ 사업자등록을 «어디에» 붙이는지가 중요하다(2026-09-30 두 번 고침).
      //    ✅ 계약·결제 — 「계약은 사업자등록을 확인한 업체와만」. 사실이고 코드로 막혀 있다
      //       (contractGate: company.verified 아니면 결제 화면·승인 서버 둘 다 거절 · A안 대표 확정 09-24).
      //    (10-02) 견적·입찰 — 예전엔 «가입만 한 업체도 300만원까지 입찰»이라 막았지만, SQL 124(09-25)부터
      //       사업자등록 확인 전엔 입찰이 잠긴다(partnerTier LIMITS.NONE = 0) — 지금은 견적 쪽에 붙여도 사실이다.
      //    이 문장은 title·description·OG·프리렌더·llms.txt 에 모두 실려 색인된다.
      //    (10-02) 설명은 USP 최신판(docs/USP-2026-10-02.md)·광고 영상과 같은 말 — «같은 조건 · 나란히 · 포함 항목».
      //    h1 은 화면(LandingScreen 히어로)과 같은 문장 — 봇과 사람이 다른 제목을 보지 않게(Google «구조화 데이터·텍스트가 화면과 같게»).
      title: '인테리어 비교견적 — 공간랜드 · 집수리 리모델링 견적',
      description: beta
        ? '인테리어 견적, 같은 조건으로 받아 나란히 비교하세요. 부가세·철거가 포함인지까지 한 표에 보입니다. 계약은 사업자등록을 확인한 업체와만, 공사 사진과 대화는 기록으로 남습니다. 견적 요청 무료.'
        : '인테리어 견적, 여러 곳을 나란히 놓고 비교하세요. 계약은 사업자등록을 확인한 업체와만 하고, 공간안전결제(단계별 안전지급)로 단계마다 확인한 뒤 지급합니다. 견적 요청 무료.',
      h1: '인테리어, 비교는 쉽게 공사는 품격 있게',
    },
    '/partner': {
      title: '인테리어 업체 입점 — 공간랜드 공간파트너',
      description: beta
        ? '인테리어 업체 입점 안내. 광고비 없이 우리 동네 견적 요청을 받으세요. 파트너 입점 1분, 사업자등록 확인 뒤 입찰 — 증빙을 낼수록 더 큰 공사를, 프리미엄 파트너까지.'
        : '공간랜드 인테리어 파트너 업체 입점 안내. 검증된 고객 매칭, 단계별 안전지급, 시공 기록 보호까지 함께합니다.',
      h1: '광고비 없이 수주하는 공간파트너',
    },
    // ── 공개 페이지(10-02) — 화면(useDocumentMeta)과 봇 프리렌더가 같은 값. 글은 content/publicPages.js.
    //    결제가 열리기 전(beta)에는 «정식 오픈 후 제공 예정»을 제목·설명 «맨 앞»에 — 구글 AI 개요가 «예치할 수 있다»고 답했다.
    '/safe-payment': beta
      ? { title: '공간안전결제 안내(정식 오픈 후 제공 예정) — 공간랜드',
          description: '공간안전결제는 정식 오픈 후 제공 예정입니다. 지금은 계약서에 적은 단계대로 업체와 직접 진행합니다. 오픈 뒤 적용될 단계별 안전지급 구조, 서비스 제공기간, 환불 정책을 안내합니다.' }
      : { title: '공간안전결제 안내 — 공간랜드',
          description: '공간랜드 공간안전결제 상품 안내입니다. 시공 대금의 단계별 안전지급 구조, 서비스 제공기간, 환불 정책을 확인할 수 있습니다.' },
    '/tokens': beta
      ? { title: '공간토큰 안내(정식 오픈 후 판매 예정) — 공간랜드',
          description: '공간토큰은 정식 오픈 후 판매 예정이며, 지금은 라운지 미션으로 무료로 받을 수 있습니다. 패키지별 가격, 서비스 제공기간, 환불 정책을 안내합니다.' }
      : { title: '공간토큰 구매 — 공간랜드',
          description: '공간라운지에서 사용하는 공간토큰 상품 안내입니다. 패키지별 가격, 서비스 제공기간, 환불 정책을 확인할 수 있습니다.' },
    '/privacy': { title: '공간랜드 개인정보처리방침', description: '공간랜드 개인정보처리방침입니다. 수집 항목, 이용 목적, 보관 기간을 안내합니다.' },
    '/terms': { title: '공간랜드 이용약관', description: '공간랜드 서비스 이용약관입니다. 견적·계약·공간안전결제(단계별 안전지급) 이용 조건을 안내합니다.' },
    '/refund': { title: '공간랜드 환불 정책', description: '공간랜드 환불 정책입니다. 공간토큰(디지털 상품)과 공간안전결제(단계별 안전지급)의 청약철회·환불 기준을 안내합니다.' },
    '/download': { title: '공간랜드 시작하기 — 웹에서 바로 · 앱 사전체험판',
      description: '공간랜드는 설치 없이 웹에서 바로 쓸 수 있어요. 안드로이드 앱은 비공개 사전체험판 참여 후 Play 스토어에서 받을 수 있습니다.' },
  };
}

// ─────────────────────────────────────────────────────
// 구조화 데이터(JSON-LD) 빌더
//   Google 리치결과보다 AEO/GEO 가 주목적 — 답변엔진이 "공간랜드가 무엇이고
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
    image: `${site}/og-space-v3.png`,
    sameAs: [COMPANY_SITE],
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
    '사업자등록 확인 업체와 계약',
    '앱 내 상담 채팅',
    '시공 사진·진행 기록 보관',
  ];
  if (!beta) offers.push('공간안전결제(단계별 안전지급)');

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
      name: '공간랜드 제공 서비스',
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
