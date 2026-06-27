import { createClient } from "@supabase/supabase-js";

// 회원탈퇴(계정 삭제) — Google Play 계정 삭제 정책 대응 서버 엔드포인트.
//
// 이 앱의 "계정"은 public.users row 다(로그인 = Twilio OTP + users 조회 구조,
// Supabase auth.users 세션/user_sessions 미사용). 따라서 auth.admin.deleteUser 가
// 아니라 users row 를 대상으로 익명화 + soft-delete 한다(FK 보존, 거래 상대방 기록 유지).
//
// 본인 확인: { userId, phone } 이 동시에 일치하는 계정만 삭제 허용(앱의 기존
// userId-in-body 신뢰 모델 + 등록 전화번호 일치를 2차 요소로 사용).

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 진행 중으로 간주해 탈퇴를 차단하는 프로젝트(requests) 상태.
const IN_PROGRESS_STATUSES = ["in_progress"];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "Method not allowed" });

  const { userId, phone } = req.body ?? {};
  if (!userId || !phone) return res.status(400).json({ error: "userId and phone are required" });

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[delete-account] Missing Supabase admin env vars");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 1) 본인 확인 — id + phone 동시 일치.
  const { data: user, error: lookupErr } = await db
    .from("users")
    .select("id, phone, is_deleted")
    .eq("id", userId)
    .maybeSingle();

  if (lookupErr) {
    console.error("[delete-account] lookup error:", lookupErr.message);
    return res.status(500).json({ error: "lookup_failed" });
  }
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  // 이미 탈퇴 처리된 계정 — 멱등 성공.
  if (user.is_deleted) return res.status(200).json({ success: true, alreadyDeleted: true });

  if (String(user.phone) !== String(phone)) {
    return res.status(403).json({ error: "PHONE_MISMATCH" });
  }

  // 2) 진행 중인 프로젝트가 있으면 탈퇴 불가.
  const { count: inProgressCount, error: reqErr } = await db
    .from("requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", IN_PROGRESS_STATUSES);

  if (reqErr) {
    console.error("[delete-account] requests check error:", reqErr.message);
    return res.status(500).json({ error: "project_check_failed" });
  }
  if ((inProgressCount ?? 0) > 0) {
    return res.status(409).json({ error: "IN_PROGRESS_PROJECT", count: inProgressCount });
  }

  // 3) 익명화 + soft-delete.
  //    - 개인정보(이름/전화/지역/관심사/아바타) 제거
  //    - phone 을 토큰값으로 치환 → 원 번호 해제(동일 번호 재가입 가능) + unique 제약 유지
  //    - account_status='SUSPENDED'(기존 허용값)로 일반 계정 취급 차단
  const nowIso = new Date().toISOString();
  const { error: updErr } = await db
    .from("users")
    .update({
      is_deleted:     true,
      deleted_at:     nowIso,
      account_status: "SUSPENDED",
      name:           "탈퇴한 회원",
      phone:          `deleted:${userId}`,
      region:         null,
      interests:      [],
      avatar_url:     null,
      updated_at:     nowIso,
    })
    .eq("id", userId)
    .eq("is_deleted", false); // 동시성 가드

  if (updErr) {
    console.error("[delete-account] anonymize error:", updErr.message);
    return res.status(500).json({ error: "delete_failed" });
  }

  return res.status(200).json({ success: true });
}
