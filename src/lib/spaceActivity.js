// ════════════════════════════════════════════════════════════════════════════
// spaceActivity.js — "공간 활동기록" 실데이터 집계 (v5.4.0 · 읽기 전용)
//   활동이 기록이 되고, 기록이 프로젝트로 이어진다 — 의 데이터 계층.
//   ⚠️ Mock 금지: 반드시 실제 DB(기존 테이블)만 집계한다. 스키마/RPC 변경 없음.
//   · 회사 범위 지표(프로젝트 완료/견적 응답/리뷰)는 companyId 로 집계.
//   · 라운지 지표(라운지 답변/시공사례)는 ownerId(=users.id) 로 집계.
//   · 데이터가 없으면 0 을 그대로 반환(숫자 가공 금지) → UI 에서 빈 상태 안내.
// ════════════════════════════════════════════════════════════════════════════
import { supabase } from "./supabase";

// 향후 확장(설계만 — 지금은 집계에만 사용, 기능 추가 없음): 활동 타입 식별자.
// 고객/전문가/관리자 공용 Activity 구조로 확장 시 사용 예정.
export const ACTIVITY_TYPES = Object.freeze({
  BID_RESPONSE:     "BID_RESPONSE",      // 견적 응답 (bids)
  PROJECT_COMPLETE: "PROJECT_COMPLETE",  // 프로젝트 완료 (escrow_payments SETTLED/COMPLETED)
  REVIEW_RECEIVED:  "REVIEW_RECEIVED",   // 리뷰 (reviews)
  LOUNGE_POST:      "LOUNGE_POST",       // 라운지 게시글 (lounge_posts)
  LOUNGE_COMMENT:   "LOUNGE_COMMENT",    // 라운지 답변 (lounge_comments)
  PROJECT_PHOTO:    "PROJECT_PHOTO",     // (향후) 시공 사진
  CUSTOMER_RECOMMEND: "CUSTOMER_RECOMMEND", // (향후) 고객 추천
});

const cnt = async (builder) => {
  try { const { count } = await builder; return count ?? 0; }
  catch { return 0; }
};

// 세션 메모 캐시 — 동일 업체가 여러 입찰 카드에 반복 노출돼도 중복 쿼리를 막는다.
// 읽기 전용 집계라 세션 내 약간의 staleness 는 허용. 키: companyId|ownerId|countsOnly.
const _cache = new Map();

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
//   constructionCases, loungePosts, reviews, recent[], total, isEmpty, loaded }.
// countsOnly=true 면 최근 활동 조회를 생략(요약/입찰 카드용 — 쿼리 최소화).
async function _compute({ ownerId = null, companyId = null, countsOnly = false }) {
  const r = {
    projectsCompleted: 0, bidResponses: 0, loungeAnswers: 0,
    constructionCases: 0, loungePosts: 0, reviews: 0, recent: [], total: 0, isEmpty: true, loaded: false,
    // v5.7(Additive): 공통/전문가 부가 실데이터. 빈 값은 null/0/[] 그대로(가공 금지).
    likesReceived: 0, joinedAt: null, lastActivityAt: null, avgRating: null, specialties: [],
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
    jobs.push(cnt(supabase.from("lounge_posts").select("id", { count: "exact", head: true })
      .eq("user_id", ownerId).eq("is_story", false)
      .or("is_deleted.is.null,is_deleted.eq.false").or("is_hidden.is.null,is_hidden.eq.false"))
      .then((n) => { r.loungePosts = n; }));
  }
  await Promise.all(jobs);

  // ── 부가 실데이터(가입일/받은 좋아요/평균 평점/전문분야) — 전체 보기에서만 조회 ──────
  //   compact(입찰 카드)는 기존처럼 카운트만 사용(쿼리/동작 무변경).
  //   total/isEmpty 산식에는 포함하지 않음 → 빈 상태 판정 기존과 동일(Regression 0).
  if (!countsOnly) {
    const extra = [];
    if (companyId) {
      extra.push(
        supabase.from("reviews").select("rating").eq("company_id", companyId)
          .or("is_hidden.is.null,is_hidden.eq.false").or("is_deleted.is.null,is_deleted.eq.false")
          .then(({ data }) => {
            const rs = (data ?? []).map((x) => x.rating).filter((n) => typeof n === "number");
            r.avgRating = rs.length ? Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 10) / 10 : null;
          }).catch(() => {})
      );
      extra.push(
        supabase.from("companies").select("specialties").eq("id", companyId).maybeSingle()
          .then(({ data }) => { r.specialties = Array.isArray(data?.specialties) ? data.specialties : []; })
          .catch(() => {})
      );
    }
    if (ownerId) {
      extra.push(
        supabase.from("lounge_posts").select("like_count").eq("user_id", ownerId)
          .or("is_deleted.is.null,is_deleted.eq.false").or("is_hidden.is.null,is_hidden.eq.false")
          .then(({ data }) => { r.likesReceived = (data ?? []).reduce((s, x) => s + (x.like_count || 0), 0); })
          .catch(() => {})
      );
      extra.push(
        supabase.from("users").select("created_at").eq("id", ownerId).maybeSingle()
          .then(({ data }) => { r.joinedAt = data?.created_at ?? null; })
          .catch(() => {})
      );
    }
    const [recent] = await Promise.all([buildRecent({ ownerId, companyId }).catch(() => []), ...extra]);
    r.recent = recent;
    r.lastActivityAt = r.recent[0]?.at ?? null;
  }

  r.total = r.projectsCompleted + r.bidResponses + r.loungeAnswers
    + r.constructionCases + r.loungePosts + r.reviews;
  r.isEmpty = r.total === 0;
  r.loaded = true;
  return r;
}

export function getSpaceActivityRecord({ ownerId = null, companyId = null, countsOnly = false } = {}) {
  const key = `${companyId ?? ""}|${ownerId ?? ""}|${countsOnly ? 1 : 0}`;
  if (_cache.has(key)) return _cache.get(key);
  const p = _compute({ ownerId, companyId, countsOnly }).catch((e) => {
    _cache.delete(key); // 실패는 캐시하지 않음(다음 호출에서 재시도)
    throw e;
  });
  _cache.set(key, p);
  return p;
}
