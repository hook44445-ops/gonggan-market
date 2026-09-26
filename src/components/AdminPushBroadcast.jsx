// ─────────────────────────────────────────────────────
// 관리자 공지 푸시 — 대상을 고르고, 몇 명에게 가는지 보고, 보낸다(migration 139).
//   · 알림함(ANNOUNCEMENT)은 대상 전원, 휴대폰 푸시는 알림을 켜고 기기 토큰이 있는 사람만.
//   · 서비스 공지 전용 — 광고성 정보(이벤트·홍보)는 별도 광고 수신 동의·「(광고)」 표시·야간 금지가 필요해 여기서 보내지 않는다.
//   · 주소는 앱 안(/로 시작)만. 보내면 발송기를 바로 깨운다(크론은 하루 1회).
// ─────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { C, R, S } from "../constants";
import { adminPushAudienceCount, adminPushBroadcast, wakePushDispatcher } from "../lib/supabase";

const AUDIENCES = [
  ["all",      "전체"],
  ["consumer", "고객"],
  ["company",  "업체"],
  ["lounge",   "라운지 알림 켠 사람"],
];
const LINKS = [
  ["/",       "홈"],
  ["/lounge", "라운지"],
  ["custom",  "직접 입력"],
];

export default function AdminPushBroadcast({ showToast }) {
  const [audience, setAudience] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("/");
  const [customUrl, setCustomUrl] = useState("");
  const [count, setCount] = useState(null);   // { users, push } | { error }
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    setCount(null);
    adminPushAudienceCount(audience).then(({ data, error }) => {
      if (!alive) return;
      setCount(error ? { error: error.message ?? "불러오지 못했어요" } : data);
    }, () => { if (alive) setCount({ error: "불러오지 못했어요" }); });
    return () => { alive = false; };
  }, [audience]);

  const url = link === "custom" ? customUrl.trim() : link;
  const urlOk = url.startsWith("/");
  const canSend = !sending && title.trim() && body.trim() && urlOk && !count?.error;

  const send = async () => {
    if (!canSend) return;
    const label = AUDIENCES.find(([k]) => k === audience)?.[1] ?? audience;
    const ok = window.confirm(
      `「${label}」에게 공지를 보냅니다.\n\n제목: ${title.trim()}\n내용: ${body.trim()}\n\n알림함 ${count?.users ?? "?"}명 · 휴대폰 푸시 ${count?.push ?? "?"}명\n보낸 뒤에는 되돌릴 수 없어요.`);
    if (!ok) return;
    setSending(true);
    const { data, error } = await adminPushBroadcast({ title: title.trim(), body: body.trim(), url, audience });
    setSending(false);
    if (error) { showToast?.(`보내지 못했어요: ${error.message ?? "관리자 인증을 확인해 주세요"}`, false); return; }
    wakePushDispatcher();
    showToast?.(`공지를 보냈어요 — 알림함 ${data?.notifications ?? 0}명 · 푸시 ${data?.push ?? 0}명`);
    setTitle(""); setBody("");
  };

  const chip = (active) => ({
    padding: "7px 12px", borderRadius: R.full, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    border: `1px solid ${active ? C.brand : C.bgWarm}`, background: active ? C.brandL : C.surface, color: active ? C.brand : C.text2,
  });
  const input = {
    width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: R.lg, border: `1px solid ${C.bgWarm}`,
    fontSize: 14, fontFamily: "inherit", color: C.text1, background: C.surface,
  };

  return (
    <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.lg }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 4 }}>공지 푸시 보내기</div>
      <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.6, marginBottom: S.lg }}>
        알림함에 남고, 알림을 켠 사람의 휴대폰에 바로 푸시가 가요. 서비스 공지만 — 이벤트·홍보 같은 광고는 보내지 않아요.
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 6 }}>받는 사람</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {AUDIENCES.map(([k, l]) => <button key={k} onClick={() => setAudience(k)} style={chip(audience === k)}>{l}</button>)}
      </div>
      <div style={{ fontSize: 12, color: count?.error ? C.red : C.text3, marginBottom: S.lg }}>
        {count == null ? "몇 명인지 세는 중…"
          : count.error ? `인원을 불러오지 못했어요 — ${count.error}`
          : `알림함 ${count.users}명 · 휴대폰 푸시 ${count.push}명`}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 6 }}>제목 <span style={{ color: C.text4, fontWeight: 500 }}>{title.length}/60</span></div>
      <input value={title} maxLength={60} onChange={e => setTitle(e.target.value)} placeholder="예: 추석 연휴 고객센터 운영 안내" style={{ ...input, marginBottom: S.md }} />

      <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 6 }}>내용 <span style={{ color: C.text4, fontWeight: 500 }}>{body.length}/120 (푸시에 보이는 길이)</span></div>
      <textarea value={body} maxLength={300} rows={3} onChange={e => setBody(e.target.value)} placeholder="휴대폰 알림에는 앞 120자까지 보여요" style={{ ...input, resize: "none", marginBottom: S.md }} />

      <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 6 }}>누르면 열 화면</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: link === "custom" ? 6 : S.lg }}>
        {LINKS.map(([k, l]) => <button key={k} onClick={() => setLink(k)} style={chip(link === k)}>{l}</button>)}
      </div>
      {link === "custom" && (
        <input value={customUrl} onChange={e => setCustomUrl(e.target.value)} placeholder="/lounge/posts/… 처럼 앱 안 주소(/로 시작)"
          style={{ ...input, marginBottom: S.lg, borderColor: customUrl && !urlOk ? C.red : C.bgWarm }} />
      )}

      <button onClick={send} disabled={!canSend}
        style={{ width: "100%", padding: S.lg, borderRadius: R.lg, border: "none", fontWeight: 800, fontSize: 14, fontFamily: "inherit",
          cursor: canSend ? "pointer" : "not-allowed", background: canSend ? C.brand : C.bgWarm, color: canSend ? "#fff" : C.text4 }}>
        {sending ? "보내는 중…" : "공지 보내기"}
      </button>
    </div>
  );
}
