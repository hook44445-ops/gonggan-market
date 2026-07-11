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
import { classifyContentType } from "./contentTypes.js";
import { schedulePublishAt } from "./publishScheduler.js";
import { runEditorialApproval } from "./editorialApprovalPolicy.js";

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

// 단건 PATCH.
async function sbPatch(id, patch) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/lounge_posts?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
    return r.ok;
  } catch { return false; }
}

// 회당 검토 상한(무한 방지).
const MAX_APPROVE_PER_RUN = 5;

// ── Phase 43: AI 조직 4인 검토 → 자동 승인분을 DB scheduled 로 전환(예약) ──────────
//   서버는 결정론적 4인 검토(발행 우선)만 수행하고, 승인분에 편성시각(scheduled_at)을 부여한다.
//   이후 publishDueScheduled 가 도래분을 published 로 발행. (localStorage 미의존 · DB가 진실원)
//   breaking(실시간 긴급뉴스)은 자동승인 제외 → 관리자 검토(초안 유지). Hard Fail/2:2 도 초안 유지.
async function autoApproveAndSchedule(now) {
  const L = "[autonomous-cycle][board]";
  const res = { reviewed: 0, scheduled: 0, needsReview: 0, rows: [] };
  try {
    const drafts = (await sbGet(
      `lounge_posts?publish_status=eq.draft&ai_topic=not.is.null&select=id,title,content,category,ai_topic,created_at&order=created_at.desc&limit=${MAX_APPROVE_PER_RUN}`
    )) ?? [];
    console.log(`${L} 후보 draft=${drafts.length}`);
    if (!drafts.length) return res;

    const cutoffIso = new Date(now - LOOKBACK_HOURS * 3600 * 1000).toISOString();
    const existing = (await sbGet(
      `lounge_posts?ai_topic=not.is.null&created_at=gte.${encodeURIComponent(cutoffIso)}&select=id,title,ai_topic,created_at&limit=500`
    )) ?? [];

    for (const d of drafts) {
      res.reviewed += 1;
      const type = classifyContentType(d.title || d.ai_topic || "");
      const eligible = type !== "breaking"; // breaking 은 관리자 검토
      // 서버는 LLM 보정 없이 현재 본문으로 결정론적 4인 검토(발행 우선).
      const r = await runEditorialApproval({ draft: { ...d, type }, existing });
      console.log(`${L} id=${d.id} type=${type} score=${r.qualityScore} grade=${r.grade} decision=${r.finalDecision} hardGate=${r.hardGatePassed} approvals=${r.approvalCount}/4 rev=${r.revisionCount} regen=${r.regenerationCount} board=${r.boardReviewCount}`);
      if (r.approved && eligible) {
        const at = schedulePublishAt(type, { now });
        const ok = await sbPatch(d.id, { publish_status: "scheduled", scheduled_at: at.toISOString(), updated_at: new Date(now).toISOString() });
        if (ok) { res.scheduled += 1; res.rows.push({ id: d.id, type, decision: r.finalDecision, grade: r.grade, score: r.qualityScore, scheduledAt: at.toISOString() }); console.log(`${L} → scheduled id=${d.id} at=${at.toISOString()}`); }
        else { res.needsReview += 1; console.warn(`${L} scheduled PATCH 실패 id=${d.id} → draft 유지`); }
      } else {
        res.needsReview += 1;
        res.rows.push({ id: d.id, type, decision: "NEEDS_REVIEW", grade: r.grade, score: r.qualityScore, reason: eligible ? (r.hardGate?.reasons || []) : ["breaking=관리자검토"] });
        console.log(`${L} → needs_review id=${d.id} (${eligible ? r.finalDecision : "breaking"})`);
      }
    }
    console.log(`${L} 완료 reviewed=${res.reviewed} scheduled=${res.scheduled} needsReview=${res.needsReview}`);
    return res;
  } catch (e) {
    console.error(`${L} EXCEPTION`, e?.stack || e?.message || String(e));
    return { ...res, error: e?.message ?? "error" };
  }
}

// 승인·예약·도래분 발행 — publish_status='scheduled' & scheduled_at<=now 를 published 로 전환.
// (check-trends 의 publishDueScheduled 와 동일 규칙 — 관리자가 승인·예약한 것만, 재실행해도 무해.)
// ── Phase 43 진단: 각 단계를 순서대로 로그(cron↓API↓publishDueScheduled↓publish↓DB update) ──
async function publishDueScheduled(now = Date.now()) {
  const L = "[autonomous-cycle][publishDueScheduled]";
  const nowIso = new Date(now).toISOString();
  const diag = { scheduledTotal: 0, dueCount: 0, notDue: 0, published: 0, rows: [], ok: false };
  try {
    console.log(`${L} 시작 now=${nowIso}`);

    // (3) 예약(scheduled) 글 전체 조회 — 시간 무관, 몇 건인지 먼저 로그.
    const scheduled = (await sbGet(
      `lounge_posts?publish_status=eq.scheduled&select=id,title,scheduled_at&order=scheduled_at.asc&limit=100`
    )) ?? [];
    diag.scheduledTotal = Array.isArray(scheduled) ? scheduled.length : 0;
    console.log(`${L} (3) scheduled count=${diag.scheduledTotal} (DB publish_status='scheduled')`);

    if (diag.scheduledTotal === 0) {
      // 예약 글이 0건 → 발행할 대상이 없음. (localStorage 예약은 서버에서 안 보임)
      console.log(`${L} 예약(scheduled) 글이 DB 에 0건 — 발행 대상 없음. (브라우저 localStorage 예약은 서버 미가시)`);
      diag.ok = true;
      return { ...diag, reason: "no_db_scheduled" };
    }

    // (4) 각 글의 예약시간 vs 현재시간 vs 발행 가능 여부 로그.
    const dueIds = [];
    for (const row of scheduled) {
      const due = row.scheduled_at != null && new Date(row.scheduled_at).getTime() <= now;
      console.log(`${L} (4) id=${row.id} scheduledAt=${row.scheduled_at ?? "null"} now=${nowIso} due=${due}`);
      diag.rows.push({ id: row.id, title: (row.title ?? "").slice(0, 40), scheduledAt: row.scheduled_at ?? null, due });
      if (due) dueIds.push(row.id); else diag.notDue += 1;
    }
    diag.dueCount = dueIds.length;
    // (5) Safety Gate: 서버는 "이미 승인·예약된 글"만 발행 — 별도 skip 사유 없음(승인·예약이 곧 게이트 통과).
    console.log(`${L} (5) SafetyGate: 서버측 추가 게이트 없음(승인·예약=통과). due=${diag.dueCount} notDue(미도래)=${diag.notDue}`);

    if (dueIds.length === 0) {
      console.log(`${L} 도래(due) 0건 — 예약은 있으나 아직 발행 시각 미도래. 발행 안 함.`);
      diag.ok = true;
      return { ...diag, reason: "none_due" };
    }

    // (6)(7) publish 실행 = DB UPDATE scheduled→published (도래분만 PATCH).
    console.log(`${L} (6) publish 실행: ${dueIds.length}건 scheduled→published PATCH`);
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
    if (!r.ok) {
      const body = await r.text().catch(() => r.statusText);
      console.error(`${L} (7) DB UPDATE 실패 status=${r.status} body=${body}`);
      return { ...diag, ok: false, reason: `db_update_failed:${r.status}`, error: body };
    }
    const rows = await r.json().catch(() => []);
    diag.published = Array.isArray(rows) ? rows.length : 0;
    diag.ok = true;
    console.log(`${L} (7) DB UPDATE 완료: published=${diag.published}건 (status scheduled→published, is_visible=true)`);
    return diag;
  } catch (e) {
    // (8) 예외 전체 출력.
    console.error(`${L} (8) EXCEPTION`, e?.stack || e?.message || String(e));
    return { ...diag, ok: false, reason: e?.message ?? "error", stack: e?.stack ?? null };
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
  const L = "[autonomous-cycle]";
  console.log(`${L} (2) runAutonomousCycle 진입 slot=${slot} kst=${kst} envReady=${!!(SB_URL && SB_KEY)}`);

  if (!SB_URL || !SB_KEY) {
    console.error(`${L} missing_env SUPABASE_URL/KEY 미설정 — DB 접근 불가`);
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

  console.log(`${L} (2) 생성 단계: todayCount=${todayCount} need=${need} generated=${generated}`);

  // 3) AI 조직 4인 검토 → 자동 승인분 예약(scheduled) 전환.
  console.log(`${L} autoApproveAndSchedule 호출`);
  const board = await autoApproveAndSchedule(now);
  console.log(`${L} board 결과 reviewed=${board.reviewed} scheduled=${board.scheduled} needsReview=${board.needsReview}`);

  // 4) 승인·예약·도래분 발행(Safety Gate: DB 상태만으로 판정, 재실행 무해).
  console.log(`${L} publishDueScheduled 호출`);
  const pub = await publishDueScheduled(now);
  console.log(`${L} publishDueScheduled 결과 scheduledTotal=${pub.scheduledTotal} due=${pub.dueCount} published=${pub.published} reason=${pub.reason ?? "-"}`);

  return {
    ok: true,
    slot,
    dateKey,
    kst,
    todayCount,
    targetPerDay: DAILY_DRAFT_TARGET,
    maxPerRun: MAX_DRAFTS_PER_RUN,
    // Phase 43: AI 조직 4인 검토 → 자동승인·예약 결과.
    boardDiag: { reviewed: board.reviewed, scheduled: board.scheduled, needsReview: board.needsReview, rows: board.rows ?? [] },
    // 진단: 예약/도래/발행 상세(응답으로 바로 확인 가능).
    publishDiag: { scheduledTotal: pub.scheduledTotal, dueCount: pub.dueCount, notDue: pub.notDue, published: pub.published, reason: pub.reason ?? null, rows: pub.rows ?? [] },
    generated,
    drafts,
    published: pub.published,
    publishOk: pub.ok,
  };
}
