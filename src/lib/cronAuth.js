// ════════════════════════════════════════════════════════════════════
// 공간라운지 Cron 인증 — 서버 전용 CRON_SECRET Bearer 검증 (Phase 39)
//
//   외부 스케줄러가 서버 자율 엔드포인트를 호출할 때 Authorization: Bearer <CRON_SECRET>
//   를 검증한다. 비밀 원문은 로그·응답·에러메시지 어디에도 절대 노출하지 않는다.
//   · CRON_SECRET 미설정 → 503 CRON_SECRET_NOT_CONFIGURED
//   · 헤더 없음/불일치   → 401 UNAUTHORIZED
//   ⚠️ 서버 전용(process.env). VITE_ 접두어 금지 · 번들 포함 금지. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import crypto from "node:crypto";

export function getCronSecret() {
  return process.env.CRON_SECRET || "";
}

// 타이밍 공격 방지용 상수시간 비교(길이 다르면 즉시 false).
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

// 반환: { ok, status, code } — 호출측이 status/code 로 응답을 구성한다(비밀 원문 미포함).
export function authenticateCron(req) {
  const secret = getCronSecret();
  if (!secret) return { ok: false, status: 503, code: "CRON_SECRET_NOT_CONFIGURED" };

  const header =
    (req?.headers?.authorization || req?.headers?.Authorization || "").toString();
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token || !safeEqual(token, secret)) {
    return { ok: false, status: 401, code: "UNAUTHORIZED" };
  }
  return { ok: true, status: 200, code: "OK" };
}
