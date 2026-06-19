// ════════════════════════════════════════════════════════════════════
// 업체 성장 시스템 (Level + XP) — 상수 / 계산 단일 소스.
//   · 철학: 비교·경쟁이 아닌 성실·정직을 통한 성장. 레벨은 누적 경험의 표현.
//   · XP 는 절대 감소하지 않으며, 레벨도 감소하지 않는다.
//   · 공간온도(신뢰도)와는 완전히 별개의 시스템이다(이 파일은 온도를 다루지 않음).
//   · 본 단계(Phase 1)는 UI 표시 전용 — DB 스키마/쓰기 없음.
//     XP 는 대시보드가 이미 보유한 집계(완료/리뷰/진행/공간보증)에서 파생(읽기 전용)한다.
// ════════════════════════════════════════════════════════════════════

// XP 지급 기준 (Phase 2) — 관리자가 추후 조정 가능하도록 상수화.
//   ※ XP 는 단순 이벤트가 아니라 Space OS 분석 결과로 지급된다(상세: constants/spaceOs.js).
export const XP_AWARDS = {
  // 성실견적 분석 결과 XP 범위 (Space OS analyzeEstimate 가 점수로 산출)
  ESTIMATE_MIN:       30,
  ESTIMATE_MAX:      150,
  // 프로젝트 단계 XP
  SITE_VISIT:         30, // 현장방문(GPS + 사진)
  MEASUREMENT:        30, // 실측(실측정보 + 메모)
  E_CONTRACT:         50, // 전자계약
  ESCROW_PAY:         40, // 에스크로 결제
  CONSTRUCTION_START: 40, // 착공(GPS + 사진)
  MID_INSPECTION:     40, // 중간점검(GPS + 사진)
  COMPLETION:         50, // 완료(GPS + 사진)
  CUSTOMER_REVIEW:    30, // 고객 리뷰
  AS_COMPLETE:        40, // A/S 완료
  GUARANTEE_JOIN:     30, // 공간보증 참여
};

// 완료 프로젝트 1건이 거치는 생애주기 XP (현장방문→실측→계약→결제→착공→중간→완료).
export const XP_PER_COMPLETED_PROJECT =
  XP_AWARDS.SITE_VISIT + XP_AWARDS.MEASUREMENT + XP_AWARDS.E_CONTRACT + XP_AWARDS.ESCROW_PAY +
  XP_AWARDS.CONSTRUCTION_START + XP_AWARDS.MID_INSPECTION + XP_AWARDS.COMPLETION; // = 280

export const MAX_LEVEL = 10;
export const PROGRESS_BLOCKS = 10;

// 업체 메인카드 '성실기록' 지표 라벨 — 추후 "신뢰기록" 등으로 변경 가능하도록 상수화.
export const RECORD_METRIC_LABEL = "성실기록";

// LV(n) 도달에 필요한 누적 XP. index 0 = LV1(0). 완만한 성장 곡선.
//   LV1: 0~999 / … / LV10: 27000+  (Phase 2 단계 XP 상향에 맞춘 재보정)
export const LEVEL_THRESHOLDS = [0, 900, 2100, 3600, 5700, 8400, 11700, 15900, 21000, 27000];

// 누적 XP → 레벨 / 현재 레벨 진행도 정보.
//   filledBlocks: 현재 레벨 진행률을 10칸으로 환산(레벨 표시가 아닌 진행도).
//   xpToNext: 다음 레벨까지 남은 XP. 최고 레벨이면 0.
export function levelInfo(totalXp) {
  const xp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  level = Math.min(level, MAX_LEVEL);

  const curBase  = LEVEL_THRESHOLDS[level - 1];
  const nextBase = level >= MAX_LEVEL ? null : LEVEL_THRESHOLDS[level];
  const span = nextBase != null ? (nextBase - curBase) : 0;
  const into = xp - curBase;
  const progress = nextBase != null ? Math.min(1, Math.max(0, into / span)) : 1;
  const filledBlocks = nextBase != null
    ? Math.min(PROGRESS_BLOCKS, Math.max(0, Math.round(progress * PROGRESS_BLOCKS)))
    : PROGRESS_BLOCKS;
  const xpToNext = nextBase != null ? Math.max(0, nextBase - xp) : 0;

  return { level, totalXp: xp, progress, filledBlocks, xpToNext, isMax: level >= MAX_LEVEL };
}

// 대시보드 보유 집계에서 누적 XP 파생 (읽기 전용 추정 — DB 쓰기 없음).
export function computeCompanyXp({
  completedCount = 0, reviewCount = 0, activeCount = 0, hasGuarantee = false,
} = {}) {
  let xp = 0;
  xp += Math.max(0, completedCount) * XP_PER_COMPLETED_PROJECT;
  xp += Math.max(0, reviewCount)    * XP_AWARDS.CUSTOMER_REVIEW;
  xp += Math.max(0, activeCount)    * XP_AWARDS.SITE_VISIT;   // 진행중 프로젝트는 최소 현장방문 단계 가정
  if (hasGuarantee) xp += XP_AWARDS.GUARANTEE_JOIN;
  return xp;
}
