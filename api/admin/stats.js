import { createClient } from "@supabase/supabase-js";

// ── 관리자 운영지표 API (service role) ────────────────────────────────────────
// GET /api/admin/stats?adminId=<admin user id>  — 방문자(DAU/MAU)·신규가입·견적·계약 요약
// 이 앱은 anon key + 커스텀(OTP) 인증이라 auth.uid()=NULL → 관리자 집계는 service-role 로만 가능.
// users.js 와 동일한 verifyAdmin(adminId uuid=role 검증 / 'admin' sentinel=x-admin-code) 패턴.
//
// 회귀 방지: 각 지표는 개별 try/catch 로 감싸 실패해도 0 을 반환한다.
//   → user_visits 테이블/RPC(085 마이그레이션) 미적용 상태여도 500 없이 방문자만 0 으로 표시.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

// KST(UTC+9) 기준 '오늘 0시'의 UTC ISO 문자열.
function kstTodayStartIso() {
  const now = Date.now();
  const kst = new Date(now + 9 * 3600 * 1000);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 3600 * 1000).toISOString();
}
const daysAgoIso = (n) => new Date(Date.now() - n * 24 * 3600 * 1000).toISOString();

// head count 쿼리 — 실패(테이블/컬럼 없음 등) 시 0 반환(회귀 방지).
async function countGte(db, table, column, iso) {
  try {
    const { count, error } = await db
      .from(table)
      .select("*", { count: "exact", head: true })
      .gte(column, iso);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-code");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "SERVICE_NOT_CONFIGURED: SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다" });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const adminId = String(req.query.adminId ?? "").trim();
  if (!adminId) return res.status(401).json({ error: "MISSING_ADMIN_ID" });
  const auth = await verifyAdmin(db, adminId, req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const todayIso = kstTodayStartIso();
  const d7Iso = daysAgoIso(7);
  const d30Iso = daysAgoIso(30);

  // 방문자(DAU/MAU) — user_visits.last_seen_at 기준(사용자당 마지막 방문 1행).
  const [visToday, vis7d, vis30d] = await Promise.all([
    countGte(db, "user_visits", "last_seen_at", todayIso),
    countGte(db, "user_visits", "last_seen_at", d7Iso),
    countGte(db, "user_visits", "last_seen_at", d30Iso),
  ]);

  // 신규가입 — users.created_at (정확·과거치 포함).
  const [signupToday, signup7d, signup30d] = await Promise.all([
    countGte(db, "users", "created_at", todayIso),
    countGte(db, "users", "created_at", d7Iso),
    countGte(db, "users", "created_at", d30Iso),
  ]);

  // 오늘 견적요청 / 오늘 계약(에스크로 1차 결제 기준 — 기존 KPI 패널과 동일 정의).
  const requestsToday  = await countGte(db, "requests", "created_at", todayIso);
  const contractsToday = await countGte(db, "escrow_payments", "step1_deposited_at", todayIso);

  return res.status(200).json({
    data: {
      generatedAt: new Date().toISOString(),
      visitors: { today: visToday, d7: vis7d, d30: vis30d }, // today=DAU, d30=MAU
      signups:  { today: signupToday, d7: signup7d, d30: signup30d },
      requestsToday,
      contractsToday,
    },
  });
}
