import { useEffect, useState } from "react";
import { C, R, S } from "../../constants";
import { getAdminUspBoard } from "../../lib/supabase";
import { uspRows, uspSummary } from "../../lib/uspBoard";

// USP 12 «사용 → 전환»(187 admin_usp_board · docs/USP-2026-10-01.md) — 어떤 USP 가 실제로 다음 단계로 이어지는지.
//   비교(안 쓴 쪽 전환율)가 있으면 몇 %p 차이인지 같이. 숫자가 없으면(그 표가 운영에 없음 · 187 전) «—».
const PERIODS = [7, 30, 90];
const fmt = (v) => (v == null ? "—" : Number(v).toLocaleString("ko-KR"));

export default function UspBoardPanel() {
  const [days, setDays] = useState(30);
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    getAdminUspBoard(days).then(({ data, error }) => {
      if (!alive) return;
      const m = String(error?.message ?? "");
      setState({ loading: false, data: error ? null : data,
        error: !error ? null : /admin_usp_board|PGRST202/.test(m) ? "SQL 187 실행 뒤에 보여요"
          : /NOT_ADMIN|42501/.test(m) ? "관리자 로그인(인증번호)이 필요해요" : "USP 표를 불러오지 못했어요" });
    }).catch(() => alive && setState({ loading: false, data: null, error: "USP 표를 불러오지 못했어요" }));
    return () => { alive = false; };
  }, [days]);

  const rows = uspRows(state.data?.rows);
  const line = `1px solid ${C.bgWarm}`;
  return (
    <div style={{ marginBottom: S.xl }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, marginBottom: S.sm }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>USP 12 + 라운지 · 사용 → 전환</div>
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
          <div style={{ padding: "9px 12px", background: C.brandL, fontSize: 12, color: C.brandD ?? C.brand, fontWeight: 700 }}>
            {state.loading ? "불러오는 중…" : uspSummary(rows)}
          </div>
          {rows.map((r) => (
            <div key={r.id}>
            {r.id === 13 && (
              <div style={{ padding: "7px 12px", borderTop: line, background: C.bg, fontSize: 11.5, fontWeight: 800, color: C.text2 }}>
                공간라운지 — 건강 지표(docs/LOUNGE-USP)
              </div>
            )}
            <div style={{ padding: "9px 12px", borderTop: line }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: S.sm }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.text1, minWidth: 0 }}>
                  <span style={{ color: C.text4, fontWeight: 700, marginRight: 4 }}>{r.id}</span>{r.label}
                  <span style={{ fontSize: 10.5, color: C.text3, fontWeight: 700, marginLeft: 6 }}>{r.who}</span>
                </span>
                <span style={{ fontSize: 13, fontWeight: 900, color: r.rate == null ? C.text4 : C.brand, whiteSpace: "nowrap" }}>
                  {state.loading ? "…" : r.rate == null ? "—" : `${r.rate}%`}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2, lineHeight: 1.5 }}>
                {r.usedLabel} {fmt(r.used)} → {r.convLabel} {fmt(r.converted)}
                {r.baseLabel && (
                  <span style={{ display: "block", color: r.lift == null ? C.text4 : r.lift > 0 ? C.brand : "#B4432F" }}>
                    비교 · {r.baseLabel}: {r.baseRate == null ? "—" : `${r.baseRate}%`}
                    {r.lift != null && ` (${r.lift > 0 ? "+" : ""}${r.lift}%p)`}
                  </span>
                )}
              </div>
            </div>
            </div>
          ))}
          <div style={{ padding: "8px 12px", borderTop: line, fontSize: 11, color: C.text4, lineHeight: 1.5 }}>
            1·3·4·12·13·15 는 앱이 남긴 기록(그 버전부터 쌓임), 나머지는 이미 있는 DB 기록으로 셉니다. 13~15 는 SQL 188 뒤에 나옵니다. 표본이 적을 땐 %를 믿지 마세요.
          </div>
        </div>
      )}
    </div>
  );
}
