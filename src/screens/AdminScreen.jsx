import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { BADGES } from "../constants/badges";
import { COMPANY_STATUS_META } from "../constants";
import {
  supabase,
  getCompanies, getUsers,
  adminReviewCompany, adminSetCompanyStatus,
  createNotification, getUserNotifications,
  getAdminLogs, getOpsConfig, updateOpsConfig,
  getPaymentOrders, adminUpdatePaymentOrder,
  getDisputePayments, adminResolveDispute,
  getPendingPayouts, adminSetPayoutStatus,
  adminSetUserStatus, adminAdjustSpaceTemp, adminAdjustUserTokens,
  adminGetLoungePosts, getLoungeReports,
  adminHideContent, adminUpdateLoungeReport,
  adminGetLoungeSeeds, createLoungeSeed, updateLoungeSeed, deleteLoungeSeed, uploadLoungeSeedImage,
  getCustomerReports, updateCustomerReportStatus,
  holdAllPayoutsForEscrow,
  getCompanyDocuments, adminReviewDocument,
  getReviewRewardsPending, updateReviewReward,
  adminGetHiddenRequests, adminRestoreRequest,
  getSeedReviews, createSeedReview, updateSeedReview, deleteSeedReview, uploadSeedReviewImage,
} from "../lib/supabase";
import AdminDocumentReviewModal from "../components/AdminDocumentReviewModal";

const SEED_CATEGORIES = [
  { id: 'interior',   label: '인테리어' },
  { id: 'room_deco',  label: '집꾸미기' },
  { id: 'worry',      label: '고민' },
  { id: 'daily',      label: '생활' },
  { id: 'chat',       label: '대화해요' },
  { id: 'realestate', label: '부동산' },
  { id: 'startup',    label: '창업' },
  { id: 'travel',     label: '여행' },
  { id: 'humor',      label: '유머' },
  { id: 'pet',        label: '반려동물' },
  { id: 'exercise',   label: '운동' },
  { id: 'food',       label: '맛집' },
];

const BLANK_SEED = { category: 'interior', title: '', content: '', nickname: '공간마켓', sort_order: 0, is_active: true, show_on_lounge: true };

// ── 라운지 관리 탭 ────────────────────────────────────────
function LoungeManagementTab({ seeds = [], seedsLoading = false, onReloadSeeds }) {
  const allReports = (() => {
    try { return JSON.parse(localStorage.getItem("lounge_reports") ?? "[]"); } catch { return []; }
  })();
  const allBlocks = (() => {
    try { return JSON.parse(localStorage.getItem("lounge_blocks") ?? "[]"); } catch { return []; }
  })();
  const [hiddenIds, setHiddenIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lounge_hidden") ?? "[]"); } catch { return []; }
  });

  const [seedSubTab, setSeedSubTab]   = useState("list");
  const [editSeed, setEditSeed]       = useState(null);
  const [seedForm, setSeedForm]       = useState(BLANK_SEED);
  const [seedSaving, setSeedSaving]   = useState(false);
  const [seedError, setSeedError]     = useState(null);
  const [seedImages, setSeedImages]   = useState([]);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [deletingId, setDeletingId]   = useState(null);
  const [togglingId, setTogglingId]   = useState(null);

  const openCreate = () => {
    setEditSeed(null);
    setSeedForm(BLANK_SEED);
    setSeedImages([]);
    setSeedError(null);
    setSeedSubTab("form");
  };

  const openEdit = (s) => {
    setEditSeed(s);
    setSeedForm({
      category:       s.category,
      title:          s.title ?? '',
      content:        s.content,
      nickname:       s.nickname,
      sort_order:     s.sort_order,
      is_active:      s.is_active,
      show_on_lounge: s.show_on_lounge,
    });
    setSeedImages(s.image_urls ?? []);
    setSeedError(null);
    setSeedSubTab("form");
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    const { data, error } = await uploadLoungeSeedImage(file);
    if (error) { setSeedError("이미지 업로드 실패: " + error.message); }
    else { setSeedImages(prev => [...prev, data.publicUrl]); }
    setUploadingImg(false);
    e.target.value = "";
  };

  const handleSaveSeed = async () => {
    if (!seedForm.content.trim()) { setSeedError("내용을 입력하세요"); return; }
    setSeedSaving(true);
    setSeedError(null);
    const payload = { ...seedForm, image_urls: seedImages, sort_order: Number(seedForm.sort_order) || 0 };
    const { error } = editSeed
      ? await updateLoungeSeed(editSeed.id, payload)
      : await createLoungeSeed(payload);
    if (error) { setSeedError(error.message); setSeedSaving(false); return; }
    setSeedSaving(false);
    setSeedSubTab("list");
    onReloadSeeds?.();
  };

  const handleToggleActive = async (s) => {
    if (togglingId) return;
    setTogglingId(s.id);
    await updateLoungeSeed(s.id, { is_active: !s.is_active });
    setTogglingId(null);
    onReloadSeeds?.();
  };

  const handleToggleShow = async (s) => {
    if (togglingId) return;
    setTogglingId(s.id);
    await updateLoungeSeed(s.id, { show_on_lounge: !s.show_on_lounge });
    setTogglingId(null);
    onReloadSeeds?.();
  };

  const handleDeleteSeed = async (s) => {
    if (deletingId) return;
    setDeletingId(s.id);
    await deleteLoungeSeed(s.id);
    setDeletingId(null);
    onReloadSeeds?.();
  };

  const toggleHide = (id) => {
    setHiddenIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try { localStorage.setItem("lounge_hidden", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const postReports    = allReports.filter(r => r.type === "post");
  const commentReports = allReports.filter(r => r.type === "comment");
  const storyReports   = allReports.filter(r => r.type === "story");

  const ReportList = ({ reports, label }) => (
    <div style={{ background: "#fff", borderRadius: R.xl, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: S.md }}>{label}</div>
      {reports.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: C.text3, fontSize: 13 }}>신고 내역이 없습니다</div>
      ) : reports.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: S.sm, padding: `${S.sm}px 0`, borderBottom: `1px solid ${C.bg}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: C.text2, fontWeight: 600 }}>ID: {r.targetId}</div>
            <div style={{ fontSize: 11, color: C.text3 }}>
              사유: {r.reason} · {new Date(r.createdAt).toLocaleDateString("ko-KR")}
              {hiddenIds.includes(r.targetId) && <span style={{ marginLeft: 6, color: C.red, fontWeight: 700 }}>숨김중</span>}
            </div>
          </div>
          <button
            onClick={() => toggleHide(r.targetId)}
            style={{ padding: "5px 10px", borderRadius: R.full, border: "none", fontSize: 11, fontWeight: 700, cursor: "pointer", background: hiddenIds.includes(r.targetId) ? C.brandL : "#FEF0F0", color: hiddenIds.includes(r.targetId) ? C.brand : C.red }}>
            {hiddenIds.includes(r.targetId) ? "숨김해제" : "숨김"}
          </button>
        </div>
      ))}
    </div>
  );

  const seedCatLabel = (id) => SEED_CATEGORIES.find(c => c.id === id)?.label ?? id;

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.lg }}>💬 라운지 관리</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: S.sm, marginBottom: S.xl }}>
        {[
          ["게시글 신고", `${postReports.length}건`,    "📝"],
          ["댓글 신고",   `${commentReports.length}건`, "💬"],
          ["스토리 신고", `${storyReports.length}건`,   "📸"],
          ["차단 처리",   `${allBlocks.length}명`,       "🚫"],
        ].map(([label,val,icon]) => (
          <div key={label} style={{ background: "#fff", borderRadius: R.lg, padding: S.xl, border: `1px solid ${C.bgWarm}`, textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: S.sm }}>{icon}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.text1 }}>{val}</div>
            <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      <ReportList reports={postReports}    label="📋 신고된 게시글" />
      <ReportList reports={commentReports} label="💬 신고된 댓글" />
      <ReportList reports={storyReports}   label="📸 신고된 스토리" />

      {/* ── Seed 게시글 관리 ── */}
      <div style={{ background: "#fff", borderRadius: R.xl, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: S.md }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>🌱 Seed 게시글 관리</div>
          {seedSubTab === "list" ? (
            <button onClick={openCreate}
              style={{ padding: "7px 14px", background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              + 새 seed
            </button>
          ) : (
            <button onClick={() => setSeedSubTab("list")}
              style={{ padding: "7px 14px", background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              ← 목록
            </button>
          )}
        </div>

        {seedSubTab === "list" && (
          seedsLoading ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: C.text3, fontSize: 13 }}>불러오는 중...</div>
          ) : seeds.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: C.text3, fontSize: 13 }}>등록된 seed 게시글이 없습니다</div>
          ) : seeds.map(s => (
            <div key={s.id} style={{ padding: `${S.sm}px 0`, borderBottom: `1px solid ${C.bg}`, display: "flex", gap: S.sm, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: S.xs, alignItems: "center", marginBottom: 2, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: C.brand, background: C.brandL, borderRadius: R.sm, padding: "1px 6px" }}>
                    {seedCatLabel(s.category)}
                  </span>
                  <span style={{ fontSize: 10, color: s.is_active ? "#27AE60" : C.text4, fontWeight: 700 }}>
                    {s.is_active ? "활성" : "비활성"}
                  </span>
                  {!s.show_on_lounge && (
                    <span style={{ fontSize: 10, color: C.text4, fontWeight: 600 }}>숨김</span>
                  )}
                  <span style={{ fontSize: 10, color: C.text4 }}>순서:{s.sort_order}</span>
                </div>
                {s.title && <div style={{ fontSize: 12, fontWeight: 700, color: C.text1, marginBottom: 2 }}>{s.title}</div>}
                <div style={{ fontSize: 11, color: C.text2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                  {s.content.slice(0, 60)}{s.content.length > 60 ? "…" : ""}
                </div>
                <div style={{ fontSize: 10, color: C.text4, marginTop: 2 }}>by {s.nickname}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                <button onClick={() => openEdit(s)}
                  style={{ padding: "4px 10px", background: C.brandL, color: C.brand, border: "none", borderRadius: R.sm, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  수정
                </button>
                <button onClick={() => handleToggleActive(s)} disabled={!!togglingId}
                  style={{ padding: "4px 10px", background: s.is_active ? "#FEF0F0" : "#EAF7EE", color: s.is_active ? C.red : "#27AE60", border: "none", borderRadius: R.sm, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {s.is_active ? "비활성" : "활성"}
                </button>
                <button onClick={() => handleToggleShow(s)} disabled={!!togglingId}
                  style={{ padding: "4px 10px", background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.sm, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {s.show_on_lounge ? "숨김" : "노출"}
                </button>
                <button onClick={() => handleDeleteSeed(s)} disabled={!!deletingId}
                  style={{ padding: "4px 10px", background: "#FEF0F0", color: C.red, border: "none", borderRadius: R.sm, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {deletingId === s.id ? "…" : "삭제"}
                </button>
              </div>
            </div>
          ))
        )}

        {seedSubTab === "form" && (
          <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.xs }}>
              {editSeed ? "Seed 수정" : "새 Seed 등록"}
            </div>

            <div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>카테고리</div>
              <select value={seedForm.category} onChange={e => setSeedForm(f => ({ ...f, category: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit" }}>
                {SEED_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>

            <div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>제목 (선택)</div>
              <input value={seedForm.title} onChange={e => setSeedForm(f => ({ ...f, title: e.target.value }))}
                placeholder="제목 없으면 비워두세요"
                style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>

            <div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>내용 *</div>
              <textarea value={seedForm.content} onChange={e => setSeedForm(f => ({ ...f, content: e.target.value }))}
                placeholder="게시글 내용을 입력하세요"
                rows={6}
                style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
            </div>

            <div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>닉네임</div>
              <input value={seedForm.nickname} onChange={e => setSeedForm(f => ({ ...f, nickname: e.target.value }))}
                placeholder="공간마켓"
                style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>

            <div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>노출 순서 (낮을수록 먼저)</div>
              <input type="number" value={seedForm.sort_order} onChange={e => setSeedForm(f => ({ ...f, sort_order: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "flex", gap: S.sm }}>
              <label style={{ display: "flex", alignItems: "center", gap: S.xs, cursor: "pointer", fontSize: 13, color: C.text1 }}>
                <input type="checkbox" checked={seedForm.is_active} onChange={e => setSeedForm(f => ({ ...f, is_active: e.target.checked }))} />
                활성
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: S.xs, cursor: "pointer", fontSize: 13, color: C.text1 }}>
                <input type="checkbox" checked={seedForm.show_on_lounge} onChange={e => setSeedForm(f => ({ ...f, show_on_lounge: e.target.checked }))} />
                라운지 노출
              </label>
            </div>

            <div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>이미지 ({seedImages.length}개)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: S.xs, marginBottom: S.xs }}>
                {seedImages.map((url, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    <img src={url} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: R.sm, border: `1px solid ${C.bgWarm}` }} />
                    <button onClick={() => setSeedImages(prev => prev.filter((_, j) => j !== i))}
                      style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: C.red, color: "#fff", border: "none", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: S.xs, padding: "8px 14px", background: C.bg, borderRadius: R.lg, fontSize: 12, color: C.text2, cursor: uploadingImg ? "not-allowed" : "pointer", border: `1px solid ${C.bgWarm}` }}>
                {uploadingImg ? "업로드 중..." : "📷 이미지 추가"}
                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImg} style={{ display: "none" }} />
              </label>
            </div>

            {seedError && (
              <div style={{ fontSize: 12, color: C.red, background: "#FEF0F0", borderRadius: R.sm, padding: S.sm }}>{seedError}</div>
            )}

            <button onClick={handleSaveSeed} disabled={seedSaving}
              style={{ padding: "13px", background: seedSaving ? C.text4 : C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 14, cursor: seedSaving ? "not-allowed" : "pointer" }}>
              {seedSaving ? "저장 중..." : editSeed ? "수정 완료" : "등록하기"}
            </button>
          </div>
        )}
      </div>

      <div style={{ background: "#fff", borderRadius: R.xl, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: S.md }}>💰 공간토큰 수동 관리</div>
        <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.md, marginBottom: S.md, border: `1px solid ${C.brandM}` }}>
          <div style={{ fontSize: 12, color: C.brand, lineHeight: 1.6 }}>
            ℹ️ 사용자 ID 기반 수동 지급/회수는 Supabase 대시보드에서 직접 처리하세요.
          </div>
        </div>
        <div style={{ display: "flex", gap: S.sm }}>
          <input placeholder="사용자 ID 또는 전화번호" style={{ flex: 1, padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit" }} />
          <input placeholder="토큰 수" type="number" style={{ width: 90, padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit" }} />
        </div>
        <div style={{ display: "flex", gap: S.sm, marginTop: S.sm }}>
          <button style={{ flex: 1, padding: "10px", background: C.brandL, color: C.brand, border: `1px solid ${C.brandM}`, borderRadius: R.lg, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ 지급</button>
          <button style={{ flex: 1, padding: "10px", background: "#FEF0F0", color: C.red, border: `1px solid ${C.red}33`, borderRadius: R.lg, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>- 회수</button>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}` }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: S.md }}>🌡️ 공간온도 수동 조정</div>
        <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.md, marginBottom: S.md, border: `1px solid ${C.brandM}` }}>
          <div style={{ fontSize: 12, color: C.brand, lineHeight: 1.6 }}>
            변경 사유를 반드시 입력하세요. 변경 기록은 adminLogs에 자동 저장됩니다.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
          <input placeholder="사용자 ID" style={{ padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit" }} />
          <input placeholder="변경값 (+0.1 또는 -0.5)" type="number" step="0.1" style={{ padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit" }} />
          <input placeholder="변경 사유 (필수)" style={{ padding: "10px 12px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, outline: "none", background: "#fff", color: C.text1, fontFamily: "inherit" }} />
          <button style={{ padding: "12px", background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: `0 4px 14px ${C.brand}44` }}>공간온도 조정하기</button>
        </div>
      </div>
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

const STATUS_MAP = {
  pending:  { label: "대기중", color: C.gold,  bg: "#FBF5E8" },
  approved: { label: "승인",   color: C.green, bg: C.greenL  },
  rejected: { label: "반려",   color: C.red,   bg: "#FFF0F0" },
};

const normalizeCompany = (row) => ({
  id:            row.id,
  name:          row.name ?? "업체",
  badge:         row.badge ?? "basic",
  temp:          row.temp ?? 70,
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
  rejectNote: row.reject_note ?? "",
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
});

// ── 포토후기 시딩 탭 ──────────────────────────────────────────────────────────
function SeedReviewTab() {
  const [seeds, setSeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({ before: false, after: false });
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
  };

  const handleUpload = async (file, slot) => {
    setUploading(p => ({ ...p, [slot]: true }));
    const { url, error } = await uploadSeedReviewImage(file, slot);
    setUploading(p => ({ ...p, [slot]: false }));
    if (error) { showToast("업로드 실패", false); return; }
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

      {/* 등록/수정 폼 */}
      <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl,
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

export default function AdminScreen({ onBack, onHome, user }) {
  const [companies, setCompanies]       = useState([]);
  const [customers, setCustomers]       = useState([]);
  const [customersErr, setCustomersErr] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [mainTab, setMainTab]           = useState("dashboard");
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
  const [loungeSeeds, setLoungeSeeds]   = useState([]);
  const [seedsLoading, setSeedsLoading] = useState(false);
  const [reports, setReports]           = useState([]);
  const [reviewRewards, setReviewRewards] = useState([]);
  const [hiddenRequests, setHiddenRequests] = useState([]);
  const [hiddenLoading, setHiddenLoading] = useState(false);
  const [restoring, setRestoring] = useState(null);

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
      getUsers({ role: "consumer" }).then(({ data, error }) => {
        if (error || !data) { setCustomersErr(true); return; }
        setCustomers(data.map(normalizeCustomer));
      }),
    ]).finally(() => setLoading(false));
  }, []);

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
      setSeedsLoading(true);
      Promise.all([
        adminGetLoungePosts().catch(() => ({ data: [] })),
        getLoungeReports().catch(() => ({ data: [] })),
        adminGetLoungeSeeds().catch(() => ({ data: [] })),
      ]).then(([{ data: p }, { data: r }, { data: s }]) => {
        setLoungePosts(p ?? []);
        setLoungeReports(r ?? []);
        setLoungeSeeds(s ?? []);
      }).finally(() => setSeedsLoading(false));
    }
    if (mainTab === "reports") {
      getCustomerReports().then(({ data }) => setReports(data ?? [])).catch(() => setReports([]));
    }
    if (mainTab === "reviews") {
      getReviewRewardsPending().then(({ data }) => setReviewRewards(data ?? [])).catch(() => setReviewRewards([]));
    }
    if (mainTab === "hidden") {
      setHiddenLoading(true);
      adminGetHiddenRequests().then(({ data }) => setHiddenRequests(data ?? [])).catch(() => setHiddenRequests([])).finally(() => setHiddenLoading(false));
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
    }
    setActionLoading(false);
    setShowStatusModal(false);
    setStatusReason("");
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

  const handleCustomerStatus = async (customer, status, reason) => {
    setActionLoading(true);
    const { error } = await adminSetUserStatus(customer.id, user?.id, status, reason);
    if (!error) {
      const update = { accountStatus: status };
      setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, ...update } : c));
      setSelectedCustomer(prev => prev ? { ...prev, ...update } : prev);
      showToast("상태 변경 완료");
    } else { showToast("처리 실패", false); }
    setActionLoading(false);
  };

  const handleAdjustTemp = async (customer, delta) => {
    setActionLoading(true);
    const { error } = await adminAdjustSpaceTemp(customer.id, user?.id, delta, adjReason || null);
    if (!error) {
      const next = Math.round(Math.min(99, Math.max(0, (customer.spaceTemp ?? 36.5) + delta)) * 10) / 10;
      setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, spaceTemp: next } : c));
      setSelectedCustomer(prev => prev ? { ...prev, spaceTemp: next } : prev);
      showToast("공간온도 조정 완료");
    } else { showToast("처리 실패", false); }
    setActionLoading(false);
    setAdjReason("");
  };

  const handleAdjustTokens = async (customer, delta) => {
    setActionLoading(true);
    const { error } = await adminAdjustUserTokens(customer.id, user?.id, delta, adjReason || null);
    if (!error) {
      const next = Math.max(0, (customer.spaceTokens ?? 0) + delta);
      setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, spaceTokens: next } : c));
      setSelectedCustomer(prev => prev ? { ...prev, spaceTokens: next } : prev);
      showToast("토큰 조정 완료");
    } else { showToast("처리 실패", false); }
    setActionLoading(false);
    setAdjReason("");
  };

  const MAIN_TABS = [
    ["dashboard",      "대시보드"],
    ["companies",      "업체관리"],
    ["customers",      "고객관리"],
    ["hidden",         "숨김요청관리"],
    ["payments",       "결제관리"],
    ["disputes",       "분쟁관리"],
    ["settlements",    "정산관리"],
    ["reviews",        "리뷰관리"],
    ["seed",           "포토후기 시딩"],
    ["lounge",         "라운지관리"],
    ["reports",        "신고관리"],
    ["notifications",  "알림"],
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif" }}>

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

      {/* Main Tabs */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.bgWarm}`, overflowX: "auto" }}>
        <div style={{ display: "flex", minWidth: "max-content", padding: "0 16px" }}>
          {MAIN_TABS.map(([v, l]) => (
            <button key={v} onClick={() => setMainTab(v)}
              style={{ padding: "12px 14px", border: "none", background: "transparent",
                fontWeight: mainTab === v ? 800 : 500, fontSize: 13,
                color: mainTab === v ? C.brand : C.text3,
                borderBottom: `2.5px solid ${mainTab === v ? C.brand : "transparent"}`,
                cursor: "pointer", whiteSpace: "nowrap" }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: `${S.xl}px ${S.xl}px 90px` }}>

        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: C.text3, fontSize: 14 }}>
            데이터 로딩 중...
          </div>
        )}

        {!loading && (
          <>
            {/* ── Dashboard ── */}
            {mainTab === "dashboard" && (
              <div>
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
                    ["플랫폼 수수료 (고객)", "3% (VAT 별도)"],
                    ["플랫폼 수수료 (업체)", "4% (VAT 별도)"],
                    ["에스크로 구조",        "10/20/40/30"],
                    ["초기 파트너 혜택",     "수수료 동일 · 배지 우선"],
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
                              padding: "2px 8px", fontSize: 11 }}>보증금 {company.deposit.toLocaleString()}만원</span>
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

            {/* ── Customer Management ── */}
            {mainTab === "customers" && (
              <div>
                {customersErr ? (
                  <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xxl,
                    textAlign: "center", border: `1px solid ${C.bgWarm}` }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, marginBottom: 8 }}>서비스 권한 필요</div>
                    <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.7 }}>
                      고객 목록 조회는 서버 측 관리자 권한이 필요합니다.<br/>
                      Supabase 서비스 롤 키를 통한 API 연동이 필요합니다.
                    </div>
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
                    ) : customers.map(customer => (
                      <div key={customer.id} style={{ background: C.surface, borderRadius: R.xl, padding: S.xl,
                        marginBottom: S.sm, border: `1px solid ${C.bgWarm}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.sm }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>{customer.name}</div>
                          <span style={{ background: C.brandL, color: C.brand, borderRadius: R.full,
                            padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>견적 {customer.requests}건</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.text3 }}>📱 {customer.phone} · 📍 {customer.region}</div>
                        <div style={{ fontSize: 11, color: C.text4, marginTop: 4 }}>가입일: {customer.joinedAt}</div>
                      </div>
                    ))}
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
                                  const { error } = await supabase.from("escrow_payments")
                                    .update({ dispute_status: st }).eq("id", d.id);
                                  if (!error) {
                                    setDisputes(prev => prev.map(x => x.id === d.id ? { ...x, dispute_status: st } : x));
                                    showToast("상태 변경 완료");
                                  } else { showToast("처리 실패", false); }
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

            {/* ── Lounge Management ── */}
            {mainTab === "lounge" && (
              <LoungeManagementTab
                seeds={loungeSeeds}
                seedsLoading={seedsLoading}
                onReloadSeeds={() => {
                  setSeedsLoading(true);
                  adminGetLoungeSeeds().then(({ data }) => setLoungeSeeds(data ?? [])).finally(() => setSeedsLoading(false));
                }}
              />
            )}

            {/* ── Customer Reports ── */}
            {mainTab === "reports" && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: S.md }}>
                  신고 <span style={{ color: C.red }}>{reports.length}건</span>
                </div>
                {reports.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 0" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
                    <div style={{ fontSize: 14, color: C.text3 }}>신고 내역 없음</div>
                  </div>
                ) : reports.map(r => (
                  <div key={r.id} style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.sm, border: `1px solid ${C.bgWarm}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.sm }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{r.subject ?? "신고"}</div>
                        <div style={{ fontSize: 11, color: C.text3 }}>{r.created_at ? new Date(r.created_at).toLocaleDateString("ko-KR") : ""}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: r.status === "resolved" ? C.green : C.gold,
                        background: r.status === "resolved" ? C.greenL : "#FBF5E8",
                        borderRadius: R.full, padding: "3px 10px" }}>
                        {r.status === "resolved" ? "처리완료" : "검토중"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: C.text2, marginBottom: S.sm }}>{r.description ?? ""}</div>
                    {r.status !== "resolved" && (
                      <button
                        disabled={actionLoading}
                        onClick={() => {
                          setActionLoading(true);
                          updateCustomerReportStatus(r.id, "resolved").then(({ error }) => {
                            if (!error) setReports(prev => prev.map(x => x.id === r.id ? { ...x, status: "resolved" } : x));
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
                ))}
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

            {mainTab === "seed" && <SeedReviewTab />}

            {mainTab === "notifications" && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.md }}>
                  알림 <span style={{ color: C.brand }}>{notifications.length}건</span>
                </div>
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
                    <div style={{ fontSize: 22, fontWeight: 900, color: C.navy }}>{selected.deposit.toLocaleString()}만원</div>
                    <div style={{ fontSize: 11, color: C.text4 }}>납부 보증금</div>
                    <div style={{ fontSize: 11, color: bm.color, fontWeight: 700, marginTop: 2 }}>최대 {bm.maxJob} 수주</div>
                    <button onClick={() => setDocModal("badge")}
                      style={{ fontSize: 11, color: C.brand, background: "none", border: "none", cursor: "pointer", fontWeight: 700, marginTop: 4, textDecoration: "underline" }}>
                      배지 상세 ›
                    </button>
                  </div>
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
              {selected.docs.map((doc, i) => (
                <div key={i}
                  onClick={() => {
                    if (!doc.submitted) return;
                    if (i === 0) setDocModal("biz");
                    if (i === 1) setDocModal("insurance");
                  }}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: `${S.sm}px 0`,
                    borderBottom: i < selected.docs.length - 1 ? `1px solid ${C.bgWarm}` : "none",
                    cursor: doc.submitted && i < 2 ? "pointer" : "default" }}>
                  <span style={{ fontSize: 13, color: C.text2 }}>
                    {doc.label} {doc.submitted && i < 2 ? "›" : ""}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: doc.submitted ? C.green : C.red }}>
                    {doc.submitted ? "✓ 제출" : "✗ 미제출"}
                  </span>
                </div>
              ))}
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
              ["보증금 할인", selected.docs[1]?.submitted ? "20% 적용" : "미적용 (30% 기준)"],
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
              const bm2 = BADGES[selected.badge] || BADGES.basic;
              return (
                <>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.lg }}>🏆 공간보증 배지</div>
                  {[
                    ["배지 등급",      `${bm2.icon} ${bm2.label}`],
                    ["가능 공사 금액", bm2.maxJob],
                    ["필요 보증금",    `${selected.deposit.toLocaleString()}만원`],
                    ["보험 제출 여부", selected.docs[1]?.submitted ? "✓ 제출" : "✗ 미제출"],
                    ["승인 상태",      selected.status === "approved" ? "✓ 승인" : selected.status === "rejected" ? "✗ 반려" : "검토 중"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between",
                      padding: `${S.sm}px 0`, borderBottom: `1px solid ${C.bgWarm}` }}>
                      <span style={{ fontSize: 13, color: C.text3 }}>{k}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{v}</span>
                    </div>
                  ))}
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
