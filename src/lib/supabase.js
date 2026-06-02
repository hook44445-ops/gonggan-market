import { createClient } from "@supabase/supabase-js";
import { detectDirectDealKeywords } from "../constants/directDeal";

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
  // eslint-disable-next-line no-console
  console.log("[RegionSave]", { table: "users", field: "activity_regions", payload: full, error: res.error?.code ?? null, message: res.error?.message ?? null });
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
    // eslint-disable-next-line no-console
    console.log("[RegionRefetch]", { table, error: error?.message ?? null, row: data ?? null });
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
  // eslint-disable-next-line no-console
  console.log("[RegionSave]", { table: "companies", field: "service_regions", payload: full, error: res.error?.code ?? null, message: res.error?.message ?? null });
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

export const getRequests = () =>
  supabase
    .from("requests")
    .select("*")
    .eq("status", "open")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .or("is_hidden.is.null,is_hidden.eq.false")
    .order("created_at", { ascending: false });

export const getRequest = (id) =>
  supabase.from("requests").select("*").eq("id", id).maybeSingle();

export const getUserRequests = (userId) =>
  supabase
    .from("requests")
    .select("*, bids(id, company_id, price, status)")
    .eq("user_id", userId)
    .or("is_hidden.is.null,is_hidden.eq.false")
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("created_at", { ascending: false });

export const getLiveRequests = ({ limit = 5 } = {}) =>
  supabase
    .from("requests")
    .select("id, space_type, area, size, status, created_at, last_activity_at")
    .in("status", ["in_progress", "contracting", "escrow_pending"])
    .or("is_hidden.is.null,is_hidden.eq.false")
    .or("is_deleted.is.null,is_deleted.eq.false")
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

export const getActiveRequestByUser = (userId) =>
  supabase
    .from("requests")
    .select("id, status, space_type, created_at, last_activity_at")
    .eq("user_id", userId)
    .in("status", ["open", "in_progress", "contracting", "escrow_pending"])
    .or("is_hidden.is.null,is_hidden.eq.false")
    .or("is_deleted.is.null,is_deleted.eq.false")
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

export const selectBid = (bidId) =>
  supabase.from("bids").update({ selected: true }).eq("id", bidId);

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
  });

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

export const createReview = (data) =>
  supabase.from("reviews").insert(data).select().single();

export const replyToReview = (reviewId, reply) =>
  supabase.from("reviews").update({ reply }).eq("id", reviewId);

export const getReviewByContract = (contractId) =>
  supabase
    .from("reviews")
    .select("id, rating, created_at")
    .eq("contract_id", contractId)
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

export const adminUpdateReview = async (id, updates, adminId) => {
  const { data, error } = await supabase
    .from("reviews")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, rating, status, is_hidden, content")
    .single();
  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id: adminId || null, action: "UPDATE_REVIEW",
      target_type: "review", target_id: id, after_val: updates,
    });
  }
  return { data, error };
};

export const adminHideReview = async (id, adminId, hidden, reason = null) => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("reviews")
    .update({
      is_hidden: hidden,
      ...(hidden ? { hidden_at: now, hidden_reason: reason } : { hidden_at: null, hidden_reason: null }),
    })
    .eq("id", id)
    .select("id, is_hidden")
    .single();
  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id: adminId || null,
      action: hidden ? "HIDE_REVIEW" : "UNHIDE_REVIEW",
      target_type: "review", target_id: id,
      before_val: { is_hidden: !hidden }, after_val: { is_hidden: hidden },
      reason,
    });
  }
  return { data, error };
};

export const adminSoftDeleteReview = async (id, adminId, reason) => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("reviews")
    .update({ is_deleted: true, deleted_at: now, deleted_by: adminId || null })
    .eq("id", id)
    .select("id")
    .single();
  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id: adminId || null, action: "DELETE_REVIEW",
      target_type: "review", target_id: id, reason,
    });
  }
  return { data, error };
};

export const adminRestoreReview = async (id, adminId) => {
  const { data, error } = await supabase
    .from("reviews")
    .update({ is_deleted: false, deleted_at: null, deleted_by: null, is_hidden: false, hidden_at: null })
    .eq("id", id)
    .select("id")
    .single();
  if (!error) {
    await supabase.from("admin_logs").insert({
      admin_id: adminId || null, action: "RESTORE_REVIEW",
      target_type: "review", target_id: id,
    });
  }
  return { data, error };
};

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

export const createChangeOrder = ({ contractId, requestedBy, requestedByRole, description, amount }) =>
  supabase.from("change_orders").insert({
    contract_id:       contractId,
    requested_by:      requestedBy,
    requested_by_role: requestedByRole,
    description,
    amount,
  }).select().single();

export const getChangeOrders = (contractId) =>
  supabase
    .from("change_orders")
    .select("*")
    .eq("contract_id", contractId)
    .order("created_at", { ascending: false });

export const approveChangeOrder = (changeOrderId) =>
  supabase
    .from("change_orders")
    .update({ status: "APPROVED", approved_by_customer: true, approved_at: new Date().toISOString() })
    .eq("id", changeOrderId)
    .select()
    .single();

export const rejectChangeOrder = (changeOrderId, rejectReason) =>
  supabase
    .from("change_orders")
    .update({ status: "REJECTED", reject_reason: rejectReason })
    .eq("id", changeOrderId)
    .select()
    .single();

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

export const createSiteVisit = (data) =>
  supabase.from("site_visits").insert({ ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select().single();

export const getSiteVisitForBid = (bidId) =>
  supabase.from("site_visits").select("*").eq("bid_id", bidId).order("created_at", { ascending: false }).limit(1).maybeSingle();

export const getSiteVisitsByCompany = (companyId) =>
  supabase.from("site_visits").select("*").eq("company_id", companyId).order("created_at", { ascending: false });

export const updateSiteVisit = (id, data) =>
  supabase.from("site_visits").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id).select().single();

export const gpsCheckin = (id, { lat, lng, photos }) =>
  supabase.from("site_visits").update({
    checked_in_at: new Date().toISOString(),
    gps_lat: lat, gps_lng: lng,
    photos: photos ?? [],
    status: "checked_in",
    updated_at: new Date().toISOString(),
  }).eq("id", id).select().single();

export const completeSiteVisit = (id, { fieldAmount, fieldNote }) => {
  const completedAt = new Date().toISOString();
  const estimateDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return supabase.from("site_visits").update({
    completed_at: completedAt,
    estimate_due_at: estimateDueAt,
    field_estimate_amount: fieldAmount ?? null,
    field_estimate_note: fieldNote ?? null,
    status: "completed",
    updated_at: new Date().toISOString(),
  }).eq("id", id).select().single();
};

export const createEstimate = (data) =>
  supabase.from("estimates").insert({ ...data, status: "draft", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).select().single();

export const getEstimateForSiteVisit = (siteVisitId) =>
  supabase.from("estimates").select("*").eq("site_visit_id", siteVisitId).order("created_at", { ascending: false }).limit(1).maybeSingle();

export const getEstimateForRequest = (requestId) =>
  supabase.from("estimates").select("*").eq("request_id", requestId).order("created_at", { ascending: false }).limit(1).maybeSingle();

export const updateEstimate = (id, data) =>
  supabase.from("estimates").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id).select().single();

export const submitEstimate = async (id, siteVisitId, requestId) => {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("estimates")
    .update({ status: "submitted", submitted_at: now, updated_at: now })
    .eq("id", id).select().single();
  if (!error) {
    if (siteVisitId) await supabase.from("site_visits").update({ status: "estimate_submitted", updated_at: now }).eq("id", siteVisitId);
    if (requestId) await supabase.from("requests").update({ status: "contracting", updated_at: now }).eq("id", requestId);
  }
  return { data, error };
};

export const getCompanyActiveJobs = async (companyId) => {
  const { data: bids, error } = await supabase
    .from("bids")
    .select("*, requests(*)")
    .eq("company_id", companyId)
    .eq("selected", true)
    .order("created_at", { ascending: false });
  if (error || !bids) return { data: [], error };

  const jobs = await Promise.all(bids.map(async (bid) => {
    const { data: sv } = await supabase.from("site_visits").select("*").eq("bid_id", bid.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const { data: est } = sv ? await supabase.from("estimates").select("*").eq("site_visit_id", sv.id).order("created_at", { ascending: false }).limit(1).maybeSingle() : { data: null };
    return { bid, request: bid.requests ?? null, siteVisit: sv ?? null, estimate: est ?? null };
  }));

  return { data: jobs, error: null };
};

// ── STEP B: Update request status (in_progress) ───────────────────────────────

export const setRequestInProgress = (requestId) =>
  supabase.from("requests").update({ status: "in_progress" }).eq("id", requestId);

// ── STEP B: Get company status ────────────────────────────────────────────────

export const getCompanyStatus = (companyId) =>
  supabase.from("companies").select("company_status").eq("id", companyId).single();

// ── STEP B: Escrow record creation ────────────────────────────────────────────

export const createEscrowRecord = (data) =>
  supabase.from("escrow_payments").insert({
    request_id:          data.requestId ?? null,
    company_id:          data.companyId ?? null,
    total_amount:        data.totalAmount,
    transaction_status:  "CONTRACTED",
    status:              "deposited",
    step1_deposited_at:  new Date().toISOString(),
  }).select().single();

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
export async function checkDirectDealKeyword(messageText, { requestId = null, companyId = null, customerId = null, senderId = null, senderRole = null } = {}) {
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

// 실측 후 미계약 자동 추적 — 관리자 수동 실행 또는 cron 으로 호출.
//   48h 경과 + 견적서 미제출  → 업체에 기한 임박 알림
//   72h 경과 + 견적서 미제출  → 매칭 취소 + 업체 공간온도 -3 + 의심 플래그
//   7d  경과 + 견적서 제출 + 계약 없음 → 양측 문의 + 의심 플래그
export async function checkSiteVisitFollowUp() {
  const now = Date.now();
  const h48 = new Date(now - 48 * 60 * 60 * 1000).toISOString();
  const h72 = new Date(now - 72 * 60 * 60 * 1000).toISOString();
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
