import { useState } from "react";
import { C, R, S } from "../constants";
import { ACTIVE_JOBS } from "../mock/mockCompanies";
import { TempBadge } from "../components/common";
import BidCard from "../components/BidCard";

export default function DashboardScreen({ onBack, onEscrow, allRequests: allRequestsProp, currentUser, submittedBids }) {
  const allRequests = allRequestsProp ?? [];
  const [tab, setTab] = useState("active");
  const thisMonthRevenue = 2190;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background:C.surface, padding:"14px 20px 0", borderBottom:`1px solid ${C.bgWarm}`,
        position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:S.md, marginBottom:14 }}>
          <button onClick={onBack} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
          <div style={{ fontSize:17, fontWeight:800, color:C.text1 }}>업체 대시보드</div>
          <div style={{ marginLeft:"auto" }}>
            <TempBadge temp={97} />
          </div>
        </div>
        <div style={{ display:"flex" }}>
          {[["active","진행중"],["bids","입찰"],["stats","통계"]].map(([v,l]) => (
            <button key={v} onClick={() => setTab(v)}
              style={{ flex:1, padding:"10px 0", border:"none", background:"transparent",
                fontWeight:tab===v?800:500, fontSize:14,
                color:tab===v?C.brand:C.text3,
                borderBottom:`2.5px solid ${tab===v?C.brand:"transparent"}`,
                cursor:"pointer" }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>

        {tab==="active" && (
          <div>
            <div style={{ background:`linear-gradient(135deg,${C.brand},${C.brandD})`,
              borderRadius:R.xl, padding:S.xxl, marginBottom:S.xl, color:"#fff" }}>
              <div style={{ fontSize:12, opacity:0.75, marginBottom:4 }}>이번 달 정산 수익</div>
              <div style={{ fontSize:30, fontWeight:900, marginBottom:4 }}>{thisMonthRevenue.toLocaleString()}만원</div>
              <div style={{ fontSize:13, opacity:0.75 }}>진행중 {ACTIVE_JOBS.length}건 · 완료 대기 {Math.round(ACTIVE_JOBS.reduce((a,j)=>a+j.total*(100-j.paid)/100,0)).toLocaleString()}만원</div>
            </div>

            {ACTIVE_JOBS.map(job => (
              <div key={job.id} onClick={() => onEscrow()}
                style={{ background:C.surface, borderRadius:R.xl, overflow:"hidden",
                  marginBottom:S.md, border:`1px solid ${C.bgWarm}`,
                  boxShadow:"0 2px 8px rgba(28,23,18,0.06)", cursor:"pointer" }}>
                <div style={{ height:3, background:job.statusColor }} />
                <div style={{ padding:S.xl }}>
                  <div style={{ display:"flex", gap:S.md, alignItems:"flex-start" }}>
                    <div style={{ width:56, height:56, borderRadius:R.md, overflow:"hidden", flexShrink:0 }}>
                      <img src={job.img} style={{ width:"100%", height:"100%", objectFit:"cover" }}
                        onError={e=>e.target.style.background=C.bgWarm} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:3 }}>
                        <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{job.client}</div>
                        <span style={{ background:`${job.statusColor}18`, color:job.statusColor,
                          borderRadius:R.full, padding:"2px 10px", fontSize:11, fontWeight:700 }}>
                          {job.status}
                        </span>
                      </div>
                      <div style={{ fontSize:12, color:C.text3, marginBottom:S.sm }}>📍 {job.area} · {job.type}</div>
                      <div style={{ marginBottom:6 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.text3, marginBottom:4 }}>
                          <span>에스크로 {job.paid}% 지급됨</span>
                          <span>D-{job.dDay}</span>
                        </div>
                        <div style={{ background:C.bgWarm, borderRadius:R.full, height:5, overflow:"hidden" }}>
                          <div style={{ width:`${job.paid}%`, height:"100%",
                            background:job.statusColor, borderRadius:R.full }} />
                        </div>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div style={{ fontSize:13, fontWeight:700, color:C.text1 }}>{job.total.toLocaleString()}만원</div>
                        <div style={{ fontSize:12, color:C.brand, fontWeight:700 }}>에스크로 상세 →</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==="bids" && (
          <div>
            <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>
              오늘 새로운 견적 요청 <b style={{color:C.brand}}>{allRequests.length}건</b>
            </div>
            {allRequests.map(r => <BidCard key={r.id} r={r} currentUser={currentUser} />)}
          </div>
        )}

        {tab==="stats" && (
          <div>
            <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
              marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.xl }}>
                <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>🌡 공간온도</div>
                <TempBadge temp={97} lg />
              </div>
              {[["완료 건수","156건","✅"],["재계약률","68%","🔄"],["AS 처리율","98%","🛠"],["평균 별점","4.9점","⭐"]].map(([label,val,icon]) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"center", padding:`${S.sm}px 0`,
                  borderBottom:`1px solid ${C.bgWarm}` }}>
                  <span style={{ fontSize:13, color:C.text3 }}>{icon} {label}</span>
                  <span style={{ fontSize:14, fontWeight:800, color:C.text1 }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
              marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:S.md }}>💸 수수료 구조 안내</div>
              {[
                ["에스크로 이용료", "고객 3%", "고객 예치금에 포함"],
                ["플랫폼 수수료",   "업체 4%", "정산 시 자동 차감"],
                ["보증금 비율",     "보험 미가입 30%", "보험 가입 시 20%"],
              ].map(([label, val, sub]) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"center", padding:`${S.sm}px 0`,
                  borderBottom:`1px solid ${C.bgWarm}` }}>
                  <div>
                    <div style={{ fontSize:13, color:C.text2, fontWeight:600 }}>{label}</div>
                    <div style={{ fontSize:11, color:C.text4 }}>{sub}</div>
                  </div>
                  <span style={{ fontSize:13, fontWeight:800, color:C.brand }}>{val}</span>
                </div>
              ))}
              <div style={{ marginTop:S.md, background:C.brandL, borderRadius:R.md,
                padding:`${S.sm}px ${S.md}px`, fontSize:12, color:C.brand, fontWeight:700 }}>
                💡 이번 달 수수료 추산: {Math.round(thisMonthRevenue * 0.04).toLocaleString()}만원 차감
              </div>
            </div>

            <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
              marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:S.xl }}>월별 정산 수익</div>
              {[["1월",1200],["2월",980],["3월",1650],["4월",2190],["5월",0]].map(([month,val]) => {
                const max = 2190;
                return (
                  <div key={month} style={{ display:"flex", alignItems:"center", gap:S.md, marginBottom:S.md }}>
                    <div style={{ fontSize:12, color:C.text3, width:24, flexShrink:0 }}>{month}</div>
                    <div style={{ flex:1, background:C.bgWarm, borderRadius:R.full, height:10, overflow:"hidden" }}>
                      <div style={{ width:`${val/max*100}%`, height:"100%",
                        background: val===max ? C.brand : C.brandM,
                        borderRadius:R.full, transition:"width 0.5s ease" }} />
                    </div>
                    <div style={{ fontSize:12, fontWeight:700, color:val===max?C.brand:C.text2, width:52, textAlign:"right" }}>
                      {val>0?`${val}만`:"—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
