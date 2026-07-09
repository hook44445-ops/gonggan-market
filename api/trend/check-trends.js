// ─────────────────────────────────────────────────────
// 공간라운지 AI 콘텐츠 공장 — Trend Scheduler (Phase 2, Vercel Serverless)
//
// 파이프라인: Trend Collect → Duplicate Check(48h) → Topic Score/Priority →
//            Category Mapping → Draft Generate → lounge_posts 에 DRAFT 저장.
//
// ⚠️ 안전 규칙(하드코딩, 예외 없음):
//   · 이 엔드포인트는 절대 publish_status='published' 또는 'scheduled' 를
//     쓰지 않는다 — 항상 'draft' + is_visible=false 로만 저장한다.
//   · 자동 발행은 이 파이프라인의 책임이 아니다(별도 api/lounge/publish-scheduled.js
//     가 "이미 관리자가 승인한 예약"만 실행한다 — 여기서 만든 draft 는 대상이 아님).
//
// 운영: Vercel Cron(vercel.json "crons")이 3시간마다 호출.
// 필요 env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY(RLS 우회, 없으면 ANON 폴백 —
//   lounge_posts 는 이미 anon insert/update 정책이 열려 있어 폴백도 동작한다).
// 미설정/실패 시 graceful no-op(앱에 영향 없음).
// ─────────────────────────────────────────────────────

import { collectAllTrends } from '../../src/lib/trendCollector.js';
import { scoreTopic, priorityFromScore } from '../../src/lib/topicScore.js';
import { mapCategory } from '../../src/lib/categoryMapper.js';
import { filterNewTopics } from '../../src/lib/duplicateChecker.js';
import { generateDraft } from '../../src/constants/aiContentFactory.js';

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

export default async function handler(req, res) {
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

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      ok: true,
      collected: collected.length,
      providerResults: providerResults.map((r) => ({ providerId: r.providerId, status: r.status, count: r.items.length })),
      deduped: fresh.length,
      created: created.length,
      drafts: created,
    }));
  } catch (e) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, reason: e?.message ?? 'error', collected: 0, created: 0 }));
  }
}
