// ─────────────────────────────────────────────────────
// 공간보증(Guarantee) 등급/상태 메타 — migration 068.
// company_status(입찰 게이트)·badge·deposit_amount 와 독립. 표시/관리용.
// ─────────────────────────────────────────────────────

// 등급 5단계(고정). amount = 예치금(만원). 선택 시 자동 계산은 서버(068 RPC)가 권위.
export const GUARANTEE_GRADES = [
  { key: "BASIC",     emoji: "🥉", label: "베이직",   amount: 50,   color: "#A0714F" },
  { key: "STANDARD",  emoji: "🥈", label: "스탠다드", amount: 100,  color: "#5A6370" },
  { key: "PREMIUM",   emoji: "🥇", label: "프리미엄", amount: 200,  color: "#B8860B" },
  { key: "MASTER",    emoji: "💎", label: "마스터",   amount: 500,  color: "#0090AA" },
  { key: "SIGNATURE", emoji: "👑", label: "시그니처", amount: 1000, color: "#7C3AED" },
];

export const GUARANTEE_GRADE_MAP = Object.fromEntries(GUARANTEE_GRADES.map((g) => [g.key, g]));

// 만원 → 원 표기.
export const wonFromManwon = (manwon) =>
  (Number(manwon || 0) * 10000).toLocaleString("ko-KR") + "원";

// 상태 FSM 메타(표시용).
export const GUARANTEE_STATUS_META = {
  NONE:              { label: "미가입",       step: 0, color: "#7A8A7E", bg: "#F2EBDA" },
  PENDING_DEPOSIT:   { label: "입금 대기",    step: 1, color: "#B08040", bg: "#FBF5E8" },
  DEPOSIT_CONFIRMED: { label: "입금 확인",    step: 2, color: "#2E5F4B", bg: "#EAF2EE" },
  AWAITING_APPROVAL: { label: "승인 대기",    step: 3, color: "#7C3AED", bg: "#F5F0FF" },
  ACTIVE:            { label: "공간보증 활성", step: 4, color: "#1D3D2F", bg: "#E8F0EC" },
};

// 무인 자동화 단계(마이페이지 진행 표시용).
export const GUARANTEE_FLOW_STEPS = [
  { key: "select",  label: "등급 선택" },
  { key: "deposit", label: "예치금 입금" },
  { key: "confirm", label: "입금 확인" },
  { key: "approve", label: "관리자 승인" },
  { key: "active",  label: "배지 활성" },
];

// 배지 노출 조건: badge_visible=true AND status='ACTIVE'.
export const isGuaranteeBadgeVisible = (company) =>
  !!company &&
  company.guarantee_badge_visible === true &&
  company.guarantee_status === "ACTIVE" &&
  !!company.guarantee_grade;
