import { createClient } from "@supabase/supabase-js";
import { sessionUserId } from "../../src/lib/sessionToken.server.js";

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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "SERVICE_NOT_CONFIGURED: SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다" });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 관리자·운영자 확인 — 서버가 서명한 로그인 토큰의 사용자로만(예전 adminId · x-admin-code 는 믿지 않는다, 09-25).
  const uid = sessionUserId(req);
  if (!uid) return res.status(401).json({ error: "관리자 인증이 필요해요 — 인증번호로 다시 로그인해 주세요" });
  {
    const { data: me, error: meErr } = await db
      .from("users").select("id, role, is_operator").eq("id", uid).maybeSingle();
    if (meErr) return res.status(500).json({ error: meErr.message });
    const isMod = me && (me.role === "admin" || me.is_operator === true || me.role === "operator");
    if (!isMod) return res.status(403).json({ error: "MODERATOR_ONLY" });
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
