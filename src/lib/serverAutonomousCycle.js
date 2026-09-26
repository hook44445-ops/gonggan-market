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
import { composeCategoryPost } from "../constants/loungeCategoryTopics.js";
import { dayIndexOf } from "../constants/loungeTopicPool.js";
import { slotKey, kstDateKey, kstIso, kstMidnightUtcIso } from "./cronRunGuard.js";
import { classifyContentType } from "./contentTypes.js";
import { schedulePublishAt } from "./publishScheduler.js";
import { runEditorialApproval } from "./editorialApprovalPolicy.js";
import { findDuplicate, editorialKey } from "./editorialKey.js";
import { decidePublishMode } from "./publishModeDecider.js";
import { computeBudget, canPublish, isRegular } from "./dailyPublishBudget.js";
import { ensureImageUrls } from "./approvalImage.js";
import { fetchGoogleTrendsKR, fetchNaverNews, fetchKmaTomorrow } from "./trendSources.js";
import { composeTrendRoundup, composeNewsPost, composeWeatherPost, kstYmd, ymdKey } from "./newsPosts.js";

// 하루 AI 글 발행 총량 — dailyPublishBudget 의 총량(정기 10 + 수시 5)과 같게. 예약 발행에도 적용.
const DAILY_PUBLISH_CAP = 15;

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
  const res = await sbInsertDraftRaw(row);
  // ai_source 칸(SQL 140)이 아직 없으면 표시 없이 한 번 더 — 초안 만들기는 멈추지 않게(자동 승인은 표시 있는 것만이라 안전)
  if (res.error && /ai_source/.test(String(res.error)) && row.ai_source) {
    const { ai_source, ...rest } = row; // eslint-disable-line no-unused-vars
    return sbInsertDraftRaw(rest);
  }
  return res;
}
async function sbInsertDraftRaw(row) {
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
// ⑯ 회당 발행 상한 — 놓친 예약 다수를 한 번에 쏟지 않고 사이클마다 3건씩 회수.
const MAX_PUBLISH_PER_RUN = 3;

// ── Phase 43: AI 조직 4인 검토 → 자동 승인분을 DB scheduled 로 전환(예약) ──────────
//   서버는 결정론적 4인 검토(발행 우선)만 수행하고, 승인분에 편성시각(scheduled_at)을 부여한다.
//   이후 publishDueScheduled 가 도래분을 published 로 발행. (localStorage 미의존 · DB가 진실원)
//   breaking(실시간 긴급뉴스)은 자동승인 제외 → 관리자 검토(초안 유지). Hard Fail/2:2 도 초안 유지.
async function autoApproveAndSchedule(now) {
  const L = "[autonomous-cycle][board]";
  const res = { reviewed: 0, scheduled: 0, needsReview: 0, rows: [] };
  try {
    const drafts = (await sbGet(
      // 서버가 틀로 만든 초안(ai_source=server_template)만 자동 승인한다(09-26 검토).
      //   예전엔 ai_topic 이 있는 초안이면 누가 만들었든 승인·발행 — 브라우저 AI 초안(아침 뉴스처럼 사설을 지어낼 수 있는 것),
      //   AI 사장실 «승인», 검증용 초안까지 관리자 확인 없이 나갔다. 그 초안들은 관리자가 「AI 콘텐츠 공장」에서 직접 발행한다.
      //   ai_source 칸이 없으면(SQL 140 전) 조회가 실패 → 이번 회차는 승인 0건(안전한 쪽).
      `lounge_posts?publish_status=eq.draft&ai_topic=not.is.null&ai_source=eq.server_template&select=id,title,content,category,ai_topic,created_at&order=created_at.desc&limit=${MAX_APPROVE_PER_RUN}`
    )) ?? [];
    console.log(`${L} 후보 draft=${drafts.length}`);
    if (!drafts.length) return res;

    const cutoffIso = new Date(now - LOOKBACK_HOURS * 3600 * 1000).toISOString();
    const existing = (await sbGet(
      `lounge_posts?ai_topic=not.is.null&created_at=gte.${encodeURIComponent(cutoffIso)}&select=id,title,ai_topic,created_at,updated_at,publish_status,scheduled_at&limit=500`
    )) ?? [];
    // §16 일일 발행 예산(정기 10/비정기 5/총 15) — 오늘 발행 수 집계 후 사이클 중 증분.
    const budget = computeBudget(existing, { now });
    res.immediate = 0; res.hold = 0; res.limitExceeded = 0;
    // content_type 컬럼이 없으므로 제목으로 분류해 편성 키를 만든다(⑬).
    const withType = (e) => ({ ...e, content_type: classifyContentType(e.title || e.ai_topic || "") });
    const pipeline = existing.filter((e) => ["review", "approved", "scheduled", "publishing", "published"].includes(e.publish_status || "")).map(withType);
    // 보드 중복검사 코퍼스는 "기존 파이프라인"만 — 이번 배치의 형제 draft 는 제외(형제끼리 자기중복 Hard Fail 방지).
    const batchIds = new Set(drafts.map((d) => d.id));
    const existingForBoard = existing.filter((e) => !batchIds.has(e.id));
    const seenKeys = new Set();
    res.duplicate = 0;

    for (const d of drafts) {
      res.reviewed += 1;
      const type = classifyContentType(d.title || d.ai_topic || "");
      // §7①·§14 — 긴급(breaking)도 파이프라인 통과. 단 Hard Fail 이면 decidePublishMode 가 HOLD 로 차단.
      const eligible = true;
      const at = schedulePublishAt(type, { now });
      // ⑬ 편성 중복 차단: 같은 키가 이미 파이프라인(승인~발행)에 있거나, 이번 배치에서 이미 처리됨(대표본 1건).
      const keyRec = { content_type: type, title: d.title, scheduled_at: at.toISOString() };
      const key = editorialKey(keyRec);
      const dup = seenKeys.has(key) || findDuplicate(keyRec, pipeline);
      if (dup) {
        res.duplicate += 1;
        res.rows.push({ id: d.id, type, decision: "DUPLICATE_SKIP", key });
        console.log(`${L} → duplicate skip id=${d.id} key=${key} (같은 편성 이미 존재)`);
        continue;
      }
      seenKeys.add(key); // 대표본 확정 — 같은 키의 형제 draft 는 이후 스킵.
      // 서버는 LLM 보정 없이 현재 본문으로 결정론적 4인 검토(발행 우선).
      const r = await runEditorialApproval({ draft: { ...d, type }, existing: existingForBoard });
      console.log(`${L} id=${d.id} type=${type} score=${r.qualityScore} grade=${r.grade} decision=${r.finalDecision} hardGate=${r.hardGatePassed} approvals=${r.approvalCount}/4 rev=${r.revisionCount} regen=${r.regenerationCount} board=${r.boardReviewCount}`);
      // §9 운영 로그 태그(품의서·4인 검토) — reviewMode=heuristic(정직).
      console.log(`[DOSSIER] id=${d.id} type=${type} quality=${r.qualityScore} reviewMode=heuristic`);
      const TAG = { writer: "WRITER", fact_checker: "FACT", seo: "SEO", chief_editor: "EDITOR" };
      for (const rv of (r.board?.reviewers || [])) {
        console.log(`[${TAG[rv.role] || rv.role}] id=${d.id} ${rv.decision}${rv.hardFail ? " HARD_FAIL" : ""} score=${rv.score}`);
        if (rv.role === "writer") console.log(`[QUALITY] id=${d.id} ${rv.decision} score=${rv.score}`);
      }
      if (r.hardGatePassed && r.approved) console.log(`[BOARD_APPROVED] id=${d.id} signed=4/4`);
      if (r.approved && eligible) {
        // §7 발행 방식 자동 판단(즉시/예약/보류). Safety Gate(hardGate)는 board 로 이미 반영.
        const decision = decidePublishMode({ title: d.title, content: d.content, content_type: type }, { board: r.board, now });
        const nowIso = new Date(now).toISOString();
        // §7 총괄비서실장 — 재검토 없이 서명·HardFail·예산·발행방식 확인 후 집행만.
        console.log(`[CHIEF_SECRETARY] id=${d.id} BOARD_APPROVED 인수 · verify(hardGate=${r.hardGatePassed} mode=${decision.mode}/${decision.priority} budget=${budget.total.pub}/${budget.total.cap}) → 집행`);
        if (decision.mode === "HOLD") {
          res.hold += 1; res.needsReview += 1;
          res.rows.push({ id: d.id, type, decision: "HOLD", reason: decision.reason, priority: decision.priority });
          console.log(`${L} → HOLD id=${d.id} reason=${decision.reason}`);
        } else if (decision.mode === "IMMEDIATE" && canPublish(type, budget)) {
          // §10 즉시발행 = 기존 executor 재사용(scheduled 상태를 반드시 거치지 않음).
          console.log(`[PUBLISH] id=${d.id} mode=IMMEDIATE ${decision.priority}/${decision.reason}`);
          const ok = await sbPatch(d.id, { publish_status: "published", is_visible: true, updated_at: nowIso });
          if (ok) {
            console.log(`[PUBLISHED] id=${d.id} at=${nowIso}`);
            res.immediate += 1;
            (isRegular(type) ? budget.regular : budget.irregular).pub += 1; budget.total.pub += 1;
            res.rows.push({ id: d.id, type, decision: "IMMEDIATE", priority: decision.priority, reason: decision.reason, grade: r.grade, score: r.qualityScore });
            console.log(`${L} → IMMEDIATE publish id=${d.id} ${decision.priority}/${decision.reason}`);
          } else { res.needsReview += 1; console.warn(`${L} immediate PATCH 실패 id=${d.id}`); }
        } else {
          // 예약발행(SCHEDULED) 또는 즉시 대상이나 예산 초과 → 예약으로 이월.
          const capped = decision.mode === "IMMEDIATE";
          if (capped) res.limitExceeded += 1;
          const ok = await sbPatch(d.id, { publish_status: "scheduled", scheduled_at: at.toISOString(), updated_at: nowIso });
          if (ok) { res.scheduled += 1; res.rows.push({ id: d.id, type, decision: capped ? "SCHEDULED_LIMITED" : "SCHEDULED", reason: decision.reason, grade: r.grade, score: r.qualityScore, scheduledAt: at.toISOString() }); console.log(`${L} → scheduled id=${d.id} at=${at.toISOString()} ${decision.reason}${capped ? " (예산초과 이월)" : ""}`); }
          else { res.needsReview += 1; console.warn(`${L} scheduled PATCH 실패 id=${d.id} → draft 유지`); }
        }
      } else {
        res.needsReview += 1;
        res.rows.push({ id: d.id, type, decision: "NEEDS_REVIEW", grade: r.grade, score: r.qualityScore, reason: eligible ? (r.hardGate?.reasons || []) : ["breaking=관리자검토"] });
        console.log(`${L} → needs_review id=${d.id} (${eligible ? r.finalDecision : "breaking"})`);
      }
    }
    res.budget = budget;
    console.log(`${L} 완료 reviewed=${res.reviewed} immediate=${res.immediate} scheduled=${res.scheduled} hold=${res.hold} duplicate=${res.duplicate} needsReview=${res.needsReview} | 예산 정기 ${budget.regular.pub}/${budget.regular.cap} 비정기 ${budget.irregular.pub}/${budget.irregular.cap} 총 ${budget.total.pub}/${budget.total.cap}`);
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

    // 하루 발행 한도(dailyPublishBudget 의 총량)를 예약 발행에도 — 예전엔 즉시 발행에만 적용됐다(09-26 검토).
    const publishedToday = (await sbGet(
      `lounge_posts?publish_status=eq.published&ai_topic=not.is.null&updated_at=gte.${encodeURIComponent(kstMidnightUtcIso(new Date(now)))}&select=id&limit=100`
    )) ?? [];
    const room = Math.max(0, DAILY_PUBLISH_CAP - publishedToday.length);
    if (room === 0) {
      console.log(`${L} 오늘 발행 한도(${DAILY_PUBLISH_CAP}) 도달 — 예약 발행 이월`);
      diag.ok = true;
      return { ...diag, reason: "daily_cap" };
    }
    dueIds.splice(room);

    // (6)(7) publish 실행 = DB UPDATE scheduled→published.
    // ⑯ 발행 폭주 방지: 한 사이클 최대 MAX_PUBLISH_PER_RUN 건만. 나머지(놓친 예약 포함)는 다음 Cron 회수.
    const batch = dueIds.slice(0, MAX_PUBLISH_PER_RUN);
    diag.deferred = dueIds.length - batch.length;
    console.log(`${L} (6) publish 실행: due ${dueIds.length}건 중 ${batch.length}건 PATCH (상한 ${MAX_PUBLISH_PER_RUN}, 이월 ${diag.deferred})`);
    const inList = batch.map((id) => encodeURIComponent(id)).join(",");
    const r = await fetch(
      `${SB_URL}/rest/v1/lounge_posts?publish_status=eq.scheduled&id=in.(${inList})`,
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
      `lounge_posts?ai_topic=not.is.null&or=(ai_source.is.null,ai_source.neq.server_news)&created_at=gte.${encodeURIComponent(startIso)}&select=id&limit=200`
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
        // 주제가 카테고리를 들고 오면 그대로 쓴다(예전엔 주제 단어로 다시 맞혀 다른 칸으로 가기도 했다)
        const category = item.category || mapCategory(item.topic).category;
        const score = scoreTopic({ topic: item.topic, region: item.region ?? null, collectedAt: item.collectedAt });
        const priority = priorityFromScore(score.total);
        // 라운지 카테고리 주제(연애·주식·맛집…)는 그 카테고리에 맞는 작성기로 — 인테리어 틀(범위·자재·기간)을 쓰지 않는다(09-26)
        const draft = item.audience === "category" && item.raw?.points
          ? composeCategoryPost(item.raw, { day: dayIndexOf(new Date(now)) })
          : generateDraft({ issue: item.topic, spaceAngle: item.angle ?? null, category, region: item.region ?? null, brand: item.brand ?? null, variant: item.variant ?? 0 });
        const { data, error } = await sbInsertDraft({
          user_id: null,
          anonymous_nickname: "공간마켓",
          category: draft.category,
          title: draft.title,
          content: draft.content,
          region: item.region ?? null,
          image_urls: ensureImageUrls({ title: draft.title, content: draft.content, content_type: classifyContentType(draft.title || item.topic) }), // §11 빈 image_urls 금지
          is_seed: true,
          is_visible: false, // ⚠️ 절대 true 금지 — 관리자 승인 전 비공개.
          publish_status: "draft", // ⚠️ 절대 published/scheduled 금지.
          scheduled_at: null,
          ai_topic: item.topic,
          ai_source: "server_template", // 서버가 틀로 만든 초안 — 자동 승인은 이 표시가 있는 것만(09-26)
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

  // 2-b) 실제 뉴스·트렌드·날씨 글(출처·링크가 있는 사실만) — 하루 종류별 한도, 예약 발행.
  let news = null;
  try { news = await runNewsStep(now); } catch (e) { news = { error: e?.message ?? "news_error" }; }
  console.log(`${L} (2-b) 뉴스 단계: ${JSON.stringify(news)}`);

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
    boardDiag: { reviewed: board.reviewed, immediate: board.immediate ?? 0, scheduled: board.scheduled, hold: board.hold ?? 0, duplicate: board.duplicate ?? 0, needsReview: board.needsReview, limitExceeded: board.limitExceeded ?? 0, budget: board.budget ?? null, rows: board.rows ?? [] },
    // 진단: 예약/도래/발행 상세(응답으로 바로 확인 가능).
    publishDiag: { scheduledTotal: pub.scheduledTotal, dueCount: pub.dueCount, notDue: pub.notDue, published: pub.published, reason: pub.reason ?? null, rows: pub.rows ?? [] },
    generated,
    drafts,
    news,
    published: pub.published,
    publishOk: pub.ok,
  };
}

// ── 실제 뉴스·트렌드·날씨 글(09-26 · 대표 「뉴스와 트렌드 발행으로 라운지 유입」) ──────────────
//   · 트렌드 모음 — 하루 1건, KST 07시 이후 만들어 12:30 에 발행(점심 시간 · 푸시 창 안).
//   · 공간 뉴스 — 네이버 키가 있을 때만, 하루 1건(집과 닿는 기사만) 18:30 발행.
//   · 날씨와 집 — 기상청 키가 있을 때만, 내일 예보가 한파·폭염·비면 오늘 17:30 에 1건(06~17시에만 확인).
//   글은 출처가 준 사실(키워드·검색량·기사 제목·링크·예보 수치)만 담고, 기사 본문은 옮기지 않는다(newsPosts.js).
//   ai_source='server_news' 로 표시 · 바로 «예약» 상태로 넣고 발행은 publishDueScheduled(하루 발행 한도 공유)가 한다.
//   같은 날 같은 종류는 ai_topic 으로 한 번만(재실행 무해).
const NEWS_QUERIES = ["인테리어", "리모델링", "이사 입주", "전세", "아파트 하자", "층간소음", "곰팡이 결로"];
const kstAt = (now, h, m) => { const { y, m: mo, d } = kstYmd(now); return Date.UTC(y, mo - 1, d, h, m) - 9 * 3600 * 1000; };

async function newsExists(prefix) {
  const rows = (await sbGet(`lounge_posts?ai_topic=like.${encodeURIComponent(prefix + "*")}&select=id&limit=1`)) ?? [];
  return rows.length > 0;
}
async function insertNews(post, publishAtMs, now) {
  const at = new Date(Math.max(publishAtMs, now + 5 * 60 * 1000)).toISOString();
  return sbInsertDraft({
    user_id: null, anonymous_nickname: "공간마켓",
    category: post.category, title: post.title, content: post.content, region: null,
    image_urls: ensureImageUrls({ title: post.title, content: post.content, content_type: classifyContentType(post.title) }),
    is_seed: true, is_visible: false,
    publish_status: "scheduled", scheduled_at: at,
    ai_topic: post.ai_topic, ai_source: "server_news",
  });
}

async function runNewsStep(now = Date.now()) {
  const out = { trend: "skip", news: "skip", weather: "skip" };
  const hourKst = new Date(now + 9 * 3600 * 1000).getUTCHours();
  const today = ymdKey(kstYmd(now));

  // ① 트렌드 모음
  if (hourKst >= 7 && !(await newsExists(`트렌드 모음 ${today}`))) {
    const post = composeTrendRoundup(await fetchGoogleTrendsKR(), { now });
    if (!post) out.trend = "no_items";
    else { const { error } = await insertNews(post, kstAt(now, 12, 30), now); out.trend = error ? `error:${error}` : "scheduled"; }
  } else if (hourKst >= 7) out.trend = "done_today";

  // ② 공간 뉴스(네이버 키 있을 때)
  if (hourKst >= 9 && !(await newsExists(`공간 뉴스 ${today}`))) {
    const q = NEWS_QUERIES[Math.floor(now / 86400000) % NEWS_QUERIES.length];
    const { configured, items } = await fetchNaverNews(q);
    if (!configured) out.news = "not_configured";
    else {
      const post = items.map((it) => composeNewsPost(it, { now })).find(Boolean);
      if (!post) out.news = "no_items";
      else { const { error } = await insertNews(post, kstAt(now, 18, 30), now); out.news = error ? `error:${error}` : "scheduled"; }
    }
  } else if (hourKst >= 9) out.news = "done_today";

  // ③ 날씨와 집(기상청 키 있을 때) — 내일 예보가 한파·폭염·비일 때만
  if (hourKst >= 6 && hourKst < 17 && !(await newsExists(`날씨와 집 ${ymdKey(kstYmd(now + 86400000)).replace(/-/g, "")}`))) {
    const { configured, forecast } = await fetchKmaTomorrow({ now });
    if (!configured) out.weather = "not_configured";
    else {
      const post = composeWeatherPost(forecast);
      if (!post) out.weather = "calm_day";
      else { const { error } = await insertNews(post, kstAt(now, 17, 30), now); out.weather = error ? `error:${error}` : "scheduled"; }
    }
  }
  return out;
}
