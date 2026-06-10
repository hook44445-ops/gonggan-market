// ── 결제 제공자(provider) / 결제수단(payment_method) 단일 정의 ──────────────
// 화면 컴포넌트에 Toss 전용 값이 흩어지지 않도록 여기서 한 번만 정의한다.
// 실제 연동: TOSS 만. NICE/KB 는 구조(adapter) placeholder.

export const PROVIDERS = {
  TOSS: { id: "TOSS", label: "토스페이먼츠", active: true },
  NICE: { id: "NICE", label: "나이스페이먼츠", active: false },  // placeholder
  KB:   { id: "KB",   label: "KB국민",        active: false },  // placeholder
};

// 현재 실연동 제공자 — 결제는 전부 이 provider 로 처리.
export const ACTIVE_PROVIDER = "TOSS";

// 결제수단. available=true 만 실제 결제 진행. 카카오/네이버페이는 가맹 승인 후 별도 PR.
// tossMethod: TossPayments.requestPayment 의 method 인자(한글). 미지원 수단은 null.
export const PAYMENT_METHODS = [
  { id: "VIRTUAL_ACCOUNT", icon: "📋", label: "가상계좌",      desc: "가장 저렴한 결제수단",           available: true,  tossMethod: "가상계좌", badge: "🏆 추천" },
  { id: "TRANSFER",        icon: "🏦", label: "계좌이체",      desc: "실시간 계좌이체",               available: true,  tossMethod: "계좌이체" },
  { id: "CARD",            icon: "💳", label: "신용/체크카드", desc: "할부 결제 가능",                available: true,  tossMethod: "카드" },
  { id: "KAKAO_PAY",       icon: "💛", label: "카카오페이",    desc: "간편결제 · 가맹 승인 후 제공",   available: false, tossMethod: null },
  { id: "NAVER_PAY",       icon: "💚", label: "네이버페이",    desc: "간편결제 · 가맹 승인 후 제공",   available: false, tossMethod: null },
];

// 준비중 수단 클릭 시 안내 문구.
export const COMING_SOON_MESSAGE = "간편결제는 가맹 승인 후 제공될 예정입니다.";

// fee_rules(payment_fee_rules) 미적용·미조회 시 최후 폴백 비율.
// ⚠️ 하드코딩된 요금이 아니라 "규칙 미조회 시 안전 폴백"이다. 실제 요율은 DB 규칙이 우선.
export const DEFAULT_CUSTOMER_FEE_RATE = 0.037;

export const isMethodAvailable = (id) =>
  PAYMENT_METHODS.find((m) => m.id === id)?.available === true;

export const getMethodMeta = (id) =>
  PAYMENT_METHODS.find((m) => m.id === id) ?? null;
