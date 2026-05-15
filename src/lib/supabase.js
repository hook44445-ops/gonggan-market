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
