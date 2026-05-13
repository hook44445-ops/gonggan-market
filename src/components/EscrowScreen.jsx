import { useState } from "react";
import { C, R, S, ESCROW_STEPS, PHOTOS } from "../constants";

export default function EscrowScreen({ onBack, mode }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const total = 2650;
  const isConsumer = mode === "consumer";

  const paid = ESCROW_STEPS.filter(s=>s.done).reduce((a,s)=>a+s.pct,0);
  const progress = paid;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background:C.surface, padding:"14px 20px", borderBottom:`1px solid ${C.bgWarm}`,
        position:"sticky", top:0, zIndex:10, display:"flex", alignItems:"center", gap:S.md }}>
        <button onClick={onBack} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>에스크로 안전 정산</div>
          <div style={{ fontSize:12, color:C.text3 }}>홍익시공 · 마포구 32평</div>
        </div>
        <div style={{ marginLeft:"auto", background:C.navyL, borderRadius:R.full, padding:"4px 12px", fontSize:12, fontWeight:700, color:C.navy }}>🛡 보호중</div>
      </div>

      <div style={{ padding:`${S.xl}px ${S.xl}px 40px` }}>

        <div style={{ background: isConsumer ? C.brandL : C.surface2,
          border: `1px solid ${isConsumer ? C.brandM : C.bgWarm}`,
          borderRadius:R.lg, padding:`${S.sm}px ${S.lg}px`,
          marginBottom:S.lg, display:"flex", alignItems:"center", gap:S.sm }}>
          <span style={{ fontSize:16 }}>{isConsumer ? "👤" : "🏗"}</span>
          <span style={{ fontSize:13, fontWeight:700, color: isConsumer ? C.brand : C.text2 }}>
            {isConsumer
              ? "고객님이 각 단계를 승인하면 업체에 지급됩니다"
              : "고객 승인 후 단계별로 입금됩니다 (조회 전용)"}
          </span>
        </div>

        <div style={{ background:`linear-gradient(135deg,${C.navy},${C.navyM})`,
          borderRadius:R.xl, padding:S.xxl, marginBottom:S.xl, color:"#fff" }}>
          <div style={{ fontSize:12, opacity:0.7, marginBottom:6 }}>총 계약 금액 (공간마켓 보관중)</div>
          <div style={{ fontSize:32, fontWeight:900, marginBottom:4 }}>{total.toLocaleString()}만원</div>
          <div style={{ fontSize:13, opacity:0.75, marginBottom:S.xl }}>고객 예치 완료 · 단계별로 업체에 지급됩니다</div>
          <div style={{ background:"rgba(255,255,255,0.15)", borderRadius:R.full, height:8, marginBottom:6 }}>
            <div style={{ width:`${progress}%`, height:"100%", background:C.brand,
              borderRadius:R.full, transition:"width 0.6s ease",
              boxShadow:`0 0 8px ${C.brand}88` }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, opacity:0.7 }}>
            <span>업체 지급 완료 {progress}%</span>
            <span>보관 중 {Math.round(total*(100-progress)/100).toLocaleString()}만원</span>
          </div>
        </div>

        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
          marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
          <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:S.xl }}>정산 단계</div>
          {ESCROW_STEPS.map((s, i) => (
            <div key={s.id} style={{ display:"flex", gap:S.md, marginBottom: i<ESCROW_STEPS.length-1?S.xl:0 }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                <div style={{ width:40, height:40, borderRadius:R.full,
                  background: s.done ? C.green : s.active ? C.brand : C.bgWarm,
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:18,
                  boxShadow: s.active ? `0 0 0 4px ${C.brand}33` : "none",
                  border: s.active ? `2px solid ${C.brand}` : "none" }}>
                  {s.done ? "✓" : s.icon}
                </div>
                {i < ESCROW_STEPS.length-1 && (
                  <div style={{ width:2, flex:1, minHeight:20, marginTop:4,
                    background: s.done ? C.green : C.bgWarm }} />
                )}
              </div>
              <div style={{ flex:1, paddingTop:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                  <div style={{ fontSize:14, fontWeight:800,
                    color: s.done ? C.green : s.active ? C.brand : C.text3 }}>{s.label}</div>
                  {s.pct > 0 && (
                    <div style={{ fontSize:13, fontWeight:700,
                      color: s.done ? C.green : s.active ? C.brand : C.text4 }}>
                      {Math.round(total*s.pct/100).toLocaleString()}만원
                      {!isConsumer && (
                        <span style={{ fontSize:11, marginLeft:4,
                          color: s.done ? C.green : s.active ? C.brand : C.text4 }}>
                          {s.done ? " ✓입금" : s.active ? " ⏳대기" : " 미지급"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ fontSize:12, color:C.text3, lineHeight:1.5, marginBottom: s.active?S.md:0 }}>{s.sub}</div>

                {s.active && isConsumer && !confirmed && (
                  <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, border:`1px solid ${C.brandM}` }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.brand, marginBottom:S.sm }}>
                      📸 중간 점검 사진을 확인하고 승인해주세요
                    </div>
                    <div style={{ display:"flex", gap:S.sm, marginBottom:S.md }}>
                      {[PHOTOS.apt_after1, PHOTOS.apt_after2].map((p,pi) => (
                        <div key={pi} style={{ flex:1, height:80, borderRadius:R.md, overflow:"hidden",
                          border:`1px solid ${C.brandM}` }}>
                          <img src={p} style={{ width:"100%", height:"100%", objectFit:"cover" }}
                            onError={e=>e.target.style.background=C.bgWarm} />
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize:11, color:C.text3, marginBottom:S.sm }}>
                      ⏰ 72시간 내 미확인 시 자동 승인됩니다
                    </div>
                    <div style={{ display:"flex", gap:S.sm }}>
                      <button style={{ flex:1, padding:"10px", background:C.surface,
                        color:C.red, border:`1px solid ${C.red}33`, borderRadius:R.lg,
                        fontWeight:700, fontSize:13, cursor:"pointer" }}>
                        ⚠️ 이의 신청
                      </button>
                      <button onClick={() => setShowConfirm(true)}
                        style={{ flex:2, padding:"10px", background:C.brand, color:"#fff",
                          border:"none", borderRadius:R.lg, fontWeight:800, fontSize:13, cursor:"pointer",
                          boxShadow:`0 4px 14px ${C.brand}44` }}>
                        ✅ 확인 · 중도금 승인
                      </button>
                    </div>
                  </div>
                )}

                {s.active && !isConsumer && !confirmed && (
                  <div style={{ background:C.surface2, borderRadius:R.lg, padding:S.lg, border:`1px solid ${C.bgWarm}` }}>
                    <div style={{ fontSize:13, fontWeight:700, color:C.text1, marginBottom:S.sm }}>
                      📸 중간 점검 사진 업로드
                    </div>
                    <div style={{ fontSize:12, color:C.text3, lineHeight:1.6, marginBottom:S.md }}>
                      고객이 사진을 확인하면 중도금 40% 지급 승인이 진행됩니다.
                    </div>
                    <button style={{ width:"100%", padding:"12px", background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14, cursor:"pointer" }}>
                      사진 업로드하기
                    </button>
                  </div>
                )}

                {s.active && confirmed && (
                  <div style={{ background:C.greenL, borderRadius:R.lg, padding:S.md, display:"flex", alignItems:"center", gap:S.sm }}>
                    <span style={{ fontSize:16 }}>✅</span>
                    <span style={{ fontSize:13, color:C.green, fontWeight:700 }}>
                      {isConsumer ? "승인 완료 · 중도금 지급됨" : "중도금 입금 완료"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ background:C.navyL, borderRadius:R.xl, padding:S.xl, border:`1px solid ${C.trustM}`, display:"flex", gap:S.md, alignItems:"flex-start", marginBottom:S.lg }}>
          <div style={{ fontSize:24, flexShrink:0 }}>🛡</div>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:C.navy, marginBottom:4 }}>하자보수 보증 안내</div>
            <div style={{ fontSize:12, color:C.text3, lineHeight:1.7 }}>완료 확인 후 <b style={{color:C.navy}}>1년간 무상 AS</b> 보장</div>
          </div>
        </div>

        <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl, border:`1px solid ${C.bgWarm}` }}>
          <div style={{ fontSize:14, fontWeight:800, color:C.text1, marginBottom:S.md }}>🏦 예치금 보관 안내</div>
          {[["보관","공간마켓 법인 신탁 계좌"],["환급","탈퇴 7일 내 전액"],["분쟁","중재 후 판정 지급"],["향후","은행 신탁 연계 예정"]].map(([k,v]) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:`${S.xs}px 0`, borderBottom:`1px solid ${C.bgWarm}` }}>
              <span style={{ fontSize:12, color:C.text3 }}>{k}</span>
              <span style={{ fontSize:12, fontWeight:700, color:C.text1 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {showConfirm && isConsumer && (
        <div style={{ position:"fixed", inset:0, background:"rgba(28,23,18,0.6)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:300 }}>
          <div style={{ background:C.surface, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:480, padding:"24px 24px 40px" }}>
            <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />
            <div style={{ textAlign:"center", marginBottom:S.xxl }}>
              <div style={{ fontSize:44, marginBottom:10 }}>💸</div>
              <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:6 }}>업체에게 중도금을 지급할까요?</div>
              <div style={{ fontSize:13, color:C.text3, lineHeight:1.6 }}>공간마켓이 보관 중인 금액에서<br/><b style={{color:C.text1}}>{Math.round(total*0.4).toLocaleString()}만원</b>을 업체에 지급합니다</div>
            </div>
            <div style={{ background:C.surface2, borderRadius:R.lg, padding:S.lg, marginBottom:S.xl }}>
              {[["선금 (30%)", Math.round(total*0.3).toLocaleString()+"만원", true],["중도금 (40%)", Math.round(total*0.4).toLocaleString()+"만원", false],["잔금 (30%)", Math.round(total*0.3).toLocaleString()+"만원", false]].map(([l,v,isPaid],i) => (
                <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:`${S.sm}px 0`, borderBottom:i<2?`1px solid ${C.bgWarm}`:"none" }}>
                  <span style={{ fontSize:13, color:isPaid?C.text3:C.text2, fontWeight:600 }}>{l}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:isPaid?C.text4:C.text1, textDecoration:isPaid?"line-through":"none" }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", gap:S.sm }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex:1, padding:S.xl, background:C.bg, color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>취소</button>
              <button onClick={() => { setShowConfirm(false); setConfirmed(true); }} style={{ flex:2, padding:S.xl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer", boxShadow:`0 4px 16px ${C.brand}44` }}>✅ 승인하고 지급</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
