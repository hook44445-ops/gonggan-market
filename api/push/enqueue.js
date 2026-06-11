// ─────────────────────────────────────────────────────
// 공간마켓 알림 → FCM 큐 연결 (Phase 1)
//
// createNotification() 이 notifications insert 성공 후 best-effort 로 호출한다.
// push_preferences(전체/카테고리 토글) 확인 후 push_logs 에 큐잉한다.
// 이 엔드포인트가 실패해도 알림 생성(notifications insert) 결과에는 영향 없다.
//
// 필요 env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY(RLS 우회).
// 미설정 시 graceful no-op.
// ─────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const db = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY, { auth: { persistSession: false } }) : null;

// 알림 type → push_preferences 카테고리 컬럼 (매핑 없으면 push_enabled 만 확인)
export const TYPE_TO_PREF_COLUMN = {
  // 견적
  BID_RECEIVED: "push_estimate_news",
  BID_ALL_IN: "push_estimate_news",
  QUOTE_DEADLINE: "push_estimate_news",
  ESTIMATE_DUE_SOON: "push_estimate_news",
  COMPANY_SELECTED: "push_estimate_news",
  SITE_VISIT_REQUESTED: "push_estimate_news",
  SITE_VISIT_SCHEDULED: "push_estimate_news",
  GPS_CHECKIN: "push_estimate_news",
  FIELD_ESTIMATE: "push_estimate_news",
  // 계약/안전결제
  CONTRACT_CREATED: "push_escrow",
  CONTRACT_CONFIRMED: "push_escrow",
  CONTRACT_FOLLOWUP: "push_escrow",
  CONSTRUCTION_STARTED: "push_escrow",
  ESCROW_PAID_30: "push_escrow",
  ESCROW_MID_CHECK: "push_escrow",
  CONSTRUCTION_DONE: "push_escrow",
  SETTLEMENT_DONE: "push_escrow",
  CHANGE_ORDER_REQUEST: "push_escrow",
  CHANGE_ORDER_RESULT: "push_escrow",
  DISPUTE_FILED: "push_escrow",
  DIRECT_DEAL_DETECTED: "push_escrow",
  // 후기/신뢰 — 기존 정책상 "견적/시공후기" 토글에 통합
  REVIEW_REQUEST: "push_estimate_news",
  REVIEW_REQUEST_FOLLOWUP: "push_estimate_news",
  TEMP_UP: "push_estimate_news",
  RECONTRACT: "push_estimate_news",
  TRUST_MILESTONE: "push_estimate_news",
  // 업체/관리
  COMPANY_APPROVED: "push_company_recommend",
  COMPANY_REJECTED: "push_company_recommend",
  COMPANY_STATUS_CHANGED: "push_company_recommend",
  DOCUMENT_REVIEW: "push_company_recommend",
  ADMIN_ACTION: "push_company_recommend",
  // 관심지역/저장업체
  REGION_NEW_COMPANY: "push_local_news",
  REGION_ACTIVITY: "push_local_news",
  SAVED_NEW_PORTFOLIO: "push_company_recommend",
  SAVED_TEMP_UP: "push_company_recommend",
  // 라운지
  LOUNGE_COMMENT: "push_lounge_activity",
  LOUNGE_WEEKLY_HOT: "push_lounge_activity",
  LOUNGE_REGION_REVIEW: "push_lounge_activity",
};

// 알림 related_type → 클릭 시 이동 경로
export function buildTargetUrl(relatedType, relatedId) {
  if (!relatedId) return "/";
  switch (relatedType) {
    case "contract":
    case "escrow":
      return `/contracts/${relatedId}`;
    case "lounge_post":
      return `/lounge/posts/${relatedId}`;
    case "request":
    case "bid":
      return `/requests/${relatedId}`;
    default:
      return "/";
  }
}

// push_preferences 행과 알림 type 으로 큐잉 여부를 판단(순수 함수, 테스트용 분리)
export function decidePushGate(pref, type) {
  if (!pref || !pref.push_enabled) return { allow: false, reason: "push_disabled" };
  const col = TYPE_TO_PREF_COLUMN[type];
  if (col && pref[col] === false) return { allow: false, reason: "category_disabled" };
  return { allow: true };
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, reason: "method_not_allowed" }));
    return;
  }
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { userId, type, title, message, relatedId, relatedType } = body || {};
  if (!userId || !type) {
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: false, reason: "missing_params" }));
    return;
  }

  if (!db) {
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: false, reason: "no_db_credentials" }));
    return;
  }

  try {
    const { data: pref } = await db
      .from("push_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // 수신설정 row 가 없거나 전체/카테고리 OFF → 큐잉하지 않음(내부 알림은 이미 저장됨)
    const gate = decidePushGate(pref, type);
    if (!gate.allow) {
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true, queued: false, reason: gate.reason }));
      return;
    }

    const relId = relatedId != null ? String(relatedId) : null;

    // 같은 유저·타입·related_id 중복 큐잉 방지(push_logs uq_push_logs_dedup)
    if (relId) {
      const { data: dup } = await db
        .from("push_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("type", type)
        .eq("related_id", relId)
        .maybeSingle();
      if (dup) {
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true, queued: false, reason: "duplicate" }));
        return;
      }
    }

    const { error } = await db.from("push_logs").insert({
      user_id: userId,
      type,
      title: title || "공간마켓",
      body: message || "",
      target_url: buildTargetUrl(relatedType, relId),
      related_id: relId,
      status: "queued",
    });
    if (error) {
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: false, reason: "insert_failed", message: error.message }));
      return;
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, queued: true }));
  } catch (err) {
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: false, reason: "error", message: err?.message ?? String(err) }));
  }
}
