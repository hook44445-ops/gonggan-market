import { useEffect, useState } from "react";
import { C, R, S } from "../../constants";
import { getPartnerFunnel } from "../../lib/supabase";
import { PARTNER_FUNNEL_ACTIONS, FUNNEL_DOC_CTA, summarizePartnerFunnel, weakestStep } from "../../lib/partnerFunnel";

// 업체 가입 깔때기(10-02 · «업체 10곳» 병목) — 입점 페이지 → 가입 3단계 → 사업자 확인 → 첫 입찰, 어디서 많이 빠지나.
//   앞 4줄은 10-02 배포부터 쌓이는 기록이고, 뒤 3줄(가입 마침 · 사업자 확인 · 입찰)은 실제 표에서 센다.
const PERIODS = [7, 14, 30];
const fmt = (v) => (v == null ? "—" : Number(v).toLocaleString("ko-KR"));

export default function PartnerFunnelPanel() {
  const [days, setDays] = useState(14);
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    getPartnerFunnel(days, PARTNER_FUNNEL_ACTIONS).then((data) => {
      if (!alive) return;
      const m = String(data?.error?.message ?? "");
      setState({ loading: false, data,
        error: data?.error && !data.logs && !data.companies
          ? (/42501|JWT|permission/i.test(m) ? "관리자 로그인(인증번호)이 필요해요" : "깔때기를 불러오지 못했어요") : null });
    }).catch(() => alive && setState({ loading: false, data: null, error: "깔때기를 불러오지 못했어요" }));
    return () => { alive = false; };
  }, [days]);

  const rows = summarizePartnerFunnel(state.data ?? {});
  const worst = weakestStep(rows);
  const docCta = Array.isArray(state.data?.logs) ? state.data.logs.filter((r) => r?.action === FUNNEL_DOC_CTA).length : null;
  const line = `1px solid ${C.bgWarm}`;
  return (
    <div style={{ marginBottom: S.xl }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, marginBottom: S.sm }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>업체 가입 깔때기</div>
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
          <div style={{ padding: "8px 12px", borderTop: line, fontSize: 11.5, color: C.text3, lineHeight: 1.6 }}>
            가입 마친 화면에서 바로 «사업자등록증 올리기»: {fmt(docCta)} · «기록» 줄은 10-02 배포부터 쌓여요(같은 창에서 한 번) · 테스트 업체 제외
          </div>
        </div>
      )}
    </div>
  );
}
