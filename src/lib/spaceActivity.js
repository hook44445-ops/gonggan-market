// ════════════════════════════════════════════════════════════════════════════
// spaceActivity.js — "공간 활동기록" 실데이터 집계 (v5.4.0 · 읽기 전용)
//   활동이 기록이 되고, 기록이 프로젝트로 이어진다 — 의 데이터 계층.
//   ⚠️ Mock 금지: 반드시 실제 DB(기존 테이블)만 집계한다. 스키마/RPC 변경 없음.
//   · 회사 범위 지표(프로젝트 완료/견적 응답/리뷰)는 companyId 로 집계.
//   · 라운지 지표(라운지 답변/시공사례)는 ownerId(=users.id) 로 집계.
//   · 데이터가 없으면 0 을 그대로 반환(숫자 가공 금지) → UI 에서 빈 상태 안내.
// ════════════════════════════════════════════════════════════════════════════
import { supabase } from "./supabase";

const cnt = async (builder) => {
  try { const { count } = await builder; return count ?? 0; }
  catch { return 0; }
};

// 최근 활동(베스트-에포트) — 타입별 최신 몇 건을 합쳐 created_at 내림차순 상위 5.
async function buildRecent({ ownerId, companyId }) {
  const items = [];
  const tasks = [];
  if (companyId) {
    tasks.push(
      supabase.from("reviews").select("created_at,rating").eq("company_id", companyId)
        .or("is_hidden.is.null,is_hidden.eq.false").or("is_deleted.is.null,is_deleted.eq.false")
        .order("created_at", { ascending: false }).limit(3)
        .then(({ data }) => (data ?? []).forEach((r) =>
          items.push({ type: "리뷰", at: r.created_at, label: `새 리뷰${r.rating ? ` ${r.rating}점` : ""}` })))
        .catch(() => {})
    );
    tasks.push(
      supabase.from("escrow_payments").select("created_at").eq("company_id", companyId)
        .in("transaction_status", ["SETTLED", "COMPLETED"])
        .order("created_at", { ascending: false }).limit(3)
        .then(({ data }) => (data ?? []).forEach((r) =>
          items.push({ type: "프로젝트", at: r.created_at, label: "프로젝트 완료" })))
        .catch(() => {})
    );
  }
  if (ownerId) {
    tasks.push(
      supabase.from("lounge_posts").select("created_at,title").eq("user_id", ownerId).eq("is_story", true)
        .or("is_deleted.is.null,is_deleted.eq.false").or("is_hidden.is.null,is_hidden.eq.false")
        .order("created_at", { ascending: false }).limit(3)
        .then(({ data }) => (data ?? []).forEach((r) =>
          items.push({ type: "시공사례", at: r.created_at, label: r.title || "시공사례 공유" })))
        .catch(() => {})
    );
    tasks.push(
      supabase.from("lounge_comments").select("created_at").eq("user_id", ownerId)
        .or("is_deleted.is.null,is_deleted.eq.false")
        .order("created_at", { ascending: false }).limit(3)
        .then(({ data }) => (data ?? []).forEach((r) =>
          items.push({ type: "라운지 답변", at: r.created_at, label: "라운지 답변" })))
        .catch(() => {})
    );
  }
  await Promise.all(tasks);
  return items
    .filter((i) => i.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 5);
}

// 공간 활동기록 집계. 반환: { projectsCompleted, bidResponses, loungeAnswers,
//   constructionCases, reviews, recent[], total, isEmpty, loaded }.
export async function getSpaceActivityRecord({ ownerId = null, companyId = null } = {}) {
  const r = {
    projectsCompleted: 0, bidResponses: 0, loungeAnswers: 0,
    constructionCases: 0, reviews: 0, recent: [], total: 0, isEmpty: true, loaded: false,
  };
  const jobs = [];
  if (companyId) {
    jobs.push(cnt(supabase.from("escrow_payments").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).in("transaction_status", ["SETTLED", "COMPLETED"]))
      .then((n) => { r.projectsCompleted = n; }));
    jobs.push(cnt(supabase.from("bids").select("id", { count: "exact", head: true })
      .eq("company_id", companyId))
      .then((n) => { r.bidResponses = n; }));
    jobs.push(cnt(supabase.from("reviews").select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .or("is_hidden.is.null,is_hidden.eq.false").or("is_deleted.is.null,is_deleted.eq.false"))
      .then((n) => { r.reviews = n; }));
  }
  if (ownerId) {
    jobs.push(cnt(supabase.from("lounge_comments").select("id", { count: "exact", head: true })
      .eq("user_id", ownerId).or("is_deleted.is.null,is_deleted.eq.false"))
      .then((n) => { r.loungeAnswers = n; }));
    jobs.push(cnt(supabase.from("lounge_posts").select("id", { count: "exact", head: true })
      .eq("user_id", ownerId).eq("is_story", true)
      .or("is_deleted.is.null,is_deleted.eq.false").or("is_hidden.is.null,is_hidden.eq.false"))
      .then((n) => { r.constructionCases = n; }));
  }
  await Promise.all(jobs);
  r.recent = await buildRecent({ ownerId, companyId }).catch(() => []);
  r.total = r.projectsCompleted + r.bidResponses + r.loungeAnswers + r.constructionCases + r.reviews;
  r.isEmpty = r.total === 0;
  r.loaded = true;
  return r;
}
