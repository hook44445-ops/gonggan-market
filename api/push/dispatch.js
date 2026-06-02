// ─────────────────────────────────────────────────────
// 공간마켓 푸시 발송 디스패처 (Vercel Serverless)
//
// queued push_logs 를 읽어 FCM 으로 발송한다.
// - 소식성(news) 타입: 발송 시간창(10~21시 KST) + 하루 최대 3회 적용
// - 대화/계약/에스크로: 즉시(시간 제한 없음)
// 운영: 외부 cron(예: Vercel Cron / GitHub Actions)이 주기 호출.
//
// 필요 env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY(RLS 우회), FCM_SERVER_KEY.
// 미설정 시 graceful no-op(앱/큐에 영향 없음).
// ─────────────────────────────────────────────────────

import { isNewsType, isWithinNewsWindow, NEWS_DAILY_CAP } from '../../src/utils/pushPolicy.js';

const SB_URL  = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FCM_KEY = process.env.FCM_SERVER_KEY || '';

function sbHeaders(extra = {}) {
  return { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', ...extra };
}

async function sbGet(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!r.ok) return null;
  return r.json();
}

async function sbPatch(path, body) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify(body),
  });
}

async function markLog(id, fields) {
  await sbPatch(`push_logs?id=eq.${encodeURIComponent(id)}`, fields);
}

async function sendFcm(token, log) {
  const r = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: { Authorization: `key=${FCM_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: token,
      notification: { title: log.title || '공간마켓', body: log.body || '' },
      data: { target_url: log.target_url || '/', type: log.type || '', related_id: String(log.related_id ?? '') },
    }),
  });
  const ok = r.ok;
  let detail = null;
  try { detail = await r.json(); } catch {}
  return { ok: ok && (detail?.success ?? 1) >= 1, detail };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (!SB_URL || !SB_KEY) { res.statusCode = 200; res.end(JSON.stringify({ ok: false, reason: 'no_db_credentials' })); return; }
  if (!FCM_KEY)           { res.statusCode = 200; res.end(JSON.stringify({ ok: false, reason: 'no_fcm_credentials' })); return; }

  const queued = await sbGet('push_logs?status=eq.queued&select=id,user_id,type,title,body,target_url,related_id&order=created_at.asc&limit=200');
  if (!Array.isArray(queued)) { res.statusCode = 200; res.end(JSON.stringify({ ok: false, reason: 'query_failed' })); return; }

  const now = new Date();
  const summary = { processed: 0, sent: 0, failed: 0, skipped: 0 };
  const since24h = new Date(now.getTime() - 24 * 3600000).toISOString();

  for (const log of queued) {
    summary.processed++;

    // 소식성: 시간창 밖이면 보류(queued 유지), 하루 캡 초과면 skip
    if (isNewsType(log.type)) {
      if (!isWithinNewsWindow(now)) { continue; }
      const sentToday = await sbGet(
        `push_logs?user_id=eq.${encodeURIComponent(log.user_id)}&status=eq.sent&sent_at=gte.${encodeURIComponent(since24h)}&select=id&limit=10`
      );
      const newsSent = Array.isArray(sentToday) ? sentToday.length : 0;
      if (newsSent >= NEWS_DAILY_CAP) {
        await markLog(log.id, { status: 'skipped', error_message: 'daily_cap', sent_at: now.toISOString() });
        summary.skipped++;
        continue;
      }
    }

    const tokens = await sbGet(`fcm_tokens?user_id=eq.${encodeURIComponent(log.user_id)}&is_active=eq.true&select=token`);
    if (!Array.isArray(tokens) || tokens.length === 0) {
      await markLog(log.id, { status: 'skipped', error_message: 'no_token', sent_at: now.toISOString() });
      summary.skipped++;
      continue;
    }

    let anyOk = false;
    let lastErr = null;
    for (const t of tokens) {
      const { ok, detail } = await sendFcm(t.token, log);
      if (ok) anyOk = true;
      else lastErr = JSON.stringify(detail)?.slice(0, 300) ?? 'fcm_error';
    }

    if (anyOk) { await markLog(log.id, { status: 'sent', sent_at: now.toISOString() }); summary.sent++; }
    else { await markLog(log.id, { status: 'failed', error_message: lastErr, sent_at: now.toISOString() }); summary.failed++; }
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, ...summary }));
}
