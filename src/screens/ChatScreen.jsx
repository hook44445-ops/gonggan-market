import { useState, useRef, useEffect, useMemo } from "react";
import { C, R, S, SHADOW } from "../constants";
import { TempBadge } from "../components/common";
import ProtectionNotice from "../components/ProtectionNotice";
import { detectDirectDealKeywords } from "../constants/directDeal";
import { BADGES } from "../constants/badges";
import { supabase, getChatMessages, sendMessage, checkDirectDealKeyword, reportDirectDeal, getUser, getCompanyByOwnerId, markChatRoomRead, leaveLoungeChat, CHAT_PHOTO_PREFIX, isChatPhoto, chatPhotoUrl, uploadChatPhoto } from "../lib/supabase";

const REPORT_REASONS = [
  "외부 연락처(카톡/전화) 요구",
  "계좌이체·현금 직거래 유도",
  "플랫폼 밖 거래 제안",
  "수수료 회피 제안",
  "기타 부적절한 행위",
];

const WELCOME = "안녕하세요! 공간마켓 파트너 업체입니다 😊 견적 관련해서 궁금한 점 편하게 물어보세요!";

// 채팅 메시지 표시 시간 — DB(timestamptz)는 UTC 로 저장/유지하고, 화면만 Asia/Seoul 로
//   변환한다. 기존 getHours() 는 기기/브라우저(카카오 인앱 등) timezone 을 따라가서 UTC
//   기기에선 KST 15:22 가 6:22 로 틀어졌다. Intl(timeZone:"Asia/Seoul")로 기기와 무관하게 고정.
const _kstTimeFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false,
});
const fmtTime = (iso) => {
  if (!iso) return "";
  // timezone 표기가 없는 값(방어)은 UTC 로 간주해 파싱.
  let s = String(iso);
  if (!/[zZ]|[+-]\d\d:?\d\d$/.test(s)) s = s.replace(" ", "T") + "Z";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return _kstTimeFmt.format(d); // 예: "15:22" (24시간, KST 고정)
};

// ── 채팅 표시 이름 정책 (베타 → 정식 전환 대비 · 구조 전용) ──────────────────────
//   현재(베타): 대화 시작 후 실명(회원명) 그대로 노출 = 기존 동작 유지.
//   향후(정식): 프로필/본인인증 완료 후 CHAT_USE_PROFILE_NAMES=true 로만 바꾸면
//     profile.nickname → display_name → (익명 닉네임) 순으로 전환된다.
//     실명은 화면에 노출하지 않고 DB 내부 식별용으로만 사용한다.
//   ⚠️ 이번 PR 은 화면 동작/ DB / Migration 변경 없음 — 표시 우선순위 '구조'만 준비.
//      플래그가 false 인 동안 반환값은 기존 표현식과 100% 동일하다.
const CHAT_USE_PROFILE_NAMES = false; // 정식 전환 시 true (프로필 시스템 + 본인인증 완료 후)

// entity: 상대 프로필 후보(향후 profile.nickname/display_name 보유). realName: 베타 노출값(실명).
// anonymousName: 익명 닉네임(수락 전 등). fallback: 최종 대체 문자열.
function resolveChatDisplayName({ entity = null, realName = null, anonymousName = null, fallback = "—" } = {}) {
  if (CHAT_USE_PROFILE_NAMES) {
    // 정식: 프로필 닉네임 우선, 실명 미노출.
    return entity?.profile?.nickname
      ?? entity?.nickname
      ?? entity?.display_name
      ?? anonymousName
      ?? fallback;
  }
  // 베타: 기존과 동일 — 실명(없으면 익명, 그다음 fallback).
  return realName ?? anonymousName ?? fallback;
}

// 사진 메시지 파싱 — "[[photo]]<url>[ <캡션>]" 을 { url, caption } 으로 분리(렌더 전용).
//   · URL 은 공백 없는 첫 토큰(스토리지 public URL 은 공백 없음), 그 뒤 텍스트는 캡션.
//   · 사진만 → caption 빈문자, 사진+글 → 사진 아래 캡션 함께 출력. DB/전송 구조 무변경.
const parseChatPhoto = (text) => {
  const raw = chatPhotoUrl(text) ?? "";
  const idx = raw.search(/\s/);
  return idx === -1
    ? { url: raw, caption: "" }
    : { url: raw.slice(0, idx), caption: raw.slice(idx + 1).trim() };
};

const normalizeMsg = (row) => ({
  id: row.id,
  from: row.sender_type === "company" ? "company" : "user",
  text: row.text,
  time: fmtTime(row.created_at),
  createdAt: row.created_at,
});

const PAGE_SIZE = 50;
const LOUNGE_SYSTEM_HELLO = "라운지 대화가 시작되었습니다.";

export default function ChatScreen({ company, user, onBack, onQuoteRequest, mode, partner, roomId: roomIdProp, onOpenSource, onOpenPortfolio, onLeft }) {
  // 라운지 모드: room_id = lounge_{lounge_chat_request_id} (호출부에서 전달) — 기존 견적/업체 채팅 규칙 무변경
  const isLounge = mode === "lounge";
  const roomId = roomIdProp ?? `${user?.id ?? "guest"}_${company?.id ?? "0"}`;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoErr, setPhotoErr] = useState(null);
  const [viewerUrl, setViewerUrl] = useState(null);
  const photoInputRef = useRef(null);
  const [typing, setTyping] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loaded, setLoaded] = useState(false); // 최초 로딩 완료 여부 (무한로딩/빈화면 방어용 UI 플래그)
  const [partnerProfile, setPartnerProfile] = useState(null); // 라운지: { spaceTemp, interests }
  const [partnerCompany, setPartnerCompany] = useState(null); // 라운지: 상대가 업체면 업체 정보
  const [reqStatus, setReqStatus] = useState(null); // 라운지: lounge_chat_requests.status (수락 전 입력 게이트용)
  const [reqRequesterId, setReqRequesterId] = useState(null); // 라운지: 신청자(요청 보낸 사람) id — 익명/입력 권한 판별
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const bottomRef = useRef(null);

  // 라운지 익명 대화 요청 상태 기반 플래그 (Phase 2 — 블릿형 익명 메시지 요청)
  //  · pending(Waiting Accept): 신청자만 익명 채팅방에서 입력 가능. 상대는 요청함에서 수락/거절(방에 들어오지 않음).
  //  · accepted: 일반 채팅 + 프로필/닉네임 공개.   rejected/expired: 종료(양쪽 입력 불가, 재사용 안 함).
  //  · status 미확인(null·회사채팅): 기존과 동일하게 입력 허용 + (회사채팅은) 실명 노출.
  const isRequester     = isLounge && reqRequesterId != null && reqRequesterId === user?.id;
  const isWaitingAccept = isLounge && reqStatus === "pending";
  const isTerminated    = isLounge && (reqStatus === "rejected" || reqStatus === "expired");
  const revealIdentity  = !isLounge || reqStatus === "accepted";       // 수락 후에만 실프로필/실명 공개
  const canType         = !isLounge || reqStatus == null || reqStatus === "accepted" || (isWaitingAccept && isRequester);
  // 저장할 sender_type — chats CHECK 는 ('consumer','company','system')(+081 superset 'user').
  // 'user' 대신 역할 기반 유효값을 저장해 CHECK 위반을 원천 차단(표시는 sender_id 기준이라 무관).
  const mySenderType    = (user?.activeRole ?? user?.role) === "company" ? "company" : "consumer";

  // 발신자 구분은 sender_id 기준으로 통일(라운지=consumer끼리, 거래=고객/업체 모두).
  // send() 가 sender_type 을 항상 "user" 로 저장하므로 sender_type 기반 구분은 양쪽을
  // 가려내지 못해 정렬이 깨졌다. system 메시지만 sender_type 으로 판별한다.
  // 로드·실시간(realtime) 모두 이 mapRow 를 공통 사용 → 동일 정렬 보장.
  const mapRow = (row) => ({
    id: row.id,
    from: row.sender_type === "system"
      ? "system"
      : (row.sender_id != null && row.sender_id === user?.id ? "user" : "company"),
    text: row.text,
    time: fmtTime(row.created_at),
    createdAt: row.created_at,
  });

  // 라운지: 상대 공간온도/관심 + 업체 여부 조회 (실패 시 표시만 생략)
  //  · 수락 전(pending/종료)에는 상대 실프로필을 조회/노출하지 않는다(익명 유지). 수락 시점에 reqStatus 변화로 재실행.
  useEffect(() => {
    setPartnerProfile(null);
    setPartnerCompany(null);
    if (!isLounge || !partner?.userId) return;
    if (reqStatus !== "accepted") return; // 익명 단계: 상대 실프로필 비공개
    let cancelled = false;
    getUser(partner.userId).then(({ data }) => {
      if (!cancelled && data) setPartnerProfile({ spaceTemp: data.space_temp ?? 36.5, interests: data.interests ?? [] });
    }).catch(() => {});
    getCompanyByOwnerId(partner.userId).then(({ data }) => {
      if (!cancelled && data) setPartnerCompany(data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isLounge, partner?.userId, reqStatus]);

  // 직거래 의심 키워드 반복 감지 — 클라이언트 표시 전용(차단/제재 없음, 기록은 기존 checkDirectDealKeyword가 수행)
  const directDealHits = useMemo(
    () => messages.reduce((n, m) => n + (detectDirectDealKeywords(m.text).length > 0 ? 1 : 0), 0),
    [messages]
  );
  const showConvertBanner = !!onQuoteRequest && directDealHits >= 2;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setReqStatus(null);
    setReqRequesterId(null);

    async function init() {
      let pending = false;
      if (isLounge && partner?.requestId) {
        const { data: reqRow } = await supabase
          .from("lounge_chat_requests")
          .select("status, requester_id, target_id")
          .eq("id", partner.requestId)
          .maybeSingle();
        if (cancelled) return;
        const st = reqRow?.status ?? null;
        setReqStatus(st);
        setReqRequesterId(reqRow?.requester_id ?? null);
        pending = st != null && st !== "accepted";
      }

      const { data, error } = await getChatMessages(roomId);
      if (cancelled) return;
      if (error) { setLoaded(true); return; }

      let rows = data ?? [];
      if (rows.length === 0) {
        if (isLounge) {
          // 라운지 대화 시작 system 메시지 1개 — 수락 후, 방이 비어있을 때만(중복 생성 방지)
          if (!pending) {
            await sendMessage(roomId, user?.id ?? null, "system", LOUNGE_SYSTEM_HELLO);
            const { data: after } = await getChatMessages(roomId);
            if (!cancelled) rows = after ?? [];
          }
        } else {
          // Insert welcome message from company, then re-fetch to get real DB id
          // sender_id 는 null — company.id 는 users(id) FK 대상이 아니라 FK 위반이 됨.
          // 표시는 sender_type='company' + sender_id≠본인 으로 '업체' 메시지로 렌더됨.
          await sendMessage(roomId, null, "company", WELCOME);
          const { data: after } = await getChatMessages(roomId);
          if (!cancelled) rows = after ?? [];
        }
      }
      if (!cancelled) {
        setMessages(rows.map(mapRow));
        setHasMore(rows.length >= PAGE_SIZE);
        setLoaded(true);
        // C-4: 방 진입 시 읽음 처리(내가 안 보낸 안읽음만). 실패해도 채팅엔 영향 없음.
        if (user?.id) markChatRoomRead(roomId, user.id).catch(() => {});
      }
    }

    // 무한로딩/빈화면 방어 — init 이 예외로 끝나도 반드시 loaded=true 로 만들어
    // "대화를 불러오는 중이에요…" 에 멈추지 않게 한다(입력창/빈상태 노출 → 사용자 전송 시도 가능).
    init().catch((e) => {
      try { console.error("[CHAT_INIT_FAILED]", { roomId, message: e?.message ?? e }); } catch { /* noop */ }
      if (!cancelled) setLoaded(true);
    });

    const channel = supabase
      .channel(`chat:${roomId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chats",
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          return [...prev, mapRow(payload.new)];
        });
      })
      .subscribe();

    // 라운지: 보고 있는 동안 상대가 수락/거절하면 입력 게이트를 즉시 갱신
    let reqChannel = null;
    if (isLounge && partner?.requestId) {
      reqChannel = supabase
        .channel(`lounge_chat_request:${partner.requestId}`)
        .on("postgres_changes", {
          event: "UPDATE", schema: "public", table: "lounge_chat_requests",
          filter: `id=eq.${partner.requestId}`,
        }, (payload) => {
          setReqStatus(payload.new?.status ?? null);
        })
        .subscribe();
    }

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      if (reqChannel) supabase.removeChannel(reqChannel);
    };
  }, [roomId, isLounge, partner?.requestId]);

  const handleLeave = async () => {
    if (!isLounge || !partner?.requestId || !user?.id || leaving) return;
    setLeaving(true);
    await leaveLoungeChat(partner.requestId, user.id).catch(() => {});
    setLeaving(false);
    setMenuOpen(false);
    onLeft?.(partner.requestId);
    onBack?.();
  };

  // 이전 메시지 더보기 — 가장 오래된 메시지 이전 PAGE_SIZE개 추가 로딩(created_at 커서)
  const loadOlder = async () => {
    if (loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0]?.createdAt;
    const { data } = await getChatMessages(roomId, { before: oldest }).catch(() => ({ data: null }));
    const rows = data ?? [];
    setMessages(prev => {
      const seen = new Set(prev.map(m => m.id));
      return [...rows.map(mapRow).filter(m => !seen.has(m.id)), ...prev];
    });
    setHasMore(rows.length >= PAGE_SIZE);
    setLoadingMore(false);
  };

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    if (!isLounge) setTyping(true);

    // 낙관적 표시 — 전송 즉시 내 화면에 노출(사진과 달리 텍스트가 realtime 에코를 못 받아도
    // 보이도록). 성공 시 실제 id 로 치환(realtime 중복은 id 로 dedup), 실패 시 제거+입력 복원.
    const tmpId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic = { id: tmpId, from: "user", text, time: fmtTime(new Date().toISOString()), createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, optimistic]);

    // ⚠️ Supabase 빌더(PostgrestBuilder)는 PromiseLike(then만 존재) — .catch()가 없어
    //    `sendMessage(...).catch(...)` 는 await 이전에 동기 TypeError 를 던진다. 그러면
    //    빌더가 await 되지 않아 INSERT 가 서버로 전송조차 안 되고(=텍스트만 저장 실패,
    //    사진은 await 직접 사용이라 정상), 낙관적 메시지만 남아 새로고침 시 사라졌다.
    //    → 사진 경로와 동일하게 직접 await + try/catch 로 실제 오류만 잡는다.
    let sent = null, sendErr = null;
    try {
      const res = await sendMessage(roomId, user?.id ?? "guest", mySenderType, text);
      sent = res?.data ?? null; sendErr = res?.error ?? null;
    } catch (e) { sendErr = e; }

    // INSERT 실패(RLS/CHECK/네트워크)를 삼키지 않고 노출 + 낙관적 메시지 롤백 + 입력 복원.
    if (sendErr) {
      if (!isLounge) setTyping(false);
      setMessages(prev => prev.filter(m => m.id !== tmpId));
      setInput(text);
      const detail = sendErr?.message || sendErr?.error_description || String(sendErr);
      setPhotoErr(`메시지 전송 실패: ${detail}`);
      setTimeout(() => setPhotoErr(null), 6000);
      return;
    }

    // 성공 — 낙관적 메시지를 실제 id 로 치환(이미 realtime 이 실제 id 로 추가했으면 임시분만 제거).
    if (sent?.id) {
      setMessages(prev => {
        const withoutTmp = prev.filter(m => m.id !== tmpId);
        return withoutTmp.some(m => m.id === sent.id) ? withoutTmp : [...withoutTmp, { ...optimistic, id: sent.id }];
      });
    }

    // 감지/기록은 백그라운드 — 전송 흐름을 막지 않음 (라운지: 상대가 업체면 업체 id 연결)
    checkDirectDealKeyword(text, {
      companyId: isLounge ? (partnerCompany?.id ?? null) : (company?.id ?? null),
      customerId: user?.id ?? null,
      senderId: user?.id ?? null,
      senderRole: "consumer",
      chatMessageId: sent?.id ?? null,
    }).catch(() => {});

    // typing indicator disappears once realtime delivers the reply (or after timeout)
    if (!isLounge) setTimeout(() => setTyping(false), 3000);
  };

  // 사진 전송 — 일반 메시지(text=마커+URL)로 전송. 텍스트 흐름과 독립(additive).
  // Storage 버킷 'chat-photos' 필요. 렌더는 realtime 으로 갱신됨(텍스트와 동일).
  const sendPhotos = async (files) => {
    const list = Array.from(files || []).filter(f => f && f.type && f.type.startsWith("image/"));
    if (list.length === 0 || uploadingPhoto) return;
    setUploadingPhoto(true);
    for (const f of list) {
      try {
        const url = await uploadChatPhoto(f, roomId, user?.id);
        const { error: msgErr } = await sendMessage(roomId, user?.id ?? "guest", mySenderType, `${CHAT_PHOTO_PREFIX}${url}`);
        if (msgErr) throw msgErr; // 메시지 insert 실패도 아래 catch 에서 실제 오류 노출
      } catch (e) {
        // 원인 자가진단을 위해 실제 오류를 노출(버킷 없음/정책/경로 구분).
        const detail = e?.message || e?.error_description || String(e);
        setPhotoErr(`사진 업로드 실패: ${detail}`);
        setTimeout(() => setPhotoErr(null), 6000);
      }
    }
    setUploadingPhoto(false);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100dvh", maxHeight:"100dvh", background:C.ivory, fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.bgWarm}`,
        padding:`max(env(safe-area-inset-top),10px) 14px 11px`, boxShadow:SHADOW.soft,
        display:"flex", alignItems:"center", gap:S.sm, position:"sticky", top:0, zIndex:10 }}>
        <button onClick={onBack} aria-label="뒤로가기"
          style={{ background:"none", border:"none", fontSize:24, cursor:"pointer", color:C.text1, padding:"2px 6px 2px 0", lineHeight:1, flexShrink:0 }}>←</button>
        <div style={{ width:40, height:40, borderRadius:R.full, flexShrink:0,
          background:C.brandL, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:18, fontWeight:900, color:C.brand, position:"relative" }}>
          {isLounge ? (partner?.nickname ?? "?")[0] : (company?.name ?? "?")[0]}
          {!isLounge && company?.online && <div style={{ position:"absolute", bottom:0, right:0, width:10, height:10, borderRadius:"50%", background:C.green, border:"2px solid #fff" }} />}
        </div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:800, color:C.text1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
            {/* 표시 이름은 resolveChatDisplayName 로 통일(정식 전환 대비). 베타 반환값=기존과 동일.
                수락 전 익명(partner.nickname) 분기는 익명 정책 그대로 유지(변경 금지). */}
            {isLounge
              ? (revealIdentity
                  ? resolveChatDisplayName({ entity: partnerCompany ?? partner, realName: partnerCompany?.name ?? partner?.nickname, anonymousName: partner?.nickname, fallback: "—" })
                  : (partner?.nickname ?? "익명"))
              : resolveChatDisplayName({ entity: company, realName: company?.name, fallback: "—" })}
          </div>
          {isLounge ? (
            !revealIdentity ? (
              <div style={{ fontSize:10.5, color:C.text3, fontWeight:600 }}>🔒 익명 · {isTerminated ? "종료됨" : "수락 전"}</div>
            ) : (
            <div style={{ display:"flex", gap:5, alignItems:"center", flexWrap:"wrap" }}>
              {partnerProfile?.spaceTemp != null && (
                <span style={{ fontSize:10.5, color:C.brand, fontWeight:700, whiteSpace:"nowrap" }}>🌡️ {Number(partnerProfile.spaceTemp).toFixed(1)}°</span>
              )}
              {(partnerProfile?.interests ?? []).slice(0, 2).map(it => (
                <span key={it} style={{ fontSize:10.5, color:C.text3, whiteSpace:"nowrap" }}>#{it}</span>
              ))}
              {partnerCompany && (() => {
                const bm = partnerCompany.badge ? (BADGES[partnerCompany.badge] ?? BADGES.basic) : null;
                // 공간보증 배지 — 한 줄 pill(세로 글자 깨짐 방지: nowrap + 넘치면 말줄임).
                return bm ? (
                  <span style={{ fontSize:10, color:bm.color, fontWeight:800, whiteSpace:"nowrap",
                    background:`${bm.color}1A`, borderRadius:999, padding:"1px 8px", lineHeight:1.6,
                    maxWidth:170, overflow:"hidden", textOverflow:"ellipsis", display:"inline-block", verticalAlign:"middle" }}>
                    {bm.icon} 공간보증 {bm.label}
                  </span>
                ) : null;
              })()}
            </div>
            )
          ) : (
            <div style={{ fontSize:11, color:company?.online?C.green:C.text3, fontWeight:600 }}>
              {company?.online
                ? (company.lastActive ? `활동중 · ${company.lastActive}` : "활동중")
                : (company?.responseTime ?? "")}
            </div>
          )}
        </div>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:S.sm, flexShrink:0 }}>
          {isLounge && revealIdentity && partnerCompany && onOpenPortfolio && (
            <button onClick={() => onOpenPortfolio(partner?.userId)}
              style={{ background:C.surface, color:C.text2, border:`1px solid ${C.bgWarm}`,
                borderRadius:R.full, padding:"6px 10px", fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
              포트폴리오
            </button>
          )}
          {onQuoteRequest && (
            <button onClick={onQuoteRequest}
              style={{ background:C.brandL, color:C.brand, border:`1px solid ${C.brandM}`,
                borderRadius:R.full, padding:"6px 12px", fontSize:12, fontWeight:800, cursor:"pointer", whiteSpace:"nowrap" }}>
              📋 견적요청
            </button>
          )}
          {!isLounge && <TempBadge temp={company?.temp ?? 0} />}
          <button onClick={() => { setReportDone(false); setReportOpen(true); }} aria-label="신고"
            style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:C.text3, padding:"2px 4px", lineHeight:1 }}>
            🚩
          </button>
          {isLounge && partner?.requestId && (
            <div style={{ position:"relative" }}>
              <button onClick={() => setMenuOpen(v => !v)} aria-label="메뉴"
                style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:C.text3, padding:"2px 4px", lineHeight:1 }}>
                ⋯
              </button>
              {menuOpen && (
                <>
                  <div onClick={() => setMenuOpen(false)} style={{ position:"fixed", inset:0, zIndex:19 }} />
                  <div style={{ position:"absolute", right:0, top:"calc(100% + 4px)", zIndex:20,
                    background:C.surface, border:`1px solid ${C.bgWarm}`, borderRadius:R.md,
                    boxShadow:SHADOW.soft, minWidth:96, overflow:"hidden" }}>
                    <button onClick={handleLeave} disabled={leaving}
                      style={{ display:"block", width:"100%", padding:"10px 14px", background:"none", border:"none",
                        textAlign:"left", fontSize:13, fontWeight:700, color:C.text2, cursor:leaving?"default":"pointer", whiteSpace:"nowrap" }}>
                      {leaving ? "나가는 중..." : "나가기"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Space OS · 프로젝트 대화 보호 안내 */}
      {!isLounge && (
        <div style={{ background:C.bg, borderBottom:`1px solid ${C.bgWarm}`, padding:"8px 16px",
          fontSize:11.5, color:C.text3, lineHeight:1.6 }}>
          🛡 프로젝트 대화는 서로의 약속을 보호하기 위해 안전하게 보관됩니다.
        </div>
      )}

      {/* 라운지: 원본 글/댓글/스토리 링크 */}
      {isLounge && partner?.postId && (
        <div onClick={() => onOpenSource?.(partner.postId)}
          style={{ background:C.bg, borderBottom:`1px solid ${C.bgWarm}`, padding:"8px 16px",
            fontSize:12, color:C.text3, cursor:onOpenSource ? "pointer" : "default",
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          📝 원본 글: <span style={{ color:C.brand, fontWeight:700 }}>{partner.postTitle ?? "라운지 게시글"}</span> {onOpenSource ? "›" : ""}
        </div>
      )}

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

      <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch", overscrollBehavior:"contain",
        padding:`${S.lg}px ${S.lg}px ${S.md}px`, background:"transparent" }}>
        {messages.length === 0 && !loaded && (
          <div style={{ textAlign:"center", fontSize:13, color:C.text3, marginTop:64 }}>
            <div style={{ display:"inline-flex", gap:5 }}>
              {[0,1,2].map(i => <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:C.brandM, animation:`bounce 1.2s ${i*0.2}s infinite` }} />)}
            </div>
            <div style={{ marginTop:12 }}>대화를 불러오는 중이에요…</div>
          </div>
        )}
        {messages.length === 0 && loaded && (
          <div style={{ textAlign:"center", marginTop:64, padding:"0 24px" }}>
            <div style={{ fontSize:36, marginBottom:10 }}>💬</div>
            <div style={{ fontSize:14, fontWeight:800, color:C.text1, marginBottom:6 }}>아직 주고받은 메시지가 없어요</div>
            <div style={{ fontSize:12.5, color:C.text3, lineHeight:1.6, whiteSpace:"pre-line" }}>
              {isTerminated ? "종료된 대화예요."
                : (isWaitingAccept && isRequester) ? "익명으로 첫 메시지를 보내보세요.\n상대가 수락하면 프로필이 공개되고 대화가 이어져요."
                : isWaitingAccept ? "수락 대기중이에요. 수락 후 채팅을 시작할 수 있어요."
                : "좋은 대화는 좋은 만남이 됩니다."}
            </div>
          </div>
        )}
        {hasMore && messages.length > 0 && (
          <div style={{ textAlign:"center", marginBottom:S.md }}>
            <button onClick={loadOlder} disabled={loadingMore}
              style={{ background:C.surface, color:C.text3, border:`1px solid ${C.bgWarm}`,
                borderRadius:R.full, padding:"7px 16px", fontSize:12, fontWeight:700,
                cursor:loadingMore ? "default" : "pointer" }}>
              {loadingMore ? "불러오는 중..." : "이전 메시지 더보기"}
            </button>
          </div>
        )}
        {messages.map((msg) => msg.from === "system" ? (
          <div key={msg.id} style={{ display:"flex", justifyContent:"center", margin:`${S.lg}px 0` }}>
            <div style={{ maxWidth:"80%", background:C.brandL, color:C.brandD,
              border:`1px solid ${C.brandM}`, borderRadius:R.lg,
              padding:"9px 16px", fontSize:12, fontWeight:600, lineHeight:1.6,
              textAlign:"center", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{msg.text}</div>
          </div>
        ) : (
          <div key={msg.id} style={{ display:"flex", justifyContent:msg.from==="user"?"flex-end":"flex-start",
            marginBottom:S.sm, alignItems:"flex-end", gap:6 }}>
            <div style={{ maxWidth:"76%", display:"flex", flexDirection:"column",
              alignItems:msg.from==="user"?"flex-end":"flex-start" }}>
              {/* 작성자 표시 — 원형 배경 없이 전체 익명 닉네임을 일반 텍스트로(1줄·말줄임). */}
              {msg.from === "company" && (
                <div style={{ fontSize:11, fontWeight:700, color:C.text3, marginBottom:3,
                  padding:"0 2px", maxWidth:"100%",
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {isLounge ? (partner?.nickname ?? "익명") : (company?.name ?? "업체")}
                </div>
              )}
              <div style={{ background:msg.from==="user"?C.brand:C.surface,
                color:msg.from==="user"?"#fff":C.text1,
                borderRadius:msg.from==="user"?"18px 18px 5px 18px":"18px 18px 18px 5px",
                padding:"10px 14px", fontSize:14, lineHeight:1.55,
                whiteSpace:"pre-wrap", wordBreak:"break-word", overflowWrap:"anywhere",
                border:msg.from==="user"?"none":`1px solid ${C.bgWarm}`,
                boxShadow:msg.from==="user"?SHADOW.brand:SHADOW.soft }}>
                {isChatPhoto(msg.text) ? (() => {
                  // 사진(+선택 캡션) — 사진만 있으면 사진만, 글이 함께면 사진 아래 글도 출력.
                  const { url, caption } = parseChatPhoto(msg.text);
                  return (
                    <>
                      <img src={url} alt="채팅 사진"
                        onClick={() => setViewerUrl(url)}
                        style={{ display:"block", maxWidth:200, maxHeight:240, borderRadius:10,
                          objectFit:"cover", cursor:"pointer" }} />
                      {caption && (
                        <div style={{ marginTop:6, whiteSpace:"pre-wrap", wordBreak:"break-word", overflowWrap:"anywhere" }}>{caption}</div>
                      )}
                    </>
                  );
                })() : msg.text}
              </div>
              <div style={{ fontSize:10, color:C.text4, marginTop:3,
                padding:"0 2px", textAlign:msg.from==="user"?"right":"left" }}>{msg.time}</div>
            </div>
          </div>
        ))}
        {typing && (
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:S.md }}>
            <div style={{ width:30, height:30, borderRadius:R.full, background:C.brandL,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:13, fontWeight:900, color:C.brand, flexShrink:0 }}>{(company?.name ?? "?")[0]}</div>
            <div style={{ background:C.surface, borderRadius:"18px 18px 18px 5px",
              padding:"12px 16px", border:`1px solid ${C.bgWarm}`, boxShadow:SHADOW.soft }}>
              <div style={{ display:"flex", gap:5 }}>
                {[0,1,2].map(i => <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:C.bgWarm, animation:`bounce 1.2s ${i*0.2}s infinite` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>


      {!canType ? (
        <div style={{ background:C.surface, borderTop:`1px solid ${C.bgWarm}`, flexShrink:0,
          padding:`${S.lg}px ${S.xl}px calc(${S.lg}px + env(safe-area-inset-bottom))`,
          textAlign:"center", fontSize:13, color:C.text3, fontWeight:600 }}>
          {isTerminated ? "종료된 대화예요. 다시 연결하려면 새로 신청해 주세요." : "상대가 수락하면 채팅이 시작됩니다."}
        </div>
      ) : (
        <>
        {isWaitingAccept && isRequester && (
          <div style={{ background:C.brandL, borderTop:`1px solid ${C.brandM}`, color:C.brandD, flexShrink:0,
            padding:"8px 16px", fontSize:11.5, fontWeight:600, textAlign:"center", lineHeight:1.5 }}>
            🔒 수락 대기중 · 익명 — 상대가 수락하면 프로필이 공개되고 대화가 이어져요
          </div>
        )}
        <div style={{ background:C.surface, borderTop:`1px solid ${C.bgWarm}`, flexShrink:0,
          padding:`${S.sm}px ${S.md}px calc(${S.sm}px + env(safe-area-inset-bottom))`,
          display:"flex", gap:S.sm, alignItems:"flex-end", boxShadow:"0 -2px 10px rgba(28,23,18,0.04)" }}>
          {/* 사진 첨부 — 갤러리 선택/카메라 촬영, 여러 장. 텍스트 흐름과 독립. */}
          <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display:"none" }}
            onChange={e => { sendPhotos(e.target.files); e.target.value = ""; }} />
          <button onClick={() => photoInputRef.current?.click()} aria-label="사진 첨부" disabled={uploadingPhoto}
            style={{ width:46, height:46, flexShrink:0, borderRadius:R.full, background:C.bgWarm, border:"none",
              color:C.text2, fontSize:20, cursor:uploadingPhoto?"default":"pointer", lineHeight:1 }}>
            {uploadingPhoto ? "⏳" : "📷"}
          </button>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()} placeholder="메시지를 입력하세요"
            style={{ flex:1, minWidth:0, border:`1.5px solid ${C.bgWarm}`, borderRadius:R.pill,
              padding:"12px 18px", fontSize:15, outline:"none", fontFamily:"inherit",
              background:C.surface2, color:C.text1 }} />
          <button onClick={send} aria-label="전송" disabled={!input.trim()}
            style={{ width:46, height:46, flexShrink:0, borderRadius:R.full,
              background:input.trim()?C.brand:C.bgWarm, border:"none",
              color:input.trim()?"#fff":C.text4,
              cursor:input.trim()?"pointer":"default",
              boxShadow:input.trim()?SHADOW.brand:"none",
              transition:"background .15s ease, box-shadow .15s ease",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>➤</button>
        </div>
        </>
      )}
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}`}</style>

      {/* 사진 업로드 실패 토스트 */}
      {photoErr && (
        <div style={{ position:"fixed", left:"50%", bottom:80, transform:"translateX(-50%)",
          background:"rgba(28,23,18,0.92)", color:"#fff", padding:"10px 16px", borderRadius:R.pill,
          fontSize:12.5, fontWeight:600, zIndex:2100, maxWidth:"86%", textAlign:"center" }}>{photoErr}</div>
      )}

      {/* 원본 사진 뷰어 (확대 + 다운로드) */}
      {viewerUrl && (
        <div onClick={() => setViewerUrl(null)} style={{ position:"fixed", inset:0,
          background:"rgba(0,0,0,0.92)", zIndex:2200, display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", gap:16, padding:16 }}>
          <img src={viewerUrl} alt="원본 사진" onClick={e => e.stopPropagation()}
            style={{ maxWidth:"94%", maxHeight:"80%", objectFit:"contain", borderRadius:8 }} />
          <a href={viewerUrl} download target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ color:"#fff", fontSize:14, fontWeight:700, textDecoration:"underline" }}>다운로드</a>
        </div>
      )}
    </div>
  );
}
