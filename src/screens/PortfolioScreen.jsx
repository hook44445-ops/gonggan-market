import { useState } from "react";
import { C, R, S, GRADE } from "../constants";
import { TempBadge, CertBadge } from "../components/common";
import PortfolioCard from "../components/PortfolioCard";
import PhotoModal from "../components/PhotoModal";

export default function PortfolioScreen({ company, onChat, onReview, onBack, onEscrow }) {
  const g = GRADE(company?.temp ?? 0);
  const [photoWork, setPhotoWork] = useState(null);

  if (!company) return null;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background:C.surface, padding:"14px 20px", borderBottom:`1px solid ${C.bgWarm}`,
        position:"sticky", top:0, zIndex:10, display:"flex", alignItems:"center", gap:S.md }}>
        <button onClick={onBack} style={{ background:"none", border:"none",
          fontSize:22, cursor:"pointer", color:C.text1, padding:0, lineHeight:1 }}>←</button>
        <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{company.name}</div>
        <TempBadge temp={company.temp} />
      </div>

      <div style={{ padding:`${S.xl}px ${S.xl}px 100px` }}>

        <div style={{ background:C.surface, borderRadius:R.xl, overflow:"hidden",
          marginBottom:S.lg, border:`1px solid ${C.bgWarm}`,
          boxShadow:"0 2px 12px rgba(28,23,18,0.07)" }}>
          <div style={{ height:4, background:`linear-gradient(90deg,${g.bar},${g.bar}33)` }} />
          <div style={{ padding:S.xl }}>
            <div style={{ display:"flex", gap:S.lg, alignItems:"flex-start", marginBottom:S.lg }}>
              <div style={{ width:64, height:64, borderRadius:R.lg, flexShrink:0,
                background:C.brandL,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:26, fontWeight:900, color:C.brand }}>{company.name[0]}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:20, fontWeight:900, color:C.text1, marginBottom:8 }}>{company.name}</div>
                <TempBadge temp={company.temp} lg />
              </div>
            </div>

            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:S.lg }}>
              {company.platformCert && <CertBadge type="platform" />}
              {company.insurance && <CertBadge type="insurance" />}
              {company.bizCert && <CertBadge type="biz" />}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:S.sm, marginBottom:S.lg }}>
              {[["✅","완료 건수",`${company.completedJobs}건`],
                ["🔄","재계약률",`${company.recontractRate}%`],
                ["🛠","AS 처리율",`${company.asRate}%`]].map(([icon,label,val]) => (
                <div key={label} style={{ background:C.surface2, borderRadius:R.lg,
                  padding:`${S.md}px ${S.sm}px`, textAlign:"center",
                  border:`1px solid ${C.bgWarm}` }}>
                  <div style={{ fontSize:11, color:C.text3, marginBottom:3 }}>{icon} {label}</div>
                  <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{val}</div>
                </div>
              ))}
            </div>

            <div style={{ background:company.online?C.greenL:C.bgWarm, borderRadius:R.lg,
              padding:`${S.sm}px ${S.lg}px`, marginBottom:S.lg,
              display:"flex", alignItems:"center", gap:S.sm }}>
              <div style={{ width:8, height:8, borderRadius:"50%",
                background:company.online?C.green:C.text4,
                boxShadow:company.online?`0 0 0 3px ${C.green}33`:"none" }} />
              <span style={{ fontSize:13, fontWeight:700, color:company.online?C.green:C.text3 }}>
                {company.online?`지금 활동중 · ${company.lastActive}` : `마지막 활동: ${company.lastActive}`}
              </span>
              <span style={{ fontSize:12, color:C.text3, marginLeft:"auto" }}>{company.responseTime}</span>
            </div>

            <div style={{ background:C.navyL, borderRadius:R.lg,
              padding:`${S.md}px ${S.lg}px`, border:`1px solid ${C.trustM}`,
              display:"flex", gap:S.md, alignItems:"center" }}>
              <div style={{ fontSize:24, flexShrink:0 }}>🛡</div>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:C.navy, marginBottom:2 }}>
                  에스크로 안전 정산
                </div>
                <div style={{ fontSize:12, color:C.text3, lineHeight:1.5 }}>
                  선금 30% → 중간 점검 후 40% → 완료 확인 후 30%
                </div>
              </div>
            </div>
          </div>
        </div>

        <button onClick={onReview} style={{ width:"100%", background:C.surface,
          border:`1px solid ${C.bgWarm}`, borderRadius:R.xl, padding:S.xl,
          marginBottom:S.lg, cursor:"pointer",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          boxShadow:"0 1px 6px rgba(28,23,18,0.05)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:S.md }}>
            <div style={{ width:44, height:44, borderRadius:R.lg, background:"#FBF5E8",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>⭐</div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontSize:15, fontWeight:700, color:C.text1 }}>
                시공 후기 {(company.reviewList ?? []).length}개
              </div>
              <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>
                {(company.reviewList ?? []).length > 0
                  ? `평균 ${((company.reviewList ?? []).reduce((s,r) => s+r.rating,0)/(company.reviewList ?? []).length).toFixed(1)}점 · 탭해서 보기`
                  : "첫 후기를 남겨주세요"}
              </div>
            </div>
          </div>
          <span style={{ color:C.text4, fontSize:20 }}>›</span>
        </button>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.md }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>
            시공 포트폴리오
            <span style={{ fontSize:13, fontWeight:500, color:C.text3, marginLeft:6 }}>
              {(company.portfolio ?? []).length}건
            </span>
          </div>
        </div>
        {(company.portfolio ?? []).map(work => (
          <PortfolioCard key={work.id} work={work} onExpand={setPhotoWork} />
        ))}

        <button onClick={() => onChat(company)}
          style={{ width:"100%", padding:S.xl, background:C.brand, color:"#fff",
            border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16,
            cursor:"pointer", marginTop:S.sm,
            boxShadow:`0 6px 20px ${C.brand}44` }}>
          💬 {company.name} 견적 문의하기
        </button>
        <button onClick={() => onEscrow && onEscrow()}
          style={{ width:"100%", padding:S.lg, background:C.navyL, color:C.navy,
            border:`1px solid ${C.trustM}`, borderRadius:R.lg, fontWeight:700, fontSize:14,
            cursor:"pointer", marginTop:S.sm }}>
          🛡 에스크로 정산 현황 보기
        </button>
      </div>

      {photoWork && <PhotoModal work={photoWork} onClose={() => setPhotoWork(null)} />}
    </div>
  );
}
