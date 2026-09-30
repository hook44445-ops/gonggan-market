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
// 아이폰 앱(Expo · PLAN-2026-09-30 4절): platform='ios_expo' 토큰은 Expo 로 보낸다
//   POST https://exp.host/--/api/v2/push/send { to, title, body, data: { url } } — 키 없이 된다.
//   (Expo 쪽에서 «Enhanced security» 를 켰을 때만 env EXPO_ACCESS_TOKEN — 서버 전용, VITE_ 금지)
//   기기에서 앱이 지워진 토큰(DeviceNotRegistered)은 끈다(is_active=false · 지우지 않음).
//
// 필요 env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY(RLS 우회),
//           그리고 FIREBASE_SERVICE_ACCOUNT(v1) 또는 FCM_SERVER_KEY(legacy) 중 하나(웹·안드로이드).
// FCM 미설정이어도 아이폰(Expo)은 나간다. 웹 토큰만 있는 알림은 FCM 이 될 때까지 queued 로 둔다.
// ─────────────────────────────────────────────────────

import crypto from 'crypto';
import { EXPO_PUSH_URL, NATIVE_PUSH_PLATFORM, expoPushMessage, readExpoTickets } from '../../src/lib/nativePush.js';
import { isNewsType, isWithinNewsWindow, NEWS_DAILY_CAP, NEWS_TYPES, isAdType, isWithinAdWindow, AD_MAX_AGE_MS, AD_TYPES } from '../../src/utils/pushPolicy.js';

const SB_URL  = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SB_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FCM_KEY = process.env.FCM_SERVER_KEY || '';                 // Legacy(폴백 전용)
const SA_RAW  = process.env.FIREBASE_SERVICE_ACCOUNT || '';        // HTTP v1(서비스계정 JSON)
const EXPO_TOKEN = process.env.EXPO_ACCESS_TOKEN || '';           // 선택(Expo Enhanced security 켠 경우만)

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

// ── Expo(아이폰 앱) 발송 — 한 알림을 그 사람의 아이폰 토큰 전부에 한 번에 ─────────
async function sendExpo(tokens, log) {
  try {
    const r = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(EXPO_TOKEN ? { Authorization: `Bearer ${EXPO_TOKEN}` } : {}),
      },
      body: JSON.stringify(tokens.map((t) => expoPushMessage(t, log))),
    });
    let json = null;
    try { json = await r.json(); } catch {}
    return readExpoTickets(tokens, json);
  } catch (e) {
    return { okCount: 0, deadTokens: [], lastErr: String(e?.message || 'expo_fetch_failed').slice(0, 300) };
  }
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (!SB_URL || !SB_KEY) { res.statusCode = 200; res.end(JSON.stringify({ ok: false, reason: 'no_db_credentials' })); return; }

  // 단계 사진 48시간 자동 승인(migration 112) — pg_cron 이 없을 때를 위한 대체 실행.
  // 발송기가 돌 때(크론·새 알림 깨우기)마다 함께 돈다. 실패해도 발송은 계속한다.
  try {
    await fetch(`${SB_URL}/rest/v1/rpc/escrow_auto_approve_due`, { method: 'POST', headers: sbHeaders(), body: '{}' });
  } catch { /* noop */ }
  // 견적이 3일째 없는 요청 — 고객에게 한 번(migration 152 · 한국 시간 9~21시만, 중복은 서버가 막음). 없으면(152 전) 조용히 넘어감.
  try {
    await fetch(`${SB_URL}/rest/v1/rpc/request_nudge_due`, { method: 'POST', headers: sbHeaders(), body: '{}' });
  } catch { /* noop */ }
  // 견적 2개 이상 받고 이틀째 못 고른 요청 — «최저~최고 · 차이» 한 번(migration 172). 없으면(172 전) 조용히 넘어감.
  try {
    await fetch(`${SB_URL}/rest/v1/rpc/bid_compare_nudge_due`, { method: 'POST', headers: sbHeaders(), body: '{}' });
  } catch { /* noop */ }
  // 같은 요청을 동네 업체 쪽에서 — «지금 입찰하면 첫 견적이에요»(migration 153 · 한도 안 · 업체당 하루 3건)
  try {
    await fetch(`${SB_URL}/rest/v1/rpc/request_partner_nudge_due`, { method: 'POST', headers: sbHeaders(), body: '{}' });
  } catch { /* noop */ }

  // 초대왕 이벤트 광고 푸시(migration 157) — 동의한 사람만 · 한국 9~20시 · 시작/마감 3일 전 한 번씩. 없으면(157 전) 조용히 넘어감.
  try {
    await fetch(`${SB_URL}/rest/v1/rpc/referral_event_push_due`, { method: 'POST', headers: sbHeaders(), body: '{}' });
  } catch { /* noop */ }

  // 초대왕 순위 변동(migration 160) — 3등 안에 들거나 밀리면 알림함(+광고 동의자는 9~20시 푸시). 없으면(160 전) 조용히 넘어감.
  try {
    await fetch(`${SB_URL}/rest/v1/rpc/referral_event_rank_notify_due`, { method: 'POST', headers: sbHeaders(), body: '{}' });
  } catch { /* noop */ }

  // 업체 페이지 방문 수 주간 요약(migration 161) — 한국 월요일 9~20시에 한 번. 없으면(161 전) 조용히 넘어감.
  try {
    await fetch(`${SB_URL}/rest/v1/rpc/company_page_weekly_due`, { method: 'POST', headers: sbHeaders(), body: '{}' });
  } catch { /* noop */ }

  // 업체 주간 «지난주 우리 동네 새 요청 N건 · 아직 입찰할 수 있는 K건»(migration 171) — 한국 월요일 9~20시에 한 번. 없으면(171 전) 조용히 넘어감.
  try {
    await fetch(`${SB_URL}/rest/v1/rpc/company_region_weekly_due`, { method: 'POST', headers: sbHeaders(), body: '{}' });
  } catch { /* noop */ }

  // 라운지 주간 인기 글(migration 174) — 한국 월요일 9~20시 한 번 · 최근 60일 라운지 쓴 사람. 없으면(174 전) 조용히 넘어감.
  try {
    await fetch(`${SB_URL}/rest/v1/rpc/lounge_weekly_digest_due`, { method: 'POST', headers: sbHeaders(), body: '{}' });
  } catch { /* noop */ }

  // 출석 연속 기록 끊기기 전 알림(migration 164) — 한국 17~20시 · 하루 한 번 · 푸시는 광고 동의자만. 없으면(164 전) 조용히 넘어감.
  try {
    await fetch(`${SB_URL}/rest/v1/rpc/checkin_reminder_due`, { method: 'POST', headers: sbHeaders(), body: '{}' });
  } catch { /* noop */ }

  // 내 집 관리 수첩 시기 알림(migration 165) — 한국 9~20시 · 같은 항목 30일에 한 번. 없으면(165 전) 조용히 넘어감.
  try {
    await fetch(`${SB_URL}/rest/v1/rpc/home_care_due`, { method: 'POST', headers: sbHeaders(), body: '{}' });
  } catch { /* noop */ }

  // 발송 경로 결정: v1(서비스계정) 우선, 없으면 legacy(서버키) 폴백.
  //   FCM 이 안 돼도 아이폰(Expo)은 보낸다 — 웹 토큰만 있는 알림은 queued 로 남겨 다음에.
  const useV1 = !!SA;
  let accessToken = null;
  let fcmReady = true;
  let fcmReason = null;
  if (useV1) {
    accessToken = await getAccessToken();
    if (!accessToken) { fcmReady = false; fcmReason = 'fcm_v1_auth_failed'; }
  } else if (!FCM_KEY) {
    fcmReady = false; fcmReason = 'no_fcm_credentials';
  }

  // 광고 시간 밖이면 광고는 아예 안 가져온다 — 밀린 광고가 200칸을 차지해 계약·대화 알림을 막지 않게
  const adFilter = isWithinAdWindow(new Date()) ? '' : `&type=not.in.(${AD_TYPES.join(',')})`;
  const queued = await sbGet(`push_logs?status=eq.queued${adFilter}&select=id,user_id,type,title,body,target_url,related_id,created_at&order=created_at.asc&limit=200`);
  if (!Array.isArray(queued)) { res.statusCode = 200; res.end(JSON.stringify({ ok: false, reason: 'query_failed' })); return; }

  const now = new Date();
  const summary = { processed: 0, sent: 0, failed: 0, skipped: 0, held: 0, expo_sent: 0, transport: fcmReady ? (useV1 ? 'v1' : 'legacy') : 'expo_only', ...(fcmReason ? { fcm: fcmReason } : {}) };
  const since24h = new Date(now.getTime() - 24 * 3600000).toISOString();

  for (const log of queued) {
    summary.processed++;

    // 광고성(157): 한국 9~20시에만 · 이틀 넘은 건 버림 · 보내기 직전에 동의가 아직 켜져 있는지 다시 본다
    if (isAdType(log.type)) {
      if (!isWithinAdWindow(now)) { continue; }
      if (log.created_at && now.getTime() - Date.parse(log.created_at) > AD_MAX_AGE_MS) {
        await markLog(log.id, { status: 'skipped', error_message: 'ad_expired', sent_at: now.toISOString() });
        summary.skipped++;
        continue;
      }
      const pref = await sbGet(`push_preferences?user_id=eq.${encodeURIComponent(log.user_id)}&select=push_enabled,push_marketing&limit=1`);
      const p = Array.isArray(pref) ? pref[0] : null;
      if (!p || p.push_enabled !== true || p.push_marketing !== true) {
        await markLog(log.id, { status: 'skipped', error_message: 'ad_no_consent', sent_at: now.toISOString() });
        summary.skipped++;
        continue;
      }
    }

    // 소식성: 시간창 밖이면 보류(queued 유지), 하루 캡 초과면 skip
    if (isNewsType(log.type)) {
      if (!isWithinNewsWindow(now)) { continue; }
      // 캡은 «소식성»만 센다. 타입을 안 좁히면 계약·대화 알림 3건만 받아도
      // 동네 소식이 캡에 걸려 막힌다.
      const sentToday = await sbGet(
        `push_logs?user_id=eq.${encodeURIComponent(log.user_id)}&status=eq.sent`
        + `&type=in.(${NEWS_TYPES.join(',')})`
        + `&sent_at=gte.${encodeURIComponent(since24h)}&select=id&limit=${NEWS_DAILY_CAP + 1}`
      );
      const newsSent = Array.isArray(sentToday) ? sentToday.length : 0;
      if (newsSent >= NEWS_DAILY_CAP) {
        await markLog(log.id, { status: 'skipped', error_message: 'daily_cap', sent_at: now.toISOString() });
        summary.skipped++;
        continue;
      }
    }

    const tokens = await sbGet(`fcm_tokens?user_id=eq.${encodeURIComponent(log.user_id)}&is_active=eq.true&select=token,platform`);
    if (!Array.isArray(tokens) || tokens.length === 0) {
      await markLog(log.id, { status: 'skipped', error_message: 'no_token', sent_at: now.toISOString() });
      summary.skipped++;
      continue;
    }
    const expoTokens = tokens.filter((t) => t.platform === NATIVE_PUSH_PLATFORM).map((t) => t.token);
    const fcmTokens = tokens.filter((t) => t.platform !== NATIVE_PUSH_PLATFORM).map((t) => t.token);
    // FCM 이 지금 안 되고 아이폰 토큰도 없으면 — 버리지 않고 다음 차례에
    if (!fcmReady && expoTokens.length === 0) { summary.held++; continue; }

    let anyOk = false;
    let lastErr = null;
    if (fcmReady) {
      for (const token of fcmTokens) {
        const { ok, detail } = useV1
          ? await sendFcmV1(accessToken, token, log)
          : await sendFcmLegacy(token, log);
        if (ok) anyOk = true;
        else lastErr = JSON.stringify(detail)?.slice(0, 300) ?? 'fcm_error';
      }
    }
    if (expoTokens.length > 0) {
      const { okCount, deadTokens, lastErr: expoErr } = await sendExpo(expoTokens, log);
      if (okCount > 0) { anyOk = true; summary.expo_sent++; }
      if (expoErr) lastErr = expoErr;
      for (const dead of deadTokens) {
        await sbPatch(`fcm_tokens?token=eq.${encodeURIComponent(dead)}`, { is_active: false, updated_at: now.toISOString() });
      }
    }

    if (anyOk) { await markLog(log.id, { status: 'sent', sent_at: now.toISOString() }); summary.sent++; }
    else { await markLog(log.id, { status: 'failed', error_message: lastErr, sent_at: now.toISOString() }); summary.failed++; }
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, ...summary }));
}
