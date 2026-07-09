// ─────────────────────────────────────────────────────
// 공간라운지 AI 콘텐츠 공장 — 예약 발행 배치 (Vercel Serverless)
//
// publish_status='scheduled' 이고 scheduled_at 이 지난 lounge_posts 를
// published 로 전환한다(is_visible=true 도 함께). 관리자가 이미 승인해
// "예약"한 것을 정해진 시각에 실행만 하는 것 — 새로운 승인 결정을 내리지
// 않는다(베타 원칙: 자동 발행은 승인된 예약 실행에 한정).
//
// 운영: Vercel Cron(vercel.json "crons")이 매일 1회 호출.
// 필요 env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY(RLS 우회, 없으면 ANON 폴백 —
//   lounge_posts 는 이미 anon update 정책이 열려 있어 폴백도 동작한다).
// 미설정/실패 시 graceful no-op(앱에 영향 없음).
// ─────────────────────────────────────────────────────

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export default async function handler(req, res) {
  if (!SB_URL || !SB_KEY) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, reason: 'missing_env', published: 0 }));
    return;
  }

  try {
    const nowIso = new Date().toISOString();
    const r = await fetch(
      `${SB_URL}/rest/v1/lounge_posts?publish_status=eq.scheduled&scheduled_at=lte.${encodeURIComponent(nowIso)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ publish_status: 'published', is_visible: true, updated_at: nowIso }),
      }
    );
    const rows = r.ok ? await r.json().catch(() => []) : [];
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: r.ok, published: Array.isArray(rows) ? rows.length : 0 }));
  } catch (e) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, reason: e?.message ?? 'error', published: 0 }));
  }
}
