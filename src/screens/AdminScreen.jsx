import { useState, useEffect, useMemo } from "react";
import { dlog } from "../utils/devLog"; // 프로덕션 무출력 진단 로거(운영 콘솔 정리)
import { C, R, S } from "../constants";
import { BADGES, requiredDeposit, depositRatePct, BADGE_ORDER } from "../constants/badges";
import { COMPANY_STATUS_META, USER_STATUS_META } from "../constants";
import { LOUNGE_CATEGORIES } from "../constants/lounge";
import { ISSUE_PRESETS, generateDraft, classifyCategory } from "../constants/aiContentFactory";
import { scoreTopic, priorityFromScore, PRIORITY_LABEL } from "../lib/topicScore";
import { mapCategory } from "../lib/categoryMapper";
import { runEditorialMeeting, selectTodaysContent, generateReviewedDraft } from "../lib/aiEditor";
import { generateDailyIssues } from "../lib/dailyIssues";
import { recommendCategories } from "../lib/categoryRecommender";
import { scoreContent } from "../lib/contentScore";
// Phase 8 — Content Quality & Natural Category (기존 엔진 무수정, 신규 모듈 추가 호출)
import { generateVoicedDraft, generateVoicedDraftLLM } from "../lib/categoryVoiceWriter";
import { isLLMConfigured } from "../lib/llmClient";
// Phase 18 — Real LLM Editorial Engine
import { generateEditorial } from "../lib/editorialEngine";
import { getEditorialConfig, setEditorialConfig } from "../lib/editorialConfig";
import { resolveLoungeCategory } from "../lib/loungeCategoryMap";
import { generateForWorkbench, saveWorkbenchRecord, PROMPT_VERSIONS } from "../lib/editorWorkbench";
import {
  workbenchIndex, getPipelineStages, setPipelineStage, clearPipelineStage,
  buildDraftBoard, publishHistory, popularContent, todaysPick, opsStats, PIPELINE_STAGES,
} from "../lib/publishingPipeline";
import { discoverTrendingTopics, trendSummary } from "../lib/trendDiscovery";
import { buildDailyPlan, getPriorityConfig, setPriorityConfig, RATIO_PRESETS, targetMix } from "../lib/publishingPriority";
import { analyzeStrategy, MODE_HELP, VERSION_HELP, TEMPERATURE_HELP } from "../lib/autoStrategy";
import { usageStats, openRouterStatus } from "../lib/usageDashboard";
import {
  getAutoConfig, setAutoConfig, planAutoPublish, executeAutoPublishPlan,
  autoPublishStats, getPublishLog,
} from "../lib/autoPublish";
import { voiceFor } from "../constants/categoryVoice";
import { scoreUsefulness } from "../lib/contentUsefulness";
import { detectForcedSpaceLinks } from "../lib/forcedSpaceLinkFilter";
import { connectionRate, clusterBreakdown, knowledgeMap, todaysSpace, editorsPick } from "../lib/spaceGraph";
import { preGenerationCheck } from "../lib/preGenerationCheck";
import { TOPIC_CLUSTERS } from "../constants/knowledgeMap";
import { communityScore, rankByCommunity, todaysLivingSpace } from "../lib/communityScore";
import { commentInsightByPost } from "../lib/commentInsight";
import { buildFollowupQueue } from "../lib/followupRecommender";
import { communityTemperature } from "../lib/communityTemperature";
import { composeMagazine } from "../lib/magazine";
import { composeArchive } from "../lib/archive";
import { spaceSearch } from "../lib/spaceSearch";
import { pipelineStages, buildDraftQueue, todaysDashboard, publishingCalendar } from "../lib/publishingOs";
import { categoryHealthSummary } from "../lib/categoryHealth";
import { spaceCoverage } from "../lib/spaceCoverage";
import { buildSpaceIndex } from "../lib/spaceIndex";
import {
  supabase,
  getCompanies, getUsers, getUser, getUserByPhone,
  adminReviewCompany, adminSetCompanyStatus,
  createNotification, getUserNotifications,
  getAdminLogs, getOpsConfig, updateOpsConfig,
  getPaymentOrders, adminUpdatePaymentOrder,
  getDisputePayments, adminResolveDispute,
  getPendingPayouts, adminSetPayoutStatus,
  apiAdminSetUserStatus, apiAdminAdjustUserTokens, apiAdminAdjustSpaceTemp,
  adminGetLoungePosts, getLoungeReports,
  adminHideContent, adminUpdateLoungeReport,
  createSeedLoungePost, updateSeedLoungePost, deleteSeedLoungePost, uploadSeedLoungeImage, adminGetSeedLoungePosts,
  holdAllPayoutsForEscrow,
  getCompanyDocuments, adminReviewDocument,
  getReviewRewardsPending, updateReviewReward,
  adminGetHiddenRequests, adminRestoreRequest,
  getSeedReviews, createSeedReview, updateSeedReview, deleteSeedReview, uploadSeedReviewImage,
  adminGetReviews, adminUpdateReview, adminHideReview, adminSoftDeleteReview, adminRestoreReview,
  adminUpdateLoungePost, adminSoftDeleteLoungePost, adminRestoreLoungePost,
  adminCreateLoungeDraft, adminUpdateLoungeDraft, adminListLoungeDrafts, adminListPublishedAiContent, adminDeleteLoungeDraft,
  adminGetLoungeComments, adminSoftDeleteLoungeComment, adminRestoreLoungeComment,
  adminUpdateCompanyInfo, adminUpdateUserInfo,
  getCompaniesByOwnerIds,
  adminVerifyUserIdentity,
  getDirectDealReports, updateDirectDealReportStatus, checkSiteVisitFollowUp, checkDirectDealSchedules,
  getOperators, rpcSetOperatorByPhone, rpcUnsetOperator,
  adminListOperators, adminRegisterOperator, adminUpdatePermissions, adminResetPin, adminUnregisterOperator,
  getTestAccounts, rpcSetTestAccountByPhone, rpcUnsetTestAccount,
  fetchAdminCustomers, fetchAdminSeedPosts, setSeedPostVisible, rpcSetPostHot, rpcSetPostHidden,
  getProjectCheckpoints, getAdminProjectFlow,
  getPartnerLeads, setPartnerLeadStatus, setPartnerLeadOnboarding, setPartnerLeadArchive,
  getChatsForProject,
  adminCleanupRequest, adminCleanupUserTestData, adminCleanupCompanyTestData,
  adminSetCompanyBadge, adminSetGuarantee,
  getAdminVisitStats,
} from "../lib/supabase";
import { CATEGORY_LABEL } from "../constants/lounge";
import { GUARANTEE_GRADE_MAP, GUARANTEE_STATUS_META, wonFromManwon } from "../constants/guarantee";
import { ONBOARDING_GRADE_MAP, ONBOARDING_STATUS_META } from "../constants/partnerOnboarding";
import { checkpointEvidenceStatus, checkpointEvidenceBadge, parseGpsMissingReason } from "../utils/gpsCheckpoint";
import AdminDocumentReviewModal from "../components/AdminDocumentReviewModal";
import AdminChangeOrderHistory from "../components/AdminChangeOrderHistory";
import AdminContractDetail from "../components/AdminContractDetail";
import TransactionManagement from "../components/TransactionManagement";
import FinanceDashboard from "../components/FinanceDashboard";
import SettlementManagement from "../components/SettlementManagement";
import ProjectEvidenceManagement from "../components/ProjectEvidenceManagement";
import GpsTrustDashboard from "../components/GpsTrustDashboard";
import EvidenceTimelineDashboard from "../components/EvidenceTimelineDashboard";
import AdminCategoryNav from "../components/AdminCategoryNav";
import AdminChatOverview from "./admin/AdminChatOverview";
import AdminLogView from "../components/AdminLogView";
import AdminKpiPanel from "../components/AdminKpiPanel";
import AdminGlobalSearch from "../components/AdminGlobalSearch";
import LoungeInsightsDashboard from "../components/LoungeInsightsDashboard";
import { toE164KR } from "../lib/testAccounts";

// 라운지 시딩 카테고리 — 통합 Category Master(LOUNGE_CATEGORIES) 기준. 작성 가능 카테고리만 사용.
// 관리자/사용자/글쓰기/라운지피드가 동일 마스터를 공유(오래된 slug worry/food/chat 제거).
const SEED_CATEGORIES = LOUNGE_CATEGORIES
  .filter(c => c.group !== null)
  .map(c => ({ id: c.id, label: c.label }));

// 작성자/글 유형 (seed_type) — text 저장(enum 아님, 확장 대비). 업체/전문가는 전문가 표시.
const SEED_TYPES = [
  { id: '운영',   label: '운영',       expert: false },
  { id: '의뢰인', label: '의뢰인 예시', expert: false },
  { id: '업체',   label: '업체 예시',   expert: true  },
  { id: '전문가', label: '전문가 예시', expert: true  },
];

// 카테고리별 시딩 글 유형 힌트(⑥) — 작성 보조용(표시 전용)
const SEED_TYPE_HINTS = {
  interior:    '비용 설명 · 자재 선택 · 공간별 팁 · 업체 선택 기준',
  review:      'Before/After 후기 · 공사 과정 · 만족/아쉬운 점 · 비용 차이 사례',
  quote_worry: '20·30평 견적 고민 · 욕실/주방/도배/장판 비용 · 업체별 견적 차이 · 예산 조정',
  room_deco:   '조명 · 수납 · 색상 · 가구 배치 · 홈스타일링',
  move_in:     '입주 전 체크리스트 · 입주청소 · 하자 점검 · 이사 전 인테리어',
  realestate:  '구축 아파트 · 신축 입주 · 전세/매매 전 확인 · 집 상태 점검',
  health:      '수면 환경 · 실내 공기 · 홈트 공간 · 생활 습관',
  stock:       '초보 투자 고민 · 월급 관리 · 투자 공부 · 리스크 관리',
  jobs:        '이직 고민 · 면접 · 연봉 · 직장생활',
  pet:         '미끄럼 방지 바닥 · 냄새 관리 · 반려동물 공간 · 안전한 집',
  daily:       '생활 팁 · 청소 · 정리 · 살림',
  local:       '지역 이야기 · 동네 정보 · 주변 생활',
  humor:       '가벼운 이야기 · 일상 · 질문',
  free:        '가벼운 이야기 · 일상 · 질문',
};

// 검색 유입용 작성 가이드(⑦) — 화면에 'SEO' 미노출
const SEED_WRITE_GUIDE = '지역, 공간, 고민을 함께 적으면 더 많은 사람이 참고하기 좋아요.';
const SEED_TITLE_EXAMPLES = [
  '강서구 32평 리모델링 비용이 왜 다를까?',
  '부천 욕실 공사 전에 확인할 것',
  '구축 아파트 입주 전 체크리스트',
  '반려동물 있는 집 바닥재 고르는 법',
];

const BLANK_LOUNGE_SEED = {
  category: 'interior', seed_type: '운영', title: '', content: '',
  region: '', author_name: '공간마켓',
  expert_company_name: '', expert_badge: '', expert_job: '',
  sort_order: 0, is_recommended: false, is_active: true,
};

// ── 방문자/DAU/MAU 카드 (085) — 관리자 대시보드 상단. security-definer RPC 카운트만 조회. ──
//   마이그레이션 미적용/조회 실패 시 앱이 깨지지 않게 '준비 중'/0 fallback(관리자 화면 blank 금지).
function AdminVisitCards({ adminUserId }) {
  const [stats, setStats] = useState(null); // { today, d7, d30, dau, mau } | null
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await getAdminVisitStats(adminUserId ?? "admin");
        if (!alive) return;
        if (error || !data) { setFailed(true); setReady(true); return; }
        setStats(data);
        setReady(true);
      } catch (e) {
        if (!alive) return;
        try { console.error("[VISIT_STATS_FAILED]", e?.message ?? e); } catch { /* noop */ }
        setFailed(true); setReady(true);
      }
    })();
    return () => { alive = false; };
  }, [adminUserId]);

  const cards = [
    ["오늘 방문자", stats?.today, C.brand],
    ["최근 7일",    stats?.d7,    C.green],
    ["최근 30일",   stats?.d30,   C.navy ?? C.brand],
    ["DAU",         stats?.dau,   C.gold],
    ["MAU",         stats?.mau,   C.text2],
  ];

  return (
    <div style={{ marginBottom: S.xl }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>👥 방문자 현황</div>
      {failed ? (
        <div style={{ background: C.surface, borderRadius: R.lg, padding: S.xl, border: `1px solid ${C.bgWarm}`,
          fontSize: 12.5, color: C.text3, lineHeight: 1.7 }}>
          준비 중 — 방문자 통계(user_visits)를 아직 불러올 수 없습니다.<br/>
          마이그레이션(085_user_visits.sql) 적용 후 표시됩니다.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: S.sm }}>
          {cards.map(([label, val, color]) => (
            <div key={label} style={{ background: C.surface, borderRadius: R.lg, padding: `${S.md}px ${S.sm}px`,
              textAlign: "center", border: `1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize: 22, fontWeight: 900, color }}>{ready ? (val ?? 0).toLocaleString("ko-KR") : "…"}</div>
              <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 10.5, color: C.text4, marginTop: 6 }}>
        방문자 = 날짜 기준 고유 방문(로그인 user 또는 익명 세션). DAU=오늘 고유 방문 · MAU=최근 30일 고유 방문.
      </div>
    </div>
  );
}

// ── 리뷰 어드민 탭 ────────────────────────────────────────
function ReviewAdminTab({ adminUserId, showToast }) {
  const [reviews,    setReviews]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchErr,   setFetchErr]   = useState(null);
  const [filter,     setFilter]     = useState("all"); // all | hidden | deleted
  const [photoOnly,  setPhotoOnly]  = useState(false); // 포토후기(이미지 있는 리뷰)만
  const [editId,     setEditId]     = useState(null);
  const [editForm,   setEditForm]   = useState({});
  const [reasonId,   setReasonId]   = useState(null);
  const [reason,     setReason]     = useState("");
  const [acting,     setActing]     = useState(false);
  const [schemaFallback, setSchemaFallback] = useState(false);

  const loadReviews = async () => {
    setLoading(true);
    const { data, error, _schemaFallback } = await adminGetReviews({ limit: 150 });
    setSchemaFallback(!!_schemaFallback);
    if (data && data.length > 0) {
      // Two-step: load companies by owner_id separately (reviews.company_id → users.id)
      const ownerIds = [...new Set(data.map(r => r.company_id).filter(Boolean))];
      let coMap = {};
      if (ownerIds.length > 0) {
        const { data: cos } = await getCompaniesByOwnerIds(ownerIds);
        (cos ?? []).forEach(c => { coMap[c.owner_id] = c.name; });
      }
      setReviews(data.map(r => ({ ...r, companies: { name: coMap[r.company_id] ?? null } })));
    } else {
      setReviews(data ?? []);
    }
    setFetchErr(error?.message ?? null);
    setLoading(false);
  };

  useEffect(() => { loadReviews(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 리뷰 어드민 RPC(admin_*)에 전달되는 관리자 식별자 확인용 — uuid 여야 한다.
  // (문자열 "admin" 이면 'invalid input syntax for type uuid: "admin"' 발생)
  useEffect(() => {
    dlog("[GONGGAN_DEBUG][ReviewAdmin:adminUserId]", {
      adminUserId, type: typeof adminUserId,
    });
  }, [adminUserId]);

  const reload = loadReviews;

  // 포토후기 = before/after/legacy 이미지가 하나라도 있는 리뷰
  const reviewHasPhotos = (r) =>
    (r.before_image_urls?.length ?? 0) + (r.after_image_urls?.length ?? 0) + (r.image_urls?.length ?? 0) > 0;
  const visible = reviews.filter(r => {
    let base;
    if (filter === "hidden")  base = r.is_hidden && !r.is_deleted;
    else if (filter === "deleted") base = r.is_deleted;
    else base = !r.is_deleted;
    return base && (!photoOnly || reviewHasPhotos(r));
  });

  const doHide = async (r) => {
    if (schemaFallback) { showToast?.("DB 마이그레이션(008) 적용 후 사용 가능합니다", false); return; }
    if (!r.is_hidden && !reason.trim()) {
      showToast?.("숨김 사유를 입력하세요", false); return;
    }
    setActing(true);
    const { error } = await adminHideReview(r.id, adminUserId, !r.is_hidden, reason || null);
    if (error) {
      console.error("[GONGGAN_DIAG][reviewAdmin:hide]", { reviewId: r.id, adminUserId, error: error.message ?? error });
      showToast?.(error.message ?? "처리 실패", false);
    } else {
      showToast?.(r.is_hidden ? "숨김 해제 완료" : "숨김 처리 완료");
      setReviews(prev => prev.map(x => x.id === r.id ? { ...x, is_hidden: !r.is_hidden } : x));
      setReasonId(null); setReason("");
      // DB 재조회(authoritative) — RPC 가 실제로 반영됐는지 화면이 DB 상태를 따르게 한다.
      // (옵티미스틱 갱신만 하면 미반영(phantom success)이 새로고침 전까지 안 보임.)
      loadReviews();
    }
    setActing(false);
  };

  const doDelete = async (r) => {
    if (schemaFallback) { showToast?.("DB 마이그레이션(008) 적용 후 사용 가능합니다", false); return; }
    if (!reason.trim()) { showToast?.("삭제 사유를 입력하세요", false); return; }
    setActing(true);
    const { error } = await adminSoftDeleteReview(r.id, adminUserId, reason);
    if (error) {
      console.error("[GONGGAN_DIAG][reviewAdmin:delete]", { reviewId: r.id, adminUserId, error: error.message ?? error });
      showToast?.(error.message ?? "처리 실패", false);
    } else {
      showToast?.("삭제(숨김) 처리 완료");
      setReviews(prev => prev.map(x => x.id === r.id ? { ...x, is_deleted: true } : x));
      setReasonId(null); setReason("");
      loadReviews();
    }
    setActing(false);
  };

  const doRestore = async (r) => {
    if (schemaFallback) { showToast?.("DB 마이그레이션(008) 적용 후 사용 가능합니다", false); return; }
    setActing(true);
    const { error } = await adminRestoreReview(r.id, adminUserId);
    if (error) {
      console.error("[GONGGAN_DIAG][reviewAdmin:restore]", { reviewId: r.id, adminUserId, error: error.message ?? error });
      showToast?.(error.message ?? "처리 실패", false);
    } else {
      showToast?.("복구 완료");
      setReviews(prev => prev.map(x => x.id === r.id ? { ...x, is_deleted: false, is_hidden: false } : x));
      loadReviews();
    }
    setActing(false);
  };

  const doEdit = async (r) => {
    setActing(true);
    const { error } = await adminUpdateReview(r.id, editForm, adminUserId);
    if (error) {
      console.error("[GONGGAN_DIAG][reviewAdmin:edit]", { reviewId: r.id, adminUserId, error: error.message ?? error });
      showToast?.(error.message ?? "수정 실패", false);
    } else {
      showToast?.("수정 완료");
      setReviews(prev => prev.map(x => x.id === r.id ? { ...x, ...editForm } : x));
      setEditId(null); setEditForm({});
      loadReviews();
    }
    setActing(false);
  };

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: 4 }}>⭐ 리뷰 어드민</div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: S.lg }}>실제 작성된 리뷰를 수정·숨김·삭제·복구합니다</div>

      {import.meta.env.DEV && (
        <div style={{ background: "rgba(0,0,0,0.88)", color: "#0f0", borderRadius: 8, padding: "8px 12px", marginBottom: S.md, fontSize: 11, lineHeight: 1.8, fontFamily: "monospace" }}>
          [DEV] reviews_loaded: {reviews.length} | filter: {filter} | visible: {visible.length}<br/>
          fetch_err: <span style={{ color: fetchErr ? "#f66" : "#0f0" }}>{fetchErr ?? "none"}</span><br/>
          hidden: {reviews.filter(r => r.is_hidden).length} | deleted: {reviews.filter(r => r.is_deleted).length}
        </div>
      )}

      {fetchErr && (
        <div style={{ background: "#FFF0F0", border: `1px solid ${C.red}33`, borderRadius: R.lg, padding: S.md, marginBottom: S.md }}>
          <div style={{ fontSize: 12, color: C.red, fontWeight: 700 }}>⚠️ 리뷰 로드 실패: {fetchErr}</div>
        </div>
      )}

      {schemaFallback && (
        <div style={{ background: "#FFF8E8", border: `1px solid ${C.amber ?? "#E0A53A"}44`, borderRadius: R.lg, padding: S.md, marginBottom: S.md }}>
          <div style={{ fontSize: 12, color: C.text2, fontWeight: 700, marginBottom: 2 }}>ℹ️ 숨김·삭제 기능 준비 안 됨</div>
          <div style={{ fontSize: 11, color: C.text3, lineHeight: 1.6 }}>
            리뷰는 정상 표시되지만, 숨김·삭제·복구는 DB 마이그레이션(008_reviews_admin_columns.sql) 적용 후 사용할 수 있어요. 적용 전까지 해당 버튼은 동작하지 않습니다.
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: S.sm, marginBottom: S.lg, alignItems: "center" }}>
        {[["all","전체"],["hidden","숨김"],["deleted","삭제됨"]].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)}
            style={{ padding: "7px 14px", borderRadius: R.full, border: `1.5px solid ${filter===v ? C.brand : C.bgWarm}`,
              background: filter===v ? C.brandL : C.surface, color: filter===v ? C.brand : C.text3,
              fontWeight: filter===v ? 800 : 500, fontSize: 12, cursor: "pointer" }}>{l}</button>
        ))}
        <button onClick={() => setPhotoOnly(v => !v)}
          style={{ padding: "7px 14px", borderRadius: R.full, border: `1.5px solid ${photoOnly ? C.brand : C.bgWarm}`,
            background: photoOnly ? C.brandL : C.surface, color: photoOnly ? C.brand : C.text3,
            fontWeight: photoOnly ? 800 : 500, fontSize: 12, cursor: "pointer" }}>📷 포토후기</button>
        <button onClick={reload} disabled={loading}
          style={{ marginLeft: "auto", padding: "7px 14px", borderRadius: R.full, border: `1px solid ${C.bgWarm}`,
            background: C.surface, color: C.text3, fontSize: 12, cursor: "pointer" }}>
          {loading ? "로드중…" : "새로고침"}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: C.text3, fontSize: 14 }}>불러오는 중…</div>
      ) : visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: C.text3, fontSize: 14 }}>해당 리뷰가 없습니다</div>
      ) : visible.map(r => {
        const isEditing = editId === r.id;
        const showReason = reasonId === r.id;
        const co = r.companies;
        return (
          <div key={r.id} style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.sm,
            border: `1.5px solid ${r.is_deleted ? C.red+"33" : r.is_hidden ? C.gold+"44" : C.bgWarm}`,
            opacity: r.is_deleted ? 0.65 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.sm }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>
                  {"★".repeat(r.rating ?? 0)}
                  {r.is_hidden && <span style={{ marginLeft: 6, fontSize: 11, color: C.gold, fontWeight: 700 }}>숨김</span>}
                  {r.is_deleted && <span style={{ marginLeft: 6, fontSize: 11, color: C.red, fontWeight: 700 }}>삭제됨</span>}
                </div>
                <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                  {r.user_name ?? "—"} · {co?.name ?? r.company_id?.slice?.(0,8)} · {r.region ?? ""} · {r.created_at?.slice(0,10)}
                </div>
              </div>
              <div style={{ display: "flex", gap: S.xs }}>
                {!r.is_deleted && (
                  <button onClick={() => { setEditId(isEditing ? null : r.id); setEditForm({ content: r.content, rating: r.rating, status: r.status }); }}
                    style={{ padding: "5px 10px", borderRadius: R.full, border: `1px solid ${C.brandM}`, background: C.brandL, color: C.brand, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    {isEditing ? "취소" : "수정"}
                  </button>
                )}
              </div>
            </div>

            {isEditing ? (
              <div style={{ marginBottom: S.sm }}>
                <textarea value={editForm.content ?? ""} onChange={e => setEditForm(p => ({ ...p, content: e.target.value }))}
                  style={{ width: "100%", padding: S.sm, borderRadius: R.md, border: `1.5px solid ${C.bgWarm}`, fontSize: 12,
                    resize: "vertical", minHeight: 70, outline: "none", boxSizing: "border-box", fontFamily: "inherit", color: C.text1 }} />
                <div style={{ display: "flex", gap: S.sm, marginTop: S.sm }}>
                  <select value={editForm.rating ?? 5} onChange={e => setEditForm(p => ({ ...p, rating: Number(e.target.value) }))}
                    style={{ padding: "6px 10px", borderRadius: R.md, border: `1px solid ${C.bgWarm}`, fontSize: 12, outline: "none" }}>
                    {[5,4,3,2,1].map(n => <option key={n} value={n}>{"★".repeat(n)} {n}점</option>)}
                  </select>
                  <select value={editForm.status ?? "APPROVED"} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}
                    style={{ padding: "6px 10px", borderRadius: R.md, border: `1px solid ${C.bgWarm}`, fontSize: 12, outline: "none" }}>
                    {["APPROVED","PENDING","REJECTED","HIDDEN"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => doEdit(r)} disabled={acting}
                    style={{ flex: 1, padding: "7px", background: C.brand, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.6, marginBottom: S.sm }}>
                {r.content?.slice(0,120)}{(r.content?.length ?? 0) > 120 ? "…" : ""}
              </div>
            )}

            {showReason ? (
              <div style={{ marginTop: S.sm }}>
                <input value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="처리 사유 입력 (필수)"
                  style={{ width: "100%", padding: "8px 12px", borderRadius: R.md, border: `1.5px solid ${C.bgWarm}`,
                    fontSize: 12, outline: "none", boxSizing: "border-box", marginBottom: S.sm, fontFamily: "inherit" }} />
                <div style={{ display: "flex", gap: S.sm }}>
                  <button onClick={() => { setReasonId(null); setReason(""); }}
                    style={{ flex: 1, padding: "8px", background: C.surface2, color: C.text3, border: `1px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 12, cursor: "pointer" }}>
                    취소
                  </button>
                  {!r.is_hidden && !r.is_deleted && (
                    <button onClick={() => doHide(r)} disabled={acting}
                      style={{ flex: 1, padding: "8px", background: "#FBF5E8", color: C.gold, border: `1px solid ${C.gold}44`, borderRadius: R.md, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      숨김
                    </button>
                  )}
                  {!r.is_deleted && (
                    <button onClick={() => doDelete(r)} disabled={acting}
                      style={{ flex: 1, padding: "8px", background: "#FFF0F0", color: C.red, border: `1px solid ${C.red}33`, borderRadius: R.md, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      삭제
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: S.sm, marginTop: S.xs }}>
                {r.is_deleted ? (
                  <button onClick={() => doRestore(r)} disabled={acting}
                    style={{ flex: 1, padding: "7px", background: C.brandL, color: C.brand, border: `1px solid ${C.brandM}`, borderRadius: R.md, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    복구
                  </button>
                ) : (
                  <>
                    {r.is_hidden && (
                      <button onClick={() => doHide(r)} disabled={acting}
                        style={{ flex: 1, padding: "7px", background: C.brandL, color: C.brand, border: `1px solid ${C.brandM}`, borderRadius: R.md, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        숨김해제
                      </button>
                    )}
                    <button onClick={() => { setReasonId(r.id); setReason(""); }}
                      style={{ flex: 1, padding: "7px", background: "#FEF0F0", color: C.red, border: `1px solid ${C.red}22`, borderRadius: R.md, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      {r.is_hidden ? "삭제" : "숨김/삭제"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 리포트 목록 (모듈 레벨 — LoungeManagementTab 외부) ────
function ReportList({ reports, label, hiddenIds, onToggleHide }) {
  return (
    <div style={{ background: "#fff", borderRadius: R.xl, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: S.md }}>{label}</div>
      {reports.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: C.text3, fontSize: 13 }}>신고 내역이 없습니다</div>
      ) : reports.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: S.sm, padding: `${S.sm}px 0`, borderBottom: `1px solid ${C.bg}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: C.text2, fontWeight: 600 }}>ID: {r.targetId}</div>
            <div style={{ fontSize: 11, color: C.text3 }}>
              사유: {r.reason} · {r.createdAt ? new Date(r.createdAt).toLocaleDateString("ko-KR") : ""}
              {hiddenIds.includes(r.targetId) && <span style={{ marginLeft: 6, color: C.red, fontWeight: 700 }}>숨김중</span>}
            </div>
          </div>
          <button onClick={() => onToggleHide(r.targetId)}
            style={{ padding: "5px 10px", borderRadius: R.full, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer",
              background: hiddenIds.includes(r.targetId) ? C.brandL : "#FEF0F0",
              color: hiddenIds.includes(r.targetId) ? C.brand : C.red }}>
            {hiddenIds.includes(r.targetId) ? "숨김해제" : "숨김"}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── 라운지 관리 탭 ────────────────────────────────────────
function LoungeManagementTab({ loungePosts: initPosts = [], loungeErr = null, showToast, adminUserId, onReload }) {
  const allReports = (() => { try { return JSON.parse(localStorage.getItem("lounge_reports") ?? "[]"); } catch { return []; } })();
  const allBlocks  = (() => { try { return JSON.parse(localStorage.getItem("lounge_blocks")  ?? "[]"); } catch { return []; } })();
  const [posts, setPosts] = useState(initPosts);
  useEffect(() => { setPosts(initPosts); }, [initPosts]); // eslint-disable-line react-hooks/exhaustive-deps
  const [postFilter, setPostFilter] = useState("all"); // all | hidden | deleted
  const [postSearch, setPostSearch] = useState(""); // 제목/본문 검색 — 기본 30건 슬라이스 밖의 글(예: 테스트 글)도 찾기 위함
  const [postReasonId, setPostReasonId] = useState(null);
  const [postReason, setPostReason] = useState("");
  const [postActing, setPostActing] = useState(false);
  const [hiddenIds, setHiddenIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lounge_hidden") ?? "[]"); } catch { return []; }
  });

  const [tokenTarget, setTokenTarget] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenReason, setTokenReason] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);

  const [tempTarget, setTempTarget] = useState("");
  const [tempDelta, setTempDelta]   = useState("");
  const [tempReason, setTempReason] = useState("");
  const [tempLoading, setTempLoading] = useState(false);

  const toggleHide = (id) => {
    setHiddenIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try { localStorage.setItem("lounge_hidden", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const lookupUser = async (input) => {
    const val = input.trim();
    if (!val) return null;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const { data } = isUUID ? await getUser(val) : await getUserByPhone(val);
    return data ?? null;
  };

  const handleTokenAdjust = async (isGrant) => {
    const amount = Number(tokenAmount);
    if (!tokenTarget.trim() || !amount || amount <= 0) {
      showToast?.("사용자 ID/전화번호와 토큰 수를 입력하세요", false);
      return;
    }
    setTokenLoading(true);
    try {
      const targetUser = await lookupUser(tokenTarget);
      if (!targetUser) {
        showToast?.("사용자를 찾을 수 없습니다", false);
        return;
      }
      const delta = isGrant ? amount : -amount;
      const { error } = await apiAdminAdjustUserTokens(targetUser.id, adminUserId, delta, tokenReason || null);
      if (error) {
        showToast?.(error.message ?? "처리 실패", false);
      } else {
        showToast?.(isGrant ? `+${amount} 토큰 지급 완료` : `-${amount} 토큰 회수 완료`);
        setTokenTarget(""); setTokenAmount(""); setTokenReason("");
      }
    } finally {
      setTokenLoading(false);
    }
  };

  const handleTempAdjust = async () => {
    const delta = Number(tempDelta);
    if (!tempTarget.trim() || !delta) {
      showToast?.("사용자 ID/전화번호와 변경값을 입력하세요", false);
      return;
    }
    if (!tempReason.trim()) {
      showToast?.("변경 사유를 입력하세요", false);
      return;
    }
    setTempLoading(true);
    try {
      const targetUser = await lookupUser(tempTarget);
      if (!targetUser) {
        showToast?.("사용자를 찾을 수 없습니다", false);
        return;
      }
      const { error } = await adminAdjustSpaceTemp(targetUser.id, adminUserId, delta, tempReason);
      if (error) {
        showToast?.(error.message ?? "처리 실패", false);
      } else {
        showToast?.("공간온도 조정 완료");
        setTempTarget(""); setTempDelta(""); setTempReason("");
      }
    } finally {
      setTempLoading(false);
    }
  };

  const postReports    = allReports.filter(r => r.type === "post");
  const commentReports = allReports.filter(r => r.type === "comment");
  const storyReports   = allReports.filter(r => r.type === "story");

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.lg }}>💬 라운지 관리</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: S.sm, marginBottom: S.xl }}>
        {[["게시글 신고", `${postReports.length}건`, "📝"], ["댓글 신고", `${commentReports.length}건`, "💬"],
          ["스토리 신고", `${storyReports.length}건`, "📸"], ["차단 처리", `${allBlocks.length}명`, "🚫"]].map(([label,val,icon]) => (
          <div key={label} style={{ background: "#fff", borderRadius: R.lg, padding: S.xl, border: `1px solid ${C.bgWarm}`, textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: S.sm }}>{icon}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.text1 }}>{val}</div>
            <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {loungeErr && (
        <div style={{ background: "#FFF0F0", border: `1px solid ${C.red}33`, borderRadius: R.lg, padding: S.md, marginBottom: S.md }}>
          <div style={{ fontSize: 12, color: C.red, fontWeight: 700 }}>⚠️ 라운지 데이터 로드 실패</div>
          <div style={{ fontSize: 11, color: C.red, marginTop: 4, opacity: 0.8 }}>{loungeErr}</div>
        </div>
      )}
      {import.meta.env.DEV && (
        <div style={{ background: "rgba(0,0,0,0.88)", color: "#0f0", borderRadius: 8, padding: "8px 12px", marginBottom: S.md, fontSize: 11, lineHeight: 1.8, fontFamily: "monospace" }}>
          [DEV] lounge_posts_count: {posts.length}<br/>
          lounge_fetch_err: <span style={{ color: loungeErr ? "#f66" : "#0f0" }}>{loungeErr ?? "none"}</span><br/>
          first_post_id: {posts[0]?.id?.slice(0,8) ?? "—"}<br/>
          first_is_deleted: {String(posts[0]?.is_deleted ?? null)} | first_is_hidden: {String(posts[0]?.is_hidden ?? null)}
        </div>
      )}

      {/* ── Post List ── */}
      <div style={{ background: "#fff", borderRadius: R.xl, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>📝 게시글 관리</div>
        <div style={{ display: "flex", gap: S.xs, marginBottom: S.sm }}>
          {[["all","전체"],["hidden","숨김"],["deleted","삭제됨"]].map(([v,l]) => (
            <button key={v} onClick={() => setPostFilter(v)}
              style={{ padding: "5px 12px", borderRadius: R.full, border: `1px solid ${postFilter===v ? C.brand : C.bgWarm}`,
                background: postFilter===v ? C.brandL : "transparent", color: postFilter===v ? C.brand : C.text3,
                fontWeight: postFilter===v ? 800 : 500, fontSize: 11, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
        <input value={postSearch} onChange={e => setPostSearch(e.target.value)}
          placeholder="제목/본문 검색 (예: 테스트 글 찾기)"
          style={{ width: "100%", boxSizing: "border-box", padding: "7px 12px", marginBottom: S.md,
            border: `1px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 12, outline: "none", fontFamily: "inherit" }} />
        {(() => {
          const q = postSearch.trim().toLowerCase();
          const fp = posts.filter(p => {
            if (postFilter === "hidden")  { if (!(p.is_hidden && !p.is_deleted)) return false; }
            else if (postFilter === "deleted") { if (!p.is_deleted) return false; }
            else if (p.is_deleted) return false;
            if (!q) return true;
            return (p.title ?? "").toLowerCase().includes(q) || (p.content ?? "").toLowerCase().includes(q);
          });
          if (fp.length === 0) return <div style={{ textAlign: "center", padding: "20px 0", color: C.text3, fontSize: 12 }}>해당 게시글이 없습니다</div>;
          // 검색 중엔 30건 제한을 완화(기본 목록에 안 보이는 오래된/테스트 글도 찾을 수 있도록).
          return fp.slice(0, q ? 100 : 30).map(p => {
            const showReason = postReasonId === p.id;
            return (
              <div key={p.id} style={{ borderBottom: `1px solid ${C.bg}`, paddingBottom: S.sm, marginBottom: S.sm, opacity: p.is_deleted ? 0.6 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: C.text1, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.title || p.content?.slice(0,40) || "—"}
                      {p.is_hidden && <span style={{ marginLeft: 4, fontSize: 10, color: C.gold, fontWeight: 700 }}>숨김</span>}
                      {p.is_deleted && <span style={{ marginLeft: 4, fontSize: 10, color: C.red, fontWeight: 700 }}>삭제됨</span>}
                    </div>
                    <div style={{ fontSize: 10, color: C.text4 }}>{p.id?.slice(0,8)} · {p.created_at?.slice(0,10)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0, marginLeft: S.sm }}>
                    {p.is_deleted ? (
                      <button onClick={async () => {
                        setPostActing(true);
                        const { error } = await adminRestoreLoungePost(p.id, adminUserId);
                        if (error) showToast?.(error.message ?? "복구 실패", false);
                        else { showToast?.("복구 완료"); setPosts(prev => prev.map(x => x.id === p.id ? { ...x, is_deleted: false, is_hidden: false } : x)); }
                        setPostActing(false);
                      }} disabled={postActing}
                        style={{ padding: "4px 8px", borderRadius: R.full, border: `1px solid ${C.brandM}`, background: C.brandL, color: C.brand, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                        복구
                      </button>
                    ) : (
                      <>
                        {p.is_hidden && (
                          <button onClick={async () => {
                            setPostActing(true);
                            const { error } = await adminHideContent("lounge_posts", p.id, adminUserId, false, null);
                            if (error) showToast?.(error.message ?? "처리 실패", false);
                            else { showToast?.("숨김 해제"); setPosts(prev => prev.map(x => x.id === p.id ? { ...x, is_hidden: false } : x)); }
                            setPostActing(false);
                          }} disabled={postActing}
                            style={{ padding: "4px 8px", borderRadius: R.full, border: `1px solid ${C.brandM}`, background: C.brandL, color: C.brand, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                            해제
                          </button>
                        )}
                        <button onClick={() => { setPostReasonId(showReason ? null : p.id); setPostReason(""); }}
                          style={{ padding: "4px 8px", borderRadius: R.full, border: `1px solid ${C.red}22`, background: "#FFF0F0", color: C.red, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                          {p.is_hidden ? "삭제" : "숨김/삭제"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {showReason && (
                  <div style={{ display: "flex", gap: S.xs, marginTop: 4 }}>
                    <input value={postReason} onChange={e => setPostReason(e.target.value)}
                      placeholder="처리 사유 (필수)"
                      style={{ flex: 1, padding: "6px 10px", borderRadius: R.md, border: `1px solid ${C.bgWarm}`, fontSize: 11, outline: "none", fontFamily: "inherit" }} />
                    {!p.is_hidden && (
                      <button onClick={async () => {
                        if (!postReason.trim()) { showToast?.("사유를 입력하세요", false); return; }
                        setPostActing(true);
                        const { error } = await adminHideContent("lounge_posts", p.id, adminUserId, true, postReason);
                        if (error) showToast?.(error.message ?? "처리 실패", false);
                        else { showToast?.("숨김 처리 완료"); setPosts(prev => prev.map(x => x.id === p.id ? { ...x, is_hidden: true } : x)); setPostReasonId(null); setPostReason(""); }
                        setPostActing(false);
                      }} disabled={postActing}
                        style={{ padding: "6px 10px", borderRadius: R.md, background: "#FBF5E8", color: C.gold, border: `1px solid ${C.gold}44`, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        숨김
                      </button>
                    )}
                    <button onClick={async () => {
                      if (!postReason.trim()) { showToast?.("사유를 입력하세요", false); return; }
                      setPostActing(true);
                      const { error } = await adminSoftDeleteLoungePost(p.id, adminUserId, postReason);
                      if (error) showToast?.(error.message ?? "처리 실패", false);
                      else { showToast?.("삭제 처리 완료"); setPosts(prev => prev.map(x => x.id === p.id ? { ...x, is_deleted: true } : x)); setPostReasonId(null); setPostReason(""); }
                      setPostActing(false);
                    }} disabled={postActing}
                      style={{ padding: "6px 10px", borderRadius: R.md, background: "#FFF0F0", color: C.red, border: `1px solid ${C.red}33`, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                      삭제
                    </button>
                    <button onClick={() => { setPostReasonId(null); setPostReason(""); }}
                      style={{ padding: "6px 8px", borderRadius: R.md, background: C.surface2, color: C.text3, border: `1px solid ${C.bgWarm}`, fontSize: 11, cursor: "pointer" }}>
                      취소
                    </button>
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>

      <ReportList reports={postReports}    label="📋 신고된 게시글" hiddenIds={hiddenIds} onToggleHide={toggleHide} />
      <ReportList reports={commentReports} label="💬 신고된 댓글"  hiddenIds={hiddenIds} onToggleHide={toggleHide} />
      <ReportList reports={storyReports}   label="📸 신고된 스토리" hiddenIds={hiddenIds} onToggleHide={toggleHide} />

      <div style={{ background: "#fff", borderRadius: R.xl, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: S.md }}>💰 공간토큰 수동 관리</div>
        <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
          <div style={{ display: "flex", gap: S.sm }}>
            <input
              value={tokenTarget} onChange={e => setTokenTarget(e.target.value)}
              placeholder="사용자 ID 또는 전화번호"
              style={{ flex: 1, padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit" }} />
            <input
              value={tokenAmount} onChange={e => setTokenAmount(e.target.value)}
              placeholder="토큰 수" type="number" min="1"
              style={{ width: 90, padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit" }} />
          </div>
          <input
            value={tokenReason} onChange={e => setTokenReason(e.target.value)}
            placeholder="지급/회수 사유 (선택)"
            style={{ padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: S.sm }}>
            <button
              onClick={() => handleTokenAdjust(true)} disabled={tokenLoading}
              style={{ flex: 1, padding: "10px", background: tokenLoading ? C.bgWarm : C.brandL, color: C.brand, border: `1px solid ${C.brandM}`, borderRadius: R.lg, fontWeight: 700, fontSize: 13, cursor: tokenLoading ? "not-allowed" : "pointer" }}>
              {tokenLoading ? "처리중…" : "+ 지급"}
            </button>
            <button
              onClick={() => handleTokenAdjust(false)} disabled={tokenLoading}
              style={{ flex: 1, padding: "10px", background: tokenLoading ? C.bgWarm : "#FEF0F0", color: C.red, border: `1px solid ${C.red}33`, borderRadius: R.lg, fontWeight: 700, fontSize: 13, cursor: tokenLoading ? "not-allowed" : "pointer" }}>
              {tokenLoading ? "처리중…" : "- 회수"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}` }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: S.md }}>🌡️ 공간온도 수동 조정</div>
        <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.md, marginBottom: S.md, border: `1px solid ${C.brandM}` }}>
          <div style={{ fontSize: 12, color: C.brand, lineHeight: 1.6 }}>변경 사유를 반드시 입력하세요. 변경 기록은 adminLogs에 자동 저장됩니다.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
          <input
            value={tempTarget} onChange={e => setTempTarget(e.target.value)}
            placeholder="사용자 ID 또는 전화번호"
            style={{ padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit" }} />
          <input
            value={tempDelta} onChange={e => setTempDelta(e.target.value)}
            placeholder="변경값 (+0.1 또는 -0.5)" type="number" step="0.1"
            style={{ padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit" }} />
          <input
            value={tempReason} onChange={e => setTempReason(e.target.value)}
            placeholder="변경 사유 (필수)"
            style={{ padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit" }} />
          <button
            onClick={handleTempAdjust} disabled={tempLoading}
            style={{ padding: "12px", background: tempLoading ? C.bgWarm : C.brand, color: tempLoading ? C.text3 : "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 14, cursor: tempLoading ? "not-allowed" : "pointer", boxShadow: tempLoading ? "none" : `0 4px 14px ${C.brand}44` }}>
            {tempLoading ? "처리중…" : "공간온도 조정하기"}
          </button>
        </div>
      </div>

      {posts.length > 0 && (
        <div style={{ background: "#fff", borderRadius: R.xl, padding: S.xl, marginTop: S.lg, border: `1px solid ${C.bgWarm}` }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: S.md }}>📝 게시글 목록 (총 {posts.length}개)</div>
          {posts.slice(0, 30).map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: S.sm, padding: `${S.sm}px 0`, borderBottom: `1px solid ${C.bg}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: C.text2, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.title ?? p.content?.slice(0, 40)}
                </div>
                <div style={{ fontSize: 11, color: C.text3 }}>
                  {p.anonymous_nickname} · {p.category}
                  {p.is_deleted && <span style={{ color: C.red, marginLeft: 4, fontWeight: 700 }}>삭제됨</span>}
                  {p.is_hidden  && <span style={{ color: C.gold, marginLeft: 4, fontWeight: 700 }}>숨김</span>}
                </div>
              </div>
              <button
                disabled={!!p.is_deleted}
                onClick={async () => {
                  if (!window.confirm(`이 게시글을 삭제할까요?\n"${(p.title ?? p.content)?.slice(0, 30)}"`)) return;
                  const { error } = await adminSoftDeleteLoungePost(p.id, adminUserId);
                  if (error) showToast?.("삭제 실패: " + (error.message ?? ""), false);
                  else { showToast?.("게시글 삭제 완료"); onReload?.(); }
                }}
                style={{ padding: "5px 10px", borderRadius: R.full, border: "none", fontSize: 11, fontWeight: 700,
                  cursor: p.is_deleted ? "not-allowed" : "pointer",
                  background: p.is_deleted ? C.bgWarm : "#FEF0F0",
                  color: p.is_deleted ? C.text4 : C.red }}>
                {p.is_deleted ? "삭제됨" : "삭제"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 라운지 시딩 탭 ────────────────────────────────────────
function LoungeSeedingTab({ seeds = [], loading = false, fetchErr = null, onReload }) {
  const [view,       setView]       = useState("list");
  const [editTarget, setEditTarget] = useState(null);
  const [form,       setForm]       = useState(BLANK_LOUNGE_SEED);
  const [images,     setImages]     = useState([]);
  const [saving,     setSaving]     = useState(false);
  const [saveErr,    setSaveErr]    = useState(null);
  const [uploading,  setUploading]  = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const catLabel = (id) => SEED_CATEGORIES.find(c => c.id === id)?.label ?? id;

  const openCreate = () => {
    setEditTarget(null);
    setForm(BLANK_LOUNGE_SEED);
    setImages([]);
    setSaveErr(null);
    setView("form");
  };

  const openEdit = (s) => {
    setEditTarget(s);
    setForm({
      category: s.category ?? 'interior',
      seed_type: s.seed_type ?? '운영',
      title: s.title ?? '',
      content: s.content,
      region: s.region ?? '',
      author_name: s.author_name ?? '공간마켓',
      expert_company_name: s.expert_company_name ?? '',
      expert_badge: s.expert_badge ?? '',
      expert_job: s.expert_job ?? '',
      sort_order: s.sort_order ?? 0,
      is_recommended: s.is_recommended ?? false,
      is_active: s.is_active ?? true,
    });
    setImages(Array.isArray(s.image_urls) ? s.image_urls : []);
    setSaveErr(null);
    setView("form");
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { data, error } = await uploadSeedLoungeImage(file);
    if (error) setSaveErr("이미지 업로드 실패: " + error.message);
    else setImages(prev => [...prev, data.publicUrl]);
    setUploading(false);
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!form.content.trim()) { setSaveErr("내용을 입력하세요"); return; }
    setSaving(true);
    setSaveErr(null);
    const isExpert = !!SEED_TYPES.find(t => t.id === form.seed_type)?.expert;
    const payload = {
      category:            form.category,
      seed_type:           form.seed_type || '운영',
      title:               form.title,
      content:             form.content,
      region:              form.region?.trim() || null,
      author_name:         form.author_name?.trim() || '공간마켓',
      image_urls:          images,
      sort_order:          Number(form.sort_order) || 0,
      is_recommended:      !!form.is_recommended,
      is_active:           !!form.is_active,
      is_expert:           isExpert,
      expert_company_name: isExpert ? (form.expert_company_name?.trim() || null) : null,
      expert_badge:        isExpert ? (form.expert_badge?.trim() || null) : null,
      expert_job:          isExpert ? (form.expert_job?.trim() || null) : null,
    };
    const { error } = editTarget
      ? await updateSeedLoungePost(editTarget.id, payload)
      : await createSeedLoungePost(payload);
    if (error) { setSaveErr(error.message); setSaving(false); return; }
    setSaving(false);
    setView("list");
    onReload?.();
  };

  const handleToggleActive = async (s) => {
    if (togglingId) return;
    setTogglingId(s.id);
    await updateSeedLoungePost(s.id, { is_active: !s.is_active });
    setTogglingId(null);
    onReload?.();
  };

  const handleDelete = async (s) => {
    if (deletingId) return;
    setDeletingId(s.id);
    await deleteSeedLoungePost(s.id);
    setDeletingId(null);
    onReload?.();
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: S.lg }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>🌱 라운지 시딩 관리</div>
        {view === "list" ? (
          <button onClick={openCreate}
            style={{ padding: "8px 16px", background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            + 새 시딩 글
          </button>
        ) : (
          <button onClick={() => setView("list")}
            style={{ padding: "8px 16px", background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            ← 목록
          </button>
        )}
      </div>

      {view === "list" && (
        <div style={{ background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}` }}>
          {fetchErr && (
            <div style={{ background: "#FFF0F0", border: `1px solid ${C.red}33`, borderRadius: R.lg, padding: S.md, marginBottom: S.md }}>
              <div style={{ fontSize: 12, color: C.red, fontWeight: 700 }}>⚠️ seed_lounge_posts 로드 실패</div>
              <div style={{ fontSize: 11, color: C.red, marginTop: 4, opacity: 0.8 }}>{fetchErr}</div>
              {import.meta.env.DEV && <div style={{ fontSize: 10, color: C.text4, marginTop: 4 }}>테이블 미생성 시 supabase/migrations/004_seed_lounge_posts.sql 실행 필요</div>}
            </div>
          )}
          {loading ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: C.text3, fontSize: 13 }}>불러오는 중...</div>
          ) : seeds.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🌱</div>
              <div style={{ fontSize: 14, color: C.text3 }}>등록된 시딩 게시글이 없습니다</div>
              <div style={{ fontSize: 12, color: C.text4, marginTop: 6 }}>위 버튼을 눌러 첫 글을 등록하세요</div>
            </div>
          ) : seeds.map(s => (
            <div key={s.id} style={{ display: "flex", gap: S.sm, alignItems: "flex-start", padding: `${S.sm}px 0`, borderBottom: `1px solid ${C.bg}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: S.xs, alignItems: "center", marginBottom: 3, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: C.brand, background: C.brandL, borderRadius: R.sm, padding: "1px 7px" }}>
                    {catLabel(s.category)}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: s.is_active ? "#27AE60" : C.text4 }}>
                    {s.is_active ? "활성" : "숨김"}
                  </span>
                  {s.is_recommended && <span style={{ fontSize: 10, fontWeight: 700, color: "#8A6D2A", background: "#C4A96A22", border: "1px solid #C4A96A", borderRadius: R.sm, padding: "0 5px" }}>추천</span>}
                  {s.seed_type && s.seed_type !== '운영' && <span style={{ fontSize: 10, color: C.text3 }}>· {s.seed_type}</span>}
                  {s.region && <span style={{ fontSize: 10, color: C.text4 }}>· {s.region}</span>}
                  <span style={{ fontSize: 10, color: C.text4 }}>순서:{s.sort_order}</span>
                </div>
                {s.title && <div style={{ fontSize: 12, fontWeight: 700, color: C.text1, marginBottom: 2 }}>{s.title}</div>}
                <div style={{ fontSize: 11, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {(s.content ?? '').slice(0, 60)}{(s.content ?? '').length > 60 ? "…" : ""}
                </div>
                <div style={{ fontSize: 10, color: C.text4, marginTop: 2 }}>by {s.author_name}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                <button onClick={() => openEdit(s)}
                  style={{ padding: "4px 10px", background: C.brandL, color: C.brand, border: "none", borderRadius: R.sm, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>수정</button>
                <button onClick={() => handleToggleActive(s)} disabled={!!togglingId}
                  style={{ padding: "4px 10px", background: s.is_active ? "#FEF0F0" : "#EAF7EE", color: s.is_active ? C.red : "#27AE60", border: "none", borderRadius: R.sm, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {s.is_active ? "비활성" : "활성"}
                </button>
                <button onClick={() => handleDelete(s)} disabled={!!deletingId}
                  style={{ padding: "4px 10px", background: "#FEF0F0", color: C.red, border: "none", borderRadius: R.sm, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {deletingId === s.id ? "…" : "삭제"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "form" && (
        <div style={{ background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}` }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: S.lg }}>
            {editTarget ? "시딩 글 수정" : "새 시딩 글 등록"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: S.md }}>
            {/* 작성 가이드(⑦) — 화면에 'SEO' 미노출 */}
            <div style={{ background: C.brandL, border: `1px solid ${C.brandM}`, borderRadius: R.md, padding: `${S.sm}px ${S.md}px` }}>
              <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.6 }}>💡 {SEED_WRITE_GUIDE}</div>
              <div style={{ fontSize: 11, color: C.text3, marginTop: 4, lineHeight: 1.6 }}>
                예) {SEED_TITLE_EXAMPLES.join(' / ')}
              </div>
            </div>

            <div style={{ display: "flex", gap: S.sm }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>카테고리</div>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit" }}>
                  {SEED_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>글 유형 (작성자)</div>
                <select value={form.seed_type} onChange={e => setForm(f => ({ ...f, seed_type: e.target.value }))}
                  style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit" }}>
                  {SEED_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
            </div>
            {SEED_TYPE_HINTS[form.category] && (
              <div style={{ fontSize: 11, color: C.text3, marginTop: -4, lineHeight: 1.6 }}>
                추천 소재: {SEED_TYPE_HINTS[form.category]}
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>제목 (선택)</div>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="제목 없으면 비워두세요"
                style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>내용 *</div>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="게시글 내용을 입력하세요" rows={6}
                style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: S.sm }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>지역 (선택)</div>
                <input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                  placeholder="예: 부천시, 강서구"
                  style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>작성자 표시명</div>
                <input value={form.author_name} onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))}
                  placeholder="공간마켓"
                  style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
            </div>

            {/* 업체/전문가 유형일 때만 전문가 표시 확장 필드 노출 */}
            {!!SEED_TYPES.find(t => t.id === form.seed_type)?.expert && (
              <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>업체/전문가명</div>
                  <input value={form.expert_company_name} onChange={e => setForm(f => ({ ...f, expert_company_name: e.target.value }))}
                    placeholder="예: 공간사이 인테리어"
                    style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>배지 (선택)</div>
                  <input value={form.expert_badge} onChange={e => setForm(f => ({ ...f, expert_badge: e.target.value }))}
                    placeholder="예: 공간사이 추천"
                    style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 1, minWidth: 100 }}>
                  <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>직군/업종 (선택)</div>
                  <input value={form.expert_job} onChange={e => setForm(f => ({ ...f, expert_job: e.target.value }))}
                    placeholder="예: 욕실 전문"
                    style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit", boxSizing: "border-box" }} />
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>노출 순서 (낮을수록 먼저)</div>
              <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: S.xs, cursor: "pointer", fontSize: 13, color: C.text1 }}>
              <input type="checkbox" checked={form.is_recommended} onChange={e => setForm(f => ({ ...f, is_recommended: e.target.checked }))} />
              추천글 (피드 상단 우선 노출 · 순서와 별개)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: S.xs, cursor: "pointer", fontSize: 13, color: C.text1 }}>
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
              활성 (라운지에 노출) · 끄면 숨김
            </label>
            <div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>이미지 ({images.length}개)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: S.xs, marginBottom: S.xs }}>
                {images.map((url, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <img src={url} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: R.sm, border: `1px solid ${C.bgWarm}` }} />
                    <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                      style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: C.red, color: "#fff", border: "none", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>×</button>
                  </div>
                ))}
              </div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: S.xs, padding: "8px 14px", background: C.bg, borderRadius: R.lg, fontSize: 12, color: C.text2, cursor: uploading ? "not-allowed" : "pointer", border: `1px solid ${C.bgWarm}` }}>
                {uploading ? "업로드 중..." : "📷 이미지 추가"}
                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} style={{ display: "none" }} />
              </label>
            </div>
            {/* 미리보기(⑪) — 사용자 피드 카드 형태로 확인 */}
            <div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>미리보기</div>
              <div style={{ background: C.bg, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: S.md }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: C.brand, background: C.brandL, borderRadius: R.sm, padding: "1px 7px" }}>{catLabel(form.category)}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: C.text3, background: C.surface2, borderRadius: R.sm, padding: "1px 7px" }}>운영</span>
                  {form.is_recommended && <span style={{ fontSize: 10, fontWeight: 700, color: "#8A6D2A", background: "#C4A96A22", border: "1px solid #C4A96A", borderRadius: R.sm, padding: "1px 7px" }}>추천</span>}
                  {!!SEED_TYPES.find(t => t.id === form.seed_type)?.expert && <span style={{ fontSize: 10, fontWeight: 700, color: "#8A6D2A", background: "#C4A96A22", border: "1px solid #C4A96A", borderRadius: R.sm, padding: "1px 7px" }}>전문가</span>}
                  {form.region?.trim() && <span style={{ fontSize: 10, color: C.text4 }}>· {form.region.trim()}</span>}
                </div>
                {form.title?.trim() && <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: 2 }}>{form.title.trim()}</div>}
                <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.5, whiteSpace: "pre-wrap", maxHeight: 60, overflow: "hidden" }}>{(form.content ?? '').trim() || '내용 미리보기'}</div>
                <div style={{ fontSize: 10, color: C.text4, marginTop: 4 }}>
                  by {form.author_name?.trim() || '공간마켓'}
                  {!!SEED_TYPES.find(t => t.id === form.seed_type)?.expert && form.expert_company_name?.trim() && ` · ${form.expert_company_name.trim()}`}
                  {!!SEED_TYPES.find(t => t.id === form.seed_type)?.expert && form.expert_badge?.trim() && ` · ${form.expert_badge.trim()}`}
                </div>
              </div>
            </div>
            {saveErr && <div style={{ fontSize: 12, color: C.red, background: "#FEF0F0", borderRadius: R.sm, padding: S.sm }}>{saveErr}</div>}
            <button onClick={handleSave} disabled={saving}
              style={{ padding: "13px", background: saving ? C.text4 : C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 14, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "저장 중..." : editTarget ? "수정 완료" : "등록하기"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const PAYMENT_STATUS_META = {
  PENDING:   { label: "결제대기", color: C.gold,    bg: "#FBF5E8" },
  READY:     { label: "준비완료", color: C.brand,   bg: C.brandL  },
  PAID:      { label: "결제완료", color: "#27AE60", bg: "#EAF7EE" },
  FAILED:    { label: "결제실패", color: C.red,     bg: "#FFF0F0" },
  CANCELLED: { label: "취소",     color: C.text4,   bg: C.bg      },
  REFUNDED:  { label: "환불",     color: "#9B59B6", bg: "#F5EEF8" },
};

const PAYOUT_STATUS_META = {
  PENDING:       { label: "대기",     color: C.text4,   bg: C.bg      },
  READY:         { label: "지급준비", color: C.brand,   bg: C.brandL  },
  APPROVED:      { label: "승인",     color: "#27AE60", bg: "#EAF7EE" },
  HELD:          { label: "보류",     color: C.gold,    bg: "#FBF5E8" },
  PAID_MANUALLY: { label: "수동지급", color: "#9B59B6", bg: "#F5EEF8" },
  CANCELLED:     { label: "취소",     color: C.red,     bg: "#FFF0F0" },
};

const DISPUTE_STATUS_META = {
  DISPUTE_OPEN:     { label: "분쟁접수",     color: C.red,     bg: "#FFF0F0" },
  UNDER_REVIEW:     { label: "검토중",       color: C.gold,    bg: "#FBF5E8" },
  WAITING_CUSTOMER: { label: "고객답변대기", color: C.brand,   bg: C.brandL  },
  WAITING_COMPANY:  { label: "업체답변대기", color: "#9B59B6", bg: "#F5EEF8" },
  RESOLVED:         { label: "해결완료",     color: "#27AE60", bg: "#EAF7EE" },
  REFUNDED:         { label: "환불처리",     color: C.text4,   bg: C.bg      },
  PARTIAL_REFUND:   { label: "일부환불",     color: C.text3,   bg: C.bg      },
};

// ── 자동발행 OS(Phase 17.5) — 90점+ 검증 콘텐츠 자동 발행 운영 ──────────────
//   게이트 통과분을 3시간 슬롯에 예약(긴급은 즉시 발행)한다. 실제 발행/예약/롤백은 기존
//   adminUpdateLoungeDraft 를, 예약 발행 실행은 기존 예약발행 크론을 재사용한다(무수정).
function AutoPublishTab({ drafts = [], published = [], adminUserId, showToast, onReload }) {
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  void tick;
  const bump = () => setTick(t => t + 1);
  const catLabel = (id) => LOUNGE_CATEGORIES.find(c => c.id === id)?.label ?? id;

  const config = getAutoConfig();
  const wbIndex = workbenchIndex();
  const stages = getPipelineStages();
  const plan = planAutoPublish({ drafts, published, wbIndex, stages, config });
  const stats = autoPublishStats(published, drafts);
  const log = getPublishLog();

  const executors = {
    publish:  (id) => adminUpdateLoungeDraft(id, { publishStatus: "published" }, adminUserId),
    schedule: (id, iso) => adminUpdateLoungeDraft(id, { publishStatus: "scheduled", scheduledAt: iso }, adminUserId),
    revert:   (id) => adminUpdateLoungeDraft(id, { publishStatus: "draft" }, adminUserId),
  };

  const toggle = () => { const n = setAutoConfig({ enabled: !config.enabled }); showToast?.(n.enabled ? "🟢 자동발행 ON" : "⚪ 자동발행 OFF"); bump(); };

  const runNow = async () => {
    if (running) return;
    if (!config.enabled) { showToast?.("자동발행이 OFF 입니다 — 먼저 ON 하세요"); return; }
    setRunning(true);
    try {
      const res = await executeAutoPublishPlan(plan, executors, {});
      showToast?.(`⚙️ 긴급발행 ${res.published} · 예약 ${res.scheduledCount} · 실패 ${res.failed}`);
      res.alerts.forEach(a => showToast?.(a));
      await onReload?.();
    } catch (e) {
      showToast?.("자동발행 실행 실패: " + (e?.message ?? String(e)));
    } finally { setRunning(false); bump(); }
  };

  const box = { background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.xl };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: S.sm, marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>⚙️ 자동발행 OS (Production)</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={toggle}
            style={{ padding: "7px 16px", borderRadius: R.full, fontWeight: 800, fontSize: 12.5, cursor: "pointer", border: "none",
              background: config.enabled ? C.brand : C.text4, color: "#fff" }}>
            {config.enabled ? "🟢 ON" : "⚪ OFF"}
          </button>
          <button onClick={runNow} disabled={running || !config.enabled}
            style={{ padding: "7px 14px", background: running ? C.text4 : C.brandD, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
            {running ? "실행 중…" : "▶ 지금 자동발행 실행"}
          </button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: S.lg, lineHeight: 1.6 }}>
        Quality≥90 · Confidence≥90 · 금칙어/SEO/중복/AI검사/Review 를 모두 통과한 콘텐츠만 자동 발행합니다.
        게이트 통과분은 <b>3시간 슬롯</b>에 예약되고 기존 예약발행 크론이 발행합니다. 긴급 이슈(Priority High · Trend {config.emergencyTrendMin}+)는 즉시 발행합니다.
        하루 최대 {config.dailyLimit}개(긴급 제외).
      </div>

      {/* 9. Dashboard */}
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.lg }}>
        {[
          { k: "오늘 발행", v: stats.publishedToday }, { k: "예약", v: stats.scheduledCount },
          { k: "긴급발행", v: stats.emergencyToday }, { k: "평균점수", v: stats.avgScore ?? "-" },
          { k: "평균조회", v: stats.avgViews ?? "-" }, { k: "실패", v: stats.failures },
          { k: "성공률", v: stats.successRate != null ? stats.successRate + "%" : "-" }, { k: "오늘 사용/한도", v: `${stats.dailyUsed}/${config.dailyLimit}` },
        ].map(m => (
          <div key={m.k} style={{ flex: "1 1 90px", background: C.bg, borderRadius: R.lg, padding: "8px 11px", border: `1px solid ${C.bgWarm}` }}>
            <div style={{ fontSize: 10, color: C.text3 }}>{m.k}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text1 }}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* 긴급 + 예약 계획 */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.md }}>🚨 발행 계획 (게이트 통과분)</div>
        {plan.emergency.length === 0 && plan.scheduled.length === 0 ? (
          <div style={{ fontSize: 12, color: C.text3, padding: "8px 0" }}>지금 자동발행 조건(90점+)을 통과한 초안이 없습니다.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {plan.emergency.map(it => (
              <div key={it.draft.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, padding: "5px 0", borderBottom: `1px solid ${C.bg}`, flexWrap: "wrap" }}>
                <span style={{ padding: "1px 7px", borderRadius: R.full, fontSize: 9.5, fontWeight: 800, background: "#dc262622", color: "#dc2626" }}>긴급 즉시</span>
                <span style={{ fontWeight: 700, color: C.text1, flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.draft.title}</span>
                <span style={{ color: C.text3 }}>Q{it.gate.quality} · C{it.gate.confidence} · TS{it.cand.trendScore}</span>
              </div>
            ))}
            {plan.scheduled.map(it => (
              <div key={it.draft.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, padding: "5px 0", borderBottom: `1px solid ${C.bg}`, flexWrap: "wrap" }}>
                <span style={{ padding: "1px 7px", borderRadius: R.full, fontSize: 9.5, fontWeight: 800, background: "#7c3aed22", color: "#7c3aed" }}>
                  예약 {it.slot instanceof Date ? it.slot.toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit" }) : ""}
                </span>
                <span style={{ fontWeight: 700, color: C.text1, flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.draft.title}</span>
                <span style={{ color: C.text3 }}>{catLabel(it.draft.category)} · Q{it.gate.quality} · C{it.gate.confidence}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gate 미통과(스킵) — 사유 */}
      {plan.skipped.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.md }}>⛔ 게이트 미통과 ({plan.skipped.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {plan.skipped.slice(0, 12).map(s => (
              <div key={s.draft.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, padding: "3px 0", flexWrap: "wrap" }}>
                <span style={{ color: C.text2, fontWeight: 600, flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.draft.title}</span>
                <span style={{ color: C.red, fontSize: 10 }}>{s.gate.reasons.join(" · ")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Publish Log */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.md }}>🧾 발행 로그 ({log.length})</div>
        {log.length === 0 ? <div style={{ fontSize: 12, color: C.text3, padding: "8px 0" }}>아직 자동발행 기록이 없습니다.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {log.slice(0, 20).map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, padding: "3px 0", borderBottom: `1px solid ${C.bg}`, flexWrap: "wrap" }}>
                <span style={{ color: C.text4, minWidth: 92 }}>{new Date(e.at).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                <span style={{ padding: "1px 6px", borderRadius: R.full, fontSize: 9, fontWeight: 800,
                  background: e.status === "published" ? "#05966922" : e.status === "scheduled" ? "#7c3aed22" : e.status === "failed" ? "#dc262622" : "#6b728022",
                  color: e.status === "published" ? "#059669" : e.status === "scheduled" ? "#7c3aed" : e.status === "failed" ? "#dc2626" : "#6b7280" }}>
                  {e.mode}·{e.status}
                </span>
                <span style={{ color: C.text1, flex: 1, minWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
                {e.quality != null && <span style={{ color: C.text3 }}>Q{e.quality}{e.confidence != null ? `·C${e.confidence}` : ""}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 발행 우선순위(Phase 22) — P1 긴급 / P2 Trending / P3 예약(Evergreen) + ⭐ 연재 ──────
//   순수 편성 엔진(publishingPriority). 실제 발행은 기존 발행 흐름/크론 재사용(여기서는 편성/시각화만).
function PublishingPriorityTab({ drafts = [], published = [] }) {
  const [tick, setTick] = useState(0); void tick;
  const config = getPriorityConfig();
  const plan = buildDailyPlan({ drafts, published, config, storyReady: false });
  const mix = targetMix();
  const setRatio = (p) => { setPriorityConfig({ evergreen: p.evergreen, breaking: p.breaking }); setTick(t => t + 1); };
  const lvColor = { P1: "#dc2626", P2: "#d97706", P3: "#2563eb", Story: "#7c3aed" };

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: 4 }}>🗞️ 발행 우선순위 (Editorial OS)</div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: S.lg, lineHeight: 1.6 }}>
        예약 발행만 하지 않습니다. 긴급 뉴스(P1) → Trending(P2) → 예약·Evergreen(P3) 순으로 하루 {config.dailyTotal}개를 편성합니다.
        긴급 뉴스가 없으면 예약 글만 발행합니다. 지향점: <b>속도 {mix.breaking}% · Evergreen {mix.evergreen}% · 연재 {mix.story}%</b>.
      </div>

      {/* 비율 설정 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: S.lg }}>
        <span style={{ fontSize: 12, color: C.text2, fontWeight: 700 }}>Evergreen:Breaking 비율</span>
        {RATIO_PRESETS.map(p => (
          <button key={p.id} onClick={() => setRatio(p)}
            style={{ padding: "5px 11px", borderRadius: R.full, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
              background: config.evergreen === p.evergreen && config.breaking === p.breaking ? C.brand : "#fff",
              color: config.evergreen === p.evergreen && config.breaking === p.breaking ? "#fff" : C.text2,
              border: `1px solid ${config.evergreen === p.evergreen && config.breaking === p.breaking ? C.brand : C.bgWarm}` }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* 요약 */}
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.lg }}>
        {[
          { k: "긴급 편성", v: plan.breakingPlanned }, { k: "Evergreen 편성", v: plan.evergreenPlanned },
          { k: "연재", v: plan.storyPlanned }, { k: "긴급 후보", v: plan.breakingAvailable },
          { k: "하루 총량", v: plan.dailyTotal },
        ].map(m => (
          <div key={m.k} style={{ flex: "1 1 90px", background: C.bg, borderRadius: R.lg, padding: "8px 11px", border: `1px solid ${C.bgWarm}` }}>
            <div style={{ fontSize: 10, color: C.text3 }}>{m.k}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: C.text1 }}>{m.v}</div>
          </div>
        ))}
      </div>

      {!plan.hasBreaking && (
        <div style={{ fontSize: 11.5, color: C.text3, background: C.bg, borderRadius: R.md, padding: "8px 11px", marginBottom: S.md }}>
          ⚡ 지금 긴급 뉴스 후보가 없습니다 — 예약·Evergreen 글로 편성합니다.
        </div>
      )}

      {/* 오늘의 편성 */}
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>📋 오늘의 발행 편성 (비율 {plan.ratioLabel})</div>
      {plan.slots.length === 0 ? (
        <div style={{ fontSize: 12, color: C.text3, padding: 16, textAlign: "center" }}>편성할 초안이 없습니다. 트렌드 발굴/공장에서 초안을 만들어 주세요.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {plan.slots.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "7px 10px", background: "#fff", border: `1px solid ${C.bgWarm}`, borderRadius: R.md, flexWrap: "wrap" }}>
              <span style={{ padding: "2px 8px", borderRadius: R.full, fontSize: 10, fontWeight: 800, background: (lvColor[s.level] || "#6b7280") + "22", color: lvColor[s.level] || "#6b7280" }}>{s.level} · {s.label}</span>
              <span style={{ fontWeight: 700, color: C.text1, flex: 1, minWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.item?.title || "연재 다음 화 (Story Engine 준비 시 자동 편성)"}</span>
              {s.item && <span style={{ color: C.text3, fontSize: 10 }}>{s.item.categoryLabel}{s.item.trendScore ? ` · TS${s.item.trendScore}` : ""}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AI 트렌드 발굴(Phase 14) — 기획 AI: "무엇을 쓸지" 먼저 판단 ──────────────
//   생성 엔진 무수정. Mock 트렌드 → 점수/우선순위/다양성 계산 → Draft 생성/Review 보내기.
//   생성은 기존 generateForWorkbench, 저장은 기존 adminCreateLoungeDraft, 스테이지는 기존
//   setPipelineStage 를 재사용한다(전부 호출만). 실제 뉴스/Trends API 는 provider 교체로 확장.
function TrendDiscoveryTab({ published = [], adminUserId, showToast, onReload }) {
  const [seed, setSeed] = useState(0);
  const [busyTopic, setBusyTopic] = useState(null);
  const catLabel = (id) => LOUNGE_CATEGORIES.find(c => c.id === id)?.label ?? id;

  const candidates = discoverTrendingTopics({ recentPublished: published, limit: 10, seed });
  const summary = trendSummary(candidates);
  const prioColor = { High: "#dc2626", Medium: "#d97706", Low: "#6b7280" };

  const makeDraft = async (cand, sendReview) => {
    if (busyTopic) return;
    setBusyTopic(cand.topic);
    try {
      const wb = await generateForWorkbench(
        { issue: cand.topic, category: cand.category, mode: "voice", promptVersion: "v1", temperature: 0.85 },
        { existing: published.filter(p => p.title).map(p => ({ title: p.title })) }
      );
      // Phase 20.6 — 실제 LLM 실패/미설정 시 Mock 생성하지 않고 중단.
      if (wb.error || !wb.result) { showToast?.(wb.error || "LLM 생성 실패"); return; }
      const { data, error } = await adminCreateLoungeDraft(
        { category: wb.result.category, title: wb.result.title, content: wb.result.body, aiTopic: cand.topic, publishStatus: "draft" },
        adminUserId
      );
      if (error) { showToast?.("초안 저장 실패: " + error.message); return; }
      saveWorkbenchRecord({ result: wb.result, meta: wb.meta }); // Confidence/Editorial/토큰 파이프라인 표시용
      if (sendReview && data?.id != null) setPipelineStage(data.id, "review");
      showToast?.(sendReview ? "🔎 Review 로 보냈습니다" : `📝 초안 생성됨 (LLM · Conf ${wb.meta.confidence}%)`);
      onReload?.();
    } catch (e) {
      showToast?.("생성 실패: " + (e?.message ?? String(e)));
    } finally {
      setBusyTopic(null);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: S.sm, marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>🧭 AI 트렌드 발굴 (기획 AI)</div>
        <button onClick={() => setSeed(s => s + 1)}
          style={{ padding: "7px 14px", background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
          🔄 추천 새로 찾기
        </button>
      </div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: S.md, lineHeight: 1.6 }}>
        AI 가 <b>무엇을 써야 하는지</b> 먼저 판단합니다. 트렌드 점수·카테고리 다양성·최근 발행 기록을 고려해 발행 우선순위를 추천합니다.
        (현재 Mock 데이터 — 향후 Google Trends / News / RSS 로 provider 교체 가능)
      </div>

      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.lg }}>
        {[
          { k: "High", v: summary.High, c: prioColor.High }, { k: "Medium", v: summary.Medium, c: prioColor.Medium },
          { k: "Low", v: summary.Low, c: prioColor.Low }, { k: "카테고리 다양성", v: summary.categoryDiversity, c: C.brandD },
        ].map(m => (
          <div key={m.k} style={{ flex: "1 1 90px", background: C.bg, borderRadius: R.lg, padding: "8px 11px", border: `1px solid ${C.bgWarm}` }}>
            <div style={{ fontSize: 10.5, color: C.text3 }}>{m.k}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: m.c }}>{m.v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
        {candidates.map((c) => (
          <div key={c.topic} style={{ background: "#fff", borderRadius: R.lg, border: `1px solid ${C.bgWarm}`, padding: S.md }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ padding: "2px 9px", borderRadius: R.full, fontSize: 10, fontWeight: 800, background: prioColor[c.priority] + "22", color: prioColor[c.priority] }}>{c.priority}</span>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: C.text1, flex: 1, minWidth: 160 }}>{c.topic}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: c.trendScore >= 75 ? C.brand : C.gold }}>{c.trendScore}</span>
            </div>
            <div style={{ fontSize: 11, color: C.text3, marginBottom: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: C.brand, fontWeight: 700 }}>{catLabel(c.category)}</span>
              <span>· 예상 조회 ~{c.estimatedInterest.toLocaleString()}</span>
              <span>· {c.publishRecommendation}</span>
            </div>
            <div style={{ fontSize: 11, color: C.text2, marginBottom: 6 }}>💡 {c.reason}</div>
            {c.keywords.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                {c.keywords.map(k => <span key={k} style={{ fontSize: 10, background: C.brandL, color: C.brandD, borderRadius: R.full, padding: "2px 8px" }}>{k}</span>)}
              </div>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => makeDraft(c, false)} disabled={busyTopic === c.topic}
                style={{ padding: "6px 12px", background: busyTopic === c.topic ? C.text4 : C.brandD, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>
                {busyTopic === c.topic ? "생성 중…" : "✍️ Draft 생성"}
              </button>
              <button onClick={() => makeDraft(c, true)} disabled={busyTopic === c.topic}
                style={{ padding: "6px 12px", background: C.bg, color: C.brandD, border: `1px solid ${C.brandM}`, borderRadius: R.md, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>
                🔎 Review 보내기
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI 발행 파이프라인(Phase 13) — 생성→검토→승인→발행→추천 운영 ──────────────
//   생성 엔진 무수정. 기존 supabase 함수(adminUpdateLoungeDraft/Delete)와 기존 예약발행 크론을
//   재사용한다. Review/Approved 하위 상태는 localStorage(publishingPipeline)에 얹는다.
function PublishingPipelineTab({ drafts = [], published = [], loading = false, adminUserId, showToast, onReload }) {
  const [tick, setTick] = useState(0);         // localStorage 스테이지 변경 후 강제 리렌더
  const [scheduleFor, setScheduleFor] = useState({}); // { [id]: 'YYYY-MM-DDTHH:mm' }
  const [busy, setBusy] = useState(false);

  const wbIndex = workbenchIndex();
  const stages = getPipelineStages();
  const { board } = buildDraftBoard(drafts, wbIndex, stages); // eslint-disable-line no-unused-vars
  const history = publishHistory(published);
  const popular = popularContent(published);
  const pick = todaysPick(published, wbIndex);
  const stats = opsStats(drafts, published, wbIndex);
  const catLabel = (id) => LOUNGE_CATEGORIES.find(c => c.id === id)?.label ?? id;
  void tick;

  const bump = () => setTick(t => t + 1);
  const moveStage = (id, stage) => { setPipelineStage(id, stage); bump(); showToast?.(stage === "review" ? "🔎 검토로 이동" : "✅ 승인됨"); };
  const doPublish = async (id) => {
    if (busy) return; setBusy(true);
    const { error } = await adminUpdateLoungeDraft(id, { publishStatus: "published" }, adminUserId);
    setBusy(false);
    if (error) { showToast?.("발행 실패: " + error.message); return; }
    clearPipelineStage(id); showToast?.("🚀 발행됐습니다"); onReload?.();
  };
  const doSchedule = async (id) => {
    const when = scheduleFor[id];
    if (!when) { showToast?.("예약 일시를 선택하세요"); return; }
    if (busy) return; setBusy(true);
    const { error } = await adminUpdateLoungeDraft(id, { publishStatus: "scheduled", scheduledAt: new Date(when).toISOString() }, adminUserId);
    setBusy(false);
    if (error) { showToast?.("예약 실패: " + error.message); return; }
    showToast?.("⏰ 예약 발행 설정됨(기존 크론이 시각 도래 시 발행)"); onReload?.();
  };
  const doDelete = async (id) => {
    if (busy) return; setBusy(true);
    const { error } = await adminDeleteLoungeDraft(id, adminUserId);
    setBusy(false);
    if (error) { showToast?.("삭제 실패: " + error.message); return; }
    clearPipelineStage(id); onReload?.();
  };

  const stageColor = Object.fromEntries(PIPELINE_STAGES.map(s => [s.id, s.color]));
  const box = { background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.xl };
  const chip = (bg, color) => ({ padding: "2px 8px", borderRadius: R.full, fontSize: 10, fontWeight: 800, background: bg, color });

  const DraftCard = ({ r }) => (
    <div style={{ background: C.bg, borderRadius: R.md, border: `1px solid ${C.bgWarm}`, padding: "8px 10px", marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={chip(stageColor[r.stage] + "22", stageColor[r.stage])}>{r.stage}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text1, flex: 1, minWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
        {r.confidence != null && <span style={{ fontSize: 10, fontWeight: 800, color: r.confidence >= 80 ? C.brand : C.gold }}>{r.confidence}%</span>}
      </div>
      <div style={{ fontSize: 9.5, color: C.text3, marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span style={{ color: C.brand }}>{catLabel(r.category)}</span>
        <span>· {r.readingMinutes}분</span>
        {r.source && <span>· {r.source === "llm" ? "LLM" : "Mock"}{r.promptVersion ? `·${r.promptVersion}` : ""}</span>}
        {r.createdAt && <span>· {new Date(r.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</span>}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
        {r.stage === "draft" && <button onClick={() => moveStage(r.id, "review")} style={btn(C.gold)}>검토</button>}
        {r.stage === "review" && <button onClick={() => moveStage(r.id, "approved")} style={btn("#2563eb")}>승인</button>}
        {(r.stage === "approved" || r.stage === "review" || r.stage === "draft") && <button onClick={() => doPublish(r.id)} style={btn(C.brand)}>발행</button>}
        <input type="datetime-local" value={scheduleFor[r.id] ?? ""} onChange={e => setScheduleFor(s => ({ ...s, [r.id]: e.target.value }))}
          style={{ fontSize: 10, padding: "2px 4px", border: `1px solid ${C.bgWarm}`, borderRadius: R.sm }} />
        <button onClick={() => doSchedule(r.id)} style={btn("#7c3aed")}>예약</button>
        <button onClick={() => doDelete(r.id)} style={btn(C.text4)}>삭제</button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: 4 }}>🚀 AI 발행 파이프라인</div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: S.lg, lineHeight: 1.6 }}>
        생성된 초안을 <b>Draft → Review → Approved → Published</b> 로 운영합니다. 발행/예약은 기존 발행 흐름과
        예약발행 크론을 그대로 사용하며(자동 발행 없음), Review/Approved 상태는 이 브라우저에 저장됩니다.
      </div>

      {/* 7. 운영 통계 */}
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.lg }}>
        {[
          { k: "Draft", v: stats.draftCount }, { k: "Published", v: stats.publishedCount },
          { k: "오늘 생성", v: stats.todayCreated }, { k: "오늘 발행", v: stats.todayPublished },
          { k: "평균 Confidence", v: stats.avgConfidence != null ? stats.avgConfidence + "%" : "-" },
          { k: "평균 Reading", v: stats.avgReadingMinutes + "분" },
        ].map(m => (
          <div key={m.k} style={{ flex: "1 1 100px", background: C.brandL, borderRadius: R.lg, padding: "10px 12px", border: `1px solid ${C.brandM}` }}>
            <div style={{ fontSize: 10.5, color: C.text3 }}>{m.k}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.brandD }}>{m.v}</div>
          </div>
        ))}
      </div>

      {/* 6. Today's Pick */}
      {pick && (
        <div style={{ ...box, background: "linear-gradient(135deg, #0f2e26, #1a4a3c)", border: "none", color: "#fff", padding: S.lg }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#ffd7a0", marginBottom: 3 }}>⭐ TODAY'S PICK</div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{pick.post.title}</div>
          <div style={{ fontSize: 11, color: "#a9c9bd", marginTop: 4 }}>{catLabel(pick.post.category)} · 종합점수 {pick.score} · Community {pick.community} · Confidence {pick.confidence}% · 조회 {pick.post.view_count ?? 0}</div>
        </div>
      )}

      {/* 1~3. 초안 보드 */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.md }}>📋 초안 보드 (검토 → 승인 → 발행/예약)</div>
        {loading ? <div style={{ textAlign: "center", padding: 30, color: C.text3 }}>불러오는 중…</div> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: S.md }}>
            {[["draft", "Draft"], ["review", "Review"], ["approved", "Approved"], ["scheduled", "Scheduled"]].map(([id, lbl]) => (
              <div key={id}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: stageColor[id], marginBottom: 6 }}>{lbl} ({board[id].length})</div>
                {board[id].length === 0 ? <div style={{ fontSize: 11, color: C.text4, padding: "8px 0" }}>없음</div> : board[id].map(r => <DraftCard key={r.id} r={r} />)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. 인기 콘텐츠 */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.md }}>🔥 인기 콘텐츠 (자동 계산)</div>
        <div style={{ display: "flex", gap: S.lg, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 240px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: C.brand, marginBottom: 5 }}>✨ Editor's Pick</div>
            <div style={{ fontSize: 12, color: C.text1 }}>{popular.editorsPick?.title ?? "-"}</div>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: C.pinkD, margin: "10px 0 5px" }}>📈 상승</div>
            {popular.rising.slice(0, 4).map(p => <div key={p.id} style={{ fontSize: 11, color: C.text2, padding: "1px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {p.title}</div>)}
          </div>
          <div style={{ flex: "1 1 240px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: C.text1, marginBottom: 5 }}>👍 인기</div>
            {popular.popular.slice(0, 5).map(p => <div key={p.id} style={{ fontSize: 11, color: C.text2, padding: "1px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {p.title} <span style={{ color: C.text3 }}>({p._c.engagementScore})</span></div>)}
          </div>
        </div>
      </div>

      {/* 4. 발행 히스토리 */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.md }}>🗂️ 발행 히스토리 ({history.length})</div>
        {history.length === 0 ? <div style={{ fontSize: 12, color: C.text3, textAlign: "center", padding: 20 }}>발행된 AI 콘텐츠가 없습니다</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {history.slice(0, 20).map(h => (
              <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, padding: "5px 0", borderBottom: `1px solid ${C.bg}`, flexWrap: "wrap" }}>
                <span style={{ color: C.text1, fontWeight: 600, flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title}</span>
                <span style={{ color: C.brand }}>{h.categoryLabel}</span>
                <span style={{ color: C.text3 }}>👁 {h.views} · ❤ {h.likes} · 🔖 {h.saves}</span>
                {h.publishedAt && <span style={{ color: C.text4 }}>{new Date(h.publishedAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function btn(bg) {
  return { padding: "3px 9px", background: bg, color: "#fff", border: "none", borderRadius: R.sm, fontSize: 10, fontWeight: 700, cursor: "pointer" };
}

// ── LLM Usage Dashboard(Phase 20.7) — 워크벤치 생성 기록(localStorage) 집계 표시 ─────
//   오늘/이번주/이번달/누적 × 요청·성공률·재생성·평균응답·토큰·비용(KRW)·Editorial·Confidence·
//   Editor's Pick 비율. DB/API/Cron 없음(usageStats 호출만). 회귀 없음.
function UsageDashboardPanel({ C, S, R }) {
  const [range, setRange] = useState("today");
  const st = useMemo(() => usageStats(range), [range]);
  const RANGES = [["today", "오늘"], ["week", "이번주"], ["month", "이번달"], ["all", "누적"]];
  const cell = (label, value, sub) => (
    <div style={{ background: "#fff", borderRadius: R.md, padding: "8px 10px", border: `1px solid ${C.bgWarm}` }}>
      <div style={{ fontSize: 9.5, color: C.text3, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>{value}</div>
      {sub != null && <div style={{ fontSize: 9, color: C.text3, marginTop: 1 }}>{sub}</div>}
    </div>
  );
  return (
    <div style={{ background: C.bg, borderRadius: R.xl, padding: S.lg, border: `1px solid ${C.bgWarm}`, marginBottom: S.xl }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: S.sm, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>📊 LLM Usage Dashboard</div>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {RANGES.map(([id, lb]) => (
            <button key={id} onClick={() => setRange(id)}
              style={{ padding: "3px 10px", borderRadius: R.full, fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                border: `1px solid ${range === id ? C.brand : C.bgWarm}`, background: range === id ? C.brand : "#fff", color: range === id ? "#fff" : C.text3 }}>
              {lb}
            </button>
          ))}
        </div>
      </div>
      {st.requests === 0 ? (
        <div style={{ fontSize: 11, color: C.text3, padding: "6px 2px" }}>아직 생성 기록이 없습니다. 초안을 생성하면 사용량·비용·품질이 집계됩니다.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 6 }}>
          {cell("총 요청", `${st.requests}회`, `성공 ${st.success} · 실패 ${st.failed}`)}
          {cell("성공률", st.successRate != null ? `${st.successRate}%` : "—")}
          {cell("예상 비용", `₩${st.costKRW.toLocaleString()}`, `${st.totalTokens.toLocaleString()} tok`)}
          {cell("평균 응답", st.avgLatencyMs != null ? `${(st.avgLatencyMs / 1000).toFixed(1)}초` : "—")}
          {cell("Editorial", st.avgEditorialScore != null ? `${st.avgEditorialScore}점` : "—", `Pick ${st.editorsPickRatio != null ? st.editorsPickRatio + "%" : "—"}`)}
          {cell("Confidence", st.avgConfidence != null ? `${st.avgConfidence}%` : "—")}
          {cell("재생성", `${st.regen}회`)}
          {cell("토큰", st.totalTokens.toLocaleString(), `in ${st.promptTokens.toLocaleString()} · out ${st.completionTokens.toLocaleString()}`)}
        </div>
      )}
    </div>
  );
}

// ── AI 콘텐츠 공장(Phase 1) — Draft 생성 → 검수 → 예약/즉시 발행 ──────────────
//   lounge_posts.is_seed=true 재사용(신규 테이블 없음). 실제 발행은 관리자 승인 후에만
//   일어난다(베타 원칙: 자동 발행보다 Draft→승인→발행). 본문은 템플릿 기반(generateDraft) —
//   추후 Claude/OpenAI 연결 시 이 함수 내부만 교체하면 되는 구조.
function LoungeAiFactoryTab({ drafts = [], published = [], loading = false, fetchErr = null, adminUserId, showToast, onReload }) {
  const [presetId, setPresetId]     = useState(ISSUE_PRESETS[0].id);
  const [issue, setIssue]           = useState(ISSUE_PRESETS[0].issue);
  const [spaceAngle, setSpaceAngle] = useState(ISSUE_PRESETS[0].spaceAngle);
  const [region, setRegion]         = useState("");
  const [preview, setPreview]       = useState(null); // { title, content, category, tags }
  const [genMode, setGenMode]       = useState("auto"); // Phase 20.7: auto(AI 추천) 기본. voice/space/raw = 고급.
  const [autoStrat, setAutoStrat]   = useState(null);   // 자동모드가 선택한 전략(표시용)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [edCfg, setEdCfg]           = useState(() => getEditorialConfig()); // Phase 18 — 모델/temperature/maxTokens
  const [edGen, setEdGen]           = useState(false);
  const [edResult, setEdResult]     = useState(null); // { confidence, editorsPick, attempts, passed, draft }
  const [generating, setGenerating] = useState(false);   // Phase 10: LLM 생성 진행중
  // Phase 11 — AI Editor Workbench
  const [workbench, setWorkbench]   = useState(null);    // { result, meta, quality }
  const [promptVersion, setPromptVersion] = useState("v1");
  const [temperature, setTemperature] = useState(0.85);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showRaw, setShowRaw]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [scheduleFor, setScheduleFor] = useState({}); // { [id]: 'YYYY-MM-DDTHH:mm' }
  const [checkingTrends, setCheckingTrends] = useState(false);
  const [trendCheckResult, setTrendCheckResult] = useState(null);
  const [aiCheck, setAiCheck] = useState(null); // Phase 3 — 마지막 생성 전 AI 체크 결과(중복 방지)
  const [comments, setComments] = useState(null); // Phase 4 — 온디맨드 로드한 최근 댓글(인사이트용)
  const [loadingComments, setLoadingComments] = useState(false);
  const [searchQ, setSearchQ] = useState(""); // Phase 5 — Space Media 지식 검색 데모

  const catLabel = (id) => LOUNGE_CATEGORIES.find(c => c.id === id)?.label ?? id;

  const applyPreset = (id) => {
    const p = ISSUE_PRESETS.find(x => x.id === id);
    setPresetId(id);
    if (p) { setIssue(p.issue); setSpaceAngle(p.spaceAngle); }
  };

  // 1~4단계(이슈→기획→제목/구성→본문). Phase 8: 모드 3종.
  //   voice(카테고리 톤·억지 공간연결 제거) / space(기존 공간 관점 generateDraft) / raw(원석 지식).
  //   Phase 10: voice/raw 는 실제 LLM(옵트인) 로 생성하고, 미설정/실패 시 자동으로 기존 Mock 폴백.
  const handleGenerate = async () => {
    if (generating) return;
    if (!issue.trim()) { showToast?.("이슈를 입력하거나 프리셋을 선택하세요"); return; }
    const preset = ISSUE_PRESETS.find(p => p.id === presetId);

    // Phase 20.7 — 자동모드: AI 가 글 성격을 분석해 모드/버전/Temperature 를 자동 선택.
    let useMode = genMode, useVersion = promptVersion, useTemp = temperature, cat;
    if (genMode === "auto") {
      const strat = analyzeStrategy(issue.trim());
      setAutoStrat(strat);
      useMode = strat.mode; useVersion = strat.promptVersion; useTemp = strat.temperature; cat = strat.category;
    } else {
      setAutoStrat(null);
      cat = preset?.issue === issue.trim() ? preset.category : classifyCategory(`${issue} ${spaceAngle}`);
    }

    if (useMode === "space" && genMode !== "auto") {
      // 기존 수동 공간 관점 동작 보존(템플릿). 자동모드는 항상 LLM 경로를 탄다.
      setWorkbench(null);
      setPreview(generateDraft({ issue: issue.trim(), spaceAngle: spaceAngle.trim(), category: cat, region: region.trim() || null }));
      return;
    }
    // AI Editor Workbench(실제 LLM): 생성 결과 + 메타(프롬프트/모델/토큰/confidence/editorial) + Quality.
    setGenerating(true);
    try {
      const existing = [...drafts, ...published].filter(p => p.title).map(p => ({ title: p.title }));
      const wb = await generateForWorkbench(
        { issue: issue.trim(), category: cat, region: region.trim() || null, mode: useMode === "raw" ? "raw" : "voice", promptVersion: useVersion, temperature: useTemp },
        { existing }
      );
      // Phase 20.6 — Production: LLM 미설정/실패 시 Mock 생성하지 않고 명확히 안내.
      if (wb.error || !wb.result) { setWorkbench(null); showToast?.(wb.error || "LLM 생성 실패"); return; }
      setWorkbench(wb);
      setPreview({ title: wb.result.title, content: wb.result.body, category: wb.result.category, tags: wb.result.tags, summary: wb.result.summary, keywords: wb.result.keywords, focusKeyword: wb.result.focusKeyword, metaDescription: wb.result.metaDescription });
      showToast?.(`✨ LLM 생성 완료 · Confidence ${wb.meta.confidence}% · Editorial ${wb.meta.editorialScore}`);
    } catch (e) {
      showToast?.("생성 실패: " + (e?.message ?? String(e)));
    } finally {
      setGenerating(false);
    }
  };

  // 태그/키워드 편집 — 콤마 구분 문자열 ↔ 배열.
  const editArrayField = (field, str) => setPreview(p => ({ ...p, [field]: String(str).split(",").map(s => s.trim()).filter(Boolean) }));

  // Phase 8 — 미리보기 품질 분석(카테고리 톤 · 유용성 · 억지 공간연결). 두 생성 경로(모드/편집국) 모두 커버.
  const previewQuality = preview ? (() => {
    const v = voiceFor(preview.category, preview.title);
    const u = scoreUsefulness({ title: preview.title, content: preview.content, category: preview.category });
    const forced = detectForcedSpaceLinks(preview.content).length;
    const policyLabel = { natural: "자연스러움 허용", light: "가볍게만", none: "연결 강요 금지" }[v.spaceLinkPolicy] || v.spaceLinkPolicy;
    return { v, u, forced, policyLabel };
  })() : null;

  // Phase 18 — 실제 LLM(OpenRouter) Editorial 생성. Mock 없음: LLM 미설정/실패 시 초안 미생성.
  const updateEdCfg = (patch) => { const next = setEditorialConfig(patch); setEdCfg(next); };
  const handleEditorialGenerate = async () => {
    if (!issue.trim()) { showToast?.("주제(트렌드 제목)를 입력하세요"); return; }
    if (!isLLMConfigured()) { showToast?.("LLM 미설정(VITE_LLM_API_KEY 필요) — 실제 매거진 생성 불가"); return; }
    setEdGen(true); setEdResult(null);
    try {
      const r = await generateEditorial({
        topic: issue.trim(), region: region.trim() || null,
        model: edCfg.model, temperature: edCfg.temperature, maxTokens: edCfg.maxTokens, maxRetries: edCfg.maxRetries,
      });
      if (!r.ok) { showToast?.("생성 실패: " + (r.reason === "llm_not_configured" ? "LLM 미설정" : r.reason === "all_attempts_failed" ? "유효한 본문 생성 실패(재시도 초과)" : (r.reason || "error"))); }
      else if (String(r.draft.body).replace(/\s/g, "").length < 500) { showToast?.("본문이 너무 짧아 저장을 막았습니다 — 다시 시도하세요"); }
      else {
        setEdResult(r);
        // ⚠️ 저장 카테고리는 반드시 라운지 id 로 보정(편집 카테고리 한글 그대로 저장하면 필터/표시 깨짐).
        const loungeCat = resolveLoungeCategory(r.category, r.draft.title, r.draft.body);
        setPreview({ title: r.draft.title, content: r.draft.body, category: loungeCat, tags: r.draft.tags, summary: r.draft.summary, seo: r.draft.seo });
        showToast?.(`✨ ${r.verdict} · 종합 ${r.finalScore}점 · ${catLabel(loungeCat)} · 시도 ${r.attempts.length}회${r.human?.ai?.isStrong ? " · ⚠️AI티" : ""}`);
      }
    } catch (e) { showToast?.("오류: " + (e?.message ?? String(e))); }
    finally { setEdGen(false); }
  };

  // 6단계(초안 등록, DRAFT) — 관리자 검수 전 상태로 저장. 공개 피드에는 노출되지 않는다.
  const handleSaveDraft = async () => {
    if (!preview) return;
    setSaving(true);
    const { error } = await adminCreateLoungeDraft({
      category: preview.category, title: preview.title, content: preview.content,
      region: region.trim() || null, aiTopic: issue.trim(), publishStatus: "draft",
    }, adminUserId);
    setSaving(false);
    if (error) { showToast?.("초안 저장 실패: " + error.message); return; }
    // Phase 11 — 워크벤치 기록(prompt/model/temperature/tokens/latency/confidence/raw)을 로컬 보관.
    //   편집한 최종본을 저장(발행 draft 는 title/content/category 만 DB 로 감 — 스키마 변경 없음).
    if (workbench) {
      saveWorkbenchRecord({
        result: {
          title: preview.title, summary: preview.summary ?? "", body: preview.content,
          tags: preview.tags ?? [], keywords: preview.keywords ?? [], category: preview.category,
          tone: workbench.result.tone, readingMinutes: workbench.result.readingMinutes, relatedTopics: workbench.result.relatedTopics,
          focusKeyword: preview.focusKeyword ?? "", metaDescription: preview.metaDescription ?? "",
        },
        meta: workbench.meta,
      });
    }
    showToast?.("📝 초안이 등록됐습니다");
    setPreview(null);
    setWorkbench(null);
    onReload?.();
  };

  // 7→9단계(검수/수정 → 예약/즉시 발행) — 승인은 항상 관리자 조작으로만 발생(자동발행 없음, 베타 원칙).
  const handlePublishNow = async (id) => {
    const { error } = await adminUpdateLoungeDraft(id, { publishStatus: "published" }, adminUserId);
    if (error) { showToast?.("발행 실패: " + error.message); return; }
    showToast?.("🚀 발행됐습니다");
    onReload?.();
  };

  const handleSchedule = async (id) => {
    const when = scheduleFor[id];
    if (!when) { showToast?.("예약 일시를 선택하세요"); return; }
    const { error } = await adminUpdateLoungeDraft(id, {
      publishStatus: "scheduled", scheduledAt: new Date(when).toISOString(),
    }, adminUserId);
    if (error) { showToast?.("예약 실패: " + error.message); return; }
    showToast?.("⏰ 예약 발행이 설정됐습니다");
    onReload?.();
  };

  const handleDeleteDraft = async (id) => {
    const { error } = await adminDeleteLoungeDraft(id, adminUserId);
    if (error) { showToast?.("삭제 실패: " + error.message); return; }
    onReload?.();
  };

  // Phase 2 — Trend Scheduler 수동 트리거(cron 은 3시간마다 자동 호출, 여기서는 즉시 확인용).
  // 결과는 항상 DRAFT 로만 저장되며(api/trend/check-trends.js 하드코딩 규칙), 자동 발행 없음.
  const handleCheckTrendsNow = async () => {
    if (checkingTrends) return;
    setCheckingTrends(true);
    setTrendCheckResult(null);
    try {
      const res = await fetch("/api/trend/check-trends");
      const json = await res.json();
      setTrendCheckResult(json);
      if (json?.created > 0) showToast?.(`🔎 트렌드 ${json.created}건을 초안으로 저장했습니다`);
      else showToast?.("새로운(중복 아닌) 트렌드 이슈가 없습니다");
      onReload?.();
    } catch (e) {
      showToast?.("트렌드 확인 실패: " + (e?.message ?? String(e)));
    } finally {
      setCheckingTrends(false);
    }
  };

  // 8단계(관리자 화면 · Trend Queue) — 기존 draft/scheduled 목록(drafts)에서 ai_topic 이 있는
  // 항목을 재사용해 추천점수/우선순위/카테고리 신뢰도를 다시 계산(별도 저장 없이 항상 최신 계산).
  const trendQueue = drafts
    .filter(d => d.ai_topic)
    .map(d => {
      const score = scoreTopic({ topic: d.ai_topic, region: d.region ?? null, collectedAt: d.created_at });
      const priority = priorityFromScore(score.total);
      const mapped = mapCategory(d.ai_topic);
      return { ...d, _score: score.total, _priority: priority, _categoryConfidence: mapped.confidence };
    })
    .sort((a, b) => b._score - a._score);

  // ── AI 편집국(Phase 2·AI Editor) — 생성 전 "편집회의" 기획 레이어(전부 결정론적 재계산, 저장 없음) ──
  // 오늘의 이슈(도메인 시드 + 현재 Trend Queue 이슈) → 편집회의 심의 → 오늘 만들 콘텐츠 선정.
  const dailyIssues = generateDailyIssues({ trends: trendQueue.map(q => ({ topic: q.ai_topic })), limit: 20 });
  const editorialMeeting = runEditorialMeeting(dailyIssues);
  const todaysPicks = selectTodaysContent(editorialMeeting, 20);
  // 새 카테고리 추천(공간 연결 + 2개 조건 이상, 기존 카테고리 제외) — 추천만, 자동 생성 없음.
  const categoryRecs = recommendCategories(dailyIssues);
  // 콘텐츠 품질 점검 — 기존 초안/발행글을 7개 축으로 자기평가(90점 미만 재작성 권장). 낮은 순 정렬.
  const qualityChecks = [...drafts, ...published]
    .filter(p => p.title)
    .map(p => ({ id: p.id, title: p.title, status: p.publish_status, ...scoreContent({ title: p.title, content: p.content, category: p.category }) }))
    .sort((a, b) => a.total - b.total);

  // ── Phase 3 · Space Graph(공간 지식 네트워크) — 전부 결정론적 재계산(저장/Migration 없음) ──
  // 발행글 기준으로 콘텐츠 연결률·토픽 클러스터·지식 지도·오늘의 Space/Editor's Pick 을 계산한다.
  // "글을 많이 만드는 것"이 아니라 "글과 글을 연결하는 것"이 이 Phase 의 목표.
  const allContent = [...published, ...drafts].filter(p => p.title);
  const connStats = connectionRate(published);
  const clusters = clusterBreakdown(published);
  const kmap = knowledgeMap(published);
  const spaceTop = todaysSpace(published, 10);
  const editorPick = editorsPick(published);

  // ── Phase 4 · Community Engine(살아있는 공간) — 전부 결정론적 재계산(저장/Migration 없음) ──
  // AI 가 만들고, 사람이 반응하고, 그 반응이 다시 AI 의 다음 기획으로 돌아간다.
  // 발행글의 사용자 신호(조회·좋아요·댓글)로 커뮤니티 점수·온도·오늘의 살아있는 공간을 계산한다.
  const temp = communityTemperature(published);
  const livingSpace = todaysLivingSpace(published, { n: 8 });
  const topDiscussed = rankByCommunity(published, "discussion", 6).filter(p => p._c.discussionScore > 0);
  const topEngaged = rankByCommunity(published, "engagement", 6).filter(p => p._c.engagementScore > 0);
  // 댓글 인사이트 — 온디맨드 로드된 댓글이 있을 때만 계산(기본 로드 경로 무변경 · Regression Zero).
  const publishedById = published.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
  const insightRows = comments ? commentInsightByPost(comments, publishedById) : [];
  const followupQueue = comments
    ? buildFollowupQueue({ insightRows, postsById: publishedById, risingCategories: temp.risingTopics })
    : buildFollowupQueue({ insightRows: [], postsById: publishedById, risingCategories: temp.risingTopics });

  // ── Phase 5 · Space Media(매거진/아카이브/검색) — 발행글로 매거진 구성을 미리보기(결정론적 재계산) ──
  // "게시판"이 아니라 "매거진/아카이브"로 보는 구조. 실제 사용자 화면(글 상세 Reading Experience)은
  // 별도로 적용되며, 여기서는 관리자가 매거진 준비 상태를 확인한다(PC Version First 구조 검증).
  const magazine = composeMagazine(published);
  const archive = composeArchive(published);
  const searchResult = searchQ.trim() ? spaceSearch(searchQ, published, { limit: 8 }) : null;

  // ── Phase 6 · Publishing OS(운영 파이프라인) — Phase 1~5 엔진을 하나의 운영 관점으로 연결 ──
  // 기획→생성→검수→연결→발행→분석→재기획. 전부 결정론적 재계산(저장/Migration 없음).
  const osPipeline = pipelineStages({ issues: dailyIssues, drafts, published, todaysPicks });
  const osDraftQueue = buildDraftQueue(drafts, published);
  const osDashboard = todaysDashboard({ published, drafts });
  const osCalendar = publishingCalendar(drafts, { days: 14 });
  const osHealth = categoryHealthSummary(published);
  const osCoverage = spaceCoverage(published);
  const osIndex = buildSpaceIndex(published);

  // 최근 댓글을 온디맨드로 불러와 댓글 인사이트/후속 추천을 채운다(자동 로드 아님).
  const handleLoadComments = async () => {
    if (loadingComments) return;
    setLoadingComments(true);
    try {
      const { data } = await adminGetLoungeComments({ limit: 300 });
      // 삭제/숨김 댓글은 커뮤니티 신호에서 제외(살아있는 반응만 인사이트에 반영).
      const live = (data ?? []).filter(c => c.is_deleted !== true && c.is_hidden !== true);
      setComments(live);
      showToast?.(`💬 최근 댓글 ${live.length}건으로 인사이트를 계산했습니다`);
    } catch (e) {
      showToast?.("댓글 로드 실패: " + (e?.message ?? String(e)));
    } finally {
      setLoadingComments(false);
    }
  };

  // 편집회의 편성표에서 "제작(make)" 이슈를 골라 초안 생성(재작성 루프 포함) → 기존 미리보기/저장 흐름 재사용.
  //   Phase 3: 생성 "전에" AI 체크(중복 방지)를 먼저 돌린다 — 이미 존재하는 콘텐츠를 먼저 이해하고,
  //   48h 내 사실상 동일한 글이 있으면 생성을 건너뛴다(콘텐츠 원칙: 중복 글을 만들지 않는다).
  const handleGenerateFromEditor = (pick) => {
    const check = preGenerationCheck({ topic: pick.topic, category: pick.category }, allContent);
    setAiCheck(check);
    if (check.verdict === "skip") {
      showToast?.("🛑 중복 감지 — 이미 유사한 글이 있어 생성을 건너뜁니다");
      return;
    }
    const res = generateReviewedDraft({ issue: pick.topic, spaceAngle: pick.spaceAngle, category: pick.category, region: region.trim() || null });
    setIssue(pick.topic);
    setSpaceAngle(pick.spaceAngle);
    setPreview(res.draft);
    const tag = check.verdict === "enrich" ? " · 유사 글 보강 권장" : (check.related.length ? ` · 관련 글 ${check.related.length}건 연결` : "");
    showToast?.((res.passed ? `✅ 편집회의 통과 초안(점수 ${res.score.total})` : `⚠️ 초안(점수 ${res.score.total} · 재작성 권장)`) + tag);
  };

  // 10단계(카테고리별 콘텐츠 축적) — 발행된 AI 콘텐츠를 카테고리별로 집계(8단계 Analytics 경량판).
  const byCategory = published.reduce((acc, p) => {
    const k = p.category || "daily";
    if (!acc[k]) acc[k] = { count: 0, views: 0, likes: 0, comments: 0 };
    acc[k].count += 1;
    acc[k].views += p.view_count ?? 0;
    acc[k].likes += p.like_count ?? 0;
    acc[k].comments += p.comment_count ?? 0;
    return acc;
  }, {});

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: 4 }}>🏭 AI 콘텐츠 공장</div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: S.lg, lineHeight: 1.6 }}>
        이슈를 공간 관점으로 재해석한 초안을 만들고, 검수 후 발행합니다. 자동 발행은 하지 않습니다 —
        모든 발행은 관리자 승인이 필요합니다(베타 원칙).
      </div>

      {/* 📊 LLM Usage Dashboard (Phase 20.7) — 워크벤치 기록 집계(로컬). 사용량·비용·품질·성공률. */}
      <UsageDashboardPanel C={C} S={S} R={R} />

      {/* 🗞️ AI 편집국 — 생성 전 기획 레이어: 편집회의(오늘 이슈 심의) → 카테고리 추천 → 콘텐츠 품질 점검.
          목표는 콘텐츠의 "양"이 아니라 "경쟁력". 전부 결정론적 재계산(저장/Migration 없음). */}
      <div style={{ background: C.brandL, borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.brandM}`, marginBottom: S.xl }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.brandD, marginBottom: 4 }}>🗞️ AI 편집국</div>
        <div style={{ fontSize: 11.5, color: C.text2, marginBottom: S.md, lineHeight: 1.6 }}>
          공간라운지는 인테리어 커뮤니티가 아니라 <b>공간을 중심으로 세상을 기록하는 AI 콘텐츠 플랫폼</b>입니다.
          글을 만들기 전에 편집회의를 엽니다: 오늘 이슈 → 가치 평가 → 공간 관련성 → 카테고리 결정 → 생성.
        </div>

        {/* A. 편집회의 편성표 — 오늘 만들 콘텐츠 심의 결과 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>
          📋 편집회의 · 오늘의 이슈 편성표 (제작 {todaysPicks.length} / 심의 {editorialMeeting.length})
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: S.lg }}>
          {editorialMeeting.slice(0, 12).map((m, i) => (
            <div key={m.topic + i} style={{ background: "#fff", borderRadius: R.md, padding: "8px 10px", border: `1px solid ${C.bgWarm}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11.5 }}>
                <span style={{ padding: "2px 7px", borderRadius: R.full, fontSize: 10, fontWeight: 800, background: m.verdict === "make" ? C.brand : C.bgWarm, color: m.verdict === "make" ? "#fff" : C.text3 }}>
                  {m.verdict === "make" ? "제작" : "보류"}
                </span>
                <span style={{ fontWeight: 800, color: C.text1 }}>{m.topic}</span>
                <span style={{ color: C.text3 }}>가치 {m.valueScore} · 공간 {m.spaceScore}</span>
                <span style={{ color: C.brand }}>→ {catLabel(m.category)}</span>
                {m.verdict === "make" && (
                  <button onClick={() => handleGenerateFromEditor(m)}
                    style={{ marginLeft: "auto", padding: "4px 10px", background: C.brandD, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 10.5, cursor: "pointer" }}>
                    이 이슈로 초안 생성 ↑
                  </button>
                )}
              </div>
              <div style={{ marginTop: 4, color: C.text4, fontSize: 10.5 }}>
                {m.chain.join(" → ")} · {m.spaceAngle}
              </div>
            </div>
          ))}
        </div>

        {/* B. 새 카테고리 추천 — 추천만, 자동 생성 없음 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>
          🌱 새 카테고리 추천 (관리자 승인 필요 · 자동 생성 안 함)
        </div>
        <div style={{ fontSize: 10.5, color: C.text3, marginBottom: S.sm, lineHeight: 1.6 }}>
          공간과 연결되고, 6개 조건(검색량·트렌드 지속·확장성·공간 관련성·관심도·장기가치) 중 2개 이상을
          만족하는 후보만 제안합니다. 실제 카테고리 추가는 관리자가 승인해야 합니다.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: S.lg }}>
          {categoryRecs.length === 0 ? (
            <span style={{ fontSize: 11.5, color: C.text3 }}>추천할 새 카테고리가 없습니다</span>
          ) : categoryRecs.map(c => (
            <div key={c.id} title={c.metSignals.join(" / ")}
              style={{ background: "#fff", border: `1px solid ${C.brandM}`, borderRadius: R.md, padding: "6px 10px", fontSize: 11 }}>
              <div>
                <span style={{ fontWeight: 800, color: C.brandD }}>{c.label}</span>
                <span style={{ color: C.gold, marginLeft: 6, fontWeight: 700 }}>{c.signalCount}/6</span>
                {c.related && <span style={{ color: C.brand, marginLeft: 6 }}>· 오늘 이슈 연관</span>}
              </div>
              <div style={{ color: C.text4, fontSize: 10 }}>{c.spaceLink}</div>
            </div>
          ))}
        </div>

        {/* C. 콘텐츠 품질 점검 — 7축 자기평가, 90점 미만 재작성 권장 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>
          🎯 콘텐츠 품질 점검 (90점 미만 = 재작성 권장)
        </div>
        {qualityChecks.length === 0 ? (
          <div style={{ fontSize: 11.5, color: C.text3 }}>점검할 콘텐츠가 없습니다</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {qualityChecks.slice(0, 8).map(q => (
              <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: `1px solid ${C.bgWarm}`, fontSize: 11.5, flexWrap: "wrap" }}>
                <span style={{ padding: "2px 7px", borderRadius: R.full, fontSize: 10, fontWeight: 800, background: q.needsRewrite ? C.red + "22" : C.brandL, color: q.needsRewrite ? C.red : C.brandD }}>
                  {q.total}점 {q.needsRewrite ? "· 재작성" : "· 통과"}
                </span>
                <span style={{ color: C.text1, fontWeight: 700, flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.title}</span>
                <span style={{ color: C.text4, fontSize: 10 }}>공간 {q.axes.spaceRelevance} · 정보 {q.axes.infoValue} · 독창 {q.axes.originality}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🕸️ Space Graph (Phase 3) — 공간 지식 네트워크: 글을 "많이" 만드는 게 아니라 "연결"한다.
          콘텐츠 연결률 · 토픽 클러스터 · 지식 지도 · 오늘의 Space / Editor's Pick. 전부 결정론적 재계산(저장 없음). */}
      <div style={{ background: "#0f2e26", borderRadius: R.xl, padding: S.xl, border: `1px solid #1c463a`, marginBottom: S.xl }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 4 }}>🕸️ Space Graph · 공간 지식 네트워크</div>
        <div style={{ fontSize: 11.5, color: "#a9c9bd", marginBottom: S.md, lineHeight: 1.6 }}>
          Space is Everything. 이제 중요한 건 <b style={{ color: "#fff" }}>새 글을 얼마나 잘 쓰느냐</b>가 아니라
          <b style={{ color: "#fff" }}> 기존 글을 얼마나 잘 연결하느냐</b>입니다. 콘텐츠가 쌓일수록 하나의 공간 지식 네트워크가 됩니다.
        </div>

        {/* 콘텐츠 연결률 — 관련 글이 1개 이상 있는 발행글 비율 */}
        <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.lg }}>
          {[
            { k: "연결률", v: `${connStats.rate}%`, sub: `연결 ${connStats.connected} / 전체 ${connStats.total}` },
            { k: "고립 글", v: connStats.isolated, sub: "연결 0건(연결 필요)" },
            { k: "평균 연결", v: connStats.avgDegree, sub: "글당 관련 글 수" },
            { k: "클러스터", v: clusters.length, sub: `토픽 그룹 · 지식 엣지 ${kmap.edges.length}` },
          ].map(m => (
            <div key={m.k} style={{ flex: "1 1 120px", background: "#123a30", borderRadius: R.lg, padding: "10px 12px", border: "1px solid #1c463a" }}>
              <div style={{ fontSize: 10.5, color: "#8fb3a6" }}>{m.k}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{m.v}</div>
              <div style={{ fontSize: 9.5, color: "#6f978a", marginTop: 2 }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* AI Topic Cluster — 콘텐츠를 대주제(클러스터)로 관리 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: S.sm }}>🧩 Topic Cluster (콘텐츠 클러스터)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: S.lg }}>
          {(clusters.length ? clusters : TOPIC_CLUSTERS.map(c => ({ ...c, count: 0, views: 0 }))).map(c => (
            <div key={c.id} style={{ background: "#123a30", border: "1px solid #1c463a", borderRadius: R.md, padding: "6px 10px", fontSize: 11 }}>
              <span style={{ color: "#fff", fontWeight: 700 }}>{c.label}</span>
              <span style={{ color: "#8fb3a6", marginLeft: 6 }}>{c.count}글</span>
              {c.views > 0 && <span style={{ color: "#6f978a", marginLeft: 6 }}>· 조회 {c.views}</span>}
            </div>
          ))}
        </div>

        {/* Knowledge Map — 카테고리 ↔ 카테고리 지식 연결(실제 글이 있는 카테고리끼리) */}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: S.sm }}>🗺️ Knowledge Map (카테고리 지식 연결 {kmap.edges.length})</div>
        {kmap.edges.length === 0 ? (
          <div style={{ fontSize: 11, color: "#8fb3a6", marginBottom: S.lg }}>아직 연결할 카테고리가 부족합니다(발행글이 쌓이면 자동 연결)</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: S.lg }}>
            {kmap.edges.slice(0, 24).map((e, i) => (
              <span key={i} style={{ fontSize: 10.5, color: "#cfe6dd", background: "#123a30", border: "1px solid #1c463a", borderRadius: R.full, padding: "3px 9px" }}>
                {catLabel(e.source)} ↔ {catLabel(e.target)}
              </span>
            ))}
          </div>
        )}

        {/* 오늘의 Space / Editor's Pick — 인기 + 네트워크 허브(연결 많은 글)를 함께 본다 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: S.sm }}>⭐ 오늘의 Space · Top {Math.min(spaceTop.length, 10)}</div>
        {editorPick && (
          <div style={{ background: "#1a4a3c", borderRadius: R.md, padding: "8px 11px", border: "1px solid #2a6b57", marginBottom: S.sm }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#ffd7a0" }}>Editor's Pick</span>
            <span style={{ fontSize: 12, color: "#fff", fontWeight: 700, marginLeft: 8 }}>{editorPick.title}</span>
            <span style={{ fontSize: 10, color: "#8fb3a6", marginLeft: 8 }}>연결 {editorPick._hubDegree}건</span>
          </div>
        )}
        {spaceTop.length === 0 ? (
          <div style={{ fontSize: 11, color: "#8fb3a6" }}>발행된 콘텐츠가 쌓이면 오늘의 Space 가 자동 선정됩니다</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {spaceTop.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, padding: "3px 0", borderBottom: "1px solid #163b30", flexWrap: "wrap" }}>
                <span style={{ color: "#ffd7a0", fontWeight: 800, width: 18 }}>{i + 1}</span>
                <span style={{ color: "#fff", fontWeight: 600, flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                <span style={{ color: "#6f978a", fontSize: 10 }}>{catLabel(p.category)} · 허브 {p._hubDegree}</span>
              </div>
            ))}
          </div>
        )}

        {/* AI 체크(중복 방지) — 편집회의에서 "이 이슈로 초안 생성"을 누르면 생성 전에 실행된 결과 */}
        {aiCheck && (
          <div style={{ marginTop: S.lg, background: "#123a30", borderRadius: R.md, padding: "10px 12px", border: `1px solid ${aiCheck.verdict === "skip" ? "#a05a5a" : "#1c463a"}` }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
              🤖 AI 체크 · {aiCheck.verdict === "skip" ? "중복 감지(생성 건너뜀)" : aiCheck.verdict === "enrich" ? "유사 글 있음(보강 권장)" : "생성 진행(관련 글 연결)"}
              <span style={{ color: "#8fb3a6", fontWeight: 600, marginLeft: 8 }}>{aiCheck.chain.map(c => catLabel(c)).join(" → ")}</span>
            </div>
            <div style={{ fontSize: 10.5, color: "#a9c9bd", lineHeight: 1.7 }}>
              {aiCheck.reasons.map((r, i) => <div key={i}>· {r}</div>)}
            </div>
            {aiCheck.related.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 10.5, color: "#cfe6dd" }}>
                연결할 관련 글: {aiCheck.related.map(r => r.title).slice(0, 3).join(" · ")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 🌡️ Community Engine (Phase 4) — 살아있는 공간: AI 가 만들고, 사람이 반응하고,
          그 반응이 다시 AI 의 다음 기획으로 돌아간다. 커뮤니티 온도 · 오늘의 살아있는 공간 ·
          댓글 인사이트 · 후속 콘텐츠 추천 · 상승/조용 카테고리. 전부 결정론적 재계산(저장 없음). */}
      <div style={{ background: "#2a1a3a", borderRadius: R.xl, padding: S.xl, border: `1px solid #43305a`, marginBottom: S.xl }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: S.sm, marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>🌡️ Community Engine · 살아있는 공간</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#ffcf8f" }}>{temp.temperature}°</span>
            <button onClick={handleLoadComments} disabled={loadingComments}
              style={{ padding: "6px 12px", background: "#3a2650", color: "#e5d4f5", border: "1px solid #55406f", borderRadius: R.lg, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>
              {loadingComments ? "분석 중..." : "💬 댓글 인사이트 분석"}
            </button>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: "#c6a9dd", marginBottom: S.md, lineHeight: 1.6 }}>
          공간 온도는 라운지 전체 활성도입니다(체온 36.5° 기준). AI 가 쓴 글에 사람이 반응하면 온도가 오르고,
          그 신호가 후속 콘텐츠 기획으로 돌아갑니다.
        </div>

        {/* 온도 지표 */}
        <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.lg }}>
          {[
            { k: "오늘 글", v: temp.todayPosts },
            { k: "총 댓글", v: temp.totalComments },
            { k: "총 반응", v: temp.totalReactions },
            { k: "인기 글", v: temp.popularCount, sub: "커뮤니티 70+" },
            { k: "숨김 비율", v: `${Math.round(temp.hiddenRatio * 100)}%` },
          ].map(m => (
            <div key={m.k} style={{ flex: "1 1 90px", background: "#3a2650", borderRadius: R.lg, padding: "8px 11px", border: "1px solid #43305a" }}>
              <div style={{ fontSize: 10, color: "#b193cc" }}>{m.k}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{m.v}</div>
              {m.sub && <div style={{ fontSize: 9, color: "#8f76a8", marginTop: 2 }}>{m.sub}</div>}
            </div>
          ))}
        </div>

        {/* 오늘의 살아있는 공간 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: S.sm }}>✨ 오늘의 살아있는 공간</div>
        {livingSpace.length === 0 ? (
          <div style={{ fontSize: 11, color: "#b193cc", marginBottom: S.lg }}>반응이 쌓이면 오늘 살아 움직이는 글이 자동 선정됩니다</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: S.lg }}>
            {livingSpace.map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, padding: "3px 0", borderBottom: "1px solid #382548", flexWrap: "wrap" }}>
                <span style={{ color: "#ffcf8f", fontWeight: 800, width: 18 }}>{i + 1}</span>
                <span style={{ color: "#fff", fontWeight: 600, flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                <span style={{ color: "#b193cc", fontSize: 10 }}>커뮤니티 {p._c.communityScore}{p._c.evergreen ? " · evergreen" : ""}</span>
              </div>
            ))}
          </div>
        )}

        {/* 반응/토론 상위 + 상승/조용 카테고리 */}
        <div style={{ display: "flex", gap: S.md, flexWrap: "wrap", marginBottom: S.lg }}>
          <div style={{ flex: "1 1 240px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#fff", marginBottom: 5 }}>🔥 반응 좋은 글</div>
            {topEngaged.length === 0 ? <div style={{ fontSize: 10.5, color: "#b193cc" }}>—</div> :
              topEngaged.map(p => (
                <div key={p.id} style={{ fontSize: 10.5, color: "#e5d4f5", padding: "2px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  · {p.title} <span style={{ color: "#8f76a8" }}>({p._c.engagementScore})</span>
                </div>
              ))}
          </div>
          <div style={{ flex: "1 1 240px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#fff", marginBottom: 5 }}>💬 댓글 많은 글</div>
            {topDiscussed.length === 0 ? <div style={{ fontSize: 10.5, color: "#b193cc" }}>—</div> :
              topDiscussed.map(p => (
                <div key={p.id} style={{ fontSize: 10.5, color: "#e5d4f5", padding: "2px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  · {p.title} <span style={{ color: "#8f76a8" }}>({p._c.discussionScore})</span>
                </div>
              ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: S.md, flexWrap: "wrap", marginBottom: S.lg }}>
          <div style={{ flex: "1 1 240px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#fff", marginBottom: 5 }}>📈 상승 카테고리</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {temp.risingTopics.length === 0 ? <span style={{ fontSize: 10.5, color: "#b193cc" }}>—</span> :
                temp.risingTopics.map(c => (
                  <span key={c.category} style={{ fontSize: 10, color: "#c9f0d0", background: "#243a2a", border: "1px solid #35553d", borderRadius: R.full, padding: "3px 9px" }}>{c.label} ↑{c.momentum}</span>
                ))}
            </div>
          </div>
          <div style={{ flex: "1 1 240px" }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#fff", marginBottom: 5 }}>💤 조용한 카테고리(보강 필요)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {temp.quietCategories.length === 0 ? <span style={{ fontSize: 10.5, color: "#b193cc" }}>—</span> :
                temp.quietCategories.map(c => (
                  <span key={c.category} style={{ fontSize: 10, color: "#e8c9c9", background: "#3a2626", border: "1px solid #553939", borderRadius: R.full, padding: "3px 9px" }}>{c.label}</span>
                ))}
            </div>
          </div>
        </div>

        {/* 후속 콘텐츠 추천 (댓글 인사이트 로드 시 질문/논쟁 기반 추천이 추가된다) */}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: S.sm }}>
          🎯 후속 콘텐츠 추천 {comments ? "" : "(💬 댓글 인사이트 분석을 누르면 질문·논쟁 기반 추천이 추가됩니다)"}
        </div>
        {followupQueue.length === 0 ? (
          <div style={{ fontSize: 11, color: "#b193cc" }}>추천할 후속 주제가 아직 없습니다</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {followupQueue.slice(0, 8).map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, padding: "4px 0", borderBottom: "1px solid #382548", flexWrap: "wrap" }}>
                <span style={{ padding: "2px 7px", borderRadius: R.full, fontSize: 9.5, fontWeight: 800, background: "#3a2650", color: "#d3b8ea" }}>
                  {({ qa: "Q&A", deep: "심화", improve: "개선", balance: "균형", category: "카테고리" })[r.type] || r.type}
                </span>
                <span style={{ color: "#fff", fontWeight: 600 }}>{r.topic || (r.category ? catLabel(r.category) : "")}</span>
                <span style={{ color: "#8f76a8", fontSize: 10, flexBasis: "100%" }}>{r.reason}</span>
              </div>
            ))}
          </div>
        )}

        {/* 댓글 인사이트 (온디맨드 로드 시) — 질문/후기/논쟁 분포 + 주의 필요 글 */}
        {comments && insightRows.length > 0 && (
          <div style={{ marginTop: S.lg }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: S.sm }}>🧭 댓글 인사이트 (글별)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {insightRows.slice(0, 8).map(row => (
                <div key={row.postId} style={{ fontSize: 11, padding: "4px 0", borderBottom: "1px solid #382548" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {row.analysis.needsAttention && <span style={{ padding: "1px 6px", borderRadius: R.full, fontSize: 9, fontWeight: 800, background: "#553939", color: "#f0c9c9" }}>주의</span>}
                    <span style={{ color: "#fff", fontWeight: 600, flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.title}</span>
                    <span style={{ color: "#8f76a8", fontSize: 10 }}>질문 {row.analysis.question} · 후기 {row.analysis.review} · 논쟁 {row.analysis.dispute}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 📖 Space Media (Phase 5) — 매거진/아카이브/검색 구조 미리보기. 게시판이 아니라 미디어.
          실제 사용자 UX(읽는 시간·목차·작성자 배지)는 글 상세에 적용됨. 여기선 관리자 준비 확인용. */}
      <div style={{ background: "#111827", borderRadius: R.xl, padding: S.xl, border: `1px solid #273244`, marginBottom: S.xl }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 4 }}>📖 Space Media · 매거진 미리보기</div>
        <div style={{ fontSize: 11.5, color: "#9fb0c8", marginBottom: S.md, lineHeight: 1.6 }}>
          "YouTube 가 영상을 기록했다면, Space Lounge 는 글과 사진으로 세상을 기록한다." 발행글을 매거진 홈으로
          구성한 미리보기입니다(PC Version First 구조). 온도 {magazine.insight.temperature}° · 전체 {magazine.insight.totalPosts}글 · 오늘 {magazine.insight.todayPosts}글.
        </div>

        {/* Editor's Pick + Hero */}
        {magazine.editorsPick && (
          <div style={{ background: "#1b2536", borderRadius: R.md, padding: "9px 12px", border: "1px solid #2c3a52", marginBottom: S.sm }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: "#ffcf8f" }}>Editor's Pick</span>
            <span style={{ fontSize: 12.5, color: "#fff", fontWeight: 700, marginLeft: 8 }}>{magazine.editorsPick.title}</span>
            <span style={{ fontSize: 10, color: "#9fb0c8", marginLeft: 8 }}>{magazine.editorsPick.readingLabel} · {magazine.editorsPick.author.label}</span>
          </div>
        )}

        {/* 매거진 섹션들 */}
        {magazine.sections.length === 0 ? (
          <div style={{ fontSize: 11.5, color: "#9fb0c8", marginBottom: S.lg }}>발행글이 쌓이면 매거진 섹션이 자동 구성됩니다</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: S.md, marginBottom: S.lg }}>
            {magazine.sections.map(sec => (
              <div key={sec.id}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: 5 }}>{sec.title} <span style={{ color: "#6b7c96", fontWeight: 600 }}>({sec.cards.length})</span></div>
                <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                  {sec.cards.slice(0, 6).map(card => (
                    <div key={card.id} style={{ flex: "0 0 140px", background: "#1b2536", borderRadius: R.md, border: "1px solid #273244", padding: "8px 9px" }}>
                      <div style={{ fontSize: 11, color: "#fff", fontWeight: 600, lineHeight: 1.4, height: 30, overflow: "hidden" }}>{card.title}</div>
                      <div style={{ fontSize: 9, color: "#6b7c96", marginTop: 5 }}>{card.author.emoji} {card.readingLabel} · 👁 {card.views}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Trending */}
        {magazine.trending.length > 0 && (
          <div style={{ marginBottom: S.lg }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: 5 }}>🔥 Trending</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {magazine.trending.map(t => (
                <span key={t.category} style={{ fontSize: 10, color: "#cfe0f5", background: "#1b2536", border: "1px solid #2c3a52", borderRadius: R.full, padding: "3px 9px" }}>{t.label} ↑{t.momentum}</span>
              ))}
            </div>
          </div>
        )}

        {/* Archive 요약 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: 5 }}>🗄️ Archive</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: S.sm }}>
          {archive.byTime.map(b => (
            <div key={b.id} style={{ background: "#1b2536", borderRadius: R.md, padding: "6px 11px", border: "1px solid #273244" }}>
              <span style={{ fontSize: 10, color: "#9fb0c8" }}>{b.label}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginLeft: 6 }}>{b.count}</span>
            </div>
          ))}
        </div>
        {archive.byTag.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: S.lg }}>
            {archive.byTag.slice(0, 16).map(t => (
              <span key={t.tag} style={{ fontSize: 9.5, color: "#8fa2bd", background: "#1b2536", borderRadius: R.full, padding: "2px 7px" }}>#{t.tag} {t.count}</span>
            ))}
          </div>
        )}

        {/* 지식 검색 데모 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: 5 }}>🔎 Space Search (지식 검색)</div>
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="예) 인테리어, 신혼집, 금리…"
          style={{ width: "100%", padding: "9px 12px", background: "#1b2536", color: "#fff", border: "1px solid #2c3a52", borderRadius: R.md, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: S.sm }} />
        {searchResult && (
          <div>
            <div style={{ fontSize: 10.5, color: "#9fb0c8", marginBottom: 5 }}>
              공간 관점: {searchResult.spaceKeyword} · 결과 {searchResult.results.length}건
              {searchResult.categories.length > 0 && " · " + searchResult.categories.map(c => `${c.label}(${c.count})`).join(", ")}
            </div>
            {searchResult.results.length === 0 ? (
              <div style={{ fontSize: 11, color: "#6b7c96" }}>일치하는 글이 없습니다</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {searchResult.results.map(r => (
                  <div key={r.id} style={{ fontSize: 11, padding: "4px 0", borderBottom: "1px solid #1f2a3c" }}>
                    <span style={{ padding: "1px 6px", borderRadius: R.full, fontSize: 9, fontWeight: 800, background: r._matched === "direct" ? "#25406b" : "#3a2d55", color: "#cfe0f5", marginRight: 6 }}>
                      {r._matched === "direct" ? "직접" : "연결"}
                    </span>
                    <span style={{ color: "#fff", fontWeight: 600 }}>{r.title}</span>
                    <span style={{ color: "#6b7c96", marginLeft: 6 }}>{catLabel(r.category)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 🛰️ Publishing OS (Phase 6) — 운영 파이프라인: 기획→생성→검수→연결→발행→분석→재기획.
          Phase 1~5 엔진을 하나의 운영 관점으로 묶은 관리자 콘솔. 전부 결정론적 재계산(저장 없음). */}
      <div style={{ background: "#1a1030", borderRadius: R.xl, padding: S.xl, border: `1px solid #33235a`, marginBottom: S.xl }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 4 }}>🛰️ Publishing OS · 콘텐츠 운영 파이프라인</div>
        <div style={{ fontSize: 11.5, color: "#b9a6dd", marginBottom: S.md, lineHeight: 1.6 }}>
          AI 가 기획하고, 연결하고, 사람이 반응하고, 관리자가 운영하고, 다시 AI 의 다음 기획으로 돌아갑니다.
          온도 {osDashboard.temperature}° · 색인 {osIndex.stats.indexed}글 · 커버리지 {osCoverage.coverageRate}%.
        </div>

        {/* 1. Publishing Pipeline — 단계 흐름 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: S.sm }}>🔻 Pipeline</div>
        <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 6, marginBottom: S.lg }}>
          {osPipeline.map((s, i) => (
            <div key={s.id} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 5 }}>
              <div title={s.note} style={{ background: "#241640", borderRadius: R.md, border: "1px solid #33235a", padding: "7px 10px", minWidth: 96 }}>
                <div style={{ fontSize: 10, color: "#b9a6dd", lineHeight: 1.3 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{s.count}</div>
              </div>
              {i < osPipeline.length - 1 && <span style={{ color: "#5a4a7a", fontSize: 12 }}>→</span>}
            </div>
          ))}
        </div>

        {/* 2. Today's Dashboard */}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: S.sm }}>📅 Today's Dashboard</div>
        <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.sm }}>
          {[
            { k: "오늘 생성", v: osDashboard.createdToday },
            { k: "오늘 발행예정", v: osDashboard.scheduledToday },
            { k: "오늘 인기", v: osDashboard.popularToday.length },
            { k: "댓글 많은", v: osDashboard.commentedToday.length },
            { k: "저장 후보", v: osDashboard.saveCandidates.length },
          ].map(m => (
            <div key={m.k} style={{ flex: "1 1 80px", background: "#241640", borderRadius: R.lg, padding: "8px 10px", border: "1px solid #33235a" }}>
              <div style={{ fontSize: 10, color: "#b9a6dd" }}>{m.k}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>{m.v}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: S.lg, fontSize: 11 }}>
          {osDashboard.editorsPick && <span style={{ color: "#e5d4f5" }}>⭐ Editor's Pick: <b style={{ color: "#fff" }}>{osDashboard.editorsPick.title}</b></span>}
          {osDashboard.recommendedSlots.length > 0 && (
            <span style={{ color: "#b9a6dd" }}>· 추천 발행 슬롯: {osDashboard.recommendedSlots.map(s => s.label).slice(0, 4).join(", ")}</span>
          )}
        </div>

        {/* 3. Draft Queue — 운영 관점 초안 목록 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: S.sm }}>🗂️ Draft Queue ({osDraftQueue.length})</div>
        {osDraftQueue.length === 0 ? (
          <div style={{ fontSize: 11, color: "#b9a6dd", marginBottom: S.lg }}>검수 대기 초안이 없습니다</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: S.lg }}>
            {osDraftQueue.slice(0, 8).map(q => (
              <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, padding: "4px 0", borderBottom: "1px solid #281a44", flexWrap: "wrap" }}>
                {q.recommended && <span style={{ padding: "1px 6px", borderRadius: R.full, fontSize: 9, fontWeight: 800, background: "#2a5a3a", color: "#c9f0d0" }}>추천</span>}
                <span style={{ padding: "1px 6px", borderRadius: R.full, fontSize: 9, fontWeight: 700, background: "#241640", color: "#b9a6dd" }}>{q.status === "scheduled" ? "예약" : "초안"}</span>
                <span style={{ color: "#fff", fontWeight: 600, flex: 1, minWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.title}</span>
                <span style={{ color: q.needsRewrite ? "#e8a0a0" : "#9fd0b0", fontSize: 10 }}>품질 {q.qualityScore}</span>
                <span style={{ color: "#8f76a8", fontSize: 10 }}>공간 {q.spaceRelevance} · {PRIORITY_LABEL[q.priority]} · 연결 {q.relatedCount}</span>
              </div>
            ))}
          </div>
        )}

        {/* 4. Publishing Calendar — 14일 예약 요약 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: S.sm }}>
          🗓️ Publishing Calendar <span style={{ color: "#8f76a8", fontWeight: 600 }}>(예약 {osCalendar.totalScheduled} · 빈 슬롯 {osCalendar.emptyDates.length}일{osCalendar.overloadedDates.length ? ` · ⚠️과밀 ${osCalendar.overloadedDates.length}일` : ""})</span>
        </div>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: S.lg }}>
          {osCalendar.days.map(day => (
            <div key={day.date} title={day.items.map(i => i.title).join("\n") || "빈 슬롯"}
              style={{ width: 34, textAlign: "center", padding: "5px 0", borderRadius: R.sm,
                background: day.overloaded ? "#5a2a2a" : day.count > 0 ? "#2a5a3a" : "#241640",
                border: "1px solid #33235a" }}>
              <div style={{ fontSize: 8.5, color: "#b9a6dd" }}>{day.weekday}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{day.count}</div>
            </div>
          ))}
        </div>

        {/* 5. Category Health */}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: S.sm }}>
          🩺 Category Health <span style={{ color: "#8f76a8", fontWeight: 600 }}>(비어있음 {osHealth.empty} · 방치 {osHealth.stale} · 조용 {osHealth.quiet} · 상승 {osHealth.rising} · 건강 {osHealth.healthy})</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: S.lg }}>
          {osHealth.rows.slice(0, 12).map(r => {
            const tone = { empty: "#553939", stale: "#554a39", quiet: "#39404a", rising: "#2a5a3a", healthy: "#241640" }[r.status];
            return (
              <span key={r.category} style={{ fontSize: 10, color: "#e5d4f5", background: tone, border: "1px solid #33235a", borderRadius: R.full, padding: "3px 9px" }}>
                {r.label} · {r.count}{r.status === "stale" && r.lastPublishedDaysAgo != null ? ` (${r.lastPublishedDaysAgo}일 전)` : ""}
              </span>
            );
          })}
        </div>

        {/* 6. Space Coverage — Space is Everything 커버리지(추천만) */}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: S.sm }}>🌌 Space Coverage <span style={{ color: "#8f76a8", fontWeight: 600 }}>(커버 {osCoverage.covered}/{osCoverage.total})</span></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: S.sm }}>
          {osCoverage.areas.map(a => {
            const tone = a.status === "empty" ? "#553939" : a.status === "thin" ? "#554a39" : "#2a4a3a";
            return (
              <span key={a.id} title={a.hasCategory ? "" : "개념 영역(카테고리 없음)"} style={{ fontSize: 10, color: "#e5d4f5", background: tone, borderRadius: R.full, padding: "3px 9px" }}>
                {a.label} {a.count}{a.hasCategory ? "" : " *"}
              </span>
            );
          })}
        </div>
        {osCoverage.recommendations.length > 0 && (
          <div style={{ fontSize: 10.5, color: "#b9a6dd", marginBottom: S.lg }}>
            💡 부족 영역 추천(추천만): {osCoverage.recommendations.map(r => r.area).slice(0, 8).join(", ")}
          </div>
        )}

        {/* 7. Space Index — 통합 색인 요약 */}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#fff", marginBottom: S.sm }}>🧬 Space Index</div>
        <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
          {[
            { k: "색인 글", v: osIndex.stats.indexed },
            { k: "연결 고립", v: osIndex.stats.isolated },
            { k: "Evergreen", v: osIndex.stats.evergreen },
            { k: "미매핑 영역", v: osIndex.stats.unmapped },
          ].map(m => (
            <div key={m.k} style={{ flex: "1 1 80px", background: "#241640", borderRadius: R.lg, padding: "8px 10px", border: "1px solid #33235a" }}>
              <div style={{ fontSize: 10, color: "#b9a6dd" }}>{m.k}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>{m.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Phase 18 — Real LLM Editorial Engine (OpenRouter). Mock 없음: 미설정/실패 시 초안 미생성 */}
      <div style={{ background: C.brandD, borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.brandD}`, marginBottom: S.xl, color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>📰 AI 편집국 — 실제 매거진 생성 (LLM)</div>
          <span style={{ fontSize: 11, color: isLLMConfigured() ? "#B5D4C5" : "#F6DDAA" }}>{isLLMConfigured() ? "● LLM 연결됨" : "○ LLM 미설정(VITE_LLM_API_KEY)"}</span>
        </div>
        <div style={{ fontSize: 11, color: "#B5D4C5", marginTop: 4, lineHeight: 1.6 }}>
          위 "이슈/트렌드"를 주제로 실제 OpenRouter LLM이 매거진 수준의 글을 씁니다. 신뢰도 90점 미만이면 자동 재작성(최대 3회, 최고점 채택).
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: S.md }}>
          <label style={{ flex: "2 1 200px" }}>
            <div style={{ fontSize: 10, color: "#9fb6ab" }}>모델</div>
            <input value={edCfg.model} onChange={e => updateEdCfg({ model: e.target.value })}
              style={{ width: "100%", padding: "7px 9px", borderRadius: R.md, border: "1px solid #3a5a4c", background: "#1a3327", color: "#fff", fontSize: 12, boxSizing: "border-box", fontFamily: "inherit" }} />
          </label>
          <label style={{ flex: "1 1 90px" }}>
            <div style={{ fontSize: 10, color: "#9fb6ab" }}>Temperature</div>
            <input type="number" step="0.05" min="0" max="1" value={edCfg.temperature} onChange={e => updateEdCfg({ temperature: Number(e.target.value) })}
              style={{ width: "100%", padding: "7px 9px", borderRadius: R.md, border: "1px solid #3a5a4c", background: "#1a3327", color: "#fff", fontSize: 12, boxSizing: "border-box", fontFamily: "inherit" }} />
          </label>
          <label style={{ flex: "1 1 90px" }}>
            <div style={{ fontSize: 10, color: "#9fb6ab" }}>Max Tokens</div>
            <input type="number" step="100" min="500" value={edCfg.maxTokens} onChange={e => updateEdCfg({ maxTokens: Number(e.target.value) })}
              style={{ width: "100%", padding: "7px 9px", borderRadius: R.md, border: "1px solid #3a5a4c", background: "#1a3327", color: "#fff", fontSize: 12, boxSizing: "border-box", fontFamily: "inherit" }} />
          </label>
        </div>
        <button onClick={handleEditorialGenerate} disabled={edGen}
          style={{ marginTop: S.md, padding: "10px 18px", background: edGen ? "#3a5a4c" : C.gold, color: edGen ? "#9fb6ab" : "#1a1a1a", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 13, cursor: edGen ? "default" : "pointer" }}>
          {edGen ? "생성 중… (재작성 포함 최대 3회)" : "📰 실제 매거진 생성"}
        </button>
        {edResult && (
          <div style={{ marginTop: S.md, background: "#1a3327", borderRadius: R.lg, padding: S.md, fontSize: 11.5 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {(() => { const vc = { "Editor's Pick 가능": C.gold, "일반 발행 가능": "#2E5F4B", "재작성 권장": "#7a4a1a", "발행 비추천": "#7a1a1a" }[edResult.verdict] || "#3a5a4c";
                return <span style={{ padding: "2px 9px", borderRadius: R.full, fontWeight: 800, background: vc, color: "#1a1a1a" === vc ? "#000" : "#fff" }}>{edResult.verdict === "Editor's Pick 가능" ? "⭐ " : ""}{edResult.verdict}</span>; })()}
              <span style={{ padding: "2px 9px", borderRadius: R.full, fontWeight: 800, background: edResult.passed ? "#2E5F4B" : "#7a4a1a", color: "#fff" }}>종합 {edResult.finalScore}점</span>
              <span style={{ color: "#B5D4C5" }}>카테고리 {edResult.category}</span>
              <span style={{ color: "#B5D4C5" }}>· 시도 {edResult.attempts.length}회</span>
              {edResult.human?.ai?.isStrong && <span style={{ color: "#F6A6A6", fontWeight: 700 }}>⚠️ AI 티 강함</span>}
            </div>
            <div style={{ color: "#9fb6ab", marginTop: 6, fontSize: 10.5 }}>
              휴먼톤 {edResult.editorial.axes.humanTone} · 카테고리적합 {edResult.editorial.axes.categoryMatch} · 훅 {edResult.editorial.axes.hookQuality}({edResult.human.hook.type}) · 마무리 {edResult.editorial.axes.endingQuality}({edResult.human.ending.type}) · 반복내성 {edResult.editorial.axes.repetitionRisk} · 편집가치 {edResult.editorial.axes.editorialValue} · 저장가치 {edResult.editorial.axes.saveWorthiness}
            </div>
            <div style={{ color: "#7f9a8c", marginTop: 4, fontSize: 10 }}>
              신뢰도(내용) {edResult.confidence.total} · {edResult.provider} · {edResult.model} · {edResult.latencyMs}ms · ~{edResult.tokenEstimate}토큰{edResult.catMatch?.mismatch ? ` · ⚠️ 카테고리 재검토 제안: ${edResult.catMatch.suggested}` : ""}
            </div>
            {edResult.draft.seo && (
              <div style={{ color: "#B5D4C5", marginTop: 6, fontSize: 10.5, lineHeight: 1.6 }}>
                SEO · title: {edResult.draft.seo.metaTitle} / focus: {edResult.draft.seo.focusKeyword} / intent: {edResult.draft.seo.searchIntent}
              </div>
            )}
            <div style={{ color: "#9fb6ab", marginTop: 6, fontSize: 10.5 }}>아래 미리보기에서 확인·수정 후 "초안으로 저장"하세요.</div>
          </div>
        )}
      </div>

      {/* ① 이슈 입력 → ②③④ 기획/제목/본문 생성(템플릿) */}
      <div style={{ background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.xl }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.md }}>새 초안 만들기</div>
        <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.md }}>
          {ISSUE_PRESETS.map(p => (
            <button key={p.id} onClick={() => applyPreset(p.id)}
              style={{ padding: "6px 12px", borderRadius: R.full, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                background: presetId === p.id ? C.brand : C.bg, color: presetId === p.id ? "#fff" : C.text2,
                border: `1px solid ${presetId === p.id ? C.brand : C.bgWarm}` }}>
              {p.issue}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: S.sm, marginBottom: S.sm }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>이슈/트렌드</div>
            <input value={issue} onChange={e => setIssue(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>지역(선택)</div>
            <input value={region} onChange={e => setRegion(e.target.value)} placeholder="예) 부천"
              style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
          </div>
        </div>
        <div style={{ marginBottom: S.md }}>
          <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>공간 관점 재해석 (제목 방향 · 공간 관점 모드에서만 사용)</div>
          <input value={spaceAngle} onChange={e => setSpaceAngle(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
        </div>
        {/* Phase 20.7 — 생성 모드: 자동(AI 추천) 기본 + 고급 설정 펼치기 */}
        <div style={{ marginBottom: S.md }}>
          <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>생성 모드</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => setGenMode("auto")} title="주제만 입력하면 AI 가 글 성격을 분석해 최적 전략을 자동 선택합니다."
              style={{ padding: "6px 14px", borderRadius: R.full, fontSize: 12, fontWeight: 800, cursor: "pointer",
                background: genMode === "auto" ? C.brand : C.bg, color: genMode === "auto" ? "#fff" : C.text2,
                border: `1px solid ${genMode === "auto" ? C.brand : C.bgWarm}` }}>
              🤖 자동 (AI 추천)
            </button>
            <button onClick={() => setShowAdvanced(s => !s)}
              style={{ padding: "6px 12px", borderRadius: R.full, fontSize: 11.5, fontWeight: 700, cursor: "pointer", background: C.bg, color: C.text3, border: `1px solid ${C.bgWarm}` }}>
              {showAdvanced ? "▾ 고급 설정" : "▸ 고급 설정"}
            </button>
          </div>
        </div>

        {/* 고급 설정(직접 설정) — 평소 숨김 */}
        {showAdvanced && (
          <div style={{ background: C.bg, borderRadius: R.md, border: `1px solid ${C.bgWarm}`, padding: S.md, marginBottom: S.md }}>
            <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>모드 직접 선택</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: S.sm }}>
              {[
                { id: "voice", label: "🎯 카테고리 톤", help: MODE_HELP.voice },
                { id: "space", label: "🌌 공간 관점", help: MODE_HELP.space },
                { id: "raw",   label: "🪨 원석 지식", help: MODE_HELP.raw },
              ].map(m => (
                <button key={m.id} onClick={() => setGenMode(m.id)} title={m.help}
                  style={{ padding: "6px 12px", borderRadius: R.full, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                    background: genMode === m.id ? C.brandD : "#fff", color: genMode === m.id ? "#fff" : C.text2,
                    border: `1px solid ${genMode === m.id ? C.brandD : C.bgWarm}` }}>
                  {m.label} <span style={{ opacity: 0.7 }}>ⓘ</span>
                </button>
              ))}
            </div>
            {genMode !== "space" && genMode !== "auto" && (
              <div style={{ display: "flex", gap: S.lg, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>Prompt Version</div>
                  <div style={{ display: "flex", gap: 5 }}>
                    {PROMPT_VERSIONS.map(v => (
                      <button key={v.id} onClick={() => setPromptVersion(v.id)} title={VERSION_HELP[v.id]}
                        style={{ padding: "5px 10px", borderRadius: R.md, fontSize: 11, fontWeight: 700, cursor: "pointer",
                          background: promptVersion === v.id ? C.brand : "#fff", color: promptVersion === v.id ? "#fff" : C.text2,
                          border: `1px solid ${promptVersion === v.id ? C.brand : C.bgWarm}` }}>
                        {v.label} <span style={{ opacity: 0.7 }}>ⓘ</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div title={TEMPERATURE_HELP}>
                  <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>Temperature {temperature.toFixed(1)} <span style={{ opacity: 0.7 }}>ⓘ</span></div>
                  <input type="range" min="0" max="1" step="0.1" value={temperature} onChange={e => setTemperature(Number(e.target.value))} style={{ width: 120 }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 자동모드가 선택한 전략 표시 */}
        {genMode === "auto" && autoStrat && (
          <div style={{ background: "#0f2e26", borderRadius: R.md, padding: "9px 12px", marginBottom: S.md, color: "#fff" }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: "#8fe3c4" }}>AI 분석 결과</span>
            <span style={{ fontSize: 12, marginLeft: 8 }}>{autoStrat.chain.join(" → ")}</span>
            <span style={{ fontSize: 11, color: "#a9c9bd", marginLeft: 8 }}>· 예상 스타일 “{autoStrat.style}”</span>
          </div>
        )}

        <button onClick={handleGenerate} disabled={generating}
          style={{ padding: "10px 18px", background: generating ? C.text4 : C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 700, fontSize: 13, cursor: generating ? "default" : "pointer" }}>
          {generating ? "생성 중…" : (genMode === "auto" ? "🤖 AI 자동 생성" : "✨ 초안 생성")}
        </button>
        {/* OpenRouter 상태 개선 */}
        {(() => {
          const st = openRouterStatus();
          return st.connected ? (
            <span style={{ marginLeft: 10, fontSize: 11, color: C.text2 }}>
              🟢 OpenRouter 연결됨 · {st.model}
              {st.avgLatencySec != null ? ` · 평균 ${st.avgLatencySec}초` : ""}
              {st.todayCount > 0 ? ` · 오늘 ${st.todayCount}회 · ₩${st.todayCostKRW}` : ""}
            </span>
          ) : (
            <span style={{ marginLeft: 10, fontSize: 11, color: C.gold }}>⚪ LLM 미설정 (VITE_LLM_API_KEY 필요)</span>
          );
        })()}

        {preview && (
          <div style={{ marginTop: S.lg, background: C.bg, borderRadius: R.lg, padding: S.md, border: `1px solid ${C.bgWarm}` }}>
            <div style={{ fontSize: 10, color: C.text3, marginBottom: 4 }}>카테고리: {catLabel(preview.category)}</div>

            {/* Phase 8 — 초안 품질 미리보기 */}
            {previewQuality && (
              <div style={{ background: "#fff", border: `1px solid ${C.bgWarm}`, borderRadius: R.md, padding: "8px 10px", marginBottom: S.sm, fontSize: 11 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <span style={{ background: C.brandL, color: C.brandD, borderRadius: R.full, padding: "2px 8px", fontWeight: 700 }}>톤: {previewQuality.v.label}</span>
                  <span style={{ color: C.text3 }}>공간 연결: {previewQuality.policyLabel} (강도 {previewQuality.u.spaceRelevanceAux})</span>
                  <span style={{ color: previewQuality.forced > 0 ? C.red : C.brand, fontWeight: 700 }}>
                    {previewQuality.forced > 0 ? `⚠️ 억지 연결 ${previewQuality.forced}건` : "✅ 억지 연결 없음"}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 5 }}>
                  <span style={{ padding: "2px 8px", borderRadius: R.full, fontWeight: 800, background: previewQuality.u.recommendPublish ? C.brandL : (C.red + "22"), color: previewQuality.u.recommendPublish ? C.brandD : C.red }}>
                    유용성 {previewQuality.u.total}점
                  </span>
                  <span style={{ color: C.text3 }}>저장가치 {previewQuality.u.saveValue}</span>
                  <span style={{ color: C.text3 }}>· 정보 {previewQuality.u.axes.infoValue} · 도움 {previewQuality.u.axes.realHelp} · 적합 {previewQuality.u.axes.categoryFit} · 자연스러움 {previewQuality.u.axes.naturalness}</span>
                  <span style={{ marginLeft: "auto", fontWeight: 800, color: previewQuality.u.recommendPublish ? C.brand : C.text3 }}>
                    {previewQuality.u.recommendPublish ? "👍 발행 추천" : "✍️ 보강 권장"}
                  </span>
                </div>
              </div>
            )}

            {/* Phase 11 — AI Editor Workbench: Confidence · AI 분석 · Quality Panel */}
            {workbench && (
              <div style={{ background: "#111827", borderRadius: R.md, padding: "10px 12px", marginBottom: S.sm }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: workbench.meta.confidence >= 80 ? "#6ee7b7" : workbench.meta.confidence >= 60 ? "#fcd34d" : "#fca5a5" }}>
                    {workbench.meta.confidence}%
                  </span>
                  <span style={{ fontSize: 10.5, color: "#9ca3af" }}>AI Confidence</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: R.full, fontWeight: 800, background: workbench.meta.source === "llm" ? "#065f46" : "#374151", color: "#e5e7eb" }}>
                    {workbench.meta.source === "llm" ? "LLM" : "Mock 폴백"}
                  </span>
                </div>
                {/* AI 분석 + 관리자 로그(Provider/Model/Latency/Tokens/Editorial) */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 10.5, color: "#d1d5db", marginBottom: 8 }}>
                  <span style={{ background: "#1f2937", borderRadius: R.full, padding: "2px 8px" }}>톤: {workbench.result.tone?.slice(0, 20) || "-"}</span>
                  <span style={{ background: "#1f2937", borderRadius: R.full, padding: "2px 8px" }}>유용성 {workbench.quality.usefulness}</span>
                  <span style={{ background: "#134e2b", color: "#a7f3d0", borderRadius: R.full, padding: "2px 8px", fontWeight: 700 }}>Editorial {workbench.meta.editorialScore}</span>
                  <span style={{ background: "#1f2937", borderRadius: R.full, padding: "2px 8px" }}>읽기 {workbench.result.readingMinutes}분</span>
                  <span style={{ background: "#1f2937", borderRadius: R.full, padding: "2px 8px" }}>{workbench.meta.llmProvider} · {workbench.meta.llmModel}</span>
                  <span style={{ background: "#1f2937", borderRadius: R.full, padding: "2px 8px" }}>{workbench.meta.latencyMs}ms</span>
                  <span style={{ background: "#1f2937", borderRadius: R.full, padding: "2px 8px" }}>
                    tok {workbench.meta.promptTokens ?? "?"}+{workbench.meta.completionTokens ?? "?"}={workbench.meta.totalTokens ?? workbench.meta.tokensEstimated}
                  </span>
                </div>
                {/* Quality Panel */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))", gap: 6 }}>
                  {[
                    { k: "정보성", v: workbench.quality.infoValue },
                    { k: "자연스러움", v: workbench.quality.naturalness },
                    { k: "중복", v: workbench.quality.duplication.label, raw: workbench.quality.duplication.score, invert: true },
                    { k: "SEO", v: workbench.quality.seo },
                    { k: "제목", v: workbench.quality.title },
                    { k: "읽기난이도", v: workbench.quality.readability.label, raw: workbench.quality.readability.score },
                  ].map(m => {
                    const val = typeof m.raw === "number" ? m.raw : m.v;
                    const good = m.invert ? val < 40 : val >= 70;
                    const mid = m.invert ? val < 60 : val >= 50;
                    return (
                      <div key={m.k} style={{ background: "#1f2937", borderRadius: R.sm, padding: "6px 8px" }}>
                        <div style={{ fontSize: 9, color: "#9ca3af" }}>{m.k}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: good ? "#6ee7b7" : mid ? "#fcd34d" : "#fca5a5" }}>{m.v}</div>
                      </div>
                    );
                  })}
                </div>
                {workbench.quality.duplication.nearest && (
                  <div style={{ fontSize: 10, color: "#fca5a5", marginTop: 6 }}>⚠️ 유사 기존 글: {workbench.quality.duplication.nearest}</div>
                )}
              </div>
            )}

            <input value={preview.title} onChange={e => setPreview(p => ({ ...p, title: e.target.value }))}
              style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.bgWarm}`, borderRadius: R.sm, fontSize: 13, fontWeight: 700, outline: "none", boxSizing: "border-box", marginBottom: S.sm, fontFamily: "inherit" }} />
            <textarea value={preview.content} onChange={e => setPreview(p => ({ ...p, content: e.target.value }))} rows={10}
              style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.bgWarm}`, borderRadius: R.sm, fontSize: 12.5, outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical", lineHeight: 1.6 }} />

            {/* Phase 11 — 편집: 요약 · 태그 · 키워드 (워크벤치 결과 편집) */}
            {workbench && (
              <div style={{ marginTop: S.sm, display: "flex", flexDirection: "column", gap: 6 }}>
                <div>
                  <div style={{ fontSize: 10, color: C.text3, marginBottom: 2 }}>요약</div>
                  <textarea value={preview.summary ?? ""} onChange={e => setPreview(p => ({ ...p, summary: e.target.value }))} rows={2}
                    style={{ width: "100%", padding: "6px 9px", border: `1px solid ${C.bgWarm}`, borderRadius: R.sm, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }} />
                </div>
                <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 10, color: C.text3, marginBottom: 2 }}>태그 (콤마 구분)</div>
                    <input value={(preview.tags ?? []).join(", ")} onChange={e => editArrayField("tags", e.target.value)}
                      style={{ width: "100%", padding: "6px 9px", border: `1px solid ${C.bgWarm}`, borderRadius: R.sm, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 10, color: C.text3, marginBottom: 2 }}>키워드 (콤마 구분)</div>
                    <input value={(preview.keywords ?? []).join(", ")} onChange={e => editArrayField("keywords", e.target.value)}
                      style={{ width: "100%", padding: "6px 9px", border: `1px solid ${C.bgWarm}`, borderRadius: R.sm, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                  </div>
                </div>
                {/* SEO — Focus Keyword · Meta Description */}
                <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 10, color: C.text3, marginBottom: 2 }}>Focus Keyword (SEO)</div>
                    <input value={preview.focusKeyword ?? ""} onChange={e => setPreview(p => ({ ...p, focusKeyword: e.target.value }))}
                      style={{ width: "100%", padding: "6px 9px", border: `1px solid ${C.bgWarm}`, borderRadius: R.sm, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                  </div>
                  <div style={{ flex: 2, minWidth: 200 }}>
                    <div style={{ fontSize: 10, color: C.text3, marginBottom: 2 }}>Meta Description (SEO)</div>
                    <input value={preview.metaDescription ?? ""} onChange={e => setPreview(p => ({ ...p, metaDescription: e.target.value }))}
                      style={{ width: "100%", padding: "6px 9px", border: `1px solid ${C.bgWarm}`, borderRadius: R.sm, fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                  </div>
                </div>

                {/* LLM Prompt / Raw Response 보기 (개발/검수용) */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                  <button onClick={() => setShowPrompt(s => !s)}
                    style={{ padding: "5px 10px", background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    {showPrompt ? "▾" : "▸"} LLM Prompt ({workbench.meta.promptVersion})
                  </button>
                  <button onClick={() => setShowRaw(s => !s)}
                    style={{ padding: "5px 10px", background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    {showRaw ? "▾" : "▸"} Raw Response (JSON)
                  </button>
                </div>
                {showPrompt && (
                  <div style={{ background: "#0b1220", borderRadius: R.sm, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>system + user prompt</span>
                      <button onClick={() => { try { navigator.clipboard.writeText(`${workbench.meta.prompt.system}\n\n---\n\n${workbench.meta.prompt.user}`); showToast?.("프롬프트 복사됨"); } catch {} }}
                        style={{ padding: "2px 8px", background: "#1f2937", color: "#e5e7eb", border: "none", borderRadius: R.sm, fontSize: 10, cursor: "pointer" }}>📋 복사</button>
                    </div>
                    <pre style={{ margin: 0, fontSize: 10.5, color: "#cbd5e1", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 220, overflow: "auto" }}>{workbench.meta.prompt.system}{"\n\n"}{workbench.meta.prompt.user}</pre>
                  </div>
                )}
                {showRaw && (
                  <div style={{ background: "#0b1220", borderRadius: R.sm, padding: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>LLM raw response · {workbench.meta.llmModel}</span>
                      <button onClick={() => { try { navigator.clipboard.writeText(workbench.meta.rawResponse ?? ""); showToast?.("Raw 복사됨"); } catch {} }}
                        style={{ padding: "2px 8px", background: "#1f2937", color: "#e5e7eb", border: "none", borderRadius: R.sm, fontSize: 10, cursor: "pointer" }}>📋 복사</button>
                    </div>
                    <pre style={{ margin: 0, fontSize: 10.5, color: "#cbd5e1", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 220, overflow: "auto" }}>{workbench.meta.rawResponse ?? "(Mock 폴백 — LLM 응답 없음)"}</pre>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: S.sm, marginTop: S.sm }}>
              <button onClick={handleSaveDraft} disabled={saving}
                style={{ padding: "8px 16px", background: C.brandD, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                {saving ? "저장 중..." : "📝 초안으로 저장"}
              </button>
              <button onClick={() => { setPreview(null); setWorkbench(null); }}
                style={{ padding: "8px 16px", background: C.bg, color: C.text3, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
                취소
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Phase 2 — Trend Queue: 수집된 이슈(현재 draft/scheduled 중 ai_topic 보유)를
          추천점수·우선순위·카테고리 신뢰도와 함께 보여준다. 실제 승인/발행 조작은
          바로 아래 "검수 대기 · 예약 목록"에서 한다(중복 액션 버튼 없이 정보만 여기 표시). */}
      <div style={{ background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.xl }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: S.md, flexWrap: "wrap", gap: S.sm }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>
            📡 Trend Queue ({trendQueue.length})
          </div>
          <button onClick={handleCheckTrendsNow} disabled={checkingTrends}
            style={{ padding: "6px 14px", background: C.bg, color: C.brand, border: `1px solid ${C.brandM}`, borderRadius: R.lg, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            {checkingTrends ? "확인 중..." : "🔎 지금 트렌드 확인"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: C.text3, marginBottom: S.sm, lineHeight: 1.6 }}>
          3시간마다 자동 수집(Vercel Cron) + 수동 확인 버튼. 중복 이슈(48시간 이내 동일 title/topic)는
          자동으로 걸러지며, 결과는 항상 초안(DRAFT)으로만 저장됩니다(자동 발행 없음).
        </div>
        {trendCheckResult && (
          <div style={{ fontSize: 11, color: C.text3, marginBottom: S.sm, background: C.bg, borderRadius: R.sm, padding: "6px 10px" }}>
            수집 {trendCheckResult.collected ?? 0}건 · 중복 제외 후 {trendCheckResult.deduped ?? 0}건 · 초안 생성 {trendCheckResult.created ?? 0}건
          </div>
        )}
        {trendQueue.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: C.text3, fontSize: 12.5 }}>대기 중인 트렌드 이슈가 없습니다</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {trendQueue.map(q => (
              <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.bg}`, fontSize: 11.5, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, color: C.text1, minWidth: 90 }}>{q.ai_topic}</span>
                <span>{PRIORITY_LABEL[q._priority]}</span>
                <span style={{ color: C.text3 }}>점수 {q._score}</span>
                <span style={{ color: C.brand }}>{catLabel(q.category)}{q._categoryConfidence === "low" ? "(추정)" : ""}</span>
                <span style={{ color: C.text4, marginLeft: "auto" }}>{q.created_at ? new Date(q.created_at).toLocaleString("ko-KR") : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ⑦⑧ 검수/수정 · 예약 발행 대기열 */}
      <div style={{ background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.xl }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.md }}>
          검수 대기 · 예약 목록 ({drafts.length})
        </div>
        {fetchErr && <div style={{ fontSize: 12, color: C.red, marginBottom: S.sm }}>⚠️ {fetchErr}</div>}
        {loading ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: C.text3, fontSize: 13 }}>불러오는 중...</div>
        ) : drafts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: C.text3, fontSize: 13 }}>초안이 없습니다. 위에서 새 초안을 만들어보세요.</div>
        ) : drafts.map(d => (
          <div key={d.id} style={{ padding: `${S.sm}px 0`, borderBottom: `1px solid ${C.bg}` }}>
            <div style={{ display: "flex", gap: S.xs, alignItems: "center", marginBottom: 3, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.brand, background: C.brandL, borderRadius: R.sm, padding: "1px 7px" }}>
                {catLabel(d.category)}
              </span>
              <span style={{ fontSize: 10, fontWeight: 700, color: d.publish_status === "scheduled" ? "#8A6D2A" : C.text4 }}>
                {d.publish_status === "scheduled" ? `예약됨 · ${d.scheduled_at ? new Date(d.scheduled_at).toLocaleString("ko-KR") : ""}` : "초안"}
              </span>
              {d.ai_topic && <span style={{ fontSize: 10, color: C.text4 }}>· 이슈: {d.ai_topic}</span>}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text1, marginBottom: 2 }}>{d.title}</div>
            <div style={{ fontSize: 11, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6 }}>
              {(d.content ?? "").replace(/\n/g, " ").slice(0, 80)}…
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={() => handlePublishNow(d.id)}
                style={{ padding: "5px 12px", background: C.brand, color: "#fff", border: "none", borderRadius: R.sm, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                즉시 발행
              </button>
              <input type="datetime-local" value={scheduleFor[d.id] ?? ""} onChange={e => setScheduleFor(s => ({ ...s, [d.id]: e.target.value }))}
                style={{ padding: "5px 8px", border: `1px solid ${C.bgWarm}`, borderRadius: R.sm, fontSize: 11, fontFamily: "inherit" }} />
              <button onClick={() => handleSchedule(d.id)}
                style={{ padding: "5px 12px", background: "#C4A96A22", color: "#8A6D2A", border: "1px solid #C4A96A", borderRadius: R.sm, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                예약 발행
              </button>
              <button onClick={() => handleDeleteDraft(d.id)}
                style={{ padding: "5px 12px", background: "#FEF0F0", color: C.red, border: "none", borderRadius: R.sm, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ⑩ 카테고리별 콘텐츠 축적(경량 Analytics) */}
      <div style={{ background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}` }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.md }}>
          발행된 AI 콘텐츠 · 카테고리별 누적 ({published.length}건)
        </div>
        {Object.keys(byCategory).length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: C.text3, fontSize: 13 }}>아직 발행된 콘텐츠가 없습니다</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(byCategory).map(([cat, stat]) => (
              <div key={cat} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.bg}`, fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: C.text1 }}>{catLabel(cat)}</span>
                <span style={{ color: C.text3 }}>{stat.count}건 · 조회 {stat.views} · 좋아요 {stat.likes} · 댓글 {stat.comments}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const CHECKPOINT_LABEL = {
  site_visit: "현장방문 견적", start: "착공 확인", middle: "중간점검", complete: "완료 확인",
};
const fmtCpTs = (ts) => { try { return new Date(ts).toLocaleString("ko-KR"); } catch { return "-"; } };
const copyText = (t) => { try { navigator.clipboard?.writeText(t); } catch { /* noop */ } };

// 관리자 현장 기록 — 유형/시간/업로더/전체·도로명·지번 주소/행정구역/좌표/정확도/사진/메모 + 복사·지도.
function AdminCheckpoints({ requestId, adminUserId }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!requestId) return;
    let alive = true;
    getProjectCheckpoints(requestId, adminUserId)
      .then(({ data }) => { if (alive && Array.isArray(data)) setRows(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [requestId, adminUserId]);
  if (rows.length === 0) return null;
  const mini = { fontSize: 10, fontWeight: 700, color: C.brand, background: C.brandL, border: "none", borderRadius: R.sm, padding: "3px 7px", cursor: "pointer" };
  return (
    <div style={{ background: C.bg, borderRadius: R.lg, padding: S.md, marginBottom: S.md }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.text2, marginBottom: 8 }}>📍 현장 기록 (GPS 체크포인트)</div>
      {rows.map((cp) => {
        const addr = cp.address_full || cp.road_address || cp.jibun_address || "주소 미확인";
        const hasCoord = cp.lat != null && cp.lng != null;
        const lowAcc = cp.accuracy != null && cp.accuracy > 30;
        return (
          <div key={cp.id} style={{ borderTop: `1px solid ${C.bgWarm}`, paddingTop: 8, marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.text1, marginBottom: 2 }}>
              {CHECKPOINT_LABEL[cp.checkpoint_type] ?? cp.checkpoint_type}
            </div>
            <div style={{ fontSize: 12, color: C.text2 }}>📍 {addr}</div>
            {(cp.road_address || cp.jibun_address) && (
              <div style={{ fontSize: 10, color: C.text4, lineHeight: 1.6 }}>
                {cp.road_address ? `도로명 ${cp.road_address}` : ""}{cp.road_address && cp.jibun_address ? " · " : ""}{cp.jibun_address ? `지번 ${cp.jibun_address}` : ""}
              </div>
            )}
            <div style={{ fontSize: 10, color: C.text4, marginTop: 2 }}>
              {[cp.sido, cp.sigungu, cp.dong, cp.bunji].filter(Boolean).join(" ")}
            </div>
            <div style={{ fontSize: 10, color: C.text4, marginTop: 2 }}>
              {fmtCpTs(cp.captured_at)}
              {cp.accuracy != null ? ` · 정확도 ${Math.round(cp.accuracy)}m` : ""}
              {lowAcc ? " ⚠️" : ""}
              {Array.isArray(cp.photos) && cp.photos.length ? ` · 사진 ${cp.photos.length}장` : ""}
            </div>
            {hasCoord && (
              <div style={{ fontSize: 10, color: C.text4, marginTop: 2 }}>좌표 {Number(cp.lat).toFixed(6)}, {Number(cp.lng).toFixed(6)}</div>
            )}
            {cp.note && <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>메모: {cp.note}</div>}
            {Array.isArray(cp.photos) && cp.photos.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {cp.photos.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer" style={{ display: "block", width: 48, height: 48, borderRadius: R.sm, overflow: "hidden", border: `1px solid ${C.bgWarm}` }}>
                    <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </a>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {addr !== "주소 미확인" && <button style={mini} onClick={() => copyText(addr)}>주소 복사</button>}
              {hasCoord && <button style={mini} onClick={() => copyText(`${cp.lat},${cp.lng}`)}>좌표 복사</button>}
              {hasCoord && <a style={{ ...mini, textDecoration: "none" }} href={`https://map.kakao.com/link/map/${encodeURIComponent(addr)},${cp.lat},${cp.lng}`} target="_blank" rel="noreferrer">지도에서 보기</a>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 관리자 운영 도구 — 테스트/꼬인 거래 강제 정리(soft_cancel 기본 / hard_delete 옵션).
// role='admin' 만 RPC 통과. 모든 실행은 admin_logs 기록.
function AdminCleanupTool({ adminUserId, showToast }) {
  const [reqId, setReqId]   = useState("");
  const [userId, setUserId] = useState("");
  const [coId, setCoId]     = useState("");
  const [mode, setMode]     = useState("soft_cancel");
  const [busy, setBusy]     = useState(false);
  const [result, setResult] = useState(null);
  const [confirmHard, setConfirmHard] = useState(null);

  const run = async (fn, label) => {
    setBusy(true); setResult(null);
    const { data, error } = await fn();
    setBusy(false);
    if (error) { showToast?.(`정리 실패: ${error.message ?? ""}`, false); setResult({ error: error.message }); return; }
    setResult({ label, data });
    showToast?.(`${label} 완료`);
  };
  const guard = (fn, label) => {
    if (mode === "hard_delete_test_only") { setConfirmHard({ run: () => run(fn, label), label }); return; }
    run(fn, label);
  };

  const inp = { width: "100%", padding: "11px 13px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 8, fontFamily: "inherit", color: C.text1, background: C.surface };
  const btn = (bg, fg, disabled) => ({ flex: 1, minWidth: 130, padding: "11px", background: disabled ? C.bgWarm : bg, color: disabled ? C.text4 : fg, border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer" });

  return (
    <div>
      <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.lg }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 4 }}>🧹 데이터 정리 / 운영 도구</div>
        <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.6, marginBottom: S.lg }}>
          테스트/꼬인 거래를 강제 정리합니다. 기본은 <b>화면 숨김/취소(soft)</b>이며, hard delete 는 테스트 데이터에만 사용하세요.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: S.lg }}>
          {[["soft_cancel", "A. 숨김/취소(권장)"], ["hard_delete_test_only", "B. 완전삭제(테스트)"]].map(([v, l]) => (
            <button key={v} onClick={() => setMode(v)}
              style={{ flex: 1, padding: "9px", borderRadius: R.md, fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: mode === v ? (v === "hard_delete_test_only" ? "#7A1F1F" : C.brand) : C.bg,
                color: mode === v ? "#fff" : C.text2, border: `1px solid ${mode === v ? "transparent" : C.bgWarm}` }}>{l}</button>
          ))}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 4 }}>request_id</div>
        <input value={reqId} onChange={e => setReqId(e.target.value.trim())} placeholder="요청 UUID" style={inp} />
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 4 }}>user_id (의뢰인)</div>
        <input value={userId} onChange={e => setUserId(e.target.value.trim())} placeholder="사용자 UUID" style={inp} />
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 4 }}>company_id</div>
        <input value={coId} onChange={e => setCoId(e.target.value.trim())} placeholder="업체 UUID" style={{ ...inp, marginBottom: S.lg }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button disabled={busy || !reqId} onClick={() => guard(() => adminCleanupRequest(adminUserId, reqId, mode), "request 정리")} style={btn(C.brand, "#fff", busy || !reqId)}>꼬인 진행건/Request 정리</button>
          <button disabled={busy || !userId} onClick={() => guard(() => adminCleanupUserTestData(adminUserId, userId, mode), "user 정리")} style={btn(C.brand, "#fff", busy || !userId)}>user 단위 정리</button>
          <button disabled={busy || !coId} onClick={() => guard(() => adminCleanupCompanyTestData(adminUserId, coId, mode), "company 정리")} style={btn(C.brand, "#fff", busy || !coId)}>company 단위 정리</button>
        </div>
        {result && (
          <div style={{ marginTop: S.lg, background: C.bg, borderRadius: R.md, padding: S.md, fontSize: 11, color: C.text2, fontFamily: "monospace", lineHeight: 1.7, wordBreak: "break-all" }}>
            {result.error ? `❌ ${result.error}` : `✅ ${result.label}: ${JSON.stringify(result.data)}`}
          </div>
        )}
      </div>
      {confirmHard && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: 24, width: "100%", maxWidth: 360 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#7A1F1F", marginBottom: 8 }}>완전 삭제 확인</div>
            <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.7, marginBottom: 18 }}>
              이 작업은 <b>테스트 데이터만 정리</b>합니다. 실제 운영 데이터에는 사용하지 마세요.<br />
              ({confirmHard.label} · hard delete)
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmHard(null)} style={{ flex: 1, padding: "11px", background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.md, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>취소</button>
              <button onClick={() => { const r = confirmHard.run; setConfirmHard(null); r(); }} style={{ flex: 1, padding: "11px", background: "#7A1F1F", color: "#fff", border: "none", borderRadius: R.md, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>삭제 진행</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_MAP = {
  pending:  { label: "대기중", color: C.gold,  bg: "#FBF5E8" },
  approved: { label: "승인",   color: C.green, bg: C.greenL  },
  rejected: { label: "반려",   color: C.red,   bg: "#FFF0F0" },
};

const normalizeCompany = (row) => ({
  id:            row.id,
  name:          row.name ?? "업체",
  badge:         row.badge ?? "basic",
  temp:          row.temp ?? 36.5,
  phone:         row.phone ?? "",
  ownerId:       row.owner_id ?? null,
  companyStatus: row.company_status ?? "PENDING",
  submittedAt:   row.created_at
    ? new Date(row.created_at).toLocaleDateString("ko-KR")
    : "",
  status: row.doc_status === "draft" ? "pending" : (row.doc_status ?? "pending"),
  docs: [
    { label: "사업자등록증",    submitted: !!row.biz_cert_url },
    { label: "시공보험 가입증", submitted: !!row.insurance_url || !!row.has_insurance },
    { label: "통장 사본",       submitted: !!row.bank_account_url },
    { label: "대표자 신분증",   submitted: !!row.id_card_url },
  ],
  deposit:    row.deposit_amount ?? 0,
  hasInsurance: !!row.insurance_url || !!row.has_insurance,
  rejectNote: row.reject_note ?? "",
  // 공간보증(068) — 표시/관리용 pass-through.
  guarantee_grade:         row.guarantee_grade ?? null,
  guarantee_amount:        row.guarantee_amount ?? null,
  guarantee_status:        row.guarantee_status ?? "NONE",
  guarantee_badge_visible: row.guarantee_badge_visible ?? false,
  guarantee_updated_at:    row.guarantee_updated_at ?? null,
});

const normalizeCustomer = (row) => ({
  id:       row.id,
  name:     row.name ?? "고객",
  phone:    row.phone ?? "",
  region:   row.region ?? "",
  requests: 0,
  joinedAt: row.created_at
    ? new Date(row.created_at).toLocaleDateString("ko-KR")
    : "",
  // 계정 상태 / 공간경제(토큰·온도) — 서버(/api/admin/users)가 반환하는 원본 값 매핑.
  accountStatus: row.account_status ?? "NORMAL",
  spaceTokens:   row.space_tokens ?? 0,
  spaceTemp:     row.space_temp ?? 36.5,
  // 본인인증 — JSX 가 참조하는 원본 필드 보존(매핑 누락 시 항상 '미인증' 표시되던 문제 해소).
  is_identity_verified:        row.is_identity_verified ?? false,
  identity_verified_at:        row.identity_verified_at ?? null,
  identity_provider:           row.identity_provider ?? null,
  identity_verification_status: row.identity_verification_status ?? null,
});

// ── 라운지 운영(seed) 글 관리 탭 — lounge_posts.is_seed=true 전체 관리 ─────────
// 새 글 생성 화면이 아니라, 이미 등록된 운영 seed 글의 노출/추천/숨김을 관리한다.
function SeedPostsManagerTab({ posts = [], loading = false, fetchErr = null, adminUserId, showToast, onReload }) {
  const [busyId, setBusyId]     = useState(null);
  const [expandId, setExpandId] = useState(null);
  const [prioDraft, setPrioDraft] = useState({}); // { [id]: number }

  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" }) : "";
  const catLabel = (id) => CATEGORY_LABEL[id] ?? id;

  const run = async (id, fn, okMsg) => {
    if (busyId) return;
    setBusyId(id);
    try {
      const { error } = await fn();
      if (error) { showToast?.(`실패: ${error.message ?? error}`, false); }
      else { showToast?.(okMsg); await onReload?.(); }
    } catch (e) {
      showToast?.(`실패: ${e?.message ?? e}`, false);
    } finally {
      setBusyId(null);
    }
  };

  const toggleVisible = (p) => run(p.id, () => setSeedPostVisible(p.id, !(p.is_visible !== false)),
    (p.is_visible !== false) ? "비활성(숨김 노출) 처리했어요" : "활성(노출) 처리했어요");
  const toggleHot = (p) => run(p.id, () => rpcSetPostHot(p.id, !p.is_hot, p.hot_priority ?? 0, adminUserId),
    p.is_hot ? "추천 해제했어요" : "추천글로 등록했어요");
  const savePriority = (p) => {
    const v = Number(prioDraft[p.id] ?? p.hot_priority ?? 0) || 0;
    return run(p.id, () => rpcSetPostHot(p.id, p.is_hot, v, adminUserId), `우선순위 ${v} 저장했어요`);
  };
  const toggleHidden = (p) => run(p.id, () => rpcSetPostHidden(p.id, !p.is_hidden, adminUserId),
    p.is_hidden ? "복구했어요" : "숨김 처리했어요");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: S.lg }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>🌱 라운지 운영글 관리 <span style={{ color: C.brand, fontSize: 14 }}>{posts.length}</span></div>
        <button onClick={() => onReload?.()}
          style={{ padding: "8px 14px", background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          새로고침
        </button>
      </div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: S.md, lineHeight: 1.6 }}>
        lounge_posts 의 운영글(is_seed=true)을 관리합니다. 활성/비활성·추천·우선순위·숨김/복구를 처리할 수 있어요.
      </div>

      {fetchErr && (
        <div style={{ background: "#FFF0F0", border: `1px solid ${C.red}33`, borderRadius: R.lg, padding: S.md, marginBottom: S.md }}>
          <div style={{ fontSize: 12, color: C.red, fontWeight: 700 }}>⚠️ 운영글 목록 로드 실패</div>
          <div style={{ fontSize: 11, color: C.red, marginTop: 4, opacity: 0.85, wordBreak: "break-all" }}>{fetchErr}</div>
          <div style={{ fontSize: 10, color: C.text4, marginTop: 4 }}>
            /api/admin/seed-posts (service role) 연동 또는 SUPABASE_SERVICE_ROLE_KEY 설정을 확인하세요.
          </div>
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: R.xl, padding: S.lg, border: `1px solid ${C.bgWarm}` }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "30px 0", color: C.text3, fontSize: 13 }}>불러오는 중...</div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🌱</div>
            <div style={{ fontSize: 14, color: C.text3 }}>운영글(is_seed=true)이 없습니다</div>
            <div style={{ fontSize: 12, color: C.text4, marginTop: 6 }}>019~021 시드 마이그레이션 적용 여부를 확인하세요</div>
          </div>
        ) : posts.map(p => {
          const visible = p.is_visible !== false;
          const busy = busyId === p.id;
          return (
            <div key={p.id} style={{ padding: `${S.md}px 0`, borderBottom: `1px solid ${C.bg}` }}>
              <div style={{ display: "flex", gap: S.xs, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.brand, background: C.brandL, borderRadius: R.sm, padding: "1px 7px" }}>{catLabel(p.category)}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: visible && !p.is_hidden ? "#27AE60" : C.text4 }}>{visible && !p.is_hidden ? "활성" : "비활성"}</span>
                {p.is_hidden && <span style={{ fontSize: 10, fontWeight: 700, color: C.red, background: "#FEF0F0", borderRadius: R.sm, padding: "1px 6px" }}>숨김</span>}
                {p.is_hot && <span style={{ fontSize: 10, fontWeight: 700, color: "#B8860B", background: "#FFF6DC", borderRadius: R.sm, padding: "1px 6px" }}>★추천 p{p.hot_priority ?? 0}</span>}
                <span style={{ fontSize: 10, color: C.text4, marginLeft: "auto" }}>{fmtDate(p.created_at)}</span>
              </div>
              {p.title && <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: 2 }}>{p.title}</div>}
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 6 }}>
                👁 {(p.view_count ?? 0).toLocaleString()} · ❤️ {p.like_count ?? 0} · 💬 {p.comment_count ?? 0}
              </div>

              {expandId === p.id && (
                <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.7, background: C.bg, borderRadius: R.md, padding: S.md, marginBottom: 8, whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto" }}>
                  {(p.content ?? "").slice(0, 1500)}{(p.content ?? "").length > 1500 ? "…" : ""}
                </div>
              )}

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={() => toggleVisible(p)} disabled={busy}
                  style={{ padding: "5px 10px", background: visible ? "#FEF0F0" : "#EAF7EE", color: visible ? C.red : "#27AE60", border: "none", borderRadius: R.sm, fontSize: 11, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
                  {visible ? "비활성" : "활성"}
                </button>
                <button onClick={() => toggleHot(p)} disabled={busy}
                  style={{ padding: "5px 10px", background: p.is_hot ? "#F3EFE0" : "#FFF6DC", color: "#B8860B", border: "none", borderRadius: R.sm, fontSize: 11, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
                  {p.is_hot ? "추천해제" : "추천등록"}
                </button>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <input type="number" value={prioDraft[p.id] ?? p.hot_priority ?? 0}
                    onChange={e => setPrioDraft(d => ({ ...d, [p.id]: e.target.value }))}
                    style={{ width: 46, padding: "4px 6px", border: `1px solid ${C.bgWarm}`, borderRadius: R.sm, fontSize: 11, color: C.text1, background: "#fff" }} />
                  <button onClick={() => savePriority(p)} disabled={busy}
                    style={{ padding: "5px 8px", background: C.brandL, color: C.brand, border: "none", borderRadius: R.sm, fontSize: 11, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>순위저장</button>
                </span>
                <button onClick={() => toggleHidden(p)} disabled={busy}
                  style={{ padding: "5px 10px", background: p.is_hidden ? "#EAF7EE" : "#FEF0F0", color: p.is_hidden ? "#27AE60" : C.red, border: "none", borderRadius: R.sm, fontSize: 11, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
                  {p.is_hidden ? "복구" : "숨김"}
                </button>
                <button onClick={() => setExpandId(expandId === p.id ? null : p.id)}
                  style={{ padding: "5px 10px", background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.sm, fontSize: 11, fontWeight: 700, cursor: "pointer", marginLeft: "auto" }}>
                  {expandId === p.id ? "닫기" : "상세"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 포토후기 시딩 탭 ──────────────────────────────────────────────────────────
function SeedReviewTab() {
  const [seeds, setSeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({ before: false, after: false });
  const [uploadDiag, setUploadDiag] = useState(null);
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState(null);
  const emptyForm = {
    category: "", space_type: "", region: "", user_name: "",
    masked_company_name: "", content: "", rating: 5,
    before_image_url: "", after_image_url: "", sort_order: 0, is_active: true,
  };
  const [form, setForm] = useState(emptyForm);

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  const loadSeeds = async () => {
    setLoading(true);
    const { data } = await getSeedReviews({ limit: 50, activeOnly: false });
    setSeeds(data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadSeeds(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = (nextOrder = 0) => {
    setForm({ ...emptyForm, sort_order: nextOrder });
    setEditId(null);
  };

  const handleEdit = (s) => {
    setEditId(s.id);
    setForm({
      category: s.category ?? "", space_type: s.space_type ?? "",
      region: s.region ?? "", user_name: s.user_name ?? "",
      masked_company_name: s.masked_company_name ?? "", content: s.content ?? "",
      rating: s.rating ?? 5, before_image_url: s.before_image_url ?? "",
      after_image_url: s.after_image_url ?? "", sort_order: s.sort_order ?? 0,
      is_active: s.is_active ?? true,
    });
    // 수정 폼은 목록 위(상단)에 있어 카드에서 누르면 화면 변화가 안 보임 → 폼으로 스크롤 + 안내.
    showToast("✏️ 수정 모드 — 상단 폼에서 편집 후 [수정 저장]을 눌러주세요");
    try {
      document.getElementById("seed-review-edit-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {}
  };

  const handleUpload = async (file, slot) => {
    setUploading(p => ({ ...p, [slot]: true }));
    setUploadDiag(null);
    const { url, error, _diag } = await uploadSeedReviewImage(file, slot);
    setUploading(p => ({ ...p, [slot]: false }));
    if (error) {
      setUploadDiag(_diag ?? { upload_error: String(error) });
      showToast("업로드 실패: " + (_diag?.upload_error ?? "unknown"), false);
      return;
    }
    setUploadDiag(null);
    setForm(p => ({ ...p, [slot === "before" ? "before_image_url" : "after_image_url"]: url }));
    showToast("업로드 완료");
  };

  const handleSave = async () => {
    if (!form.content.trim()) return showToast("후기 내용을 입력하세요", false);
    setSaving(true);
    const row = {
      category: form.category || null, space_type: form.space_type || null,
      region: form.region || null, user_name: form.user_name || null,
      masked_company_name: form.masked_company_name || null,
      content: form.content,
      rating: Number(form.rating),
      before_image_url: form.before_image_url || null,
      after_image_url: form.after_image_url || null,
      sort_order: Number(form.sort_order),
      is_active: form.is_active,
    };
    const { error } = editId
      ? await updateSeedReview(editId, row)
      : await createSeedReview(row);
    setSaving(false);
    if (error) { showToast("저장 실패: " + error.message, false); return; }
    showToast(editId ? "수정 완료" : "등록 완료");
    resetForm(seeds.length + 1);
    loadSeeds();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("이 시딩 후기를 삭제하시겠습니까?")) return;
    await deleteSeedReview(id);
    showToast("삭제 완료");
    loadSeeds();
  };

  const handleToggle = async (s) => {
    await updateSeedReview(s.id, { is_active: !s.is_active });
    loadSeeds();
  };

  const inp = (field, label, placeholder = "") => (
    <div style={{ marginBottom: S.sm }}>
      <div style={{ fontSize: 11, color: C.text3, marginBottom: 3 }}>{label}</div>
      <input
        value={form[field]}
        onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
        placeholder={placeholder}
        style={{ width: "100%", padding: "8px 10px", borderRadius: R.md,
          border: `1px solid ${C.bgWarm}`, fontSize: 13, color: C.text1,
          background: C.surface, boxSizing: "border-box" }}
      />
    </div>
  );

  return (
    <div>
      {toast && (
        <div style={{ position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)",
          background: toast.ok ? C.brand : "#c0392b", color: "#fff",
          borderRadius: R.xl, padding: "10px 20px", fontSize: 13, fontWeight: 700, zIndex: 9999 }}>
          {toast.msg}
        </div>
      )}

      <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: 4 }}>포토후기 시딩</div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: S.lg }}>
        홈 화면에 표시할 BEFORE/AFTER 샘플 후기를 등록하세요. 실제 후기가 5개 이상이면 자동으로 숨겨집니다.
      </div>

      {/* SQL 안내 */}
      <div style={{ background: "#1a1a2e", color: "#7fff7f", borderRadius: R.md,
        padding: "10px 14px", fontSize: 10, fontFamily: "monospace", marginBottom: S.lg,
        lineHeight: 1.7 }}>
        <span style={{ color: "#ff0", fontWeight: 700 }}>Supabase에서 아래 SQL을 먼저 실행하세요:</span><br/>
        CREATE TABLE IF NOT EXISTS seed_reviews (<br/>
        &nbsp;&nbsp;id uuid PRIMARY KEY DEFAULT gen_random_uuid(),<br/>
        &nbsp;&nbsp;category text, space_type text, region text,<br/>
        &nbsp;&nbsp;user_name text, masked_company_name text,<br/>
        &nbsp;&nbsp;content text NOT NULL, rating int2 DEFAULT 5,<br/>
        &nbsp;&nbsp;before_image_url text, after_image_url text,<br/>
        &nbsp;&nbsp;sort_order int2 DEFAULT 0, is_active boolean DEFAULT true,<br/>
        &nbsp;&nbsp;created_at timestamptz DEFAULT now()<br/>
        );<br/>
        ALTER TABLE seed_reviews ENABLE ROW LEVEL SECURITY;<br/>
        CREATE POLICY "anon_read" ON seed_reviews FOR SELECT USING (true);<br/>
        CREATE POLICY "admin_all" ON seed_reviews USING (true) WITH CHECK (true);<br/>
        -- Storage 버킷: seed-review-images (public)
      </div>

      {/* Storage INSERT policy (이미지 업로드 실패 시 실행) */}
      <div style={{ background: "#1a2e1a", color: "#ffdd88", borderRadius: R.md,
        padding: "10px 14px", fontSize: 10, fontFamily: "monospace", marginBottom: S.lg,
        lineHeight: 1.7, border: "1px solid #c07000" }}>
        <span style={{ color: "#ff6644", fontWeight: 700 }}>⚠️ 이미지 업로드 실패 시 — Storage INSERT policy SQL:</span><br/>
        DROP POLICY IF EXISTS "seed-review-images 1l8aott_0" ON storage.objects;<br/>
        <br/>
        CREATE POLICY "seed_review_images_insert_public"<br/>
        ON storage.objects FOR INSERT TO public<br/>
        WITH CHECK (bucket_id = 'seed-review-images');
      </div>

      {/* 업로드 실패 DEV 진단 패널 */}
      {uploadDiag && (
        <div style={{ background: "#111", color: "#ff4444", borderRadius: R.md,
          padding: "8px 12px", fontSize: 10, fontFamily: "monospace", marginBottom: S.lg,
          lineHeight: 1.9, border: "1px solid #ff4444" }}>
          <span style={{ color: "#ff0", fontWeight: 700 }}>── upload 실패 진단 ──</span><br/>
          upload_bucket: {uploadDiag.upload_bucket ?? "—"}<br/>
          upload_path: {uploadDiag.upload_path ?? "—"}<br/>
          upload_error: {uploadDiag.upload_error ?? "—"}<br/>
          current_supabase_user_id: {uploadDiag.current_supabase_user_id ?? "null (비로그인)"}<br/>
          auth_role: {uploadDiag.auth_role ?? "—"}<br/>
          <span style={{ color: "#aaa" }}>※ auth_role=anon 이면 Storage INSERT policy를 public으로 변경하세요 (위 SQL 참조)</span>
        </div>
      )}

      {/* 등록/수정 폼 — 카드의 [수정] 클릭 시 여기로 스크롤(id 고정) */}
      <div id="seed-review-edit-form" style={{ background: C.surface, borderRadius: R.xl, padding: S.xl,
        border: `1.5px solid ${editId ? C.brand : C.bgWarm}`, marginBottom: S.xl }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, marginBottom: S.md }}>
          {editId ? "✏️ 수정" : "➕ 새 시딩 후기 등록"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: S.sm }}>
          {inp("category", "카테고리", "예: 아파트 전체 인테리어")}
          {inp("space_type", "공간 유형", "예: 32평 아파트 전체")}
          {inp("region", "지역", "예: 강남구")}
          {inp("user_name", "고객명", "예: 김○○")}
          {inp("masked_company_name", "업체명(마스킹)", "예: 공간○○")}
          <div style={{ marginBottom: S.sm }}>
            <div style={{ fontSize: 11, color: C.text3, marginBottom: 3 }}>별점</div>
            <select value={form.rating} onChange={e => setForm(p => ({ ...p, rating: e.target.value }))}
              style={{ width: "100%", padding: "8px 10px", borderRadius: R.md,
                border: `1px solid ${C.bgWarm}`, fontSize: 13, color: C.text1, background: C.surface }}>
              {[5,4,3].map(v => <option key={v} value={v}>{v}점</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: S.sm }}>
          <div style={{ fontSize: 11, color: C.text3, marginBottom: 3 }}>후기 내용</div>
          <textarea value={form.content}
            onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
            placeholder="고객 후기 내용을 입력하세요"
            rows={3}
            style={{ width: "100%", padding: "8px 10px", borderRadius: R.md,
              border: `1px solid ${C.bgWarm}`, fontSize: 13, color: C.text1,
              background: C.surface, boxSizing: "border-box", resize: "vertical" }}
          />
        </div>
        {/* 이미지 업로드 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: S.sm, marginBottom: S.md }}>
          {["before", "after"].map(slot => {
            const urlKey = slot === "before" ? "before_image_url" : "after_image_url";
            return (
              <div key={slot}>
                <div style={{ fontSize: 11, color: C.text3, marginBottom: 3 }}>
                  {slot === "before" ? "BEFORE 이미지" : "AFTER 이미지"}
                </div>
                {form[urlKey] && (
                  <img src={form[urlKey]} alt=""
                    style={{ width: "100%", height: 80, objectFit: "cover",
                      borderRadius: R.md, marginBottom: 6, border: `1px solid ${C.bgWarm}` }} />
                )}
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <label style={{ flex: 1, background: C.brandL, color: C.brand,
                    borderRadius: R.md, padding: "7px 0", fontSize: 12, fontWeight: 700,
                    textAlign: "center", cursor: "pointer" }}>
                    {uploading[slot] ? "업로드 중…" : "📁 파일 선택"}
                    <input type="file" accept="image/*" style={{ display: "none" }}
                      onChange={e => { if (e.target.files[0]) handleUpload(e.target.files[0], slot); }} />
                  </label>
                  {form[urlKey] && (
                    <button onClick={() => setForm(p => ({ ...p, [urlKey]: "" }))}
                      style={{ background: "none", border: "none", color: C.text4,
                        fontSize: 18, cursor: "pointer", padding: "0 4px" }}>✕</button>
                  )}
                </div>
                <input value={form[urlKey]}
                  onChange={e => setForm(p => ({ ...p, [urlKey]: e.target.value }))}
                  placeholder="또는 이미지 URL 직접 입력"
                  style={{ width: "100%", padding: "6px 8px", borderRadius: R.md,
                    border: `1px solid ${C.bgWarm}`, fontSize: 11, color: C.text3,
                    background: C.surface, boxSizing: "border-box", marginTop: 4 }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: S.sm, alignItems: "center" }}>
          <div style={{ marginBottom: S.sm, flex: 0 }}>
            <div style={{ fontSize: 11, color: C.text3, marginBottom: 3 }}>순서</div>
            <input type="number" value={form.sort_order}
              onChange={e => setForm(p => ({ ...p, sort_order: e.target.value }))}
              style={{ width: 70, padding: "8px 10px", borderRadius: R.md,
                border: `1px solid ${C.bgWarm}`, fontSize: 13, color: C.text1, background: C.surface }} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
            fontSize: 13, color: C.text2, marginTop: 8 }}>
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
            활성화
          </label>
          <div style={{ flex: 1 }} />
          {editId && (
            <button onClick={() => resetForm(seeds.length)}
              style={{ padding: "10px 16px", borderRadius: R.lg, border: `1px solid ${C.bgWarm}`,
                background: C.surface, color: C.text3, fontSize: 13, cursor: "pointer" }}>
              취소
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            style={{ padding: "10px 20px", borderRadius: R.lg, border: "none",
              background: C.brand, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {saving ? "저장 중…" : editId ? "수정 저장" : "등록"}
          </button>
        </div>
      </div>

      {/* 목록 */}
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: S.md }}>
        등록된 시딩 후기 ({seeds.length}건)
      </div>
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: C.text4 }}>불러오는 중…</div>
      ) : seeds.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📷</div>
          <div style={{ fontSize: 14, color: C.text3 }}>등록된 시딩 후기가 없습니다</div>
        </div>
      ) : seeds.map(s => (
        <div key={s.id} style={{ background: C.surface, borderRadius: R.xl,
          marginBottom: S.md, border: `1.5px solid ${s.is_active ? C.bgWarm : "#eee"}`,
          overflow: "hidden", opacity: s.is_active ? 1 : 0.55 }}>
          <div style={{ height: 3, background: s.is_active ? C.brand : C.text4 }} />
          <div style={{ padding: S.lg }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.sm }}>
              <div>
                <span style={{ background: s.is_active ? C.brandL : C.surface2,
                  color: s.is_active ? C.brand : C.text4, borderRadius: R.full,
                  padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>
                  {s.is_active ? "활성" : "비활성"}
                </span>
                {s.category && (
                  <span style={{ marginLeft: 6, background: C.bgWarm, color: C.text3,
                    borderRadius: R.full, padding: "2px 10px", fontSize: 11 }}>
                    {s.category}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: C.text4 }}>순서 {s.sort_order}</div>
            </div>
            {/* 이미지 프리뷰 */}
            {(s.before_image_url || s.after_image_url) && (
              <div style={{ display: "flex", gap: 6, marginBottom: S.sm }}>
                {s.before_image_url && (
                  <div style={{ position: "relative" }}>
                    <img src={s.before_image_url} alt=""
                      style={{ width: 80, height: 60, objectFit: "cover", borderRadius: R.md }} />
                    <span style={{ position: "absolute", bottom: 2, left: 2,
                      background: "rgba(58,95,204,0.82)", color: "#fff",
                      borderRadius: 4, padding: "1px 4px", fontSize: 8, fontWeight: 800 }}>
                      BEFORE
                    </span>
                  </div>
                )}
                {s.after_image_url && (
                  <div style={{ position: "relative" }}>
                    <img src={s.after_image_url} alt=""
                      style={{ width: 80, height: 60, objectFit: "cover", borderRadius: R.md }} />
                    <span style={{ position: "absolute", bottom: 2, right: 2,
                      background: "rgba(0,0,0,0.55)", color: "#fff",
                      borderRadius: 4, padding: "1px 4px", fontSize: 8, fontWeight: 800 }}>
                      AFTER
                    </span>
                  </div>
                )}
              </div>
            )}
            <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.6, marginBottom: S.xs }}>
              {"★".repeat(s.rating ?? 0)} {s.content?.slice(0, 60)}{(s.content?.length ?? 0) > 60 ? "…" : ""}
            </div>
            <div style={{ fontSize: 11, color: C.text4 }}>
              {s.user_name ?? "익명"} · {s.space_type ?? s.region ?? "시공"} · 🏠 {s.masked_company_name ?? "—"}
            </div>
            <div style={{ display: "flex", gap: S.sm, marginTop: S.md }}>
              <button onClick={() => handleToggle(s)}
                style={{ flex: 1, padding: "8px 0", borderRadius: R.md,
                  border: `1px solid ${C.bgWarm}`, background: C.surface,
                  color: s.is_active ? C.text3 : C.brand, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {s.is_active ? "비활성화" : "활성화"}
              </button>
              <button onClick={() => handleEdit(s)}
                style={{ flex: 1, padding: "8px 0", borderRadius: R.md,
                  border: `1px solid ${C.brand}`, background: C.brandL,
                  color: C.brand, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                수정
              </button>
              <button onClick={() => handleDelete(s.id)}
                style={{ padding: "8px 14px", borderRadius: R.md,
                  border: "none", background: "#fef0f0",
                  color: "#c0392b", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                삭제
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 운영자 설정 탭 (admin 전용) — 전화번호로 운영자 등록/해제 + 목록 ──
function OperatorSettingTab({ adminUserId, showToast }) {
  const PERM_DEFS = [
    ["ops", "운영", "can_operations"], ["tx", "거래", "can_transactions"],
    ["proof", "프로젝트증빙", "can_project_proof"], ["contents", "콘텐츠", "can_contents"],
    ["system", "시스템", "can_system"],
  ];
  const EMPTY_PERMS = { ops: false, tx: false, proof: false, contents: false, system: false };

  const [phone, setPhone]       = useState("");
  const [perms, setPerms]       = useState(EMPTY_PERMS);
  const [operators, setOps]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(false);
  const [pinModal, setPinModal] = useState(null); // { phone, pin }
  const [editing, setEditing]   = useState(null);  // user_id
  const [editPerms, setEditPerms] = useState(EMPTY_PERMS);

  const load = async () => {
    setLoading(true);
    const { data, error } = await adminListOperators(adminUserId);
    if (error) {
      // 073 미적용 등 — 레거시 목록으로 폴백(권한 표시는 비어있음).
      const { data: legacy } = await getOperators();
      setOps((legacy ?? []).map(o => ({ user_id: o.id, name: o.name, phone: o.phone, role: o.role })));
    } else {
      setOps(data ?? []);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const errMsg = (m) =>
    m.includes("ADMIN_ONLY") ? "관리자(role=admin) 계정만 가능해요"
    : m.includes("USER_NOT_FOUND") ? "해당 전화번호의 사용자를 찾을 수 없어요 (가입된 번호인지 확인)"
    : m.includes("CANNOT_MODIFY_ADMIN") ? "관리자 계정은 변경할 수 없어요"
    : /Could not find the function|does not exist|schema cache|PGRST202|admin_permissions/i.test(m) ? "RPC/테이블 없음 — 073_admin_permissions.sql 적용 필요"
    : `실패: ${m || "알 수 없는 오류"}`;

  const register = async () => {
    const val = phone.trim();
    if (!val) { showToast?.("전화번호를 입력하세요", false); return; }
    if (!adminUserId) { showToast?.("관리자(DB role=admin) 계정으로 로그인해야 등록할 수 있어요", false); return; }
    setBusy(true);
    const { data, error } = await adminRegisterOperator(adminUserId, toE164KR(val) || val, perms);
    setBusy(false);
    if (error) { showToast?.(errMsg(error.message || ""), false); return; }
    setPhone(""); setPerms(EMPTY_PERMS);
    if (data?.pin) setPinModal({ phone: val, pin: data.pin });
    showToast?.("운영자로 등록했어요");
    load();
  };

  const startEdit = (op) => {
    setEditing(op.user_id);
    setEditPerms({ ops: !!op.can_operations, tx: !!op.can_transactions, proof: !!op.can_project_proof, contents: !!op.can_contents, system: !!op.can_system });
  };
  const savePerms = async (op) => {
    setBusy(true);
    const { error } = await adminUpdatePermissions(adminUserId, op.user_id, editPerms);
    setBusy(false);
    if (error) { showToast?.(errMsg(error.message || ""), false); return; }
    setEditing(null);
    showToast?.("권한을 수정했어요");
    load();
  };
  const resetPin = async (op) => {
    setBusy(true);
    const { data, error } = await adminResetPin(adminUserId, op.user_id);
    setBusy(false);
    if (error) { showToast?.(errMsg(error.message || ""), false); return; }
    if (data?.pin) setPinModal({ phone: op.phone, pin: data.pin });
    showToast?.("PIN 을 재발급했어요");
  };
  const unregister = async (op) => {
    if (!adminUserId) { showToast?.("관리자 계정으로 로그인해야 해제할 수 있어요", false); return; }
    setBusy(true);
    const { error } = await adminUnregisterOperator(adminUserId, op.user_id);
    setBusy(false);
    if (error) { showToast?.(errMsg(error.message || ""), false); return; }
    showToast?.("운영자에서 해제했어요");
    load();
  };

  const PermChecks = ({ value, onChange }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {PERM_DEFS.map(([k, l]) => (
        <label key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
          background: value[k] ? C.brandL : C.surface, border: `1px solid ${value[k] ? C.brand : C.bgWarm}`,
          borderRadius: R.full, padding: "5px 11px", fontSize: 12, fontWeight: 700, color: value[k] ? C.brand : C.text3 }}>
          <input type="checkbox" checked={value[k]} onChange={e => onChange({ ...value, [k]: e.target.checked })}
            style={{ width: 14, height: 14, accentColor: C.brand, cursor: "pointer" }} />
          {l}
        </label>
      ))}
    </div>
  );

  return (
    <div style={{ padding: "8px 4px" }}>
      {pinModal && (
        <div onClick={() => setPinModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.surface, borderRadius: R.xl, padding: "24px 22px", maxWidth: 340, width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: C.text1, marginBottom: 6 }}>초기 PIN 발급</div>
            <div style={{ fontSize: 12, color: C.text3, marginBottom: 14 }}>{pinModal.phone} 운영자</div>
            <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: "0.18em", color: C.brand, fontFamily: "monospace", marginBottom: 12 }}>{pinModal.pin}</div>
            <div style={{ fontSize: 12.5, color: C.red, fontWeight: 700, lineHeight: 1.6, marginBottom: 16 }}>
              지금만 표시됩니다.<br />운영자에게 전달하세요.
            </div>
            <button onClick={() => setPinModal(null)}
              style={{ width: "100%", padding: "11px", background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
              확인
            </button>
          </div>
        </div>
      )}

      <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: 6 }}>운영자 설정</div>
      <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.7, marginBottom: 12 }}>
        전화번호로 사용자를 검색해 운영자 권한을 부여합니다. 대분류(운영/거래/프로젝트증빙/콘텐츠/시스템) 단위로 복수 선택할 수 있고, 등록 시 6자리 PIN 이 1회 발급됩니다. 사용자 유형(업체/의뢰인)은 그대로 유지됩니다.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="전화번호 (예: 01027406030)"
          onKeyDown={e => { if (e.key === "Enter") register(); }}
          style={{ flex: 1, padding: "11px 14px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.lg, fontSize: 14, outline: "none", color: C.text1, background: C.surface, fontFamily: "inherit" }} />
        <button disabled={busy} onClick={register}
          style={{ background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, padding: "0 18px", fontSize: 14, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>
          운영자 등록
        </button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text3, marginBottom: 6 }}>권한 (복수 선택)</div>
        <PermChecks value={perms} onChange={setPerms} />
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: 8 }}>현재 운영자 ({operators.length})</div>
      {loading ? (
        <div style={{ color: C.text3, fontSize: 13, padding: "12px 0" }}>불러오는 중...</div>
      ) : operators.length === 0 ? (
        <div style={{ color: C.text4, fontSize: 13, padding: "12px 0" }}>등록된 운영자가 없습니다</div>
      ) : (
        operators.map(op => (
          <div key={op.user_id} style={{ padding: "11px 12px", background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>
                  {op.name || "이름없음"}
                  <span style={{ fontSize: 11, color: C.text4, fontWeight: 500 }}> · {op.role === "company" ? "업체" : op.role === "consumer" ? "의뢰인" : op.role}</span>
                  {op.has_pin && <span style={{ fontSize: 10, color: "#27AE60", fontWeight: 700 }}> · PIN 발급됨</span>}
                </div>
                <div style={{ fontSize: 12, color: C.text3 }}>{op.phone}</div>
              </div>
              <button disabled={busy} onClick={() => unregister(op)}
                style={{ background: C.surface, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.full, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                해제
              </button>
            </div>
            {/* 권한 표시 / 편집 */}
            {editing === op.user_id ? (
              <div style={{ marginTop: 10 }}>
                <PermChecks value={editPerms} onChange={setEditPerms} />
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button disabled={busy} onClick={() => savePerms(op)}
                    style={{ background: C.brand, color: "#fff", border: "none", borderRadius: R.md, padding: "7px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>저장</button>
                  <button onClick={() => setEditing(null)}
                    style={{ background: C.surface, color: C.text3, border: `1px solid ${C.bgWarm}`, borderRadius: R.md, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>취소</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", flex: 1 }}>
                  {PERM_DEFS.filter(([, , col]) => op[col]).map(([k, l]) => (
                    <span key={k} style={{ background: C.brandL, color: C.brand, borderRadius: R.full, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{l}</span>
                  ))}
                  {PERM_DEFS.every(([, , col]) => !op[col]) && <span style={{ fontSize: 11.5, color: C.text4 }}>권한 없음</span>}
                </div>
                <button onClick={() => startEdit(op)}
                  style={{ background: C.surface, color: C.brand, border: `1px solid ${C.brandM ?? C.bgWarm}`, borderRadius: R.full, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>권한수정</button>
                <button disabled={busy} onClick={() => resetPin(op)}
                  style={{ background: C.surface, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.full, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>PIN 재발급</button>
              </div>
            )}
          </div>
        ))
      )}

      {/* ── 테스트 계정 관리(071) — 실거래 통계에서 제외할 계정 ─────────── */}
      <div style={{ height: 1, background: C.bgWarm, margin: "22px 0 18px" }} />
      <TestAccountSection adminUserId={adminUserId} showToast={showToast} />
    </div>
  );
}

// 테스트 계정 관리 — 대표/QA/개발/테스트 업체 계정을 전화번호로 등록/해제.
// role 불변, is_test_account 플래그만 토글. 재무·거래 통계에서 분리된다.
function TestAccountSection({ adminUserId, showToast }) {
  const [phone, setPhone]   = useState("");
  const [list, setList]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]     = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await getTestAccounts(adminUserId);
    setList(Array.isArray(data) ? data : []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [adminUserId]);

  const register = async () => {
    const val = phone.trim();
    if (!val) { showToast?.("전화번호를 입력하세요", false); return; }
    if (!adminUserId) { showToast?.("관리자(role=admin) 계정으로 로그인해야 등록할 수 있어요", false); return; }
    setBusy(true);
    // 입력 변형(0/82/+82) → DB 저장형(+8210...)으로 정규화 후 RPC 호출.
    const e164 = toE164KR(val) || val;
    const { error } = await rpcSetTestAccountByPhone(e164, adminUserId);
    setBusy(false);
    if (error) {
      const m = error.message || "";
      let msg;
      if (m.includes("ADMIN_ONLY")) msg = "관리자(role=admin) 계정만 등록할 수 있어요";
      else if (m.includes("USER_NOT_FOUND")) msg = "해당 전화번호의 사용자를 찾을 수 없어요 (가입된 번호인지 확인)";
      else if (m.includes("CANNOT_MODIFY_ADMIN")) msg = "관리자 계정은 변경할 수 없어요";
      else if (/is_test_account/i.test(m)) msg = "is_test_account 컬럼 없음 — 071_test_account_flag.sql 적용 필요";
      else if (/Could not find the function|does not exist|schema cache|PGRST202/i.test(m)) msg = "RPC 없음 — 071_test_account_flag.sql 적용 필요";
      else msg = `등록 실패: ${m || "알 수 없는 오류"}`;
      showToast?.(msg, false);
      return;
    }
    showToast?.("테스트 계정으로 등록했어요");
    setPhone("");
    load();
  };

  const unregister = async (u) => {
    if (!adminUserId) { showToast?.("관리자 계정으로 로그인해야 해제할 수 있어요", false); return; }
    setBusy(true);
    const { error } = await rpcUnsetTestAccount(u.id, adminUserId);
    setBusy(false);
    if (error) { showToast?.("해제에 실패했어요", false); return; }
    showToast?.("테스트 계정에서 해제했어요");
    load();
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: 6 }}>테스트 계정 관리</div>
      <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.7, marginBottom: 12 }}>
        대표·QA·개발·테스트 업체 계정을 등록하면 해당 거래가 재무대시보드(기본값)와 거래관리 통계에서 분리됩니다. 사용자 유형(업체/의뢰인)은 그대로 유지되고 거래 자체는 삭제되지 않습니다.
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="전화번호 (예: 01027406030)"
          onKeyDown={e => { if (e.key === "Enter") register(); }}
          style={{ flex: 1, padding: "11px 14px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.lg, fontSize: 14, outline: "none", color: C.text1, background: C.surface, fontFamily: "inherit" }} />
        <button disabled={busy} onClick={register}
          style={{ background: "#8A5C00", color: "#fff", border: "none", borderRadius: R.lg, padding: "0 18px", fontSize: 14, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>
          테스트 등록
        </button>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: 8 }}>현재 테스트 계정 ({list.length})</div>
      {loading ? (
        <div style={{ color: C.text3, fontSize: 13, padding: "12px 0" }}>불러오는 중...</div>
      ) : list.length === 0 ? (
        <div style={{ color: C.text4, fontSize: 13, padding: "12px 0" }}>등록된 테스트 계정이 없습니다</div>
      ) : (
        list.map(u => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, marginBottom: 6 }}>
            <span style={{ background: "#8A5C00", color: "#fff", borderRadius: R.sm, padding: "1px 6px", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>TEST</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>{u.name || "이름없음"} <span style={{ fontSize: 11, color: C.text4, fontWeight: 500 }}>· {u.role === "company" ? "업체" : u.role === "consumer" ? "의뢰인" : u.role}</span></div>
              <div style={{ fontSize: 12, color: C.text3 }}>{u.phone}</div>
            </div>
            <button disabled={busy} onClick={() => unregister(u)}
              style={{ background: C.surface, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.full, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
              해제
            </button>
          </div>
        ))
      )}
    </div>
  );
}

// ── GPS 흐름관리(현장흐름 관리) 탭 — admin_project_flow_list(047) 조회 전용 ──
// 11단계(요청→입찰→현장실측→최종견적→계약→에스크로→착공→중간점검→완료→정산→리뷰)
// 진행상황 통합 조회 + 검색/필터. GPS 좌표/주소/사진은 상세 타임라인에서 노출.
const FLOW_STAGE_META = {
  REQUESTED:           { label: "요청",     color: C.text3 },
  BID_SUBMITTED:       { label: "입찰",     color: "#2980B9" },
  SITE_VISIT:          { label: "현장실측", color: "#16A085" },
  FINAL_QUOTE:         { label: "최종견적", color: "#16A085" },
  CONTRACTED:          { label: "계약확정", color: C.brand },
  ESCROW_STARTED:      { label: "착공",     color: "#E67E22" },
  MID_INSPECTION:      { label: "중간점검", color: "#E67E22" },
  COMPLETED:           { label: "완료확인", color: "#27AE60" },
  SETTLED_OR_REVIEWED: { label: "정산/리뷰", color: "#27AE60" },
};
const FLOW_STAGE_INDEX = {
  REQUESTED: 0, BID_SUBMITTED: 1, SITE_VISIT: 2, FINAL_QUOTE: 3, CONTRACTED: 4,
  ESCROW_STARTED: 5, MID_INSPECTION: 6, COMPLETED: 7, SETTLED_OR_REVIEWED: 8,
};

// 체크포인트 type(구/신 명칭) 매칭 헬퍼
const cpFind = (cps, types) => (cps || []).find(c => types.includes(c.checkpoint_type)) || null;

// 한 행의 흐름 분석 — 카드 뱃지/필터/상세 증빙 체크리스트가 '동일 로직'으로 쓰는 단일 소스.
// 기준: project_checkpoints(site_visit/start/middle/complete) + 에스크로 상태 + flow_stage.
function deriveFlowFlags(row) {
  const cps = row.checkpoints || [];
  const esc = row.escrow || null;
  const sv  = row.site_visit || null;
  const si  = FLOW_STAGE_INDEX[row.flow_stage] ?? 0;
  const ts  = esc?.transaction_status;

  const cpVisit    = cpFind(cps, ["site_visit"]);
  const cpContract = cpFind(cps, ["contract"]); // C-1: 최종계약 GPS(고객 캡처)
  const cpStart = cpFind(cps, ["start", "construction_start"]);
  const cpMid   = cpFind(cps, ["middle", "mid_inspection"]);
  const cpComp  = cpFind(cps, ["complete", "completion"]);

  const hasGps = (cp) => !!cp && cp.lat != null && cp.lng != null;
  const photoN = (cp) => (Array.isArray(cp?.photos) ? cp.photos.length : 0);

  // 단계 도달(expected) — flow_stage 진행 + 상태/체크포인트 보강.
  const contractReached = !!row.selected_bid || !!esc
    || ["CONTRACTED","COMPANY_SELECTED","STARTED","MID_INSPECTION","COMPLETED","SETTLED"].includes(ts);
  const startReached    = si >= FLOW_STAGE_INDEX.ESCROW_STARTED || ts === "STARTED"         || !!cpStart;
  const middleReached   = si >= FLOW_STAGE_INDEX.MID_INSPECTION  || ts === "MID_INSPECTION"  || !!cpMid;
  const completeReached = si >= FLOW_STAGE_INDEX.COMPLETED       || ts === "COMPLETED"       || !!esc?.step4_approved_at || !!cpComp;

  // 카드/상세 공통 단계 증빙(site_visit/contract/start/middle/complete).
  const stages = [
    { key:"site_visit", label:"현장방문/실측", reached: !!sv || !!cpVisit, cp: cpVisit, gpsStage:false },
    { key:"contract",   label:"최종계약",       reached: contractReached,   cp: cpContract, gpsStage:false },
    { key:"start",      label:"착공",           reached: startReached,      cp: cpStart, gpsStage:true  },
    { key:"middle",     label:"중간점검",       reached: middleReached,     cp: cpMid,   gpsStage:true  },
    { key:"complete",   label:"완료",           reached: completeReached,   cp: cpComp,  gpsStage:true  },
  ];

  // 단계(체크포인트) 누락 — 도달했는데 GPS 체크포인트가 없음.
  const startMissing    = startReached    && !cpStart;
  const middleMissing   = middleReached   && !cpMid;
  const completeMissing = completeReached && !cpComp;

  // GPS 누락 — 완료 도달인데 GPS 좌표 없음(체크포인트 부재 포함) + 도달한 GPS 단계 좌표 누락.
  const gpsMissing =
    (completeReached && !hasGps(cpComp)) ||
    stages.some(s => s.gpsStage && s.reached && s.cp && !hasGps(s.cp));

  // 사진 누락 — 도달한 GPS 단계 체크포인트에 사진 없음.
  const photoMissing = stages.some(s => s.gpsStage && s.reached && s.cp && photoN(s.cp) === 0);

  const ddrSuspect = (row.direct_deal_reports || []).length > 0;

  // 개수(목록 카드 표시용).
  const gpsCount   = cps.filter(c => c.lat != null && c.lng != null).length;
  const photoCount = cps.reduce((n, c) => n + photoN(c), 0);

  return {
    stages, cpVisit, cpStart, cpMid, cpComp,
    startMissing, middleMissing, completeMissing,
    gpsMissing, photoMissing, ddrSuspect, gpsCount, photoCount,
  };
}

const isFlowCompleted = (row) =>
  row.flow_stage === "SETTLED_OR_REVIEWED" || row.status === "completed";

// ── GPS 시스템 모니터링 대시보드 — admin_project_flow_list 집계(읽기 전용 · DB/API 무변경) ──
//   목적: "프로젝트가 아니라 GPS 시스템이 정상 운영되는가"를 보는 운영 KPI 화면.
//   기존 deriveFlowFlags(프로젝트 증빙관리와 동일 기준)를 '집계' 관점으로만 재사용한다.
function GpsOpsDashboard({ adminUserId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState(null);
  const [period, setPeriod] = useState("all"); // all|today|week|month

  useEffect(() => {
    let alive = true;
    setLoading(true); setErrMsg(null);
    getAdminProjectFlow(adminUserId, { limit: 500 })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) { setErrMsg(error.message || "조회 실패"); setRows([]); }
        else setRows(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => { if (alive) { setErrMsg("조회 실패"); setLoading(false); } });
    return () => { alive = false; };
  }, [adminUserId]);

  const latestCpTime = (row) => (row.checkpoints || []).reduce((m, c) => {
    const t = c.captured_at ? new Date(c.captured_at).getTime() : 0; return t > m ? t : m;
  }, 0);
  const inPeriod = (row) => {
    if (period === "all") return true;
    const t = latestCpTime(row);
    if (!t) return false;
    const span = period === "today" ? 864e5 : period === "week" ? 7 * 864e5 : 30 * 864e5;
    return Date.now() - t < span;
  };
  const rate = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

  // 집계 (≤500행 — 렌더 시 계산, 부수효과 없음 · 기존 checkpoint 데이터만 사용)
  const src = rows.filter(inPeriod);
  const OVER_ACC = 50; // m — 위치 오차 과다 임계값(표시 기준)
  let total = 0, gpsRecorded = 0, startMiss = 0, midMiss = 0, compMiss = 0;
  let photoOk = 0, photoStageTotal = 0, photoMissingProj = 0;
  let accSum = 0, accN = 0, acc10 = 0, acc30 = 0, acc50 = 0, accOver = 0;
  let ongoing = 0, completed = 0, stageIdxSum = 0, gpsMissing = 0;
  const stageReach = { site_visit: 0, contract: 0, start: 0, middle: 0, complete: 0 };
  const byCompany = {}, byRegion = {}, byCustomer = {};
  const anomalies = [];
  const grp = (map, key, hasGps, reachedStage, photoGood) => {
    map[key] = map[key] || { total: 0, recorded: 0, photoTotal: 0, photoOk: 0 };
    const g = map[key]; g.total++; if (hasGps) g.recorded++;
    if (reachedStage) { g.photoTotal++; if (photoGood) g.photoOk++; }
  };
  src.forEach((row) => {
    const ev = deriveFlowFlags(row);
    total++;
    const hasGps = ev.gpsCount > 0;
    if (hasGps) gpsRecorded++;
    if (ev.gpsMissing) gpsMissing++;
    if (ev.startMissing) startMiss++;
    if (ev.middleMissing) midMiss++;
    if (ev.completeMissing) compMiss++;
    const reachedStage = ev.stages.some((s) => s.gpsStage && s.reached);
    const photoGood = reachedStage && !ev.photoMissing;
    if (reachedStage) { photoStageTotal++; if (photoGood) photoOk++; }
    if (ev.photoMissing) photoMissingProj++;
    (row.checkpoints || []).forEach((c) => {
      const a = Number(c.accuracy);
      if (c.accuracy != null && Number.isFinite(a)) {
        accSum += a; accN++;
        if (a > OVER_ACC) accOver++; else if (a <= 10) acc10++; else if (a <= 30) acc30++; else acc50++;
      }
    });
    ev.stages.forEach((s) => { if (s.reached && stageReach[s.key] != null) stageReach[s.key]++; });
    if (isFlowCompleted(row)) completed++; else ongoing++;
    stageIdxSum += (FLOW_STAGE_INDEX[row.flow_stage] ?? 0);
    grp(byCompany, row.company?.name || "미배정", hasGps, reachedStage, photoGood);
    grp(byRegion, row.area || "지역 미상", hasGps, reachedStage, photoGood);
    grp(byCustomer, row.customer?.name || "미상", hasGps, reachedStage, photoGood);
    if (ev.gpsMissing || ev.photoMissing) anomalies.push({ row, ev, t: latestCpTime(row) });
  });
  const mkRank = (map) => Object.entries(map).map(([name, v]) => ({
    name, total: v.total, recorded: v.recorded, rate: rate(v.recorded, v.total),
    missRate: 100 - rate(v.recorded, v.total), photoRate: rate(v.photoOk, v.photoTotal),
  })).sort((a, b) => b.total - a.total).slice(0, 8);
  const companies = mkRank(byCompany);
  const regions = mkRank(byRegion);
  const gpsRate = rate(gpsRecorded, total);
  const gpsMissRate = total > 0 ? 100 - gpsRate : 0;
  const photoRate = rate(photoOk, photoStageTotal);
  const avgAcc = accN > 0 ? Math.round(accSum / accN) : null;
  const avgStage = total > 0 ? (stageIdxSum / total).toFixed(1) : "0";
  const completeRate = rate(completed, total);
  const unregCompanies = Object.values(byCompany).filter((v) => v.recorded === 0).length;
  const unregCustomers = Object.values(byCustomer).filter((v) => v.recorded === 0).length;
  anomalies.sort((a, b) => b.t - a.t);
  const recentAnomalies = anomalies.slice(0, 6);
  const accBuckets = [["≤10m", acc10], ["≤30m", acc30], ["31~50m", acc50], [">50m", accOver]];
  const stageRows = [
    ["현장방문", stageReach.site_visit], ["계약", stageReach.contract], ["착공", stageReach.start],
    ["중간점검", stageReach.middle], ["완료", stageReach.complete],
  ];
  const toneRate = (r) => (r >= 70 ? "#27AE60" : r >= 40 ? "#E67E22" : C.red);

  const Kpi = ({ label, value, sub, tone }) => (
    <div style={{ flex: "1 1 130px", minWidth: 110, background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "13px 12px" }}>
      <div style={{ fontSize: 21, fontWeight: 900, color: tone || C.text1, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: C.text3, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 10.5, color: C.text4, marginTop: 2 }}>{sub}</div>}
    </div>
  );
  const Section = ({ title, children, sub }) => (
    <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: 14, marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: sub ? 2 : 10 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: C.text4, marginBottom: 10 }}>{sub}</div>}
      {children}
    </div>
  );
  const Bars = ({ title, items, showPhoto }) => (
    <Section title={title}>
      {items.length === 0 ? <div style={{ fontSize: 12, color: C.text4 }}>데이터 없음</div> :
        items.map((it) => (
          <div key={it.name} style={{ marginBottom: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.text2, marginBottom: 3 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>{it.name}</span>
              <span style={{ fontWeight: 800, color: toneRate(it.rate) }}>
                {it.rate}% <span style={{ color: C.text4, fontWeight: 600 }}>({it.recorded}/{it.total})</span>
                {showPhoto && <span style={{ color: C.text3, fontWeight: 700, marginLeft: 6 }}>📷 {it.photoRate}%</span>}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: C.bgWarm, overflow: "hidden" }}>
              <div style={{ width: `${it.rate}%`, height: "100%", background: toneRate(it.rate) }} />
            </div>
          </div>
        ))}
    </Section>
  );

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: 4 }}>📡 GPS 시스템 모니터링</div>
      <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.6, marginBottom: 12 }}>
        GPS·사진·프로젝트 진행 품질을 집계하는 운영 대시보드입니다. 프로젝트 단위 상세 추적은 ‘프로젝트 증빙관리’에서 확인하세요.
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[["all", "전체"], ["today", "오늘"], ["week", "이번주"], ["month", "이번달"]].map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)}
            style={{ padding: "6px 12px", borderRadius: R.full, fontSize: 12, fontWeight: 700, cursor: "pointer",
              border: `1px solid ${period === v ? C.brand : C.bgWarm}`, background: period === v ? C.brand : C.surface, color: period === v ? "#fff" : C.text2 }}>{l}</button>
        ))}
      </div>
      {loading ? <div style={{ color: C.text4, fontSize: 13, padding: "12px 0" }}>불러오는 중…</div> :
        errMsg ? <div style={{ color: C.red, fontSize: 13, padding: "12px 0" }}>조회 실패: {errMsg}</div> :
          total === 0 ? <div style={{ color: C.text4, fontSize: 13, padding: "12px 0" }}>해당 기간 데이터가 없습니다</div> : (
            <>
              {/* 상단 — GPS/사진 핵심 */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Kpi label="GPS 기록률" value={`${gpsRate}%`} sub={`${gpsRecorded}/${total} 프로젝트`} tone={toneRate(gpsRate)} />
                <Kpi label="GPS 누락률" value={`${gpsMissRate}%`} sub={`누락 ${gpsMissing}건`} tone={gpsMissRate > 30 ? C.red : C.text1} />
                <Kpi label="사진 첨부율" value={`${photoRate}%`} sub="GPS 단계 도달 기준" tone={toneRate(photoRate)} />
                <Kpi label="사진 누락 프로젝트" value={photoMissingProj} sub="도달 단계 사진 없음" tone={photoMissingProj > 0 ? C.red : C.text1} />
              </div>
              {/* 보조 — 오차/미등록 */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <Kpi label="위치 오차 과다" value={accOver} sub={`> ${OVER_ACC}m`} tone={accOver > 0 ? "#E67E22" : C.text1} />
                <Kpi label="평균 위치오차" value={avgAcc != null ? `${avgAcc}m` : "—"} sub="checkpoint accuracy" />
                <Kpi label="GPS 미등록 업체" value={unregCompanies} sub="기록 0건 업체" tone={unregCompanies > 0 ? C.red : C.text1} />
                <Kpi label="GPS 미등록 고객" value={unregCustomers} sub="기록 0건 고객" />
              </div>

              {/* 프로젝트 진행 품질 */}
              <Section title="프로젝트 진행 품질">
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {[["진행중", ongoing, C.text1], ["완료", completed, "#27AE60"], ["완료율", `${completeRate}%`, toneRate(completeRate)], ["평균 단계", avgStage, C.text1]].map(([l, v, t]) => (
                    <div key={l} style={{ flex: 1, textAlign: "center", background: C.bg, borderRadius: R.md, padding: "10px 4px" }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: t }}>{v}</div>
                      <div style={{ fontSize: 10.5, color: C.text3, marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text3, marginBottom: 8 }}>단계별 도달 현황</div>
                {stageRows.map(([l, n]) => {
                  const r = rate(n, total);
                  return (
                    <div key={l} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.text2, marginBottom: 3 }}>
                        <span>{l}</span><span style={{ fontWeight: 800, color: C.text2 }}>{r}% <span style={{ color: C.text4, fontWeight: 600 }}>({n}/{total})</span></span>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: C.bgWarm, overflow: "hidden" }}>
                        <div style={{ width: `${r}%`, height: "100%", background: C.brand }} />
                      </div>
                    </div>
                  );
                })}
              </Section>

              {/* GPS 정확도 분포 */}
              <Section title="GPS 정확도 분포" sub={`기록된 체크포인트 ${accN}건 기준`}>
                <div style={{ display: "flex", gap: 8 }}>
                  {accBuckets.map(([l, n]) => (
                    <div key={l} style={{ flex: 1, textAlign: "center", background: C.bg, borderRadius: R.md, padding: "10px 4px" }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: l === ">50m" ? "#E67E22" : C.text1 }}>{n}</div>
                      <div style={{ fontSize: 10.5, color: C.text3, marginTop: 2 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* 단계별 GPS 누락 */}
              <Section title="단계별 GPS 누락">
                <div style={{ display: "flex", gap: 8 }}>
                  {[["착공", startMiss], ["중간점검", midMiss], ["완료", compMiss]].map(([l, n]) => (
                    <div key={l} style={{ flex: 1, textAlign: "center", background: C.bg, borderRadius: R.md, padding: "10px 4px" }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: n > 0 ? C.red : C.text1 }}>{n}</div>
                      <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{l} 누락</div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* 업체별 / 지역별 순위 (GPS 기록률 · 누락률 · 사진율) */}
              <Bars title="업체별 GPS 기록률 (상위 8)" items={companies} showPhoto />
              <Bars title="지역별 GPS 기록률 (상위 8)" items={regions} showPhoto />

              {/* 최근 이상 프로젝트 */}
              <Section title="최근 이상 프로젝트" sub="GPS/사진 누락 — 최근순">
                {recentAnomalies.length === 0 ? <div style={{ fontSize: 12, color: C.text4 }}>이상 프로젝트가 없습니다 👍</div> :
                  recentAnomalies.map(({ row, ev }) => (
                    <div key={row.request_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.bg}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.area || "지역 미상"} · {row.company?.name || "미배정"}
                        </div>
                        <div style={{ fontSize: 11, color: C.text4 }}>{FLOW_STAGE_META[row.flow_stage]?.label || row.flow_stage}</div>
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        {ev.gpsMissing && <span style={{ fontSize: 10.5, fontWeight: 800, color: C.red, background: "#FEF0F0", borderRadius: R.full, padding: "2px 8px" }}>GPS 누락</span>}
                        {ev.photoMissing && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#B08040", background: "#FBF5E8", borderRadius: R.full, padding: "2px 8px" }}>사진 누락</span>}
                      </div>
                    </div>
                  ))}
              </Section>
            </>
          )}
    </div>
  );
}

// ── 서류 확대 미리보기 모달(조회 전용) ──────────────────────────────────────
//   업로드 원본(Storage file_url)을 이미지 확대 / PDF 미리보기로 표시.
//   새 창 열기 · 다운로드 지원. 승인/반려/업로드/DB/API 무관 — 표시 전용 UI.
function DocPreviewModal({ url, title, onClose }) {
  if (!url) return null;
  const clean = String(url).split("?")[0].toLowerCase();
  const isPdf = clean.endsWith(".pdf");
  const isImage = /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/.test(clean);
  // 확장자 불명(서명 URL 등)은 우선 이미지로 시도하되, 로드 실패 시 안내로 폴백.
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(5,10,22,0.78)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 760, maxHeight: "92vh", display: "flex", flexDirection: "column",
          background: C.surface, borderRadius: R.xl, overflow: "hidden", boxShadow: "0 24px 70px rgba(5,10,22,0.5)" }}>
        {/* 헤더 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderBottom: `1px solid ${C.bgWarm}`, flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>{title}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <a href={url} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, fontWeight: 700, color: C.text1, background: C.bg, border: `1px solid ${C.bgWarm}`,
                borderRadius: R.lg, padding: "7px 12px", textDecoration: "none" }}>↗ 새 창</a>
            <a href={url} download target="_blank" rel="noreferrer"
              style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: C.brand,
                borderRadius: R.lg, padding: "7px 12px", textDecoration: "none" }}>⬇ 다운로드</a>
            <button onClick={onClose}
              style={{ fontSize: 14, fontWeight: 700, color: C.text2, background: C.bg, border: `1px solid ${C.bgWarm}`,
                borderRadius: R.lg, padding: "7px 12px", cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>
        </div>
        {/* 본문 — 이미지 확대 / PDF 미리보기 */}
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: "#222", display: "flex",
          alignItems: "center", justifyContent: "center" }}>
          {isPdf ? (
            <iframe src={url} title={title} style={{ width: "100%", height: "80vh", border: "none", background: "#fff" }} />
          ) : (isImage || !imgFailed) ? (
            <img src={url} alt={title} onError={() => setImgFailed(true)}
              style={{ maxWidth: "100%", maxHeight: "82vh", objectFit: "contain", display: "block" }} />
          ) : (
            <div style={{ color: "#fff", textAlign: "center", padding: "40px 24px", lineHeight: 1.7 }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 13 }}>미리보기를 표시할 수 없는 형식입니다.<br />‘새 창’ 또는 ‘다운로드’로 확인해 주세요.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminScreen({ onBack, onHome, user }) {
  const [companies, setCompanies]       = useState([]);
  const [customers, setCustomers]       = useState([]);
  const [customersErr, setCustomersErr] = useState(false);
  const [customersErrMsg, setCustomersErrMsg] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [mainTab, setMainTab]           = useState("dashboard");
  const [detailTarget, setDetailTarget] = useState(null); // 계약 통합 상세 {requestId, contractId}
  const [companyTab, setCompanyTab]     = useState("pending");
  const [selected, setSelected]         = useState(null);
  const [rejectMode, setRejectMode]     = useState(false);
  const [rejectNote, setRejectNote]     = useState("");
  const [confirm, setConfirm]           = useState(null);
  const [confirmReason, setConfirmReason] = useState("");
  const [actionLoading, setActionLoading]   = useState(false);
  const [statusReason, setStatusReason]     = useState("");
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [notifications, setNotifications]   = useState([]);
  const [docModal, setDocModal]             = useState(null);
  const [holdMode, setHoldMode]             = useState(false);
  const [holdNote, setHoldNote]             = useState("");
  const [opsConfig, setOpsConfig]           = useState({ pause_new_payments: false, pause_new_bids: false, pause_new_approvals: false });
  const [opsLoading, setOpsLoading]         = useState(false);

  const [paymentOrders, setPaymentOrders]   = useState([]);
  const [paymentFilter, setPaymentFilter]   = useState("all");
  const [disputes, setDisputes]             = useState([]);
  const [settlements, setSettlements]       = useState([]);
  // 정산관리 뷰 전환 — contract(거래별 정산 V2.2 신규) / stage(단계별 지급 기존 보존)
  const [settleView, setSettleView]         = useState("contract");
  // GPS 흐름관리 뷰 전환 — evidence(프로젝트 증빙관리 V2.3 신규) / gps(기존 GPS 흐름 보존)
  const [flowView, setFlowView]             = useState("evidence");
  const [tabLoaded, setTabLoaded]           = useState({});
  const [toast, setToast]                   = useState(null);
  const [companyDocuments, setCompanyDocuments] = useState([]);
  const [showDocReview, setShowDocReview]   = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [tokenInput, setTokenInput]   = useState("");
  const [tempInput, setTempInput]     = useState("");
  const [adjReason, setAdjReason]     = useState("");
  const [loungePosts, setLoungePosts]   = useState([]);
  const [loungeReports, setLoungeReports] = useState([]);
  const [loungeErr, setLoungeErr]       = useState(null);
  const [seedingPosts, setSeedingPosts]   = useState([]);
  const [seedingLoading, setSeedingLoading] = useState(false);
  const [seedingErr, setSeedingErr]       = useState(null);
  // 신규 시딩(seed_lounge_posts) 등록/수정용 — 운영글(is_seed) 관리와 별도 소스
  const [seedLoungeRows, setSeedLoungeRows]       = useState([]);
  const [seedLoungeLoading, setSeedLoungeLoading] = useState(false);
  const [seedLoungeErr, setSeedLoungeErr]         = useState(null);
  // AI 콘텐츠 공장(Phase 1) — lounge_posts.is_seed 재사용, 별도 소스
  const [aiDrafts, setAiDrafts]           = useState([]);
  const [aiPublished, setAiPublished]     = useState([]);
  const [aiFactoryLoading, setAiFactoryLoading] = useState(false);
  const [aiFactoryErr, setAiFactoryErr]   = useState(null);
  const [reports, setReports]           = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsErr, setReportsErr]     = useState(null);
  const [reviewRewards, setReviewRewards] = useState([]);
  const [hiddenRequests, setHiddenRequests] = useState([]);
  const [hiddenLoading, setHiddenLoading] = useState(false);
  const [restoring, setRestoring] = useState(null);
  const [showInfoEdit, setShowInfoEdit] = useState(false);
  const [infoEditForm, setInfoEditForm] = useState({});
  const [infoEditSaving, setInfoEditSaving] = useState(false);

  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [customerEditForm, setCustomerEditForm] = useState({});
  const [customerEditSaving, setCustomerEditSaving] = useState(false);
  const [managingCustomerId, setManagingCustomerId] = useState(null); // 제재/토큰/온도 패널 토글
  const [customerTokenAmt, setCustomerTokenAmt] = useState(""); // 토큰 지급/회수 수량 입력

  const [directDealReports, setDirectDealReports] = useState([]);
  const [ddrFilter, setDdrFilter] = useState("all"); // all | keyword_detected | no_estimate_72h | no_contract_7d | manual_report
  const [ddrLoading, setDdrLoading] = useState(false);

  // 파트너 상담관리(partner_leads) — Partner Landing v1.1
  const [partnerLeads, setPartnerLeads] = useState([]);
  const [partnerLeadsLoading, setPartnerLeadsLoading] = useState(false);
  const [partnerLeadsFilter, setPartnerLeadsFilter] = useState("all"); // all | PENDING | CONTACTED | APPROVED | REJECTED
  const [partnerLeadsErr, setPartnerLeadsErr] = useState(null);
  // V1.4: 통합 검색 + 토글 필터(사업자등록증/보험증권/공간보증 신청).
  const [partnerSearch, setPartnerSearch] = useState("");
  const [pfDocBiz, setPfDocBiz]   = useState(false);
  const [pfDocIns, setPfDocIns]   = useState(false);
  const [pfGuarantee, setPfGuarantee] = useState(false);
  const [partnerNoteDraft, setPartnerNoteDraft] = useState({}); // { [leadId]: text }
  // 서류 확대 미리보기(조회 전용) — 파트너 상담관리 사업자등록증/시공보험증권. { url, title } | null
  const [docPreview, setDocPreview] = useState(null);
  const [ddrRunning, setDdrRunning] = useState(false);

  // DEV panel: admin action tracking
  const [lastAdminAction, setLastAdminAction] = useState(null);
  const [lastAdminTarget, setLastAdminTarget] = useState(null);
  const [lastAdminError, setLastAdminError]   = useState(null);
  const [adminLogOk, setAdminLogOk]           = useState(null);
  const [affectedRows, setAffectedRows]       = useState(null);

  const trackAdmin = (action, target, error = null, logOk = null, rows = null) => {
    setLastAdminAction(action);
    setLastAdminTarget(target);
    setLastAdminError(error);
    setAdminLogOk(logOk);
    setAffectedRows(rows);
  };

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getCompanies().then(({ data }) =>
        setCompanies((data ?? [])
          .filter(c => c.doc_status !== "draft")
          .map(normalizeCompany))
      ),
      // 고객 목록은 service role 서버 API 로 조회(RLS 우회). admin 만 성공.
      fetchAdminCustomers(user?.id).then(({ data, error }) => {
        // 요구사항 4/5/6) count·rows·실패원인 로그 (sentinel/uuid 관리자 모두)
        dlog("[GONGGAN_DEBUG][AdminCustomers]", {
          adminId: user?.id ?? null,
          count: data?.length ?? 0,
          error: error?.message ?? null,
          rows: (data ?? []).slice(0, 5).map(u => ({ id: u.id, role: u.role, name: u.name, phone: u.phone })),
        });
        if (error || !data) {
          setCustomersErr(true);
          setCustomersErrMsg(error?.message ?? null);
          return;
        }
        setCustomersErr(false);
        setCustomersErrMsg(null);
        setCustomers(data.map(normalizeCustomer));
      }),
    ]).finally(() => setLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    getUserNotifications(user.id, { limit: 50 }).then(({ data }) => {
      if (data) setNotifications(data);
    });
  }, [user?.id]);

  useEffect(() => {
    getOpsConfig().then(({ data }) => { if (data) setOpsConfig(data); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected?.id) { setCompanyDocuments([]); return; }
    getCompanyDocuments(selected.id).then(({ data }) => {
      setCompanyDocuments(data ?? []);
    }).catch(() => {});
  }, [selected?.id]);

  const toggleOps = async (field) => {
    setOpsLoading(true);
    const next = { ...opsConfig, [field]: !opsConfig[field] };
    const { data } = await updateOpsConfig(user?.id ?? null, { [field]: next[field] });
    if (data) setOpsConfig(data);
    setOpsLoading(false);
  };

  useEffect(() => {
    if (tabLoaded[mainTab]) return;
    setTabLoaded(prev => ({ ...prev, [mainTab]: true }));
    if (mainTab === "payments") {
      getPaymentOrders({ limit: 100 }).then(({ data }) => {
        if (data) setPaymentOrders(data);
      });
    }
    if (mainTab === "disputes") {
      getDisputePayments().then(({ data }) => {
        if (data) setDisputes(data);
      });
    }
    if (mainTab === "settlements") {
      getPendingPayouts().then(({ data }) => {
        if (data) setSettlements(data);
      });
    }
    if (mainTab === "lounge") {
      (async () => {
        try {
          const [postsRes, reportsRes] = await Promise.all([
            adminGetLoungePosts(),
            getLoungeReports(),
          ]);
          setLoungePosts(postsRes.data ?? []);
          setLoungeReports(reportsRes.data ?? []);
          setLoungeErr(postsRes.error?.message ?? null);
        } catch (err) {
          setLoungeErr(err?.message ?? String(err));
          setLoungePosts([]);
          setLoungeReports([]);
        }
      })();
    }
    if (mainTab === "lounge_seeding") {
      setSeedingLoading(true);
      setSeedingErr(null);
      (async () => {
        try {
          // 실제 운영(seed) 글: lounge_posts.is_seed=true 전체(숨김/비활성 포함)를 service role API 로 조회
          const { data, error } = await fetchAdminSeedPosts(user?.id);
          if (error) throw new Error(error.message ?? "load failed");
          setSeedingPosts(data ?? []);
        } catch (err) {
          setSeedingErr(err?.message ?? String(err));
          setSeedingPosts([]);
        } finally {
          setSeedingLoading(false);
        }
      })();
      // 신규 시딩(seed_lounge_posts) 목록 로드 — 등록/수정 폼 영역용
      setSeedLoungeLoading(true);
      setSeedLoungeErr(null);
      (async () => {
        try {
          const { data, error } = await adminGetSeedLoungePosts();
          if (error) throw new Error(error.message ?? "load failed");
          setSeedLoungeRows(data ?? []);
        } catch (err) {
          setSeedLoungeErr(err?.message ?? String(err));
          setSeedLoungeRows([]);
        } finally {
          setSeedLoungeLoading(false);
        }
      })();
    }
    if (mainTab === "lounge_ai_factory") {
      setAiFactoryLoading(true);
      setAiFactoryErr(null);
      (async () => {
        try {
          const [draftsRes, publishedRes] = await Promise.all([
            adminListLoungeDrafts(),
            adminListPublishedAiContent(),
          ]);
          if (draftsRes.error) throw new Error(draftsRes.error.message ?? "load failed");
          setAiDrafts(draftsRes.data ?? []);
          setAiPublished(publishedRes.data ?? []);
        } catch (err) {
          setAiFactoryErr(err?.message ?? String(err));
          setAiDrafts([]);
          setAiPublished([]);
        } finally {
          setAiFactoryLoading(false);
        }
      })();
    }
    if (mainTab === "reports") {
      // 운영 DB에 customer_reports 테이블이 없으므로 direct_deal_reports 기준으로 조회.
      // 데이터가 없으면(또는 오류) 크래시 없이 빈 목록("신고 0건")으로 표시.
      setReportsLoading(true);
      setReportsErr(null);
      getDirectDealReports()
        .then(({ data, error }) => {
          if (error) { setReportsErr(null); setReports([]); }
          else setReports(data ?? []);
        })
        .catch(() => { setReportsErr(null); setReports([]); })
        .finally(() => setReportsLoading(false));
    }
    if (mainTab === "reviews") {
      getReviewRewardsPending().then(({ data }) => setReviewRewards(data ?? [])).catch(() => setReviewRewards([]));
    }
    if (mainTab === "hidden") {
      setHiddenLoading(true);
      adminGetHiddenRequests().then(({ data }) => setHiddenRequests(data ?? [])).catch(() => setHiddenRequests([])).finally(() => setHiddenLoading(false));
    }
    if (mainTab === "direct_deal") {
      setDdrLoading(true);
      getDirectDealReports().then(({ data }) => setDirectDealReports(data ?? [])).catch(() => setDirectDealReports([])).finally(() => setDdrLoading(false));
    }
    if (mainTab === "partner_leads") {
      loadPartnerLeads();
    }
  }, [mainTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = {
    pending:     companies.filter(c => c.status === "pending").length,
    approved:    companies.filter(c => c.status === "approved").length,
    rejected:    companies.filter(c => c.status === "rejected").length,
    customers:   customers.length,
    disputes:    disputes.length,
    settlements: settlements.length,
    payments:    paymentOrders.filter(o => o.status === "PENDING").length,
  };

  const filtered = companyTab === "all"
    ? companies
    : companies.filter(c => c.status === companyTab);

  const handleApprove = async (company) => {
    setActionLoading(true);
    const { error } = await adminReviewCompany(company.id, user?.id ?? null, "approved");
    if (!error) {
      setCompanies(prev => prev.map(c =>
        c.id === company.id ? { ...c, status: "approved", rejectNote: "" } : c
      ));
      if (company.ownerId) {
        await createNotification({
          userId:      company.ownerId,
          type:        "COMPANY_APPROVED",
          title:       "업체 승인 완료",
          message:     `${company.name} 업체가 승인되었습니다. 이제 견적 요청을 받을 수 있습니다.`,
          relatedId:   company.id,
          relatedType: "company",
        });
      }
    }
    setActionLoading(false);
    setSelected(null);
    setConfirm(null);
  };

  // 공간보증(068) 상태/배지 변경 — company_status(입찰 게이트)와 무관(독립).
  const handleGuarantee = async (company, { status = null, badgeVisible = null }) => {
    setActionLoading(true);
    const { data, error } = await adminSetGuarantee(user?.id ?? null, company.id, { status, badgeVisible });
    if (!error) {
      const patch = {
        guarantee_status:        data?.guarantee_status ?? status ?? company.guarantee_status,
        guarantee_badge_visible: data?.guarantee_badge_visible ?? (badgeVisible ?? company.guarantee_badge_visible),
        guarantee_grade:         data?.guarantee_grade ?? company.guarantee_grade,
        guarantee_amount:        data?.guarantee_amount ?? company.guarantee_amount,
        guarantee_updated_at:    data?.guarantee_updated_at ?? new Date().toISOString(),
      };
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, ...patch } : c));
      setSelected(prev => prev && prev.id === company.id ? { ...prev, ...patch } : prev);
      showToast("공간보증 상태가 변경됐어요");
    } else {
      showToast("공간보증 변경 실패", false);
    }
    setActionLoading(false);
  };

  const handleReject = async (company, note) => {
    setActionLoading(true);
    const { error } = await adminReviewCompany(company.id, user?.id ?? null, "rejected", note);
    if (!error) {
      setCompanies(prev => prev.map(c =>
        c.id === company.id ? { ...c, status: "rejected", rejectNote: note } : c
      ));
      if (company.ownerId) {
        await createNotification({
          userId:      company.ownerId,
          type:        "COMPANY_REJECTED",
          title:       "업체 반려 처리",
          message:     `${company.name} 업체가 반려되었습니다. 사유: ${note}`,
          relatedId:   company.id,
          relatedType: "company",
        });
      }
    }
    setActionLoading(false);
    setSelected(null);
    setRejectMode(false);
    setRejectNote("");
    setConfirm(null);
  };

  const handleCompanyStatus = async (company, newStatus) => {
    setActionLoading(true);
    const { error } = await adminSetCompanyStatus(company.id, user?.id ?? null, newStatus, statusReason || null);
    if (!error) {
      setCompanies(prev => prev.map(c =>
        c.id === company.id ? { ...c, companyStatus: newStatus } : c
      ));
      if (selected?.id === company.id) setSelected(prev => ({ ...prev, companyStatus: newStatus }));
      if (company.ownerId) {
        const meta = COMPANY_STATUS_META[newStatus];
        await createNotification({
          userId:      company.ownerId,
          type:        "COMPANY_STATUS_CHANGED",
          title:       `업체 상태 변경: ${meta?.label ?? newStatus}`,
          message:     statusReason || `${company.name} 업체 상태가 ${meta?.label ?? newStatus}로 변경되었습니다.`,
          relatedId:   company.id,
          relatedType: "company",
        });
      }
      trackAdmin(`SET_COMPANY_STATUS_${newStatus}`, company.id, null, true, 1);
    } else {
      trackAdmin(`SET_COMPANY_STATUS_${newStatus}`, company.id, error.message, false, 0);
    }
    setActionLoading(false);
    setShowStatusModal(false);
    setStatusReason("");
  };

  // 공간보증 배지 등급 변경 — RPC(053) 경유. admin_logs·notifications 는 RPC 내부에서 기록.
  // badge 컬럼만 변경(표시/관리값). 실제 입·출금/정산 처리 없음.
  const handleSetBadge = async (company, newBadge) => {
    if (!company?.id) return;
    setActionLoading(true);
    const { error } = await adminSetCompanyBadge(company.id, user?.id ?? "admin", newBadge, null);
    if (!error) {
      const applied = newBadge === "none" ? null : newBadge;
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, badge: applied } : c));
      if (selected?.id === company.id) setSelected(prev => ({ ...prev, badge: applied }));
      trackAdmin("SET_COMPANY_BADGE", company.id, null, true, 1);
    } else {
      trackAdmin("SET_COMPANY_BADGE", company.id, error.message, false, 0);
      alert("배지 변경 실패: " + (error.message ?? ""));
    }
    setActionLoading(false);
  };

  const openDetail = (company) => {
    setSelected(company);
    setRejectMode(false);
    setRejectNote("");
    setShowStatusModal(false);
    setStatusReason("");
    setHoldMode(false);
    setHoldNote("");
    setDocModal(null);
  };

  // 고객 제재/토큰/온도 변경 — service-role API 경유(users 직접 UPDATE 는 auth.uid()=NULL 로 RLS 차단).
  //   admin_logs 기록은 서버에서 수행. trackAdmin 으로 진단 로그도 남긴다.
  const handleCustomerStatus = async (customer, status, reason) => {
    setActionLoading(true);
    const { error } = await apiAdminSetUserStatus(customer.id, user?.id, status, reason || null);
    if (!error) {
      const update = { accountStatus: status };
      setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, ...update } : c));
      setSelectedCustomer(prev => prev ? { ...prev, ...update } : prev);
      showToast("상태 변경 완료");
      trackAdmin(`SET_USER_STATUS_${status}`, customer.id, null, true, 1);
    } else { showToast(error.message ?? "처리 실패", false); trackAdmin("SET_USER_STATUS", customer.id, error.message, false, 0); }
    setActionLoading(false);
  };

  const handleAdjustTemp = async (customer, delta) => {
    setActionLoading(true);
    const { error } = await apiAdminAdjustSpaceTemp(customer.id, user?.id, delta, adjReason || null);
    if (!error) {
      const next = Math.round(Math.min(99, Math.max(0, (customer.spaceTemp ?? 36.5) + delta)) * 10) / 10;
      setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, spaceTemp: next } : c));
      setSelectedCustomer(prev => prev ? { ...prev, spaceTemp: next } : prev);
      showToast("공간온도 조정 완료");
    } else { showToast(error.message ?? "처리 실패", false); }
    setActionLoading(false);
    setAdjReason("");
  };

  const handleAdjustTokens = async (customer, delta) => {
    setActionLoading(true);
    const { error } = await apiAdminAdjustUserTokens(customer.id, user?.id, delta, adjReason || null);
    if (!error) {
      const next = Math.max(0, (customer.spaceTokens ?? 0) + delta);
      setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, spaceTokens: next } : c));
      setSelectedCustomer(prev => prev ? { ...prev, spaceTokens: next } : prev);
      showToast(delta > 0 ? `+${delta} 토큰 지급 완료` : `${delta} 토큰 회수 완료`);
      trackAdmin(delta > 0 ? "TOKEN_GRANT" : "TOKEN_REVOKE", customer.id, null, true, 1);
    } else { showToast(error.message ?? "처리 실패", false); }
    setActionLoading(false);
    setAdjReason("");
  };

  const MAIN_TABS = [
    ["dashboard",      "대시보드"],
    ["companies",      "업체관리"],
    ["partner_leads",  "파트너 상담관리"],
    ["customers",      "고객관리"],
    ["hidden",         "숨김요청관리"],
    ["transactions",   "거래관리"],
    ["payments",       "결제관리"],
    ["disputes",       "분쟁관리"],
    ["settlements",    "정산관리"],
    ["finance",        "재무대시보드"],
    ["reviews",        "리뷰관리"],
    ["review_admin",   "리뷰 어드민"],
    ["seed",           "포토후기 시딩"],
    ["lounge",         "라운지관리"],
    ["lounge_insights","라운지 인사이트"],
    ["lounge_seeding", "라운지 시딩"],
    ["lounge_ai_factory", "AI 콘텐츠 공장"],
    ["trend_discovery", "트렌드 발굴"],
    ["publishing_pipeline", "발행 파이프라인"],
    ["auto_publish", "자동발행"],
    ["publishing_priority", "발행 우선순위"],
    ["reports",        "신고관리"],
    ["chat_overview",  "채팅/대화 관리"],
    ["direct_deal",    "직거래 의심"],
    ["operator_setting", "운영자 설정"],
    ["project_flow",   "GPS 흐름관리"],
    ["tools",          "정리도구"],
    ["notifications",  "알림"],
    ["admin_logs",     "관리자로그"],
  ];

  // ── 관리자 IA 대분류(5) — 기존 21개 탭을 그룹핑(탭 추가/삭제 없음) ──────────
  // 권한: SUPER_ADMIN(role=admin)=전체 / 운영자=admin_permissions 카테고리만(Phase 3 연동).
  // 소분류 label 은 [key, 커스텀라벨?] — 생략 시 MAIN_TABS 라벨 사용.
  const TAB_LABEL = Object.fromEntries(MAIN_TABS);
  const CATEGORIES_DEF = [
    { key: "operations",    label: "운영",         icon: "🏢", perm: "can_operations",
      tabs: [["dashboard"], ["companies"], ["customers"], ["partner_leads", "파트너상담"], ["hidden"]] },
    { key: "transactions",  label: "거래",         icon: "💳", perm: "can_transactions",
      tabs: [["transactions"], ["payments"], ["settlements"], ["disputes"]] },
    { key: "project_proof", label: "프로젝트증빙", icon: "📍", perm: "can_project_proof",
      tabs: [["project_flow", "프로젝트증빙관리"], ["chat_overview", "채팅/대화 관리"], ["direct_deal", "직거래 의심"]] },
    { key: "contents",      label: "콘텐츠",       icon: "📝", perm: "can_contents",
      tabs: [["reviews"], ["review_admin"], ["seed", "포토후기"], ["lounge"], ["lounge_insights", "라운지 인사이트"], ["lounge_seeding"], ["lounge_ai_factory"], ["trend_discovery", "트렌드 발굴"], ["publishing_pipeline", "발행 파이프라인"], ["auto_publish", "자동발행"], ["publishing_priority", "발행 우선순위"], ["reports"]] },
    { key: "system",        label: "시스템",       icon: "⚙️", perm: "can_system",
      tabs: [["finance"], ["notifications"], ["operator_setting"], ["tools"], ["admin_logs", "관리자로그"]] },
  ];
  const isSuperAdmin = user?.role === "admin";
  // 운영자(role='operator')는 로그인 시 주입된 permissions(can_*)로 대분류 노출 제한.
  const myPerms = user?.permissions ?? null;
  const SUPER_ONLY_TABS = new Set(["operator_setting"]); // 일반 운영자 접근 불가
  const adminCategories = CATEGORIES_DEF
    .filter(c => isSuperAdmin || (myPerms && myPerms[c.perm]))
    .map(c => ({
      key: c.key, label: c.label, icon: c.icon,
      tabs: c.tabs
        .filter(([tk]) => isSuperAdmin || !SUPER_ONLY_TABS.has(tk))
        .map(([tk, lbl]) => ({ key: tk, label: lbl || TAB_LABEL[tk] || tk })),
    }))
    .filter(c => c.tabs.length > 0);

  // H-4: 본문(탭 콘텐츠) 접근도 메뉴와 동일 권한으로 게이트한다. 진입 경로(대시보드 카드·글로벌검색·
  //      알림 클릭 등)와 무관하게 forbidden 탭 본문/액션 노출을 차단(superAdmin 예외 유지).
  const TAB_PERM = {};
  CATEGORIES_DEF.forEach(c => c.tabs.forEach(([tk]) => { TAB_PERM[tk] = c.perm; }));
  const canAccessTab = (tk) => {
    if (isSuperAdmin) return true;
    if (SUPER_ONLY_TABS.has(tk)) return false;
    const perm = TAB_PERM[tk];
    if (!perm) return true;
    return !!myPerms && !!myPerms[perm];
  };

  const DDR_TRIGGER_META = {
    keyword_detected: { label: "키워드 감지", color: C.red },
    no_estimate_72h:  { label: "견적 미제출(72h)", color: C.gold },
    no_contract_7d:   { label: "미계약(7일)", color: C.gold },
    chat_blackout:    { label: "대화 중단", color: C.text3 },
    manual_report:    { label: "수동 신고", color: C.text2 },
  };
  const DDR_STATUS_META = {
    pending:       { label: "대기", color: C.gold,  bg: "#FBF5E8" },
    investigating: { label: "조사중", color: "#9B59B6", bg: "#F5EEF8" },
    confirmed:     { label: "확정", color: C.red,   bg: "#FFF0F0" },
    dismissed:     { label: "기각", color: C.text3, bg: C.bgWarm },
  };
  const filteredDdr = ddrFilter === "all"
    ? directDealReports
    : directDealReports.filter((r) => r.trigger_type === ddrFilter);

  const runFollowUp = async () => {
    setDdrRunning(true);
    try {
      const summary = await checkSiteVisitFollowUp();
      const sched = await checkDirectDealSchedules();
      const schedTotal = sched.no_estimate_72h + sched.no_contract_7d + sched.chat_blackout;
      showToast(`추적 완료 · 알림 ${summary.reminded + summary.inquired} / 취소 ${summary.cancelled} / 플래그 ${summary.flagged + schedTotal}`);
      const { data } = await getDirectDealReports();
      setDirectDealReports(data ?? []);
    } catch (err) {
      showToast("추적 실행 실패", false);
    } finally {
      setDdrRunning(false);
    }
  };

  const setDdrStatus = async (id, status) => {
    const { error } = await updateDirectDealReportStatus(id, status);
    if (!error) setDirectDealReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    else showToast("상태 변경 실패", false);
  };

  // ── 파트너 상담관리(partner_leads) — 조회/상태변경 ──
  async function loadPartnerLeads() {
    setPartnerLeadsLoading(true);
    setPartnerLeadsErr(null);
    try {
      const { data, error } = await getPartnerLeads(user?.id ?? null);
      if (error) { setPartnerLeadsErr(error.message ?? "load failed"); setPartnerLeads([]); }
      else setPartnerLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      setPartnerLeadsErr(err?.message ?? String(err));
      setPartnerLeads([]);
    } finally {
      setPartnerLeadsLoading(false);
    }
  }

  const changePartnerLeadStatus = async (lead, status) => {
    const note = partnerNoteDraft[lead.id];
    // supabase rpc 빌더는 then만 구현(.catch 없음) → try/catch 로 처리.
    let data, error;
    try {
      ({ data, error } = await setPartnerLeadStatus(user?.id ?? null, lead.id, status, note ?? null));
    } catch (err) {
      console.error("[partner_lead_set_status] 예외:", err);
      error = err;
    }
    if (error || data?.error) { showToast("상태 변경 실패", false); return; }
    // 낙관적 반영 — 승인/반려는 처리일시·담당자도 갱신
    const isFinal = status === "APPROVED" || status === "REJECTED";
    setPartnerLeads((prev) => prev.map((l) => l.id === lead.id ? {
      ...l, status,
      admin_note:   (note && note.trim()) ? note.trim() : l.admin_note,
      processed_at: isFinal ? new Date().toISOString() : l.processed_at,
      processed_by: isFinal ? (user?.id ?? l.processed_by) : l.processed_by,
    } : l));
    showToast("상태가 변경됐어요");
  };

  // 보관(soft archive) 토글 — status 와 무관한 별도 정리 상태. hard delete 아님.
  //   archived=true: 기본 목록에서 숨김 / false: 기존 status 그대로 기본 목록 복귀.
  const changePartnerLeadArchive = async (lead, archived) => {
    let data, error;
    try {
      ({ data, error } = await setPartnerLeadArchive(user?.id ?? null, lead.id, archived));
    } catch (err) {
      console.error("[partner_lead_set_archive] 예외:", err);
      error = err;
    }
    if (error || data?.error) { showToast(archived ? "보관 실패" : "보관 해제 실패", false); return; }
    setPartnerLeads((prev) => prev.map((l) => l.id === lead.id ? {
      ...l,
      is_archived: archived,
      archived_at: archived ? new Date().toISOString() : null,
      archived_by: archived ? (user?.id ?? "admin") : null,
    } : l));
    showToast(archived ? "보관함으로 이동했어요" : "보관을 해제했어요");
  };

  // V2 무인 온보딩(069) — 입금확인/승인/반려 전이. company 생성은 하지 않음(최초 로그인 시 브릿지).
  const changePartnerOnboarding = async (lead, action) => {
    let data, error;
    try {
      ({ data, error } = await setPartnerLeadOnboarding(user?.id ?? null, lead.id, action));
    } catch (err) {
      console.error("[partner_lead_onboarding_set] 예외:", err);
      error = err;
    }
    if (error || data?.error) {
      showToast("온보딩 처리 실패" + (error?.message ? `: ${error.message}` : ""), false);
      return;
    }
    setPartnerLeads((prev) => prev.map((l) => l.id === lead.id ? {
      ...l,
      onboarding_status:    data?.onboarding_status ?? l.onboarding_status,
      status:               data?.status ?? l.status,
      deposit_confirmed_at: data?.deposit_confirmed_at ?? l.deposit_confirmed_at,
      approved_at:          data?.approved_at ?? l.approved_at,
      processed_at:         data?.processed_at ?? l.processed_at,
      processed_by:         data?.processed_by ?? l.processed_by,
    } : l));
    showToast(action === "APPROVE" ? "승인 완료 — 신청자 최초 로그인 시 업체 활성화"
      : action === "CONFIRM_DEPOSIT" ? "입금 확인 처리됨" : "반려 처리됨");
  };

  const PARTNER_LEAD_STATUS_META = {
    PENDING:   { label: "접수",   color: C.gold,  bg: "#FBF5E8" },
    CONTACTED: { label: "검토중", color: "#9B59B6", bg: "#F5EEF8" },
    APPROVED:  { label: "승인",   color: C.green, bg: C.greenL },
    REJECTED:  { label: "반려",   color: C.red,   bg: "#FFF0F0" },
  };
  // V1.4: 상태 + 토글 필터 + 통합검색(업체명/대표자명/연락처/사업자번호 부분검색).
  const _pq        = partnerSearch.trim().toLowerCase();
  const _pqDigits  = _pq.replace(/\D/g, "");
  const filteredPartnerLeads = partnerLeads.filter((l) => {
    // 보관(soft archive)은 status 와 무관한 별도 정리 상태. 보관 탭에서만 보관 항목을 노출하고,
    // 그 외 탭(전체/접수/검토중/승인/반려)에서는 보관 항목을 숨긴다.
    const archived = !!l.is_archived;
    if (partnerLeadsFilter === "ARCHIVED") {
      if (!archived) return false;
    } else {
      if (archived) return false;
      if (partnerLeadsFilter !== "all" && l.status !== partnerLeadsFilter) return false;
    }
    if (pfDocBiz && !l.business_license_url) return false;
    if (pfDocIns && !l.insurance_file_url) return false;
    if (pfGuarantee && !l.guarantee_grade) return false;
    if (_pq) {
      const name  = String(l.company_name ?? "").toLowerCase();
      const owner = String(l.owner_name   ?? "").toLowerCase();
      const phone = String(l.phone ?? "").replace(/\D/g, "");
      const biz   = String(l.business_number ?? "").replace(/\D/g, "");
      const textHit = name.includes(_pq) || owner.includes(_pq);
      const numHit  = _pqDigits.length > 0 && (phone.includes(_pqDigits) || biz.includes(_pqDigits));
      if (!textHit && !numHit) return false;
    }
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif" }}>

      {/* 계약 통합 상세(원계약·추가견적 결제/정산/GPS/분쟁) */}
      {detailTarget && (
        <AdminContractDetail
          requestId={detailTarget.requestId ?? null}
          contractId={detailTarget.contractId ?? null}
          adminId={user?.id ?? null}
          onClose={() => setDetailTarget(null)}
        />
      )}

      {/* Header */}
      <div style={{ background: C.surface, padding: "14px 20px", borderBottom: `1px solid ${C.bgWarm}`,
        position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: S.md }}>
        <button onClick={onBack}
          style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.text1, padding: 0 }}>←</button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>관리자 대시보드</div>
          <div style={{ fontSize: 11, color: C.text4 }}>공간마켓 운영 관리</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: S.sm }}>
          {stats.pending > 0 && (
            <div style={{ background: C.red, color: "#fff",
              borderRadius: R.full, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
              심사 대기 {stats.pending}건
            </div>
          )}
          {onHome && (
            <button onClick={onHome}
              style={{ background: C.bgWarm, border: "none", borderRadius: R.md,
                padding: "6px 12px", fontSize: 12, fontWeight: 700, color: C.text2,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              🏠 홈으로
            </button>
          )}
        </div>
      </div>

      {/* 전역 통합검색(읽기 전용) — 클릭 시 해당 탭 이동(+업체 상세) */}
      <AdminGlobalSearch
        adminUserId={user?.id ?? null}
        customers={customers}
        companies={companies}
        onNavigate={(tab) => setMainTab(tab)}
        onOpenCompany={(co) => { if (co) openDetail(co); }}
      />

      {/* Main Tabs — 대분류(운영/거래/프로젝트증빙/콘텐츠/시스템) + 소분류 */}
      <AdminCategoryNav categories={adminCategories} mainTab={mainTab} onSelect={setMainTab} />

      <div style={{ padding: `${S.xl}px ${S.xl}px 90px` }}>

        {import.meta.env.DEV && (
          <div style={{ background: "rgba(0,0,0,0.88)", color: "#0f0", borderRadius: 8, padding: "8px 12px", marginBottom: S.md, fontSize: 11, lineHeight: 1.8, fontFamily: "monospace" }}>
            [DEV] admin_authed: <span style={{ color: "#0f0" }}>true</span> | active_admin_tab: <span style={{ color: "#ff0" }}>{mainTab}</span><br/>
            last_admin_action: <span style={{ color: lastAdminAction ? "#ff0" : "#666" }}>{lastAdminAction ?? "—"}</span> | target: <span style={{ color: "#0ff" }}>{lastAdminTarget ?? "—"}</span><br/>
            last_admin_error: <span style={{ color: lastAdminError ? "#f66" : "#0f0" }}>{lastAdminError ?? "none"}</span><br/>
            admin_log_ok: <span style={{ color: adminLogOk === null ? "#666" : adminLogOk ? "#0f0" : "#f66" }}>{adminLogOk === null ? "—" : String(adminLogOk)}</span> | affected_rows: <span style={{ color: "#0ff" }}>{affectedRows ?? "—"}</span>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: C.text3, fontSize: 14 }}>
            데이터 로딩 중...
          </div>
        )}

        {!loading && !canAccessTab(mainTab) && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: C.text3 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 6 }}>접근 권한이 없습니다</div>
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>이 메뉴는 부여된 운영자 권한 범위에 포함되어 있지 않습니다.<br/>좌측 상단 메뉴에서 접근 가능한 항목을 선택해주세요.</div>
          </div>
        )}

        {!loading && canAccessTab(mainTab) && (
          <>
            {/* ── Dashboard ── */}
            {mainTab === "dashboard" && (
              <div>
                <AdminVisitCards adminUserId={user?.id ?? null} />
                <AdminKpiPanel adminUserId={user?.id ?? null} companies={companies} customers={customers} />
                <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.md }}>📊 현황 요약</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: S.sm, marginBottom: S.xl }}>
                  {[
                    ["업체 심사 대기", stats.pending,    C.gold,    "companies"],
                    ["승인된 업체",    stats.approved,   C.green,   "companies"],
                    ["등록 고객",      stats.customers,  C.brand,   "customers"],
                    ["결제 대기",      stats.payments,   C.gold,    "payments"],
                    ["분쟁 대기",      stats.disputes,   C.red,     "disputes"],
                    ["정산 대기",      stats.settlements, C.brand,  "settlements"],
                    ["반려된 업체",    stats.rejected,   C.text4,   "companies"],
                  ].map(([label, count, color, tab]) => (
                    <div key={label} onClick={() => setMainTab(tab)}
                      style={{ background: C.surface, borderRadius: R.lg,
                        padding: S.xl, textAlign: "center", border: `1px solid ${C.bgWarm}`, cursor: "pointer" }}>
                      <div style={{ fontSize: 28, fontWeight: 900, color }}>{count}</div>
                      <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: C.navyL, borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.trustM}`, marginBottom: S.lg }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.navy, marginBottom: S.md }}>🛡 공간마켓 운영 현황</div>
                  {[
                    ["공간안전결제 에스크로 수수료 (고객)", "3.7% (VAT 포함, 고정)"],
                    ["공간멤버십파트너 이용수수료 (업체)", "4.4% (VAT 포함 · 계약 성사 시에만)"],
                    ["에스크로 구조",        "10/20/40/30"],
                    ["초기 파트너 혜택",     "가입 1개월 수수료 0% · 배지 우선"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between",
                      padding: `${S.xs}px 0`, borderBottom: `1px solid ${C.trustM}` }}>
                      <span style={{ fontSize: 13, color: C.text3 }}>{k}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* STEP O — Emergency Switch */}
                <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, border: `2px solid ${C.red}33` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: S.lg }}>
                    <span style={{ fontSize: 18 }}>🚨</span>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.red }}>긴급 운영 스위치</div>
                    {opsLoading && <span style={{ fontSize: 11, color: C.text4, marginLeft: "auto" }}>저장 중...</span>}
                  </div>
                  {[
                    ["pause_new_payments",  "💳 신규 결제 중지",    "결제 버튼 비활성화"],
                    ["pause_new_bids",      "📋 신규 입찰 중지",    "업체 입찰 제한"],
                    ["pause_new_approvals", "✅ 신규 승인 중지",    "업체 가입 심사 중지"],
                  ].map(([field, label, sub]) => (
                    <div key={field} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: `${S.md}px 0`, borderBottom: `1px solid ${C.bgWarm}` }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{label}</div>
                        <div style={{ fontSize: 11, color: C.text4 }}>{sub}</div>
                      </div>
                      <button
                        onClick={() => toggleOps(field)}
                        disabled={opsLoading}
                        style={{ padding: "6px 16px", borderRadius: R.full, border: "none", fontWeight: 700, fontSize: 13, cursor: opsLoading ? "not-allowed" : "pointer",
                          background: opsConfig[field] ? C.red : C.bgWarm,
                          color: opsConfig[field] ? "#fff" : C.text3 }}>
                        {opsConfig[field] ? "중지 중" : "정상"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Company Management ── */}
            {mainTab === "companies" && (
              <div>
                <div style={{ display: "flex", gap: S.sm, marginBottom: S.xl }}>
                  {[
                    ["대기중", stats.pending,  C.gold ],
                    ["승인",   stats.approved, C.green],
                    ["반려",   stats.rejected, C.red  ],
                  ].map(([label, count, color]) => (
                    <div key={label} style={{ flex: 1, background: C.surface, borderRadius: R.lg,
                      padding: `${S.lg}px ${S.sm}px`, textAlign: "center", border: `1px solid ${C.bgWarm}` }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color }}>{count}</div>
                      <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", background: C.bg, borderRadius: R.lg, padding: 3, marginBottom: S.xl }}>
                  {[["pending","대기중"],["approved","승인"],["rejected","반려"],["all","전체"]].map(([v, l]) => (
                    <button key={v} onClick={() => setCompanyTab(v)}
                      style={{ flex: 1, padding: "8px 4px", border: "none", borderRadius: R.md, cursor: "pointer",
                        background: companyTab === v ? C.surface : "transparent",
                        color: companyTab === v ? C.text1 : C.text3,
                        fontWeight: companyTab === v ? 800 : 500, fontSize: 12,
                        boxShadow: companyTab === v ? "0 1px 4px rgba(0,0,0,0.06)" : "none" }}>
                      {l}
                    </button>
                  ))}
                </div>

                {filtered.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                    <div style={{ fontSize: 14, color: C.text3 }}>해당 항목이 없습니다</div>
                  </div>
                ) : filtered.map(company => {
                  const bm = BADGES[company.badge] || BADGES.basic;
                  const sm = STATUS_MAP[company.status] || STATUS_MAP.pending;
                  const allOk = company.docs.every(d => d.submitted);
                  return (
                    <div key={company.id} onClick={() => openDetail(company)}
                      style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.sm,
                        border: `1.5px solid ${company.status === "pending" ? C.bgWarm : sm.color + "44"}`,
                        cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.sm }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 5 }}>{company.name}</div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ background: bm.bg, color: bm.color, borderRadius: R.full,
                              padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{bm.icon} {bm.label}</span>
                            <span style={{ background: C.surface2, color: C.text3, borderRadius: R.full,
                              padding: "2px 8px", fontSize: 11 }}>공간뱃지예치보증금 {requiredDeposit(company.badge, company.hasInsurance).toLocaleString()}만원</span>
                          </div>
                        </div>
                        <span style={{ background: sm.bg, color: sm.color, borderRadius: R.full,
                          padding: "3px 10px", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{sm.label}</span>
                      </div>
                      <div style={{ display: "flex", gap: S.sm, alignItems: "center" }}>
                        {!allOk && (
                          <span style={{ fontSize: 11, color: C.red, background: "#FFF0F0",
                            borderRadius: R.sm, padding: "2px 6px", fontWeight: 700 }}>⚠ 서류 미완</span>
                        )}
                        <span style={{ fontSize: 11, color: C.text4 }}>제출 {company.submittedAt}</span>
                        <span style={{ marginLeft: "auto", fontSize: 11, color: C.brand, fontWeight: 700 }}>상세 보기 →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── 파트너 상담관리 (partner_leads · Partner Landing v1.1) ── */}
            {mainTab === "partner_leads" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: S.md }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>
                    파트너 상담관리 <span style={{ color: C.brand }}>{partnerLeads.length}건</span>
                  </div>
                  <button onClick={loadPartnerLeads}
                    style={{ padding: "7px 14px", borderRadius: R.lg, background: C.bgWarm, color: C.text2,
                      border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    새로고침
                  </button>
                </div>

                <div style={{ display: "flex", gap: 6, marginBottom: S.md, overflowX: "auto" }}>
                  {[["all", "전체"], ["PENDING", "접수"], ["CONTACTED", "검토중"], ["APPROVED", "승인"], ["REJECTED", "반려"], ["ARCHIVED", "보관"]].map(([v, l]) => {
                    // 전체/상태 탭 카운트는 보관 제외, 보관 탭은 보관 건수.
                    const count = v === "ARCHIVED"
                      ? partnerLeads.filter((x) => x.is_archived).length
                      : v === "all"
                        ? null
                        : partnerLeads.filter((x) => !x.is_archived && x.status === v).length;
                    return (
                      <button key={v} onClick={() => setPartnerLeadsFilter(v)}
                        style={{ padding: "5px 12px", borderRadius: R.full, fontSize: 12, fontWeight: 700,
                          whiteSpace: "nowrap", cursor: "pointer", border: "none",
                          background: partnerLeadsFilter === v ? C.brand : C.bgWarm,
                          color: partnerLeadsFilter === v ? "#fff" : C.text2 }}>
                        {l}{count != null ? ` ${count}` : ""}
                      </button>
                    );
                  })}
                </div>

                {/* V1.4 통합 검색 — 업체명/대표자명/연락처/사업자번호 부분검색 */}
                <div style={{ position: "relative", marginBottom: S.sm }}>
                  <input
                    value={partnerSearch}
                    onChange={(e) => setPartnerSearch(e.target.value)}
                    placeholder="🔍 업체명·대표자명·연락처·사업자번호 검색"
                    style={{ width: "100%", height: 40, borderRadius: R.lg, border: `1px solid ${C.bgWarm}`,
                      padding: "0 36px 0 12px", fontSize: 13, color: C.text1, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
                  {partnerSearch && (
                    <button onClick={() => setPartnerSearch("")}
                      style={{ position: "absolute", right: 8, top: 8, width: 24, height: 24, borderRadius: "50%",
                        border: "none", background: C.bgWarm, color: C.text2, cursor: "pointer", fontSize: 13 }}>×</button>
                  )}
                </div>

                {/* V1.4 토글 필터 — 사업자등록증/보험증권/공간보증 신청 */}
                <div style={{ display: "flex", gap: 6, marginBottom: S.md, flexWrap: "wrap" }}>
                  {[["biz", "사업자등록증 제출", pfDocBiz, setPfDocBiz],
                    ["ins", "보험증권 제출", pfDocIns, setPfDocIns],
                    ["grt", "공간보증 신청", pfGuarantee, setPfGuarantee]].map(([k, label, on, setOn]) => (
                    <button key={k} onClick={() => setOn((v) => !v)}
                      style={{ padding: "5px 12px", borderRadius: R.full, fontSize: 12, fontWeight: 700, cursor: "pointer",
                        border: `1px solid ${on ? C.brand : C.bgWarm}`,
                        background: on ? C.brand : C.surface, color: on ? "#fff" : C.text2 }}>
                      {on ? "✓ " : ""}{label}
                    </button>
                  ))}
                  {(partnerSearch || pfDocBiz || pfDocIns || pfGuarantee) && (
                    <span style={{ fontSize: 12, color: C.text3, alignSelf: "center" }}>· {filteredPartnerLeads.length}건</span>
                  )}
                </div>

                {partnerLeadsErr && (
                  <div style={{ fontSize: 12, color: C.red, marginBottom: S.sm }}>조회 오류: {partnerLeadsErr}</div>
                )}

                {partnerLeadsLoading ? (
                  <div style={{ textAlign: "center", padding: "60px 0", fontSize: 14, color: C.text3 }}>불러오는 중…</div>
                ) : filteredPartnerLeads.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                    <div style={{ fontSize: 14, color: C.text3 }}>상담 신청 없음</div>
                  </div>
                ) : filteredPartnerLeads.map((l) => {
                  const sm = PARTNER_LEAD_STATUS_META[l.status] ?? { label: l.status, color: C.text2, bg: C.bgWarm };
                  return (
                    <div key={l.id} style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.sm, border: `1px solid ${C.bgWarm}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.sm }}>
                        <div>
                          <span style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>{l.company_name}</span>
                          <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                            신청일 {l.created_at ? new Date(l.created_at).toLocaleString("ko-KR") : "—"}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: sm.color, background: sm.bg,
                          borderRadius: R.full, padding: "3px 10px" }}>{sm.label}</span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px", fontSize: 12, color: C.text2, marginBottom: S.sm }}>
                        <div>대표자: <b>{l.owner_name || "—"}</b></div>
                        <div>연락처: <b>{l.phone || "—"}</b></div>
                        <div>사업자번호: <b>{l.business_number || "—"}</b></div>
                        <div>보험: <b>{l.insurance_status || "—"}</b></div>
                        <div>시공지역: <b>{l.service_area || "—"}</b></div>
                        <div>전문분야: <b>{l.specialty || "—"}</b></div>
                      </div>

                      {l.memo && (
                        <div style={{ fontSize: 12, color: C.text2, marginBottom: S.sm, wordBreak: "break-all",
                          background: C.bg, borderRadius: R.md, padding: "8px 10px" }}>
                          문의: “{l.memo}”
                        </div>
                      )}

                      {/* V1.4 제출 서류 — 제출됨(초록)+확대보기 모달 / 미제출(빨강) 구분 표시 */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: S.sm }}>
                        {l.business_license_url ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.green, background: C.greenL,
                              borderRadius: R.lg, padding: "6px 10px", border: `1px solid ${C.green}33` }}>✅ 사업자등록증 제출됨</span>
                            <button onClick={() => setDocPreview({ url: l.business_license_url, title: `${l.company_name} · 사업자등록증` })}
                              style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: C.green, border: "none",
                                borderRadius: R.lg, padding: "6px 12px", cursor: "pointer" }}>🔍 사업자등록증 보기</button>
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.red, background: "#FFF0F0",
                            borderRadius: R.lg, padding: "6px 12px", border: "1px solid #F3C7C7" }}>
                            ⛔ 사업자등록증 미제출 (승인 불가)
                          </span>
                        )}
                        {l.insurance_file_url ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.green, background: C.greenL,
                              borderRadius: R.lg, padding: "6px 10px", border: `1px solid ${C.green}33` }}>✅ 보험증권 제출됨</span>
                            <button onClick={() => setDocPreview({ url: l.insurance_file_url, title: `${l.company_name} · 시공보험증권` })}
                              style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: C.green, border: "none",
                                borderRadius: R.lg, padding: "6px 12px", cursor: "pointer" }}>🔍 시공보험증권 보기</button>
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.red, background: "#FFF0F0",
                            borderRadius: R.lg, padding: "6px 12px", border: "1px solid #F3C7C7" }}>
                            ⛔ 보험증권 미제출 (예치금 2배)
                          </span>
                        )}
                      </div>

                      {/* 업체 운영준수서약 — 가입 신청 시 필수 동의 항목(미동의 시 신청 불가). 표시 전용. */}
                      {/* 운영준수서약 제출 이력(071) — 동의 여부 + 동의 일시. 심사/분쟁/제재/증빙/감사 기준 데이터. */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: S.sm,
                        fontSize: 12, color: C.text2, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700 }}>운영준수서약:</span>
                        {l.pledge_agreed ? (
                          <>
                            <span style={{ fontWeight: 700, color: C.green, background: C.greenL,
                              borderRadius: R.lg, padding: "4px 10px", border: `1px solid ${C.green}33` }}>✅ 동의</span>
                            {l.pledge_agreed_at && (
                              <span style={{ fontSize: 11, color: C.text4 }}>
                                동의 일시 {new Date(l.pledge_agreed_at).toLocaleString("ko-KR")}
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ fontWeight: 700, color: C.red, background: "#FFF0F0",
                            borderRadius: R.lg, padding: "4px 10px", border: "1px solid #F3C7C7" }}>❌ 미동의</span>
                        )}
                      </div>

                      {/* V2 무인 온보딩(069) — 공간보증 신청 진행상태 + 입금확인/승인/반려 */}
                      {(l.guarantee_grade || (l.onboarding_status && l.onboarding_status !== "PENDING_DOCS")) && (() => {
                        const og = ONBOARDING_GRADE_MAP[l.guarantee_grade];
                        const om = ONBOARDING_STATUS_META[l.onboarding_status] ?? { label: l.onboarding_status, color: C.text2, bg: C.bgWarm };
                        return (
                          <div style={{ background: "#F7F4EC", border: `1px solid ${C.gold}`, borderRadius: R.md,
                            padding: "10px 12px", marginBottom: S.sm }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color: C.text1 }}>공간보증 신청</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: om.color, background: om.bg,
                                borderRadius: R.full, padding: "3px 10px" }}>{om.label}</span>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 12px", fontSize: 12, color: C.text2 }}>
                              <div>등급: <b>{og ? `${og.emoji} ${og.label}` : "—"}</b></div>
                              <div>예치금: <b>{l.guarantee_amount != null ? wonFromManwon(l.guarantee_amount) : "—"}</b></div>
                              <div>보험: <b>{l.insurance_yn == null ? "—" : (l.insurance_yn ? "가입" : "미가입(2배)")}</b></div>
                              <div>주문번호: <b style={{ fontSize: 11 }}>{l.order_id || "—"}</b></div>
                              {l.deposit_confirmed_at && <div>입금확인: <b>{new Date(l.deposit_confirmed_at).toLocaleDateString("ko-KR")}</b></div>}
                              {l.approved_at && <div>승인일: <b>{new Date(l.approved_at).toLocaleDateString("ko-KR")}</b></div>}
                              {l.company_id && <div style={{ gridColumn: "1 / -1", color: C.green }}>✅ 업체 활성화됨</div>}
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                              <button disabled={l.onboarding_status !== "PENDING_DEPOSIT"}
                                onClick={() => changePartnerOnboarding(l, "CONFIRM_DEPOSIT")}
                                style={{ padding: "6px 12px", borderRadius: R.lg, fontSize: 12, fontWeight: 700, border: `1px solid ${C.bgWarm}`,
                                  background: l.onboarding_status === "PENDING_DEPOSIT" ? "#fff" : C.bgWarm,
                                  color: l.onboarding_status === "PENDING_DEPOSIT" ? C.text1 : C.text4,
                                  cursor: l.onboarding_status === "PENDING_DEPOSIT" ? "pointer" : "default" }}>입금확인</button>
                              <button disabled={l.onboarding_status !== "AWAITING_APPROVAL"}
                                onClick={() => changePartnerOnboarding(l, "APPROVE")}
                                style={{ padding: "6px 12px", borderRadius: R.lg, fontSize: 12, fontWeight: 700, border: "none",
                                  background: l.onboarding_status === "AWAITING_APPROVAL" ? C.green : C.bgWarm,
                                  color: l.onboarding_status === "AWAITING_APPROVAL" ? "#fff" : C.text4,
                                  cursor: l.onboarding_status === "AWAITING_APPROVAL" ? "pointer" : "default" }}>승인</button>
                              <button disabled={l.onboarding_status === "APPROVED" || l.onboarding_status === "REJECTED"}
                                onClick={() => changePartnerOnboarding(l, "REJECT")}
                                style={{ padding: "6px 12px", borderRadius: R.lg, fontSize: 12, fontWeight: 700, border: `1px solid ${C.bgWarm}`,
                                  background: "#fff", color: C.red,
                                  cursor: (l.onboarding_status === "APPROVED" || l.onboarding_status === "REJECTED") ? "default" : "pointer",
                                  opacity: (l.onboarding_status === "APPROVED" || l.onboarding_status === "REJECTED") ? 0.5 : 1 }}>반려</button>
                            </div>
                          </div>
                        );
                      })()}

                      {(l.processed_at || l.processed_by) && (
                        <div style={{ fontSize: 11, color: C.text4, marginBottom: S.sm }}>
                          처리: {l.processed_at ? new Date(l.processed_at).toLocaleString("ko-KR") : ""}
                          {l.processed_by ? ` · 담당 ${String(l.processed_by).slice(0, 8)}` : ""}
                        </div>
                      )}

                      {/* 관리자 메모 입력 — 상태 변경 시 함께 저장 */}
                      <textarea
                        value={partnerNoteDraft[l.id] ?? (l.admin_note ?? "")}
                        onChange={(e) => setPartnerNoteDraft((p) => ({ ...p, [l.id]: e.target.value }))}
                        placeholder="관리자 메모 (상태 변경 시 함께 저장)"
                        rows={2}
                        style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${C.bgWarm}`, borderRadius: R.md,
                          padding: "8px 10px", fontSize: 12, fontFamily: "inherit", color: C.text1, background: C.bg,
                          resize: "none", outline: "none", marginBottom: S.sm }}
                      />

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {l.is_archived ? (
                          <>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.text3, background: C.bgWarm,
                              borderRadius: R.lg, padding: "6px 12px" }}>
                              🗂 보관됨{l.archived_at ? ` · ${new Date(l.archived_at).toLocaleDateString("ko-KR")}` : ""}
                            </span>
                            <button onClick={() => changePartnerLeadArchive(l, false)}
                              style={{ padding: "6px 14px", borderRadius: R.lg, fontSize: 12, fontWeight: 700,
                                border: `1px solid ${C.brand}`, background: "#fff", color: C.brand, cursor: "pointer" }}>
                              보관 해제
                            </button>
                          </>
                        ) : (
                          <>
                            {[["CONTACTED", "검토중"], ["APPROVED", "승인"], ["REJECTED", "반려"], ["PENDING", "접수로"]].map(([v, lb]) => (
                              <button key={v} disabled={l.status === v} onClick={() => changePartnerLeadStatus(l, v)}
                                style={{ padding: "6px 14px", borderRadius: R.lg, fontSize: 12, fontWeight: 700,
                                  border: `1px solid ${l.status === v ? C.brand : C.bgWarm}`,
                                  background: l.status === v ? C.brand : "#fff",
                                  color: l.status === v ? "#fff" : C.text2,
                                  cursor: l.status === v ? "default" : "pointer" }}>{lb}</button>
                            ))}
                            <button onClick={() => setConfirm({
                              emoji: "🗂",
                              title: "이 항목을 보관하시겠습니까?",
                              msg: "보관된 항목은 보관함(보관 탭)에서 다시 확인할 수 있습니다.",
                              onConfirm: async () => { await changePartnerLeadArchive(l, true); },
                            })}
                              style={{ padding: "6px 14px", borderRadius: R.lg, fontSize: 12, fontWeight: 700,
                                border: `1px solid ${C.bgWarm}`, background: C.bg, color: C.text3, cursor: "pointer", marginLeft: "auto" }}>
                              🗂 보관
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Customer Management ── */}
            {mainTab === "customers" && (
              <div>
                {customersErr ? (
                  <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xxl,
                    textAlign: "center", border: `1px solid ${C.bgWarm}` }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, marginBottom: 8 }}>
                      {/ADMIN_ONLY|403/.test(customersErrMsg ?? "") ? "관리자 전용" : "고객 목록을 불러올 수 없어요"}
                    </div>
                    <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.7 }}>
                      {/ADMIN_ONLY|403/.test(customersErrMsg ?? "")
                        ? <>고객관리는 관리자(role=admin)만 접근할 수 있습니다.<br/>운영자·일반 사용자는 이용할 수 없습니다.</>
                        : /SERVICE_NOT_CONFIGURED|500/.test(customersErrMsg ?? "")
                          ? <>서버에 <b>SUPABASE_SERVICE_ROLE_KEY</b> 환경변수 설정이 필요합니다.<br/>(Vercel 프로젝트 환경변수)</>
                          : <>서버 API(/api/admin/users) 연동을 확인해주세요.</>}
                    </div>
                    {customersErrMsg && (
                      <div style={{ fontSize: 10, color: C.text4, marginTop: 10, wordBreak: "break-all" }}>상세: {customersErrMsg}</div>
                    )}
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: S.md }}>
                      고객 목록 <span style={{ color: C.brand }}>{customers.length}명</span>
                    </div>
                    {customers.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "60px 0", color: C.text3, fontSize: 14 }}>
                        등록된 고객이 없습니다
                      </div>
                    ) : customers.map(customer => {
                      const isEditing = editingCustomerId === customer.id;
                      return (
                        <div key={customer.id} style={{ background: C.surface, borderRadius: R.xl, padding: S.xl,
                          marginBottom: S.sm, border: `1px solid ${C.bgWarm}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.sm }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>{customer.name}</div>
                            <div style={{ display: "flex", gap: S.xs, alignItems: "center" }}>
                              <span style={{ background: C.brandL, color: C.brand, borderRadius: R.full,
                                padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>견적 {customer.requests}건</span>
                              <button onClick={() => {
                                if (isEditing) { setEditingCustomerId(null); return; }
                                setEditingCustomerId(customer.id);
                                setCustomerEditForm({ name: customer.name, phone: customer.phone, region: customer.region });
                              }} style={{ padding: "4px 10px", borderRadius: R.full, border: `1px solid ${C.bgWarm}`,
                                background: isEditing ? C.surface2 : C.surface, color: C.text3, fontSize: 11, cursor: "pointer" }}>
                                {isEditing ? "취소" : "수정"}
                              </button>
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: C.text3 }}>📱 {customer.phone} · 📍 {customer.region}</div>
                          <div style={{ fontSize: 11, color: C.text4, marginTop: 4 }}>가입일: {customer.joinedAt}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginTop: S.sm }}>
                            {customer.is_identity_verified ? (
                              <>
                                <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>✓ 본인인증 완료</span>
                                <span style={{ fontSize: 10, color: C.text4 }}>
                                  {customer.identity_verified_at ? new Date(customer.identity_verified_at).toLocaleDateString("ko-KR") : ""}
                                  {customer.identity_provider ? ` (${customer.identity_provider})` : ""}
                                </span>
                                <button onClick={async () => {
                                  const { error } = await adminVerifyUserIdentity(customer.id, user?.id, "revoked");
                                  if (error) showToast(error.message ?? "처리 실패", false);
                                  else { showToast("인증 취소 완료"); setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, is_identity_verified: false, identity_verified_at: null, identity_provider: null, identity_verification_status: "revoked" } : c)); }
                                }} style={{ padding: "3px 8px", borderRadius: R.full, border: `1px solid ${C.red}33`, background: "#FFF0F0", color: C.red, fontSize: 10, fontWeight: 700, cursor: "pointer", marginLeft: "auto" }}>
                                  취소
                                </button>
                              </>
                            ) : (
                              <>
                                <span style={{ fontSize: 11, color: customer.identity_verification_status === "required" ? C.gold : C.text4, fontWeight: customer.identity_verification_status === "required" ? 700 : 400 }}>
                                  {customer.identity_verification_status === "required" ? "⚠️ 인증 필요" : "미인증"}
                                </span>
                                <button onClick={async () => {
                                  const { error } = await adminVerifyUserIdentity(customer.id, user?.id, "verified");
                                  if (error) showToast(error.message ?? "처리 실패", false);
                                  else { showToast("본인인증 처리 완료"); setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, is_identity_verified: true, identity_verified_at: new Date().toISOString(), identity_provider: "admin_manual", identity_verification_status: "verified" } : c)); }
                                }} style={{ padding: "3px 8px", borderRadius: R.full, border: `1px solid ${C.brandM}`, background: C.brandL, color: C.brand, fontSize: 10, fontWeight: 700, cursor: "pointer", marginLeft: "auto" }}>
                                  수동 인증
                                </button>
                              </>
                            )}
                          </div>
                          {/* 계정 상태 배지 + 제재/토큰 관리 토글 — service-role API 경유(RLS 안전) */}
                          <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginTop: S.sm }}>
                            {(() => {
                              const meta = USER_STATUS_META[customer.accountStatus] ?? USER_STATUS_META.NORMAL;
                              return (
                                <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, background: meta.bg,
                                  borderRadius: R.full, padding: "2px 9px" }}>{meta.label}</span>
                              );
                            })()}
                            <span style={{ fontSize: 11, color: C.text4 }}>🪙 {customer.spaceTokens ?? 0} · 🌡 {customer.spaceTemp ?? 36.5}°</span>
                            <button onClick={() => {
                              if (managingCustomerId === customer.id) { setManagingCustomerId(null); return; }
                              setManagingCustomerId(customer.id); setAdjReason(""); setCustomerTokenAmt("");
                            }} style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: R.full,
                              border: `1px solid ${C.bgWarm}`, background: managingCustomerId === customer.id ? C.surface2 : C.surface,
                              color: C.text3, fontSize: 11, cursor: "pointer" }}>
                              {managingCustomerId === customer.id ? "닫기" : "제재/토큰"}
                            </button>
                          </div>
                          {managingCustomerId === customer.id && (
                            <div style={{ marginTop: S.md, background: C.surface2, borderRadius: R.lg, padding: S.md, border: `1px solid ${C.bgWarm}` }}>
                              {/* 사유(제재/토큰/온도 공용 — admin_logs.reason 으로 기록) */}
                              <div style={{ fontSize: 11, color: C.text3, marginBottom: 3 }}>사유 (admin_logs 기록)</div>
                              <input value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="변경 사유를 입력하세요"
                                style={{ width: "100%", padding: "8px 12px", borderRadius: R.md, border: `1px solid ${C.bgWarm}`,
                                  fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fff", marginBottom: S.md }} />

                              {/* 계정 상태 변경 */}
                              <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, marginBottom: 6 }}>계정 상태</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: S.md }}>
                                {Object.entries(USER_STATUS_META).map(([key, meta]) => {
                                  const active = (customer.accountStatus ?? "NORMAL") === key;
                                  return (
                                    <button key={key} disabled={actionLoading || active}
                                      onClick={() => handleCustomerStatus(customer, key, adjReason)}
                                      style={{ padding: "6px 11px", borderRadius: R.full, fontSize: 11.5, fontWeight: 700,
                                        border: `1px solid ${active ? meta.color : C.bgWarm}`,
                                        background: active ? meta.bg : C.surface, color: active ? meta.color : C.text2,
                                        cursor: active ? "default" : "pointer", opacity: actionLoading ? 0.5 : 1 }}>
                                      {active ? "● " : ""}{meta.label}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* 토큰 지급/회수 */}
                              <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, marginBottom: 6 }}>토큰 (현재 {customer.spaceTokens ?? 0})</div>
                              <div style={{ display: "flex", gap: 6, marginBottom: S.md }}>
                                <input type="number" min="1" value={customerTokenAmt} onChange={e => setCustomerTokenAmt(e.target.value)} placeholder="수량"
                                  style={{ flex: 1, padding: "8px 12px", borderRadius: R.md, border: `1px solid ${C.bgWarm}`,
                                    fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fff" }} />
                                <button disabled={actionLoading || !(Number(customerTokenAmt) > 0)}
                                  onClick={() => { handleAdjustTokens(customer, Math.abs(Number(customerTokenAmt))); setCustomerTokenAmt(""); }}
                                  style={{ padding: "8px 14px", borderRadius: R.md, border: "none", background: C.brand, color: "#fff",
                                    fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: actionLoading || !(Number(customerTokenAmt) > 0) ? 0.5 : 1 }}>지급</button>
                                <button disabled={actionLoading || !(Number(customerTokenAmt) > 0)}
                                  onClick={() => { handleAdjustTokens(customer, -Math.abs(Number(customerTokenAmt))); setCustomerTokenAmt(""); }}
                                  style={{ padding: "8px 14px", borderRadius: R.md, border: `1px solid ${C.red}55`, background: "#FFF0F0", color: C.red,
                                    fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: actionLoading || !(Number(customerTokenAmt) > 0) ? 0.5 : 1 }}>회수</button>
                              </div>

                              {/* 공간온도 조정 */}
                              <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, marginBottom: 6 }}>공간온도 (현재 {customer.spaceTemp ?? 36.5}°)</div>
                              <div style={{ display: "flex", gap: 6 }}>
                                {[-1, -0.5, +0.5, +1].map(d => (
                                  <button key={d} disabled={actionLoading} onClick={() => handleAdjustTemp(customer, d)}
                                    style={{ flex: 1, padding: "8px 0", borderRadius: R.md, border: `1px solid ${C.bgWarm}`,
                                      background: C.surface, color: C.text2, fontSize: 12, fontWeight: 700,
                                      cursor: "pointer", opacity: actionLoading ? 0.5 : 1 }}>
                                    {d > 0 ? `+${d}` : d}°
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {isEditing && (
                            <div style={{ marginTop: S.md, background: C.surface2, borderRadius: R.lg, padding: S.md, border: `1px solid ${C.bgWarm}` }}>
                              {[["name","이름"],["phone","전화번호"],["region","지역"]].map(([key,label]) => (
                                <div key={key} style={{ marginBottom: S.sm }}>
                                  <div style={{ fontSize: 11, color: C.text3, marginBottom: 3 }}>{label}</div>
                                  <input value={customerEditForm[key] ?? ""} onChange={e => setCustomerEditForm(p => ({ ...p, [key]: e.target.value }))}
                                    style={{ width: "100%", padding: "8px 12px", borderRadius: R.md, border: `1px solid ${C.bgWarm}`,
                                      fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fff" }} />
                                </div>
                              ))}
                              <button disabled={customerEditSaving} onClick={async () => {
                                setCustomerEditSaving(true);
                                const { data, error } = await adminUpdateUserInfo(customer.id, customerEditForm, user?.id ?? null);
                                if (error) {
                                  showToast(error.message ?? "수정 실패", false);
                                  trackAdmin("UPDATE_CUSTOMER", customer.id, error.message, false, 0);
                                } else {
                                  showToast("고객 정보 수정 완료");
                                  trackAdmin("UPDATE_CUSTOMER", customer.id, null, true, 1);
                                  setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, ...customerEditForm } : c));
                                  setEditingCustomerId(null);
                                }
                                setCustomerEditSaving(false);
                              }} style={{ width: "100%", padding: "9px", background: customerEditSaving ? C.bgWarm : C.brand,
                                color: customerEditSaving ? C.text3 : "#fff", border: "none", borderRadius: R.lg,
                                fontWeight: 700, fontSize: 13, cursor: customerEditSaving ? "not-allowed" : "pointer" }}>
                                {customerEditSaving ? "저장중…" : "저장"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}

            {/* ── Hidden Request Management ── */}
            {mainTab === "hidden" && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 4 }}>
                  숨김 요청 목록
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.red, marginLeft: 8 }}>
                    {hiddenRequests.length}건
                  </span>
                </div>
                <div style={{ fontSize: 12, color: C.text3, marginBottom: S.lg }}>
                  의뢰인이 숨긴 견적 요청입니다. "다시 보이기"로 복구할 수 있습니다.
                </div>

                {hiddenLoading ? (
                  <div style={{ textAlign: "center", padding: "60px 0", color: C.text3, fontSize: 14 }}>
                    로딩 중...
                  </div>
                ) : hiddenRequests.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                    <div style={{ fontSize: 14, color: C.text3 }}>숨김 처리된 요청이 없습니다</div>
                  </div>
                ) : hiddenRequests.map(req => (
                  <div key={req.id} style={{ background: C.surface, borderRadius: R.xl, padding: S.xl,
                    marginBottom: S.sm, border: `1.5px solid ${C.red}22` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.sm }}>
                      <div style={{ flex: 1, marginRight: S.sm }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: 4 }}>
                          {req.space_type ?? "—"} · {req.area ?? "—"} · {req.size ?? "—"}평
                        </div>
                        <div style={{ fontSize: 12, color: C.text3, marginBottom: 2 }}>
                          스타일: {req.style ?? "—"}
                        </div>
                        {req.description && (
                          <div style={{ fontSize: 11, color: C.text4, lineHeight: 1.5 }}>
                            {req.description.slice(0, 60)}{req.description.length > 60 ? "…" : ""}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <span style={{ background: "#FFF0F0", color: C.red, borderRadius: R.full,
                          padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>숨김</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 11, color: C.text4 }}>
                          숨김 처리: {req.archived_at ? new Date(req.archived_at).toLocaleDateString("ko-KR") : "—"}
                        </div>
                        {req.hidden_reason && (
                          <div style={{ fontSize: 11, color: C.text4 }}>사유: {req.hidden_reason}</div>
                        )}
                      </div>
                      <button
                        disabled={restoring === req.id}
                        onClick={async () => {
                          setRestoring(req.id);
                          const { data, error } = await adminRestoreRequest(req.id);
                          if (!error && data) {
                            setHiddenRequests(prev => prev.filter(r => r.id !== req.id));
                            showToast("요청이 다시 노출됩니다");
                          } else {
                            showToast("복구 실패", false);
                          }
                          setRestoring(null);
                        }}
                        style={{ padding: "8px 16px", background: C.brandL, color: C.brand,
                          border: `1px solid ${C.brandM}`, borderRadius: R.lg, fontWeight: 700,
                          fontSize: 12, cursor: restoring === req.id ? "not-allowed" : "pointer",
                          opacity: restoring === req.id ? 0.6 : 1 }}>
                        {restoring === req.id ? "처리 중..." : "다시 보이기"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Payment Management ── */}
            {mainTab === "payments" && (
              <div>
                <div style={{ display: "flex", gap: S.xs, marginBottom: S.lg, overflowX: "auto" }}>
                  {[["all","전체"], ["PENDING","대기"], ["PAID","완료"], ["FAILED","실패"], ["REFUNDED","환불"]].map(([v, l]) => (
                    <button key={v} onClick={() => setPaymentFilter(v)}
                      style={{ padding: "7px 14px", borderRadius: R.full, cursor: "pointer", whiteSpace: "nowrap",
                        background: paymentFilter === v ? C.brand : C.surface,
                        color: paymentFilter === v ? "#fff" : C.text3,
                        fontWeight: paymentFilter === v ? 700 : 500, fontSize: 12,
                        border: `1px solid ${paymentFilter === v ? C.brand : C.bgWarm}` }}>{l}</button>
                  ))}
                </div>

                {paymentOrders
                  .filter(o => paymentFilter === "all" || o.status === paymentFilter)
                  .length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>💳</div>
                    <div style={{ fontSize: 14, color: C.text3 }}>해당 결제 내역이 없습니다</div>
                  </div>
                ) : paymentOrders
                  .filter(o => paymentFilter === "all" || o.status === paymentFilter)
                  .map(order => {
                    const sm = PAYMENT_STATUS_META[order.status] ?? PAYMENT_STATUS_META.PENDING;
                    return (
                      <div key={order.id} style={{ background: C.surface, borderRadius: R.xl, padding: S.xl,
                        marginBottom: S.sm, border: `1px solid ${C.bgWarm}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.sm }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>
                              {order.users?.name ?? "고객"} <span style={{ fontSize: 11, color: C.text4 }}>{order.users?.phone ?? ""}</span>
                            </div>
                            <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                              {order.payment_method ?? "—"} · {new Date(order.created_at).toLocaleDateString("ko-KR")}
                            </div>
                          </div>
                          <span style={{ background: sm.bg, color: sm.color, borderRadius: R.full,
                            padding: "3px 10px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{sm.label}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.md }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: C.text1 }}>{(order.total_amount ?? 0).toLocaleString()}만원</div>
                            <div style={{ fontSize: 11, color: C.text4 }}>시공비 {(order.amount ?? 0).toLocaleString()} + 수수료 {(order.customer_fee ?? 0).toLocaleString()}</div>
                          </div>
                          {order.admin_note && (
                            <div style={{ fontSize: 11, color: C.text3, fontStyle: "italic", maxWidth: 120, textAlign: "right" }}>{order.admin_note}</div>
                          )}
                        </div>
                        {order.request_id && <AdminCheckpoints requestId={order.request_id} adminUserId={user?.id ?? null} />}
                        {order.contract_id && order.payment_source !== "change_order" && (
                          <AdminChangeOrderHistory contractId={order.contract_id} adminId={user?.id ?? null} />
                        )}
                        {(order.request_id || order.contract_id) && (
                          <button onClick={() => setDetailTarget({ requestId: order.request_id ?? null, contractId: order.contract_id ?? null })}
                            style={{ width: "100%", padding: "9px", marginBottom: S.sm, background: C.navyL, color: C.navy, border: `1px solid ${C.trustM}`, borderRadius: R.lg, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                            📋 계약 통합 상세 보기
                          </button>
                        )}
                        <div style={{ display: "flex", gap: S.sm }}>
                          {order.status !== "REFUNDED" && order.status !== "CANCELLED" && (
                            <button onClick={() => setConfirm({
                              emoji: "🔄", title: "환불 요청 기록",
                              msg: `이 결제를 환불 처리로 기록합니다.\n실제 자동 환불은 발생하지 않습니다.`,
                              needsReason: true,
                              onConfirm: async (reason) => {
                                const { error } = await adminUpdatePaymentOrder(order.id, user?.id ?? null, { status: "REFUNDED", adminNote: reason });
                                if (!error) {
                                  setPaymentOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: "REFUNDED", admin_note: reason } : o));
                                  showToast("환불 기록 완료");
                                } else { showToast("처리 실패", false); }
                              },
                            })}
                              style={{ flex: 1, padding: "9px", background: "#FFF0F0", color: C.red,
                                border: `1px solid ${C.red}33`, borderRadius: R.lg, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                              환불 기록
                            </button>
                          )}
                          {order.status === "PAID" && (
                            <button onClick={() => setConfirm({
                              emoji: "⏸", title: "지급 보류",
                              msg: `결제 지급을 보류 처리합니다.`,
                              needsReason: true,
                              onConfirm: async (reason) => {
                                const { error } = await adminUpdatePaymentOrder(order.id, user?.id ?? null, { status: "CANCELLED", adminNote: reason });
                                if (!error) {
                                  setPaymentOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: "CANCELLED", admin_note: reason } : o));
                                  showToast("지급 보류 처리 완료");
                                } else { showToast("처리 실패", false); }
                              },
                            })}
                              style={{ flex: 1, padding: "9px", background: "#FBF5E8", color: C.gold,
                                border: `1px solid ${C.gold}44`, borderRadius: R.lg, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                              지급 보류
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* ── Dispute Management ── */}
            {mainTab === "disputes" && (
              <div>
                {disputes.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>⚖️</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text1, marginBottom: 8 }}>분쟁 대기 없음</div>
                    <div style={{ fontSize: 13, color: C.text3 }}>실시간 분쟁 내역은 거래 발생 시 표시됩니다</div>
                  </div>
                ) : disputes.map(d => {
                  const sm = DISPUTE_STATUS_META[d.dispute_status] ?? DISPUTE_STATUS_META.DISPUTE_OPEN;
                  return (
                    <div key={d.id} style={{ background: C.surface, borderRadius: R.xl, padding: S.xl,
                      marginBottom: S.sm, border: `1.5px solid ${sm.color}33` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.sm }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>
                            {d.requests?.area ?? "—"} · {d.requests?.space_type ?? ""}
                          </div>
                          <div style={{ fontSize: 11, color: C.text3 }}>업체: {d.companies?.name ?? "—"}</div>
                          <div style={{ fontSize: 11, color: C.text4 }}>
                            {d.disputed_at ? new Date(d.disputed_at).toLocaleDateString("ko-KR") : "—"}
                          </div>
                        </div>
                        <span style={{ background: sm.bg, color: sm.color, borderRadius: R.full,
                          padding: "3px 10px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{sm.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.text2, marginBottom: S.md }}>
                        분쟁사유: {d.dispute_reason ?? "—"}
                      </div>
                      <AdminCheckpoints requestId={d.request_id} adminUserId={user?.id ?? null} />
                      <AdminChangeOrderHistory contractId={d.id} adminId={user?.id ?? null} title="추가견적 이력 (분쟁 참고)" />
                      <button onClick={() => setDetailTarget({ requestId: d.request_id ?? null, contractId: d.id ?? null })}
                        style={{ width: "100%", padding: "9px", marginBottom: S.md, background: C.navyL, color: C.navy, border: `1px solid ${C.trustM}`, borderRadius: R.lg, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        📋 계약 통합 상세 보기
                      </button>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.brand, marginBottom: S.md }}>
                        총 금액: {(d.total_amount ?? 0).toLocaleString()}만원
                      </div>
                      <div style={{ display: "flex", gap: S.sm }}>
                        {["UNDER_REVIEW", "RESOLVED", "REFUNDED"].map(st => {
                          if (st === d.dispute_status) return null;
                          const m = DISPUTE_STATUS_META[st];
                          return (
                            <button key={st}
                              onClick={() => setConfirm({
                                emoji: "⚖️", title: `상태를 "${m.label}"로 변경`,
                                msg: `분쟁 상태를 변경합니다.`,
                                needsReason: st === "RESOLVED" || st === "REFUNDED",
                                onConfirm: async (reason) => {
                                  const { error } = await adminResolveDispute(d.id, user?.id ?? null, st, reason ?? null);
                                  if (!error) {
                                    setDisputes(prev => prev.map(x => x.id === d.id ? { ...x, dispute_status: st } : x));
                                    showToast("상태 변경 완료");
                                    trackAdmin(`DISPUTE_${st}`, d.id, null, true, 1);
                                  } else {
                                    showToast("처리 실패", false);
                                    trackAdmin(`DISPUTE_${st}`, d.id, error.message, false, 0);
                                  }
                                },
                              })}
                              style={{ flex: 1, padding: "9px", background: m.bg, color: m.color,
                                border: `1px solid ${m.color}33`, borderRadius: R.lg, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Settlement Management ── */}
            {mainTab === "settlements" && (
              <div>
                {/* 정산관리 뷰 전환 — 거래별 정산(신규 V2.2) / 단계별 지급(기존 보존) */}
                <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                  {[["contract", "거래별 정산"], ["stage", "단계별 지급(기존)"]].map(([v, l]) => (
                    <button key={v} onClick={() => setSettleView(v)}
                      style={{ padding: "7px 14px", borderRadius: R.full, fontSize: 12.5, fontWeight: 700,
                        border: `1px solid ${settleView === v ? C.brand : C.bgWarm}`, cursor: "pointer",
                        background: settleView === v ? C.brand : C.surface, color: settleView === v ? "#fff" : C.text2 }}>
                      {l}
                    </button>
                  ))}
                </div>

                {settleView === "contract" ? (
                  <SettlementManagement adminUserId={user?.id ?? null} showToast={showToast} />
                ) : (
                <div>
                {settlements.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>💰</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text1, marginBottom: 8 }}>정산 대기 없음</div>
                    <div style={{ fontSize: 13, color: C.text3 }}>에스크로 정산 내역은 거래 완료 시 표시됩니다</div>
                  </div>
                ) : settlements.map(p => {
                  const sm = PAYOUT_STATUS_META[p.status] ?? PAYOUT_STATUS_META.PENDING;
                  return (
                    <div key={p.id} style={{ background: C.surface, borderRadius: R.xl, padding: S.xl,
                      marginBottom: S.sm, border: `1px solid ${C.bgWarm}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.sm }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>
                            {p.companies?.name ?? "—"} · {p.stage}단계
                          </div>
                          <div style={{ fontSize: 11, color: C.text3 }}>
                            {p.percent}% · 정산액 {(p.net_amount ?? 0).toLocaleString()}만원
                          </div>
                        </div>
                        <span style={{ background: sm.bg, color: sm.color, borderRadius: R.full,
                          padding: "3px 10px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{sm.label}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.text4, marginBottom: S.md }}>
                        총액 {(p.amount ?? 0).toLocaleString()} · 수수료 {(p.platform_fee ?? 0).toLocaleString()} · VAT {(p.vat ?? 0).toLocaleString()}
                      </div>
                      {p.escrow_id && <AdminChangeOrderHistory contractId={p.escrow_id} adminId={user?.id ?? null} title="추가견적 이력 (정산 참고)" />}
                      {p.escrow_id && (
                        <button onClick={() => setDetailTarget({ contractId: p.escrow_id })}
                          style={{ width: "100%", padding: "9px", marginBottom: S.sm, background: C.navyL, color: C.navy, border: `1px solid ${C.trustM}`, borderRadius: R.lg, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                          📋 계약 통합 상세 보기
                        </button>
                      )}
                      <div style={{ display: "flex", gap: S.sm }}>
                        {p.status !== "HELD" && p.status !== "PAID_MANUALLY" && p.status !== "CANCELLED" && (
                          <button onClick={() => setConfirm({
                            emoji: "⏸", title: "지급 보류",
                            msg: `${p.companies?.name ?? "업체"} ${p.stage}단계 정산을 보류합니다.`,
                            needsReason: true,
                            onConfirm: async (reason) => {
                              const { error } = await adminSetPayoutStatus(p.id, user?.id ?? null, "HELD", reason);
                              if (!error) {
                                setSettlements(prev => prev.map(x => x.id === p.id ? { ...x, status: "HELD" } : x));
                                showToast("지급 보류 처리 완료");
                              } else { showToast("처리 실패", false); }
                            },
                          })}
                            style={{ flex: 1, padding: "9px", background: "#FBF5E8", color: C.gold,
                              border: `1px solid ${C.gold}44`, borderRadius: R.lg, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                            지급 보류
                          </button>
                        )}
                        {p.status !== "PAID_MANUALLY" && p.status !== "CANCELLED" && (
                          <button onClick={() => setConfirm({
                            emoji: "✅", title: "수동 지급 완료",
                            msg: `${p.companies?.name ?? "업체"} ${p.stage}단계를 수동 지급 완료로 기록합니다.\n실제 자동 송금은 발생하지 않습니다.`,
                            needsReason: false,
                            onConfirm: async () => {
                              const { error } = await adminSetPayoutStatus(p.id, user?.id ?? null, "PAID_MANUALLY");
                              if (!error) {
                                setSettlements(prev => prev.map(x => x.id === p.id ? { ...x, status: "PAID_MANUALLY" } : x));
                                showToast("수동 지급 완료 처리");
                              } else { showToast("처리 실패", false); }
                            },
                          })}
                            style={{ flex: 1, padding: "9px", background: "#EAF7EE", color: "#27AE60",
                              border: "1px solid #27AE6033", borderRadius: R.lg, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                            수동 지급 완료
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
                )}
              </div>
            )}

            {/* ── Lounge Management ── */}
            {mainTab === "lounge" && (
              <LoungeManagementTab
                loungePosts={loungePosts}
                loungeErr={loungeErr}
                showToast={showToast}
                adminUserId={user?.id}
                onReload={async () => {
                  try {
                    const [postsRes, reportsRes] = await Promise.all([adminGetLoungePosts(), getLoungeReports()]);
                    setLoungePosts(postsRes.data ?? []);
                    setLoungeReports(reportsRes.data ?? []);
                    setLoungeErr(postsRes.error?.message ?? null);
                  } catch (err) {
                    setLoungeErr(err?.message ?? String(err));
                  }
                }}
              />
            )}

            {/* ── Lounge Insights 탭 — 관리자 전용 콘텐츠 성과 대시보드(읽기 전용, 자체 페칭) ── */}
            {mainTab === "lounge_insights" && <LoungeInsightsDashboard />}

            {/* ── Lounge Seeding 탭 (A안) ── 상단: 신규 시딩 등록/수정(seed_lounge_posts) · 하단: 기존 운영글 관리(lounge_posts.is_seed) ── */}
            {mainTab === "lounge_seeding" && (
              <>
                <LoungeSeedingTab
                  seeds={seedLoungeRows}
                  loading={seedLoungeLoading}
                  fetchErr={seedLoungeErr}
                  onReload={async () => {
                    setSeedLoungeLoading(true);
                    setSeedLoungeErr(null);
                    try {
                      const { data, error } = await adminGetSeedLoungePosts();
                      if (error) throw new Error(error.message ?? "load failed");
                      setSeedLoungeRows(data ?? []);
                    } catch (err) {
                      setSeedLoungeErr(err?.message ?? String(err));
                      setSeedLoungeRows([]);
                    } finally {
                      setSeedLoungeLoading(false);
                    }
                  }}
                />
                <div style={{ height: 1, background: C.bgWarm, margin: `${S.xl}px 0` }} />
                <SeedPostsManagerTab
                  posts={seedingPosts}
                  loading={seedingLoading}
                  fetchErr={seedingErr}
                  adminUserId={user?.id ?? null}
                  showToast={showToast}
                  onReload={async () => {
                    setSeedingLoading(true);
                    setSeedingErr(null);
                    try {
                      const { data, error } = await fetchAdminSeedPosts(user?.id);
                      if (error) throw new Error(error.message ?? "load failed");
                      setSeedingPosts(data ?? []);
                    } catch (err) {
                      setSeedingErr(err?.message ?? String(err));
                      setSeedingPosts([]);
                    } finally {
                      setSeedingLoading(false);
                    }
                  }}
                />
              </>
            )}

            {/* ── AI 콘텐츠 공장(Phase 1) ── */}
            {mainTab === "lounge_ai_factory" && (
              <LoungeAiFactoryTab
                drafts={aiDrafts}
                published={aiPublished}
                loading={aiFactoryLoading}
                fetchErr={aiFactoryErr}
                adminUserId={user?.id ?? null}
                showToast={showToast}
                onReload={async () => {
                  setAiFactoryLoading(true);
                  setAiFactoryErr(null);
                  try {
                    const [draftsRes, publishedRes] = await Promise.all([
                      adminListLoungeDrafts(),
                      adminListPublishedAiContent(),
                    ]);
                    if (draftsRes.error) throw new Error(draftsRes.error.message ?? "load failed");
                    setAiDrafts(draftsRes.data ?? []);
                    setAiPublished(publishedRes.data ?? []);
                  } catch (err) {
                    setAiFactoryErr(err?.message ?? String(err));
                    setAiDrafts([]);
                    setAiPublished([]);
                  } finally {
                    setAiFactoryLoading(false);
                  }
                }}
              />
            )}

            {/* ── 자동발행 OS (Phase 17.5) ── */}
            {mainTab === "auto_publish" && (
              <AutoPublishTab
                drafts={aiDrafts}
                published={aiPublished}
                adminUserId={user?.id ?? null}
                showToast={showToast}
                onReload={async () => {
                  try {
                    const [draftsRes, publishedRes] = await Promise.all([adminListLoungeDrafts(), adminListPublishedAiContent()]);
                    setAiDrafts(draftsRes.data ?? []);
                    setAiPublished(publishedRes.data ?? []);
                  } catch { /* keep prior */ }
                }}
              />
            )}

            {/* ── 발행 우선순위 (Phase 22) ── */}
            {mainTab === "publishing_priority" && (
              <PublishingPriorityTab drafts={aiDrafts} published={aiPublished} />
            )}

            {/* ── AI 트렌드 발굴 (Phase 14) ── */}
            {mainTab === "trend_discovery" && (
              <TrendDiscoveryTab
                published={aiPublished}
                adminUserId={user?.id ?? null}
                showToast={showToast}
                onReload={async () => {
                  try {
                    const [draftsRes, publishedRes] = await Promise.all([adminListLoungeDrafts(), adminListPublishedAiContent()]);
                    setAiDrafts(draftsRes.data ?? []);
                    setAiPublished(publishedRes.data ?? []);
                  } catch { /* keep prior */ }
                }}
              />
            )}

            {/* ── AI 발행 파이프라인 (Phase 13) ── */}
            {mainTab === "publishing_pipeline" && (
              <PublishingPipelineTab
                drafts={aiDrafts}
                published={aiPublished}
                loading={aiFactoryLoading}
                adminUserId={user?.id ?? null}
                showToast={showToast}
                onReload={async () => {
                  setAiFactoryLoading(true);
                  try {
                    const [draftsRes, publishedRes] = await Promise.all([adminListLoungeDrafts(), adminListPublishedAiContent()]);
                    setAiDrafts(draftsRes.data ?? []);
                    setAiPublished(publishedRes.data ?? []);
                  } catch { /* keep prior */ } finally { setAiFactoryLoading(false); }
                }}
              />
            )}

            {/* ── Customer Reports ── */}
            {mainTab === "reports" && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: S.md }}>
                  신고 <span style={{ color: C.red }}>{reports.length}건</span>
                </div>
                {reportsLoading ? (
                  <div style={{ textAlign: "center", padding: "60px 0", fontSize: 14, color: C.text3 }}>불러오는 중…</div>
                ) : reportsErr ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
                    <div style={{ fontSize: 14, color: C.red, marginBottom: 4 }}>신고 목록을 불러오지 못했습니다</div>
                    <div style={{ fontSize: 12, color: C.text3 }}>{reportsErr}</div>
                  </div>
                ) : reports.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                    <div style={{ fontSize: 14, color: C.text3 }}>신고 내역 없음</div>
                  </div>
                ) : reports.map(r => {
                  // direct_deal_reports 기준 — 종결 상태(confirmed/dismissed/resolved)는 처리완료로 표시.
                  const st = String(r.status ?? "").toLowerCase();
                  const isResolved = ["resolved", "dismissed", "confirmed"].includes(st);
                  const title = r.report_type ?? r.trigger_type ?? "신고";
                  const when  = r.created_at ?? r.detected_at ?? null;
                  const desc  = r.description ?? r.reason ?? r.detail ?? "";
                  return (
                  <div key={r.id} style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.sm, border: `1px solid ${C.bgWarm}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.sm }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{title}</div>
                        <div style={{ fontSize: 11, color: C.text3 }}>{when ? new Date(when).toLocaleDateString("ko-KR") : ""}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isResolved ? C.green : C.gold,
                        background: isResolved ? C.greenL : "#FBF5E8",
                        borderRadius: R.full, padding: "3px 10px" }}>
                        {isResolved ? "처리완료" : "검토중"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: C.text2, marginBottom: S.sm }}>{desc}</div>
                    {!isResolved && (
                      <button
                        disabled={actionLoading}
                        onClick={() => {
                          setActionLoading(true);
                          updateDirectDealReportStatus(r.id, "dismissed").then(({ error }) => {
                            if (!error) setReports(prev => prev.map(x => x.id === r.id ? { ...x, status: "dismissed" } : x));
                            else showToast("처리 실패", false);
                            setActionLoading(false);
                          });
                        }}
                        style={{ padding: "7px 16px", borderRadius: R.lg, background: C.brand, color: "#fff",
                          border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        처리 완료
                      </button>
                    )}
                  </div>
                  );
                })}
              </div>
            )}

            {mainTab === "direct_deal" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: S.md }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>
                    직거래 의심 <span style={{ color: C.brand }}>{directDealReports.length}건</span>
                  </div>
                  <button
                    disabled={ddrRunning}
                    onClick={runFollowUp}
                    style={{ padding: "7px 14px", borderRadius: R.lg, background: ddrRunning ? C.bgWarm : C.brand,
                      color: ddrRunning ? C.text3 : "#fff", border: "none", fontSize: 12, fontWeight: 700,
                      cursor: ddrRunning ? "default" : "pointer" }}>
                    {ddrRunning ? "실행중…" : "실측 미계약 추적 실행"}
                  </button>
                </div>

                <div style={{ display: "flex", gap: 6, marginBottom: S.md, overflowX: "auto" }}>
                  {[["all", "전체"], ["keyword_detected", "키워드"], ["no_estimate_72h", "미제출72h"],
                    ["no_contract_7d", "미계약7d"], ["manual_report", "수동"]].map(([v, l]) => (
                    <button key={v} onClick={() => setDdrFilter(v)}
                      style={{ padding: "5px 12px", borderRadius: R.full, fontSize: 12, fontWeight: 700,
                        whiteSpace: "nowrap", cursor: "pointer", border: "none",
                        background: ddrFilter === v ? C.brand : C.bgWarm,
                        color: ddrFilter === v ? "#fff" : C.text2 }}>{l}</button>
                  ))}
                </div>

                {ddrLoading ? (
                  <div style={{ textAlign: "center", padding: "60px 0", fontSize: 14, color: C.text3 }}>불러오는 중…</div>
                ) : filteredDdr.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🕵️</div>
                    <div style={{ fontSize: 14, color: C.text3 }}>직거래 의심 기록 없음</div>
                  </div>
                ) : filteredDdr.map((r) => {
                  const tm = DDR_TRIGGER_META[r.trigger_type] ?? { label: r.trigger_type, color: C.text2 };
                  const sm = DDR_STATUS_META[r.status] ?? { label: r.status, color: C.text2, bg: C.bgWarm };
                  const kws = r.trigger_detail?.keywords;
                  return (
                    <div key={r.id} style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.sm, border: `1px solid ${C.bgWarm}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.sm }}>
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 800, color: tm.color }}>{tm.label}</span>
                          <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
                            {r.detected_at ? new Date(r.detected_at).toLocaleString("ko-KR") : ""}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: sm.color, background: sm.bg,
                          borderRadius: R.full, padding: "3px 10px" }}>{sm.label}</span>
                      </div>

                      {Array.isArray(kws) && kws.length > 0 && (
                        <div style={{ fontSize: 12, color: C.brand, fontWeight: 700, marginBottom: 4 }}>
                          감지 키워드: {kws.join(", ")}
                        </div>
                      )}
                      {r.trigger_detail?.message && (
                        <div style={{ fontSize: 12, color: C.text2, marginBottom: S.sm, wordBreak: "break-all",
                          background: C.bg, borderRadius: R.md, padding: "8px 10px" }}>
                          “{r.trigger_detail.message}”
                        </div>
                      )}
                      {/* 포트폴리오 이미지 신고(LOUNGE-CONVERSION-v3.1) — 신고 사유 + 대상 이미지 */}
                      {r.trigger_detail?.kind === "portfolio_image" && (
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: S.sm,
                          background: "#FFF6F6", border: "1px solid #F5C6C6", borderRadius: R.md, padding: "8px 10px" }}>
                          {r.trigger_detail.image_url && (
                            <img src={r.trigger_detail.image_url} alt="" style={{ width: 56, height: 56, borderRadius: R.sm, objectFit: "cover", flexShrink: 0 }} />
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 11.5, fontWeight: 800, color: C.red, marginBottom: 2 }}>🚩 포트폴리오 이미지 신고</div>
                            <div style={{ fontSize: 12, color: C.text2 }}>{r.trigger_detail.reason || "사유 미기재"}</div>
                            {r.trigger_detail.portfolio_id && (
                              <div style={{ fontSize: 10.5, color: C.text4, marginTop: 2 }}>portfolio: {String(r.trigger_detail.portfolio_id).slice(0, 8)}…</div>
                            )}
                          </div>
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: C.text4, marginBottom: S.sm }}>
                        {r.request_id ? `request: ${String(r.request_id).slice(0, 8)}… ` : ""}
                        {r.company_id ? `company: ${String(r.company_id).slice(0, 8)}…` : ""}
                      </div>

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {[["investigating", "조사중"], ["confirmed", "확정"], ["dismissed", "기각"]].map(([v, l]) => (
                          <button key={v} disabled={r.status === v} onClick={() => setDdrStatus(r.id, v)}
                            style={{ padding: "6px 14px", borderRadius: R.lg, fontSize: 12, fontWeight: 700,
                              border: `1px solid ${r.status === v ? C.brand : C.bgWarm}`,
                              background: r.status === v ? C.brand : "#fff",
                              color: r.status === v ? "#fff" : C.text2,
                              cursor: r.status === v ? "default" : "pointer" }}>{l}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Notifications ── */}
            {mainTab === "reviews" && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: 4 }}>
                  포토리뷰 쿠폰 관리
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.brand, marginLeft: 8 }}>
                    {reviewRewards.filter(r => r.status === "PENDING").length}건 대기
                  </span>
                </div>
                <div style={{ fontSize: 12, color: C.text3, marginBottom: S.lg }}>
                  포토리뷰 확인 후 커피쿠폰을 발송 처리하세요
                </div>

                {reviewRewards.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>☕</div>
                    <div style={{ fontSize: 14, color: C.text3 }}>대기 중인 포토리뷰가 없습니다</div>
                  </div>
                ) : reviewRewards.map(rw => {
                  const rv = rw.reviews ?? {};
                  const imgs = rv.image_urls ?? [];
                  const isPending  = rw.status === "PENDING";
                  const isSent     = rw.status === "SENT";
                  const isCanceled = rw.status === "CANCELED";
                  return (
                    <div key={rw.id} style={{ background: C.surface, borderRadius: R.xl,
                      marginBottom: S.md, border: `1.5px solid ${isPending ? "#F5D97A" : C.bgWarm}`,
                      overflow: "hidden" }}>
                      <div style={{ height: 3, background: isPending ? "#F5C842" : isSent ? C.brand : C.text4 }} />
                      <div style={{ padding: S.xl }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.sm }}>
                          <div>
                            <span style={{ background: isPending ? "#FFF8EC" : isSent ? C.brandL : C.surface2,
                              color: isPending ? "#8A5C00" : isSent ? C.brand : C.text4,
                              border: `1px solid ${isPending ? "#F5D97A" : isSent ? C.brandM : C.bgWarm}`,
                              borderRadius: R.full, padding: "3px 10px", fontSize: 11, fontWeight: 800 }}>
                              {isPending ? "☕ 쿠폰 대기" : isSent ? "✅ 발송 완료" : "취소됨"}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: C.text4 }}>
                            {rw.created_at?.slice(0, 10)}
                          </div>
                        </div>

                        {rv.content && (
                          <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6, marginBottom: S.sm }}>
                            {"★".repeat(rv.rating ?? 0)} — {rv.content?.slice(0, 80)}{(rv.content?.length ?? 0) > 80 ? "…" : ""}
                          </div>
                        )}

                        {imgs.length > 0 && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: S.md }}>
                            {imgs.slice(0, 5).map((url, i) => (
                              <img key={i} src={url} alt=""
                                style={{ width: 72, height: 72, objectFit: "cover",
                                  borderRadius: R.md, border: `1px solid ${C.bgWarm}` }}
                                onError={e => { e.target.style.display = "none"; }} />
                            ))}
                            {imgs.length > 5 && (
                              <div style={{ width: 72, height: 72, borderRadius: R.md,
                                background: C.surface2, border: `1px solid ${C.bgWarm}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 12, color: C.text3, fontWeight: 700 }}>
                                +{imgs.length - 5}
                              </div>
                            )}
                          </div>
                        )}

                        {isPending && (
                          <div style={{ display: "flex", gap: S.sm }}>
                            <button
                              onClick={async () => {
                                const { data } = await updateReviewReward(rw.id, "SENT");
                                if (data) setReviewRewards(prev => prev.map(r => r.id === rw.id ? { ...r, status: "SENT", sent_at: data.sent_at } : r));
                                showToast("쿠폰 발송 처리 완료");
                              }}
                              style={{ flex: 2, padding: "10px", background: C.brand, color: "#fff",
                                border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                              ☕ SENT 처리
                            </button>
                            <button
                              onClick={async () => {
                                await updateReviewReward(rw.id, "CANCELED");
                                setReviewRewards(prev => prev.map(r => r.id === rw.id ? { ...r, status: "CANCELED" } : r));
                                showToast("취소 처리됨", false);
                              }}
                              style={{ flex: 1, padding: "10px", background: C.surface2, color: C.text3,
                                border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                              취소
                            </button>
                          </div>
                        )}
                        {isSent && (
                          <div style={{ fontSize: 12, color: C.brand, fontWeight: 700 }}>
                            발송 완료: {rw.sent_at?.slice(0, 16).replace("T", " ") ?? "—"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {mainTab === "review_admin" && <ReviewAdminTab adminUserId={user?.id} showToast={showToast} />}

            {mainTab === "seed" && <SeedReviewTab />}

            {mainTab === "operator_setting" && (
              <OperatorSettingTab adminUserId={user?.id ?? null} showToast={showToast} />
            )}

            {mainTab === "project_flow" && (
              <div>
                {/* 역할 분리 — 프로젝트 증빙관리(프로젝트 콘솔) / GPS 시스템 모니터링(운영 대시보드) */}
                <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                  {[["evidence", "프로젝트 증빙관리"], ["gps", "GPS 시스템 모니터링"], ["trust", "GPS 신뢰도"], ["timeline", "증빙 타임라인"]].map(([v, l]) => (
                    <button key={v} onClick={() => setFlowView(v)}
                      style={{ padding: "7px 14px", borderRadius: R.full, fontSize: 12.5, fontWeight: 700,
                        border: `1px solid ${flowView === v ? C.brand : C.bgWarm}`, cursor: "pointer",
                        background: flowView === v ? C.brand : C.surface, color: flowView === v ? "#fff" : C.text2 }}>
                      {l}
                    </button>
                  ))}
                </div>
                {flowView === "evidence" ? (
                  <ProjectEvidenceManagement adminUserId={user?.id ?? null} showToast={showToast} />
                ) : flowView === "trust" ? (
                  <GpsTrustDashboard adminUserId={user?.id ?? null} showToast={showToast} />
                ) : flowView === "timeline" ? (
                  <EvidenceTimelineDashboard adminUserId={user?.id ?? null} showToast={showToast} />
                ) : (
                  <GpsOpsDashboard adminUserId={user?.id ?? null} />
                )}
              </div>
            )}

            {mainTab === "transactions" && (
              <TransactionManagement adminUserId={user?.id ?? null} showToast={showToast} />
            )}

            {mainTab === "finance" && (
              <FinanceDashboard adminUserId={user?.id ?? null} showToast={showToast} />
            )}

            {mainTab === "tools" && (
              <AdminCleanupTool adminUserId={user?.id ?? null} showToast={showToast} />
            )}

            {mainTab === "chat_overview" && <AdminChatOverview adminId={user?.id} />}

            {mainTab === "admin_logs" && <AdminLogView />}

            {mainTab === "notifications" && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.md }}>
                  알림 <span style={{ color: C.brand }}>{notifications.length}건</span>
                </div>

                {/* ADMIN ONLY 테스트 발송 — 본인에게 알림 1건 생성(notifications 저장 + /api/push/enqueue 큐 등록).
                    실발송 검증은 env 설정 후 별도 진행 → 여기선 큐 등록/생성 확인까지만. dispatch/enqueue 구조 무변경. */}
                {(user?.role === "admin" || import.meta.env.DEV) && (
                  <div style={{ background: C.surface, border: `1px dashed ${C.brandM}`, borderRadius: R.lg, padding: S.lg, marginBottom: S.md }}>
                    <div style={{ fontSize: 12, color: C.text3, marginBottom: 8, fontWeight: 700 }}>🧪 푸시 검증용 (관리자 전용)</div>
                    <button
                      onClick={async () => {
                        if (!user?.id) return;
                        try {
                          await createNotification({
                            userId:      user.id,
                            type:        "ADMIN_TEST_PUSH",
                            title:       "테스트 알림",
                            message:     `관리자 테스트 발송 · ${new Date().toLocaleString("ko-KR")}`,
                            relatedType: "admin",
                          });
                          const { data } = await getUserNotifications(user.id, { limit: 50 });
                          if (data) setNotifications(data);
                          showToast("테스트 알림 생성됨 — notifications 저장 + enqueue 큐 등록");
                        } catch {
                          showToast("테스트 알림 생성 실패", false);
                        }
                      }}
                      style={{ background: C.brand, color: "#fff", border: "none", borderRadius: R.md,
                        padding: "10px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                      테스트 알림 발송
                    </button>
                  </div>
                )}

                {notifications.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🔔</div>
                    <div style={{ fontSize: 14, color: C.text3 }}>새 알림이 없습니다</div>
                  </div>
                ) : notifications.map(n => (
                  <div key={n.id}
                    style={{ background: n.is_read ? C.surface : C.brandL, borderRadius: R.xl,
                      padding: S.xl, marginBottom: S.sm,
                      border: `1px solid ${n.is_read ? C.bgWarm : C.brandM}`, cursor: "pointer" }}
                    onClick={() => {
                      if (n.related_type === "company") setMainTab("companies");
                      if (n.related_type === "dispute") setMainTab("disputes");
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.xs }}>
                      <div style={{ fontSize: 14, fontWeight: n.is_read ? 600 : 800, color: C.text1 }}>{n.title}</div>
                      {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.brand, flexShrink: 0, marginTop: 4 }} />}
                    </div>
                    <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.6 }}>{n.message}</div>
                    <div style={{ fontSize: 11, color: C.text4, marginTop: S.xs }}>
                      {new Date(n.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                ))}

                {companies.filter(c => c.status === "pending").length > 0 && (
                  <div style={{ marginTop: S.xl }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text2, marginBottom: S.md }}>📋 최근 심사 대기</div>
                    {companies.filter(c => c.status === "pending").map(c => (
                      <div key={c.id}
                        onClick={() => { setMainTab("companies"); openDetail(c); }}
                        style={{ background: C.surface, borderRadius: R.xl, padding: `${S.md}px ${S.xl}px`,
                          marginBottom: S.sm, border: `1px solid ${C.bgWarm}`,
                          display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: C.text3 }}>신규 업체 가입 · {c.submittedAt}</div>
                        </div>
                        <span style={{ background: "#FBF5E8", color: C.gold, borderRadius: R.full, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>심사대기</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {selected && mainTab === "companies" && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)",
            display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200 }}
          onClick={e => { if (e.target === e.currentTarget) { setSelected(null); setRejectMode(false); setHoldMode(false); setDocModal(null); } }}>
          <div style={{ background: C.surface, borderRadius: "24px 24px 0 0", width: "100%",
            maxWidth: 480, padding: "24px 24px 40px", maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: "0 auto 20px" }} />

            {(() => {
              const bm = BADGES[selected.badge] || BADGES.basic;
              return (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.xl }}>
                  <div>
                    <div style={{ fontSize: 19, fontWeight: 900, color: C.text1, marginBottom: 6 }}>{selected.name}</div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                      <span style={{ background: bm.bg, color: bm.color, borderRadius: R.full,
                        padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{bm.icon} {bm.label}</span>
                      <span style={{ background: C.surface2, color: C.text3, borderRadius: R.full,
                        padding: "3px 10px", fontSize: 12 }}>온도 {selected.temp}°</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.text4 }}>📞 {selected.phone}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: C.navy }}>{requiredDeposit(selected.badge, selected.hasInsurance).toLocaleString()}만원</div>
                    <div style={{ fontSize: 11, color: C.text4 }}>필요 공간뱃지예치보증금 ({depositRatePct(selected.hasInsurance)}%)</div>
                    <div style={{ fontSize: 11, color: bm.color, fontWeight: 700, marginTop: 2 }}>수주 한도 {bm.maxJob}</div>
                    <button onClick={() => setDocModal("badge")}
                      style={{ fontSize: 11, color: C.brand, background: "none", border: "none", cursor: "pointer", fontWeight: 700, marginTop: 4, textDecoration: "underline" }}>
                      배지 상세 ›
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* ── 공간보증(068) 관리 — company_status 게이트와 독립 ── */}
            {(() => {
              const gs = selected.guarantee_status ?? "NONE";
              const gm = GUARANTEE_STATUS_META[gs] ?? GUARANTEE_STATUS_META.NONE;
              const gg = selected.guarantee_grade ? GUARANTEE_GRADE_MAP[selected.guarantee_grade] : null;
              const gAmt = selected.guarantee_amount;
              const NEXT = { PENDING_DEPOSIT: "DEPOSIT_CONFIRMED", DEPOSIT_CONFIRMED: "AWAITING_APPROVAL", AWAITING_APPROVAL: "ACTIVE" };
              const nextStatus = NEXT[gs];
              const nextLabel = { DEPOSIT_CONFIRMED: "입금 확인", AWAITING_APPROVAL: "승인 대기로", ACTIVE: "승인(활성화)" }[nextStatus];
              return (
                <div style={{ background: C.surface2, borderRadius: R.lg, padding: S.lg, marginBottom: S.xl, border: `1px solid ${C.bgWarm}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.sm }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>🛡 공간보증</div>
                    <span style={{ background: gm.bg, color: gm.color, borderRadius: R.full, padding: "3px 10px", fontSize: 12, fontWeight: 800 }}>{gm.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.text2, marginBottom: S.md }}>
                    {gg ? `${gg.emoji} ${gg.label}` : "등급 미선택"} · 예치금 {gAmt != null ? wonFromManwon(gAmt) : "—"}
                    {selected.guarantee_badge_visible ? " · 배지 노출 ON" : " · 배지 OFF"}
                  </div>
                  {gs === "NONE" ? (
                    <div style={{ fontSize: 12, color: C.text3 }}>업체가 등급을 선택하면 입금 확인부터 진행할 수 있어요.</div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {nextStatus && (
                        <button disabled={actionLoading} onClick={() => handleGuarantee(selected, { status: nextStatus })}
                          style={{ background: C.brand, color: "#fff", border: "none", borderRadius: R.md, padding: "9px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                          {nextLabel} →
                        </button>
                      )}
                      <button disabled={actionLoading} onClick={() => handleGuarantee(selected, { badgeVisible: !selected.guarantee_badge_visible })}
                        style={{ background: C.surface, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.md, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        {selected.guarantee_badge_visible ? "배지 숨김" : "배지 노출"}
                      </button>
                      <button disabled={actionLoading} onClick={() => handleGuarantee(selected, { status: "NONE" })}
                        style={{ background: C.surface, color: C.red ?? "#D63030", border: `1px solid ${C.bgWarm}`, borderRadius: R.md, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        출금/해제(NONE)
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ background: C.surface2, borderRadius: R.lg, padding: S.lg,
              marginBottom: S.xl, border: `1px solid ${C.bgWarm}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.md }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>📄 제출 서류</div>
                <button onClick={() => setShowDocReview(true)}
                  style={{ fontSize: 12, color: C.brand, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>
                  서류 검토 ›
                </button>
              </div>
              {selected.docs.map((doc, i) => {
                // 제출 판정 — 기존 companies.*_url(doc.submitted) 에 더해, 서류센터 업로드가
                // 저장되는 company_documents(review_status: submitted/reviewing/approved)도 OR 로 본다.
                // (업체 서류센터 제출이 companies.*_url 을 갱신하지 않아 미제출로 보이던 문제 해소)
                const DOC_TYPE_BY_INDEX = ["business_license", "insurance_certificate", "bankbook_copy", null];
                const SUBMITTED_STATES = ["submitted", "reviewing", "approved"];
                const dt = DOC_TYPE_BY_INDEX[i];
                const fromDocs = dt
                  ? companyDocuments.some(d => d.document_type === dt && SUBMITTED_STATES.includes(d.review_status))
                  : false;
                const submitted = doc.submitted || fromDocs;
                // 이미지 상세(biz/insurance) 모달은 companies.*_url 을 읽으므로, URL 이 있는
                // 경우(doc.submitted)에만 클릭 가능. company_documents 로만 제출된 파일은
                // "서류 검토 ›"(AdminDocumentReviewModal) 에서 확인한다.
                const canOpenImage = doc.submitted && i < 2;
                return (
                <div key={i}
                  onClick={() => {
                    if (!canOpenImage) return;
                    if (i === 0) setDocModal("biz");
                    if (i === 1) setDocModal("insurance");
                  }}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: `${S.sm}px 0`,
                    borderBottom: i < selected.docs.length - 1 ? `1px solid ${C.bgWarm}` : "none",
                    cursor: canOpenImage ? "pointer" : "default" }}>
                  <span style={{ fontSize: 13, color: C.text2 }}>
                    {doc.label} {canOpenImage ? "›" : ""}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: submitted ? C.green : C.red }}>
                    {submitted ? "✓ 제출" : "✗ 미제출"}
                  </span>
                </div>
                );
              })}
              {companyDocuments.length > 0 && (
                <div style={{ marginTop: S.sm, paddingTop: S.sm, borderTop: `1px solid ${C.bgWarm}` }}>
                  <div style={{ fontSize: 11, color: C.text3, marginBottom: S.xs }}>서류 관리 시스템</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: S.xs }}>
                    {companyDocuments.map(d => {
                      const sm = { draft:"#B0BAB4", submitted:C.brand, reviewing:C.gold, approved:C.green, held:C.gold, rejected:C.red }[d.review_status ?? "draft"];
                      return (
                        <span key={d.id} style={{ fontSize: 10, color: sm, background: C.bg, borderRadius: R.sm, padding: "2px 6px", border: `1px solid ${sm}44` }}>
                          {{ business_license:"사업자", insurance_certificate:"보험", operation_pledge:"서약서", escrow_agreement:"에스크로" }[d.document_type] ?? d.document_type}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── Company Info Edit ── */}
            <div style={{ marginBottom: S.xl }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.sm }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text2 }}>업체 정보 수정</div>
                <button onClick={() => { setShowInfoEdit(v => !v); setInfoEditForm({ name: selected.name, phone: selected.phone, region: selected.region }); }}
                  style={{ fontSize: 11, color: C.brand, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>
                  {showInfoEdit ? "닫기" : "수정 ▾"}
                </button>
              </div>
              {showInfoEdit && (
                <div style={{ background: C.surface2, borderRadius: R.lg, padding: S.lg, border: `1px solid ${C.bgWarm}` }}>
                  {[["name","업체명"],["phone","전화번호"],["region","지역"]].map(([key,label]) => (
                    <div key={key} style={{ marginBottom: S.sm }}>
                      <div style={{ fontSize: 11, color: C.text3, marginBottom: 3 }}>{label}</div>
                      <input value={infoEditForm[key] ?? ""} onChange={e => setInfoEditForm(p => ({ ...p, [key]: e.target.value }))}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: R.md, border: `1px solid ${C.bgWarm}`,
                          fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fff" }} />
                    </div>
                  ))}
                  <button disabled={infoEditSaving} onClick={async () => {
                    setInfoEditSaving(true);
                    const { error } = await adminUpdateCompanyInfo(selected.id, infoEditForm, user?.id ?? null);
                    if (error) { showToast(error.message ?? "수정 실패", false); }
                    else {
                      showToast("업체 정보 수정 완료");
                      setCompanies(prev => prev.map(c => c.id === selected.id ? { ...c, ...infoEditForm } : c));
                      setSelected(prev => ({ ...prev, ...infoEditForm }));
                      setShowInfoEdit(false);
                    }
                    setInfoEditSaving(false);
                  }} style={{ width: "100%", padding: "10px", background: infoEditSaving ? C.bgWarm : C.brand, color: infoEditSaving ? C.text3 : "#fff",
                    border: "none", borderRadius: R.lg, fontWeight: 700, fontSize: 13, cursor: infoEditSaving ? "not-allowed" : "pointer" }}>
                    {infoEditSaving ? "저장중…" : "저장"}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between",
              padding: `${S.sm}px 0`, marginBottom: S.xl,
              borderTop: `1px solid ${C.bgWarm}`, borderBottom: `1px solid ${C.bgWarm}` }}>
              <span style={{ fontSize: 12, color: C.text3 }}>신청일</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text1 }}>{selected.submittedAt}</span>
            </div>

            {(() => {
              const csMeta = COMPANY_STATUS_META[selected.companyStatus] ?? COMPANY_STATUS_META.PENDING;
              return (
                <div style={{ marginBottom: S.xl }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: S.sm }}>운영 상태</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: csMeta.bg, borderRadius: R.lg, padding: `${S.sm}px ${S.lg}px`,
                    border: `1px solid ${csMeta.color}44`, marginBottom: S.sm }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: csMeta.color }}>{csMeta.label}</span>
                    <button onClick={() => setShowStatusModal(v => !v)}
                      style={{ fontSize: 11, fontWeight: 700, color: C.brand, background: "none", border: "none", cursor: "pointer" }}>
                      상태 변경 ▾
                    </button>
                  </div>
                  {showStatusModal && (
                    <div style={{ background: C.surface2, borderRadius: R.lg, padding: S.lg, border: `1px solid ${C.bgWarm}` }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: S.sm, marginBottom: S.sm }}>
                        {["ACTIVE","PAUSED","TEMP_RESTRICTED","SUSPENDED","BLACKLISTED"].map(st => {
                          const m = COMPANY_STATUS_META[st];
                          return (
                            <button key={st}
                              onClick={() => handleCompanyStatus(selected, st)}
                              disabled={actionLoading || selected.companyStatus === st}
                              style={{ padding: "10px", borderRadius: R.md, border: `1.5px solid ${m.color}44`,
                                background: selected.companyStatus === st ? m.bg : C.surface,
                                color: m.color, fontWeight: 700, fontSize: 12, cursor: "pointer",
                                opacity: selected.companyStatus === st ? 0.6 : 1 }}>
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                      <input value={statusReason} onChange={e => setStatusReason(e.target.value)}
                        placeholder="변경 사유 (선택)"
                        style={{ width: "100%", padding: "10px 12px", borderRadius: R.md,
                          border: `1px solid ${C.bgWarm}`, fontSize: 12, outline: "none",
                          boxSizing: "border-box", fontFamily: "inherit", background: C.surface }} />
                    </div>
                  )}
                </div>
              );
            })()}

            {selected.status === "pending" && (
              !rejectMode ? (
                !holdMode ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: S.sm }}>
                    <button onClick={() => setRejectMode(true)} disabled={actionLoading}
                      style={{ padding: "13px", background: "#FFF0F0", color: C.red,
                        border: `1px solid ${C.red}33`, borderRadius: R.lg,
                        fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      ✗ 반려
                    </button>
                    <button onClick={() => setHoldMode(true)} disabled={actionLoading}
                      style={{ padding: "13px", background: "#FBF5E8", color: C.gold,
                        border: `1px solid ${C.gold}44`, borderRadius: R.lg,
                        fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      ⏸ 보류
                    </button>
                    <button onClick={() => setConfirm({ type: "approve", company: selected })} disabled={actionLoading}
                      style={{ padding: "13px", background: C.green, color: "#fff",
                        border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 14,
                        cursor: "pointer", boxShadow: `0 4px 14px ${C.green}44` }}>
                      ✓ 승인하기
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, marginBottom: S.sm }}>보류 사유 입력</div>
                    <textarea
                      value={holdNote}
                      onChange={e => setHoldNote(e.target.value)}
                      placeholder="보류 사유를 입력하세요 (서류 보완 요청 등)"
                      style={{ width: "100%", padding: S.lg, borderRadius: R.lg, border: `1px solid ${C.bgWarm}`,
                        background: C.surface2, fontSize: 13, color: C.text1, resize: "none", height: 80,
                        boxSizing: "border-box", marginBottom: S.md, outline: "none", fontFamily: "inherit", lineHeight: 1.6 }}
                    />
                    <div style={{ display: "flex", gap: S.sm }}>
                      <button onClick={() => { setHoldMode(false); setHoldNote(""); }}
                        style={{ flex: 1, padding: "13px", background: C.bg, color: C.text2,
                          border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                        취소
                      </button>
                      <button
                        onClick={async () => {
                          if (!holdNote.trim()) return;
                          setActionLoading(true);
                          const { error } = await adminReviewCompany(selected.id, user?.id ?? null, "pending", holdNote);
                          if (!error) {
                            if (selected.ownerId) {
                              await createNotification({
                                userId:      selected.ownerId,
                                type:        "ADMIN_ACTION",
                                title:       "서류 검토 보류",
                                message:     `${selected.name} 업체 서류가 보류되었습니다. 사유: ${holdNote}`,
                                relatedId:   selected.id,
                                relatedType: "company",
                              });
                            }
                          }
                          setActionLoading(false);
                          setHoldMode(false);
                          setHoldNote("");
                        }}
                        disabled={actionLoading}
                        style={{ flex: 2, padding: "13px",
                          background: holdNote.trim() ? C.gold : C.bgWarm,
                          color: holdNote.trim() ? "#fff" : C.text4,
                          border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 14,
                          cursor: holdNote.trim() ? "pointer" : "not-allowed" }}>
                        보류 처리하기
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, marginBottom: S.sm }}>반려 사유 입력</div>
                  <textarea
                    value={rejectNote}
                    onChange={e => setRejectNote(e.target.value)}
                    placeholder="반려 사유를 입력하세요 (업체에게 전달됩니다)"
                    style={{ width: "100%", padding: S.lg, borderRadius: R.lg, border: `1px solid ${C.bgWarm}`,
                      background: C.surface2, fontSize: 13, color: C.text1, resize: "none", height: 90,
                      boxSizing: "border-box", marginBottom: S.md, outline: "none", fontFamily: "inherit",
                      lineHeight: 1.6 }}
                  />
                  <div style={{ display: "flex", gap: S.sm }}>
                    <button onClick={() => { setRejectMode(false); setRejectNote(""); }}
                      style={{ flex: 1, padding: "13px", background: C.bg, color: C.text2,
                        border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                      취소
                    </button>
                    <button
                      onClick={() => rejectNote.trim() && setConfirm({ type: "reject", company: selected, note: rejectNote })}
                      disabled={actionLoading}
                      style={{ flex: 2, padding: "13px",
                        background: rejectNote.trim() ? C.red : C.bgWarm,
                        color: rejectNote.trim() ? "#fff" : C.text4,
                        border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 14,
                        cursor: rejectNote.trim() ? "pointer" : "not-allowed" }}>
                      반려 처리하기
                    </button>
                  </div>
                </div>
              )
            )}

            {selected.status !== "pending" && (
              <div style={{ background: selected.status === "approved" ? C.greenL : "#FFF0F0",
                borderRadius: R.lg, padding: S.lg, display: "flex", alignItems: "flex-start", gap: S.sm,
                border: `1px solid ${selected.status === "approved" ? C.green + "33" : C.red + "33"}` }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>
                  {selected.status === "approved" ? "✅" : "❌"}
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700,
                    color: selected.status === "approved" ? C.green : C.red }}>
                    {selected.status === "approved" ? "승인 완료" : "반려됨"}
                  </div>
                  {selected.rejectNote && (
                    <div style={{ fontSize: 12, color: C.text3, marginTop: 4, lineHeight: 1.6 }}>
                      {selected.rejectNote}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showDocReview && selected && (
        <AdminDocumentReviewModal
          docs={companyDocuments}
          company={selected}
          adminUser={user}
          onClose={() => setShowDocReview(false)}
          onUpdate={(updated) => {
            setCompanyDocuments(prev => prev.map(d => d.id === updated.id ? updated : d));
          }}
        />
      )}

      {docModal === "biz" && selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }}
          onClick={() => setDocModal(null)}>
          <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xxl, width: "100%", maxWidth: 360 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.lg }}>📄 사업자등록증</div>
            {[
              ["상호명",   selected.name],
              ["전화번호", selected.phone || "—"],
              ["서류 상태", selected.docs[0]?.submitted ? "✓ 제출 완료" : "✗ 미제출"],
              ["검토 상태", selected.status === "approved" ? "승인" : selected.status === "rejected" ? "반려" : "검토 대기"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between",
                padding: `${S.sm}px 0`, borderBottom: `1px solid ${C.bgWarm}` }}>
                <span style={{ fontSize: 13, color: C.text3 }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: S.xl, background: C.brandL, borderRadius: R.lg, padding: S.md, fontSize: 12, color: C.brand }}>
              실제 서류 내용은 업로드된 원본 파일을 확인하세요
            </div>
            <button onClick={() => setDocModal(null)}
              style={{ width: "100%", marginTop: S.lg, padding: S.lg, background: C.bg,
                color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              닫기
            </button>
          </div>
        </div>
      )}

      {docModal === "insurance" && selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }}
          onClick={() => setDocModal(null)}>
          <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xxl, width: "100%", maxWidth: 360 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.lg }}>🛡 시공보험증서</div>
            {[
              ["업체명",   selected.name],
              ["보험 가입", selected.docs[1]?.submitted ? "✓ 가입 완료" : "✗ 미가입"],
              ["공간뱃지예치보증금 비율", selected.docs[1]?.submitted ? "10% (시공보험 가입)" : "20% (시공보험 미가입)"],
              ["검토 상태", selected.status === "approved" ? "승인" : selected.status === "rejected" ? "반려" : "검토 대기"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between",
                padding: `${S.sm}px 0`, borderBottom: `1px solid ${C.bgWarm}` }}>
                <span style={{ fontSize: 13, color: C.text3 }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{v}</span>
              </div>
            ))}
            <div style={{ marginTop: S.xl, background: C.brandL, borderRadius: R.lg, padding: S.md, fontSize: 12, color: C.brand }}>
              보험증권 원본은 업로드된 파일에서 확인하세요
            </div>
            <button onClick={() => setDocModal(null)}
              style={{ width: "100%", marginTop: S.lg, padding: S.lg, background: C.bg,
                color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              닫기
            </button>
          </div>
        </div>
      )}

      {docModal === "badge" && selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }}
          onClick={() => setDocModal(null)}>
          <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xxl, width: "100%", maxWidth: 360 }}
            onClick={e => e.stopPropagation()}>
            {(() => {
              const bm2 = selected.badge ? (BADGES[selected.badge] || BADGES.basic) : null;
              const ins = selected.hasInsurance;
              return (
                <>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.lg }}>🛡️ 공간보증 배지</div>
                  {[
                    ["현재 등급",        bm2 ? `${bm2.icon} ${bm2.label}` : "없음"],
                    ["수주 한도",        bm2 ? bm2.maxJob : "—"],
                    ["시공보험 가입",    ins ? "✓ 가입" : "✗ 미가입"],
                    ["보증예치 비율",    `${depositRatePct(ins)}%`],
                    ["필요 공간뱃지예치보증금",  bm2 ? `${requiredDeposit(selected.badge, ins).toLocaleString()}만원` : "—"],
                    ["승인 상태",        selected.status === "approved" ? "✓ 승인" : selected.status === "rejected" ? "✗ 반려" : "검토 중"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between",
                      padding: `${S.sm}px 0`, borderBottom: `1px solid ${C.bgWarm}` }}>
                      <span style={{ fontSize: 13, color: C.text3 }}>{k}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{v}</span>
                    </div>
                  ))}

                  {/* 등급 변경 — RPC(053) 경유. 클릭 즉시 적용 + admin_logs·notifications */}
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginTop: S.lg, marginBottom: S.sm }}>등급 변경</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {[["none", "없음", ""], ...BADGE_ORDER.map(k => [k, BADGES[k].label, BADGES[k].icon])].map(([key, label, icon]) => {
                      const active = (selected.badge ?? "none") === key;
                      return (
                        <button key={key} disabled={actionLoading}
                          onClick={() => handleSetBadge(selected, key)}
                          style={{ padding: "7px 11px", borderRadius: R.full, fontSize: 12, fontWeight: 700,
                            border: `1.5px solid ${active ? C.brand : C.bgWarm}`,
                            background: active ? C.brandL : C.surface, color: active ? C.brand : C.text2,
                            cursor: actionLoading ? "wait" : "pointer" }}>
                          {icon} {label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: C.text4, marginTop: S.sm, lineHeight: 1.6 }}>
                    ※ 표시·관리값만 변경됩니다. 실제 입·출금/정산은 처리되지 않습니다.
                  </div>
                </>
              );
            })()}
            <button onClick={() => setDocModal(null)}
              style={{ width: "100%", marginTop: S.lg, padding: S.lg, background: C.bg,
                color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              닫기
            </button>
          </div>
        </div>
      )}

      {confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 300, padding: `0 ${S.xl}px` }}>
          <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xxl, width: "100%", maxWidth: 340 }}>
            <div style={{ textAlign: "center", marginBottom: S.xl }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>
                {confirm.emoji ?? (confirm.type === "approve" ? "✅" : "❌")}
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: C.text1, marginBottom: 8 }}>
                {confirm.title ?? (confirm.type === "approve" ? "승인하시겠어요?" : "반려하시겠어요?")}
              </div>
              <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.7, whiteSpace: "pre-line" }}>
                {confirm.msg ?? (confirm.company
                  ? (<><b style={{ color: C.text1 }}>{confirm.company.name}</b> 업체를<br/>{confirm.type === "approve" ? "승인 처리합니다." : "반려 처리합니다."}</>)
                  : "")}
              </div>
            </div>
            {confirm.needsReason && (
              <textarea
                value={confirmReason}
                onChange={e => setConfirmReason(e.target.value)}
                placeholder="처리 사유를 입력하세요"
                style={{ width: "100%", padding: S.lg, borderRadius: R.lg, border: `1px solid ${C.bgWarm}`,
                  background: C.bg, fontSize: 13, color: C.text1, resize: "none", height: 70,
                  boxSizing: "border-box", marginBottom: S.lg, outline: "none", fontFamily: "inherit", lineHeight: 1.6 }}
              />
            )}
            <div style={{ display: "flex", gap: S.sm }}>
              <button onClick={() => { setConfirm(null); setConfirmReason(""); }} disabled={actionLoading}
                style={{ flex: 1, padding: S.xl, background: C.bg, color: C.text2,
                  border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                취소
              </button>
              <button
                disabled={actionLoading || (confirm.needsReason && !confirmReason.trim())}
                onClick={async () => {
                  if (confirm.onConfirm) {
                    setActionLoading(true);
                    await confirm.onConfirm(confirmReason);
                    setActionLoading(false);
                    setConfirm(null);
                    setConfirmReason("");
                  } else if (confirm.type === "approve") {
                    handleApprove(confirm.company);
                  } else {
                    handleReject(confirm.company, confirm.note);
                  }
                }}
                style={{ flex: 2, padding: S.xl,
                  background: confirm.type === "approve" ? C.green : C.brand,
                  color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 14,
                  cursor: "pointer", opacity: actionLoading ? 0.7 : 1 }}>
                {actionLoading ? "처리 중..." : "확인"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 서류 확대 미리보기(조회 전용) — 파트너 상담관리 사업자등록증/시공보험증권 */}
      {docPreview && (
        <DocPreviewModal url={docPreview.url} title={docPreview.title} onClose={() => setDocPreview(null)} />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: toast.ok ? "#1C3A28" : C.red, color: "#fff",
          borderRadius: R.full, padding: "10px 20px", fontSize: 13, fontWeight: 700,
          zIndex: 999, boxShadow: "0 4px 20px rgba(0,0,0,0.25)", whiteSpace: "nowrap" }}>
          {toast.ok ? "✓" : "✗"} {toast.msg}
        </div>
      )}
    </div>
  );
}
