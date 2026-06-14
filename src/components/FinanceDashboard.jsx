import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { getAdminProjectFlow } from "../lib/supabase";
import { aggregateFinance, formatWon } from "../lib/financeUtils";

// ── 재무대시보드 — 대표용 돈 흐름 요약(조회/집계 전용) ───────────────────────
// 데이터 소스: admin_project_flow_list(배포 완료) 의 escrow(total_amount/상태).
// 신규 migration 없음. 수수료 4.4%(매출 4.0% + 부가세 0.4%) 기준 집계.
// 토큰 매출 / PG 수수료는 payment_orders RLS 로 코드관리자 직접조회 불가 →
// 1차에서는 미연동(2차 전용 RPC 예정)으로 명시.
export default function FinanceDashboard({ adminUserId, showToast }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState(null);

  const load = async () => {
    setLoading(true); setErrMsg(null);
    const { data, error } = await getAdminProjectFlow(adminUserId, { limit: 1000 });
    if (error) {
      setErrMsg(error.message || "조회 실패");
      setRows([]);
      console.log("[GONGGAN_DEBUG][Finance] error", error.message);
    } else {
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      console.log("[GONGGAN_DEBUG][Finance] count", list.length);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [adminUserId]);

  const f = aggregateFinance(rows);

  const Card = ({ label, value, sub, accent }) => (
    <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg,
      padding: "14px 16px", flex: "1 1 150px", minWidth: 150 }}>
      <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: accent || C.text1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.text4, marginTop: 3 }}>{sub}</div>}
    </div>
  );
  const Group = ({ title, children }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.text2, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{children}</div>
    </div>
  );

  return (
    <div style={{ padding: "8px 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>재무대시보드</div>
        <button onClick={load} disabled={loading}
          style={{ marginLeft: "auto", background: C.bgWarm, color: C.text2, border: "none", borderRadius: R.md, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>새로고침</button>
      </div>
      <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.7, marginBottom: 14 }}>
        에스크로 성립 거래 기준 돈 흐름 요약입니다. 수수료 4.4%(매출 4.0% + 부가세 0.4%) 기준. {loading ? "" : `집계 거래 ${f.contractCount}건.`}
      </div>

      {errMsg && (
        <div style={{ background: "#FFF0F0", color: C.red, border: `1px solid #F5C6C6`, borderRadius: R.lg, padding: "10px 12px", fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>
          조회 실패: {errMsg}
        </div>
      )}

      {loading ? (
        <div style={{ color: C.text3, fontSize: 13, padding: "12px 0" }}>집계 중...</div>
      ) : (
        <>
          <Group title="거래 / 매출">
            <Card label="총 거래액 GMV"        value={formatWon(f.gmv)}     accent={C.brand} />
            <Card label="플랫폼 수수료 총액(4.4%)" value={formatWon(f.feeTotal)} />
            <Card label="매출 공급가액(4.0%)"   value={formatWon(f.revenue)} accent="#27AE60" />
            <Card label="수수료 부가세(0.4%)"   value={formatWon(f.feeVat)} />
          </Group>

          <Group title="정산">
            <Card label="정산 대기금액" value={formatWon(f.settleReady)} accent="#E67E22" sub="업체 정산예정금" />
            <Card label="정산 완료금액" value={formatWon(f.settleDone)}  accent="#27AE60" />
            <Card label="정산 보류금액" value={formatWon(f.settleHeld)}  accent="#E74C3C" sub="분쟁/보류" />
          </Group>

          <Group title="예상 세무">
            <Card label="예상 VAT"   value={formatWon(f.expectedVat)} sub="수수료 부가세 기준" />
            <Card label="예상 순매출" value={formatWon(f.expectedNet)} accent="#27AE60" sub="매출 공급가액 기준" />
          </Group>

          <Group title="토큰 / PG (2차 연동 예정)">
            <Card label="토큰 매출"   value="—" sub="payment_orders RPC 연동 예정" />
            <Card label="토큰 부가세" value="—" sub="2차" />
            <Card label="PG 수수료"   value="—" sub="고객부담 · 매출 제외" />
          </Group>

          <div style={{ fontSize: 11, color: C.text4, lineHeight: 1.6, marginTop: 4 }}>
            ※ GMV/수수료/정산은 에스크로(total_amount·상태) 기준 집계입니다. 토큰 매출·PG 수수료는 payment_orders 가 RLS(auth.uid) 로 코드관리자 직접조회 불가하여 2차(security-definer RPC) 연동 시 표기됩니다. 고객부담 PG 결제수수료·가상계좌 수수료·업체 시공대금·부가세·에스크로 보관금은 플랫폼 매출에서 제외합니다.
          </div>
        </>
      )}
    </div>
  );
}
