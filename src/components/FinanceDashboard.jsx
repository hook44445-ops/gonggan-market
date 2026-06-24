import { useState } from "react";
import { C, R, S } from "../constants";
import { aggregateFinance, buildTimeSeries, formatWon } from "../lib/financeUtils";
import { isTestRow } from "../lib/testAccounts";
import { useAdminProjectFlow } from "../hooks/useAdminProjectFlow";
import { downloadCsv, csvStamp } from "../utils/exportCsv";

// ── 재무대시보드 — 대표 운영용 KPI(조회/집계 전용) ─────────────────────────
// 데이터 소스: admin_project_flow_list(배포 완료) 의 escrow(total_amount/상태/일자).
// 신규 migration 없음. 수수료 4.4%(매출 4.0% + 부가세 0.4%) 기준 집계.
// 토큰 매출 / PG 수수료는 payment_orders RLS 로 코드관리자 직접조회 불가 →
// 1차에서는 미연동(2차 전용 RPC 예정)으로 명시.
const PERIODS = [["day", "일별"], ["week", "주별"], ["month", "월별"]];
const PERIOD_LIMIT = { day: 14, week: 12, month: 12 };

export default function FinanceDashboard({ adminUserId, showToast }) {
  const { rows, loading, errMsg, testSet, reload } = useAdminProjectFlow(adminUserId, { limit: 1000 });
  const [period, setPeriod]   = useState("day");
  // 테스트 거래 제외(기본 true). 토글로 포함 가능.
  const [excludeTest, setExcludeTest] = useState(true);

  // 집계 입력 행만 필터(계산식 미변경). 기본: 테스트 거래 제외.
  const testCount = rows.filter(r => isTestRow(r, testSet)).length;
  const calcRows = excludeTest ? rows.filter(r => !isTestRow(r, testSet)) : rows;
  const f = aggregateFinance(calcRows);
  const series = buildTimeSeries(calcRows, period, PERIOD_LIMIT[period]);
  const maxGmv = Math.max(1, ...series.map(s => s.gmv));

  // CSV 다운로드 — 현재 집계(KPI 요약 + 기간별 추이). 테스트 제외 토글 상태 반영, 계산 로직 미변경.
  const exportCsv = () => {
    const summary = [
      { 지표: "총 거래액 GMV(원)", 값: f.gmv },
      { 지표: "총 계약건수", 값: f.contractCount },
      { 지표: "총 결제건수", 값: f.paidCount },
      { 지표: "총 정산건수", 값: f.settledCount },
      { 지표: "플랫폼 수수료 총액(원)", 값: f.feeTotal },
      { 지표: "매출 공급가액(원)", 값: f.revenue },
      { 지표: "수수료 부가세(원)", 값: f.feeVat },
      { 지표: "순매출(원)", 값: f.expectedNet },
      { 지표: "예상 정산액(원)", 값: f.expectedPayout },
      { 지표: "지급완료액(원)", 값: f.settleDone },
      { 지표: "미정산금액(원)", 값: f.unsettled },
      { 지표: "정산 보류금액(원)", 값: f.settleHeld },
      { 지표: "예상 VAT(원)", 값: f.expectedVat },
    ];
    downloadCsv(`재무대시보드_요약_${csvStamp()}.csv`, summary, [
      { label: "지표", key: "지표" }, { label: "값", key: "값" },
    ]);
    downloadCsv(`재무대시보드_추이_${csvStamp()}.csv`, series, [
      { label: "기간", key: "label" }, { label: "거래건수", key: "count" }, { label: "거래액(원)", key: "gmv" },
    ]);
  };

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
  const Chip = ({ active, onClick, children }) => (
    <button onClick={onClick}
      style={{ padding: "5px 12px", borderRadius: R.full, fontSize: 12, fontWeight: 700,
        border: `1px solid ${active ? C.brand : C.bgWarm}`, cursor: "pointer",
        background: active ? C.brand : C.surface, color: active ? "#fff" : C.text2 }}>{children}</button>
  );

  return (
    <div style={{ padding: "8px 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>재무대시보드</div>
        <button onClick={exportCsv} disabled={loading}
          style={{ marginLeft: "auto", background: C.brandL, color: C.brand, border: `1px solid ${C.brandM ?? C.bgWarm}`, borderRadius: R.md, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>CSV 다운로드</button>
        <button onClick={reload} disabled={loading}
          style={{ background: C.bgWarm, color: C.text2, border: "none", borderRadius: R.md, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>새로고침</button>
      </div>
      <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.7, marginBottom: 10 }}>
        에스크로 성립 거래 기준 돈 흐름 요약입니다. 수수료 4.4%(매출 4.0% + 부가세 0.4%) 기준. {loading ? "" : `집계 거래 ${f.contractCount}건.`}
      </div>

      {/* 테스트 거래 제외 토글 — 기본 제외(실거래 기준 통계) */}
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 14, cursor: "pointer",
        background: C.surface, border: `1px solid ${excludeTest ? C.brand : C.bgWarm}`, borderRadius: R.lg, padding: "8px 12px" }}>
        <input type="checkbox" checked={excludeTest} onChange={e => setExcludeTest(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: C.brand, cursor: "pointer" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text2 }}>
          테스트 거래 제외 {!loading && testCount > 0 && <span style={{ color: C.text4, fontWeight: 500 }}>({testCount}건)</span>}
        </span>
      </label>

      {errMsg && (
        <div style={{ background: "#FFF0F0", color: C.red, border: `1px solid #F5C6C6`, borderRadius: R.lg, padding: "10px 12px", fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>
          조회 실패: {errMsg}
        </div>
      )}

      {loading ? (
        <div style={{ color: C.text3, fontSize: 13, padding: "12px 0" }}>집계 중...</div>
      ) : (
        <>
          <Group title="핵심 지표">
            <Card label="총 거래액 GMV" value={formatWon(f.gmv)} accent={C.brand} />
            <Card label="총 계약건수"   value={`${f.contractCount}건`} />
            <Card label="총 결제건수"   value={`${f.paidCount}건`} />
            <Card label="총 정산건수"   value={`${f.settledCount}건`} />
          </Group>

          <Group title="매출 / 수수료">
            <Card label="플랫폼 수수료 총액(4.4%)" value={formatWon(f.feeTotal)} />
            <Card label="매출 공급가액(4.0%)"   value={formatWon(f.revenue)} accent="#27AE60" />
            <Card label="수수료 부가세(0.4%)"   value={formatWon(f.feeVat)} />
            <Card label="순매출"               value={formatWon(f.expectedNet)} accent="#27AE60" />
          </Group>

          <Group title="정산">
            <Card label="예상 정산액"   value={formatWon(f.expectedPayout)} sub="업체 정산예정금 합계" />
            <Card label="지급완료액"   value={formatWon(f.settleDone)}    accent="#27AE60" />
            <Card label="미정산금액"   value={formatWon(f.unsettled)}     accent="#E67E22" sub="대기+보류" />
            <Card label="정산 보류금액" value={formatWon(f.settleHeld)}    accent="#E74C3C" sub="분쟁/보류" />
          </Group>

          <Group title="세무">
            <Card label="예상 VAT" value={formatWon(f.expectedVat)} sub="수수료 부가세 기준" />
          </Group>

          {/* GMV 추이 차트 */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.text2 }}>거래액(GMV) 추이</div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                {PERIODS.map(([v, l]) => (
                  <Chip key={v} active={period === v} onClick={() => setPeriod(v)}>{l}</Chip>
                ))}
              </div>
            </div>
            {series.length === 0 ? (
              <div style={{ color: C.text4, fontSize: 13, padding: "12px 0" }}>표시할 데이터가 없습니다</div>
            ) : (
              <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "16px 12px" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140 }}>
                  {series.map((s, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0 }}>
                      <div style={{ fontSize: 9, color: C.text4, whiteSpace: "nowrap" }}>{s.count}</div>
                      <div title={formatWon(s.gmv)}
                        style={{ width: "70%", maxWidth: 28, height: `${Math.round((s.gmv / maxGmv) * 100)}%`,
                          minHeight: 2, background: C.brand, borderRadius: 3 }} />
                      <div style={{ fontSize: 9, color: C.text4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: C.text4, marginTop: 8, textAlign: "right" }}>
                  최대 {formatWon(maxGmv)} · 막대 위 숫자 = 건수
                </div>
              </div>
            )}
          </div>

          <Group title="토큰 / PG (2차 연동 예정)">
            <Card label="토큰 매출"   value="—" sub="payment_orders RPC 연동 예정" />
            <Card label="토큰 부가세" value="—" sub="2차" />
            <Card label="PG 수수료"   value="—" sub="고객부담 · 매출 제외" />
          </Group>

          <div style={{ fontSize: 11, color: C.text4, lineHeight: 1.6, marginTop: 4 }}>
            ※ GMV/수수료/정산은 에스크로(total_amount·상태·일자) 기준 집계입니다. 토큰 매출·PG 수수료는 payment_orders 가 RLS(auth.uid)로 코드관리자 직접조회 불가하여 2차(security-definer RPC) 연동 시 표기됩니다. 고객부담 PG 결제수수료·가상계좌 수수료·업체 시공대금·부가세·에스크로 보관금은 플랫폼 매출에서 제외합니다.
          </div>
        </>
      )}
    </div>
  );
}
