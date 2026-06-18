import { useState, useEffect, useRef } from "react";
import { C, R, S, SPACE_TYPES, STYLES } from "../constants";

export default function RequestModal({ onClose, onDone, initialData = null, isEdit = false }) {
  const [step, setStep] = useState(1);
  // Android/웹뷰 뒤로가기 처리용 — popstate 핸들러에서 최신 step 참조(stale closure 방지)
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);
  // 뒤로가기로 닫혔는지 표시 — true면 cleanup에서 history 정리 생략(이미 pop됨)
  const closedByBackRef = useRef(false);

  // 모달이 열려 있는 동안에만 적용: 뒤로가기 시 앱/웹뷰 종료·브라우저 이동 대신 모달 단계만 제어.
  useEffect(() => {
    window.history.pushState({ gmRequestModal: true }, "");
    const onPop = () => {
      if (stepRef.current > 1) {
        // 2단계 이상: 이전 단계로 이동하고, 다음 뒤로가기를 위해 트랩 항목을 다시 추가.
        setStep((s) => Math.max(1, s - 1));
        window.history.pushState({ gmRequestModal: true }, "");
      } else {
        // 첫 단계: 모달만 닫기(앱 종료/페이지 이동 없음).
        closedByBackRef.current = true;
        onClose?.();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // X/완료 등 뒤로가기 외 경로로 닫힌 경우, 추가했던 history 트랩 항목 1개를 정리(같은 URL 내 pop).
      if (!closedByBackRef.current) window.history.back();
    };
  }, []);
  const [form, setForm] = useState({
    type:   initialData?.type   ?? "",
    size:   initialData?.size   ?? "",
    budget: initialData?.budget ?? "",
    style:  initialData?.style  ?? "",
    desc:   initialData?.desc   ?? "",
  });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  const iS = { width:"100%", padding:"14px 16px", border:`1.5px solid ${C.bgWarm}`,
    borderRadius:R.lg, fontSize:15, outline:"none", boxSizing:"border-box",
    marginBottom:14, fontFamily:"inherit", color:C.text1, background:C.surface };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.6)",
      display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:100 }}>
      <div style={{ position:"relative", background:C.surface, borderRadius:"24px 24px 0 0",
        width:"100%", maxWidth:480, padding:"20px 24px 40px" }}>
        {/* 우측 상단 닫기(X) — 클릭 시 견적요청 모달만 닫힘(앱 화면 유지) */}
        <button onClick={() => onClose?.()} aria-label="닫기"
          style={{ position:"absolute", top:14, right:16, width:32, height:32, borderRadius:R.full,
            border:"none", background:C.bg, color:C.text2, fontSize:18, lineHeight:1, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", padding:0, zIndex:1 }}>✕</button>
        <div style={{ width:36, height:4, borderRadius:R.full, background:C.bgWarm, margin:"0 auto 20px" }} />
        <div style={{ display:"flex", gap:6, marginBottom:S.xxl }}>
          {[1,2,3].map(s => <div key={s} style={{ flex:1, height:4, borderRadius:R.full, background:step>=s?C.brand:C.bgWarm, transition:"background 0.3s" }} />)}
        </div>

        {step===1 && <>
          <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:4 }}>{isEdit ? "견적 요청 수정" : "어떤 공간인가요?"}</div>
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
            🔒 <b style={{color:C.brand}}>공간안전결제</b> — 토스페이먼츠가 공사대금을 안전하게 보호합니다<br/>
            단계별 안전정산 후 공사 완료 시 최종 지급 · 가상계좌 이용 시 이용료 660원<br/>
            예시: 시공비 3,000만 → 총 예치 3,111만원
          </div>
          <div style={{ background:C.navyL, borderRadius:R.md, padding:"10px 14px",
            marginBottom:S.xl, fontSize:13, color:C.navy, fontWeight:600,
            display:"flex", gap:8, alignItems:"center" }}>
            <span>🛡</span>
            <span>인근 검증 업체에게만 공개 · 에스크로 안전 정산 적용</span>
          </div>
          <div style={{ display:"flex", gap:S.sm }}>
            <button onClick={() => setStep(2)} style={{ flex:0.5, padding:S.xl, background:C.bg, color:C.text2, border:`1.5px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>← 이전</button>
            <button onClick={() => form.desc&&onDone(form)} style={{ flex:1, padding:S.xl, background:form.desc?C.brand:"#E8E4DC", color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:form.desc?"pointer":"not-allowed" }}>{isEdit ? "✅ 수정 완료" : "🚀 견적 요청하기"}</button>
          </div>
          {!isEdit && (
            <div style={{ textAlign:"center", fontSize:12, color:C.text3, marginTop:S.md }}>
              보통 2~4시간 내 연락드립니다.
            </div>
          )}
        </>}
      </div>
    </div>
  );
}
