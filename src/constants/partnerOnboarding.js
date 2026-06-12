// ─────────────────────────────────────────────────────
// 업체 무인 온보딩 FSM v2 메타 — migration 069 (partner_leads).
// 068 constants/guarantee.js(로그인 업체 전용)와 독립. 비로그인 신청자 온보딩 표시/계산용.
// ─────────────────────────────────────────────────────

// 등급 기본 예치금(만원). 등급 라벨/이모지는 068 GUARANTEE_GRADES 와 동일 값.
export const ONBOARDING_GRADES = [
  { key: "BASIC",     emoji: "🥉", label: "베이직",   base: 50,   color: "#A0714F" },
  { key: "STANDARD",  emoji: "🥈", label: "스탠다드", base: 100,  color: "#5A6370" },
  { key: "PREMIUM",   emoji: "🥇", label: "프리미엄", base: 200,  color: "#B8860B" },
  { key: "MASTER",    emoji: "💎", label: "마스터",   base: 500,  color: "#0090AA" },
  { key: "SIGNATURE", emoji: "👑", label: "시그니처", base: 1000, color: "#7C3AED" },
];

export const ONBOARDING_GRADE_MAP = Object.fromEntries(ONBOARDING_GRADES.map((g) => [g.key, g]));

// 예치금 계산(만원). 보험 미가입 2배 — 서버(069 RPC)가 권위, 여기선 표시용 미러.
export const calcDepositManwon = (gradeKey, insuranceYn) => {
  const base = ONBOARDING_GRADE_MAP[gradeKey]?.base ?? 0;
  return base * (insuranceYn ? 1 : 2);
};

// 만원 → 원 표기.
export const wonFromManwon = (manwon) =>
  (Number(manwon || 0) * 10000).toLocaleString("ko-KR") + "원";

// 온보딩 상태 FSM 메타(표시용). 069 onboarding_status 와 1:1.
export const ONBOARDING_STATUS_META = {
  PENDING_DOCS:      { label: "기본정보 접수",  step: 1, color: "#7A8A7E", bg: "#F2EBDA" },
  PENDING_DEPOSIT:   { label: "입금 대기",     step: 2, color: "#B08040", bg: "#FBF5E8" },
  AWAITING_APPROVAL: { label: "승인 대기",     step: 3, color: "#7C3AED", bg: "#F5F0FF" },
  APPROVED:          { label: "승인 완료",     step: 4, color: "#1D3D2F", bg: "#E8F0EC" },
  REJECTED:          { label: "반려",          step: 0, color: "#B23B3B", bg: "#FBEAEA" },
};

// 입금안내 — Mock(실제 토스/가상계좌/송금 없음). 069 RPC 가 저장하는 값과 동일.
// TODO(toss): 실결제 도입 시 가상계좌 발급 RPC 로 대체. 현재는 고정 표시 계좌.
export const DEPOSIT_MOCK = {
  bank:    "국민은행",
  account: "123456-78-123456",
  owner:   "공간마켓",
};
