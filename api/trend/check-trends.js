// ─────────────────────────────────────────────────────
// 공간라운지 AI 콘텐츠 공장 — Trend Scheduler (Phase 2, Vercel Serverless)
//
// 파이프라인: Trend Collect → Duplicate Check(48h) → Topic Score/Priority →
//            Category Mapping → Draft Generate → lounge_posts 에 DRAFT 저장.
//
// ⚠️ 안전 규칙(하드코딩, 예외 없음):
//   · 트렌드 수집 파이프라인은 절대 publish_status='published' 또는 'scheduled' 를
//     쓰지 않는다 — 항상 'draft' + is_visible=false 로만 저장한다(자동 발행 없음).
//   · 별도 단계 publishDueScheduled() 는 "이미 관리자가 승인해 예약한" 글만 시각 도래 시
//     발행한다(여기서 만든 draft 는 대상이 아님). 구 api/lounge/publish-scheduled.js 로직을
//     통합한 것으로, Vercel Hobby 함수 개수 한도(12개)를 넘지 않기 위한 조치다.
//
// 운영: Vercel Cron(vercel.json "crons")이 하루 1회 호출(Hobby 플랜 = 일 1회 제한).
//       관리자 화면 "지금 트렌드 확인" 버튼으로도 수동 호출 가능(같은 엔드포인트).
// 필요 env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY(RLS 우회, 없으면 ANON 폴백 —
//   lounge_posts 는 이미 anon insert/update 정책이 열려 있어 폴백도 동작한다).
// 미설정/실패 시 graceful no-op(앱에 영향 없음).
// ─────────────────────────────────────────────────────

import { collectAllTrends } from '../../src/lib/trendCollector.js';
import { scoreTopic, priorityFromScore } from '../../src/lib/topicScore.js';
import { mapCategory } from '../../src/lib/categoryMapper.js';
import { filterNewTopics } from '../../src/lib/duplicateChecker.js';
import { generateDraft } from '../../src/constants/aiContentFactory.js';
import { ensureImageUrls } from '../../src/lib/approvalImage.js';
import { authenticateCron } from '../../src/lib/cronAuth.js';
import { runAutonomousCycle } from '../../src/lib/serverAutonomousCycle.js';
import { llmStatus } from '../../src/lib/serverLoungeWriter.js';

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// 한 번 실행에 생성하는 draft 수 상한(안전장치 — 무한 증식 방지).
const MAX_DRAFTS_PER_RUN = 5;
// 중복 검사 대상 조회 기간(중복판정 window 48h 보다 넉넉하게 조회 후 라이브러리에서 정확히 필터).
const LOOKBACK_HOURS = 72;

async function sbGet(path) {
  if (!SB_URL || !SB_KEY) return null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function sbInsertDraft(row) {
  const res = await sbInsertDraftRaw(row);
  // ai_source 칸(SQL 140) 전이면 표시 없이 한 번 더 — 초안 만들기는 멈추지 않는다
  if (res.error && /ai_source/.test(String(res.error)) && row.ai_source) {
    const { ai_source, ...rest } = row; // eslint-disable-line no-unused-vars
    return sbInsertDraftRaw(rest);
  }
  return res;
}
async function sbInsertDraftRaw(row) {
  const r = await fetch(`${SB_URL}/rest/v1/lounge_posts`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });
  if (!r.ok) return { error: await r.text().catch(() => r.statusText) };
  const data = await r.json().catch(() => null);
  return { data: Array.isArray(data) ? data[0] : data };
}

// 예약 발행 배치 — publish_status='scheduled' 이고 scheduled_at 이 지난 글을 published 로 전환.
// (구 api/lounge/publish-scheduled.js 로직을 그대로 통합 — Vercel Hobby 함수 개수 한도(12개) 대응.
//  관리자가 이미 승인해 "예약"한 것을 시각 도래 시 실행만 하며, 새 승인 결정은 내리지 않는다.)
async function publishDueScheduled() {
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
    return { ok: r.ok, published: Array.isArray(rows) ? rows.length : 0 };
  } catch (e) {
    return { ok: false, published: 0, reason: e?.message ?? 'error' };
  }
}

export default async function handler(req, res) {
  const sendJson = (status, obj) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
  };

  // ── Phase 39 — 서버 자율 사이클(외부 스케줄러 전용) ─────────────────────
  // vercel.json rewrite: /api/cron/autonomous-cycle → 이 엔드포인트(?mode=autonomous).
  // 기존 일 1회 Vercel Cron 경로(mode 없음)는 아래 로직 그대로 — Regression Zero.
  // 인증: Authorization: Bearer <CRON_SECRET>. 미설정 503 · 불일치 401. 비밀 원문 미노출.
  // AI 글쓰기 연결 상태(관리자 AI 운영본부·조직도) — 비밀 없음: 연결 여부·모델 이름만(09-26)
  if (req.query?.mode === 'llm_status') {
    try { return sendJson(200, { ok: true, ...(await llmStatus()) }); }
    catch (e) { return sendJson(200, { ok: false, configured: false, reason: e?.message ?? 'error' }); }
  }

  if (req.query?.mode === 'autonomous') {
    // (1) cron-job.org → autonomous-cycle API 도착 로그(비밀 미출력).
    console.log(`[autonomous-cycle] (1) API 도착 method=${req.method} ua=${(req.headers?.['user-agent'] || '').slice(0, 60)} hasAuth=${!!(req.headers?.authorization)}`);
    const auth = authenticateCron(req);
    if (!auth.ok) {
      console.warn(`[autonomous-cycle] (1) 인증 실패 code=${auth.code} status=${auth.status}`);
      return sendJson(auth.status, { ok: false, code: auth.code });
    }
    console.log('[autonomous-cycle] (1) 인증 통과 → runAutonomousCycle 호출');
    try {
      const result = await runAutonomousCycle({ now: Date.now() });
      // 발행된 글의 라운지 새 글 푸시(139 트리거가 큐에 넣음)를 지금 내보낸다 — 크론은 하루 1회라 없으면 늦는다
      {   // 예약 도래·즉시 발행 어느 쪽이든 — 큐가 비어 있으면 발송기는 금방 끝난다
        try {
          const base = process.env.PUSH_DISPATCH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
          if (base) await fetch(base.startsWith('http') ? `${base.replace(/\/$/, '')}/api/push/dispatch` : base, { method: 'POST' });
        } catch { /* 다음 발송 때 나간다 */ }
      }
      console.log(`[autonomous-cycle] 완료 published=${result?.publishDiag?.published ?? 0} scheduledTotal=${result?.publishDiag?.scheduledTotal ?? 0} due=${result?.publishDiag?.dueCount ?? 0}`);
      return sendJson(200, { mode: 'autonomous', ...result });
    } catch (e) {
      console.error('[autonomous-cycle] (8) 핸들러 EXCEPTION', e?.stack || e?.message || String(e));
      return sendJson(200, { ok: false, mode: 'autonomous', reason: e?.message ?? 'error' });   // 스택은 로그에만(응답 노출 금지)
    }
  }
  // ───────────────────────────────────────────────────────────────────────

  // 일 1회 경로도 인증(09-26 검토) — 예전엔 누구나 GET 한 번으로 초안을 만들고 예약 글을 발행시킬 수 있었다.
  // Vercel Cron 은 CRON_SECRET 이 설정돼 있으면 Authorization: Bearer <CRON_SECRET> 을 자동으로 붙인다.
  {
    const auth = authenticateCron(req);
    if (!auth.ok) return sendJson(auth.status, { ok: false, code: auth.code });
  }

  if (!SB_URL || !SB_KEY) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, reason: 'missing_env', collected: 0, created: 0 }));
    return;
  }

  // 09-26: 일 1회 크론도 자율 사이클 하나로 — 예전엔 여기서 옛 틀(generateDraft·주제 단어로 카테고리)로 따로 글을 만들어
  //   AI 글쓰기·라운지 카테고리 주제·카테고리 사진을 거치지 않은 초안이 섞였다(업체 글이 «생활» 칸으로 가는 등).
  try {
    const result = await runAutonomousCycle({ now: Date.now() });
    return sendJson(200, { mode: 'daily', ...result });
  } catch (e) {
    console.error('[check-trends] daily EXCEPTION', e?.stack || e?.message || String(e));
    return sendJson(200, { ok: false, mode: 'daily', reason: e?.message ?? 'error' });
  }
}
