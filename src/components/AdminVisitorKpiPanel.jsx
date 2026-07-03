import { useState, useEffect } from "react";
import { C, R } from "../constants";
import { fetchAdminStats } from "../lib/supabase";

// ── 운영지표 KPI(방문자 DAU/MAU · 신규가입 · 견적 · 계약) — 대시보드 상단 추가(조회 전용) ──
// 데이터: service-role /api/admin/stats. 방문자는 user_visits(085 마이그레이션) 기준 → 배포 시점부터 누적.
// 기존 AdminKpiPanel(거래액/정산 등) 위에 '추가'만 한다. 실패/미적용 시 0 으로 안전 표시.
const fmt = (n) => (n ?? 0).toLocaleString("ko-KR");

export default function AdminVisitorKpiPanel({ adminUserId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await fetchAdminStats(adminUserId ?? "");
      if (error) setErr(error.message ?? "지표 조회 실패");
      setStats(data && typeof data === "object" && !Array.isArray(data) ? data : null);
    } catch (e) {
      setErr(e?.message ?? String(e));
      setStats(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [adminUserId]);

  const v = stats?.visitors ?? {};
  const s = stats?.signups ?? {};

  const Card = ({ label, value, accent, sub }) => (
    <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "12px 14px", flex: "1 1 30%", minWidth: 100 }}>
      <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 900, color: accent || C.text1 }}>{loading ? "…" : value}</div>
      {sub && <div style={{ fontSize: 10.5, color: C.text4, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: 8 }}>
        방문자 · 가입 지표 <span style={{ fontSize: 11, color: C.text4, fontWeight: 500 }}>· 운영 KPI</span>
      </div>

      {err && (
        <div style={{ background: "#FEF0F0", color: C.red, borderRadius: R.lg, padding: "8px 12px", fontSize: 11.5, marginBottom: 8 }}>
          지표를 불러오지 못했습니다: {err}
        </div>
      )}

      {/* 방문자(DAU/MAU) */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <Card label="오늘 방문자 (DAU)" value={`${fmt(v.today)}명`} accent={C.brand} />
        <Card label="최근 7일 방문자"   value={`${fmt(v.d7)}명`} accent={C.brand} />
        <Card label="최근 30일 (MAU)"   value={`${fmt(v.d30)}명`} accent="#2980B9" />
      </div>

      {/* 신규가입 + 견적/계약 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
        <Card label="오늘 신규가입"   value={`${fmt(s.today)}명`} accent="#27AE60" />
        <Card label="최근 7일 가입"   value={`${fmt(s.d7)}명`} />
        <Card label="최근 30일 가입"  value={`${fmt(s.d30)}명`} />
        <Card label="오늘 견적요청"   value={`${fmt(stats?.requestsToday)}건`} />
        <Card label="오늘 계약"       value={`${fmt(stats?.contractsToday)}건`} accent="#E67E22" />
      </div>

      <div style={{ fontSize: 10, color: C.text4, marginTop: 2 }}>
        방문자(DAU/MAU)는 방문 추적 배포 시점부터 누적됩니다. 신규가입·견적·계약은 기존 데이터 기준.
      </div>
    </div>
  );
}
