import { createClient } from "@supabase/supabase-js";

// ── 관리자 고객 목록 API (service role) ───────────────────────────────────────
// service role key 는 절대 프론트에 노출하지 않고 서버에서만 사용한다.
// 호출: GET /api/admin/users?adminId=<admin user id>&role=consumer
// 권한: 전달된 adminId 의 DB role 이 'admin' 일 때만 응답(operator/일반 사용자 차단).
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "SERVICE_NOT_CONFIGURED: SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다" });
  }

  const adminId = String(req.query.adminId ?? "").trim();
  if (!adminId) return res.status(401).json({ error: "MISSING_ADMIN_ID" });

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 관리자 본인 확인 — admin 외 접근 차단.
  // · uuid → users.role='admin' 검증 (전화번호 OTP 관리자)
  // · 'admin' sentinel → 코드 관리자(가상 계정, DB row 없음). x-admin-code 헤더를
  //   서버 ADMIN_CODE 와 대조해 검증 (migration 040/046 의 sentinel 패턴과 동일).
  //   ⚠️ 기존엔 'admin' 이 uuid 캐스트 에러(500)로 떨어져 코드 관리자의 고객 목록이
  //   항상 실패했다 — 이 분기가 그 버그 수정.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (UUID_RE.test(adminId)) {
    const { data: me, error: meErr } = await db
      .from("users").select("id, role").eq("id", adminId).maybeSingle();
    if (meErr) return res.status(500).json({ error: meErr.message });
    if (!me || me.role !== "admin") return res.status(403).json({ error: "ADMIN_ONLY" });
  } else if (adminId === "admin") {
    const expected = process.env.ADMIN_CODE || process.env.VITE_ADMIN_CODE || "";
    if (!expected) return res.status(500).json({ error: "ADMIN_CODE_NOT_CONFIGURED" });
    const got = String(req.headers["x-admin-code"] ?? "");
    if (got !== expected) return res.status(403).json({ error: "ADMIN_ONLY" });
  } else {
    return res.status(403).json({ error: "ADMIN_ONLY" });
  }

  const role = String(req.query.role ?? "consumer");
  const authKind = UUID_RE.test(adminId) ? "uuid" : adminId;
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
