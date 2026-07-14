// ════════════════════════════════════════════════════════════════════
// ExecutiveDashboard — AI 사장실 (운영현황·KPI 전용, Phase 52)
//
//   사장실은 "모니터링"만 한다: Executive KPI · 발행통계 · 예산 · Hard Fail/예외 · 카테고리별 발행 ·
//   운영 로그. ⚠️ 품의 카드/타임라인은 표시하지 않는다(품의실/총괄비서실로 분리).
//   ⚠️ 읽기 전용 · DB 파생 · 순수 집계. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { C, R, S } from "../constants";
import { supabase } from "../lib/supabase";
import { executiveKpis } from "../lib/executiveOffice";
import { buildDossier } from "../lib/approvalDossier";
import { classifyContentType, contentTypeMeta } from "../lib/contentTypes";
import { editorialDateKST } from "../lib/editorialKey";
import { getOpsLog } from "../lib/aiOpsLog";

export default function ExecutiveDashboard() {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("lounge_posts")
        .select("id,title,publish_status,scheduled_at,created_at,updated_at,is_seed,ai_topic")
        .not("ai_topic", "is", null)
        .order("created_at", { ascending: false })
        .limit(120);
      setRows((data ?? []).map((r) => ({ ...r, content_type: classifyContentType(r.title || r.ai_topic || "") })));
    } catch { setRows([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const now = Date.now();
  const kpi = rows ? executiveKpis(rows, { now }) : null;
  const today = editorialDateKST(now);
  const box = { background: "#fff", borderRadius: R.xl, padding: S.lg, border: `1px solid ${C.bgWarm}`, marginBottom: S.md };

  // Hard Fail/예외(오늘 생성분) + 카테고리별 발행(오늘).
  let hardFail = 0; const catPub = {};
  for (const r of (rows ?? [])) {
    if (editorialDateKST(r.created_at) === today) {
      try { if (!buildDossier(r, { now }).boardApproved && buildDossier(r, { now }).hardFail) hardFail += 1; } catch { /* skip */ }
    }
    if ((r.publish_status || "") === "published" && editorialDateKST(r.updated_at || r.created_at) === today) {
      const t = r.content_type; catPub[t] = (catPub[t] || 0) + 1;
    }
  }
  // 최근 7일 발행 추이.
  const trend = {};
  for (const r of (rows ?? [])) {
    if ((r.publish_status || "") !== "published") continue;
    const d = editorialDateKST(r.updated_at || r.created_at);
    trend[d] = (trend[d] || 0) + 1;
  }
  const trendDays = Object.keys(trend).sort().slice(-7);
  const opsLog = getOpsLog(10);

  const tile = (k, v, col) => (
    <div key={k} style={{ flex: "1 1 82px", textAlign: "center", background: C.bg, borderRadius: R.md, padding: "9px 5px", border: `1px solid ${C.bgWarm}` }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: col || C.text1 }}>{v}</div>
      <div style={{ fontSize: 9.5, color: C.text3 }}>{k}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: S.sm }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>🏢 AI 사장실 (운영현황)</div>
        <button onClick={load} style={{ padding: "5px 12px", background: C.brandD, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>새로고침</button>
      </div>
      <div style={{ fontSize: 10.5, color: C.text3, marginBottom: S.sm, lineHeight: 1.6 }}>
        사장실은 <b>운영현황·KPI</b>만 봅니다. 품의 상세는 <b>AI 품의실</b>, 발행 집행은 <b>AI 총괄비서실</b>에서 확인하세요.
      </div>

      {loading && <div style={{ fontSize: 12, color: C.text3 }}>불러오는 중…</div>}
      {!loading && kpi && (
        <>
          {/* Executive KPI */}
          <div style={{ ...box, display: "flex", gap: 5, flexWrap: "wrap" }}>
            {tile("오늘 생성", kpi.todayGenerated)}
            {tile("오늘 검토", kpi.todayReviewed)}
            {tile("오늘 발행", kpi.todayPublished, "#059669")}
            {tile("긴급발행", kpi.immediate, "#d97706")}
            {tile("예약", kpi.scheduledPending, "#7c3aed")}
            {tile("실패/예외", hardFail, hardFail ? C.red : undefined)}
            {tile("평균품질", kpi.avgQuality ?? "-")}
            {tile("평균처리", kpi.avgProcessMin != null ? kpi.avgProcessMin + "분" : "-")}
            {tile("예산", `${kpi.budget.total.pub}/${kpi.budget.total.cap}`)}
          </div>

          {/* 예산 상세 */}
          <div style={box}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>📊 발행 예산 (정기/비정기/총)</div>
            <div style={{ fontSize: 11.5, color: C.text2, lineHeight: 1.9 }}>
              정기 <b>{kpi.budget.regular.pub}/{kpi.budget.regular.cap}</b> · 비정기 <b>{kpi.budget.irregular.pub}/{kpi.budget.irregular.cap}</b> · 총 <b style={{ color: kpi.budget.total.pub >= kpi.budget.total.cap ? C.red : C.text1 }}>{kpi.budget.total.pub}/{kpi.budget.total.cap}</b>
              {kpi.budget.total.pub >= kpi.budget.total.cap && <span style={{ color: C.red }}> · ⚠ limit_exceeded</span>}
            </div>
          </div>

          {/* 카테고리별 발행(오늘) */}
          <div style={box}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>🗂️ 오늘 카테고리별 발행</div>
            {Object.keys(catPub).length === 0 ? <div style={{ fontSize: 11.5, color: C.text3 }}>오늘 발행 없음.</div> : (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(catPub).map(([t, n]) => (
                  <span key={t} style={{ fontSize: 11, background: C.bg, borderRadius: R.full, padding: "3px 10px", color: C.text2 }}>{contentTypeMeta(t)?.label || t} {n}</span>
                ))}
              </div>
            )}
          </div>

          {/* 최근 7일 발행 추이 */}
          <div style={box}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>📈 발행 추이 (최근 7일)</div>
            {trendDays.length === 0 ? <div style={{ fontSize: 11.5, color: C.text3 }}>데이터 없음.</div> : (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                {trendDays.map((d) => (
                  <div key={d} style={{ textAlign: "center", flex: "1 1 40px" }}>
                    <div style={{ height: 48, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                      <div style={{ width: 20, height: `${Math.min(100, (trend[d] || 0) * 18)}%`, minHeight: 4, background: C.brand, borderRadius: "3px 3px 0 0" }} title={`${trend[d]}건`} />
                    </div>
                    <div style={{ fontSize: 9, color: C.text3, marginTop: 3 }}>{d.slice(5)}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.brandD }}>{trend[d]}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 운영 로그 */}
          <div style={box}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>🧾 운영 로그</div>
            {opsLog.length === 0 ? <div style={{ fontSize: 11.5, color: C.text3 }}>기록 없음 (LLM 검수·발행 시 누적).</div> : (
              <div style={{ fontFamily: "monospace", fontSize: 10, color: C.text2, display: "flex", flexDirection: "column", gap: 1, maxHeight: 160, overflowY: "auto" }}>
                {opsLog.map((e, i) => <div key={i}>[{e.tag}] {e.dossierNo || e.contentId || ""} {e.detail ? `· ${e.detail}` : ""} <span style={{ color: C.text4 }}>{new Date(e.at).toLocaleTimeString("ko-KR")}</span></div>)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
