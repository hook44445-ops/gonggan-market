import { useEffect, useState } from "react";
import { C, R, S } from "../constants";
import { pickDailyTip, tipRequestPrefill, checkinEarn, daysToBonus, CHECKIN_REWARD } from "../constants/dailyTips";
import { requestPrefillFromPost } from "../lib/loungeToRequest";
import { getDailyCheckinStatus, dailyCheckin } from "../lib/supabase";

// 홈 «오늘의 집 관리 한 줄 + 출석 도장»(대표 09-29 「1등 재방문」)
//   팁은 누구나(한국 날짜로 매일 바뀜). 도장은 로그인한 사람 — 하루 +1, 7일 연속마다 +5(162).
//   SQL 전이거나 실패하면 도장 줄만 안 보이고 팁은 그대로.
export default function DailyHomeCard({ user, isCompany = false, onTipRequest, onHomeCare }) {
  const tip = pickDailyTip();
  const prefill = !isCompany ? tipRequestPrefill(tip, requestPrefillFromPost) : null;
  const canCheck = !!user?.id && !user?.isGuest;
  const [st, setSt] = useState(null);        // { checked, streak } | null(모름 · SQL 전)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!canCheck) return;
    let alive = true;
    getDailyCheckinStatus().then(({ data, error }) => { if (alive && !error && data?.ok) setSt({ checked: !!data.checked, streak: Number(data.streak) || 0 }); }).catch(() => {});
    return () => { alive = false; };
  }, [canCheck, user?.id]);

  const stamp = async () => {
    if (busy || st?.checked) return;
    setBusy(true);
    try {
      const { data, error } = await dailyCheckin();
      if (error || !data?.ok) throw error ?? new Error("FAIL");
      setSt({ checked: true, streak: Number(data.streak) || 1 });
      if (data.earned > 0) {
        setMsg(data.earned > CHECKIN_REWARD.daily ? `연속 ${data.streak}일 보너스! 공간토큰 +${data.earned}` : `공간토큰 +${data.earned}`);
        try { window.dispatchEvent(new Event("gonggan:tokens-changed")); } catch { /* noop */ }
      }
    } catch { setMsg("지금은 도장을 찍을 수 없어요 · 잠시 뒤 다시"); }
    setBusy(false);
  };

  const k = new Date(Date.now() + 9 * 3600000);
  const dateLabel = `${k.getUTCMonth() + 1}월 ${k.getUTCDate()}일`;
  const nextBonus = st ? daysToBonus(st.checked ? st.streak : st.streak) : null;

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.brand }}>🏠 오늘의 집 관리</span>
        <span style={{ fontSize: 11.5, color: C.text3 }}>{dateLabel}</span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginTop: 6 }}>{tip.title}</div>
      <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6, marginTop: 4 }}>{tip.body}</div>
      {prefill && onTipRequest && (
        <button onClick={() => onTipRequest(prefill)}
          style={{ marginTop: 6, background: "none", border: "none", padding: 0, color: C.text3, fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
          이 공사, 견적 비교해 보기
        </button>
      )}

      {canCheck && !isCompany && onHomeCare && (
        <button onClick={onHomeCare}
          style={{ display: "block", marginTop: 8, background: C.brandL, border: "none", borderRadius: R.md, padding: "9px 12px", width: "100%", textAlign: "left",
            color: C.brand, fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
          🗓 내 집 관리 수첩 · 다음에 할 때 알려 드려요 ›
        </button>
      )}
      {canCheck && st && (
        <div style={{ marginTop: S.md, paddingTop: S.md, borderTop: `1px dashed ${C.bgWarm}`, display: "flex", alignItems: "center", gap: S.md }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>
              {st.checked ? `✓ 오늘 출석 · 연속 ${st.streak}일` : st.streak > 0 ? `출석 연속 ${st.streak}일째 이어가기` : "출석 도장 찍기"}
            </div>
            <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>
              {msg ?? (st.checked
                ? (nextBonus === 0 ? "오늘 7일 보너스를 받았어요" : `${nextBonus}일 더 오면 보너스 +${CHECKIN_REWARD.weeklyBonus}`)
                : `매일 +${CHECKIN_REWARD.daily} · 7일 연속마다 +${CHECKIN_REWARD.weeklyBonus} 공간토큰${checkinEarn(st.streak + 1) > CHECKIN_REWARD.daily ? " · 오늘 보너스 날!" : ""}`)}
            </div>
          </div>
          {!st.checked && (
            <button onClick={stamp} disabled={busy}
              style={{ flexShrink: 0, padding: "9px 14px", borderRadius: R.full, border: "none", background: C.brand, color: "#fff", fontSize: 13, fontWeight: 800, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}>
              {busy ? "…" : "도장 찍기"}
            </button>
          )}
        </div>
      )}
      {!canCheck && (
        <div style={{ marginTop: S.sm, fontSize: 11.5, color: C.text3 }}>로그인하면 매일 출석 도장으로 공간토큰을 모을 수 있어요</div>
      )}
    </div>
  );
}
