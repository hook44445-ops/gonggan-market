import { useEffect, useState } from "react";
import { C, R, S, SHADOW } from "../constants";
import { getMyReferral, getReferralEventBoard } from "../lib/supabase";
import { CURRENT_EVENT, eventStatus, eventLine, prizeFor } from "../lib/referralEvent";
import { inviteUrl, inviteMessage, testerUrl, testerMessage, REFERRAL_REWARD } from "../lib/referral";

// ════════════════════════════════════════════════════════════════════════════
// 친구 초대 — 내 초대 링크를 공유하고, 몇 명이 이 링크로 가입했는지 본다(대표 09-28 · 146).
//   보상은 아직 없다(대표 결정 뒤) — 있는 척 쓰지 않는다.
// ════════════════════════════════════════════════════════════════════════════

export default function InviteScreen({ isCompany = false, onBack }) {
  const [state, setState] = useState({ loading: true, code: null, invited: 0, error: null });
  const [copied, setCopied] = useState(false);
  // 초대왕 이벤트(155) — 순위판. SQL 전이거나 실패하면 카드만(순위 없이) 보인다.
  const [board, setBoard] = useState(null);
  useEffect(() => {
    let alive = true;
    getReferralEventBoard(CURRENT_EVENT.id).then(({ data, error }) => { if (alive && !error && data?.ok) setBoard(data); }).catch(() => {});
    return () => { alive = false; };
  }, []);

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

  const link = state.code ? inviteUrl(state.code, isCompany) : "";
  const message = state.code ? inviteMessage(state.code, isCompany) : "";

  // which: "invite"(가입 초대) | "tester"(안드로이드 테스트 참여)
  const copy = async (which = "invite") => {
    const text = which === "tester" ? testerMessage(state.code) : message;
    try { await navigator.clipboard.writeText(text); setCopied(which); setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt("아래 링크를 복사해 주세요", which === "tester" ? testerUrl(state.code) : link); }
  };
  const share = async (which = "invite") => {
    const text = which === "tester" ? testerMessage(state.code) : message;
    if (navigator.share) {
      try { await navigator.share({ title: "공간마켓", text }); } catch { /* 공유 취소 */ }
      return;
    }
    copy(which);
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

      {/* 초대왕 이벤트 — 10월 한 달 · 1~3등 토큰(155) */}
      {eventStatus(CURRENT_EVENT) !== "ended" || board ? (
        <div style={{ background: "#0E2B1D", color: "#F4EFE4", borderRadius: R.xl, padding: S.lg, marginBottom: S.lg }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: S.sm }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>🏆 {CURRENT_EVENT.title} 이벤트</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#D6A756", whiteSpace: "nowrap" }}>{eventLine(CURRENT_EVENT)}</div>
          </div>
          <div style={{ fontSize: 12.5, color: "rgba(244,239,228,0.8)", marginTop: 6, lineHeight: 1.6 }}>
            10월 한 달 동안 내 링크로 가입한 사람이 가장 많은 세 분께 공간토큰을 드려요. 친구 초대 보상(+{REFERRAL_REWARD.inviter})과 따로예요.
          </div>
          {board?.me?.rank && (
            <div style={{ marginTop: 10, fontSize: 13.5, fontWeight: 800 }}>
              내 순위 {board.me.rank}등 · {board.me.count}명{prizeFor(board.me.rank) ? ` · 지금이면 +${prizeFor(board.me.rank)}` : ""}
            </div>
          )}
          {(board?.top ?? []).length > 0 && (
            <div style={{ marginTop: 10, borderTop: "1px solid rgba(214,167,86,0.35)", paddingTop: 8 }}>
              {board.top.slice(0, 5).map((t) => (
                <div key={t.rank} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0",
                  color: t.rank <= 3 ? "#F4EFE4" : "rgba(244,239,228,0.7)", fontWeight: t.rank <= 3 ? 800 : 600 }}>
                  <span>{t.rank}등 · {t.name}</span><span>{t.count}명</span>
                </div>
              ))}
            </div>
          )}
          {board?.settled && <div style={{ marginTop: 8, fontSize: 12, color: "#D6A756", fontWeight: 800 }}>상품 지급을 마쳤어요</div>}
        </div>
      ) : null}

      {state.code && (
        <>
          <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.xl, padding: S.xl,
            boxShadow: SHADOW.soft, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", gap: S.sm, marginBottom: S.lg }}>
              {[["친구가 가입하면 나", REFERRAL_REWARD.inviter], ["가입한 친구도", REFERRAL_REWARD.invitee]].map(([k, v]) => (
                <div key={k} style={{ flex: 1, background: C.brandL, borderRadius: R.lg, padding: "10px 6px" }}>
                  <div style={{ fontSize: 11.5, color: C.text2, fontWeight: 700 }}>{k}</div>
                  <div style={{ fontSize: 19, fontWeight: 900, color: C.brand, marginTop: 2 }}>+{v} 토큰</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: C.text3, fontWeight: 700 }}>내 초대 코드</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: C.brand, letterSpacing: "0.18em", margin: "6px 0 4px" }}>{state.code}</div>
            <div style={{ fontSize: 12, color: C.text3, wordBreak: "break-all" }}>{link}</div>
            <div style={{ display: "flex", gap: S.sm, marginTop: S.lg }}>
              <button onClick={() => copy("invite")}
                style={{ flex: 1, padding: "12px 0", borderRadius: R.md, border: `1px solid ${C.bgWarm}`, background: C.surface,
                  color: C.text2, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                {copied === "invite" ? "복사했어요" : "링크 복사"}
              </button>
              <button onClick={() => share("invite")}
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
            한 달에 {REFERRAL_REWARD.monthlyCap}명까지 보상해 드려요.
          </div>

          {/* 안드로이드 테스터 모집 — Play 정식 출시 전 비공개 테스트 참여자가 필요하다(09-28) */}
          <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.xl, padding: S.lg, marginTop: S.xl }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>안드로이드 앱 테스터 모집</div>
            <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.6, marginTop: 6 }}>
              Play 스토어 정식 출시 전이라 앱을 먼저 설치해 줄 분이 필요해요.
              링크를 받은 분이 「테스트 참여」 후 설치해 두면 됩니다. 이 링크로 가입해도 초대 수에 잡혀요.
            </div>
            <div style={{ display: "flex", gap: S.sm, marginTop: S.md }}>
              <button onClick={() => copy("tester")}
                style={{ flex: 1, padding: "11px 0", borderRadius: R.md, border: `1px solid ${C.bgWarm}`, background: C.surface,
                  color: C.text2, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                {copied === "tester" ? "복사했어요" : "링크 복사"}
              </button>
              <button onClick={() => share("tester")}
                style={{ flex: 2, padding: "11px 0", borderRadius: R.md, border: `1.5px solid ${C.brand}`, background: C.brandL,
                  color: C.brand, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                테스터 부탁 보내기
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
