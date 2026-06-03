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

  // 관리자(role=admin) 본인 확인 — admin 외 접근 차단
  const { data: me, error: meErr } = await db
    .from("users").select("id, role").eq("id", adminId).maybeSingle();
  if (meErr) return res.status(500).json({ error: meErr.message });
  if (!me || me.role !== "admin") return res.status(403).json({ error: "ADMIN_ONLY" });

  const role = String(req.query.role ?? "consumer");
  const { data, error } = await db
    .from("users")
    .select("*")
    .eq("role", role)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ data: data ?? [] });
}
