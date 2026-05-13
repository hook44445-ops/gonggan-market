import { useState, useRef, useEffect } from "react";
import { C, R, S } from "../constants";
import { TempBadge } from "../components/common";

export default function ChatScreen({ company, onBack, messages, onUpdateMessages }) {
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);
  const REPLIES = [
    "현장 방문 실측 후 정확한 견적 드릴게요. 에스크로 안전거래로 진행됩니다 🛡",
    "해당 범위 많이 해본 작업이에요. 중간 점검 사진은 매번 공유해드립니다.",
    "무료 실측 상담 가능합니다. 편하신 날짜 알려주세요 📅",
    "계약서에 자재 브랜드·수량 전부 명시하고 추가 비용 없이 진행합니다.",
  ];
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, typing]);

  const send = () => {
    if(!input.trim()) return;
    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2,"0")}`;
    const userMsg = { from:"user", text:input, time };
    const updated = [...messages, userMsg];
    onUpdateMessages(updated);
    setInput(""); setTyping(true);
    setTimeout(() => {
      const reply = { from:"company", text:REPLIES[Math.floor(Math.random()*REPLIES.length)], time };
      onUpdateMessages([...updated, reply]);
      setTyping(false);
    }, 1200);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", fontFamily:"'Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.bgWarm}`, padding:"12px 16px",
        display:"flex", alignItems:"center", gap:S.md, position:"sticky", top:0, zIndex:10 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
        <div style={{ width:40, height:40, borderRadius:R.full, flexShrink:0,
          background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:18, fontWeight:900, color:C.brand, position:"relative" }}>
          {company.name[0]}
          {company.online && <div style={{ position:"absolute", bottom:0, right:0, width:10, height:10, borderRadius:"50%", background:C.green, border:"2px solid #fff" }} />}
        </div>
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{company.name}</div>
          <div style={{ fontSize:11, color:company.online?C.green:C.text3, fontWeight:600 }}>
            {company.online?`활동중 · ${company.lastActive}`:company.responseTime}
          </div>
        </div>
        <div style={{ marginLeft:"auto" }}><TempBadge temp={company.temp} /></div>
      </div>

      <div style={{ background:C.navyL, padding:"8px 16px", borderBottom:`1px solid ${C.trustM}`,
        display:"flex", gap:S.sm, alignItems:"center" }}>
        <span>🛡</span>
        <span style={{ fontSize:12, color:C.navy, fontWeight:600 }}>에스크로 안전 정산이 적용되는 채팅입니다</span>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:S.xl, background:C.bg }}>
        {messages.length===0 && <div style={{ textAlign:"center", fontSize:13, color:C.text3, marginTop:60 }}>첫 메시지를 보내보세요!</div>}
        {messages.map((msg,i) => (
          <div key={i} style={{ display:"flex", justifyContent:msg.from==="user"?"flex-end":"flex-start",
            marginBottom:S.md, alignItems:"flex-end", gap:6 }}>
            {msg.from==="company" && (
              <div style={{ width:32, height:32, borderRadius:R.full, background:C.brandL,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:13, fontWeight:900, color:C.brand, flexShrink:0 }}>{company.name[0]}</div>
            )}
            <div>
              <div style={{ background:msg.from==="user"?C.brand:C.surface,
                color:msg.from==="user"?"#fff":C.text1,
                borderRadius:msg.from==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",
                padding:"11px 15px", maxWidth:240, fontSize:14, lineHeight:1.6,
                boxShadow:"0 1px 4px rgba(28,23,18,0.08)" }}>{msg.text}</div>
              <div style={{ fontSize:10, color:C.text4, marginTop:3, textAlign:msg.from==="user"?"right":"left" }}>{msg.time}</div>
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:S.md }}>
            <div style={{ width:32, height:32, borderRadius:R.full, background:C.brandL,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:13, fontWeight:900, color:C.brand }}>{company.name[0]}</div>
            <div style={{ background:C.surface, borderRadius:"18px 18px 18px 4px",
              padding:"12px 16px", boxShadow:"0 1px 4px rgba(28,23,18,0.08)" }}>
              <div style={{ display:"flex", gap:5 }}>
                {[0,1,2].map(i => <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:C.bgWarm, animation:`bounce 1.2s ${i*0.2}s infinite` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ background:C.surface, borderTop:`1px solid ${C.bgWarm}`,
        padding:`${S.sm}px ${S.lg}px ${S.lg}px`, display:"flex", gap:S.sm, alignItems:"flex-end" }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key==="Enter"&&send()} placeholder="메시지를 입력하세요"
          style={{ flex:1, border:`1.5px solid ${C.bgWarm}`, borderRadius:R.full,
            padding:"11px 18px", fontSize:14, outline:"none", fontFamily:"inherit",
            background:C.bg, color:C.text1 }} />
        <button onClick={send}
          style={{ width:44, height:44, borderRadius:R.full,
            background:input.trim()?C.brand:"#E8E4DC", border:"none",
            cursor:input.trim()?"pointer":"default",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>➤</button>
      </div>
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}
