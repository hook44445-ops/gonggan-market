// ════════════════════════════════════════════════════════════════════
// 업체 성장 시스템 (Level + XP) — 상수 / 계산 단일 소스.
//   · 철학: 비교·경쟁이 아닌 성실·정직을 통한 성장. 레벨은 누적 경험의 표현.
//   · XP 는 절대 감소하지 않으며, 레벨도 감소하지 않는다.
//   · 공간온도(신뢰도)와는 완전히 별개의 시스템이다(이 파일은 온도를 다루지 않음).
//   · 본 단계(Phase 1)는 UI 표시 전용 — DB 스키마/쓰기 없음.
//     XP 는 대시보드가 이미 보유한 집계(완료/리뷰/진행/공간보증)에서 파생(읽기 전용)한다.
// ════════════════════════════════════════════════════════════════════

// XP 지급 기준 — 관리자가 추후 조정 가능하도록 상수화.
export const XP_AWARDS = {
  PROJECT_CREATE:     20, // 프로젝트 생성
  SITE_VISIT_GPS:     10, // 현장 방문(GPS)
  CONSTRUCTION_START: 15, // 착공 인증
  MID_INSPECTION:     15, // 중간점검
  COMPLETION:         20, // 완료 인증
  PROJECT_PHOTO:      10, // 프로젝트 사진 등록
  CUSTOMER_REVIEW:    20, // 고객 리뷰 등록
  AS_COMPLETE:        20, // A/S 완료
  GUARANTEE_JOIN:     30, // 공간보증 참여
};

// 완료 프로젝트 1건이 거치는 생애주기 XP (생성+현장방문+착공+중간+완료).
export const XP_PER_COMPLETED_PROJECT =
  XP_AWARDS.PROJECT_CREATE + XP_AWARDS.SITE_VISIT_GPS + XP_AWARDS.CONSTRUCTION_START +
  XP_AWARDS.MID_INSPECTION + XP_AWARDS.COMPLETION; // = 80

export const MAX_LEVEL = 10;
export const PROGRESS_BLOCKS = 10;

// LV(n) 도달에 필요한 누적 XP. index 0 = LV1(0). 완만한 성장 곡선.
//   LV1: 0~299 / LV2: 300~699 / … / LV10: 9000+
export const LEVEL_THRESHOLDS = [0, 300, 700, 1200, 1900, 2800, 3900, 5300, 7000, 9000];

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

// 대시보드 보유 집계에서 누적 XP 파생 (Phase 1, 읽기 전용 추정 — DB 쓰기 없음).
export function computeCompanyXp({
  completedCount = 0, reviewCount = 0, activeCount = 0, portfolioCount = 0, hasGuarantee = false,
} = {}) {
  let xp = 0;
  xp += Math.max(0, completedCount) * XP_PER_COMPLETED_PROJECT;
  xp += Math.max(0, reviewCount)    * XP_AWARDS.CUSTOMER_REVIEW;
  xp += Math.max(0, activeCount)    * XP_AWARDS.PROJECT_CREATE;   // 진행중 프로젝트는 생성 XP만 반영
  xp += Math.max(0, portfolioCount) * XP_AWARDS.PROJECT_PHOTO;
  if (hasGuarantee) xp += XP_AWARDS.GUARANTEE_JOIN;
  return xp;
}
