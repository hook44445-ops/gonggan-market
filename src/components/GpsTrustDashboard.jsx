import { useState, useEffect } from "react";
import { dlog } from "../utils/devLog";
import { C, R, S } from "../constants";
import { getAdminProjectFlow, getTestAccounts } from "../lib/supabase";
import { buildTestAccountSet, isTestRow } from "../lib/testAccounts";
import {
  projectTrust, companyTrustIndex, checkpointGrade, evidenceMatch,
  TIER_META, PROJECT_TIER_LABEL,
} from "../lib/gpsTrust";

// ════════════════════════════════════════════════════════════════════════════
// GpsTrustDashboard — GPS 신뢰도 (Space OS Trust Layer v2)
//   "기록"을 넘어 "이 GPS가 믿을 수 있는가"를 한눈에 판단하는 신뢰 레이어.
//   · 읽기 전용 — DB/API/Migration/RPC 변경 없음. admin_project_flow_list 만 사용.
//   · 신뢰등급(🟢🟡🔴) · 증빙 일치성 · 프로젝트 신뢰점수 · 업체 신뢰지수 ·
//     경고 프로젝트 · 관리자 빠른확인 카드. (gpsTrust.js 계산 재사용)
// ════════════════════════════════════════════════════════════════════════════
const fmtDate = (t) => t ? new Date(t).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }) : "—";
const shortId = (id) => (id ? String(id).slice(0, 8) : "—");

export default function GpsTrustDashboard({ adminUserId, showToast }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState(null);
  const [testSet, setTestSet] = useState(null);
  const [excludeTest, setExcludeTest] = useState(true);
  const [sortKey, setSortKey] = useState("avgScore"); // avgScore | gpsRate | photoRate
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true); setErrMsg(null);
    try {
      const { data: ta } = await getTestAccounts(adminUserId);
      setTestSet(buildTestAccountSet(Array.isArray(ta) ? ta : []));
    } catch { setTestSet(buildTestAccountSet([])); }

    const { data, error } = await getAdminProjectFlow(adminUserId, { limit: 1000 });
    if (error) {
      setErrMsg(error.message || "조회 실패"); setRows([]);
      dlog("[GONGGAN_DEBUG][GpsTrust] error", error.message);
    } else {
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      dlog("[GONGGAN_DEBUG][GpsTrust] count", list.length);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [adminUserId]);

  const calcRows = excludeTest ? rows.filter(r => !isTestRow(r, testSet)) : rows;
  const testCount = rows.filter(r => isTestRow(r, testSet)).length;

  const trusts = calcRows.map(r => ({ row: r, t: projectTrust(r) }));
  const scored = trusts.filter(x => x.t.scored);
  const counts = {
    trust:   scored.filter(x => x.t.tier === "trust").length,
    caution: scored.filter(x => x.t.tier === "caution").length,
    review:  scored.filter(x => x.t.tier === "review").length,
    none:    trusts.length - scored.length,
  };

  const warnProjects = scored
    .filter(x => x.t.warnings.length > 0)
    .sort((a, b) => new Date(b.row.created_at || 0) - new Date(a.row.created_at || 0))
    .slice(0, 12);

  const companies = [...companyTrustIndex(calcRows)]
    .sort((a, b) => b[sortKey] - a[sortKey])
    .slice(0, 8);

  const projects = [...scored].sort((a, b) => a.t.score - b.t.score); // 위험 우선

  // ── shared bits ───────────────────────────────────────────────────────────
  const Card = ({ tierKey, count }) => {
    const m = tierKey === "none" ? TIER_META.none : TIER_META[tierKey];
    return (
      <div style={{ flex: "1 1 120px", minWidth: 120, background: C.surface, border: `1px solid ${C.bgWarm}`,
        borderRadius: R.lg, padding: "14px 16px" }}>
        <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, marginBottom: 6 }}>
          {m.emoji} {tierKey === "none" ? "진행전" : PROJECT_TIER_LABEL[tierKey]}
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: m.color }}>{count}<span style={{ fontSize: 12, color: C.text4, fontWeight: 700 }}> 건</span></div>
      </div>
    );
  };
  const ScoreBadge = ({ t }) => {
    const m = TIER_META[t.tier];
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${m.color}14`,
        color: m.color, borderRadius: R.full, padding: "3px 10px", fontSize: 12, fontWeight: 800 }}>
        {m.emoji} {t.score}점
      </span>
    );
  };
  const Warn = ({ label }) => (
    <span style={{ fontSize: 10.5, fontWeight: 800, color: C.red, background: "#FEF0F0", borderRadius: R.full, padding: "2px 8px" }}>{label}</span>
  );
  const SortBtn = ({ k, children }) => (
    <button onClick={() => setSortKey(k)}
      style={{ padding: "4px 10px", borderRadius: R.full, fontSize: 11, fontWeight: 700, cursor: "pointer",
        border: `1px solid ${sortKey === k ? C.brand : C.bgWarm}`,
        background: sortKey === k ? C.brand : C.surface, color: sortKey === k ? "#fff" : C.text2 }}>{children}</button>
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
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>🛡️ GPS 신뢰도</div>
        <button onClick={load} disabled={loading}
          style={{ marginLeft: "auto", background: C.bgWarm, color: C.text2, border: "none", borderRadius: R.md, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>새로고침</button>
      </div>
      <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.7, marginBottom: 10 }}>
        GPS·사진·단계·증빙 일치성을 종합해 신뢰도를 시각화합니다. 프로젝트를 열지 않아도 신뢰/위험 프로젝트와 업체 신뢰도를 한눈에 판단할 수 있어요. (읽기 전용 · 기존 기록 기반)
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
          GPS 단계(착공/중간점검/완료)에 도달한 프로젝트가 없어 신뢰도를 산정할 프로젝트가 없습니다. (진행전 {counts.none}건)
        </div>
      ) : (
        <>
          {/* 1) 관리자 빠른 확인 */}
          <Section title="관리자 빠른 확인" sub={`신뢰도 산정 ${scored.length}건 · 진행전 ${counts.none}건`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Card tierKey="trust"   count={counts.trust} />
              <Card tierKey="caution" count={counts.caution} />
              <Card tierKey="review"  count={counts.review} />
            </div>
          </Section>

          {/* 2) 업체 신뢰지수 */}
          <Section title="업체 신뢰지수" sub="평균 신뢰점수 · GPS 기록률 · 사진 첨부율" right={
            <>
              <SortBtn k="avgScore">신뢰점수순</SortBtn>
              <SortBtn k="gpsRate">GPS순</SortBtn>
              <SortBtn k="photoRate">사진순</SortBtn>
            </>
          }>
            {companies.length === 0 ? (
              <div style={{ color: C.text4, fontSize: 12.5, padding: "6px 0" }}>집계할 업체 데이터가 없습니다</div>
            ) : (
              <div style={{ border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, overflow: "hidden" }}>
                {companies.map((c, i) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                    borderTop: i === 0 ? "none" : `1px solid ${C.bgWarm}`, background: C.surface }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: C.text4 }}>프로젝트 {c.projects}건</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: c.avgScore >= 85 ? "#1F9D55" : c.avgScore >= 60 ? "#E6A100" : "#E74C3C" }}>{c.avgScore}점</div>
                      <div style={{ fontSize: 11, color: C.text3 }}>GPS {c.gpsRate}% · 사진 {c.photoRate}%</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* 3) 경고 프로젝트 */}
          <Section title="경고 프로젝트" sub="GPS/사진 누락·오차·단계 미완료 — 최근순">
            {warnProjects.length === 0 ? (
              <div style={{ color: "#1F9D55", fontSize: 12.5, padding: "6px 0", fontWeight: 700 }}>경고 프로젝트 없음 — 증빙 양호 ✓</div>
            ) : warnProjects.map(({ row, t }) => (
              <div key={row.request_id} onClick={() => setSelected({ row, t })}
                style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "11px 13px", marginBottom: 8, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <ScoreBadge t={t} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {row.company?.name || "업체 미배정"}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: C.text4 }}>{fmtDate(row.created_at)}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {t.warnings.map((w, k) => <Warn key={k} label={w} />)}
                </div>
              </div>
            ))}
          </Section>

          {/* 4) 전체 프로젝트(신뢰도 산정) */}
          <Section title="프로젝트 신뢰점수" sub="위험 우선 정렬 · 클릭 시 체크포인트 신뢰등급/증빙 일치성">
            <div style={{ border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, overflow: "hidden" }}>
              {projects.map(({ row, t }, i) => (
                <div key={row.request_id} onClick={() => setSelected({ row, t })}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                    borderTop: i === 0 ? "none" : `1px solid ${C.bgWarm}`, background: C.surface, cursor: "pointer" }}>
                  <ScoreBadge t={t} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {row.company?.name || "업체 미배정"} <span style={{ color: C.text4, fontWeight: 500 }}>· {row.area || "—"}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.text4 }}>GPS {t.gpsRate}% · 사진 {t.photoRate}% · {shortId(row.request_id)}</div>
                  </div>
                  {t.warnings.length > 0 && <span style={{ fontSize: 11, color: C.red, fontWeight: 800 }}>!{t.warnings.length}</span>}
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {selected && <TrustDetail row={selected.row} t={selected.t} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ── 프로젝트 신뢰 상세(모달) — 단계별 GPS 신뢰등급 + 증빙 일치성 ─────────────
function TrustDetail({ row, t, onClose }) {
  const m = TIER_META[t.tier];
  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: C.surface, width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto",
          borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: "18px 18px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>신뢰 상세</div>
          <span style={{ background: `${m.color}14`, color: m.color, borderRadius: R.full, padding: "3px 12px", fontSize: 13, fontWeight: 900 }}>{m.emoji} {t.score}점</span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.text3 }}>×</button>
        </div>

        <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.8, marginBottom: 12, background: C.bg, borderRadius: R.md, padding: "10px 12px" }}>
          <div><b style={{ color: C.text1 }}>{row.company?.name || "업체 미배정"}</b> · {row.area || "—"} · {row.space_type || "—"}</div>
          <div>고객 {row.customer?.name || "—"} · request {shortId(row.request_id)}</div>
          <div>GPS 기록률 {t.gpsRate}% · 사진 첨부율 {t.photoRate}% · 단계 {t.stagePresent}/{t.n}</div>
          {t.warnings.length > 0 && (
            <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 5 }}>
              {t.warnings.map((w, k) => (
                <span key={k} style={{ fontSize: 10.5, fontWeight: 800, color: C.red, background: "#FEF0F0", borderRadius: R.full, padding: "2px 8px" }}>{w}</span>
              ))}
            </div>
          )}
        </div>

        <div style={{ fontSize: 12, fontWeight: 800, color: C.text2, marginBottom: 8 }}>단계별 GPS 신뢰등급 / 증빙 일치성</div>
        {t.stages.filter(s => s.reached).map(s => {
          const grade = s.gpsStage ? checkpointGrade(s.cp) : null;
          const ev = evidenceMatch(s.cp);
          const cp = s.cp;
          return (
            <div key={s.key} style={{ border: `1px solid ${C.bgWarm}`, borderRadius: R.md, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>{s.label}</span>
                {s.gpsStage ? (
                  <span style={{ fontSize: 12, fontWeight: 800, color: grade.color }}>{grade.emoji} {grade.label}</span>
                ) : (
                  <span style={{ fontSize: 11, color: C.text4 }}>증빙단계</span>
                )}
                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 800, color: ev.color }}>{ev.label}</span>
              </div>
              <div style={{ fontSize: 11, color: C.text3, marginTop: 5, lineHeight: 1.7 }}>
                {cp ? (
                  <>
                    GPS {cp.lat != null && cp.lng != null ? "✓" : "✗"} · 사진 {(cp.photos?.length || 0)}장
                    {cp.accuracy != null ? ` · 정확도 ${Math.round(Number(cp.accuracy))}m` : ""}
                    {s.gpsStage && grade.reason ? ` · ${grade.reason}` : ""}
                    {cp.road_address ? <><br/>📍 {cp.road_address}</> : null}
                  </>
                ) : (
                  <span style={{ color: C.red, fontWeight: 700 }}>체크포인트 없음 (도달했으나 기록 미존재)</span>
                )}
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: 11, color: C.text4, lineHeight: 1.6, marginTop: 6 }}>
          ※ 신뢰점수 = GPS 단계(착공/중간/완료) 도달분의 GPS·사진·정확도·단계완료 종합. 정확도 ≤{30}m 양호, &gt;{50}m 오차 과다. 기존 기록만 사용(추정/위변조 탐지 없음).
        </div>
      </div>
    </div>
  );
}
