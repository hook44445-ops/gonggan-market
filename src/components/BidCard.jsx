import { useState } from "react";
import { C, R, S } from "../constants";
import { MIN_BID_MANWON, isValidBidManwon } from "../utils/calculations";
import { bidLimit, limitText, unlockFor, unlockMessage, limitStateOf, partnerTier, cardNudge } from "../lib/partnerTier";
import { trustState } from "./TrustEmblems";
import SpaceActivityRecord from "./SpaceActivityRecord"; // v5.5: 공간 활동기록 요약(Add Only)
import { TempBadge } from "./common";
import GuaranteeBadge from "./GuaranteeBadge";
import { recordCompanyActivity } from "../utils/growthStore"; // 연속 활동 기록(표시 보조 · Add Only)
import { BetaGateModal, hasBetaAck } from "./beta/BetaUI"; // 베타 안내(Add Only · SHOW_BETA_UI 게이트)

export default function BidCard({
  r,
  currentUser,
  onBidSubmit,
  onRequiresAuth,
  alreadyBid = false,
  myBid = null,
  siteVisit = null,
  onAction = null,
  onGoDocuments = null,   // 「내 한도 · 서류」로 — 카드의 «다음 한 가지» 버튼
}) {
  const [submitted, setSubmitted] = useState(alreadyBid);
  const [showForm, setShowForm] = useState(false);
  const [bidBetaAck, setBidBetaAck] = useState(() => hasBetaAck("bid")); // 최초 1회 확인 후 재노출 안 함
  const [submitting, setSubmitting] = useState(false);
  const [bidForm, setBidForm] = useState({ price: "", period: "", material: "", comment: "" });
  const setBF = (k, v) => setBidForm(f => ({ ...f, [k]: v }));
  const isGuest = !onBidSubmit && !!onRequiresAuth;
  const hasBid = submitted || !!myBid;
  // 업체 선정/현장견적 요청 이후에는 '검토 중/입찰 수정'을 더 이상 보여주지 않는다.
  // (selected_bid_id/selected_company_id 채워짐, request.status 가 open 이 아님, 또는 내 입찰이 selected)
  const isSelectedAway = !!(r?.selectedBidId || r?.selectedCompanyId)
    || (!!r?.status && r.status !== "open")
    || myBid?.status === "selected";
  // 내 입찰이 선정됐는가 / 다른 업체가 선정됐는가 — 카드 문구 분기용.
  const myBidId     = myBid?.id ?? null;
  const myCompanyId = myBid?.companyId ?? currentUser?.id ?? null;
  const mineSelected =
    myBid?.status === "selected" ||
    myBid?.status === "site_visiting" ||
    (!!r?.selectedBidId && r.selectedBidId === myBidId) ||
    (!!r?.selectedCompanyId && r.selectedCompanyId === myCompanyId) ||
    r?.status === "in_progress" || r?.status === "selected";
  const otherSelected = isSelectedAway && !mineSelected;
  // siteVisit 상태 파생 — 선정 이후 현장견적 단계 UI 분기용
  const siteVisitStatus = siteVisit?.status ?? null;
  const isSiteVisitRequested =
    siteVisitStatus === "requested" ||
    siteVisitStatus === "site_visiting" ||
    siteVisitStatus === "visit_requested" ||
    r?.status === "site_visiting" ||
    r?.status === "visit_requested";
  const isSiteVisitAccepted =
    siteVisitStatus === "accepted" ||
    siteVisitStatus === "in_progress" ||
    siteVisitStatus === "visit_accepted";
  const isChosen = mineSelected;
  // 수정 폼 열기 — 기존 입찰값으로 프리필
  const openEdit = () => {
    const src = myBid ?? {};
    setBidForm({
      price:    src.price != null ? String(src.price) : (bidForm.price || ""),
      period:   src.period != null ? String(src.period) : (bidForm.period || ""),
      material: src.material ?? bidForm.material ?? "",
      comment:  src.comment ?? bidForm.comment ?? "",
    });
    setShowForm(true);
  };

  const isClosed = r.isActive === false && r.isActive !== undefined;
  const company = currentUser;
  // 수주 한도 — 관리자가 확인한 증빙으로만 정한다(lib/partnerTier.js 안전안). 예전엔 companies.badge 로
  // 정했는데, 그 값은 가입 화면에서 결제 없이 적히던 값이라 한도를 공짜로 가져갈 수 있었다.
  const limitState = limitStateOf(company ?? {});
  const maxBidAmount = bidLimit(limitState);
  const tierLabel = partnerTier(trustState(company ?? {})).label;
  // 이 카드의 «다음 한 가지» — 예산 상한 기준(모르면 사업자부터). 막지 않고 내면 무엇이 되는지 한 줄로.
  const budgetMax = Number(r.budgetMax ?? r.budget_max) || 0;
  const nudge = !isGuest ? cardNudge(budgetMax, limitState) : null;
  const nudgeLine = nudge && (
    <div style={{ background: "#FBF7EC", border: "1px solid #EADFC4", borderRadius: R.lg, padding: `${S.sm}px ${S.md}px`,
      marginTop: S.md, display: "flex", alignItems: "center", gap: S.sm }}>
      <span style={{ flex: 1, fontSize: 12, color: "#6F5A1E", lineHeight: 1.6, fontWeight: 600 }}>🔓 {nudge.text}</span>
      {nudge.cta && onGoDocuments && (
        <button onClick={(e) => { e.stopPropagation(); onGoDocuments(); }}
          style={{ flex: "0 0 auto", background: C.surface, color: "#8A6D1E", border: "1px solid #EADFC4", borderRadius: R.full,
            padding: "6px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          {nudge.cta}
        </button>
      )}
    </div>
  );
  const bidPrice = parseInt(bidForm.price, 10);
  const overLimit = !!bidForm.price && bidPrice > maxBidAmount;
  const underMin  = !!bidForm.price && (!Number.isFinite(bidPrice) || bidPrice < MIN_BID_MANWON);
  const invalidPrice = overLimit || underMin;
  const canSubmit = bidForm.price && bidForm.period && !invalidPrice;

  const iS = {
    width: "100%", padding: "13px 16px", border: `1.5px solid ${C.bgWarm}`,
    borderRadius: R.lg, fontSize: 15, outline: "none", boxSizing: "border-box",
    marginBottom: 14, fontFamily: "inherit", color: C.text1, background: C.surface,
  };

  const handleBidButtonClick = () => {
    if (isGuest) onRequiresAuth?.();
    else setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    // 제출 함수를 받지 못한 화면에서 그려졌으면 조용히 끝내지 않는다 — 파트너센터 입찰 탭이 이렇게 한 건도 못 넣었다.
    if (typeof onBidSubmit !== "function") {
      console.error("[BidCard] onBidSubmit 이 연결되지 않은 화면입니다 — 입찰을 저장할 수 없습니다", { requestId: r?.id });
      alert("지금 이 화면에서는 입찰을 보낼 수 없어요. 홈의 요청 목록에서 다시 시도해 주세요.");
      return;
    }
    setSubmitting(true);
    const ok = await onBidSubmit?.({
      price:    parseInt(bidForm.price, 10),
      period:   parseInt(bidForm.period, 10),
      material: bidForm.material,
      comment:  bidForm.comment,
    });
    setSubmitting(false);
    if (ok) {
      setShowForm(false);
      setSubmitted(true);
      try { recordCompanyActivity(currentUser?.id); } catch { /* 표시 보조 — 실패 무시 */ }
    }
  };

  // ── 선정 이후 상태 배지 ─────────────────────────────────────────────────
  const chosenBadge = isSiteVisitRequested
    ? { label: "현장견적 요청", bg: "#FFF7E0", color: "#B08040" }
    : isSiteVisitAccepted
    ? { label: "방문 확정", bg: C.brandL, color: C.brand }
    : { label: "선정됨", bg: "#EAF0FF", color: "#3355CC" };

  // ── 선정 이후 인라인 상태 박스 ──────────────────────────────────────────
  const renderChosenStatus = () => {
    if (isSiteVisitRequested) {
      return (
        <div key="sv-requested" style={{ background: "#FFFBF0", borderRadius: R.lg, padding: S.lg, border: `1px solid #F0D080` }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#B08040", marginBottom: S.sm }}>
            📅 현장견적 요청 도착
          </div>
          <div style={{ fontSize: 12, color: C.text3, marginBottom: S.md }}>
            의뢰인이 현장 방문 견적을 요청했어요. 일정을 확인하고 수락해주세요.
          </div>
          <div style={{ display: "flex", gap: S.sm }}>
            <button
              onClick={() => onAction?.("accept_site_visit", { r, myBid, siteVisit })}
              style={{ flex: 1, padding: "10px 0", background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
              ✅ 수락
            </button>
            <button
              onClick={() => onAction?.("reject_site_visit", { r, myBid, siteVisit })}
              style={{ flex: 1, padding: "10px 0", background: "#FFF0F0", color: C.red, border: `1px solid ${C.red44}`, borderRadius: R.lg, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              ✖ 거절
            </button>
          </div>
        </div>
      );
    }
    if (isSiteVisitAccepted) {
      return (
        <div key="sv-accepted" style={{ background: C.brandL, borderRadius: R.lg, padding: S.lg, border: `1px solid ${C.brandM}` }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.brand, marginBottom: S.sm }}>
            📍 현장방문 일정 확인
          </div>
          <div style={{ fontSize: 12, color: C.text3, marginBottom: S.md }}>
            현장 방문 일정이 확정됐어요. 방문 후 최종 견적서를 제출해주세요.
          </div>
          <button
            onClick={() => onAction?.("submit_estimate", { r, myBid, siteVisit })}
            style={{ width: "100%", padding: "10px 0", background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
            📋 최종 견적 제출
          </button>
        </div>
      );
    }
    // in_progress / selected / bid.status=selected
    return (
      <div key="in-progress" style={{ background: "#F0F4FF", borderRadius: R.lg, padding: S.lg, border: `1px solid #C0D0FF` }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#3355CC", marginBottom: S.sm }}>
          2단계 · 계약 및 착공 진행 중
        </div>
        <div style={{ fontSize: 12, color: C.text3 }}>
          의뢰인이 이 업체를 선정했습니다. 현장 방문 일정을 조율해주세요.
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{
        background: C.surface, borderRadius: R.xl, overflow: "hidden",
        marginBottom: S.md,
        border: `1.5px solid ${isChosen ? "#C0D0FF" : submitted ? C.green + "66" : C.bgWarm}`,
      }}>
        {(submitted || isChosen) && (
          <div style={{ height: 3, background: isChosen ? "#3355CC" : C.green }} />
        )}
        <div style={{ padding: S.xl }}>
          {/* Request header */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: S.sm }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text1 }}>{r.type} · {r.size}</div>
            <div style={{ display: "flex", gap: 6 }}>
              {r.urgent && (
                <span style={{ background: "#FFF0F0", color: C.red, borderRadius: R.full, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>급구</span>
              )}
              {isChosen ? (
                <span key="badge-chosen" style={{ background: chosenBadge.bg, color: chosenBadge.color, borderRadius: R.full, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                  {chosenBadge.label}
                </span>
              ) : hasBid ? (
                <span key="badge-bid" style={{ background: C.greenL, color: C.green, borderRadius: R.full, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>입찰완료</span>
              ) : isClosed ? (
                <span key="badge-closed" style={{ background: "#F0EDE8", color: C.text4, borderRadius: R.full, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>마감됨</span>
              ) : (
                <span key="badge-open" style={{ background: C.brandL, color: C.brand, borderRadius: R.full, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>입찰중</span>
              )}
            </div>
          </div>

          <div style={{ fontSize: 12, color: C.text3, marginBottom: 6 }}>
            {r.area}{r.style ? ` · ${r.style}` : r.distance ? ` · ${r.distance}` : ""}
          </div>
          <div style={{ fontSize: 13, color: C.text2, marginBottom: S.lg, lineHeight: 1.6 }}>{r.desc}</div>

          {/* ── 상태별 렌더링: 삼항 연산자로 완결형 분기 ──────────────────── */}
          {isChosen ? (
            renderChosenStatus()
          ) : hasBid ? (
            /* 입찰 제출 완료 + 의뢰인 검토 중 (선정 전) */
            <div key="reviewing" style={{ background: C.greenL, borderRadius: R.lg, padding: S.lg, border: `1px solid ${C.green33}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.sm }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.green }}>✅ 입찰 제출 완료</div>
                <span style={{ fontSize: 20 }}>✅</span>
              </div>
              <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.sm }}>
                <span style={{ background: C.surface, borderRadius: R.sm, padding: "4px 10px", fontSize: 13, fontWeight: 800, color: C.brand }}>
                  내 입찰가 {Number(bidForm.price || myBid?.price || 0).toLocaleString()}만원
                </span>
                <span style={{ background: C.surface, borderRadius: R.sm, padding: "4px 10px", fontSize: 13, fontWeight: 700, color: C.text2 }}>
                  공사 {bidForm.period || myBid?.period || "—"}일
                </span>
              </div>
              {(bidForm.material || myBid?.material) && (
                <div style={{ fontSize: 12, color: C.text3, marginBottom: 3 }}>{bidForm.material || myBid?.material}</div>
              )}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }}>
                <div style={{ fontSize:12, color: mineSelected ? C.brand : otherSelected ? C.text4 : C.text3, fontWeight: mineSelected ? 700 : 400 }}>
                  {mineSelected
                    ? "2단계 · 계약 진행 및 착공 준비 중 — 진행중 탭에서 확인하세요"
                    : otherSelected
                    ? "다른 업체가 선정되었어요"
                    : "의뢰인이 검토 중입니다"}
                </div>
                {/* 업체 선정 이후에는 입찰 수정 버튼 숨김 */}
                {!isSelectedAway && !isClosed && !isGuest && (
                  <button onClick={openEdit}
                    style={{ background:C.surface, color:C.brand, border:`1px solid ${C.brandM}`,
                      borderRadius:R.full, padding:"5px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    ✏️ 입찰 수정
                  </button>
                )}
              </div>
            </div>
          ) : isClosed ? (
            /* 마감된 요청 */
            <div key="closed" style={{ background: "#F8F5F0", borderRadius: R.lg, padding: S.md, display: "flex", alignItems: "center", gap: S.sm, border: `1px solid ${C.bgWarm}` }}>
              <span style={{ fontSize: 16 }}>🔒</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text3 }}>마감된 요청</div>
                <div style={{ fontSize: 11, color: C.text4, marginTop: 1 }}>입찰이 마감되어 새 견적을 제출할 수 없어요</div>
              </div>
            </div>
          ) : (
            /* 입찰 전 — 예산 + 입찰 버튼 */
            <div key="open" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: C.text3 }}>💰 고객 예산 {r.budget}</div>
                <div style={{ fontSize: 11, color: C.text4, marginTop: 2 }}>경쟁 입찰 {r.bidCount ?? r.bids ?? 0}개</div>
              </div>
              <button
                onClick={handleBidButtonClick}
                style={{ background: C.brand, color: "#fff", border: "none", borderRadius: R.full, padding: "10px 20px", fontWeight: 800, fontSize: 13, cursor: "pointer", boxShadow: `0 3px 12px ${C.brand44}` }}>
                {isGuest ? "🔒 입찰하기" : "견적 입찰하기"}
              </button>
            </div>
          )}
          {!isChosen && !hasBid && !isClosed && nudgeLine}
        </div>
      </div>

      {/* 입찰 진입 안내 — 확인 전 작성 화면을 가린다(베타) */}
      <BetaGateModal open={showForm && !bidBetaAck} kind="bid" onConfirm={() => setBidBetaAck(true)} onClose={() => setShowForm(false)} />

      {/* 입찰 제출/수정 폼 바텀시트 */}
      {showForm && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300 }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={{ background: C.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, padding: "24px 24px 40px", maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: "0 auto 16px" }} />
            <div style={{ fontSize: 18, fontWeight: 900, color: C.text1, marginBottom: 3 }}>{hasBid ? "입찰 수정하기" : "안심 견적 제출하기"}</div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: S.md }}>{r.type} · {r.size} · {r.area}</div>

            <div style={{ background: "#FFFDF8", borderRadius: R.lg, padding: `${S.sm}px ${S.md}px`, marginBottom: S.md,
              border: "1px solid #EDE3CF", display: "flex", justifyContent: "space-between", alignItems: "center", gap: S.sm }}>
              <span style={{ fontSize: 12, color: "#6F695D", fontWeight: 600 }}>{tierLabel} · 공사 1건</span>
              <span style={{ fontSize: 13, color: C.text1, fontWeight: 800 }}>최대 {limitText(maxBidAmount)}까지 입찰</span>
            </div>
            {nudgeLine && <div style={{ marginTop: -S.sm, marginBottom: S.md }}>{nudgeLine}</div>}

            {/* v5.5: 공간 활동기록 요약(④ 입찰 카드) — 실데이터만, 기록 없으면 미표시 */}
            <div style={{ marginBottom: S.md }}>
              <SpaceActivityRecord compact companyId={company?.id ?? null} ownerId={company?.ownerId ?? null} />
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: 6 }}>견적 금액 (만원) <span style={{ color: C.red }}>*</span></div>
            <input value={bidForm.price} onChange={e => setBF("price", e.target.value)} placeholder={`예: ${Math.min(2800, Math.floor(maxBidAmount * 0.9 / 10) * 10)}`} type="number" style={{ ...iS, borderColor: invalidPrice ? C.red : undefined }} />
            {/* 한도에 걸리는 순간 = 「첫 벽」. 오류가 아니라 초대로 — 무엇을 내면 이 공사를 할 수 있는지 알려 준다. */}
            {overLimit && (() => {
              const u = unlockFor(bidPrice, limitState);
              return (
                <div style={{ background: "#FFFDF8", border: "1px solid #E6D3A8", borderRadius: R.lg,
                  padding: `${S.sm}px ${S.md}px`, marginTop: -6, marginBottom: 12 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#7A5A1E", lineHeight: 1.5 }}>
                    {unlockMessage(u)}
                  </div>
                  {!u?.over && (
                    <div style={{ fontSize: 11.5, color: "#8C8577", marginTop: 3, lineHeight: 1.6 }}>
                      마이 → 서류함에서 낼 수 있어요. 낼 때마다 받을 수 있는 공사가 커집니다.
                    </div>
                  )}
                </div>
              );
            })()}
            {underMin && !overLimit && (
              <div style={{ fontSize: 12, color: C.red, marginTop: -10, marginBottom: 10, fontWeight: 600 }}>
                ⚠️ 최소 견적 금액은 {MIN_BID_MANWON}만원(100,000원)입니다
              </div>
            )}

            <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: 6 }}>예상 시공 기간 (일) <span style={{ color: C.red }}>*</span></div>
            <input value={bidForm.period} onChange={e => setBF("period", e.target.value)} placeholder="예: 30" type="number" style={iS} />

            <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: 6 }}>주요 자재 설명</div>
            <input value={bidForm.material} onChange={e => setBF("material", e.target.value)} placeholder="예: LX하우시스 바닥재, 대림 욕실" style={iS} />

            <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: 6 }}>의뢰인에게 한마디</div>
            <textarea value={bidForm.comment} onChange={e => setBF("comment", e.target.value)} placeholder="예: 12년 경력, 욕실·주방 전문. 중간 점검 사진 매번 공유해드립니다." rows={3} style={{ ...iS, resize: "none", lineHeight: 1.7 }} />

            {company && (
              <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.md, marginBottom: S.md, display: "flex", gap: S.md, alignItems: "center", border: `1px solid ${C.brandM}` }}>
                <TempBadge temp={company.temp ?? 0} lg />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: C.text2 }}>
                    재계약률 {company.recontractRate ?? "—"}% · AS {company.asRate ?? "—"}% · 완료 {company.completedJobs ?? "—"}건
                  </div>
                  <div style={{ fontSize: 11, color: C.brand, fontWeight: 700, marginTop: 3 }}>
                    {tierLabel} · 최대 {limitText(maxBidAmount)}
                  </div>
                  {/* 공간보증 배지(068) — badge_visible && ACTIVE 일 때만 */}
                  <div style={{ marginTop: 4 }}><GuaranteeBadge company={company} /></div>
                </div>
              </div>
            )}

            {/* 수수료 안내는 두지 않는다(대표 2026-09-24: 「수수료를 처음부터 보여줄 필요 없다」). */}
            <div style={{ height: S.md }} />

            <div style={{ display: "flex", gap: S.sm }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: S.xl, background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                취소
              </button>
              <button onClick={handleSubmit} disabled={!canSubmit || submitting} style={{ flex: 2, padding: S.xl, background: canSubmit ? C.brand : C.bgWarm, color: canSubmit ? "#fff" : C.text4, border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: canSubmit ? "pointer" : "not-allowed", boxShadow: canSubmit ? `0 4px 16px ${C.brand44}` : "none", transition: "all 0.2s" }}>
                {submitting ? "제출 중..." : hasBid ? "입찰 수정하기" : "안심 견적 제출하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
