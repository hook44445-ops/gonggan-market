import { useState } from "react";
import { C, R, S } from "../constants";
import { BADGES } from "../constants/badges";
import { TempBadge } from "./common";

export default function BidCard({ r, currentUser, onBidSubmit, onRequiresAuth }) {
  const [submitted, setSubmitted] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bidForm, setBidForm] = useState({ price:"", period:"", material:"", comment:"" });
  const setBF = (k, v) => setBidForm(f => ({ ...f, [k]:v }));
  const isGuest  = !onBidSubmit && !!onRequiresAuth;
  const isClosed = r.isActive === false && r.isActive !== undefined;
  const company = currentUser;
  const companyBadge = BADGES[company?.badge ?? "basic"] ?? BADGES.basic;
  const maxBidAmount = companyBadge.maxAmount;
  const bidPrice = parseInt(bidForm.price, 10);
  const overLimit = !!bidForm.price && bidPrice > maxBidAmount;
  const canSubmit = bidForm.price && bidForm.period && !overLimit;

  const iS = {
    width:"100%", padding:"13px 16px", border:`1.5px solid ${C.bgWarm}`,
    borderRadius:R.md, fontSize:15, outline:"none", boxSizing:"border-box",
    marginBottom:14, fontFamily:"inherit", color:C.text1, background:C.surface
  };

  const handleBidButtonClick = () => {
    if (isGuest) onRequiresAuth?.();
    else setShowForm(true);
  };

  const handleSubmit = () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setTimeout(() => {
      const bidData = {
        price:    parseInt(bidForm.price, 10),
        period:   parseInt(bidForm.period, 10),
        material: bidForm.material,
        comment:  bidForm.comment,
      };
      onBidSubmit?.(bidData);
      setShowForm(false);
      setSubmitted(true);
      setSubmitting(false);
    }, 800);
  };

  return (
    <div>
      <div style={{
        background: C.surface, borderRadius: R.xl, overflow:"hidden",
        marginBottom: S.md,
        border: `1.5px solid ${submitted ? C.green + "66" : C.bgWarm}`
      }}>
        {submitted && <div style={{ height:3, background:C.green }} />}
        <div style={{ padding: S.xl }}>
          {/* Request header */}
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:S.sm }}>
            <div style={{ fontSize:15, fontWeight:700, color:C.text1 }}>{r.type} · {r.size}</div>
            <div style={{ display:"flex", gap:6 }}>
              {r.urgent && (
                <span style={{ background:"#FFF0F0", color:C.red, borderRadius:R.full, padding:"2px 8px", fontSize:11, fontWeight:700 }}>급구</span>
              )}
              {submitted
                ? <span style={{ background:C.greenL, color:C.green, borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:700 }}>입찰완료</span>
                : isClosed
                ? <span style={{ background:"#F0EDE8", color:C.text4, borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:600 }}>마감됨</span>
                : <span style={{ background:C.brandL, color:C.brand, borderRadius:R.full, padding:"3px 10px", fontSize:11, fontWeight:600 }}>입찰중</span>
              }
            </div>
          </div>

          <div style={{ fontSize:12, color:C.text3, marginBottom:6 }}>
            {r.area}{r.style ? ` · ${r.style}` : r.distance ? ` · ${r.distance}` : ""}
          </div>
          <div style={{ fontSize:13, color:C.text2, marginBottom:S.lg, lineHeight:1.6 }}>{r.desc}</div>

          {/* Submitted: success summary */}
          {submitted ? (
            <div style={{ background:C.greenL, borderRadius:R.lg, padding:S.lg,
              border:`1px solid ${C.green}33` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.sm }}>
                <div style={{ fontSize:14, fontWeight:800, color:C.green }}>✅ 입찰 제출 완료</div>
                <span style={{ fontSize:20 }}>✅</span>
              </div>
              <div style={{ display:"flex", gap:S.sm, flexWrap:"wrap", marginBottom:S.sm }}>
                <span style={{ background:C.surface, borderRadius:R.sm, padding:"4px 10px", fontSize:13, fontWeight:800, color:C.brand }}>
                  💰 {parseInt(bidForm.price).toLocaleString()}만원
                </span>
                <span style={{ background:C.surface, borderRadius:R.sm, padding:"4px 10px", fontSize:13, fontWeight:700, color:C.text2 }}>
                  📅 {bidForm.period}일
                </span>
              </div>
              {bidForm.material && (
                <div style={{ fontSize:12, color:C.text3, marginBottom:3 }}>🔨 {bidForm.material}</div>
              )}
              <div style={{ fontSize:12, color:C.text3, marginTop:4 }}>의뢰인이 검토 중입니다</div>
            </div>
          ) : isClosed ? (
            /* Closed: no bidding allowed */
            <div style={{ background:"#F8F5F0", borderRadius:R.lg, padding:S.md,
              display:"flex", alignItems:"center", gap:S.sm, border:`1px solid ${C.bgWarm}` }}>
              <span style={{ fontSize:16 }}>🔒</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.text3 }}>마감된 요청</div>
                <div style={{ fontSize:11, color:C.text4, marginTop:1 }}>입찰이 마감되어 새 견적을 제출할 수 없어요</div>
              </div>
            </div>
          ) : (
            /* Bottom row: budget info + bid button */
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:12, color:C.text3 }}>💰 {r.budget}</div>
                <div style={{ fontSize:11, color:C.text4, marginTop:2 }}>경쟁 입찰 {r.bids || 0}개</div>
              </div>
              <button
                onClick={handleBidButtonClick}
                style={{
                  background: C.brand, color:"#fff", border:"none",
                  borderRadius:R.full, padding:"10px 20px",
                  fontWeight:800, fontSize:13, cursor:"pointer",
                  boxShadow:`0 3px 12px ${C.brand}44`
                }}>
                {isGuest ? "🔒 입찰하기" : "견적 입찰하기"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bid form bottom sheet */}
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.65)",
          display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:300 }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={{ background:C.surface, borderRadius:"24px 24px 0 0",
            width:"100%", maxWidth:480, padding:"24px 24px 40px",
            maxHeight:"88vh", overflowY:"auto" }}>
            <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 16px" }} />

            <div style={{ fontSize:18, fontWeight:900, color:C.text1, marginBottom:3 }}>안심 견적 제출하기</div>
            <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>
              {r.type} · {r.size} · {r.area}
            </div>

            {/* Company grade limit info */}
            <div style={{ background:companyBadge.bg, borderRadius:R.lg, padding:`${S.sm}px ${S.md}px`,
              marginBottom:S.md, display:"flex", alignItems:"center", gap:S.sm,
              border:`1px solid ${companyBadge.color}33` }}>
              <span style={{ fontSize:16 }}>{companyBadge.icon}</span>
              <span style={{ fontSize:12, color:companyBadge.color, fontWeight:700 }}>
                {companyBadge.label} · 최대 {companyBadge.maxAmount.toLocaleString()}만원까지 입찰 가능
              </span>
            </div>

            <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:6 }}>견적 금액 (만원) <span style={{color:C.red}}>*</span></div>
            <input value={bidForm.price} onChange={e => setBF("price", e.target.value)}
              placeholder="예: 2800" type="number"
              style={{ ...iS, borderColor: overLimit ? C.red : undefined }} />
            {overLimit && (
              <div style={{ fontSize:12, color:C.red, marginTop:-10, marginBottom:10, fontWeight:600 }}>
                ⚠️ {companyBadge.label} 등급 최대 {companyBadge.maxAmount.toLocaleString()}만원을 초과했습니다
              </div>
            )}

            <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:6 }}>예상 시공 기간 (일) <span style={{color:C.red}}>*</span></div>
            <input value={bidForm.period} onChange={e => setBF("period", e.target.value)}
              placeholder="예: 30" type="number" style={iS} />

            <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:6 }}>주요 자재 설명</div>
            <input value={bidForm.material} onChange={e => setBF("material", e.target.value)}
              placeholder="예: LX하우시스 바닥재, 대림 욕실" style={iS} />

            <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:6 }}>의뢰인에게 한마디</div>
            <textarea value={bidForm.comment} onChange={e => setBF("comment", e.target.value)}
              placeholder="예: 12년 경력, 에스크로 156건 완료. 중간 점검 사진 매번 공유해드립니다."
              rows={3} style={{ ...iS, resize:"none", lineHeight:1.7 }} />

            {/* Company trust badge — shown only when logged-in company data is available */}
            {company && (
              <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.md,
                marginBottom:S.md, display:"flex", gap:S.md, alignItems:"center",
                border:`1px solid ${C.brandM}` }}>
                <TempBadge temp={company.temp ?? 0} lg />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:C.text2 }}>
                    재계약률 {company.recontractRate ?? "—"}% · AS {company.asRate ?? "—"}% · 완료 {company.completedJobs ?? "—"}건
                  </div>
                  <div style={{ fontSize:11, color:companyBadge.color, fontWeight:700, marginTop:3 }}>
                    {companyBadge.icon} {companyBadge.label}
                  </div>
                </div>
              </div>
            )}

            {/* Fee info */}
            <div style={{ background:C.surface2, borderRadius:R.lg, padding:S.md,
              marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize:12, color:C.text3, lineHeight:1.8 }}>
                💡 낙찰 시 플랫폼 수수료 안내<br/>
                • 직거래 낙찰 → 견적금액의 <b style={{color:C.text2}}>5%</b><br/>
                • 에스크로(안심결제) 낙찰 → 견적금액의 <b style={{color:C.text2}}>4%</b><br/>
                <span style={{color:C.text4}}>* 의뢰인 부담 없음. 업체 수령액에서 자동 차감</span>
              </div>
            </div>

            <div style={{ display:"flex", gap:S.sm }}>
              <button onClick={() => setShowForm(false)}
                style={{ flex:1, padding:S.xl, background:C.bg, color:C.text2,
                  border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                style={{
                  flex:2, padding:S.xl,
                  background: canSubmit ? C.brand : C.bgWarm,
                  color: canSubmit ? "#fff" : C.text4,
                  border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15,
                  cursor: canSubmit ? "pointer" : "not-allowed",
                  boxShadow: canSubmit ? `0 4px 16px ${C.brand}44` : "none",
                  transition:"all 0.2s"
                }}>
                {submitting ? "제출 중..." : "안심 견적 제출하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
