// ════════════════════════════════════════════════════════════════════
// 공간라운지 Server Autonomous Cycle — 서버 자율 사이클 V1 (Phase 39)
//
//   관리자 브라우저가 닫혀 있어도, 외부 스케줄러(예: cron-job.org, 5분)가 호출하면
//   DB 상태만으로 하루를 이어서 운영한다:
//     (1) 오늘 목표 대비 부족한 draft 를 자동 생성(중복 방지 + 하루 상한)
//     (2) 관리자가 승인·예약(publish_status='scheduled')하고 시각이 도래한 글을 발행
//
//   ⚠️ 한계(정직하게 명시):
//     · 자율 토글/자동발행 ON·OFF/긴급정지/큐/오늘생성 플래그는 전부 관리자 브라우저
//       localStorage 에 있어 서버에서 접근 불가하다. 따라서 서버 사이클은 DB(lounge_posts
//       의 publish_status/scheduled_at)를 유일한 진실원으로 삼는다.
//     · Safety Gate = "관리자가 이미 승인·예약한, 시각이 도래한 글만" 발행. 서버는 새 승인
//       결정을 내리지 않으며, 생성물은 항상 draft + is_visible=false 로만 저장한다.
//   ⚠️ DB 스키마 변경 없음 · 기존 lounge_posts 컬럼만 사용 · additive. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { collectAllTrends } from "./trendCollector.js";
import { scoreTopic, priorityFromScore } from "./topicScore.js";
import { mapCategory } from "./categoryMapper.js";
import { filterNewTopics } from "./duplicateChecker.js";
import { generateDraft } from "../constants/aiContentFactory.js";
import { slotKey, kstDateKey, kstIso, kstMidnightUtcIso } from "./cronRunGuard.js";

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SB_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

// 회당 생성 상한(5분마다 호출되므로 낮게 — 무한 증식 방지).
const MAX_DRAFTS_PER_RUN = 3;
// KST 하루 목표 draft 수(초과 생성 방지).
const DAILY_DRAFT_TARGET = 5;
// 중복 검사 대상 조회 기간(48h window 보다 넉넉히 조회 후 라이브러리에서 정확히 필터).
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
    method: "POST",
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  if (!r.ok) return { error: await r.text().catch(() => r.statusText) };
  const data = await r.json().catch(() => null);
  return { data: Array.isArray(data) ? data[0] : data };
}

// 승인·예약·도래분 발행 — publish_status='scheduled' & scheduled_at<=now 를 published 로 전환.
// (check-trends 의 publishDueScheduled 와 동일 규칙 — 관리자가 승인·예약한 것만, 재실행해도 무해.)
async function publishDueScheduled(now = Date.now()) {
  try {
    const nowIso = new Date(now).toISOString();
    const r = await fetch(
      `${SB_URL}/rest/v1/lounge_posts?publish_status=eq.scheduled&scheduled_at=lte.${encodeURIComponent(nowIso)}`,
      {
        method: "PATCH",
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ publish_status: "published", is_visible: true, updated_at: nowIso }),
      }
    );
    const rows = r.ok ? await r.json().catch(() => []) : [];
    return { ok: r.ok, published: Array.isArray(rows) ? rows.length : 0 };
  } catch (e) {
    return { ok: false, published: 0, reason: e?.message ?? "error" };
  }
}

// KST 오늘 생성된 AI draft/글 수(하루 목표 대비 부족분만 생성하기 위한 집계).
async function countTodayAiPosts(now = Date.now()) {
  const startIso = kstMidnightUtcIso(now);
  const rows =
    (await sbGet(
      `lounge_posts?ai_topic=not.is.null&created_at=gte.${encodeURIComponent(startIso)}&select=id&limit=200`
    )) ?? [];
  return Array.isArray(rows) ? rows.length : 0;
}

// 서버 자율 사이클 1회 실행. 반환 JSON 에는 비밀을 절대 포함하지 않는다.
export async function runAutonomousCycle({ now = Date.now() } = {}) {
  const slot = slotKey(now);
  const dateKey = kstDateKey(now);
  const kst = kstIso(now);

  if (!SB_URL || !SB_KEY) {
    return { ok: false, reason: "missing_env", slot, dateKey, kst, generated: 0, published: 0 };
  }

  // 1) 오늘 목표 대비 부족분 계산(하루 상한 + 회당 상한).
  const todayCount = await countTodayAiPosts(now);
  const need = Math.max(0, Math.min(MAX_DRAFTS_PER_RUN, DAILY_DRAFT_TARGET - todayCount));

  // 2) 부족하면 생성(트렌드 파이프라인 재사용 — 항상 draft + is_visible=false).
  let generated = 0;
  const drafts = [];
  if (need > 0) {
    try {
      const { items: collected } = await collectAllTrends();
      const cutoffIso = new Date(now - LOOKBACK_HOURS * 3600 * 1000).toISOString();
      const existing =
        (await sbGet(
          `lounge_posts?ai_topic=not.is.null&created_at=gte.${encodeURIComponent(cutoffIso)}&select=ai_topic,title,created_at&limit=500`
        )) ?? [];
      const fresh = filterNewTopics(collected, existing, 48).slice(0, need);
      for (const item of fresh) {
        const { category } = mapCategory(item.topic);
        const score = scoreTopic({ topic: item.topic, region: item.region ?? null, collectedAt: item.collectedAt });
        const priority = priorityFromScore(score.total);
        const draft = generateDraft({ issue: item.topic, category, region: item.region ?? null });
        const { data, error } = await sbInsertDraft({
          user_id: null,
          anonymous_nickname: "공간마켓",
          category: draft.category,
          title: draft.title,
          content: draft.content,
          region: item.region ?? null,
          image_urls: [],
          is_seed: true,
          is_visible: false, // ⚠️ 절대 true 금지 — 관리자 승인 전 비공개.
          publish_status: "draft", // ⚠️ 절대 published/scheduled 금지.
          scheduled_at: null,
          ai_topic: item.topic,
        });
        if (!error) {
          generated++;
          drafts.push({ id: data?.id ?? null, topic: item.topic, category: draft.category, priority });
        }
      }
    } catch (e) {
      // 생성 실패는 무해 — 발행 단계는 계속 진행.
      drafts.push({ error: e?.message ?? "generate_error" });
    }
  }

  // 3) 승인·예약·도래분 발행(Safety Gate: DB 상태만으로 판정, 재실행 무해).
  const pub = await publishDueScheduled(now);

  return {
    ok: true,
    slot,
    dateKey,
    kst,
    todayCount,
    targetPerDay: DAILY_DRAFT_TARGET,
    maxPerRun: MAX_DRAFTS_PER_RUN,
    generated,
    drafts,
    published: pub.published,
    publishOk: pub.ok,
  };
}
