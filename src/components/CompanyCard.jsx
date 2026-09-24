import { C, R, S, GRADE, SHADOW } from "../constants";
import { TempBadge, LeafSprig } from "./common";
import { CompanyTrustRow } from "./TrustEmblems";

function KpiRow({ isLoggedIn, company }) {
  if (isLoggedIn) {
    const responseText = company.avgResponseHours > 0
      ? (company.avgResponseHours < 1
        ? `${Math.round(company.avgResponseHours * 60)}분`
        : `${company.avgResponseHours}시간`)
      : company.responseTime ?? "—";
    return (
      <div style={{ display:"flex", gap:S.lg, fontSize:12, color:C.text3, flexWrap:"wrap" }}>
        <span>{company.completedJobs}건 완료</span>
        <span>재계약 {company.recontractRate}%</span>
        <span>{company.rating > 0 ? `★ ${company.rating.toFixed(1)}` : "—"}</span>
        <span>{responseText}</span>
      </div>
    );
  }
  const disputeRate = company.disputeRate ?? 0;
  const totalVol    = company.totalTransactionVolume ?? 0;
  return (
    <div style={{ display:"flex", gap:S.lg, fontSize:12, color:C.text3, flexWrap:"wrap" }}>
      <span>{company.completedJobs}건 완료</span>
      <span>{company.rating > 0 ? `★ ${company.rating.toFixed(1)}` : "—"}({company.reviews})</span>
      {totalVol > 0 && <span>{totalVol.toLocaleString()}만원</span>}
      <span>분쟁 {disputeRate}%</span>
    </div>
  );
}

export default function CompanyCard({ company, onClick, isLoggedIn = false, saved = false, onToggleSave }) {
  if (!company) return null;
  const g  = GRADE(company.temp ?? 0);

  return (
    <div onClick={onClick} style={{
      display: "flex", background: C.surface, borderRadius: R.xl,
      marginBottom: S.sm, cursor: "pointer",
      border: `1px solid ${C.bgWarm}`,
      boxShadow: SHADOW.card, overflow: "hidden",
    }}>
      {/* Grade accent */}
      <div style={{ width: 4, background: g.bar, flexShrink: 0 }} />

      <div style={{ position: "relative", flex: 1, padding: S.xl }}>
        <LeafSprig size={64} color={C.brand} opacity={0.05}
          style={{ position: "absolute", right: -8, bottom: -10, transform: "rotate(-12deg)" }} />
        <div style={{ display: "flex", gap: S.md, alignItems: "flex-start" }}>
          {/* Avatar */}
          <div style={{
            width: 46, height: 46, borderRadius: R.lg, flexShrink: 0,
            background: C.brandL,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 800, color: C.brand, position: "relative",
          }}>
            {(company.name ?? "?")[0]}
            {company.online && (
              <div style={{
                position: "absolute", bottom: -1, right: -1,
                width: 11, height: 11, borderRadius: "50%",
                background: C.green, border: "2px solid #fff",
              }} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name + TempBadge */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.text1 }}>{company.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <TempBadge temp={company.temp} info />
                {onToggleSave && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleSave(company); }}
                    aria-label={saved ? "관심 업체 해제" : "관심 업체 저장"}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 0, color: saved ? C.red : C.text4 }}>
                    {saved ? "♥" : "♡"}
                  </button>
                )}
              </div>
            </div>

            {/* Activity status */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: company.online ? C.greenL : C.bgWarm,
                color: company.online ? C.green : C.text3,
                borderRadius: R.full, padding: "2px 9px", fontSize: 11, fontWeight: 600,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: company.online ? C.green : C.text4,
                  display: "inline-block",
                }} />
                {company.online ? `활동중 · ${company.lastActive}` : company.responseTime}
              </span>
              {company.todayBids > 0 && (
                <span style={{ background: C.brandL, color: C.brand, borderRadius: R.full, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>
                  오늘 {company.todayBids}건 입찰
                </span>
              )}
            </div>

            <KpiRow isLoggedIn={isLoggedIn} company={company} />
          </div>
        </div>

        {/* Description */}
        {(company.distance || company.desc) && (
          <div style={{ marginTop: S.sm, fontSize: 12, color: C.text3, lineHeight: 1.55, paddingLeft: 4 }}>
            {company.distance && <span>{company.distance} · </span>}{company.desc}
          </div>
        )}

        {/* 신뢰 — 레벨 + 증빙 셋(사업자·시공보험·보증금). 예전엔 칩 세 줄에 같은 말이 두 번씩 나왔다. */}
        <CompanyTrustRow company={company} style={{ marginTop: S.md }} />
      </div>
    </div>
  );
}
