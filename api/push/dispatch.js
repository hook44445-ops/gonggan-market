// ─────────────────────────────────────────────────────
// 공간마켓 푸시 발송 디스패처 (Vercel Serverless)
//
// queued push_logs 를 읽어 FCM 으로 발송한다.
// - 소식성(news) 타입: 발송 시간창(10~21시 KST) + 하루 최대 3회 적용
// - 대화/계약/에스크로: 즉시(시간 제한 없음)
// 운영: Vercel Cron(vercel.json "crons")이 주기 호출(외부 cron 도 가능).
//
// 발송 경로 — FCM HTTP v1 (권장) 우선, 없으면 Legacy 폴백:
//   · v1:    env FIREBASE_SERVICE_ACCOUNT(서비스계정 JSON) → OAuth2 access token →
//            POST https://fcm.googleapis.com/v1/projects/{project_id}/messages:send
//            ※ Google 이 Legacy(fcm/send)를 폐기했으므로 실발송은 v1 이 정상 경로.
//   · 폴백:  env FCM_SERVER_KEY(Legacy) — v1 미설정 환경에서만 사용(과거 동작 유지).
//
// 필요 env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY(RLS 우회),
//           그리고 FIREBASE_SERVICE_ACCOUNT(v1) 또는 FCM_SERVER_KEY(legacy) 중 하나.
// 미설정 시 graceful no-op(앱/큐/DB 에 영향 없음).
// ─────────────────────────────────────────────────────

import crypto from 'crypto';
import { isNewsType, isWithinNewsWindow, NEWS_DAILY_CAP } from '../../src/utils/pushPolicy.js';

const SB_URL  = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FCM_KEY = process.env.FCM_SERVER_KEY || '';                 // Legacy(폴백 전용)
const SA_RAW  = process.env.FIREBASE_SERVICE_ACCOUNT || '';        // HTTP v1(서비스계정 JSON)

// ── 서비스계정 파싱(1회) ──────────────────────────────────────────────
function parseServiceAccount(raw) {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    if (!j.client_email || !j.private_key || !j.project_id) return null;
    // env 에 한 줄로 저장된 경우 \n 이스케이프 복원.
    j.private_key = String(j.private_key).replace(/\\n/g, '\n');
    return j;
  } catch {
    return null;
  }
}
const SA = parseServiceAccount(SA_RAW);

// ── OAuth2 access token (서명 JWT → 토큰 교환) · 모듈 캐시 ─────────────
const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let _tok = { value: null, exp: 0 };

async function getAccessToken() {
  if (!SA) return null;
  const now = Math.floor(Date.now() / 1000);
  if (_tok.value && now < _tok.exp - 60) return _tok.value;   // 만료 60s 전까지 재사용

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: SA.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${claim}`;
  const signature = b64url(crypto.sign('RSA-SHA256', Buffer.from(signingInput), SA.private_key));
  const assertion = `${signingInput}.${signature}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  if (!r.ok) { _tok = { value: null, exp: 0 }; return null; }
  const j = await r.json().catch(() => null);
  if (!j?.access_token) return null;
  _tok = { value: j.access_token, exp: now + (Number(j.expires_in) || 3600) };
  return _tok.value;
}

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

// ── FCM HTTP v1 발송 ───────────────────────────────────────────────────
async function sendFcmV1(accessToken, token, log) {
  const r = await fetch(
    `https://fcm.googleapis.com/v1/projects/${SA.project_id}/messages:send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: log.title || '공간마켓', body: log.body || '' },
          // v1 data 값은 모두 문자열이어야 한다.
          data: {
            target_url: String(log.target_url || '/'),
            type: String(log.type || ''),
            related_id: String(log.related_id ?? ''),
          },
          // 웹 푸시 클릭 시 이동(서비스워커 notificationclick 과 동일 목적지).
          webpush: { fcm_options: { link: log.target_url || '/' } },
        },
      }),
    }
  );
  const ok = r.ok;                       // v1 성공 = 200 + { name: ... }
  let detail = null;
  try { detail = await r.json(); } catch {}
  return { ok, detail };
}

// ── FCM Legacy 발송(폴백 전용) ─────────────────────────────────────────
async function sendFcmLegacy(token, log) {
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

  // 발송 경로 결정: v1(서비스계정) 우선, 없으면 legacy(서버키) 폴백.
  const useV1 = !!SA;
  let accessToken = null;
  if (useV1) {
    accessToken = await getAccessToken();
    if (!accessToken) { res.statusCode = 200; res.end(JSON.stringify({ ok: false, reason: 'fcm_v1_auth_failed' })); return; }
  } else if (!FCM_KEY) {
    res.statusCode = 200; res.end(JSON.stringify({ ok: false, reason: 'no_fcm_credentials' })); return;
  }

  const queued = await sbGet('push_logs?status=eq.queued&select=id,user_id,type,title,body,target_url,related_id&order=created_at.asc&limit=200');
  if (!Array.isArray(queued)) { res.statusCode = 200; res.end(JSON.stringify({ ok: false, reason: 'query_failed' })); return; }

  const now = new Date();
  const summary = { processed: 0, sent: 0, failed: 0, skipped: 0, transport: useV1 ? 'v1' : 'legacy' };
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
      const { ok, detail } = useV1
        ? await sendFcmV1(accessToken, t.token, log)
        : await sendFcmLegacy(t.token, log);
      if (ok) anyOk = true;
      else lastErr = JSON.stringify(detail)?.slice(0, 300) ?? 'fcm_error';
    }

    if (anyOk) { await markLog(log.id, { status: 'sent', sent_at: now.toISOString() }); summary.sent++; }
    else { await markLog(log.id, { status: 'failed', error_message: lastErr, sent_at: now.toISOString() }); summary.failed++; }
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, ...summary }));
}
