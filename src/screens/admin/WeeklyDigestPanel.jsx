import { useState } from "react";
import { C, R, S } from "../../constants";
import { getAdminGrowthStats, getAdminPushReach, getAdminNotifyStats, getAdminUspBoard } from "../../lib/supabase";
import { buildWeeklyMarkdown, weeklyFileName } from "../../lib/weeklyDigest";

// 월요일 주간 숫자 한 장(PLAN 5절) — 누르면 관리자 숫자 넷을 모아 마크다운으로 · 복사해서 docs/WEEKLY-날짜.md 로.
//   눌렀을 때만 불러온다(대시보드 첫 화면을 무겁게 하지 않는다). 못 받은 숫자는 «—».
export default function WeeklyDigestPanel() {
  const [state, setState] = useState({ busy: false, md: "", copied: false, note: null });
  const make = async () => {
    setState((s) => ({ ...s, busy: true, copied: false, note: null }));
    const safe = (p) => Promise.resolve(p).then((r) => (r?.error ? null : r?.data ?? null)).catch(() => null);
    const [growth, pushReach, notify, uspData] = await Promise.all([
      safe(getAdminGrowthStats()), safe(getAdminPushReach()), safe(getAdminNotifyStats()), safe(getAdminUspBoard(7)),
    ]);
    const md = buildWeeklyMarkdown({ growth, pushReach, notify: notify ?? [], uspData, days: 7 });
    const missing = [!growth && "성장", !pushReach && "푸시", !notify && "알림", !uspData && "USP"].filter(Boolean);
    setState({ busy: false, md, copied: false, note: missing.length ? `못 불러온 숫자: ${missing.join(" · ")} — 그 칸은 «—»로 둡니다` : null });
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(state.md); setState((s) => ({ ...s, copied: true })); }
    catch { window.prompt("아래를 복사해 주세요", state.md); }
  };
  const line = `1px solid ${C.bgWarm}`;
  return (
    <div style={{ marginBottom: S.xl }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, marginBottom: S.sm }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>월요일 주간 숫자 · 한 장</div>
        <button onClick={make} disabled={state.busy}
          style={{ padding: "6px 12px", borderRadius: R.full, border: `1px solid ${C.brand}`, background: C.brandL, color: C.brand,
            fontSize: 12.5, fontWeight: 800, cursor: state.busy ? "default" : "pointer", fontFamily: "inherit" }}>
          {state.busy ? "모으는 중…" : state.md ? "다시 만들기" : "이번 주 숫자 만들기"}
        </button>
      </div>
      {!state.md ? (
        <div style={{ background: C.surface, borderRadius: R.lg, padding: S.lg, border: line, fontSize: 12.5, color: C.text3, lineHeight: 1.6 }}>
          성장 · 푸시 · 알림 읽음률 · USP 표(7일)를 한 장으로 모아요. 복사해서 <b>{weeklyFileName()}</b> 로 붙이고, 맨 아래 «고른 것»에 이번 주 하나를 적어 Claude 에게 주세요.
        </div>
      ) : (
        <div style={{ background: C.surface, borderRadius: R.lg, border: line, overflow: "hidden" }}>
          {state.note && <div style={{ padding: "8px 12px", fontSize: 11.5, color: "#8A5A12", background: "#FBF3E4", borderBottom: line }}>{state.note}</div>}
          <pre style={{ margin: 0, padding: 12, maxHeight: 320, overflow: "auto", fontSize: 11.5, lineHeight: 1.55, color: C.text2,
            whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{state.md}</pre>
          <div style={{ padding: "8px 12px", borderTop: line, display: "flex", justifyContent: "space-between", alignItems: "center", gap: S.sm }}>
            <span style={{ fontSize: 11.5, color: C.text3 }}>{weeklyFileName()}</span>
            <button onClick={copy}
              style={{ padding: "6px 14px", borderRadius: R.full, border: "none", background: C.brand, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
              {state.copied ? "복사했어요" : "복사"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
