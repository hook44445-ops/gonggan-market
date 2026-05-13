import { useState } from "react";
import { C, R, S, REGIONS, fmtPhone } from "../constants";
import CompanyOnboarding from "./CompanyOnboarding";

export default function LoginScreen({ onLogin, startAtOnboarding }) {
  const [step, setStep] = useState(startAtOnboarding ? 3 : 1);
  const [role, setRole] = useState(startAtOnboarding ? "company" : null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ name:"", region:"마포구", bizNumber:"", bizName:"", bizVerified:false });
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  const iS = { width:"100%", padding:"14px 16px", border:`1.5px solid ${C.bgWarm}`,
    borderRadius:R.md, fontSize:15, outline:"none", boxSizing:"border-box",
    marginBottom:14, fontFamily:"inherit", color:C.text1, background:C.surface };

  const sendCode = () => {
    if(phone.replace(/-/g,"").length<10) return setMsg("올바른 전화번호를 입력해주세요");
    setLoading(true);
    setTimeout(() => { setCodeSent(true); setMsg("✅ 인증번호 발송! (데모: 000000)"); setLoading(false); }, 800);
  };
  const verifyCode = () => {
    if(code.length<4) return setMsg("인증번호를 입력해주세요");
    setLoading(true);
    setTimeout(() => { setStep(4); setMsg(""); setLoading(false); }, 600);
  };
  const save = () => {
    if(!form.name) return setMsg("이름을 입력해주세요");
    if(role==="company"&&!form.bizVerified) return setMsg("사업자번호 인증이 필요합니다");
    onLogin({ name:form.name, role, region:form.region, phone });
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      padding:"24px 20px", fontFamily:"'Apple SD Gothic Neo',sans-serif" }}>

      {step===1 && (
        <div style={{ width:"100%", maxWidth:390 }}>
          <div style={{ textAlign:"center", marginBottom:36 }}>
            <div style={{ width:68, height:68, borderRadius:R.xl, margin:"0 auto 14px",
              background:`linear-gradient(135deg,${C.brand},${C.brandD})`,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:32,
              boxShadow:`0 8px 24px ${C.brand}44` }}>🏠</div>
            <div style={{ fontSize:28, fontWeight:900, color:C.text1, letterSpacing:"-0.5px" }}>공간마켓</div>
            <div style={{ fontSize:14, color:C.text3, marginTop:6 }}>
              우리 동네 믿을 수 있는 시공 업체
            </div>
          </div>

          <div style={{ display:"flex", gap:S.sm, marginBottom:S.xxl }}>
            {[["🔍","간편 견적"],["🏆","검증 업체"],["🛡","안전 정산"]].map(([icon,label]) => (
              <div key={label} style={{ flex:1, background:C.surface, borderRadius:R.lg,
                padding:`${S.lg}px ${S.sm}px`, textAlign:"center",
                border:`1px solid ${C.bgWarm}` }}>
                <div style={{ fontSize:22, marginBottom:5 }}>{icon}</div>
                <div style={{ fontSize:12, color:C.text2, fontWeight:700 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <button onClick={() => { setRole("consumer"); setStep(2); }}
              style={{ background:C.surface, border:`1.5px solid ${C.bgWarm}`, borderRadius:R.xl,
                padding:"18px 20px", display:"flex", alignItems:"center", gap:14,
                cursor:"pointer", boxShadow:"0 2px 12px rgba(28,23,18,0.08)", textAlign:"left" }}>
              <div style={{ width:48, height:48, borderRadius:R.lg, flexShrink:0,
                background:C.brandL, border:`1.5px solid ${C.brandM}`,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>🏡</div>
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:2 }}>견적 받기</div>
                <div style={{ fontSize:13, color:C.text3 }}>시공 업체 찾고 있어요</div>
              </div>
              <div style={{ marginLeft:"auto", color:C.brand, fontSize:20 }}>›</div>
            </button>

            <button onClick={() => onLogin({ name:"둘러보기", role:"company", region:"마포구", phone:"", isGuest:true })}
              style={{ background:C.surface, border:`1.5px solid ${C.bgWarm}`, borderRadius:R.xl,
                padding:"18px 20px", display:"flex", alignItems:"center", gap:14,
                cursor:"pointer", boxShadow:"0 2px 12px rgba(28,23,18,0.08)", textAlign:"left" }}>
              <div style={{ width:48, height:48, borderRadius:R.lg, flexShrink:0,
                background:C.surface2, border:`1.5px solid ${C.bgWarm}`,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>🔨</div>
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:2 }}>업체로 둘러보기</div>
                <div style={{ fontSize:13, color:C.text3 }}>일감 먼저 확인해보세요</div>
              </div>
              <div style={{ marginLeft:"auto", color:C.brand, fontSize:20 }}>›</div>
            </button>
          </div>
        </div>
      )}

      {step===2 && (
        <div style={{ width:"100%", maxWidth:390 }}>
          <button onClick={() => setStep(1)} style={{ background:"none", border:"none", fontSize:14, cursor:"pointer", color:C.text3, marginBottom:24, fontWeight:600 }}>← 뒤로</button>
          <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>{role==="consumer"?"견적 의뢰인":"업체"} 로그인</div>
          <div style={{ fontSize:13, color:C.text3, marginBottom:S.xxl }}>원하는 방식으로 시작하세요</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <button onClick={() => setStep(3)} style={{ background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, padding:"16px 20px", fontWeight:800, fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", gap:14 }}>
              <span style={{ fontSize:22 }}>📱</span>
              <div style={{ textAlign:"left" }}>
                <div>전화번호로 시작</div>
                <div style={{ fontSize:12, opacity:0.8, fontWeight:500, marginTop:1 }}>문자 인증 · 가장 빠른 방법</div>
              </div>
            </button>
            <div style={{ display:"flex", alignItems:"center", gap:10, margin:"4px 0" }}>
              <div style={{ flex:1, height:1, background:C.bgWarm }} />
              <div style={{ fontSize:12, color:C.text4 }}>소셜 계정</div>
              <div style={{ flex:1, height:1, background:C.bgWarm }} />
            </div>
            {[{ bg:"#FEE500",color:"#191919",icon:"💬",t:"카카오로 시작하기" },
              { bg:"#03C75A",color:"#fff",   icon:"N", t:"네이버로 시작하기" }].map(b => (
              <button key={b.t} onClick={() => setStep(3)} style={{ background:b.bg, color:b.color, border:"none", borderRadius:R.lg, padding:"15px 20px", fontWeight:800, fontSize:15, cursor:"pointer", display:"flex", alignItems:"center", gap:14 }}>
                <span style={{ fontSize:b.icon==="N"?15:22, background:b.icon==="N"?b.color:"transparent", color:b.icon==="N"?b.bg:"inherit", borderRadius:4, padding:b.icon==="N"?"1px 5px":"0", fontWeight:900 }}>{b.icon}</span>
                {b.t}
              </button>
            ))}
          </div>
        </div>
      )}

      {step===3 && (
        <div style={{ width:"100%", maxWidth:390 }}>
          <button onClick={() => { setStep(2); setCodeSent(false); setCode(""); setMsg(""); }} style={{ background:"none", border:"none", fontSize:14, cursor:"pointer", color:C.text3, marginBottom:24, fontWeight:600 }}>← 뒤로</button>
          <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>전화번호 인증</div>
          <div style={{ fontSize:13, color:C.text3, marginBottom:S.xxl }}>가입된 계정이 없으면 자동으로 가입됩니다</div>
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:8 }}>전화번호</div>
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            <input value={phone} onChange={e => setPhone(fmtPhone(e.target.value))} placeholder="010-0000-0000" maxLength={13} style={{ ...iS, flex:1, marginBottom:0 }} />
            <button onClick={sendCode} disabled={loading} style={{ padding:"14px 16px", background:C.brand, color:"#fff", border:"none", borderRadius:R.md, fontWeight:800, fontSize:13, cursor:"pointer", whiteSpace:"nowrap" }}>{codeSent?"재발송":"인증받기"}</button>
          </div>
          {codeSent && <>
            <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:8 }}>인증번호</div>
            <div style={{ display:"flex", gap:8, marginBottom:14 }}>
              <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000" maxLength={6} style={{ ...iS, flex:1, marginBottom:0, letterSpacing:8, fontSize:22, fontWeight:800, textAlign:"center" }} />
              <button onClick={verifyCode} disabled={loading} style={{ padding:"14px 16px", background:C.brand, color:"#fff", border:"none", borderRadius:R.md, fontWeight:800, fontSize:13, cursor:"pointer" }}>확인</button>
            </div>
          </>}
          {msg && <div style={{ padding:"12px 16px", borderRadius:R.md, marginBottom:14, background:msg.startsWith("✅")?"#E6F7F0":"#FFF0F0", color:msg.startsWith("✅")?C.green:C.red, fontSize:13, fontWeight:600 }}>{msg}</div>}
          {!codeSent && <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, fontSize:13, color:C.text2, lineHeight:1.8 }}>
            📱 입력한 번호로 인증문자가 발송됩니다<br/>🔒 번호는 인증 외 목적으로 사용되지 않습니다
          </div>}
        </div>
      )}

      {step===4 && role==="company" && (
        <CompanyOnboarding phone={phone} onDone={u => onLogin(u)} />
      )}

      {step===4 && role==="consumer" && (
        <div style={{ width:"100%", maxWidth:390 }}>
          <div style={{ fontSize:20, fontWeight:800, color:C.text1, marginBottom:4 }}>👋 반갑습니다!</div>
          <div style={{ fontSize:13, color:C.text3, marginBottom:S.xxl }}>기본 정보만 입력해주세요</div>
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:8 }}>이름</div>
          <input value={form.name} onChange={e => set("name",e.target.value)} placeholder="홍길동" style={iS} />
          <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>활동 지역</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:S.xl }}>
            {REGIONS.map(r => (
              <button key={r} onClick={() => set("region",r)} style={{ padding:"8px 16px", borderRadius:R.full, fontSize:14, fontWeight:600, border:`1.5px solid ${form.region===r?C.brand:C.bgWarm}`, background:form.region===r?C.brandL:C.surface, color:form.region===r?C.brand:C.text2, cursor:"pointer" }}>{r}</button>
            ))}
          </div>
          {msg && <div style={{ padding:"12px 16px", borderRadius:R.md, marginBottom:14, background:msg.startsWith("✅")?"#E6F7F0":"#FFF0F0", color:msg.startsWith("✅")?C.green:C.red, fontSize:13, fontWeight:600 }}>{msg}</div>}
          <button onClick={save} style={{ width:"100%", padding:S.xl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16, cursor:"pointer", boxShadow:`0 6px 20px ${C.brand}44` }}>공간마켓 시작하기 🚀</button>
        </div>
      )}
    </div>
  );
}
