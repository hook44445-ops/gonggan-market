import { useEffect, useState } from "react";
import { C, R, S, SHADOW } from "../constants";
import { getMyReferral } from "../lib/supabase";
import { inviteUrl, inviteMessage } from "../lib/referral";

// ════════════════════════════════════════════════════════════════════════════
// 친구 초대 — 내 초대 링크를 공유하고, 몇 명이 이 링크로 가입했는지 본다(대표 09-28 · 146).
//   보상은 아직 없다(대표 결정 뒤) — 있는 척 쓰지 않는다.
// ════════════════════════════════════════════════════════════════════════════

export default function InviteScreen({ isCompany = false, onBack }) {
  const [state, setState] = useState({ loading: true, code: null, invited: 0, error: null });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    getMyReferral().then(({ data, error }) => {
      if (!alive) return;
      if (error || !data?.code) {
        const m = String(error?.message ?? "");
        setState({ loading: false, code: null, invited: 0,
          error: /LOGIN_REQUIRED|JWT|401/.test(m) ? "로그인이 풀렸어요 — 인증번호로 다시 로그인해 주세요"
            : "초대 링크를 아직 만들 수 없어요 — 잠시 뒤 다시 열어 주세요" });
        return;
      }
      setState({ loading: false, code: data.code, invited: Number(data.invited) || 0, error: null });
    }).catch(() => alive && setState({ loading: false, code: null, invited: 0, error: "초대 링크를 불러오지 못했어요" }));
    return () => { alive = false; };
  }, []);

  const link = state.code ? inviteUrl(state.code) : "";
  const message = state.code ? inviteMessage(state.code, isCompany) : "";

  const copy = async () => {
    try { await navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt("아래 링크를 복사해 주세요", link); }
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "공간마켓", text: message }); } catch { /* 공유 취소 */ }
      return;
    }
    copy();
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.md, marginBottom: S.lg }}>
        <button onClick={onBack} aria-label="뒤로가기"
          style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.text1, padding: 0 }}>←</button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>{isCompany ? "동료 사장님 초대" : "친구 초대"}</div>
          <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>
            {isCompany ? "아는 사장님이 들어오면 동네에 받을 수 있는 공사가 넓어져요" : "집 고칠 일이 있는 친구에게 알려 주세요"}
          </div>
        </div>
      </div>

      {state.loading && <div style={{ fontSize: 13, color: C.text3, padding: S.lg, textAlign: "center" }}>불러오는 중…</div>}
      {state.error && (
        <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: S.lg, fontSize: 13, color: C.text2 }}>
          {state.error}
        </div>
      )}

      {state.code && (
        <>
          <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.xl, padding: S.xl,
            boxShadow: SHADOW.soft, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: C.text3, fontWeight: 700 }}>내 초대 코드</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: C.brand, letterSpacing: "0.18em", margin: "6px 0 4px" }}>{state.code}</div>
            <div style={{ fontSize: 12, color: C.text3, wordBreak: "break-all" }}>{link}</div>
            <div style={{ display: "flex", gap: S.sm, marginTop: S.lg }}>
              <button onClick={copy}
                style={{ flex: 1, padding: "12px 0", borderRadius: R.md, border: `1px solid ${C.bgWarm}`, background: C.surface,
                  color: C.text2, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                {copied ? "복사했어요" : "링크 복사"}
              </button>
              <button onClick={share}
                style={{ flex: 2, padding: "12px 0", borderRadius: R.md, border: "none", background: C.brand, color: "#fff",
                  fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
                카카오톡·문자로 보내기
              </button>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: S.lg,
            background: C.brandL, border: `1px solid ${C.brandM}`, borderRadius: R.lg, padding: `${S.md}px ${S.lg}px` }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text2 }}>내 링크로 가입한 사람</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: C.brand }}>{state.invited}명</span>
          </div>

          <div style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.6, marginTop: S.md, padding: `0 ${S.xs}px` }}>
            링크로 들어와 새로 가입한 사람만 셉니다. 이미 가입한 사람은 세지 않아요.
          </div>
        </>
      )}
    </div>
  );
}
