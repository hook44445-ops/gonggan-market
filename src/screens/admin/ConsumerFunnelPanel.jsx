import { useEffect, useState } from "react";
import { C, R, S } from "../../constants";
import { getConsumerFunnel } from "../../lib/supabase";
import { CONSUMER_FUNNEL_ACTIONS, summarizeConsumerFunnel, consumerFunnelByDay } from "../../lib/consumerFunnel";
import { weakestStep } from "../../lib/partnerFunnel";

// 고객 견적 깔때기(10-09 일감 3) — 첫 화면 → 견적 단추 → 요청서 쓰기 → 번호 인증 → 요청 발송, 어디서 많이 빠지나.
//   앞 5줄은 10-09 배포부터 쌓이는 기록(개수만 · 같은 창에서 한 번), 마지막 줄은 실제 요청 표에서 센다.
const PERIODS = [7, 14, 30];
const SHORT = ["방문", "단추", "쓰기", "인증↗", "인증✓", "발송"];
const fmt = (v) => (v == null ? "—" : Number(v).toLocaleString("ko-KR"));

export default function ConsumerFunnelPanel() {
  const [days, setDays] = useState(14);
  const [showDays, setShowDays] = useState(false);
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    getConsumerFunnel(days, CONSUMER_FUNNEL_ACTIONS).then((data) => {
      if (!alive) return;
      const m = String(data?.error?.message ?? "");
      setState({ loading: false, data,
        error: data?.error && !data.logs && !data.requests
          ? (/42501|JWT|permission/i.test(m) ? "관리자 로그인(인증번호)이 필요해요" : "깔때기를 불러오지 못했어요") : null });
    }).catch(() => alive && setState({ loading: false, data: null, error: "깔때기를 불러오지 못했어요" }));
    return () => { alive = false; };
  }, [days]);

  const rows = summarizeConsumerFunnel(state.data ?? {});
  const worst = weakestStep(rows);
  const byDay = consumerFunnelByDay(state.data ?? {}, Math.min(days, 14));
  const keys = rows.map((r) => r.key);
  const line = `1px solid ${C.bgWarm}`;
  return (
    <div style={{ marginBottom: S.xl }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, marginBottom: S.sm }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>고객 견적 깔때기</div>
        <div style={{ display: "flex", gap: 4 }}>
          {PERIODS.map((d) => (
            <button key={d} onClick={() => setDays(d)}
              style={{ padding: "4px 10px", borderRadius: R.full, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${d === days ? C.brand : C.bgWarm}`, background: d === days ? C.brandL : C.surface, color: d === days ? C.brand : C.text3 }}>
              {d}일
            </button>
          ))}
        </div>
      </div>
      {state.error ? (
        <div style={{ background: C.surface, borderRadius: R.lg, padding: S.lg, border: line, fontSize: 12.5, color: C.text3 }}>{state.error}</div>
      ) : (
        <div style={{ background: C.surface, borderRadius: R.lg, border: line, overflow: "hidden" }}>
          <div style={{ padding: "9px 12px", background: C.brandL, fontSize: 12, color: C.brandD ?? C.brand, fontWeight: 700, lineHeight: 1.6 }}>
            {state.loading ? "불러오는 중…"
              : worst ? `가장 많이 빠지는 곳: «${worst.from}» → «${worst.label}» (${worst.rate}%)`
              : "아직 숫자가 적어요(앞 단계 5 미만) — 쌓이면 가장 많이 빠지는 곳을 짚어 드려요"}
          </div>
          {rows.map((r, i) => (
            <div key={r.key} style={{ padding: "9px 12px", borderTop: line, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: S.sm }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>
                <span style={{ color: C.text4, marginRight: 6 }}>{i + 1}</span>{r.label}
                {r.source === "log" && <span style={{ fontSize: 11, color: C.text4, fontWeight: 600 }}> · 기록</span>}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: C.text1, whiteSpace: "nowrap" }}>
                {fmt(r.count)}{r.rate != null && <span style={{ fontSize: 11.5, color: C.text3, fontWeight: 700 }}> · {r.rate}%</span>}
              </span>
            </div>
          ))}
          <button onClick={() => setShowDays((v) => !v)}
            style={{ width: "100%", padding: "8px 12px", border: "none", borderTop: line, background: "transparent",
              fontSize: 12, fontWeight: 700, color: C.brand, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
            {showDays ? "날짜별 접기 ▲" : "날짜별 보기 ▼"}
          </button>
          {showDays && !state.loading && (
            <div style={{ overflowX: "auto", borderTop: line }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, color: C.text2 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: 700 }}>날짜</th>
                    {SHORT.map((h) => <th key={h} style={{ textAlign: "right", padding: "6px 6px", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {byDay.map((d) => (
                    <tr key={d.day} style={{ borderTop: line }}>
                      <td style={{ padding: "6px 10px", whiteSpace: "nowrap" }}>{d.day.slice(5)}</td>
                      {keys.map((k) => <td key={k} style={{ textAlign: "right", padding: "6px 6px", fontWeight: 700, color: C.text1 }}>{d.counts[k] ?? 0}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: "8px 12px", borderTop: line, fontSize: 11.5, color: C.text3, lineHeight: 1.6 }}>
            «기록» 줄은 10-09 배포부터 쌓여요(개수만 · 같은 창에서 한 번) · «견적 요청 발송»은 실제 요청 수
          </div>
        </div>
      )}
    </div>
  );
}
