import { C, R, S, GRADE, SHADOW } from "../constants";
import { BADGES } from "../constants/badges";
import { TempBadge, CertBadge, LeafSprig } from "./common";

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

export default function CompanyCard({ company, onClick, isLoggedIn = false }) {
  if (!company) return null;
  const g  = GRADE(company.temp ?? 0);
  const bm = company.badge ? (BADGES[company.badge] ?? BADGES.basic) : null;

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
              <TempBadge temp={company.temp} info />
            </div>

            {/* Cert badges */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
              {bm ? (
                <span style={{
                  background: bm.bg, color: bm.color, borderRadius: R.full,
                  padding: "2px 9px", fontSize: 11, fontWeight: 700,
                  display: "inline-flex", alignItems: "center", gap: 3,
                }}>
                  {bm.icon} 공간보증 {bm.label}
                </span>
              ) : (
                <span style={{ background: C.surface2, color: C.text3, borderRadius: R.full, padding: "2px 9px", fontSize: 11, fontWeight: 600 }}>직거래</span>
              )}
              {company.insurance && <CertBadge type="insurance" />}
              {company.bizCert   && <CertBadge type="biz" />}
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
      </div>
    </div>
  );
}
