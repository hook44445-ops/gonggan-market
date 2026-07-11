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
import { authenticateCron } from '../../src/lib/cronAuth.js';
import { runAutonomousCycle } from '../../src/lib/serverAutonomousCycle.js';

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
      console.log(`[autonomous-cycle] 완료 published=${result?.publishDiag?.published ?? 0} scheduledTotal=${result?.publishDiag?.scheduledTotal ?? 0} due=${result?.publishDiag?.dueCount ?? 0}`);
      return sendJson(200, { mode: 'autonomous', ...result });
    } catch (e) {
      console.error('[autonomous-cycle] (8) 핸들러 EXCEPTION', e?.stack || e?.message || String(e));
      return sendJson(200, { ok: false, mode: 'autonomous', reason: e?.message ?? 'error', stack: e?.stack ?? null });
    }
  }
  // ───────────────────────────────────────────────────────────────────────

  if (!SB_URL || !SB_KEY) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, reason: 'missing_env', collected: 0, created: 0 }));
    return;
  }

  try {
    // 1) Trend Collect — enabled Provider만 실제 수집(Phase2: manual 시드만 활성).
    const { items: collected, providerResults } = await collectAllTrends();

    // 2) Duplicate Check 대상 — 최근 lounge_posts(ai_topic 존재, draft/scheduled/published 모두 포함).
    const cutoffIso = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000).toISOString();
    const existing = await sbGet(
      `lounge_posts?ai_topic=not.is.null&created_at=gte.${encodeURIComponent(cutoffIso)}&select=ai_topic,title,created_at&limit=500`
    ) ?? [];

    // 3) 같은 배치/기존 저장분과 48시간 이내 중복 제거.
    const fresh = filterNewTopics(collected, existing, 48).slice(0, MAX_DRAFTS_PER_RUN);

    // 4) Topic Score/Priority + Category Mapping → 5) Draft Generate → 6) DRAFT 저장.
    const created = [];
    for (const item of fresh) {
      const { category } = mapCategory(item.topic);
      const score = scoreTopic({ topic: item.topic, region: item.region ?? null, collectedAt: item.collectedAt });
      const priority = priorityFromScore(score.total);
      const draft = generateDraft({ issue: item.topic, category, region: item.region ?? null });

      const { data, error } = await sbInsertDraft({
        user_id:            null,
        anonymous_nickname:  '공간마켓',
        category:            draft.category,
        title:               draft.title,
        content:             draft.content,
        region:              item.region ?? null,
        image_urls:          [],
        is_seed:             true,
        is_visible:          false,   // ⚠️ 절대 true 로 두지 않음 — 관리자 승인 전 비공개.
        publish_status:      'draft', // ⚠️ 절대 published/scheduled 로 두지 않음.
        scheduled_at:        null,
        ai_topic:            item.topic,
      });
      if (!error) {
        created.push({ id: data?.id ?? null, topic: item.topic, category: draft.category, priority, score: score.total, providerId: item.providerId });
      }
    }

    // 7) 예약 발행 배치(승인된 예약만 시각 도래 시 실행) — 트렌드 수집과 독립, 실패해도 무해.
    const scheduled = await publishDueScheduled();

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      ok: true,
      collected: collected.length,
      providerResults: providerResults.map((r) => ({ providerId: r.providerId, status: r.status, count: r.items.length })),
      deduped: fresh.length,
      created: created.length,
      drafts: created,
      publishedScheduled: scheduled.published,
    }));
  } catch (e) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, reason: e?.message ?? 'error', collected: 0, created: 0 }));
  }
}
