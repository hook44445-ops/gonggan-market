import { createClient } from "@supabase/supabase-js";
import { detectDirectDealKeywords } from "../constants/directDeal";
import { SITE_VISIT_ESTIMATE_MS, SITE_VISIT_WARN_MS } from "../constants/policy";

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. " +
    "Copy .env.local.example to .env.local and fill in your project credentials."
  );
}

export const supabase = createClient(
  supabaseUrl  ?? "https://placeholder.supabase.co",
  supabaseAnon ?? "placeholder-anon-key"
);

// ── Auth helpers ──────────────────────────────────────────────────────────────

export const signInWithPhone = (phone) =>
  supabase.auth.signInWithOtp({ phone });

export const verifyOtp = (phone, token) =>
  supabase.auth.verifyOtp({ phone, token, type: "sms" });

export const signOut = () => supabase.auth.signOut();

export const getSession = () => supabase.auth.getSession();

// ── Users ─────────────────────────────────────────────────────────────────────

export const upsertUser = (profile) =>
  supabase.from("users").upsert(profile).select().single();

// Upsert by phone (no Supabase auth id required)
export const upsertUserByPhone = (profile) =>
  supabase.from("users").upsert(profile, { onConflict: "phone" }).select().single();

export const getUser = (id) =>
  supabase.from("users").select("*").eq("id", id).maybeSingle();

// 활동지역(activity_regions jsonb) 업데이트 — region text(primary) + default id 동기화
// migration 010/011 미적용으로 신규 컬럼이 없으면, legacy region text 만이라도 저장(crash 금지).
export const updateUserActivityRegions = async (id, activityRegions, regionText, defaultRegionId) => {
  const full = {
    activity_regions: activityRegions ?? [],
    ...(defaultRegionId !== undefined ? { default_activity_region_id: defaultRegionId ?? null } : {}),
    ...(regionText ? { region: regionText } : {}),
  };
  const res = await supabase.from("users").update(full).eq("id", id).select().maybeSingle();
  if (res.error) {
    // eslint-disable-next-line no-console
    console.warn("[region] users.activity_regions 저장 실패 → region text fallback:", res.error?.message);
    if (regionText) {
      const fb = await supabase.from("users").update({ region: regionText }).eq("id", id).select().maybeSingle();
      await refetchRegionDebug("users", id);
      return fb;
    }
  }
  await refetchRegionDebug("users", id);
  return res;
};

// 저장 직후 실제 DB 값 재조회 진단 — tier-4 fallback 원인 추적용
async function refetchRegionDebug(table, id) {
  try {
    const cols = table === "users"
      ? "id, region, activity_regions, default_activity_region_id"
      : "id, region, service_regions, default_service_region_id";
    const { data, error } = await supabase.from(table).select(cols).eq("id", id).maybeSingle();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[RegionRefetch] failed", e?.message);
  }
}

export const getUserByPhone = (phone) =>
  supabase.from("users").select("*").eq("phone", phone).maybeSingle();

// ── Companies ─────────────────────────────────────────────────────────────────

export const getCompanies = () =>
  supabase.from("companies").select("*").order("temp", { ascending: false });

export const getCompany = (id) =>
  supabase.from("companies").select("*").eq("id", id).maybeSingle();

export const getCompanyByOwnerId = (ownerId) =>
  supabase.from("companies").select("*").eq("owner_id", ownerId).maybeSingle();

export const upsertCompany = (data) =>
  supabase.from("companies").upsert(data, { onConflict: "owner_id" }).select().single();

// 영업지역(service_regions jsonb) 업데이트 — region text(primary) + default id 동기화
// 신규 컬럼이 없으면 legacy region text 만이라도 저장(crash 금지).
export const updateCompanyServiceRegions = async (id, serviceRegions, regionText, defaultRegionId) => {
  const full = {
    service_regions: serviceRegions ?? [],
    ...(defaultRegionId !== undefined ? { default_service_region_id: defaultRegionId ?? null } : {}),
    ...(regionText ? { region: regionText } : {}),
  };
  const res = await supabase.from("companies").update(full).eq("id", id).select().maybeSingle();
  if (res.error) {
    // eslint-disable-next-line no-console
    console.warn("[region] companies.service_regions 저장 실패 → region text fallback:", res.error?.message);
    if (regionText) {
      const fb = await supabase.from("companies").update({ region: regionText }).eq("id", id).select().maybeSingle();
      await refetchRegionDebug("companies", id);
      return fb;
    }
  }
  await refetchRegionDebug("companies", id);
  return res;
};

// Atomically adjust a company's 공간온도 by delta, clamped to 0–99
export const updateCompanyTemp = async (companyId, delta) => {
  const { data, error } = await supabase
    .from("companies")
    .select("temp")
    .eq("id", companyId)
    .maybeSingle();
  if (error) return { error };
  const current = typeof data?.temp === "number" ? data.temp : 36.5;
  const next    = Math.round(Math.min(99, Math.max(0, current + delta)) * 10) / 10;
  return supabase.from("companies").update({ temp: next }).eq("id", companyId).select("temp").single();
};

export const getPendingCompanies = () =>
  supabase.from("companies").select("*").eq("doc_status", "pending");

export const reviewCompany = (id, status, rejectNote = null) =>
  supabase
    .from("companies")
    .update({ doc_status: status, reject_note: rejectNote, reviewed_at: new Date().toISOString() })
    .eq("id", id);

// ── Requests ──────────────────────────────────────────────────────────────────

export const createRequest = (data) =>
  supabase.from("requests").insert(data).select().single();

// 업체 입찰 목록 — requests.status 단일 기준. status='open' 만 노출.
// (expires_at 기준 필터 제거 — 만료는 status='expired' 로 전이되어 자연 제외됨)
export const getRequests = () =>
  supabase
    .from("requests")
    .select("*, bids(id, company_id, price, status)")
    .eq("status", "open")                          // open 만 — cancelled/canceled 자동 제외
    .not("status", "in", "(cancelled,canceled)")   // 명시적 방어(이중)
    .or("is_hidden.is.null,is_hidden.eq.false")
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("created_at", { ascending: false });

export const getRequest = (id) =>
  supabase.from("requests").select("*").eq("id", id).maybeSingle();

export const getUserRequests = async (userId) => {
  const res = await supabase
    .from("requests")
    .select("*, bids(id, company_id, price, status), reviews(id)")
    .eq("user_id", userId)
    .not("status", "in", "(cancelled,canceled)")   // 취소건은 쿼리 레벨에서 제외
    .or("is_hidden.is.null,is_hidden.eq.false")
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("created_at", { ascending: false });
  try {
    console.log("[GONGGAN_DEBUG][getUserRequests]", {
      userId, count: res.data?.length ?? 0, error: res.error?.message ?? null,
      rows: (res.data ?? []).map(r => ({
        id: r.id, status: r.status,
        selected_company_id: r.selected_company_id ?? null, selected_bid_id: r.selected_bid_id ?? null,
        budget_min: r.budget_min ?? null, budget_max: r.budget_max ?? null,
        bids: (r.bids ?? []).map(b => ({ id: b.id, company_id: b.company_id, price: b.price, status: b.status })),
        reviews: r.reviews?.length ?? 0,
      })),
    });
  } catch {}
  return res;
};

export const getLiveRequests = ({ limit = 5 } = {}) =>
  supabase
    .from("requests")
    .select("id, space_type, area, size, status, created_at, last_activity_at")
    .in("status", ["in_progress", "contracting", "escrow_pending"])
    .or("is_hidden.is.null,is_hidden.eq.false")
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

export const getActiveRequestByUser = (userId) =>
  supabase
    .from("requests")
    .select("id, status, space_type, created_at, last_activity_at")
    .eq("user_id", userId)
    .in("status", ["open", "in_progress"])
    .or("is_hidden.is.null,is_hidden.eq.false")
    .limit(1)
    .maybeSingle();

export const archiveRequestAuto = (id, reason) =>
  supabase.from("requests")
    .update({ is_hidden: true, archived_at: new Date().toISOString(), hidden_reason: reason })
    .eq("id", id);

export const closeRequest = (id) =>
  supabase.from("requests").update({ status: "closed" }).eq("id", id);

export const updateRequest = (id, data) =>
  supabase.from("requests").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id).select().single();

// ── Bids ──────────────────────────────────────────────────────────────────────

export const createBid = (data) =>
  supabase.from("bids").insert(data).select().single();

export const getBidsForRequest = (requestId) =>
  supabase
    .from("bids")
    .select("*")
    .eq("request_id", requestId)
    .order("price", { ascending: true });

export const selectBid = async (bidId) => {
  const res = await supabase.from("bids").update({ selected: true }).eq("id", bidId);
  try { console.log("[GONGGAN_DEBUG][selectBid]", { bidId, error: res.error?.message ?? null }); } catch {}
  return res;
};

// 현장방문 견적 흐름 — 상태 전이 RPC (security definer, 내부에서 actor 검증).
// OTP 커스텀 인증(auth.uid()=null)이라 requests 직접 UPDATE 는 RLS 에 막힌다 → RPC 경유.
// 업체 선택(의뢰인) → site_visit. 선택 입찰/업체 기록 + bids.selected 단일화는 RPC 내부 처리.
export const markRequestSiteVisit = (requestId, { bidId = null, companyId = null, actorId = null } = {}) =>
  supabase.rpc("request_mark_site_visit", {
    p_request_id: requestId, p_bid_id: bidId, p_company_id: companyId, p_actor_id: actorId,
  });

// 의뢰인 최종 견적 승인 → escrow_pending (+ 제출 견적서 accepted). RPC 가 의뢰인 소유 검증.
export const approveFinalQuote = (requestId, actorId = null) =>
  supabase.rpc("request_approve_final_quote", { p_request_id: requestId, p_actor_id: actorId });

// 업체 입찰 내용 수정 — 한 요청당 1입찰 정책에서 재제출은 수정으로 처리
export const updateBid = (id, data) =>
  supabase.from("bids").update(data).eq("id", id).select().single();

// ── Chats ─────────────────────────────────────────────────────────────────────

export const getChatMessages = (roomId) =>
  supabase
    .from("chats")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

export const sendMessage = (roomId, senderId, senderType, text) =>
  supabase.from("chats").insert({
    room_id: roomId,
    sender_id: senderId,
    sender_type: senderType,
    text,
  }).select("id").maybeSingle();

export const subscribeToChatRoom = (roomId, callback) =>
  supabase
    .channel(`chat:${roomId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "chats",
      filter: `room_id=eq.${roomId}` }, callback)
    .subscribe();

export const subscribeToBidInserts = (requestId, callback) =>
  supabase
    .channel(`bids:${requestId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids",
      filter: `request_id=eq.${requestId}` }, callback)
    .subscribe();

// ── Escrow Payments ───────────────────────────────────────────────────────────

export const getEscrowPayment = (requestId) =>
  supabase.from("escrow_payments").select("*").eq("request_id", requestId).maybeSingle();

export const createEscrowPayment = (data) =>
  supabase.from("escrow_payments").insert(data).select().single();

export const uploadEscrowPhotos = (paymentId, photoUrls) =>
  supabase
    .from("escrow_payments")
    .update({ inspection_photos: photoUrls, photos_uploaded_at: new Date().toISOString() })
    .eq("id", paymentId);

export const approveEscrowStep = (paymentId, step) =>
  supabase
    .from("escrow_payments")
    .update({ [`step_${step}_approved_at`]: new Date().toISOString(), current_step: step + 1 })
    .eq("id", paymentId);

export const disputeEscrowStep = (paymentId, step, reason) =>
  supabase
    .from("escrow_payments")
    .update({ [`step_${step}_disputed`]: true, dispute_reason: reason, disputed_at: new Date().toISOString() })
    .eq("id", paymentId);

// ── Storage ───────────────────────────────────────────────────────────────────

export const uploadFile = async (bucket, path, file) => {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  // Use data.path (canonical path returned by storage) for getPublicUrl
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data?.path ?? path);
  return urlData.publicUrl;
};

// ── Portfolios ────────────────────────────────────────────────────────────────

export const getPortfolios = (companyId) =>
  supabase
    .from("portfolios")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

export const createPortfolio = (data) =>
  supabase.from("portfolios").insert(data).select().single();

export const deletePortfolio = (id) =>
  supabase.from("portfolios").delete().eq("id", id);

// ── Reviews ───────────────────────────────────────────────────────────────────

export const getReviews = (companyId) =>
  supabase
    .from("reviews")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

// Part2 확장 컬럼 — 마이그레이션 017 미적용 환경에서도 후기 저장이 깨지지 않도록
// (컬럼 없으면 해당 필드만 제거하고 재시도)
const REVIEW_EXT_FIELDS = [
  "reviewer_role", "target_role", "target_user_id", "contract_compliance",
  "response_score", "dispute_history", "budget_score", "schedule_score",
  "communication_score", "quality_score", "would_recontract", "review_photos",
];

export const createReview = async (data) => {
  let res = await supabase.from("reviews").insert(data).select().single();
  if (res.error && /column|schema cache|does not exist|PGRST204|42703/i.test(res.error.message ?? res.error.code ?? "")) {
    const base = { ...data };
    for (const f of REVIEW_EXT_FIELDS) delete base[f];
    res = await supabase.from("reviews").insert(base).select().single();
  }
  return res;
};

// 업체 → 고객 신뢰평가 (계약이행도/응답성/분쟁이력)
export const createCustomerEvaluation = ({ companyId, customerId, requestId = null, contractId = null, contractCompliance, responseScore, disputeHistory = false, content = "" }) =>
  createReview({
    company_id: companyId,
    user_id: companyId,           // 작성자(업체 소유자 auth id)
    customer_id: customerId,
    target_user_id: customerId,
    request_id: requestId,
    contract_id: contractId,
    reviewer_role: "company",
    target_role: "customer",
    contract_compliance: contractCompliance,
    response_score: responseScore,
    dispute_history: !!disputeHistory,
    rating: Math.round(((contractCompliance ?? 0) + (responseScore ?? 0)) / 2) || 5,
    content: content || "업체가 작성한 고객 신뢰평가",
    status: "published",
  });

// 고객 신뢰도 지수 — 업체들이 남긴 평가 평균 (계약이행도/응답성)
export const getCustomerTrust = async (customerId) => {
  if (!customerId) return { count: 0, compliance: null, response: null, score: null, disputes: 0 };
  const { data } = await supabase
    .from("reviews")
    .select("contract_compliance, response_score, dispute_history")
    .eq("target_user_id", customerId)
    .eq("target_role", "customer");
  const rows = data ?? [];
  if (!rows.length) return { count: 0, compliance: null, response: null, score: null, disputes: 0 };
  const avg = (k) => {
    const vals = rows.map(r => r[k]).filter(v => typeof v === "number");
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };
  const compliance = avg("contract_compliance");
  const response = avg("response_score");
  const both = [compliance, response].filter(v => v != null);
  return {
    count: rows.length,
    compliance,
    response,
    score: both.length ? both.reduce((s, v) => s + v, 0) / both.length : null,
    disputes: rows.filter(r => r.dispute_history).length,
  };
};

// 업체 항목별 후기 평균 (예산/일정/소통/마감)
export const getCompanyReviewScores = async (companyId) => {
  if (!companyId) return null;
  const { data } = await supabase
    .from("reviews")
    .select("budget_score, schedule_score, communication_score, quality_score, would_recontract")
    .eq("company_id", companyId)
    .or("target_role.is.null,target_role.eq.company");
  const rows = data ?? [];
  if (!rows.length) return null;
  const avg = (k) => {
    const vals = rows.map(r => r[k]).filter(v => typeof v === "number");
    return vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;
  };
  const recontractVals = rows.map(r => r.would_recontract).filter(v => typeof v === "boolean");
  return {
    budget: avg("budget_score"),
    schedule: avg("schedule_score"),
    communication: avg("communication_score"),
    quality: avg("quality_score"),
    recontractRate: recontractVals.length ? Math.round(recontractVals.filter(Boolean).length / recontractVals.length * 100) : null,
  };
};

// ── 관심 업체(위시리스트) ─────────────────────────────────────────────────────
export const getSavedCompanies = (customerId) =>
  supabase
    .from("saved_companies")
    .select("company_id, created_at, companies(*)")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

export const getSavedCompanyIds = async (customerId) => {
  if (!customerId) return [];
  const { data } = await supabase.from("saved_companies").select("company_id").eq("customer_id", customerId);
  return (data ?? []).map(r => r.company_id);
};

export const saveCompany = (customerId, companyId) =>
  supabase.from("saved_companies").insert({ customer_id: customerId, company_id: companyId }).select().maybeSingle();

export const unsaveCompany = (customerId, companyId) =>
  supabase.from("saved_companies").delete().eq("customer_id", customerId).eq("company_id", companyId);

export const replyToReview = (reviewId, reply) =>
  supabase.from("reviews").update({ reply }).eq("id", reviewId);

export const getReviewByContract = (contractId) =>
  supabase
    .from("reviews")
    .select("id, rating, created_at")
    .eq("contract_id", contractId)
    .maybeSingle();

// 의뢰(request) 단위 후기 존재 여부 — 후기 요청 알림 중복 방지용
export const getReviewByRequest = (requestId) =>
  supabase
    .from("reviews")
    .select("id")
    .eq("request_id", requestId)
    .limit(1)
    .maybeSingle();

export const createReviewReward = (data) =>
  supabase.from("review_rewards").insert(data).select().single();

export const getReviewRewardsPending = () =>
  supabase
    .from("review_rewards")
    .select("*, reviews(id, company_id, rating, content, image_urls, before_image_urls, after_image_urls, created_at, user_name)")
    .order("created_at", { ascending: false })
    .limit(200);

export const updateReviewReward = (id, status) =>
  supabase
    .from("review_rewards")
    .update({ status, ...(status === "SENT" ? { sent_at: new Date().toISOString() } : {}) })
    .eq("id", id)
    .select("id, status")
    .single();

export const getTopReviews = ({ limit = 12 } = {}) =>
  supabase
    .from("reviews")
    .select("id, company_id, rating, content, status, image_urls, before_image_urls, after_image_urls, created_at, user_name, region, tags, space_type")
    .gte("rating", 1)
    // DEV: status 조건 완화 (published/approved/pending/null 모두 허용)
    // .in("status", ["published", "approved"])
    .or("is_hidden.is.null,is_hidden.eq.false")
    .order("created_at", { ascending: false })
    .limit(limit);

// 진단용 raw 쿼리 — status 조건 없이 전체 조회
export const getRawReviewsDiag = ({ limit = 10 } = {}) =>
  supabase
    .from("reviews")
    .select("id, company_id, contract_id, rating, status, is_hidden, image_urls, before_image_urls, after_image_urls, created_at")
    .or("is_hidden.is.null,is_hidden.eq.false")
    .order("created_at", { ascending: false })
    .limit(limit);

// 완전 무조건 raw — RLS 진단 (필터 0개, is_hidden 포함 모든 행)
export const getRawReviewsAll = ({ limit = 10 } = {}) =>
  supabase
    .from("reviews")
    .select("id, status, is_hidden, rating, before_image_urls, after_image_urls, image_urls, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

// ── Seed Reviews ─────────────────────────────────────────────────────────────

export const getSeedReviews = ({ limit = 20, activeOnly = true } = {}) => {
  let q = supabase
    .from("seed_reviews")
    .select("id, category, space_type, region, user_name, masked_company_name, content, rating, before_image_url, after_image_url, sort_order, is_active, created_at")
    .order("sort_order", { ascending: true })
    .limit(limit);
  if (activeOnly) q = q.eq("is_active", true);
  return q;
};

export const createSeedReview = (row) =>
  supabase.from("seed_reviews").insert(row).select().single();

export const updateSeedReview = (id, updates) =>
  supabase.from("seed_reviews").update(updates).eq("id", id).select().single();

export const deleteSeedReview = (id) =>
  supabase.from("seed_reviews").delete().eq("id", id);

export const uploadSeedReviewImage = async (file, slot) => {
  const bucket = "seed-review-images";
  const ext = file.name.split(".").pop().toLowerCase();
  const path = `${slot}_${Date.now()}.${ext}`;

  // collect auth diagnostics — anon client has no session, service role bypasses RLS
  const { data: { session } } = await supabase.auth.getSession();
  const _diag = {
    upload_bucket: bucket,
    upload_path: path,
    current_supabase_user_id: session?.user?.id ?? null,
    auth_role: session?.user?.role ?? (session ? "authenticated" : "anon"),
  };

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });
  if (error) return { error, _diag: { ..._diag, upload_error: error.message ?? String(error) } };
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, _diag };
};

// ── Admin Reviews ─────────────────────────────────────────────────────────────

// 스키마에 항상 존재하는 기본 컬럼 (migration 008 미적용 환경 fallback용)
const REVIEW_BASE_COLS = "id, company_id, rating, content, user_name, region, space_type, created_at";
const REVIEW_FULL_COLS = "id, company_id, rating, status, is_hidden, is_deleted, content, user_name, region, space_type, image_urls, before_image_urls, after_image_urls, created_at";

// 어드민 리뷰 조회 — migration 008(숨김/소프트삭제 컬럼) 적용 여부와 무관하게 항상 로드되도록 방어적 처리.
// 1차: 전체 컬럼 조회 → 실패(컬럼 없음) 시 2차: 기본 컬럼만 조회 후 누락 필드를 기본값으로 합성.
export const adminGetReviews = async ({ limit = 100 } = {}) => {
  const full = await supabase
    .from("reviews")
    .select(REVIEW_FULL_COLS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!full.error) return full;

  // fallback: 컬럼 미적용 환경 — 기본 컬럼만 조회하고 누락 필드 기본값 합성
  const base = await supabase
    .from("reviews")
    .select(REVIEW_BASE_COLS)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (base.error) return base;
  const data = (base.data ?? []).map(r => ({
    ...r,
    status: r.status ?? null,
    is_hidden: false,
    is_deleted: false,
    image_urls: r.image_urls ?? [],
    before_image_urls: r.before_image_urls ?? [],
    after_image_urls: r.after_image_urls ?? [],
    _schemaFallback: true, // migration 008 미적용 — 숨김/삭제 액션 불가
  }));
  return { data, error: null, _schemaFallback: true };
};

// Lookup companies by owner_id (reviews.company_id → users.id → companies.owner_id)
export const getCompaniesByOwnerIds = (ownerIds) =>
  supabase.from("companies").select("id, owner_id, name").in("owner_id", ownerIds);

// 리뷰 어드민 수정·숨김·삭제·복구 — security definer RPC(migration 029)로 처리.
// 이 앱은 전화번호 OTP 커스텀 인증이라 auth.uid() 가 null → reviews 직접 UPDATE 는 RLS 에 막혀
// 저장이 반영되지 않았다. RPC 는 p_admin_id 의 role='admin' 을 내부 검증하고 RLS 를 우회한다.
// 반환 형태 { data, error } 는 기존 호출부와 호환.
export const adminUpdateReview = (id, updates, adminId) =>
  supabase.rpc("admin_update_review", {
    p_review_id: id,
    p_admin_id:  adminId ?? null,
    p_rating:    updates?.rating  ?? null,
    p_content:   updates?.content ?? null,
    p_status:    updates?.status  ?? null,
  });

export const adminHideReview = (id, adminId, hidden, reason = null) =>
  supabase.rpc("admin_set_review_hidden", {
    p_review_id: id,
    p_admin_id:  adminId ?? null,
    p_hidden:    hidden,
    p_reason:    reason ?? null,
  });

export const adminSoftDeleteReview = (id, adminId, reason) =>
  supabase.rpc("admin_soft_delete_review", {
    p_review_id: id,
    p_admin_id:  adminId ?? null,
    p_reason:    reason ?? null,
  });

export const adminRestoreReview = (id, adminId) =>
  supabase.rpc("admin_restore_review", {
    p_review_id: id,
    p_admin_id:  adminId ?? null,
  });

// ── Admin Lounge Posts ────────────────────────────────────────────────────────

export const adminUpdateLoungePost = async (id, updates, adminId) => {
  const { data, error } = await supabase
    .from("lounge_posts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, is_hidden, is_deleted, category, content")
    .single();
  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id: adminId || null, action: "UPDATE_LOUNGE_POST",
      target_type: "lounge_post", target_id: id, after_val: updates,
    });
  }
  return { data, error };
};

export const adminSoftDeleteLoungePost = async (id, adminId, reason) => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("lounge_posts")
    .update({ is_deleted: true, deleted_at: now, deleted_by: adminId || null })
    .eq("id", id)
    .select("id")
    .single();
  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id: adminId || null, action: "DELETE_LOUNGE_POST",
      target_type: "lounge_post", target_id: id, reason,
    });
  }
  return { data, error };
};

export const adminRestoreLoungePost = async (id, adminId) => {
  const { data, error } = await supabase
    .from("lounge_posts")
    .update({ is_deleted: false, deleted_at: null, deleted_by: null, is_hidden: false, hidden_at: null, hidden_reason: null })
    .eq("id", id)
    .select("id")
    .single();
  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id: adminId || null, action: "RESTORE_LOUNGE_POST",
      target_type: "lounge_post", target_id: id,
    });
  }
  return { data, error };
};

// ── Admin Lounge Comments ─────────────────────────────────────────────────────

export const adminGetLoungeComments = ({ limit = 200 } = {}) =>
  supabase
    .from("lounge_comments")
    .select("id, post_id, user_id, content, is_hidden, is_deleted, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

export const adminSoftDeleteLoungeComment = async (id, adminId, reason) => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("lounge_comments")
    .update({ is_deleted: true, deleted_at: now, deleted_by: adminId || null })
    .eq("id", id)
    .select("id")
    .single();
  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id: adminId || null, action: "DELETE_LOUNGE_COMMENT",
      target_type: "lounge_comment", target_id: id, reason,
    });
  }
  return { data, error };
};

export const adminRestoreLoungeComment = async (id, adminId) => {
  const { data, error } = await supabase
    .from("lounge_comments")
    .update({ is_deleted: false, deleted_at: null, deleted_by: null, is_hidden: false })
    .eq("id", id)
    .select("id")
    .single();
  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id: adminId || null, action: "RESTORE_LOUNGE_COMMENT",
      target_type: "lounge_comment", target_id: id,
    });
  }
  return { data, error };
};

// ── Admin Company / User Info Edit ────────────────────────────────────────────

export const adminUpdateCompanyInfo = async (id, fields, adminId) => {
  const { data, error } = await supabase
    .from("companies")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, name, region, company_status")
    .single();
  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id: adminId || null, action: "UPDATE_COMPANY_INFO",
      target_type: "company", target_id: id, after_val: fields,
    });
  }
  return { data, error };
};

export const adminUpdateUserInfo = async (id, fields, adminId) => {
  const { data, error } = await supabase
    .from("users")
    .update({ ...fields })
    .eq("id", id)
    .select("id, name, phone, region")
    .single();
  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id: adminId || null, action: "UPDATE_USER_INFO",
      target_type: "user", target_id: id, after_val: fields,
    });
  }
  return { data, error };
};

// ── Fee Config ────────────────────────────────────────────────────────────────

export const getFeeConfig = () =>
  supabase.from("fee_config").select("*").maybeSingle();

// 결제수단별 수수료 규칙(migration 031) — 3.7% 하드코딩 대신 DB 규칙에서 요율 조회.
export const getPaymentFeeRules = () =>
  supabase.from("payment_fee_rules").select("*").eq("is_active", true);

// ── Admin Logs ────────────────────────────────────────────────────────────────

export const createAdminLog = (log) =>
  supabase.from("admin_logs").insert(log).select().single();

// H-D: admin_logs는 관리자 전용 테이블.
// 서버 방어: Supabase RLS에 "auth.jwt()->>'role' = 'admin'" 정책 필요.
// 클라이언트 방어: admin_authed 세션이 없으면 빈 배열 반환(불필요한 DB 조회 차단).
export const getAdminLogs = () => {
  const isAdmin = typeof window !== "undefined" && localStorage.getItem("admin_authed") === "true";
  if (!isAdmin) return Promise.resolve({ data: [], error: null });
  return supabase.from("admin_logs").select("*").order("created_at", { ascending: false });
};

// ── Early Partner ─────────────────────────────────────────────────────────────

export const setEarlyPartner = (companyId, joinedAt) => {
  const benefitUntil = new Date(joinedAt);
  benefitUntil.setFullYear(benefitUntil.getFullYear() + 1);
  return supabase.from("companies").update({
    is_early_partner: true,
    early_partner_joined_at: joinedAt,
    early_partner_benefit_until: benefitUntil.toISOString(),
    fee_rate: 0.04,
  }).eq("id", companyId);
};

// ── STEP 19: Transaction State Machine ───────────────────────────────────────

// async 래퍼: PostgREST 빌더는 thenable이지만 .catch가 없어 호출부에서 .catch 체이닝 시
// "X.catch is not a function" 오류가 납니다. async로 감싸 실제 Promise를 반환합니다.
export const updateTransactionStatus = async (paymentId, transactionStatus) =>
  supabase
    .from("escrow_payments")
    .update({ transaction_status: transactionStatus })
    .eq("id", paymentId)
    .select("id, transaction_status")
    .single();

// 예상 완공일 — 업체가 계약 진행 화면에서 입력 (migration 015)
export const updateEscrowExpectedEndDate = async (paymentId, expectedEndDate) =>
  supabase
    .from("escrow_payments")
    .update({ expected_end_date: expectedEndDate })
    .eq("id", paymentId)
    .select("id, expected_end_date")
    .single();

export const getContractByTransactionStatus = (transactionStatus) =>
  supabase
    .from("escrow_payments")
    .select("*, requests(*), companies(*)")
    .eq("transaction_status", transactionStatus);

// ── STEP 20: Activity Logs ────────────────────────────────────────────────────

// async: 호출부에서 fire-and-forget으로 .catch(()=>{})를 거는 곳이 많습니다.
// 빌더 그대로 반환하면 .catch가 없어 오류 → async로 실제 Promise 반환 + 실행 보장.
export const logActivity = async ({ userId, role, action, targetType, targetId, metadata = {} }) =>
  supabase.from("activity_logs").insert({
    user_id:     userId ?? null,
    role,
    action,
    target_type: targetType ?? null,
    target_id:   targetId  ?? null,
    metadata,
  });

export const getActivityLogs = ({ targetType, targetId, limit = 50 } = {}) => {
  let q = supabase
    .from("activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (targetType) q = q.eq("target_type", targetType);
  if (targetId)   q = q.eq("target_id", targetId);
  return q;
};

export const getContractTimeline = (contractId) =>
  supabase
    .from("activity_logs")
    .select("*")
    .eq("target_type", "contract")
    .eq("target_id", contractId)
    .order("created_at", { ascending: true });

// ── STEP 21: Notifications ────────────────────────────────────────────────────

export const createNotification = async ({ userId, type, title, message, relatedId, relatedType, priority = "NORMAL" }) =>
  supabase.from("notifications").insert({
    user_id:      userId,
    type,
    title,
    message,
    related_id:   relatedId   ?? null,
    related_type: relatedType ?? null,
    priority,
  });

export const getUserNotifications = (userId, { unreadOnly = false, limit = 30 } = {}) => {
  let q = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (unreadOnly) q = q.eq("is_read", false);
  return q;
};

export const getUnreadCount = async (userId) => {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  return { count: count ?? 0, error };
};

export const markNotificationRead = (notificationId) =>
  supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

export const markAllNotificationsRead = (userId) =>
  supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

export const subscribeToNotifications = (userId, callback) =>
  supabase
    .channel(`notifications:${userId}`)
    .on("postgres_changes", {
      event:  "INSERT",
      schema: "public",
      table:  "notifications",
      filter: `user_id=eq.${userId}`,
    }, callback)
    .subscribe();

// ── STEP 22: Company Status System ───────────────────────────────────────────

export const setCompanyStatus = (companyId, companyStatus, adminId) =>
  supabase
    .from("companies")
    .update({ company_status: companyStatus })
    .eq("id", companyId)
    .select("id, company_status")
    .single();

export const getActiveCompanies = () =>
  supabase
    .from("companies")
    .select("*")
    .eq("company_status", "ACTIVE")
    .order("temp", { ascending: false });

// ── STEP 24: Company KPI ──────────────────────────────────────────────────────

export const updateCompanyKpi = (companyId, kpi) =>
  supabase
    .from("companies")
    .update({
      avg_response_hours: kpi.avgResponseHours  ?? undefined,
      response_rate:      kpi.responseRate       ?? undefined,
      conversion_rate:    kpi.conversionRate     ?? undefined,
      completion_rate:    kpi.completionRate     ?? undefined,
      dispute_rate:       kpi.disputeRate        ?? undefined,
    })
    .eq("id", companyId)
    .select("id, avg_response_hours, response_rate, conversion_rate, completion_rate, dispute_rate")
    .single();

// ── STEP 25: Dispute Status ───────────────────────────────────────────────────

export const updateDisputeStatus = async (paymentId, disputeStatus) =>
  supabase
    .from("escrow_payments")
    .update({ dispute_status: disputeStatus })
    .eq("id", paymentId)
    .select("id, dispute_status")
    .single();

// ── STEP 26-1: Change Orders ──────────────────────────────────────────────────

// ── 추가견적(Change Order) — 예외 흐름. 모든 쓰기는 security-definer RPC(actor 검증). ──
// role: 'company' | 'consumer'. 생성은 양방향, 승인/결제는 의뢰인, 완료는 업체.
export const createChangeOrder = ({ contractId, actorId, role, reasonType, description, amount = 0, photos = [] }) =>
  supabase.rpc("change_order_create", {
    p_actor_id: actorId, p_contract_id: contractId, p_role: role,
    p_reason_type: reasonType, p_description: description,
    p_amount: amount != null ? Math.round(amount) : 0, p_photos: photos ?? [],
  });

export const getChangeOrders = (contractId) =>
  supabase.rpc("change_orders_for_contract", { p_contract_id: contractId });

// 업체가 고객 변경요청에 금액/내용 보정(requested 단계)
export const setChangeOrderAmount = (id, { actorId, amount, description = null, photos = null }) =>
  supabase.rpc("change_order_set_amount", {
    p_actor_id: actorId, p_id: id,
    p_amount: amount != null ? Math.round(amount) : null, p_description: description, p_photos: photos,
  });

export const approveChangeOrder = (id, actorId) =>
  supabase.rpc("change_order_approve", { p_actor_id: actorId, p_id: id });

export const rejectChangeOrder = (id, actorId, rejectReason = null) =>
  supabase.rpc("change_order_reject", { p_actor_id: actorId, p_id: id, p_reason: rejectReason });

// 추가 결제 완료(고객) → paid. MVP: PG 연동 전 결제 성공 시점 호출(별도 결제).
export const markChangeOrderPaid = (id, actorId) =>
  supabase.rpc("change_order_mark_paid", { p_actor_id: actorId, p_id: id });

// 추가공사 완료(업체) → completed + 100% 정산 마커(원계약과 분리).
export const completeChangeOrder = (id, actorId) =>
  supabase.rpc("change_order_complete", { p_actor_id: actorId, p_id: id });

export const cancelChangeOrder = (id, actorId) =>
  supabase.rpc("change_order_cancel", { p_actor_id: actorId, p_id: id });

// ── 추가견적 전용 결제주문(원계약 escrow 결제와 분리) ──────────────────────────
// payment_source='change_order' + change_order_id 로 원계약 payment_order 와 구분.
// 추가견적 금액을 원계약 escrow 원금에 섞지 않는다.
export const createChangeOrderPaymentOrder = ({
  contractId, requestId = null, userId = null, changeOrderId, amount,
  feeAmount = 0, paymentMethod = "CARD", provider = "TOSS", status = "PENDING", rawResponse = null,
}) =>
  supabase.from("payment_orders").insert({
    contract_id:     contractId,
    request_id:      requestId,
    user_id:         userId,
    change_order_id: changeOrderId,
    payment_source:  "change_order",
    provider,
    payment_method:  paymentMethod,
    amount,
    fee_amount:      feeAmount,
    net_amount:      amount,
    total_amount:    amount,
    status,
    raw_response:    rawResponse,
  }).select().single();

export const updateChangeOrderPaymentOrder = (id, { status, rawResponse = null, paidAt = null }) =>
  supabase.from("payment_orders").update({
    status,
    ...(rawResponse != null && { raw_response: rawResponse }),
    ...(paidAt && { paid_at: paidAt }),
  }).eq("id", id).select().single();

export const getChangeOrderPaymentOrder = (changeOrderId) =>
  supabase.from("payment_orders")
    .select("*")
    .eq("change_order_id", changeOrderId)
    .eq("payment_source", "change_order")
    .order("created_at", { ascending: false })
    .maybeSingle();

// 관리자 전용 추가견적 조회(role=admin 검증 RPC, operator 차단) — migration 034.
export const adminGetChangeOrders = (contractId, adminId) =>
  supabase.rpc("admin_change_orders_for_contract", { p_admin_id: adminId ?? null, p_contract_id: contractId });

// 관리자 계약 통합 상세(원계약·추가견적 결제/정산/GPS/분쟁) — role=admin 검증 RPC, operator 차단.
// requestId 또는 contractId 중 하나로 조회. migration 035.
export const getAdminContractDetail = ({ requestId = null, contractId = null, adminId }) =>
  supabase.rpc("admin_contract_detail", {
    p_admin_id: adminId ?? null, p_request_id: requestId, p_contract_id: contractId,
  });

// ── STEP 26-2: Contract Scope ─────────────────────────────────────────────────

export const upsertContractScope = (data) =>
  supabase
    .from("contract_scopes")
    .upsert(data, { onConflict: "contract_id" })
    .select()
    .single();

export const getContractScope = (contractId) =>
  supabase
    .from("contract_scopes")
    .select("*")
    .eq("contract_id", contractId)
    .maybeSingle();

// ── STEP 26-3: Phase Photos ───────────────────────────────────────────────────

export const addPhasePhotos = ({ contractId, step, photos, uploadedBy, uploaderRole, caption }) =>
  supabase.from("phase_photos").insert({
    contract_id:   contractId,
    step,
    photos,
    uploaded_by:   uploadedBy,
    uploader_role: uploaderRole,
    caption:       caption ?? null,
  }).select().single();

export const getPhasePhotos = (contractId, step = null) => {
  let q = supabase
    .from("phase_photos")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: true });
  if (step !== null) q = q.eq("step", step);
  return q;
};

// ── STEP 27: Contract Notes (양방향 기록) ────────────────────────────────────

export const addContractNote = ({ contractId, authorId, authorRole, type, content, images = [] }) =>
  supabase.from("contract_notes").insert({
    contract_id: contractId,
    author_id:   authorId,
    author_role: authorRole,
    type,
    content,
    images,
  }).select().single();

export const getContractNotes = (contractId) =>
  supabase
    .from("contract_notes")
    .select("*, users(name, role)")
    .eq("contract_id", contractId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

export const updateContractNote = async (noteId, newContent, authorId) => {
  const { data: existing, error } = await supabase
    .from("contract_notes")
    .select("content, edit_history, updated_at")
    .eq("id", noteId)
    .single();
  if (error) return { error };

  const historyEntry = { content: existing.content, edited_at: existing.updated_at };
  const editHistory  = [...(existing.edit_history ?? []), historyEntry];

  return supabase
    .from("contract_notes")
    .update({ content: newContent, edit_history: editHistory })
    .eq("id", noteId)
    .eq("author_id", authorId);
};

export const softDeleteContractNote = (noteId, authorId) =>
  supabase
    .from("contract_notes")
    .update({ is_deleted: true })
    .eq("id", noteId)
    .eq("author_id", authorId);

export const subscribeToContractNotes = (contractId, callback) =>
  supabase
    .channel(`contract_notes:${contractId}`)
    .on("postgres_changes", {
      event:  "INSERT",
      schema: "public",
      table:  "contract_notes",
      filter: `contract_id=eq.${contractId}`,
    }, callback)
    .subscribe();

// ── Admin: list users by role ─────────────────────────────────────────────────

export const getUsers = ({ role } = {}) => {
  let q = supabase.from("users").select("*").order("created_at", { ascending: false });
  if (role) q = q.eq("role", role);
  return q;
};

// ── Company dashboard: active escrow jobs ─────────────────────────────────────

export const getCompanyEscrowJobs = (companyId) =>
  supabase
    .from("escrow_payments")
    .select("*, requests(space_type, area, size)")
    .eq("company_id", companyId)
    .not("status", "eq", "completed")
    .order("created_at", { ascending: false });

// Returns SETTLED/COMPLETED escrow rows for the 완료 tab (company_id = users.id)
export const getCompletedEscrowByCompany = (companyId) =>
  supabase
    .from("escrow_payments")
    .select("id, request_id, total_amount, transaction_status, created_at, current_step, requests(area, space_type, type, size)")
    .eq("company_id", companyId)
    .in("transaction_status", ["SETTLED", "COMPLETED"])
    .order("created_at", { ascending: false });


export const adminReviewCompany = async (companyId, adminId, docStatus, rejectNote = null) => {
  const { data: prev } = await supabase
    .from("companies")
    .select("doc_status, verified")
    .eq("id", companyId)
    .single();

  const { data, error } = await supabase
    .from("companies")
    .update({
      doc_status: docStatus,
      reject_note: rejectNote,
      reviewed_at: new Date().toISOString(),
      ...(docStatus === "approved" && { verified: true }),
    })
    .eq("id", companyId)
    .select()
    .single();

  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id: adminId || null,
      action: docStatus === "approved" ? "APPROVE_COMPANY" : "REJECT_COMPANY",
      target_type: "company",
      target_id: companyId,
      before_val: { doc_status: prev?.doc_status },
      after_val: { doc_status: docStatus },
      reason: rejectNote,
    });
  }

  return { data, error };
};

// ── STEP H: Payment Orders ────────────────────────────────────────────────────

export const createPaymentOrder = (data) =>
  supabase.from("payment_orders").insert(data).select().single();

export const getPaymentOrder = (id) =>
  supabase.from("payment_orders").select("*").eq("id", id).single();

export const getPaymentOrderByBid = (bidId) =>
  supabase.from("payment_orders").select("*").eq("bid_id", bidId).maybeSingle();

export const updatePaymentOrderStatus = (id, status) =>
  supabase.from("payment_orders").update({ status }).eq("id", id).select().single();

// ── STEP H: Escrow Payouts ────────────────────────────────────────────────────

export const createEscrowPayout = (data) =>
  supabase.from("escrow_payouts").insert(data).select().single();

export const getEscrowPayouts = (escrowId) =>
  supabase.from("escrow_payouts").select("*").eq("escrow_id", escrowId).order("stage");

export const updateEscrowPayoutStatus = (id, status, approvedBy = null) =>
  supabase.from("escrow_payouts").update({
    status,
    ...(approvedBy && { approved_by: approvedBy, approved_at: new Date().toISOString() }),
  }).eq("id", id).select().single();

// ── STEP G: Admin company status ──────────────────────────────────────────────

export const adminSetCompanyStatus = async (companyId, adminId, companyStatus, reason = null) => {
  const { data: prev } = await supabase
    .from("companies").select("company_status").eq("id", companyId).single();

  const { data, error } = await supabase
    .from("companies")
    .update({ company_status: companyStatus })
    .eq("id", companyId)
    .select("id, company_status")
    .single();

  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id: adminId || null,
      action: `SET_COMPANY_STATUS_${companyStatus}`,
      target_type: "company",
      target_id: companyId,
      before_val: { company_status: prev?.company_status },
      after_val: { company_status: companyStatus },
      reason,
    });
  }

  return { data, error };
};

// 현장방문/견적 쓰기는 모두 security-definer RPC 경유(분쟁·정산 증빙 데이터, anon 직접 쓰기 금지).
// RPC 내부에서 p_actor_id(=업체 소유자 user.id) 기준으로 선택된 업체 여부를 검증한다.
// 반환은 RPC 의 jsonb(row) → { data, error } 형태로 기존 호출부와 호환.
export const createSiteVisit = (data, actorId = null) =>
  supabase.rpc("site_visit_create", {
    p_actor_id: actorId,
    p_bid_id: data.bid_id ?? null,
    p_request_id: data.request_id ?? null,
    p_company_id: data.company_id ?? null,
    p_scheduled_at: data.scheduled_at ?? null,
  });

// bid.company_id 가 ownerId(users.id)로 저장된 기존 데이터 호환 — companies.id 로 resolve.
// id 로 직접 매칭되면 그대로 반환, 아니면 owner_id 로 조회해 companies.id 반환.
export const resolveCompanyId = async (companyIdOrOwnerId) => {
  if (!companyIdOrOwnerId) return null;
  const { data } = await supabase
    .from("companies")
    .select("id")
    .or(`id.eq.${companyIdOrOwnerId},owner_id.eq.${companyIdOrOwnerId}`)
    .limit(1)
    .maybeSingle();
  return data?.id ?? companyIdOrOwnerId;
};

// 의뢰인 현장견적 요청 → site_visits(status='requested') 생성 + 요청 전이(RPC, actor=의뢰인 검증).
export const requestSiteVisit = ({ requestId, bidId, companyId, actorId = null } = {}) =>
  supabase.rpc("site_visit_request", {
    p_actor_id: actorId, p_request_id: requestId, p_bid_id: bidId ?? null, p_company_id: companyId ?? null,
  });

// 업체 현장견적 요청 수락/거절. action: 'accept' | 'reject'. RPC 가 업체 소유자 검증.
export const respondSiteVisit = (siteVisitId, action, actorId = null) =>
  supabase.rpc("site_visit_respond", { p_actor_id: actorId, p_id: siteVisitId, p_action: action });

export const getSiteVisitForBid = (bidId) =>
  supabase.from("site_visits").select("*").eq("bid_id", bidId).order("created_at", { ascending: false }).limit(1).maybeSingle();

export const getSiteVisitsByCompany = (companyId) =>
  supabase.from("site_visits").select("*").eq("company_id", companyId).order("created_at", { ascending: false });

export const updateSiteVisit = (id, data) =>
  supabase.from("site_visits").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id).select().single();

// GPS 체크인 — 버튼 클릭 시점 1회 위치 기록(실시간 추적 아님). RPC 가 현장방문 소유자 검증.
export const gpsCheckin = (id, { lat, lng, photos }, actorId = null) =>
  supabase.rpc("site_visit_checkin", {
    p_actor_id: actorId, p_id: id, p_lat: lat ?? null, p_lng: lng ?? null, p_photos: photos ?? [],
  });

// [정책] 현장견적 카운트다운: 72h — RPC 내부에서 now()+72h 로 estimate_due_at 설정.
export const completeSiteVisit = (id, { fieldAmount, fieldNote }, actorId = null) =>
  supabase.rpc("site_visit_complete", {
    p_actor_id: actorId, p_id: id,
    p_field_amount: fieldAmount != null ? Math.round(fieldAmount) : null, p_field_note: fieldNote ?? null,
  });

// 견적서 매핑 — 작성 폼 payload(snake_case) → RPC 파라미터.
const estimateRpcParams = (data) => ({
  p_bid_id: data.bid_id ?? null,
  p_request_id: data.request_id ?? null,
  p_site_visit_id: data.site_visit_id ?? null,
  p_company_id: data.company_id ?? null,
  p_items: data.items ?? [],
  p_total_price: data.total_price != null ? Math.round(data.total_price) : null,
  p_duration_days: data.duration_days != null ? Math.round(data.duration_days) : null,
  p_note: data.note ?? null,
  p_warranty_note: data.warranty_note ?? null,
  p_photo_urls: Array.isArray(data.photo_urls) ? data.photo_urls : [],
});

// 견적서 생성(draft) — RPC 가 업체 소유자 검증.
export const createEstimate = (data, actorId = null) =>
  supabase.rpc("estimate_upsert", { p_actor_id: actorId, p_estimate_id: null, ...estimateRpcParams(data) });

export const getEstimateForSiteVisit = (siteVisitId) =>
  supabase.from("estimates").select("*").eq("site_visit_id", siteVisitId).order("created_at", { ascending: false }).limit(1).maybeSingle();

// 최종 견적서 조회 — OTP(anon) 세션은 estimates RLS(auth.uid() IS NOT NULL)에 막혀
// 직접 SELECT 시 row 가 있어도 data:null 이 된다. SECURITY DEFINER RPC(046)로 우회 조회.
// 반환 형태는 기존 .maybeSingle() 과 동일(단일 row 객체 또는 null).
export const getEstimateForRequest = (requestId) =>
  supabase.rpc("estimate_get_for_request", { p_request_id: requestId });

// 견적서 수정(draft) — RPC 가 업체 소유자 검증.
export const updateEstimate = (id, data, actorId = null) =>
  supabase.rpc("estimate_upsert", { p_actor_id: actorId, p_estimate_id: id, ...estimateRpcParams(data) });

// 견적서 제출 — estimate submitted + site_visit estimate_submitted + request final_quote_submitted
// 세 갱신을 RPC 한 번에 원자적으로 처리(직접 UPDATE 는 RLS 차단). RPC 가 업체 소유자 검증.
export const submitEstimate = (id, siteVisitId, requestId, actorId = null) =>
  supabase.rpc("estimate_submit", {
    p_actor_id: actorId, p_estimate_id: id,
    p_site_visit_id: siteVisitId ?? null, p_request_id: requestId ?? null,
  });

// ── GPS 체크포인트(3차) — 현장방문/착공/중간점검/완료 4회. 버튼 클릭 1회 캡처. ──
// 좌표 + 정확도 + 도로명/지번 주소를 함께 저장. security-definer RPC 가 actor(업체) 검증.
export const saveProjectCheckpoint = ({
  actorId = null, requestId = null, contractId = null, siteVisitId = null,
  type, lat = null, lng = null, accuracy = null,
  roadAddress = null, jibunAddress = null, addressFull = null,
  sido = null, sigungu = null, dong = null, bunji = null,
  photos = [], note = null,
} = {}) =>
  supabase.rpc("project_checkpoint_save", {
    p_actor_id: actorId, p_request_id: requestId, p_contract_id: contractId, p_site_visit_id: siteVisitId,
    p_type: type, p_lat: lat, p_lng: lng, p_accuracy: accuracy,
    p_address_full: addressFull, p_road_address: roadAddress, p_jibun_address: jibunAddress,
    p_sido: sido, p_sigungu: sigungu, p_dong: dong, p_bunji: bunji,
    p_photos: photos ?? [], p_note: note,
  });

// 요청 단위 체크포인트 조회(관리자/프로젝트 상세 공용). actorId 로 당사자/admin 검증.
// 좌표(lat/lng/accuracy)는 admin 만, 일반 당사자는 주소 수준만 반환(RPC 에서 마스킹).
export const getProjectCheckpoints = (requestId, actorId = null) =>
  supabase.rpc("project_checkpoints_for_request", { p_request_id: requestId, p_actor_id: actorId });

// 업체 진행건(현장방문 견적 단계) 조회 — "선택된 업체"인 요청만 반환한다.
// 매칭 기준(셋 중 하나라도 candidateIds 에 포함되면 해당 업체의 진행건):
//   ① 선택된 입찰(bids.selected=true) 의 company_id
//   ② requests.selected_company_id
//   ③ escrow_payments.company_id (계약 업체)
// bids.company_id 는 소유자 users.id(=auth user.id)로 저장되므로, company.id 와 owner
// user.id 를 모두 후보(candidateIds)로 받아 매칭한다 — 불일치로 진행건이 누락되던 문제 수정.
// 결과는 request.id 기준으로 dedupe 한다(같은 요청이 여러 경로로 잡혀도 1건).
export const getCompanyActiveJobs = async (companyId, extraIds = []) => {
  const candidateIds = [...new Set([companyId, ...(extraIds ?? [])].filter(Boolean))];
  if (candidateIds.length === 0) return { data: [], error: null };

  // ① 선택된 입찰
  const { data: bids, error: bidErr } = await supabase
    .from("bids")
    .select("*, requests(*)")
    .in("company_id", candidateIds)
    .eq("selected", true)
    .order("created_at", { ascending: false });
  if (bidErr) return { data: [], error: bidErr };

  // ② requests.selected_company_id (입찰행 누락/selected 플래그 미반영 보강)
  const { data: selReqs } = await supabase
    .from("requests")
    .select("*")
    .in("selected_company_id", candidateIds);

  // ③ escrow 직접 연결(계약 업체) → request_id 확보
  const { data: escrows } = await supabase
    .from("escrow_payments")
    .select("request_id, company_id")
    .in("company_id", candidateIds);

  // request.id 기준 병합/dedupe
  const byReq = {};
  for (const b of bids ?? []) {
    const req = b.requests ?? null;
    const rid = req?.id ?? b.request_id;
    if (!rid) continue;
    byReq[rid] = { request: req, bid: b };
  }
  for (const r of selReqs ?? []) {
    if (!byReq[r.id]) byReq[r.id] = { request: r, bid: null };
    else if (!byReq[r.id].request) byReq[r.id].request = r;
  }
  const escrowReqIds = [...new Set((escrows ?? []).map(e => e.request_id).filter(Boolean))];
  const missingReqIds = escrowReqIds.filter(rid => !byReq[rid]);
  if (missingReqIds.length > 0) {
    const { data: escReqs } = await supabase.from("requests").select("*").in("id", missingReqIds);
    for (const r of escReqs ?? []) if (!byReq[r.id]) byReq[r.id] = { request: r, bid: null };
  }

  const entries = Object.values(byReq).filter(e => e.request);
  const jobs = await Promise.all(entries.map(async ({ request, bid }) => {
    let sv = null, est = null;
    if (bid?.id) {
      const { data: svRow } = await supabase.from("site_visits").select("*").eq("bid_id", bid.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      sv = svRow ?? null;
      if (sv) {
        const { data: estRow } = await supabase.from("estimates").select("*").eq("site_visit_id", sv.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
        est = estRow ?? null;
      }
    }
    return { bid: bid ?? null, request, siteVisit: sv, estimate: est };
  }));

  try {
    console.log("[GONGGAN_DEBUG][getCompanyJobs]", {
      candidateIds, selectedBids: bids?.length ?? 0, selReqs: selReqs?.length ?? 0, escrows: escrows?.length ?? 0,
      jobs: jobs.map(j => ({
        request_id: j.request?.id, status: j.request?.status,
        selected_company_id: j.request?.selected_company_id ?? null, selected_bid_id: j.request?.selected_bid_id ?? null,
        bid_id: j.bid?.id ?? null, bid_company_id: j.bid?.company_id ?? null, bid_price: j.bid?.price ?? null,
        budget_min: j.request?.budget_min ?? null, budget_max: j.request?.budget_max ?? null,
        siteVisit: j.siteVisit?.status ?? null,
      })),
    });
  } catch {}
  return { data: jobs, error: null };
};

// ── STEP B: Update request status (in_progress) ───────────────────────────────

// 요청 상태 전이(open → in_progress). anon 직접 UPDATE 는 RLS(auth.uid()=user_id, 커스텀 OTP라
// null)에 막혀 반영되지 않으므로 security definer RPC(migration 030)로 처리. 실제 활성 에스크로가
// 있을 때만 전이된다(RPC 내부 검증). 반환 { data, error } — 기존 호출부 호환.
export const setRequestInProgress = (requestId) =>
  supabase.rpc("request_mark_in_progress", { p_request_id: requestId });

// 정산 완료(escrow SETTLED) 시 requests.status 를 'completed' 로 동기화(SECURITY DEFINER RPC).
// requests 직접 UPDATE 는 RLS(auth.uid()=null)에 막히므로 RPC 경유. migration 041 필요.
export const setRequestCompleted = (requestId) =>
  supabase.rpc("request_mark_completed", { p_request_id: requestId });

// ── STEP B: Get company status ────────────────────────────────────────────────

export const getCompanyStatus = (companyId) =>
  supabase.from("companies").select("company_status").eq("id", companyId).single();

// ── STEP B: Escrow record creation ────────────────────────────────────────────

export const createEscrowRecord = async (data) => {
  console.log("[GONGGAN_DEBUG][createEscrow]", { requestId: data.requestId ?? null, companyId: data.companyId ?? null, totalAmount: data.totalAmount });
  const res = await supabase.from("escrow_payments").insert({
    request_id:          data.requestId ?? null,
    company_id:          data.companyId ?? null,
    total_amount:        data.totalAmount,
    transaction_status:  "CONTRACTED",
    status:              "deposited",
    step1_deposited_at:  new Date().toISOString(),
  }).select().single();
  try { console.log("[GONGGAN_DEBUG][createEscrow:result]", { id: res.data?.id ?? null, request_id: res.data?.request_id ?? null, company_id: res.data?.company_id ?? null, total_amount: res.data?.total_amount ?? null, error: res.error?.message ?? null }); } catch {}
  return res;
};

// 멱등 에스크로 확보 — 같은 request_id 에 활성(취소/정산 아님) 에스크로가 있으면 재사용,
// 없을 때만 1건 생성. 결제/현장방문/재진입 경로의 중복 escrow_payments insert 를 차단한다.
// 반환: { data, created, error }
//   · created=true  → 신규 생성(후속 payout 생성 필요)
//   · created=false → 기존 재사용(payout 재생성 금지 — 중복 방지)
// 우선 escrow_get_or_create RPC(advisory lock + select-then-insert)를 시도하고,
// 미배포/실패 시 클라이언트 폴백(active 조회 → 없으면 createEscrowRecord, 충돌 시 재조회).
export const getOrCreateEscrow = async ({ requestId, companyId, totalAmount }) => {
  if (!requestId) return { data: null, created: false, error: { message: "no request_id" } };

  const rpc = await supabase.rpc("escrow_get_or_create", {
    p_request_id: requestId, p_company_id: companyId ?? null, p_total_amount: totalAmount ?? 0,
  });
  if (!rpc.error && rpc.data?.row) {
    return { data: rpc.data.row, created: rpc.data.created === true, error: null };
  }

  // ── 폴백(RPC 미배포 환경) ──────────────────────────────────────────
  const findActive = async () => {
    const { data } = await supabase.from("escrow_payments").select("*")
      .eq("request_id", requestId)
      .not("transaction_status", "in", "(CANCELLED,SETTLED)")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data ?? null;
  };
  const existing = await findActive();
  if (existing?.id) return { data: existing, created: false, error: null };

  const { data: created, error } = await createEscrowRecord({ requestId, companyId, totalAmount });
  if (created?.id) return { data: created, created: true, error: null };

  // partial unique index 충돌 등으로 insert 실패 → 동시 생성된 기존 행 재조회.
  const retry = await findActive();
  if (retry?.id) return { data: retry, created: false, error: null };
  return { data: null, created: false, error: error ?? { message: "escrow create failed" } };
};

// H-6: 단계별 payout 생성 실패 시 방금 만든 escrow를 되돌리기 위한 롤백 헬퍼.
// (payout 없는 escrow는 단계 표시가 깨지므로 고아 레코드를 남기지 않음)
export const deleteEscrowRecord = (id) =>
  supabase.from("escrow_payments").delete().eq("id", id);

// STEP M: Create all 4 escrow payout records for a contract (with fee_snapshot)
export const createEscrowPayoutsForContract = async (escrowId, companyId, totalAmount, feeRate = 0.04, vatRate = 0.1) => {
  const feeSnapshot = { companyFeeRate: feeRate, vatRate, snapshotAt: new Date().toISOString() };
  const stages = [
    { stage: 1, percent: 10 },
    { stage: 2, percent: 20 },
    { stage: 3, percent: 40 },
    { stage: 4, percent: 30 },
  ];
  const payouts = stages.map(s => {
    const amount      = Math.round(totalAmount * s.percent / 100);
    const platformFee = Math.round(amount * feeRate);
    const vat         = Math.round(platformFee * vatRate);
    return {
      escrow_id:    escrowId,
      company_id:   companyId,
      stage:        s.stage,
      percent:      s.percent,
      amount,
      platform_fee: platformFee,
      vat,
      net_amount:   amount - platformFee - vat,
      fee_snapshot: feeSnapshot,
      status:       "PENDING",
    };
  });
  return supabase.from("escrow_payouts").insert(payouts).select();
};

// Hold all non-final payouts when a dispute is filed
export const holdAllPayoutsForEscrow = async (escrowId) =>
  supabase.from("escrow_payouts")
    .update({ status: "HELD" })
    .eq("escrow_id", escrowId)
    .in("status", ["PENDING", "READY", "APPROVED"]);

// Approve a specific stage payout
export const approveEscrowPayoutByStage = (escrowId, stage, approvedBy = null) =>
  supabase.from("escrow_payouts")
    .update({
      status:      "APPROVED",
      approved_by: approvedBy ?? null,
      approved_at: new Date().toISOString(),
    })
    .eq("escrow_id", escrowId)
    .eq("stage", stage)
    .select()
    .single();

// ── Lounge ────────────────────────────────────────────────────────────────────

export const IS_SUPABASE_READY = !!(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_URL !== "https://placeholder.supabase.co" &&
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  import.meta.env.VITE_SUPABASE_ANON_KEY !== "placeholder-anon-key"
);

export const uploadLoungeImage = async (file, userId) => {
  const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const name = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `lounge/${userId}/${name}`;
  const { error } = await supabase.storage
    .from('lounge-images')
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) return { data: null, error };
  const { data } = supabase.storage.from('lounge-images').getPublicUrl(path);
  return { data, error: null };
};

// ── STEP O: ops_config (Emergency Switch) ────────────────────────────────────

export const getOpsConfig = () =>
  supabase.from("ops_config").select("*").limit(1).single();

export const updateOpsConfig = async (adminId, updates) => {
  const { data: existing } = await supabase.from("ops_config").select("id").limit(1).single();
  if (existing?.id) {
    return supabase.from("ops_config")
      .update({ ...updates, updated_by: adminId ?? null, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select().single();
  }
  return supabase.from("ops_config")
    .insert({ ...updates, updated_by: adminId ?? null })
    .select().single();
};

// ── STEP L: customer_reports ──────────────────────────────────────────────────

export const createCustomerReport = ({ reporterId, reportedId, reportType, description, contractId }) =>
  supabase.from("customer_reports").insert({
    reporter_id: reporterId ?? null,
    reported_id: reportedId,
    report_type: reportType,
    description: description ?? null,
    contract_id: contractId ?? null,
  }).select().single();

export const getCustomerReports = ({ status } = {}) => {
  let q = supabase.from("customer_reports")
    .select("*, reporter:reporter_id(name, phone), reported:reported_id(name, phone)")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  return q;
};

export const updateCustomerReportStatus = (id, status, adminNote = null) =>
  supabase.from("customer_reports")
    .update({ status, ...(adminNote && { admin_note: adminNote }) })
    .eq("id", id)
    .select().single();

// ── STEP H: Payment Transactions ──────────────────────────────────────────────

export const createPaymentTransaction = (data) =>
  supabase.from("payment_transactions").insert(data).select().single();

export const getPaymentTransactions = ({ orderId = null, limit = 50 } = {}) => {
  let q = supabase
    .from("payment_transactions")
    .select("*, payment_orders(id, amount, payment_method, status)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (orderId) q = q.eq("payment_order_id", orderId);
  return q;
};

// ── Admin: Payment Order Management ──────────────────────────────────────────

export const getPaymentOrders = ({ status = null, limit = 100, userId = null } = {}) => {
  let q = supabase
    .from("payment_orders")
    .select("*, users:user_id(id, name, phone)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status && status !== "all") q = q.eq("status", status);
  if (userId) q = q.eq("user_id", userId);
  return q;
};

export const adminUpdatePaymentOrder = async (id, adminId, { status, adminNote = null } = {}) => {
  const { data: prev } = await supabase
    .from("payment_orders").select("status").eq("id", id).single();

  const updateData = {};
  if (status) updateData.status = status;
  if (adminNote) updateData.admin_note = adminNote;

  const { data, error } = await supabase
    .from("payment_orders")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id:    adminId || null,
      action:      `PAYMENT_${status ?? "UPDATE"}`,
      target_type: "payment",
      target_id:   id,
      before_val:  { status: prev?.status },
      after_val:   { status },
      reason:      adminNote,
    });
  }

  return { data, error };
};

// ── Webhook Logs ──────────────────────────────────────────────────────────────

export const createWebhookLog = (data) =>
  supabase.from("webhook_logs").insert(data).select().single();

export const getWebhookLogs = ({ limit = 50 } = {}) =>
  supabase
    .from("webhook_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

// ── Admin: Dispute Payments ───────────────────────────────────────────────────

export const getDisputePayments = () =>
  supabase
    .from("escrow_payments")
    .select("*, requests(id, space_type, area, user_id), companies(id, name, owner_id)")
    .not("dispute_status", "is", null)
    .order("disputed_at", { ascending: false });

// ── Admin: Pending Payouts ────────────────────────────────────────────────────

export const getPendingPayouts = () =>
  supabase
    .from("escrow_payouts")
    .select("*, companies(id, name, owner_id), escrow_payments(id, total_amount, transaction_status)")
    .in("status", ["PENDING", "READY", "APPROVED", "HELD"])
    .order("created_at", { ascending: false });


// ── Admin: Dispute management ─────────────────────────────────────────────────

// ── 관리자 강제 정리(테스트/꼬인 거래) — security-definer RPC. role='admin' 만 실행. ──
// mode: 'soft_cancel' | 'hard_delete_test_only'. before/after 스냅샷은 admin_logs 에 기록.
export const adminCleanupRequest = (adminId, requestId, mode = "soft_cancel") =>
  supabase.rpc("admin_cleanup_request", { p_admin_id: adminId, p_request_id: requestId, p_mode: mode });
export const adminCleanupUserTestData = (adminId, userId, mode = "soft_cancel") =>
  supabase.rpc("admin_cleanup_user_test_data", { p_admin_id: adminId, p_user_id: userId, p_mode: mode });
export const adminCleanupCompanyTestData = (adminId, companyId, mode = "soft_cancel") =>
  supabase.rpc("admin_cleanup_company_test_data", { p_admin_id: adminId, p_company_id: companyId, p_mode: mode });

export const adminResolveDispute = async (paymentId, adminId, resolution, reason = null) => {
  const { data: prev } = await supabase
    .from("escrow_payments").select("dispute_status").eq("id", paymentId).single();

  const { data, error } = await supabase
    .from("escrow_payments")
    .update({ dispute_status: resolution })
    .eq("id", paymentId)
    .select("id, dispute_status")
    .single();

  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id:    adminId || null,
      action:      `DISPUTE_${resolution}`,
      target_type: "dispute",
      target_id:   paymentId,
      before_val:  { dispute_status: prev?.dispute_status },
      after_val:   { dispute_status: resolution },
      reason,
    });
  }
  return { data, error };
};


export const adminSetPayoutStatus = async (payoutId, adminId, status, reason = null) => {
  const { data: prev } = await supabase
    .from("escrow_payouts").select("status").eq("id", payoutId).single();

  const { data, error } = await supabase
    .from("escrow_payouts")
    .update({
      status,
      ...(status === "APPROVED" ? { approved_by: adminId, approved_at: new Date().toISOString() } : {}),
    })
    .eq("id", payoutId)
    .select("id, status")
    .single();

  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id:    adminId || null,
      action:      `SET_PAYOUT_${status}`,
      target_type: "settlement",
      target_id:   payoutId,
      before_val:  { status: prev?.status },
      after_val:   { status },
      reason,
    });
  }

  return { data, error };
};

// ── Company Documents ─────────────────────────────────────────────────────────

export const getCompanyDocuments = (companyId) =>
  supabase
    .from("company_documents")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

export const upsertCompanyDocument = (data) => {
  if (data.id) {
    const { id, ...rest } = data;
    return supabase
      .from("company_documents")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
  }
  return supabase
    .from("company_documents")
    .upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: "company_id,document_type" })
    .select()
    .single();
};

export const submitCompanyDocument = (docId) =>
  supabase
    .from("company_documents")
    .update({ review_status: "submitted", updated_at: new Date().toISOString() })
    .eq("id", docId)
    .select()
    .single();

export const adminReviewDocument = async (docId, adminId, reviewStatus, reason = null) => {
  const { data, error } = await supabase
    .from("company_documents")
    .update({
      review_status: reviewStatus,
      review_reason: reason ?? null,
      reviewed_by:   adminId ?? null,
      reviewed_at:   new Date().toISOString(),
      updated_at:    new Date().toISOString(),
    })
    .eq("id", docId)
    .select()
    .single();

  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id:    adminId ?? null,
      action:      `DOC_${reviewStatus.toUpperCase()}`,
      target_type: "document",
      target_id:   docId,
      after_val:   { review_status: reviewStatus, reason },
    });
  }

  return { data, error };
};

// ── Admin: User status & space economy ────────────────────────────────────────

export const adminSetUserStatus = async (userId, adminId, status, reason = null) => {
  const { data: prev } = await supabase
    .from("users").select("account_status").eq("id", userId).single();

  const { data, error } = await supabase
    .from("users")
    .update({ account_status: status })
    .eq("id", userId)
    .select("id, account_status")
    .single();

  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id:    adminId || null,
      action:      `SET_USER_STATUS_${status}`,
      target_type: "user",
      target_id:   userId,
      before_val:  { account_status: prev?.account_status },
      after_val:   { account_status: status },
      reason,
    });
  }
  return { data, error };
};

export const adminAdjustSpaceTemp = async (userId, adminId, delta, reason) => {
  const { data: curr } = await supabase.from("users").select("space_temp").eq("id", userId).single();
  const prev = curr?.space_temp ?? 36.5;
  const next = Math.round(Math.min(99, Math.max(0, prev + delta)) * 10) / 10;

  const { data, error } = await supabase
    .from("users").update({ space_temp: next }).eq("id", userId).select("id, space_temp").single();

  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id:    adminId || null,
      action:      "TEMP_ADJUST",
      target_type: "user",
      target_id:   userId,
      before_val:  { space_temp: prev },
      after_val:   { space_temp: next },
      reason,
    });
  }
  return { data, error };
};

export const adminAdjustUserTokens = async (userId, adminId, delta, reason) => {
  const { data: curr } = await supabase.from("users").select("space_tokens").eq("id", userId).single();
  const prev = curr?.space_tokens ?? 0;
  const next = Math.max(0, prev + delta);

  const { data, error } = await supabase
    .from("users").update({ space_tokens: next }).eq("id", userId).select("id, space_tokens").single();

  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id:    adminId || null,
      action:      delta > 0 ? "TOKEN_GRANT" : "TOKEN_REVOKE",
      target_type: "user",
      target_id:   userId,
      before_val:  { space_tokens: prev },
      after_val:   { space_tokens: next },
      reason,
    });
  }
  return { data, error };
};

// ── Admin: Lounge management ──────────────────────────────────────────────────

export const adminGetLoungePosts = ({ hidden = null, limit = 100 } = {}) => {
  let q = supabase.from("lounge_posts").select("*").order("created_at", { ascending: false }).limit(limit);
  if (hidden !== null) q = q.eq("is_hidden", hidden);
  return q;
};

export const getLoungeReports = ({ status = null } = {}) => {
  let q = supabase
    .from("lounge_reports")
    .select("*, reporter:reporter_id(name, phone)")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  return q;
};

export const adminHideContent = async (table, id, adminId, hidden, reason = null) => {
  const { data, error } = await supabase
    .from(table)
    .update({ is_hidden: hidden, ...(hidden && reason ? { hidden_reason: reason } : {}) })
    .eq("id", id)
    .select("id, is_hidden")
    .single();

  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id:    adminId || null,
      action:      hidden ? `HIDE_${table.toUpperCase()}` : `UNHIDE_${table.toUpperCase()}`,
      target_type: "lounge",
      target_id:   id,
      before_val:  { is_hidden: !hidden },
      after_val:   { is_hidden: hidden },
      reason,
    });
  }
  return { data, error };
};

export const adminUpdateLoungeReport = (id, status, adminNote = null) =>
  supabase
    .from("lounge_reports")
    .update({ status, ...(adminNote ? { admin_note: adminNote } : {}) })
    .eq("id", id)
    .select("id, status")
    .single();

// ── STEP SYNC-1: Request Repost ───────────────────────────────────────────────

export const repostRequest = async (requestId) => {
  const { data: current, error: fetchError } = await supabase
    .from("requests")
    .select("exposure_count")
    .eq("id", requestId)
    .single();
  if (fetchError) return { error: fetchError };
  const nextCount = (current?.exposure_count ?? 0) + 1;
  return supabase
    .from("requests")
    .update({
      reposted_at:    new Date().toISOString(),
      expires_at:     new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      exposure_count: nextCount,
      status:         "open",
      updated_at:     new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();
};

export const createRequestRepost = (data) =>
  supabase.from("request_reposts").insert(data).select().single();

export const expireRequest = (id) =>
  supabase.from("requests").update({ status: "expired" }).eq("id", id);

export const archiveRequest = (id) =>
  supabase.from("requests")
    .update({ is_hidden: true, archived_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, is_hidden")
    .maybeSingle();

export const adminGetHiddenRequests = () =>
  supabase
    .from("requests")
    .select("id, space_type, area, size, style, description, status, created_at, archived_at, hidden_reason, user_id")
    .eq("is_hidden", true)
    .order("archived_at", { ascending: false, nullsFirst: false });

export const adminRestoreRequest = (id) =>
  supabase
    .from("requests")
    .update({ is_hidden: false, archived_at: null })
    .eq("id", id)
    .select("id, is_hidden")
    .maybeSingle();

// ── STEP SYNC-2: Lounge CRUD ──────────────────────────────────────────────────

export const getLoungePosts = async (category = "all") => {
  let q = supabase
    .from("lounge_posts")
    .select("*")
    .eq("is_story", false)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .or("is_hidden.is.null,is_hidden.eq.false")
    .or("is_visible.is.null,is_visible.eq.true")   // 014 비활성 카테고리 soft-hide 반영 (null=레거시 노출)
    .order("is_seed", { ascending: true });   // real 글 먼저

  if (category === "popular") {
    q = q.order("view_count", { ascending: false });
  } else if (category !== "all") {
    q = q.eq("category", category);
  }

  return q.order("created_at", { ascending: false });
};

export const getLoungePost = (postId) =>
  supabase.from("lounge_posts").select("*").eq("id", postId).single();

// 조회수 +1 — RPC(원자적) 우선, 미배포 시 read-modify-write 폴백.
export const incrementLoungeView = async (postId) => {
  if (!postId || String(postId).startsWith("seed_")) return;
  const { error } = await supabase.rpc("increment_lounge_view", { p_post_id: postId });
  if (!error) return;
  const { data } = await supabase.from("lounge_posts").select("view_count").eq("id", postId).single();
  await supabase
    .from("lounge_posts")
    .update({ view_count: (data?.view_count ?? 0) + 1 })
    .eq("id", postId);
};

// ── 추천글(🔥) + 운영자(operator) 관리 ───────────────────────────────────────
// 추천글: 운영자가 수동 등록(is_hot). 자동 알고리즘 없음. 최대 limit 개.
export const getHotLoungePosts = (limit = 5) =>
  supabase
    .from("lounge_posts")
    .select("*")
    .eq("is_hot", true)
    .eq("is_story", false)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .or("is_hidden.is.null,is_hidden.eq.false")
    .order("hot_priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

// 운영자 게시판 관리용 — 숨김 글 포함(삭제 제외) 최근 글.
export const getModeratorLoungePosts = (limit = 60) =>
  supabase
    .from("lounge_posts")
    .select("id, title, content, category, anonymous_nickname, image_urls, is_hot, hot_priority, is_hidden, is_seed, view_count, like_count, comment_count, created_at")
    .eq("is_story", false)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("created_at", { ascending: false })
    .limit(limit);

// 운영자 게시판 관리용 — 숨김 댓글 포함(삭제 제외).
export const getModeratorLoungeComments = (postId) =>
  supabase
    .from("lounge_comments")
    .select("id, post_id, anonymous_nickname, content, is_hidden, created_at")
    .eq("post_id", postId)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("created_at", { ascending: true });

// 운영자 목록(is_operator=true) — role 은 본래 유형(company/consumer) 유지
export const getOperators = () =>
  supabase.from("users").select("id, name, phone, role, is_operator, created_at").eq("is_operator", true).order("created_at", { ascending: false });

// 역할 변경 — 반드시 RPC 경유(직접 update 금지). admin 만 호출 성공.
export const rpcSetOperatorByPhone = (phone, adminId) =>
  supabase.rpc("set_user_operator_by_phone", { p_phone: phone, p_admin_id: adminId });

export const rpcUnsetOperator = (userId, adminId) =>
  supabase.rpc("unset_user_operator", { p_user_id: userId, p_admin_id: adminId });

// 라운지 운영(operator/admin) — soft 처리 + 서버 로그
export const rpcSetPostHot = (postId, hot, priority, actorId) =>
  supabase.rpc("op_set_post_hot", { p_post_id: postId, p_hot: hot, p_priority: priority ?? 0, p_actor_id: actorId });

export const rpcSetPostHidden = (postId, hidden, actorId) =>
  supabase.rpc("op_set_post_hidden", { p_post_id: postId, p_hidden: hidden, p_actor_id: actorId });

export const rpcSetCommentHidden = (commentId, hidden, actorId) =>
  supabase.rpc("op_set_comment_hidden", { p_comment_id: commentId, p_hidden: hidden, p_actor_id: actorId });

// ── 서버(service role) 관리자 API ─────────────────────────────────────────────
// service role key 는 프론트에 절대 노출하지 않고, /api/admin/* serverless 함수에서만 사용.
async function adminApiGet(path, adminId) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${path}${sep}adminId=${encodeURIComponent(adminId ?? "")}`;
  try {
    const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { data: null, error: { message: json?.error || `HTTP ${res.status}`, status: res.status } };
    return { data: json?.data ?? [], error: null };
  } catch (e) {
    return { data: null, error: { message: e?.message || "NETWORK_ERROR" } };
  }
}

// 고객 목록(role=consumer 등) — admin 만. RLS 우회는 서버 service role 이 담당.
export const fetchAdminCustomers = (adminId, role = "consumer") =>
  adminApiGet(`/api/admin/users?role=${encodeURIComponent(role)}`, adminId);

// 라운지 운영(seed) 글 전체(숨김/비활성 포함) — admin/operator.
export const fetchAdminSeedPosts = (adminId) =>
  adminApiGet("/api/admin/seed-posts", adminId);

// is_seed 운영글 노출(활성/비활성) — is_visible 토글 (anon update 정책 허용)
export const setSeedPostVisible = (postId, visible) =>
  supabase.from("lounge_posts")
    .update({ is_visible: visible, updated_at: new Date().toISOString() })
    .eq("id", postId).select("id, is_visible").single();

export const createLoungePost = (data) =>
  supabase.from("lounge_posts").insert(data).select().single();

export const updateLoungePost = (postId, userId, updates) =>
  supabase
    .from("lounge_posts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("user_id", userId)
    .select()
    .single();

export const softDeleteLoungePost = (postId, userId) =>
  supabase.rpc("soft_delete_lounge_post", {
    p_post_id: postId,
    p_user_id: userId,
  });

export const getLoungeStories = () =>
  supabase
    .from("lounge_posts")
    .select("*")
    .eq("is_story", true)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .or("is_hidden.is.null,is_hidden.eq.false")
    .or("is_visible.is.null,is_visible.eq.true")   // 014 soft-hide 반영
    .gt("story_expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

export const createLoungeStory = (data) =>
  supabase.from("lounge_posts").insert({ ...data, is_story: true }).select().single();

export const softDeleteLoungeStory = (storyId, userId) =>
  supabase
    .from("lounge_posts")
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", storyId)
    .eq("user_id", userId);

export const getLoungeComments = (postId) =>
  supabase
    .from("lounge_comments")
    .select("*")
    .eq("post_id", postId)
    .or("is_deleted.is.null,is_deleted.eq.false")
    .or("is_hidden.is.null,is_hidden.eq.false")
    .order("created_at", { ascending: true });

export const createLoungeComment = (data) =>
  supabase.from("lounge_comments").insert(data).select().single();

// 관련글 — SEO 내부링크용. 같은 카테고리 인기글 우선, 부족분은 최신글로 보강.
export const getRelatedLoungePosts = async (category, excludeId, limit = 4) => {
  const cols = "id, title, category, image_urls, view_count, like_count, comment_count, is_seed, is_expert, created_at";
  const base = () =>
    supabase
      .from("lounge_posts")
      .select(cols)
      .neq("id", excludeId)
      .eq("is_deleted", false)
      .eq("is_story", false)
      .or("is_hidden.is.null,is_hidden.eq.false");

  const sameCat = await base().eq("category", category).order("view_count", { ascending: false }).limit(limit);
  let rows = sameCat.data ?? [];
  if (rows.length < limit) {
    const seen = new Set(rows.map(r => r.id));
    const more = await base().order("view_count", { ascending: false }).limit(limit * 2);
    for (const r of more.data ?? []) {
      if (rows.length >= limit) break;
      if (!seen.has(r.id)) { rows.push(r); seen.add(r.id); }
    }
  }
  return { data: rows.slice(0, limit), error: sameCat.error ?? null };
};

export const softDeleteLoungeComment = (commentId, userId) =>
  supabase
    .from("lounge_comments")
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", commentId)
    .eq("user_id", userId);

export const likeLoungePost = async (postId) => {
  const { data: current } = await supabase
    .from("lounge_posts")
    .select("like_count")
    .eq("id", postId)
    .single();
  return supabase
    .from("lounge_posts")
    .update({ like_count: (current?.like_count ?? 0) + 1 })
    .eq("id", postId)
    .select("like_count")
    .single();
};

// ── STEP SYNC-3: Space Tokens ─────────────────────────────────────────────────

export const getSpaceToken = (userId) =>
  supabase.from("space_tokens").select("balance").eq("user_id", userId).maybeSingle();

export const upsertSpaceToken = (userId, balance) =>
  supabase
    .from("space_tokens")
    .upsert({ user_id: userId, balance }, { onConflict: "user_id" })
    .select("balance")
    .single();

export const createSpaceTokenLog = ({ userId, type, action, amount, description }) =>
  supabase.from("space_token_logs").insert({
    user_id:     userId,
    type,
    action,
    amount,
    description: description ?? null,
  });

export const getSpaceTokenLogs = (userId, limit = 50) =>
  supabase
    .from("space_token_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

export const getUserMissionStats = async (userId) => {
  if (!userId) return null;
  const [postsRes, commentsRes, storiesRes, likesRes, requestsRes] = await Promise.all([
    supabase.from("lounge_posts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_story", false).eq("is_deleted", false),
    supabase.from("lounge_comments").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_deleted", false),
    supabase.from("lounge_posts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_story", true).eq("is_deleted", false),
    supabase.from("lounge_posts").select("like_count").eq("user_id", userId).eq("is_deleted", false),
    supabase.from("requests").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  const likesReceived = (likesRes.data ?? []).reduce((sum, r) => sum + (r.like_count ?? 0), 0);
  return {
    posts:          postsRes.count      ?? 0,
    comments:       commentsRes.count   ?? 0,
    stories:        storiesRes.count    ?? 0,
    likes_received: likesReceived,
    requests:       requestsRes.count   ?? 0,
  };
};

// ── STEP SYNC-4: Lounge Likes ─────────────────────────────────────────────────

export const checkLoungePostLiked = (postId, userId) =>
  supabase
    .from("lounge_post_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

export const addLoungePostLike = (postId, userId) =>
  supabase
    .from("lounge_post_likes")
    .upsert({ post_id: postId, user_id: userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true });

export const removeLoungePostLike = (postId, userId) =>
  supabase
    .from("lounge_post_likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);

export const unlikeLoungePost = async (postId) => {
  const { data: current } = await supabase
    .from("lounge_posts")
    .select("like_count")
    .eq("id", postId)
    .single();
  return supabase
    .from("lounge_posts")
    .update({ like_count: Math.max(0, (current?.like_count ?? 1) - 1) })
    .eq("id", postId)
    .select("like_count")
    .single();
};

// ── STEP SYNC-4: Lounge Saves ─────────────────────────────────────────────────

export const checkLoungeSaved = (postId, userId) =>
  supabase
    .from("lounge_saves")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

export const addLoungeSave = (postId, userId) =>
  supabase
    .from("lounge_saves")
    .upsert({ post_id: postId, user_id: userId }, { onConflict: "post_id,user_id", ignoreDuplicates: true });

export const removeLoungeSave = (postId, userId) =>
  supabase
    .from("lounge_saves")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);

export const getMyLoungePosts = (userId) =>
  supabase
    .from("lounge_posts")
    .select("*")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

export const adminHideLoungePost = (postId, adminId, reason = "") =>
  supabase
    .from("lounge_posts")
    .update({ is_hidden: true, hidden_by: adminId, hidden_reason: reason, updated_at: new Date().toISOString() })
    .eq("id", postId);

export const adminUnhideLoungePost = (postId) =>
  supabase
    .from("lounge_posts")
    .update({ is_hidden: false, hidden_by: null, hidden_reason: null, updated_at: new Date().toISOString() })
    .eq("id", postId);

// ── Notifications ─────────────────────────────────────────────────────────────

export const getNotifications = (userId) =>
  supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

export const markAllNotifsRead = (userId) =>
  supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

export const markNotifRead = (notifId) =>
  supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notifId);

export const createLoungeNotification = ({ userId, type, title, message, relatedId = null, relatedType = null }) =>
  supabase.from("notifications").insert({
    user_id:      userId,
    type,
    title,
    message,
    related_id:   relatedId,
    related_type: relatedType,
    is_read:      false,
  });

// ── Push Notifications (FCM tokens / preferences / queue) ────────────────────

// 기기 토큰 등록(동일 토큰 upsert, 동일 유저 여러 기기 허용)
export const upsertFcmToken = ({ userId, token, platform = "web", deviceInfo = null }) =>
  supabase
    .from("fcm_tokens")
    .upsert(
      { user_id: userId, token, platform, device_info: deviceInfo, is_active: true, updated_at: new Date().toISOString(), last_used_at: new Date().toISOString() },
      { onConflict: "token" }
    )
    .select("id")
    .maybeSingle();

export const deactivateFcmToken = (token) =>
  supabase.from("fcm_tokens").update({ is_active: false, updated_at: new Date().toISOString() }).eq("token", token);

// 수신 설정 조회/저장 (유저당 1행, 기본 전체 OFF)
export const getPushPreferences = (userId) =>
  supabase.from("push_preferences").select("*").eq("user_id", userId).maybeSingle();

export const upsertPushPreferences = (userId, prefs) =>
  supabase
    .from("push_preferences")
    .upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("*")
    .maybeSingle();

// 라운지 글 등록 시 적격 수신자 큐잉 (SECURITY DEFINER RPC)
export const enqueueLoungePostPush = (postId) =>
  supabase.rpc("enqueue_lounge_post_push", { p_post_id: postId });

// ── STEP SYNC-4: Lounge Chat Requests ────────────────────────────────────────

export const createLoungeChat = (data) =>
  supabase
    .from("lounge_chats")
    .upsert(data, { onConflict: "post_id,requester_id", ignoreDuplicates: true })
    .select()
    .single();

export const acceptLoungeChat = (chatId, participantId) =>
  supabase
    .from("lounge_chats")
    .update({ status: "accepted", token_charged: true })
    .eq("id", chatId)
    .or(`requester_id.eq.${participantId},post_user_id.eq.${participantId}`)
    .select()
    .single();

// ── 댓글 작성자 대화 신청 (lounge_chat_requests, migration 027) ───────────────

// 요청 생성: 중복/자기자신/시드 검사 포함 RPC (idempotent)
export const requestCommentChat = (requesterId, targetId, postId, commentId) =>
  supabase.rpc("request_comment_chat", {
    p_requester_id: requesterId,
    p_target_id:    targetId,
    p_post_id:      postId,
    p_comment_id:   commentId,
  });

// 수락: 요청자 20토큰 차감 + status=accepted (idempotent, security definer)
export const acceptLoungeChatRequest = (requestId, acceptorId) =>
  supabase.rpc("accept_lounge_chat", {
    p_request_id:  requestId,
    p_acceptor_id: acceptorId,
  });

// 내가 보낸 대화 신청 목록
export const fetchMyChatRequests = (userId, limit = 50) =>
  supabase
    .from("lounge_chat_requests")
    .select("id, post_id, target_id, status, token_charged, created_at, accepted_at, source_comment_id, lounge_posts(title, anonymous_nickname)")
    .eq("requester_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

// 내가 받은 대화 신청 목록 (pending)
export const fetchReceivedChatRequests = (userId, limit = 50) =>
  supabase
    .from("lounge_chat_requests")
    .select("id, post_id, requester_id, status, token_charged, created_at, source_comment_id, lounge_posts(title, anonymous_nickname), lounge_comments(anonymous_nickname, content)")
    .eq("target_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);

// ── Payment / Contract restore helpers ───────────────────────────────────────

// Primary: PAID orders only (used for payment confirmation flow)
export const getPaymentOrderByRequest = (requestId) =>
  supabase.from("payment_orders")
    .select("*")
    .eq("request_id", requestId)
    .eq("status", "PAID")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

// Fallback: any status — catches DEPOSITED / PENDING orders that also carry contract_id
export const getPaymentOrderByRequestAny = (requestId) =>
  supabase.from("payment_orders")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

export const getBidById = (bidId) =>
  supabase.from("bids").select("*").eq("id", bidId).single();

export const getEscrowByRequest = (requestId) =>
  supabase.from("escrow_payments")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

// Two-dimension lookup: request_id + company_id (works when RLS allows by company)
export const getEscrowByCompanyAndRequest = (requestId, companyId) =>
  supabase.from("escrow_payments")
    .select("*")
    .eq("request_id", requestId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

// Recover contract_id from phase_photos when escrow_payments RLS blocks customer
// (phase_photos.uploaded_by = company userId; contract_id = escrow_payments.id)
// afterDate: only photos uploaded AFTER this ISO string — prevents matching old completed jobs
export const getPhasePhotosByUploader = (uploadedBy, afterDate = null) => {
  let q = supabase.from("phase_photos")
    .select("contract_id, step, photos, created_at")
    .eq("uploaded_by", uploadedBy)
    .order("created_at", { ascending: false })
    .limit(5);
  if (afterDate) q = q.gte("created_at", afterDate);
  return q;
};

// Recover escrow_id from escrow_payouts by company_id (alternative path if above fails)
export const getEscrowPayoutsByCompanyId = (companyId) =>
  supabase.from("escrow_payouts")
    .select("escrow_id, stage, status, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(4);

// ── Company: my submitted bids with request data ──────────────────────────────
export const getCompanyBids = (userId) =>
  supabase
    .from("bids")
    .select("*, requests(*)")
    .eq("company_id", userId)
    .order("created_at", { ascending: false });

// ── EscrowScreen: advance escrow step on customer approval ───────────────────
// Updates step{N}_approved_at, current_step, and optionally transaction_status
export const advanceContractStep = (contractId, step, nextStep, txStatus = null) => {
  const update = {
    [`step${step}_approved_at`]: new Date().toISOString(),
    current_step: nextStep,
  };
  if (txStatus) update.transaction_status = txStatus;
  return supabase.from("escrow_payments")
    .update(update)
    .eq("id", contractId)
    .select("id, current_step, transaction_status")
    .single();
};

// ── EscrowScreen: company reports phase (착공/중간점검/완료) ───────────────────
// Updates transaction_status, current_step, photos_uploaded_at together
export const markEscrowPhaseStarted = (contractId, txStatus, currentStep) =>
  supabase.from("escrow_payments")
    .update({
      transaction_status:  txStatus,
      current_step:        currentStep,
      photos_uploaded_at:  new Date().toISOString(),
    })
    .eq("id", contractId)
    .select("id, transaction_status, current_step")
    .single();

// ── EscrowScreen: set escrow_payouts stage to READY (customer approval pending) ─
export const setEscrowPayoutReady = (escrowId, stage) =>
  supabase.from("escrow_payouts")
    .update({ status: "READY" })
    .eq("escrow_id", escrowId)
    .eq("stage", stage)
    .select("id, status")
    .single();

// ── Consumer: escrow + payouts for a request (for home card stage computation) ─
export const getEscrowWithPayouts = async (requestId) => {
  const { data: escrow, error } = await supabase
    .from("escrow_payments")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !escrow) return { data: null, error: error ?? null };
  const { data: payouts } = await supabase
    .from("escrow_payouts")
    .select("*")
    .eq("escrow_id", escrow.id)
    .order("stage");
  return { data: { escrow, payouts: payouts ?? [] }, error: null };
};

// ── Lounge Seed Posts (관리자 관리 초기 콘텐츠) ─────────────────────────────

export const getLoungeSeeds = (category = 'all') => {
  let q = supabase
    .from('lounge_seed_posts')
    .select('*')
    .eq('is_active', true)
    .eq('show_on_lounge', true)
    .order('sort_order', { ascending: true });
  if (category !== 'all' && category !== 'popular') {
    q = q.eq('category', category);
  }
  return q;
};

export const adminGetLoungeSeeds = () =>
  supabase
    .from('lounge_seed_posts')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

export const createLoungeSeed = (data) =>
  supabase.from('lounge_seed_posts').insert(data).select().single();

export const updateLoungeSeed = (id, data) =>
  supabase
    .from('lounge_seed_posts')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

export const deleteLoungeSeed = (id) =>
  supabase
    .from('lounge_seed_posts')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

export const uploadLoungeSeedImage = async (file) => {
  const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const name = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `lounge/admin-seeds/${name}`;
  const { error } = await supabase.storage
    .from('lounge-images')
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) return { data: null, error };
  const { data } = supabase.storage.from('lounge-images').getPublicUrl(path);
  return { data, error: null };
};

// ── Seed Lounge Posts (새 테이블: seed_lounge_posts) ──────────────────────────

export const getSeedLoungePosts = (category = 'all') => {
  let q = supabase.from('seed_lounge_posts').select('*')
    .eq('is_active', true).order('sort_order', { ascending: true });
  if (category !== 'all' && category !== 'popular') q = q.eq('category', category);
  return q;
};

export const adminGetSeedLoungePosts = () =>
  supabase.from('seed_lounge_posts').select('*')
    .order('sort_order', { ascending: true }).order('created_at', { ascending: false });

export const createSeedLoungePost = (data) =>
  supabase.from('seed_lounge_posts').insert(data).select().single();

export const updateSeedLoungePost = (id, data) =>
  supabase.from('seed_lounge_posts').update(data).eq('id', id).select().single();

export const deleteSeedLoungePost = (id) =>
  supabase.from('seed_lounge_posts').delete().eq('id', id);

export const uploadSeedLoungeImage = async (file) => {
  const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const name = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('seed-lounge-images')
    .upload(name, file, { upsert: false, contentType: file.type });
  if (error) return { data: null, error };
  const { data } = supabase.storage.from('seed-lounge-images').getPublicUrl(name);
  return { data, error: null };
};

// ── Identity Verification (mock — no real KYC; TODO: replace with service-role Edge Function) ──

export const requestMockIdentityVerification = async (userId) => {
  const now = new Date().toISOString();
  return supabase
    .from("users")
    .update({
      is_identity_verified: true,
      identity_verified_at: now,
      identity_provider: "mock",
      identity_verification_status: "verified",
    })
    .eq("id", userId)
    .select("id, is_identity_verified, identity_verified_at, identity_provider, identity_verification_status")
    .single();
};

export const adminVerifyUserIdentity = async (userId, adminId, status = "verified") => {
  const now = new Date().toISOString();
  const isVerified = status === "verified";
  const { data, error } = await supabase
    .from("users")
    .update({
      is_identity_verified: isVerified,
      identity_verified_at: isVerified ? now : null,
      identity_provider: isVerified ? "admin_manual" : null,
      identity_verification_status: status,
    })
    .eq("id", userId)
    .select("id, is_identity_verified, identity_verified_at, identity_provider, identity_verification_status")
    .single();
  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id: adminId || null,
      action: isVerified ? "VERIFY_IDENTITY" : "REVOKE_IDENTITY",
      target_type: "user",
      target_id: userId,
      after_val: { identity_verification_status: status, is_identity_verified: isVerified },
      reason: `Admin ${isVerified ? "수동 인증" : "인증 취소"}`,
    });
  }
  return { data, error };
};

// ── STEP 28: 직거래 감지 / 추적 ────────────────────────────────────────────────
//   채팅 키워드 자동 감지 + 실측 후 미계약 추적 → direct_deal_reports 기록.
//   기록은 증거 보존 목적이므로 원문 마스킹하지 않음.

// 관리자 전원에게 알림 발송 (notifications 는 user 단위라 admin 들에게 fan-out)
async function notifyAdmins({ type, title, message, relatedId = null, relatedType = null, priority = "HIGH" }) {
  const { data: admins } = await supabase.from("users").select("id").eq("role", "admin");
  if (!admins || admins.length === 0) return;
  await Promise.all(
    admins.map((a) =>
      createNotification({ userId: a.id, type, title, message, relatedId, relatedType, priority })
    )
  );
}

// 해당 request+company 에 계약(escrow_payments)이 존재하는지
export async function checkContractExists(requestId, companyId) {
  let q = supabase.from("escrow_payments").select("id", { count: "exact", head: true });
  if (requestId) q = q.eq("request_id", requestId);
  if (companyId) q = q.eq("company_id", companyId);
  const { count } = await q;
  return (count ?? 0) > 0;
}

// 채팅 메시지 직거래 키워드 감지 → 감지 시 기록 + 관리자 알림. 감지된 키워드 배열 반환.
export async function checkDirectDealKeyword(messageText, { requestId = null, companyId = null, customerId = null, senderId = null, senderRole = null, chatMessageId = null } = {}) {
  const detected = detectDirectDealKeywords(messageText);
  if (detected.length === 0) return [];

  await supabase.from("direct_deal_reports").insert({
    request_id:  requestId,
    company_id:  companyId,
    customer_id: customerId,
    trigger_type: "keyword_detected",
    trigger_detail: {
      keywords: detected,
      message: messageText,
      sender_id: senderId,
      sender_role: senderRole,
      chat_message_id: chatMessageId,
    },
  });

  await notifyAdmins({
    type: "DIRECT_DEAL_DETECTED",
    title: "직거래 의심 키워드 감지",
    message: `직거래 의심 키워드 감지: ${detected.join(", ")}`,
    relatedId: requestId,
    relatedType: "request",
    priority: "HIGH",
  });

  return detected;
}

// 직거래 의심 목록 조회 (관리자)
export const getDirectDealReports = ({ status = null, triggerType = null, limit = 100 } = {}) => {
  let q = supabase.from("direct_deal_reports").select("*").order("detected_at", { ascending: false }).limit(limit);
  if (status)      q = q.eq("status", status);
  if (triggerType) q = q.eq("trigger_type", triggerType);
  return q;
};

// 직거래 의심 상태 변경 (pending → investigating → confirmed/dismissed)
export const updateDirectDealReportStatus = (id, status, adminNote = null) => {
  const patch = { status };
  if (adminNote != null) patch.admin_note = adminNote;
  if (status === "confirmed" || status === "dismissed") patch.resolved_at = new Date().toISOString();
  return supabase.from("direct_deal_reports").update(patch).eq("id", id).select().single();
};

// [정책] 현장견적 카운트다운: 72h (constants/policy.js · 2026.06)
// 실측 후 미계약 자동 추적 — 관리자 수동 실행 또는 cron 으로 호출.
//   48h(경고) 경과 + 견적서 미제출  → 업체에 기한 임박 알림
//   72h(취소) 경과 + 견적서 미제출  → 매칭 취소 + 업체 공간온도 -3 + 의심 플래그
//   7d  경과 + 견적서 제출 + 계약 없음 → 양측 문의 + 의심 플래그
export async function checkSiteVisitFollowUp() {
  const now = Date.now();
  const h48 = new Date(now - SITE_VISIT_WARN_MS).toISOString();
  const h72 = new Date(now - SITE_VISIT_ESTIMATE_MS).toISOString();
  const d7  = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const summary = { reminded: 0, cancelled: 0, flagged: 0, inquired: 0 };

  // 이미 플래그된 site_visit 은 중복 처리하지 않기 위해 기존 기록 수집
  const { data: existing } = await supabase
    .from("direct_deal_reports")
    .select("trigger_type, trigger_detail")
    .in("trigger_type", ["no_estimate_72h", "no_contract_7d"]);
  const flaggedKey = new Set(
    (existing ?? []).map((r) => `${r.trigger_type}:${r.trigger_detail?.site_visit_id ?? ""}`)
  );

  // 회사 owner_id 캐시 (알림 발송용)
  const ownerCache = {};
  const ownerOf = async (companyId) => {
    if (!companyId) return null;
    if (ownerCache[companyId] !== undefined) return ownerCache[companyId];
    const { data } = await supabase.from("companies").select("owner_id, name").eq("id", companyId).maybeSingle();
    ownerCache[companyId] = data ?? null;
    return ownerCache[companyId];
  };

  // ── 48h 경과 + 견적서 미제출 → 기한 임박 알림 (still 'completed' = 미제출) ──
  const { data: due48 } = await supabase
    .from("site_visits").select("*")
    .eq("status", "completed")
    .lt("completed_at", h48).gte("completed_at", h72);
  for (const v of due48 ?? []) {
    const owner = await ownerOf(v.company_id);
    if (owner?.owner_id) {
      await createNotification({
        userId: owner.owner_id,
        type: "ESTIMATE_DUE_SOON",
        title: "견적서 제출 기한 임박",
        message: "실측 후 견적서 제출 기한이 임박했습니다. 기한 내 미제출 시 매칭이 자동 취소됩니다.",
        relatedId: v.request_id ?? null,
        relatedType: "request",
        priority: "HIGH",
      });
      summary.reminded += 1;
    }
  }

  // ── 72h 경과 + 견적서 미제출 → 매칭 취소 + 온도 -3 + 플래그 ──
  const { data: overdue } = await supabase
    .from("site_visits").select("*")
    .eq("status", "completed")
    .lt("completed_at", h72);
  for (const v of overdue ?? []) {
    const key = `no_estimate_72h:${v.id}`;
    if (flaggedKey.has(key)) continue;
    await supabase.from("direct_deal_reports").insert({
      request_id: v.request_id ?? null,
      company_id: v.company_id ?? null,
      trigger_type: "no_estimate_72h",
      trigger_detail: { site_visit_id: v.id, completed_at: v.completed_at },
    });
    await supabase.from("site_visits").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", v.id);
    if (v.company_id) await updateCompanyTemp(v.company_id, -3);
    await notifyAdmins({
      type: "DIRECT_DEAL_DETECTED",
      title: "실측 후 견적 미제출 (72h)",
      message: "실측 완료 후 72시간 내 견적서 미제출 — 매칭 자동 취소 및 업체 공간온도 -3 적용.",
      relatedId: v.request_id ?? null,
      relatedType: "request",
    });
    flaggedKey.add(key);
    summary.cancelled += 1;
    summary.flagged += 1;
  }

  // ── 7d 경과 + 견적서 제출 + 계약 없음 → 양측 문의 + 플래그 ──
  const { data: submitted } = await supabase
    .from("site_visits").select("*")
    .eq("status", "estimate_submitted")
    .lt("completed_at", d7);
  for (const v of submitted ?? []) {
    const key = `no_contract_7d:${v.id}`;
    if (flaggedKey.has(key)) continue;
    const hasContract = await checkContractExists(v.request_id, v.company_id);
    if (hasContract) continue;

    await supabase.from("direct_deal_reports").insert({
      request_id: v.request_id ?? null,
      company_id: v.company_id ?? null,
      trigger_type: "no_contract_7d",
      trigger_detail: { site_visit_id: v.id, completed_at: v.completed_at },
    });

    // 고객 문의
    const { data: req } = await supabase.from("requests").select("user_id").eq("id", v.request_id).maybeSingle();
    if (req?.user_id) {
      await createNotification({
        userId: req.user_id,
        type: "CONTRACT_FOLLOWUP",
        title: "계약은 어떻게 진행되고 있나요?",
        message: "실측·견적 이후 계약 진행 상태를 알려주세요. 공간마켓 안전결제로 진행하시면 보호받을 수 있습니다.",
        relatedId: v.request_id ?? null,
        relatedType: "request",
        priority: "NORMAL",
      });
      summary.inquired += 1;
    }
    // 업체 문의
    const owner = await ownerOf(v.company_id);
    if (owner?.owner_id) {
      await createNotification({
        userId: owner.owner_id,
        type: "CONTRACT_FOLLOWUP",
        title: "계약은 어떻게 진행되고 있나요?",
        message: "견적 제출 이후 계약 진행 상태를 알려주세요. 안전결제 외 직거래는 약관 위반입니다.",
        relatedId: v.request_id ?? null,
        relatedType: "request",
        priority: "NORMAL",
      });
      summary.inquired += 1;
    }

    await notifyAdmins({
      type: "DIRECT_DEAL_DETECTED",
      title: "견적 제출 후 7일 미계약",
      message: "견적서 제출 후 7일간 계약 미체결 — 직거래 의심 플래그.",
      relatedId: v.request_id ?? null,
      relatedType: "request",
    });
    flaggedKey.add(key);
    summary.flagged += 1;
  }

  return summary;
}

// ── 직거래 수동 신고 (트리거 5: manual_report) ────────────────────────────────
// 채팅 화면 신고 버튼 → 사유 선택 후 insert. 중복 신고는 허용(증거 누적).
export async function reportDirectDeal({ requestId = null, companyId = null, customerId = null, reporterId = null, reportReason = null } = {}) {
  const { error } = await supabase.from("direct_deal_reports").insert({
    request_id:  requestId,
    company_id:  companyId,
    customer_id: customerId,
    trigger_type: "manual_report",
    trigger_detail: {
      reporter_id: reporterId,
      report_reason: reportReason,
    },
  });
  if (!error) {
    await notifyAdmins({
      type: "DIRECT_DEAL_DETECTED",
      title: "직거래 수동 신고 접수",
      message: `사용자 신고: ${reportReason ?? "사유 미기재"}`,
      relatedId: requestId,
      relatedType: "request",
      priority: "HIGH",
    });
  }
  return { error };
}

// ── 직거래 스케줄 트리거 (2: no_estimate_72h · 3: no_contract_7d · 4: chat_blackout) ──
// 메시지/입찰/계약 기준의 보조 추적. 관리자 수동 실행 또는 cron 으로 주기 호출.
// 모든 insert 는 (trigger_type+request_id+company_id+customer_id) 로 중복 방지.
export async function checkDirectDealSchedules() {
  const now = Date.now();
  const H72 = 72 * 60 * 60 * 1000;
  const D7  = 7  * 24 * 60 * 60 * 1000;
  const D5  = 5  * 24 * 60 * 60 * 1000;
  const summary = { no_estimate_72h: 0, no_contract_7d: 0, chat_blackout: 0 };
  const isUuid = (s) => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);

  // 기존 플래그 — 중복 방지
  const { data: existing } = await supabase
    .from("direct_deal_reports")
    .select("trigger_type, request_id, company_id, customer_id")
    .in("trigger_type", ["no_estimate_72h", "no_contract_7d", "chat_blackout"]);
  const seen = new Set(
    (existing ?? []).map((r) => `${r.trigger_type}:${r.request_id ?? ""}:${r.company_id ?? ""}:${r.customer_id ?? ""}`)
  );
  const flag = async (trigger_type, { requestId = null, companyId = null, customerId = null, detail = {} }) => {
    const key = `${trigger_type}:${requestId ?? ""}:${companyId ?? ""}:${customerId ?? ""}`;
    if (seen.has(key)) return false;
    const { error } = await supabase.from("direct_deal_reports").insert({
      request_id: requestId, company_id: companyId, customer_id: customerId,
      trigger_type, trigger_detail: detail,
    });
    if (error) return false;
    seen.add(key);
    return true;
  };

  // 데이터 수집 (소규모 운영 기준 일괄 조회)
  const [{ data: chats }, { data: requests }, { data: bids }, { data: escrows }] = await Promise.all([
    supabase.from("chats").select("room_id, created_at").order("created_at", { ascending: true }),
    supabase.from("requests").select("id, user_id, created_at"),
    supabase.from("bids").select("request_id, company_id, created_at"),
    supabase.from("escrow_payments").select("request_id, company_id, transaction_status, updated_at"),
  ]);

  // 채팅방 집계 — room_id = `${customerId}_${companyId}` (uuid 는 '_' 없음)
  const rooms = {};
  for (const c of chats ?? []) {
    const idx = c.room_id.indexOf("_");
    if (idx < 0) continue;
    const customerId = c.room_id.slice(0, idx);
    const companyId  = c.room_id.slice(idx + 1);
    if (!isUuid(customerId) || !isUuid(companyId)) continue; // guest 등 제외
    const r = rooms[c.room_id] ?? (rooms[c.room_id] = { customerId, companyId, first: c.created_at, last: c.created_at });
    r.last = c.created_at;
  }

  // 인덱스
  const reqsByUser = {};
  for (const rq of requests ?? []) (reqsByUser[rq.user_id] ??= []).push(rq);
  const bidSet = new Set((bids ?? []).map((b) => `${b.request_id}:${b.company_id}`));
  const bidByReqCompany = {};
  for (const b of bids ?? []) bidByReqCompany[`${b.request_id}:${b.company_id}`] = b;
  const escrowSet = new Set((escrows ?? []).map((e) => `${e.request_id}:${e.company_id}`));

  // 트리거 2: no_estimate_72h — 대화 있음 + 해당 업체 입찰 없음 + 첫 대화 72h 경과
  for (const room of Object.values(rooms)) {
    if (now - new Date(room.first).getTime() < H72) continue;
    const custReqs = reqsByUser[room.customerId] ?? [];
    const hasBid = custReqs.some((rq) => bidSet.has(`${rq.id}:${room.companyId}`));
    if (hasBid) continue;
    const relReq = custReqs[0]?.id ?? null;
    if (await flag("no_estimate_72h", { requestId: relReq, companyId: room.companyId, customerId: room.customerId, detail: { first_message_at: room.first } }))
      summary.no_estimate_72h += 1;
  }

  // 트리거 3: no_contract_7d — 입찰 있음 + 계약(escrow) 없음 + 입찰 7d 경과
  for (const [key, bid] of Object.entries(bidByReqCompany)) {
    if (now - new Date(bid.created_at).getTime() < D7) continue;
    if (escrowSet.has(key)) continue;
    const [requestId, companyId] = key.split(":");
    const req = (requests ?? []).find((r) => r.id === requestId);
    if (await flag("no_contract_7d", { requestId, companyId, customerId: req?.user_id ?? null, detail: { bid_created_at: bid.created_at } }))
      summary.no_contract_7d += 1;
  }

  // 트리거 4: chat_blackout — 계약 진행 중 + 마지막 채팅 5d 경과 + 에스크로 미완료
  const IN_PROGRESS = new Set(["CONTRACTED", "STARTED", "MID_INSPECTION"]);
  for (const e of escrows ?? []) {
    if (!IN_PROGRESS.has(e.transaction_status)) continue;
    const req = (requests ?? []).find((r) => r.id === e.request_id);
    const customerId = req?.user_id ?? null;
    if (!customerId) continue;
    const room = rooms[`${customerId}_${e.company_id}`];
    if (!room) continue;
    if (now - new Date(room.last).getTime() < D5) continue;
    if (await flag("chat_blackout", { requestId: e.request_id, companyId: e.company_id, customerId, detail: { last_chat_at: room.last, transaction_status: e.transaction_status } })) {
      await notifyAdmins({
        type: "DIRECT_DEAL_DETECTED",
        title: "계약 진행 중 연락 두절 (5일+)",
        message: "계약 진행 중 5일 이상 채팅이 없습니다 — 직거래 의심 플래그.",
        relatedId: e.request_id,
        relatedType: "request",
      });
      summary.chat_blackout += 1;
    }
  }

  return summary;
}
