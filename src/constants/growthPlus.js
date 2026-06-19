// ════════════════════════════════════════════════════════════════════
// Phase 10~12 — 연속 활동(Streak) · 업적(Achievement) 정의 (표시/보상 설계 상수).
//   ⚠️ 기존 XP/레벨 계산(constants/growth.js)은 변경하지 않는다.
//   여기 XP 값은 '꾸준함·성실함을 인정하는 보상 디자인'의 표시 라벨이다.
//   철학: 경쟁이 아니라, 성실하게 꾸준히 활동하는 성장을 인정한다.
// ════════════════════════════════════════════════════════════════════

// 연속 활동 보상 단계 — 의미 있는 활동을 며칠 연속 수행했는지.
export const STREAK_TIERS = [
  { days: 3,   xp: 20 },
  { days: 7,   xp: 50 },
  { days: 30,  xp: 150 },
  { days: 100, xp: 500 },
  { days: 365, xp: 3000 },
];

export function nextStreakTier(current) {
  return STREAK_TIERS.find((t) => t.days > current) || null;
}
export function reachedStreakTiers(current) {
  return STREAK_TIERS.filter((t) => current >= t.days);
}

export function streakMessage(current) {
  if (current <= 0) return "오늘 활동하면 연속 기록이 시작됩니다.";
  if (current < 3)  return "오늘도 성장하고 있습니다.";
  if (current < 7)  return "꾸준함이 신뢰가 됩니다.";
  if (current < 30) return "성실한 기록이 쌓이고 있습니다.";
  return "오랜 성실함이 당신을 증명합니다.";
}

// 업적 — 기존 집계에서 파생(읽기 전용). test(stats) === true 이면 달성.
//   stats: { completedCount, reviewCount, recontractCount, recordCount,
//            asCount, disputeCount, bidCount, contractCount }
//   ※ 일부 지표(예: A/S 횟수)는 현재 데이터 모델에 집계가 없어, 값이 없으면
//     해당 업적은 잠금 상태로 유지된다(오탐 방지).
export const ACHIEVEMENTS = [
  { id: "first_bid",        icon: "🏅", label: "첫 견적",         desc: "첫 견적을 제출했습니다",        xp: 10,  test: (s) => (s.bidCount ?? 0) >= 1 || (s.completedCount ?? 0) >= 1 },
  { id: "first_contract",   icon: "🏅", label: "첫 계약",         desc: "첫 계약을 성사했습니다",        xp: 20,  test: (s) => (s.contractCount ?? 0) >= 1 || (s.completedCount ?? 0) >= 1 },
  { id: "first_complete",   icon: "🏅", label: "첫 프로젝트 완료", desc: "첫 프로젝트를 완료했습니다",    xp: 30,  test: (s) => (s.completedCount ?? 0) >= 1 },
  { id: "first_review",     icon: "🏅", label: "첫 후기",         desc: "첫 고객 후기를 받았습니다",     xp: 20,  test: (s) => (s.reviewCount ?? 0) >= 1 },
  { id: "first_recontract", icon: "🏅", label: "첫 재계약",       desc: "고객이 다시 찾아왔습니다",      xp: 30,  test: (s) => (s.recontractCount ?? 0) >= 1 },
  { id: "projects_10",      icon: "🏅", label: "프로젝트 10건",   desc: "프로젝트 10건을 완료했습니다",  xp: 50,  test: (s) => (s.completedCount ?? 0) >= 10 },
  { id: "projects_50",      icon: "🏅", label: "프로젝트 50건",   desc: "프로젝트 50건을 완료했습니다",  xp: 150, test: (s) => (s.completedCount ?? 0) >= 50 },
  { id: "projects_100",     icon: "🏅", label: "프로젝트 100건",  desc: "프로젝트 100건을 완료했습니다", xp: 300, test: (s) => (s.completedCount ?? 0) >= 100 },
  { id: "records_100",      icon: "🏅", label: "성실기록 100회",  desc: "성실기록 100회를 달성했습니다", xp: 150, test: (s) => (s.recordCount ?? 0) >= 100 },
  { id: "dispute_zero",     icon: "🏅", label: "분쟁 0건",        desc: "분쟁 없이 신뢰를 지켰습니다",   xp: 100, test: (s) => (s.completedCount ?? 0) >= 5 && (s.disputeCount ?? 0) === 0 },
  { id: "as_100",           icon: "🏅", label: "A/S 완료 100회",  desc: "A/S 100회를 완료했습니다",      xp: 150, test: (s) => (s.asCount ?? 0) >= 100 },
];

export function earnedAchievements(stats) {
  return ACHIEVEMENTS.filter((a) => { try { return !!a.test(stats); } catch { return false; } });
}
