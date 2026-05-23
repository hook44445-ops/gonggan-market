import { createClient } from "@supabase/supabase-js";

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
  supabase.from("users").select("*").eq("id", id).single();

export const getUserByPhone = (phone) =>
  supabase.from("users").select("*").eq("phone", phone).maybeSingle();

// ── Companies ─────────────────────────────────────────────────────────────────

export const getCompanies = () =>
  supabase.from("companies").select("*").order("temp", { ascending: false });

export const getCompany = (id) =>
  supabase.from("companies").select("*").eq("id", id).single();

export const getCompanyByOwnerId = (ownerId) =>
  supabase.from("companies").select("*").eq("owner_id", ownerId).single();

export const upsertCompany = (data) =>
  supabase.from("companies").upsert(data).select().single();

// Atomically adjust a company's 공간온도 by delta, clamped to 0–99
export const updateCompanyTemp = async (companyId, delta) => {
  const { data, error } = await supabase
    .from("companies")
    .select("temp")
    .eq("id", companyId)
    .single();
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
  supabase.from("requests").select("*").order("created_at", { ascending: false });

export const getRequest = (id) =>
  supabase.from("requests").select("*").eq("id", id).single();

export const getUserRequests = (userId) =>
  supabase.from("requests").select("*").eq("user_id", userId).order("created_at", { ascending: false });

export const closeRequest = (id) =>
  supabase.from("requests").update({ status: "closed" }).eq("id", id);

// ── Bids ──────────────────────────────────────────────────────────────────────

export const createBid = (data) =>
  supabase.from("bids").insert(data).select().single();

export const getBidsForRequest = (requestId) =>
  supabase
    .from("bids")
    .select("*, companies(id, name, temp, verified, badge, completed_jobs, recontract_rate, as_rate, region, online, owner_id, company_status, has_insurance)")
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
  supabase.from("escrow_payments").select("*").eq("request_id", requestId).single();

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
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
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

// ── Fee Config ────────────────────────────────────────────────────────────────

export const getFeeConfig = () =>
  supabase.from("fee_config").select("*").single();

// ── Admin Logs ────────────────────────────────────────────────────────────────

export const createAdminLog = (log) =>
  supabase.from("admin_logs").insert(log).select().single();

export const getAdminLogs = () =>
  supabase.from("admin_logs").select("*").order("created_at", { ascending: false });

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

export const updateTransactionStatus = (paymentId, transactionStatus) =>
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

export const logActivity = ({ userId, role, action, targetType, targetId, metadata = {} }) =>
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

export const createNotification = ({ userId, type, title, message, relatedId, relatedType }) =>
  supabase.from("notifications").insert({
    user_id:      userId,
    type,
    title,
    message,
    related_id:   relatedId   ?? null,
    related_type: relatedType ?? null,
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

export const updateDisputeStatus = (paymentId, disputeStatus) =>
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

export const getCompanyActiveJobs = (companyId) =>
  supabase
    .from("escrow_payments")
    .select("*, requests(space_type, area, size)")
    .eq("company_id", companyId)
    .not("status", "eq", "completed")
    .order("created_at", { ascending: false });

// ── Admin: update company doc_status with audit log ───────────────────────────

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

// Create all 4 escrow payout records for a contract
export const createEscrowPayoutsForContract = async (escrowId, companyId, totalAmount, feeRate = 0.04) => {
  const stages = [
    { stage: 1, percent: 10 },
    { stage: 2, percent: 20 },
    { stage: 3, percent: 40 },
    { stage: 4, percent: 30 },
  ];
  const payouts = stages.map(s => {
    const amount      = Math.round(totalAmount * s.percent / 100);
    const platformFee = Math.round(amount * feeRate);
    const vat         = Math.round(platformFee * 0.1);
    return {
      escrow_id:    escrowId,
      company_id:   companyId,
      stage:        s.stage,
      percent:      s.percent,
      amount,
      platform_fee: platformFee,
      vat,
      net_amount:   amount - platformFee - vat,
      status:       "PENDING",
    };
  });
  return supabase.from("escrow_payouts").insert(payouts).select();
};

// Hold all non-final payouts when a dispute is filed
export const holdAllPayoutsForEscrow = (escrowId) =>
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

export const getLoungePosts = async (category = "all") => {
  let q = supabase
    .from("lounge_posts")
    .select("*")
    .eq("is_story", false)
    .eq("is_deleted", false)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false });
  if (category === "popular") {
    q = q.order("view_count", { ascending: false });
  } else if (category !== "all") {
    q = q.eq("category", category);
  }
  return q;
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
  supabase
    .from("lounge_posts")
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", postId)
    .eq("user_id", userId);

export const getLoungeStories = () =>
  supabase
    .from("lounge_posts")
    .select("*")
    .eq("is_story", true)
    .eq("is_deleted", false)
    .eq("is_hidden", false)
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
    .eq("is_deleted", false)
    .order("created_at", { ascending: true });

export const createLoungeComment = (data) =>
  supabase.from("lounge_comments").insert(data).select().single();

export const softDeleteLoungeComment = (commentId, userId) =>
  supabase
    .from("lounge_comments")
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", commentId)
    .eq("user_id", userId);

export const likeLoungePost = (postId, userId) =>
  supabase.from("lounge_post_likes").insert({ post_id: postId, user_id: userId });

export const unlikeLoungePost = (postId, userId) =>
  supabase
    .from("lounge_post_likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", userId);

export const saveLoungePost = (postId, userId) =>
  supabase.from("lounge_saves").insert({ post_id: postId, user_id: userId });

export const unsaveLoungePost = (postId, userId) =>
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
