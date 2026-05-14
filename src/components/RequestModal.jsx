import { useState } from "react";
import { C, R, S, SPACE_TYPES, STYLES } from "../constants";

export default function RequestModal({ onClose, onDone }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ type:"", size:"", budget:"", style:"", desc:"" });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  const iS = { width:"100%", padding:"14px 16px", border:`1.5px solid ${C.bgWarm}`,
    borderRadius:R.md, fontSize:15, outline:"none", boxSizing:"border-box",
    marginBottom:14, fontFamily:"inherit", color:C.text1, background:C.surface };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.6)",
      display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:100 }}>
      <div style={{ background:C.surface, borderRadius:"24px 24px 0 0",
        width:"100%", maxWidth:480, padding:"20px 24px 40px" }}>
        <div style={{ width:36, height:4, borderRadius:R.full, background:C.bgWarm, margin:"0 auto 20px" }} />
        <div style={{ display:"flex", gap:6, marginBottom:S.xxl }}>
          {[1,2,3].map(s => <div key={s} style={{ flex:1, height:4, borderRadius:R.full, background:step>=s?C.brand:C.bgWarm, transition:"background 0.3s" }} />)}
        </div>

        {step===1 && <>
          <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:4 }}>어떤 공간인가요?</div>
          <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>시공할 공간을 선택해주세요</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:S.xl }}>
            {SPACE_TYPES.map(t => (
              <button key={t} onClick={() => set("type",t)}
                style={{ padding:"10px 16px", borderRadius:R.full, fontSize:14, fontWeight:600,
                  border:`1.5px solid ${form.type===t?C.brand:C.bgWarm}`,
                  background:form.type===t?C.brandL:C.surface,
                  color:form.type===t?C.brand:C.text2, cursor:"pointer" }}>{t}</button>
            ))}
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:8 }}>평수</div>
          <input placeholder="예: 32평" value={form.size} onChange={e => set("size",e.target.value)} style={iS} />
          <button onClick={() => form.type&&form.size&&setStep(2)}
            style={{ width:"100%", padding:S.xl, background:form.type&&form.size?C.brand:"#E8E4DC",
              color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16,
              cursor:form.type&&form.size?"pointer":"not-allowed" }}>다음 →</button>
        </>}

        {step===2 && <>
          <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:4 }}>예산과 스타일</div>
          <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>원하는 범위를 알려주세요</div>
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:8 }}>희망 예산</div>
          <input placeholder="예: 2,500~3,000만원" value={form.budget} onChange={e => set("budget",e.target.value)} style={iS} />
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>선호 스타일</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:S.md }}>
            {STYLES.map(s => (
              <button key={s} onClick={() => set("style",s)}
                style={{ padding:"10px 16px", borderRadius:R.full, fontSize:14, fontWeight:600,
                  border:`1.5px solid ${form.style===s?C.brand:C.bgWarm}`,
                  background:form.style===s?C.brandL:C.surface,
                  color:form.style===s?C.brand:C.text2, cursor:"pointer" }}>{s}</button>
            ))}
            <button onClick={() => set("style","기타")}
              style={{ padding:"10px 16px", borderRadius:R.full, fontSize:14, fontWeight:600,
                border:`1.5px solid ${form.style==="기타"||(!STYLES.includes(form.style)&&form.style)?C.brand:C.bgWarm}`,
                background:form.style==="기타"||(!STYLES.includes(form.style)&&form.style)?C.brandL:C.surface,
                color:form.style==="기타"||(!STYLES.includes(form.style)&&form.style)?C.brand:C.text2,
                cursor:"pointer" }}>✏️ 기타</button>
          </div>
          {(form.style==="기타" || (!STYLES.includes(form.style) && form.style)) && (
            <input
              placeholder="예: 빈티지, 한옥 모던, 컬러풀 팝아트..."
              value={STYLES.includes(form.style)||form.style==="기타" ? "" : form.style}
              onChange={e => set("style", e.target.value)}
              autoFocus
              style={{ ...iS, marginBottom:S.xl }}
            />
          )}
          {!(form.style==="기타" || (!STYLES.includes(form.style) && form.style)) && (
            <div style={{ marginBottom:S.xl }} />
          )}
          <div style={{ display:"flex", gap:S.sm }}>
            <button onClick={() => setStep(1)} style={{ flex:0.5, padding:S.xl, background:C.bg, color:C.text2, border:`1.5px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>← 이전</button>
            <button onClick={() => form.budget&&setStep(3)} style={{ flex:1, padding:S.xl, background:form.budget?C.brand:"#E8E4DC", color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:form.budget?"pointer":"not-allowed" }}>다음 →</button>
          </div>
        </>}

        {step===3 && <>
          <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:4 }}>요청 내용</div>
          <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>업체에게 전달할 내용을 입력해주세요</div>
          <textarea placeholder="예) 주방 확장, 욕실 2개 교체, 바닥재 전체 교체 원합니다." value={form.desc}
            onChange={e => set("desc",e.target.value)} rows={4}
            style={{ ...iS, resize:"none", lineHeight:1.7, marginBottom:S.sm }} />
          <div style={{ background:C.surface2, borderRadius:R.md, padding:"10px 14px",
            marginBottom:S.sm, fontSize:12, color:C.text3, lineHeight:1.8 }}>
            💰 에스크로 선택 시 <b style={{color:C.brand}}>이용료 3%</b>가 고객 부담으로 추가됩니다<br/>
            예시: 시공비 3,000만 → 총 예치 3,090만원 (수수료 90만원)
          </div>
          <div style={{ background:C.navyL, borderRadius:R.md, padding:"10px 14px",
            marginBottom:S.xl, fontSize:13, color:C.navy, fontWeight:600,
            display:"flex", gap:8, alignItems:"center" }}>
            <span>🛡</span>
            <span>인근 검증 업체에게만 공개 · 에스크로 안전 정산 적용</span>
          </div>
          <div style={{ display:"flex", gap:S.sm }}>
            <button onClick={() => setStep(2)} style={{ flex:0.5, padding:S.xl, background:C.bg, color:C.text2, border:`1.5px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>← 이전</button>
            <button onClick={() => form.desc&&onDone(form)} style={{ flex:1, padding:S.xl, background:form.desc?C.brand:"#E8E4DC", color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:form.desc?"pointer":"not-allowed" }}>🚀 견적 요청하기</button>
          </div>
        </>}
      </div>
    </div>
  );
}
