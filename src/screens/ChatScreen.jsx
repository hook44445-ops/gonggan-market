import { useState, useRef, useEffect, useMemo } from "react";
import { C, R, S } from "../constants";
import { TempBadge } from "../components/common";
import ProtectionNotice from "../components/ProtectionNotice";
import { detectDirectDealKeywords } from "../constants/directDeal";
import { supabase, getChatMessages, sendMessage, checkDirectDealKeyword, reportDirectDeal } from "../lib/supabase";

const REPORT_REASONS = [
  "외부 연락처(카톡/전화) 요구",
  "계좌이체·현금 직거래 유도",
  "플랫폼 밖 거래 제안",
  "수수료 회피 제안",
  "기타 부적절한 행위",
];

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

export default function ChatScreen({ company, user, onBack, onQuoteRequest }) {
  const roomId = `${user?.id ?? "guest"}_${company?.id ?? "0"}`;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const bottomRef = useRef(null);

  // 직거래 의심 키워드 반복 감지 — 클라이언트 표시 전용(차단/제재 없음, 기록은 기존 checkDirectDealKeyword가 수행)
  const directDealHits = useMemo(
    () => messages.reduce((n, m) => n + (detectDirectDealKeywords(m.text).length > 0 ? 1 : 0), 0),
    [messages]
  );
  const showConvertBanner = !!onQuoteRequest && directDealHits >= 2;

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

    const { data: sent } = await sendMessage(roomId, user?.id ?? "guest", "user", text).catch(() => ({ data: null }));

    // 감지/기록은 백그라운드 — 전송 흐름을 막지 않음
    checkDirectDealKeyword(text, {
      companyId: company?.id ?? null,
      customerId: user?.id ?? null,
      senderId: user?.id ?? null,
      senderRole: "consumer",
      chatMessageId: sent?.id ?? null,
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
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:S.sm }}>
          {onQuoteRequest && (
            <button onClick={onQuoteRequest}
              style={{ background:C.brandL, color:C.brand, border:`1px solid ${C.brandM}`,
                borderRadius:R.full, padding:"6px 12px", fontSize:12, fontWeight:800, cursor:"pointer", whiteSpace:"nowrap" }}>
              📋 견적요청
            </button>
          )}
          <TempBadge temp={company?.temp ?? 0} />
          <button onClick={() => { setReportDone(false); setReportOpen(true); }} aria-label="신고"
            style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:C.text3, padding:"2px 4px", lineHeight:1 }}>
            🚩
          </button>
        </div>
      </div>

      {/* 직거래 의심 반복 감지 → 견적 전환 유도 배너 (감지만, 차단 없음) */}
      {showConvertBanner && (
        <div style={{ background:C.navyL, borderBottom:`1px solid ${C.trustM}`, padding:"10px 16px",
          display:"flex", alignItems:"center", gap:S.md }}>
          <div style={{ fontSize:20, flexShrink:0 }}>🛡</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12.5, fontWeight:800, color:C.navy }}>견적요청으로 전환하기</div>
            <div style={{ fontSize:11, color:C.text3, lineHeight:1.5 }}>에스크로 보호 · GPS 증빙 · 분쟁 보호 혜택을 받을 수 있습니다.</div>
          </div>
          <button onClick={onQuoteRequest}
            style={{ flexShrink:0, background:C.navy, color:"#fff", border:"none", borderRadius:R.full,
              padding:"8px 14px", fontSize:12, fontWeight:800, cursor:"pointer", whiteSpace:"nowrap" }}>
            견적요청하기
          </button>
        </div>
      )}

      {reportOpen && (
        <div onClick={() => setReportOpen(false)}
          style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.55)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:300 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background:C.surface, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:480, padding:"20px 20px 28px" }}>
            <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 16px" }} />
            {reportDone ? (
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>🛡️</div>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:6 }}>신고가 접수됐어요</div>
                <div style={{ fontSize:14, color:C.text3, lineHeight:1.7 }}>공간마켓이 대화 기록을 토대로 확인 후 조치합니다. 안전한 거래를 위해 견적·계약은 공간마켓 안에서 진행해주세요.</div>
                <button onClick={() => setReportOpen(false)}
                  style={{ width:"100%", marginTop:20, padding:"13px", background:C.brand, border:"none", borderRadius:R.lg, color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>확인</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize:16, fontWeight:800, color:C.text1, marginBottom:4 }}>🚩 직거래·부적절 신고</div>
                <div style={{ fontSize:14, color:C.text3, lineHeight:1.7, marginBottom:16 }}>신고 사유를 선택해주세요. 이 대화는 기록되어 검토됩니다.</div>
                {REPORT_REASONS.map((reason) => (
                  <button key={reason}
                    onClick={async () => {
                      await reportDirectDeal({
                        companyId: company?.id ?? null,
                        customerId: user?.id ?? null,
                        reporterId: user?.id ?? null,
                        reportReason: reason,
                      }).catch(() => {});
                      setReportDone(true);
                    }}
                    style={{ display:"block", width:"100%", textAlign:"left", padding:"14px 16px", marginBottom:8, background:C.bg, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontSize:14, color:C.text1, fontWeight:600, cursor:"pointer", lineHeight:1.6 }}>
                    {reason}
                  </button>
                ))}
                <button onClick={() => setReportOpen(false)}
                  style={{ width:"100%", marginTop:8, padding:"13px", background:C.bg, border:"none", borderRadius:R.lg, color:C.text3, fontWeight:700, fontSize:14, cursor:"pointer" }}>취소</button>
              </>
            )}
          </div>
        </div>
      )}

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
