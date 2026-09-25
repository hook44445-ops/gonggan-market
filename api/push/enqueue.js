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

import { sessionUserId } from "../../src/lib/sessionToken.server.js";

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
  // 파트너 — 새 견적 요청(한도 안/밖). 서버 트리거(migration 110)가 push_logs 에 직접 넣는다.
  NEW_REQUEST: "push_estimate_news",
  NEW_REQUEST_LOCKED: "push_estimate_news",
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
  // 종이(견적서/문서) — 최종 견적서는 «종이가 도착했다» 알림이라 견적 토글에 묶는다
  FINAL_QUOTE_ARRIVED: "push_estimate_news",
  FINAL_QUOTE_SUBMITTED: "push_estimate_news",
  QUOTE_COMPARISON_BLOCK: "push_estimate_news",
  CHECKLIST: "push_estimate_news",
  UPLOAD: "push_company_recommend",
  // 업체 쪽 사본(CO_*) — 고객 알림과 같은 단계를 업체에게도 보낸다. 에스크로 토글을 함께 쓴다
  CO_CONSTRUCTION_STARTED: "push_escrow",
  CO_ESCROW_MID_CHECK: "push_escrow",
  CO_CONSTRUCTION_DONE: "push_escrow",
  CO_SETTLEMENT_DONE: "push_escrow",
  CO_STAGE_APPROVED: "push_escrow",
  STAGE_APPROVE_REMINDER: "push_escrow",
  STAGE_AUTO_APPROVED: "push_escrow",
  // 사업자등록(116) — SQL 이 만든 알림은 135 트리거가 같은 규칙으로 큐에 넣는다(여기는 앱 경로용 표)
  BIZ_VERIFIED: "push_escrow",
  BIZ_REQUIRED: "push_company_recommend",
  CO_DISPUTE_FILED: "push_escrow",
  // 라운지 1:1 대화 — push_chat 컬럼은 화면에 토글이 있는데 여태 아무 타입도 쓰지 않았다
  LOUNGE_CHAT_REQUEST: "push_chat",
  LOUNGE_CHAT_ACCEPTED: "push_chat",
  LOUNGE_CHAT_MESSAGE: "push_chat",
  // 제재/차단 안내와 관리자 테스트는 일부러 매핑하지 않는다(끄면 안 되는 고지 · push_enabled 만 확인):
  //   HARD_BLOCK, COOLDOWN_BLOCK, ADMIN_TEST_PUSH
};

// 알림 type/related_type → 클릭 시 이동 경로
// type 은 나중에 붙은 3번째 인자다(라운지 대화처럼 related_type 만으로는 갈 곳이 안 정해지는 경우).
// 없이 불러도 예전 그대로 동작한다.
export function buildTargetUrl(relatedType, relatedId, type) {
  // 라운지 1:1 대화 — 대화방 id(lounge_{requestId})가 알림에 실리지 않으므로 방을 직접 열 수 없다.
  // 「대화 신청 내역」 카드가 있는 마이페이지로 보낸다(없는 화면을 가리키지 않는다).
  if (type === "LOUNGE_CHAT_REQUEST" || type === "LOUNGE_CHAT_ACCEPTED" || type === "LOUNGE_CHAT_MESSAGE") {
    return "/my";
  }
  if (!relatedId) return "/";
  switch (relatedType) {
    case "contract":
    case "escrow":
      return `/contracts/${relatedId}`;
    case "lounge_post":
      return `/lounge/posts/${relatedId}`;
    case "lounge":
      return `/lounge/posts/${relatedId}`;
    case "request":
    case "bid":
      return `/requests/${relatedId}`;
    default:
      return "/";
  }
}

// 즉시 발송 대상 — 대화·계약·에스크로·견적 도착처럼 «지금» 알아야 하는 것들.
// 소식성(라운지 새 글 등)은 여기 해당하지 않고 크론이 시간창에 맞춰 내보낸다.
export function isImmediatePushType(type) {
  const col = TYPE_TO_PREF_COLUMN[type];
  return col === "push_escrow" || col === "push_chat" || col === "push_estimate_news";
}

// 큐에 넣은 직후 디스패처를 한 번 깨운다(크론은 하루 1회라 그것만으로는 즉시가 되지 않는다).
// 실패해도 큐에는 남아 있으므로 다음 크론이 보낸다 — 그래서 결과를 삼킨다.
async function wakeDispatcher() {
  const base =
    process.env.PUSH_DISPATCH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!base) return { woke: false, reason: "no_base_url" };
  const url = base.startsWith("http") ? `${base.replace(/\/$/, "")}/api/push/dispatch` : base;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { method: "POST", signal: ctrl.signal });
    clearTimeout(timer);
    return { woke: r.ok };
  } catch {
    return { woke: false, reason: "dispatch_unreachable" };
  }
}

// push_preferences 행과 알림 type 으로 큐잉 여부를 판단(순수 함수, 테스트용 분리)
export function decidePushGate(pref, type) {
  if (!pref || !pref.push_enabled) return { allow: false, reason: "push_disabled" };
  const col = TYPE_TO_PREF_COLUMN[type];
  if (col && pref[col] === false) return { allow: false, reason: "category_disabled" };
  return { allow: true };
}


// ── 관리자 현황 조회 ────────────────────────────────────────────────────────
// Vercel Hobby 는 서버리스 함수 12개가 한도라 파일을 새로 만들지 않고 여기에 얹는다.
// POST /api/push/enqueue  { action: "stats", adminId }  (+ sentinel 이면 x-admin-code 헤더)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 관리자 확인 — 로그인 토큰(Authorization: Bearer)의 사용자가 관리자일 때만(09-25, 예전 adminId · 관리자 코드 믿음 제거).
async function verifyAdmin(_adminId, req) {
  const uid = sessionUserId(req);
  if (!uid) return false;
  const { data: me } = await db.from("users").select("id, role").eq("id", uid).maybeSingle();
  return !!me && me.role === "admin";
}

async function pushStats() {
  const since = new Date(Date.now() - 7 * 24 * 3600000).toISOString();
  const countOf = async (build) => {
    const { count } = await build.select("id", { count: "exact", head: true });
    return count ?? 0;
  };

  const [queued, sent7, failed7, skipped7] = await Promise.all([
    countOf(db.from("push_logs").eq("status", "queued")),
    countOf(db.from("push_logs").eq("status", "sent").gte("sent_at", since)),
    countOf(db.from("push_logs").eq("status", "failed").gte("sent_at", since)),
    countOf(db.from("push_logs").eq("status", "skipped").gte("sent_at", since)),
  ]);

  const [tokensActive, prefsOn] = await Promise.all([
    countOf(db.from("fcm_tokens").eq("is_active", true)),
    countOf(db.from("push_preferences").eq("push_enabled", true)),
  ]);

  // 가장 오래 큐에 남아 있는 한 건 — 디스패처가 죽었는지 바로 드러난다
  const { data: oldest } = await db
    .from("push_logs").select("created_at")
    .eq("status", "queued").order("created_at", { ascending: true }).limit(1).maybeSingle();

  const { data: recentFails } = await db
    .from("push_logs").select("type, error_message, sent_at")
    .in("status", ["failed", "skipped"]).gte("sent_at", since)
    .order("sent_at", { ascending: false }).limit(20);

  const { data: recentSent } = await db
    .from("push_logs").select("type, title, sent_at")
    .eq("status", "sent").order("sent_at", { ascending: false }).limit(10);

  return {
    queued, sent7, failed7, skipped7, tokensActive, prefsOn,
    oldestQueuedAt: oldest?.created_at ?? null,
    recentFails: recentFails ?? [],
    recentSent: recentSent ?? [],
    env: {
      // 값은 절대 내보내지 않는다. 설정됐는지만 본다.
      fcmV1: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      fcmLegacy: !!process.env.FCM_SERVER_KEY,
      dispatchUrl: !!(process.env.PUSH_DISPATCH_URL || process.env.VERCEL_URL),
    },
  };
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
  const { userId, type, title, message, relatedId, relatedType, action, adminId } = body || {};

  // wake — 서버 트리거가 큐에 넣은 푸시(예: 새 견적 요청 → 파트너들)를 지금 내보낸다.
  // 이미 큐에 있는 것만 보내므로 누가 불러도 새 알림이 생기지 않는다(크론은 하루 1회라 이게 없으면 최대 24시간 늦음).
  if (action === "wake") {
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, ...(await wakeDispatcher()) }));
    return;
  }

  // 관리자 전용 동작(현황 조회 · 수동 발송) — 일반 큐잉보다 먼저 가른다.
  if (action === "stats" || action === "flush") {
    if (!db) {
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: false, reason: "no_db_credentials" }));
      return;
    }
    if (!(await verifyAdmin(String(adminId ?? "").trim(), req))) {
      res.statusCode = 403;
      res.end(JSON.stringify({ ok: false, reason: "admin_only" }));
      return;
    }
    try {
      // flush — 큐에 쌓인 것을 지금 내보낸다(크론은 하루 1회라 그것만 기다릴 수 없다).
      if (action === "flush") {
        res.statusCode = 200;
        res.end(JSON.stringify({ ok: true, ...(await wakeDispatcher()) }));
        return;
      }
      // stats — 큐가 밀렸는지, 토큰이 있는지, 왜 실패했는지 한 화면에서 본다.
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true, stats: await pushStats() }));
    } catch (err) {
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: false, reason: "admin_action_failed", message: err?.message ?? String(err) }));
    }
    return;
  }

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
      target_url: buildTargetUrl(relatedType, relId, type),
      related_id: relId,
      status: "queued",
    });
    if (error) {
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: false, reason: "insert_failed", message: error.message }));
      return;
    }

    // 대화·계약·에스크로·견적 도착은 «지금» 나가야 한다.
    // vercel.json 크론은 하루 1회(0 9 * * *)뿐이라, 그것만 믿으면 최대 24시간 늦는다.
    let dispatch = null;
    if (isImmediatePushType(type)) dispatch = await wakeDispatcher();

    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, queued: true, ...(dispatch ? { dispatch } : {}) }));

  } catch (err) {
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: false, reason: "error", message: err?.message ?? String(err) }));
  }
}
