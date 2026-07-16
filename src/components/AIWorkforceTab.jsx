// ════════════════════════════════════════════════════════════════════
// AIWorkforceTab — AI 인사팀 (OpenRouter AI 직원 채용센터) · Phase 58-1
//
//   OpenRouter 모델을 신문사 직원으로 채용·배치·평가한다. 인사 대시보드 · 조직도 ·
//   직원 명부(정보 완비) · 채용 후보 · 주간 인사평가 · 승진/강등 · 교체 추천.
//   ⚠️ 기존 조직/성과 데이터 재사용(무수정) · 채용은 localStorage additive. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { C, R, S } from "../constants";
import {
  workforceRoster, orgHierarchy, weeklyReview, promotionPlan,
  replacementRecommendations, workforceDashboard, openRouterCandidates, hireModel, fireModel,
} from "../lib/aiWorkforce";

export default function AIWorkforceTab({ showToast }) {
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState("");
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const dash = workforceDashboard();
  const roster = workforceRoster();
  const org = orgHierarchy();
  const review = weeklyReview();
  const promo = promotionPlan();
  const recos = replacementRecommendations();
  const candidates = openRouterCandidates();
  const box = { background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.xl };

  const hire = (model, role) => { hireModel(model, role); refresh(); showToast?.(`채용: ${role}`); };
  const fire = (model) => { fireModel(model); refresh(); showToast?.("직원 해촉"); };

  const tile = (k, v, col) => (
    <div key={k} style={{ flex: "1 1 92px", background: C.bg, borderRadius: R.lg, padding: "9px 11px", border: `1px solid ${C.bgWarm}` }}>
      <div style={{ fontSize: 10, color: C.text3 }}>{k}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: col || C.text1 }}>{v}</div>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: 4 }}>🧑‍💼 AI 인사팀 (OpenRouter Workforce)</div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: S.lg, lineHeight: 1.6 }}>
        OpenRouter 모델을 <b>AI 신문사 직원</b>으로 채용·배치·평가합니다. 모든 직원은 OpenRouter 모델이며, 실제 호출은 기존 구조 그대로입니다(무변경).
      </div>

      {/* 인사 대시보드 */}
      <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap", marginBottom: S.lg }}>
        {tile("총 직원", dash.totalStaff)}{tile("가동", dash.activeStaff, "#059669")}{tile("휴면", dash.idleStaff, C.text3)}
        {tile("오늘 호출", dash.todayCalls)}{tile("평균 비용/건", "₩" + dash.avgCostPerJobKRW.toLocaleString())}{tile("평균 품질", dash.avgQuality != null ? dash.avgQuality + "점" : "-")}
      </div>
      {(dash.topPerformer || dash.mostRevision) && (
        <div style={{ fontSize: 11.5, color: C.text2, marginBottom: S.lg }}>
          {dash.topPerformer && <>🏆 최고 성과 <b>{dash.topPerformer.name}</b>({dash.topPerformer.quality ?? "-"}점) </>}
          {dash.mostRevision && <> · 🔁 최다 Revision <b>{dash.mostRevision.name}</b>({dash.mostRevision.revisionRate ?? "-"}%)</>}
        </div>
      )}

      {/* 조직도 */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>🏛️ AI 조직도</div>
        <div style={{ fontSize: 11.5, color: C.text2, marginBottom: S.sm }}>
          {org.president.title} → {org.chief_secretary.title} → {org.chain.join(" → ")}
        </div>
        <div style={{ display: "flex", gap: S.sm, flexWrap: "wrap" }}>
          {org.layers.map((l) => (
            <div key={l.role} style={{ flex: "1 1 180px", background: C.bg, borderRadius: R.md, padding: "8px 10px", border: `1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.text1, marginBottom: 3 }}>{l.role} ({l.members.length})</div>
              <div style={{ fontSize: 10.5, color: C.text3 }}>{l.members.map((m) => m.name).join(", ") || "없음"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 직원 명부 */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>👥 직원 명부 ({roster.length})</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ color: C.text3, textAlign: "left" }}>
                {["이름", "역할", "모델", "입력₩", "출력₩", "속도", "품질", "PASS", "Rev", "실패", "최근"].map((h) => (
                  <th key={h} style={{ padding: "4px 6px", borderBottom: `1px solid ${C.bgWarm}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roster.map((r) => (
                <tr key={r.model} style={{ borderBottom: `1px solid ${C.bg}` }}>
                  <td style={{ padding: "4px 6px", fontWeight: 700, color: C.text1, whiteSpace: "nowrap" }}>{r.name}{r.source === "hired" && <span style={{ color: C.brandD }}> ·채용</span>}</td>
                  <td style={{ padding: "4px 6px", color: C.text2, whiteSpace: "nowrap" }}>{r.title} / {r.role}</td>
                  <td style={{ padding: "4px 6px", color: C.text3, whiteSpace: "nowrap" }}>{String(r.model).split("/").pop()}</td>
                  <td style={{ padding: "4px 6px" }}>{r.inputCostKRW}</td>
                  <td style={{ padding: "4px 6px" }}>{r.outputCostKRW}</td>
                  <td style={{ padding: "4px 6px" }}>{r.avgSpeedMs != null ? Math.round(r.avgSpeedMs / 100) / 10 + "s" : "-"}</td>
                  <td style={{ padding: "4px 6px" }}>{r.avgQuality ?? "-"}</td>
                  <td style={{ padding: "4px 6px" }}>{r.passRate != null ? r.passRate + "%" : "-"}</td>
                  <td style={{ padding: "4px 6px" }}>{r.revisionRate != null ? r.revisionRate + "%" : "-"}</td>
                  <td style={{ padding: "4px 6px", color: r.failRate ? C.red : C.text3 }}>{r.failRate != null ? r.failRate + "%" : "-"}</td>
                  <td style={{ padding: "4px 6px", color: C.text3, whiteSpace: "nowrap" }}>{r.recentWork}{r.source === "hired" && <button onClick={() => fire(r.model)} style={{ marginLeft: 6, padding: "1px 6px", background: "#fff", color: C.red, border: `1px solid ${C.bgWarm}`, borderRadius: R.sm, fontSize: 9, cursor: "pointer" }}>해촉</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 10, color: C.text4, marginTop: 6 }}>PASS/Revision/실패율 일부는 성과기록 부족 시 품질밴드 기반 추정치입니다.</div>
      </div>

      {/* 채용 후보 */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>🆕 OpenRouter 채용 후보</div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="모델/역할 검색 (예: gpt, 팩트)" style={{ width: "100%", padding: "7px 10px", borderRadius: R.md, border: `1px solid ${C.bgWarm}`, fontSize: 12, boxSizing: "border-box", fontFamily: "inherit", marginBottom: S.sm }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {candidates.filter((c) => !q || `${c.model} ${c.label} ${c.role}`.toLowerCase().includes(q.toLowerCase())).map((c) => (
            <div key={c.model} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, padding: "4px 0", borderBottom: `1px solid ${C.bg}`, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, color: C.text1, minWidth: 120 }}>{c.label}</span>
              <span style={{ color: C.text3, flex: 1, minWidth: 120 }}>{String(c.model)} · {c.tier}</span>
              <span style={{ color: C.brandD }}>→ {c.role}</span>
              <button onClick={() => hire(c.model, c.role)} style={{ padding: "3px 11px", background: C.brandD, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 10.5, cursor: "pointer" }}>채용</button>
            </div>
          ))}
          {candidates.length === 0 && <div style={{ fontSize: 11.5, color: C.text3 }}>모든 카탈로그 모델을 이미 보유 중입니다.</div>}
        </div>
      </div>

      {/* 주간 인사평가 + 승진/강등 */}
      <div style={{ display: "flex", gap: S.md, flexWrap: "wrap", marginBottom: S.xl }}>
        <div style={{ ...box, flex: "1 1 260px", marginBottom: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>📊 주간 인사평가</div>
          {review.length === 0 ? <div style={{ fontSize: 11.5, color: C.text3 }}>평가할 근무기록이 없습니다(운영 후 누적).</div> : review.slice(0, 8).map((r) => (
            <div key={r.model} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, padding: "3px 0" }}>
              <span style={{ flex: 1, color: C.text1, fontWeight: 600 }}>{r.name}</span>
              <span style={{ color: C.text3 }}>{r.jobs}건</span>
              <span style={{ fontWeight: 800, color: r.composite >= 85 ? "#059669" : r.composite >= 60 ? C.gold : C.red }}>{r.composite}</span>
            </div>
          ))}
        </div>
        <div style={{ ...box, flex: "1 1 260px", marginBottom: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>⬆️ 승진 / ⬇️ 강등</div>
          {promo.promotions.length === 0 && promo.demotions.length === 0 ? <div style={{ fontSize: 11.5, color: C.text3 }}>인사이동 제안 없음.</div> : (
            <>
              {promo.promotions.map((p) => <div key={p.model} style={{ fontSize: 11, color: "#059669" }}>⬆️ {p.name} → {p.to} ({p.composite})</div>)}
              {promo.demotions.map((p) => <div key={p.model} style={{ fontSize: 11, color: C.red }}>⬇️ {p.name} → {p.to} ({p.composite})</div>)}
            </>
          )}
        </div>
      </div>

      {/* 교체 추천 */}
      {recos.length > 0 && (
        <div style={box}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>🔄 신규 모델 교체 추천</div>
          {recos.map((r, i) => (
            <div key={i} style={{ fontSize: 11.5, color: C.text2, padding: "3px 0" }}>
              💡 <b>{r.role}</b>: {r.incumbent}({r.incumbentQuality ?? "-"}) → {r.candidate} <span style={{ color: C.text3 }}>({r.reason})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
