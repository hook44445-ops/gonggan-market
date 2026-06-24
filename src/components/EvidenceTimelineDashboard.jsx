import { useState } from "react";
import { C, R, S } from "../constants";
import { isTestRow } from "../lib/testAccounts";
import { useAdminProjectFlow } from "../hooks/useAdminProjectFlow";
import {
  projectEvidence, companyEvidenceIndex, buildTimeline, checkpointCompleteness,
  EV_TIER,
} from "../lib/evidenceTimeline";

// ════════════════════════════════════════════════════════════════════════════
// EvidenceTimelineDashboard — 증빙 타임라인 (Evidence Timeline v3)
//   GPS + 사진 + 시간(captured_at)의 일치성을 한 화면에서 확인.
//   · 읽기 전용 — DB/API/Migration/RPC 무변경. admin_project_flow_list 만 사용.
//   · 단계 구성/등급은 v2 신뢰 레이어(gpsTrust) 재사용(미수정). 기존 timestamp 만 사용.
// ════════════════════════════════════════════════════════════════════════════
const shortId = (id) => (id ? String(id).slice(0, 8) : "—");
const fmtTs = (t) => {
  if (!t) return "—";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
const fmtDate = (t) => t ? new Date(t).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }) : "—";
const STAGE_ICON = { site_visit: "📍", contract: "📝", start: "🚧", middle: "🔍", complete: "✅" };

export default function EvidenceTimelineDashboard({ adminUserId, showToast }) {
  const { rows, loading, errMsg, testSet, reload } = useAdminProjectFlow(adminUserId, { limit: 1000 });
  const [excludeTest, setExcludeTest] = useState(true);
  const [sortKey, setSortKey] = useState("avg"); // avg | gpsRate | photoRate | doneRate
  const [selected, setSelected] = useState(null);

  const calcRows = excludeTest ? rows.filter(r => !isTestRow(r, testSet)) : rows;
  const testCount = rows.filter(r => isTestRow(r, testSet)).length;

  const evals = calcRows.map(r => ({ row: r, e: projectEvidence(r) }));
  const scored = evals.filter(x => x.e.scored);
  const counts = {
    complete: scored.filter(x => x.e.tier === "complete").length,
    partial:  scored.filter(x => x.e.tier === "partial").length,
    review:   scored.filter(x => x.e.tier === "review").length,
    none:     evals.length - scored.length,
  };
  const avgCompletion = scored.length
    ? Math.round(scored.reduce((s, x) => s + x.e.completionRate, 0) / scored.length) : 0;
  const avgMissing = 100 - avgCompletion;

  const companies = [...companyEvidenceIndex(calcRows)].sort((a, b) => b[sortKey] - a[sortKey]).slice(0, 8);
  const projects = [...scored].sort((a, b) => a.e.completionRate - b.e.completionRate); // 부족 우선

  // ── shared bits ───────────────────────────────────────────────────────────
  const Card = ({ tierKey, count }) => {
    const m = EV_TIER[tierKey];
    return (
      <div style={{ flex: "1 1 120px", minWidth: 120, background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "14px 16px" }}>
        <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, marginBottom: 6 }}>{m.emoji} {m.label}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: m.color }}>{count}<span style={{ fontSize: 12, color: C.text4, fontWeight: 700 }}> 건</span></div>
      </div>
    );
  };
  const Pct = ({ e }) => {
    const m = EV_TIER[e.tier];
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${m.color}14`, color: m.color, borderRadius: R.full, padding: "3px 10px", fontSize: 12, fontWeight: 800 }}>
        {m.emoji} {e.completionRate}%
      </span>
    );
  };
  const TimeBadge = ({ time }) => (
    <span style={{ fontSize: 11, fontWeight: 800, color: time.color }}>{time.emoji} {time.label}</span>
  );
  const SortBtn = ({ k, children }) => (
    <button onClick={() => setSortKey(k)}
      style={{ padding: "4px 10px", borderRadius: R.full, fontSize: 11, fontWeight: 700, cursor: "pointer",
        border: `1px solid ${sortKey === k ? C.brand : C.bgWarm}`, background: sortKey === k ? C.brand : C.surface, color: sortKey === k ? "#fff" : C.text2 }}>{children}</button>
  );
  const Section = ({ title, sub, right, children }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text2 }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: C.text4 }}>{sub}</div>}
        {right && <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>{right}</div>}
      </div>
      {children}
    </div>
  );

  return (
    <div style={{ padding: "4px 2px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>🧾 증빙 타임라인</div>
        <button onClick={reload} disabled={loading}
          style={{ marginLeft: "auto", background: C.bgWarm, color: C.text2, border: "none", borderRadius: R.md, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>새로고침</button>
      </div>
      <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.7, marginBottom: 10 }}>
        GPS·사진·시간(captured_at) 흐름을 종합해 증빙 신뢰도를 판단합니다. 프로젝트를 열면 단계별 시간 흐름과 증빙 완성도를 한 화면에서 확인할 수 있어요. (읽기 전용 · 기존 기록 기반)
      </div>

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
          {/(Could not find the function|does not exist|schema cache|PGRST202)/i.test(errMsg) && <><br/>RPC 없음 — admin_project_flow_list 미적용</>}
        </div>
      )}

      {loading ? (
        <div style={{ color: C.text3, fontSize: 13, padding: "12px 0" }}>집계 중...</div>
      ) : scored.length === 0 ? (
        <div style={{ color: C.text4, fontSize: 13, padding: "12px 0" }}>
          GPS 단계(착공/중간점검/완료)에 도달한 프로젝트가 없어 증빙률을 산정할 프로젝트가 없습니다. (진행전 {counts.none}건)
        </div>
      ) : (
        <>
          {/* 6) 관리자 빠른 확인 */}
          <Section title="관리자 빠른 확인" sub={`증빙 산정 ${scored.length}건 · 진행전 ${counts.none}건`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Card tierKey="complete" count={counts.complete} />
              <Card tierKey="partial"  count={counts.partial} />
              <Card tierKey="review"   count={counts.review} />
            </div>
          </Section>

          {/* 4) 프로젝트 증빙률 */}
          <Section title="프로젝트 증빙률" sub="GPS 단계 도달 프로젝트 평균">
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, marginBottom: 6 }}>증빙 완료율</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: avgCompletion >= 85 ? "#1F9D55" : avgCompletion >= 67 ? "#E6A100" : "#E74C3C" }}>{avgCompletion}%</div>
                <div style={{ height: 6, background: C.bgWarm, borderRadius: R.full, marginTop: 8, overflow: "hidden" }}>
                  <div style={{ width: `${avgCompletion}%`, height: "100%", background: avgCompletion >= 85 ? "#1F9D55" : avgCompletion >= 67 ? "#E6A100" : "#E74C3C" }} />
                </div>
              </div>
              <div style={{ flex: 1, background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, marginBottom: 6 }}>증빙 누락률</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: avgMissing > 33 ? "#E74C3C" : avgMissing > 15 ? "#E6A100" : C.text1 }}>{avgMissing}%</div>
                <div style={{ fontSize: 11, color: C.text4, marginTop: 8 }}>GPS·사진·완료 평균 누락</div>
              </div>
            </div>
          </Section>

          {/* 5) 업체 평균 증빙률 */}
          <Section title="업체 평균 증빙률" sub="GPS · 사진 · 완료 종합" right={
            <>
              <SortBtn k="avg">종합순</SortBtn>
              <SortBtn k="gpsRate">GPS순</SortBtn>
              <SortBtn k="photoRate">사진순</SortBtn>
              <SortBtn k="doneRate">완료순</SortBtn>
            </>
          }>
            {companies.length === 0 ? (
              <div style={{ color: C.text4, fontSize: 12.5, padding: "6px 0" }}>집계할 업체 데이터가 없습니다</div>
            ) : (
              <div style={{ border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, overflow: "hidden" }}>
                {companies.map((c, i) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: i === 0 ? "none" : `1px solid ${C.bgWarm}`, background: C.surface }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: C.text4 }}>프로젝트 {c.projects}건</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: c.avg >= 85 ? "#1F9D55" : c.avg >= 67 ? "#E6A100" : "#E74C3C" }}>{c.avg}%</div>
                      <div style={{ fontSize: 11, color: C.text3 }}>GPS {c.gpsRate} · 사진 {c.photoRate} · 완료 {c.doneRate}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* 프로젝트 목록 — 부족 우선 */}
          <Section title="프로젝트 증빙 (부족 우선)" sub="클릭 시 단계별 시간 흐름 / 증빙 완성도">
            <div style={{ border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, overflow: "hidden" }}>
              {projects.map(({ row, e }, i) => (
                <div key={row.request_id} onClick={() => setSelected({ row, e })}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: i === 0 ? "none" : `1px solid ${C.bgWarm}`, background: C.surface, cursor: "pointer" }}>
                  <Pct e={e} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {row.company?.name || "업체 미배정"} <span style={{ color: C.text4, fontWeight: 500 }}>· {row.area || "—"}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.text4 }}>{shortId(row.request_id)} · {fmtDate(row.created_at)}</div>
                  </div>
                  <TimeBadge time={e.time} />
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {selected && <TimelineDetail row={selected.row} e={selected.e} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ── 프로젝트 증빙 타임라인 상세(모달) — 시간 흐름 + 단계별 완성도 ────────────
function TimelineDetail({ row, e, onClose }) {
  const timeline = buildTimeline(row);
  const Check = ({ ok, label }) => (
    <span style={{ fontSize: 11, fontWeight: 700, color: ok ? "#1F9D55" : C.red }}>{ok ? "✅" : "❌"} {label}</span>
  );
  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={ev => ev.stopPropagation()}
        style={{ background: C.surface, width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto",
          borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: "18px 18px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>증빙 타임라인</div>
          <span style={{ background: `${EV_TIER[e.tier].color}14`, color: EV_TIER[e.tier].color, borderRadius: R.full, padding: "3px 12px", fontSize: 13, fontWeight: 900 }}>
            {EV_TIER[e.tier].emoji} {e.completionRate}%
          </span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.text3 }}>×</button>
        </div>

        <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.8, marginBottom: 12, background: C.bg, borderRadius: R.md, padding: "10px 12px" }}>
          <div><b style={{ color: C.text1 }}>{row.company?.name || "업체 미배정"}</b> · {row.area || "—"} · {row.space_type || "—"}</div>
          <div>증빙 완료율 {e.completionRate}% · 누락률 {e.missingRate}%</div>
          <div>시간 일치성 <b style={{ color: e.time.color }}>{e.time.emoji} {e.time.label}</b> <span style={{ color: C.text4 }}>· {e.time.reason}</span></div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 800, color: C.text2, marginBottom: 8 }}>단계 시간 흐름 (GPS → 사진 → 완료)</div>
        {timeline.length === 0 ? (
          <div style={{ color: C.text4, fontSize: 12.5, padding: "6px 0" }}>도달한 단계가 없습니다</div>
        ) : timeline.map((n, i) => {
          const isLast = i === timeline.length - 1;
          return (
            <div key={n.key} style={{ display: "flex", gap: 10 }}>
              {/* 타임라인 레일 */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: n.pct >= 100 ? "#1F9D5514" : n.pct >= 67 ? "#E6A10014" : "#E74C3C14", fontSize: 13 }}>
                  {STAGE_ICON[n.key] || "•"}
                </div>
                {!isLast && <div style={{ width: 2, flex: 1, background: C.bgWarm, minHeight: 22 }} />}
              </div>
              {/* 노드 내용 */}
              <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>{n.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: n.pct >= 100 ? "#1F9D55" : n.pct >= 67 ? "#E6A100" : "#E74C3C" }}>{n.pct}%</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: C.text4 }}>{fmtTs(n.at)}</span>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
                  <Check ok={n.gps} label="GPS" />
                  <Check ok={n.photo} label={`사진${n.cp ? ` ${n.cp.photos?.length || 0}` : ""}`} />
                  <Check ok={n.done} label="완료" />
                  {n.cp?.accuracy != null && <span style={{ fontSize: 11, color: C.text4 }}>· 정확도 {Math.round(Number(n.cp.accuracy))}m</span>}
                </div>
              </div>
            </div>
          );
        })}

        <div style={{ fontSize: 11, color: C.text4, lineHeight: 1.6, marginTop: 12 }}>
          ※ 시간 일치성은 단계 캡처 시각(captured_at)의 순서·간격만으로 판정합니다(시간 역전→검토, 일괄기록/과도간격→주의). 기존 기록만 사용 — EXIF·원본검증·위변조 탐지 없음.
        </div>
      </div>
    </div>
  );
}
