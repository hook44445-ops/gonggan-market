// ════════════════════════════════════════════════════════════════════
// notify.js — 진행 중심 알림 구조 (충성도 5/6)
//   광고성 알림이 아닌, 진행감을 주는 알림으로 자연스러운 재방문 유도.
//
//   티어(4단계)
//     1단계 진행(PROGRESS) — 견적/계약/에스크로. 즉시 · 제한 없음(최우선)
//     2단계 관심(INTEREST) — 관심지역/저장업체 소식. 당일 · 하루 1개
//     3단계 신뢰(TRUST)    — 공간온도/후기요청/재계약. 완료 후
//     4단계 라운지(LOUNGE) — 댓글/인기글/지역글. 하루 1개
//
//   발송 규칙
//     · 하루 최대 알림 3개 (진행 알림은 제외 · 무제한)
//     · 관심/라운지 알림은 각각 하루 1개
//     · 광고성 알림 금지
//     · 밤 10시~아침 8시 발송 금지 (진행 알림 제외)
// ════════════════════════════════════════════════════════════════════
import { createNotification, getNotifications } from "../lib/supabase";

export const NOTIF_TIER = {
  PROGRESS: "progress",
  INTEREST: "interest",
  TRUST:    "trust",
  LOUNGE:   "lounge",
};

// 알림 type → 티어/아이콘/우선순위. 아이콘은 NotifPanel 의 NOTIF_META 와 합쳐 사용.
export const NOTIF_META = {
  // ── 1단계 진행 ──────────────────────────────────────────
  BID_RECEIVED:          { tier: NOTIF_TIER.PROGRESS, icon: "📋", priority: "HIGH" },
  BID_ALL_IN:            { tier: NOTIF_TIER.PROGRESS, icon: "📋", priority: "HIGH" },
  QUOTE_DEADLINE:        { tier: NOTIF_TIER.PROGRESS, icon: "⏰", priority: "HIGH" },
  FINAL_QUOTE_ARRIVED:   { tier: NOTIF_TIER.PROGRESS, icon: "📋", priority: "HIGH" },
  SITE_VISIT_REQUESTED:  { tier: NOTIF_TIER.PROGRESS, icon: "📐", priority: "HIGH" },
  CONTRACT_CREATED:      { tier: NOTIF_TIER.PROGRESS, icon: "📄", priority: "HIGH" },
  CONTRACT_CONFIRMED:    { tier: NOTIF_TIER.PROGRESS, icon: "📄", priority: "HIGH" },
  CONSTRUCTION_STARTED:  { tier: NOTIF_TIER.PROGRESS, icon: "🏗️", priority: "HIGH" },
  ESCROW_PAID_30:        { tier: NOTIF_TIER.PROGRESS, icon: "🛡️", priority: "HIGH" },
  ESCROW_MID_CHECK:      { tier: NOTIF_TIER.PROGRESS, icon: "🛡️", priority: "HIGH" },
  CONSTRUCTION_DONE:     { tier: NOTIF_TIER.PROGRESS, icon: "🎉", priority: "HIGH" },
  SETTLEMENT_DONE:       { tier: NOTIF_TIER.PROGRESS, icon: "🎉", priority: "HIGH" },
  COMPANY_SELECTED:      { tier: NOTIF_TIER.PROGRESS, icon: "🤝", priority: "HIGH" },
  // ── 2단계 관심 ──────────────────────────────────────────
  REGION_NEW_COMPANY:    { tier: NOTIF_TIER.INTEREST, icon: "📍", priority: "NORMAL" },
  SAVED_NEW_PORTFOLIO:   { tier: NOTIF_TIER.INTEREST, icon: "🖼️", priority: "NORMAL" },
  REGION_ACTIVITY:       { tier: NOTIF_TIER.INTEREST, icon: "📍", priority: "NORMAL" },
  SAVED_TEMP_UP:         { tier: NOTIF_TIER.INTEREST, icon: "🌡️", priority: "NORMAL" },
  // ── 3단계 신뢰 ──────────────────────────────────────────
  TEMP_UP:               { tier: NOTIF_TIER.TRUST, icon: "🌡️", priority: "NORMAL" },
  REVIEW_REQUEST:        { tier: NOTIF_TIER.TRUST, icon: "⭐", priority: "NORMAL" },
  REVIEW_REQUEST_FOLLOWUP: { tier: NOTIF_TIER.TRUST, icon: "⭐", priority: "NORMAL" },
  RECONTRACT:            { tier: NOTIF_TIER.TRUST, icon: "🔄", priority: "NORMAL" },
  TRUST_MILESTONE:       { tier: NOTIF_TIER.TRUST, icon: "🏆", priority: "NORMAL" },
  // ── 4단계 라운지 ────────────────────────────────────────
  LOUNGE_COMMENT:        { tier: NOTIF_TIER.LOUNGE, icon: "💬", priority: "LOW" },
  LOUNGE_WEEKLY_HOT:     { tier: NOTIF_TIER.LOUNGE, icon: "🔥", priority: "LOW" },
  LOUNGE_REGION_REVIEW:  { tier: NOTIF_TIER.LOUNGE, icon: "🏘️", priority: "LOW" },
};

export const tierOf = (type) => NOTIF_META[type]?.tier ?? NOTIF_TIER.PROGRESS;
export const priorityOf = (type) => NOTIF_META[type]?.priority ?? "NORMAL";

// 밤 10시 ~ 아침 8시 발송 금지 구간
export const isQuietHours = (date = new Date()) => {
  const h = date.getHours();
  return h >= 22 || h < 8;
};

const DAILY_TOTAL_CAP = 3; // 진행 알림 제외

const isToday = (iso, ref = new Date()) => {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear()
    && d.getMonth() === ref.getMonth()
    && d.getDate() === ref.getDate();
};

// 발송 규칙을 적용한 알림 생성.
//   existing: 수신자의 기존 알림 배열(있으면 중복/한도 판정에 사용 — DB 조회 절약)
//   반환: { sent: boolean, skipped?: string }
export async function sendTieredNotification({
  userId, type, title, message, relatedId, relatedType, existing = null, dedupe = false,
}) {
  if (!userId || !type) return { sent: false, skipped: "no_target" };
  const tier     = tierOf(type);
  const priority = priorityOf(type);

  // 중복 방지가 필요한 알림(단계 알림·후기 요청 등)은 기존 알림을 한 번 조회
  let prior = existing;
  if ((dedupe || tier !== NOTIF_TIER.PROGRESS) && prior == null) {
    const { data } = await getNotifications(userId);
    prior = data ?? [];
  }
  prior = prior ?? [];

  if (dedupe && relatedId != null) {
    if (prior.some(n => n.type === type && n.related_id === relatedId)) {
      return { sent: false, skipped: "duplicate" };
    }
  }

  // 1단계 진행 알림 — 즉시 · 제한 없음 (야간/한도 무시)
  if (tier !== NOTIF_TIER.PROGRESS) {
    // 밤 10시 ~ 아침 8시 발송 금지
    if (isQuietHours()) return { sent: false, skipped: "quiet_hours" };

    const todays = prior.filter(n => isToday(n.created_at) && tierOf(n.type) !== NOTIF_TIER.PROGRESS);
    // 하루 전체 한도
    if (todays.length >= DAILY_TOTAL_CAP) return { sent: false, skipped: "daily_cap" };
    // 관심/라운지 알림은 각각 하루 1개
    if (tier === NOTIF_TIER.INTEREST || tier === NOTIF_TIER.LOUNGE) {
      if (todays.some(n => tierOf(n.type) === tier)) return { sent: false, skipped: "tier_cap" };
    }
  }

  const { error } = await createNotification({
    userId, type, title, message, relatedId, relatedType, priority,
  });
  return { sent: !error, skipped: error ? "db_error" : undefined };
}

// 알림 탭 → 이동할 화면 결정 (STEP3: 알림 탭 시 해당 화면 이동)
//   타입별 직접 매핑(요청 흐름): 최종견적→bidstatus, 계약/진행→escrow, 완료/후기→review.
//   related_id 는 소비자 진행 알림 기준 request_id 이므로 requestId 로 함께 전달한다.
export function notifNavTarget(n) {
  if (!n) return null;
  const t = n.type;
  const rid = n.related_id ?? null;

  // 최종견적 도착/현장견적 → 견적 화면(BidStatusScreen)
  if (t === "FINAL_QUOTE_ARRIVED" || t === "FINAL_QUOTE_SUBMITTED" || t === "SITE_VISIT_REQUESTED")
    return { screen: "bidstatus", requestId: rid };
  // 계약 체결/생성, 착공/중간 진행 → 에스크로(진행) 화면
  if (t === "CONTRACT_CREATED" || t === "COMPANY_SELECTED" || t === "CONSTRUCTION_STARTED" || t === "ESCROW_MID_CHECK")
    return { screen: "escrow", requestId: rid };
  // 공사 완료/정산/후기 요청 → 리뷰 작성(내 견적 목록 경유)
  if (t === "CONSTRUCTION_DONE" || t === "SETTLEMENT_DONE" || t === "REVIEW_REQUEST" || t === "REVIEW_REQUEST_FOLLOWUP")
    return { screen: "review", requestId: rid };

  // ── 폴백: tier 기반 ──
  const tier = tierOf(n.type);
  switch (tier) {
    case NOTIF_TIER.PROGRESS:
    case NOTIF_TIER.TRUST:
      // 견적/계약/에스크로/후기 → 내 거래 화면
      if (n.related_type === "contract" || n.related_type === "escrow") return { screen: "escrow", requestId: rid };
      return { screen: "my" };
    case NOTIF_TIER.LOUNGE:
      if (n.related_type === "lounge_post" && n.related_id) return { screen: "lounge-detail", id: n.related_id };
      return { screen: "lounge" };
    case NOTIF_TIER.INTEREST:
      return { screen: "home" };
    default:
      return { screen: "my" };
  }
}
