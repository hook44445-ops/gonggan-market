import { useState, useEffect } from "react";
import { C, R } from "../constants";
import { getAdminProjectFlow, getTestAccounts } from "../lib/supabase";
import { manwonToWon, formatWon, contractFinance, aggregateFinance, buildTimeSeries } from "../lib/financeUtils";
import { buildTestAccountSet, isTestRow } from "../lib/testAccounts";

// ── KPI 대시보드(ADMIN FINISH PACK · 1차) — 오늘 지표 + 7일 추세(조회 전용) ──────
// 기존 대시보드 위에 '추가'만 한다. 데이터: 기존 companies/customers state +
// getAdminProjectFlow(기존 RPC). 신규 DB/RPC/Migration 없음. 재무 지표는 테스트거래 제외.
const todayKo = () => new Date().toLocaleDateString("ko-KR");
const isToday = (t) => !!t && new Date(t).toLocaleDateString("ko-KR") === todayKo();

export default function AdminKpiPanel({ adminUserId, companies = [], customers = [] }) {
  const [rows, setRows]       = useState([]);
  const [testSet, setTestSet] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data: ta } = await getTestAccounts(adminUserId);
        if (alive) setTestSet(buildTestAccountSet(Array.isArray(ta) ? ta : []));
      } catch { if (alive) setTestSet(buildTestAccountSet([])); }
      const { data } = await getAdminProjectFlow(adminUserId, { limit: 1000 });
      if (alive) { setRows(Array.isArray(data) ? data : []); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [adminUserId]);

  // 오늘 가입(기존 state 의 현지화 날짜 문자열 기준)
  const t = todayKo();
  const newCustomers = customers.filter((c) => c.joinedAt === t).length;
  const newCompanies = companies.filter((c) => c.submittedAt === t).length;

  // 거래 기반 지표 — 테스트 거래 제외(재무대시보드와 동일 기준)
  const realRows = rows.filter((r) => !isTestRow(r, testSet));
  const todayRequests = realRows.filter((r) => isToday(r.created_at)).length;
  const todayContracts = realRows.filter((r) => r.escrow && isToday(r.escrow.step1_deposited_at));
  const todayGmv = todayContracts.reduce((sum, r) => sum + contractFinance(manwonToWon(r.escrow?.total_amount)).gmv, 0);
  const fin = aggregateFinance(realRows);

  // 최근 7일 거래액 추세
  const series = buildTimeSeries(realRows, "day", 7);
  const maxGmv = Math.max(1, ...series.map((s) => s.gmv));

  const Card = ({ label, value, accent, sub }) => (
    <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "12px 14px", flex: "1 1 30%", minWidth: 100 }}>
      <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 900, color: accent || C.text1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: C.text4, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: 8 }}>
        오늘의 지표 <span style={{ fontSize: 11, color: C.text4, fontWeight: 500 }}>· {t}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <Card label="오늘 가입 고객" value={`${newCustomers}명`} accent={C.brand} />
        <Card label="오늘 가입 업체" value={`${newCompanies}곳`} accent={C.brand} />
        <Card label="오늘 견적 요청" value={loading ? "…" : `${todayRequests}건`} />
        <Card label="오늘 계약 건수" value={loading ? "…" : `${todayContracts.length}건`} accent="#2980B9" />
        <Card label="오늘 거래액" value={loading ? "…" : formatWon(todayGmv)} accent="#27AE60" />
        <Card label="정산 대기 금액" value={loading ? "…" : formatWon(fin.settleReady)} accent="#E67E22" sub="누적 정산 대기" />
      </div>

      {/* 최근 7일 거래액 추세 */}
      <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "12px 12px" }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text3, marginBottom: 8 }}>최근 7일 거래액 추세</div>
        {loading ? (
          <div style={{ fontSize: 12, color: C.text4, padding: "8px 0" }}>집계 중...</div>
        ) : series.length === 0 ? (
          <div style={{ fontSize: 12, color: C.text4, padding: "8px 0" }}>거래 데이터가 없습니다</div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90 }}>
            {series.map((s, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 0 }}>
                <div style={{ fontSize: 9, color: C.text4 }}>{s.count}</div>
                <div title={formatWon(s.gmv)} style={{ width: "62%", maxWidth: 26, height: `${Math.round((s.gmv / maxGmv) * 100)}%`, minHeight: 2, background: C.brand, borderRadius: 3 }} />
                <div style={{ fontSize: 9, color: C.text4, whiteSpace: "nowrap" }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize: 10, color: C.text4, marginTop: 6, textAlign: "right" }}>막대 위 숫자 = 건수 · 테스트 거래 제외</div>
      </div>
    </div>
  );
}
