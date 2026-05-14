import { C, R, S, GRADE } from "../constants";
import { BADGES } from "../constants/badges";
import { TempBadge, CertBadge } from "./common";

export default function CompanyCard({ company, onClick }) {
  if (!company) return null;
  const g = GRADE(company.temp ?? 0);
  return (
    <div onClick={onClick} style={{ background:C.surface, borderRadius:R.xl,
      marginBottom:S.sm, cursor:"pointer",
      border:`1px solid ${C.bgWarm}`,
      boxShadow:"0 1px 6px rgba(28,23,18,0.05)", overflow:"hidden" }}>

      <div style={{ height:3, background:`linear-gradient(90deg,${g.bar},${g.bar}44)` }} />

      <div style={{ padding:S.xl }}>
        <div style={{ display:"flex", gap:S.md, alignItems:"flex-start" }}>
          <div style={{ width:48, height:48, borderRadius:R.lg, flexShrink:0,
            background:C.brandL,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:20, fontWeight:900, color:C.brand, position:"relative" }}>
            {(company.name ?? "?")[0]}
            {company.online && <div style={{ position:"absolute", bottom:-1, right:-1,
              width:12, height:12, borderRadius:"50%", background:C.green, border:"2.5px solid #fff" }} />}
          </div>

          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:5 }}>
              <span style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{company.name}</span>
              <TempBadge temp={company.temp} />
            </div>

            <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:7 }}>
              {company.badge && (() => { const bm = BADGES[company.badge] ?? BADGES.basic; return (
                <span style={{ background:bm.bg, color:bm.color, borderRadius:R.full,
                  padding:"2px 10px", fontSize:11, fontWeight:800,
                  display:"inline-flex", alignItems:"center", gap:3 }}>
                  {bm.icon} 공간보증 {bm.label}
                </span>
              ); })()}
              {!company.badge && (
                <span style={{ background:C.surface2, color:C.text3, borderRadius:R.full,
                  padding:"2px 10px", fontSize:11, fontWeight:600 }}>직거래</span>
              )}
              {company.insurance && <CertBadge type="insurance" />}
              {company.bizCert && <CertBadge type="biz" />}
            </div>

            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:7 }}>
              <span style={{ display:"inline-flex", alignItems:"center", gap:4,
                background:company.online?C.greenL:C.bgWarm,
                color:company.online?C.green:C.text3,
                borderRadius:R.full, padding:"2px 9px", fontSize:11, fontWeight:700 }}>
                <span style={{ width:5, height:5, borderRadius:"50%",
                  background:company.online?C.green:C.text4, display:"inline-block" }} />
                {company.online?`활동중 · ${company.lastActive}`:company.responseTime}
              </span>
              {company.todayBids > 0 && (
                <span style={{ background:C.brandL, color:C.brand,
                  borderRadius:R.full, padding:"2px 9px", fontSize:11, fontWeight:700 }}>
                  오늘 {company.todayBids}건 입찰
                </span>
              )}
            </div>

            <div style={{ display:"flex", gap:S.lg, fontSize:12, color:C.text3 }}>
              <span>⭐ {company.rating}({company.reviews})</span>
              <span>✅ {company.completedJobs}건 완료</span>
              <span>🔄 재계약 {company.recontractRate}%</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop:S.md, background:C.surface2, borderRadius:R.md,
          padding:`${S.sm}px ${S.md}px`, fontSize:13, color:C.text2, lineHeight:1.5 }}>
          📍 {company.distance} · {company.desc}
        </div>
      </div>
    </div>
  );
}
