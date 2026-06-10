import { createClient } from "@supabase/supabase-js";

// ── 라운지 운영(seed) 글 관리 목록 API (service role) ─────────────────────────
// lounge_posts 의 is_seed=true 운영글 전체를 반환(숨김/비활성 포함) — RLS 우회 위해 서버에서만 service role 사용.
// 호출: GET /api/admin/seed-posts?adminId=<actor user id>
// 권한: 전달된 adminId 의 DB role 이 'admin' 또는 'operator' 일 때만 응답.
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

  // uuid → DB role 검증 / 'admin' sentinel → 코드 관리자(x-admin-code 검증).
  // 기존엔 'admin' 이 uuid 캐스트 에러(500)로 떨어져 코드 관리자가 항상 실패했다.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (UUID_RE.test(adminId)) {
    const { data: me, error: meErr } = await db
      .from("users").select("id, role, is_operator").eq("id", adminId).maybeSingle();
    if (meErr) return res.status(500).json({ error: meErr.message });
    // operator 는 부가 권한(is_operator). 레거시 role='operator' 도 호환.
    const isMod = me && (me.role === "admin" || me.is_operator === true || me.role === "operator");
    if (!isMod) {
      return res.status(403).json({ error: "MODERATOR_ONLY" });
    }
  } else if (adminId === "admin") {
    const expected = process.env.ADMIN_CODE || process.env.VITE_ADMIN_CODE || "";
    if (!expected) return res.status(500).json({ error: "ADMIN_CODE_NOT_CONFIGURED" });
    const got = String(req.headers["x-admin-code"] ?? "");
    if (got !== expected) return res.status(403).json({ error: "MODERATOR_ONLY" });
  } else {
    return res.status(403).json({ error: "MODERATOR_ONLY" });
  }

  const { data, error } = await db
    .from("lounge_posts")
    .select("id, title, category, content, image_urls, is_seed, is_visible, is_hidden, is_deleted, is_hot, hot_priority, view_count, like_count, comment_count, created_at, hidden_at, managed_at")
    .eq("is_seed", true)
    .eq("is_deleted", false)
    .order("is_hot", { ascending: false })
    .order("hot_priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ data: data ?? [] });
}
