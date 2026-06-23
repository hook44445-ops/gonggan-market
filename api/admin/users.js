import { createClient } from "@supabase/supabase-js";

// ── 관리자 고객 API (service role) ────────────────────────────────────────────
// service role key 는 절대 프론트에 노출하지 않고 서버에서만 사용한다.
//  · GET  /api/admin/users?adminId=<admin user id>&role=consumer   — 고객 목록 조회
//  · POST /api/admin/users   { adminId, action, userId, ... }       — 고객 제재/토큰/온도
// 권한: 전달된 adminId 의 DB role 이 'admin' 일 때만(또는 'admin' sentinel + ADMIN_CODE) 응답.
//
// ⚠️ 이 앱은 anon key + Twilio OTP 구조라 auth.uid()=NULL → users 테이블 RLS UPDATE 가
//    클라이언트에서 차단된다(schema.sql 주석 참조). 그래서 고객 상태/토큰/온도 변경은
//    신규 RPC 없이 이 service-role 엔드포인트(POST)로 처리한다. admin_logs 기록 동일.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER_STATUSES = ["NORMAL", "TEMP_RESTRICTED", "SUSPENDED", "BLACKLISTED"];

// 관리자 본인 확인 — admin 외 접근 차단(GET/POST 공용).
//  · uuid → users.role='admin' 검증 (전화번호 OTP 관리자)
//  · 'admin' sentinel → 코드 관리자(DB row 없음). x-admin-code 헤더를 서버 ADMIN_CODE 와 대조.
// 반환: { ok:true, authKind } | { ok:false, status, error }
async function verifyAdmin(db, adminId, req) {
  if (UUID_RE.test(adminId)) {
    const { data: me, error: meErr } = await db
      .from("users").select("id, role").eq("id", adminId).maybeSingle();
    if (meErr) return { ok: false, status: 500, error: meErr.message };
    if (!me || me.role !== "admin") return { ok: false, status: 403, error: "ADMIN_ONLY" };
    return { ok: true, authKind: "uuid" };
  }
  if (adminId === "admin") {
    const expected = process.env.ADMIN_CODE || process.env.VITE_ADMIN_CODE || "";
    if (!expected) return { ok: false, status: 500, error: "ADMIN_CODE_NOT_CONFIGURED" };
    const got = String(req.headers["x-admin-code"] ?? "");
    if (got !== expected) return { ok: false, status: 403, error: "ADMIN_ONLY" };
    return { ok: true, authKind: "admin" };
  }
  return { ok: false, status: 403, error: "ADMIN_ONLY" };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-code");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "SERVICE_NOT_CONFIGURED: SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다" });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // ── POST: 고객 제재 / 토큰 / 공간온도 (service role → RLS 우회) ──────────────
  if (req.method === "POST") {
    const body = typeof req.body === "object" && req.body ? req.body : {};
    const adminId = String(body.adminId ?? "").trim();
    if (!adminId) return res.status(401).json({ error: "MISSING_ADMIN_ID" });

    const auth = await verifyAdmin(db, adminId, req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
    const adminLogId = auth.authKind === "uuid" ? adminId : null; // sentinel 은 admin_logs.admin_id=NULL

    const action = String(body.action ?? "");
    const userId = String(body.userId ?? "").trim();
    const reason = body.reason != null ? String(body.reason) : null;
    if (!UUID_RE.test(userId)) return res.status(400).json({ error: "INVALID_USER_ID" });

    try {
      if (action === "set_status") {
        const status = String(body.status ?? "");
        if (!USER_STATUSES.includes(status)) return res.status(400).json({ error: "INVALID_STATUS" });
        const { data: prev } = await db.from("users").select("account_status").eq("id", userId).single();
        const { data, error } = await db.from("users")
          .update({ account_status: status }).eq("id", userId)
          .select("id, account_status").single();
        if (error) return res.status(500).json({ error: error.message });
        await db.from("admin_logs").insert({
          admin_id: adminLogId, action: `SET_USER_STATUS_${status}`, target_type: "user",
          target_id: userId, before_val: { account_status: prev?.account_status }, after_val: { account_status: status }, reason,
        });
        return res.status(200).json({ data });
      }

      if (action === "adjust_tokens") {
        const delta = Number(body.delta);
        if (!Number.isFinite(delta) || delta === 0) return res.status(400).json({ error: "INVALID_DELTA" });
        const { data: curr } = await db.from("users").select("space_tokens").eq("id", userId).single();
        const prev = curr?.space_tokens ?? 0;
        const next = Math.max(0, prev + delta);
        const { data, error } = await db.from("users")
          .update({ space_tokens: next }).eq("id", userId)
          .select("id, space_tokens").single();
        if (error) return res.status(500).json({ error: error.message });
        await db.from("admin_logs").insert({
          admin_id: adminLogId, action: delta > 0 ? "TOKEN_GRANT" : "TOKEN_REVOKE", target_type: "user",
          target_id: userId, before_val: { space_tokens: prev }, after_val: { space_tokens: next }, reason,
        });
        return res.status(200).json({ data });
      }

      if (action === "adjust_temp") {
        const delta = Number(body.delta);
        if (!Number.isFinite(delta) || delta === 0) return res.status(400).json({ error: "INVALID_DELTA" });
        const { data: curr } = await db.from("users").select("space_temp").eq("id", userId).single();
        const prev = curr?.space_temp ?? 36.5;
        const next = Math.round(Math.min(99, Math.max(0, prev + delta)) * 10) / 10;
        const { data, error } = await db.from("users")
          .update({ space_temp: next }).eq("id", userId)
          .select("id, space_temp").single();
        if (error) return res.status(500).json({ error: error.message });
        await db.from("admin_logs").insert({
          admin_id: adminLogId, action: "TEMP_ADJUST", target_type: "user",
          target_id: userId, before_val: { space_temp: prev }, after_val: { space_temp: next }, reason,
        });
        return res.status(200).json({ data });
      }

      return res.status(400).json({ error: "UNKNOWN_ACTION" });
    } catch (e) {
      console.error("[admin/users POST] FAILED", { action, message: e?.message });
      return res.status(500).json({ error: e?.message || "SERVER_ERROR" });
    }
  }

  // ── GET: 고객 목록 ────────────────────────────────────────────────────────────
  const adminId = String(req.query.adminId ?? "").trim();
  if (!adminId) return res.status(401).json({ error: "MISSING_ADMIN_ID" });

  const auth = await verifyAdmin(db, adminId, req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const authKind = auth.authKind === "uuid" ? "uuid" : adminId;

  const role = String(req.query.role ?? "consumer");
  const { data, error } = await db
    .from("users")
    .select("*")
    .eq("role", role)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) {
    // 요구사항 6) 조회 실패 원인 로그
    console.error("[admin/users] query FAILED", { authKind, role, message: error.message });
    return res.status(500).json({ error: error.message });
  }

  // 요구사항 4) count 로그 / 5) rows 로그(민감정보 제외 — id·role·name 만)
  const count = data?.length ?? 0;
  console.log("[admin/users] ok", { authKind, role, count });
  console.log("[admin/users] rows", (data ?? []).slice(0, 10).map(u => ({ id: u.id, role: u.role, name: u.name })));

  // 진단: role 필터가 0건이면 실제 users 의 role 분포를 로그(서버 전용) — consumer 의 실제
  // role 값(consumer/null/기타)을 드러내 "0명" 원인을 특정한다.
  if (count === 0) {
    const { data: sample, error: sErr } = await db.from("users").select("id, role").limit(100);
    if (sErr) {
      console.error("[admin/users] empty — role distribution lookup failed", sErr.message);
    } else {
      const dist = {};
      (sample ?? []).forEach(u => { const k = u.role ?? "(null)"; dist[k] = (dist[k] || 0) + 1; });
      console.log("[admin/users] EMPTY for role=" + role + " — actual role distribution(sample<=100):", dist, "sample_total:", sample?.length ?? 0);
    }
  }

  return res.status(200).json({ data: data ?? [] });
}
