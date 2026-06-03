import { useState, useRef, useEffect } from "react";
import { C, R, S } from "../constants";
import { TempBadge } from "../components/common";
import ProtectionNotice from "../components/ProtectionNotice";
import { supabase, getChatMessages, sendMessage, checkDirectDealKeyword } from "../lib/supabase";

const WELCOME = "안녕하세요! 공간마켓 파트너 업체입니다 😊 견적 관련해서 궁금한 점 편하게 물어보세요!";

const fmtTime = (iso) => {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const normalizeMsg = (row) => ({
  id: row.id,
  from: row.sender_type === "company" ? "company" : "user",
  text: row.text,
  time: fmtTime(row.created_at),
});

export default function ChatScreen({ company, user, onBack }) {
  const roomId = `${user?.id ?? "guest"}_${company?.id ?? "0"}`;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const { data, error } = await getChatMessages(roomId);
      if (cancelled) return;
      if (error) return;

      let rows = data ?? [];
      if (rows.length === 0) {
        // Insert welcome message from company, then re-fetch to get real DB id
        await sendMessage(roomId, String(company?.id ?? "company"), "company", WELCOME);
        const { data: after } = await getChatMessages(roomId);
        if (!cancelled) rows = after ?? [];
      }
      if (!cancelled) setMessages(rows.map(normalizeMsg));
    }

    init();

    const channel = supabase
      .channel(`chat:${roomId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chats",
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, normalizeMsg(payload.new)];
        });
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    setTyping(true);

    await sendMessage(roomId, user?.id ?? "guest", "user", text);

    // 감지/기록은 백그라운드 — 전송 흐름을 막지 않음
    checkDirectDealKeyword(text, {
      companyId: company?.id ?? null,
      customerId: user?.id ?? null,
      senderId: user?.id ?? null,
      senderRole: "consumer",
    }).catch(() => {});

    // typing indicator disappears once realtime delivers the reply (or after timeout)
    setTimeout(() => setTyping(false), 3000);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.bgWarm}`, padding:"12px 16px",
        display:"flex", alignItems:"center", gap:S.md, position:"sticky", top:0, zIndex:10 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
        <div style={{ width:40, height:40, borderRadius:R.full, flexShrink:0,
          background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:18, fontWeight:900, color:C.brand, position:"relative" }}>
          {(company?.name ?? "?")[0]}
          {company?.online && <div style={{ position:"absolute", bottom:0, right:0, width:10, height:10, borderRadius:"50%", background:C.green, border:"2px solid #fff" }} />}
        </div>
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:C.text1 }}>{company?.name ?? "—"}</div>
          <div style={{ fontSize:11, color:company?.online?C.green:C.text3, fontWeight:600 }}>
            {company?.online ? `활동중 · ${company.lastActive}` : company?.responseTime ?? ""}
          </div>
        </div>
        <div style={{ marginLeft:"auto" }}><TempBadge temp={company?.temp ?? 0} /></div>
      </div>

      <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.bgWarm}`, background:C.bg }}>
        <ProtectionNotice variant="short" />
        <div style={{ marginTop:8, fontSize:12, color:C.text3, lineHeight:1.6, textAlign:"center" }}>
          견적과 계약은 공간마켓 안에서 진행해야 보호받을 수 있어요.
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:S.xl, background:C.bg }}>
        {messages.length === 0 && (
          <div style={{ textAlign:"center", fontSize:13, color:C.text3, marginTop:60 }}>로딩 중...</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} style={{ display:"flex", justifyContent:msg.from==="user"?"flex-end":"flex-start",
            marginBottom:S.md, alignItems:"flex-end", gap:6 }}>
            {msg.from === "company" && (
              <div style={{ width:32, height:32, borderRadius:R.full, background:C.brandL,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:13, fontWeight:900, color:C.brand, flexShrink:0 }}>{(company?.name ?? "?")[0]}</div>
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
              fontSize:13, fontWeight:900, color:C.brand }}>{(company?.name ?? "?")[0]}</div>
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
          onKeyDown={e => e.key === "Enter" && send()} placeholder="메시지를 입력하세요"
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
