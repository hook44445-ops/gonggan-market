import { useEffect, useState } from "react";
import { C, R, S } from "../constants";
import { getPushPreferences, upsertPushPreferences, setMarketingConsent } from "../lib/supabase";
import { enablePush, isPushSupported, isPushConfigured } from "../lib/push";
import { CURRENT_EVENT } from "../lib/referralEvent";

// 홈 초대왕 띠 아래 «시작·마감 알림 받기»(157) — 광고성 정보 수신 동의를 여기서 받는다.
//   누르면 무엇에 동의하는지 먼저 보여 주고, 한 번 더 눌러야 켠다(미리 체크 X). 이미 받고 있으면 안 보인다.
//   «다음에»는 이 이벤트 동안 다시 묻지 않는다(기기 기록).
const dismissKey = `gonggan_event_optin_dismissed:${CURRENT_EVENT.id}`;

export default function EventAlertOptIn({ user }) {
  const [state, setState] = useState("loading");   // loading | ask | hidden
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (!user?.id || user?.isGuest) { setState("hidden"); return; }
    try { if (localStorage.getItem(dismissKey) === "1") { setState("hidden"); return; } } catch { /* noop */ }
    let alive = true;
    getPushPreferences(user.id).then(({ data }) => {
      if (!alive) return;
      setState(data?.push_enabled && data?.push_marketing ? "hidden" : "ask");
    }).catch(() => alive && setState("hidden"));
    return () => { alive = false; };
  }, [user?.id, user?.isGuest]);

  const agree = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (isPushSupported() && isPushConfigured()) { try { await enablePush(user.id); } catch { /* 권한 거부여도 설정은 저장 */ } }
      await upsertPushPreferences(user.id, { push_enabled: true, push_chat: true, push_escrow: true });
      const { data, error } = await setMarketingConsent(true);
      if (error || !data?.ok) throw error ?? new Error("FAIL");
      setDone(`${data.day} 이벤트·혜택 알림(광고) 수신에 동의하셨어요. 마이 > 푸시 알림에서 언제든 끌 수 있어요.`);
      setTimeout(() => { setOpen(false); setState("hidden"); }, 2600);
    } catch {
      setDone("지금은 켤 수 없어요. 잠시 후 다시 시도해 주세요.");
    }
    setBusy(false);
  };
  const later = () => {
    try { localStorage.setItem(dismissKey, "1"); } catch { /* noop */ }
    setOpen(false); setState("hidden");
  };

  if (state !== "ask") return null;
  return (
    <>
      <button onClick={() => { setDone(null); setOpen(true); }}
        style={{ width: "100%", marginTop: -4, padding: "9px 12px", borderRadius: R.lg, border: `1px dashed ${C.brandM}`, background: C.surface,
          color: C.brand, fontSize: 13, fontWeight: 800, cursor: "pointer", textAlign: "left" }}>
        🔔 이벤트 시작·마감 알림 받기 <span style={{ color: C.text3, fontWeight: 600 }}>(광고 수신 동의 · 선택)</span>
      </button>
      {open && (
        <div role="dialog" aria-label="이벤트 알림 받기" onClick={() => !busy && setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.55)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 480, background: C.surface, borderRadius: "22px 22px 0 0", padding: "22px 22px 30px" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>이벤트·혜택 알림(광고) 받기</div>
            <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.7, marginTop: 10 }}>
              · 보내는 곳: 공간마켓<br />
              · 내용: {CURRENT_EVENT.title} 같은 초대 이벤트·공간토큰 혜택 소식(시작·마감 무렵)<br />
              · 방법: 앱 푸시 · 제목에 「(광고)」 표시 · 한국 시간 낮 9시~저녁 8시에만<br />
              · 동의는 선택이에요. 안 해도 공간마켓을 똑같이 쓸 수 있고, 마이 &gt; 푸시 알림에서 언제든 끌 수 있어요.<br />
              · 푸시 알림도 함께 켜져요(대화·계약 알림 포함).
            </div>
            {done && <div style={{ fontSize: 13, color: C.brand, fontWeight: 700, marginTop: 12, lineHeight: 1.5 }}>{done}</div>}
            <button onClick={agree} disabled={busy}
              style={{ marginTop: S.lg, width: "100%", padding: 15, borderRadius: R.lg, border: "none", background: C.brand, color: "#fff", fontSize: 15, fontWeight: 800, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}>
              {busy ? "켜는 중…" : "동의하고 알림 받기"}
            </button>
            <button onClick={later} disabled={busy}
              style={{ marginTop: 8, width: "100%", padding: 12, background: "none", border: "none", color: C.text3, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
              다음에 할게요
            </button>
          </div>
        </div>
      )}
    </>
  );
}
