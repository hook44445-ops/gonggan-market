// ════════════════════════════════════════════════════════════════════
// ChiefSecretaryBoard — AI 품의실 / 총괄비서실 (역할 분리, Phase 52)
//
//   mode="review"    → AI 품의실: 품의서 생성 · 4인 검토·서명·의견 · BOARD_APPROVED · 타임라인.
//                      (검토만. 총괄비서실장·발행 집행 정보 없음)
//   mode="execution" → AI 총괄비서실: BOARD_APPROVED 만 조회 · 자동 인수 · 즉시/예약 집행 · 발행결과.
//                      (재검토·서명·품질평가 없음. 집행 상태만)
//   KPI/운영현황은 사장실(ExecutiveDashboard)로 분리 — 여기서는 표시하지 않는다.
//   ⚠️ 사장 승인 단계 없음 · 4인 검토 기본 규칙 기반(정직 표기) · LLM 설정 시 실 LLM 검수 가능.
// ════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { C, R, S } from "../constants";
import { supabase } from "../lib/supabase";
import { buildDossier, dossierStage } from "../lib/approvalDossier";
import { classifyContentType } from "../lib/contentTypes";
import { buildDossierLLM } from "../lib/aiEditorialBoardLLM";
import { isLLMConfigured } from "../lib/llmClient";
import { logDossierProgress, getOpsLog } from "../lib/aiOpsLog";

const STAGES = ["검토중", "서명완료", "총괄비서실장", "발행완료", "예외함"];
const STAGE_COLOR = { 검토중: C.gold, 서명완료: "#2563eb", 총괄비서실장: "#7c3aed", 발행완료: "#059669", 예외함: C.red };
const DEC_COLOR = (d) => d.hardFail ? C.red : d.decision === "PASS" ? "#059669" : d.decision === "PASS_WITH_NOTE" ? C.gold : C.red;

export default function ChiefSecretaryBoard({ mode = "review" }) {
  const isExec = mode === "execution";
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("전체");
  const [open, setOpen] = useState({});
  const [llmById, setLlmById] = useState({});
  const [reviewingId, setReviewingId] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const llmOn = isLLMConfigured();

  const reviewLLM = async (r) => {
    if (!r?.id || !llmOn) return;
    setReviewingId(String(r.id));
    try {
      const d = await buildDossierLLM(r, { now: Date.now() });
      setLlmById((m) => ({ ...m, [String(r.id)]: d }));
      logDossierProgress(d);
    } catch { /* 실패 시 기존 휴리스틱 카드 유지 */ }
    finally { setReviewingId(null); }
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("lounge_posts")
        .select("id,title,content,category,image_urls,publish_status,scheduled_at,created_at,updated_at,is_seed,ai_topic")
        .not("ai_topic", "is", null)
        .order("created_at", { ascending: false })
        .limit(60);
      setRows((data ?? []).map((r) => ({ ...r, content_type: classifyContentType(r.title || r.ai_topic || "") })));
    } catch { setRows([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const now = Date.now();
  let items = (rows ?? []).map((r) => ({ r, d: llmById[String(r.id)] || buildDossier(r, { now }) }));
  // 총괄비서실은 BOARD_APPROVED(인수 대상)만.
  if (isExec) items = items.filter((it) => it.d.boardApproved);
  const counts = STAGES.reduce((a, s) => ({ ...a, [s]: items.filter((it) => dossierStage(it.d) === s).length }), {});
  const shown = filter === "전체" ? items : items.filter((it) => dossierStage(it.d) === filter);
  const opsLog = showLog ? getOpsLog(14) : [];
  const box = { background: "#fff", borderRadius: R.xl, padding: S.lg, border: `1px solid ${C.bgWarm}`, marginBottom: S.md };
  const chip = (bg, col) => ({ display: "inline-block", padding: "1px 7px", borderRadius: R.full, fontSize: 9.5, fontWeight: 800, background: bg, color: col, marginRight: 4, marginBottom: 3 });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: S.sm }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>{isExec ? "🧑‍✈️ AI 총괄비서실 (집행)" : "🏛️ AI 품의실 (4인 검토)"}</div>
        <div style={{ display: "flex", gap: 6 }}>
          {!isExec && <button onClick={() => setShowLog((v) => !v)} style={{ padding: "5px 12px", background: showLog ? C.brand : "#fff", color: showLog ? "#fff" : C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.md, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>운영 로그</button>}
          <button onClick={load} style={{ padding: "5px 12px", background: C.brandD, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>새로고침</button>
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: C.text3, marginBottom: S.sm, lineHeight: 1.6 }}>
        {isExec
          ? <>BOARD_APPROVED 된 품의만 <b>자동 인수</b>해 즉시/예약 발행을 <b>집행</b>합니다. 재검토·서명·품질평가 없음 — 집행 상태만 표시.</>
          : <>Fusion→대표이미지→품의서→4인 서명→BOARD_APPROVED 까지 <b>검토</b>합니다. 발행 집행은 총괄비서실. 4인 검토는 기본 <b>규칙 기반</b>{llmOn ? <>, 카드의 <b style={{ color: C.brand }}>🤖 실제 LLM 검수</b> 가능</> : <b style={{ color: C.gold }}>(LLM 미설정)</b>}.</>}
      </div>

      {!isExec && showLog && (
        <div style={{ background: "#101a16", borderRadius: R.md, padding: "8px 10px", marginBottom: S.sm, fontFamily: "monospace", fontSize: 10, color: "#9fd6b8", maxHeight: 180, overflowY: "auto" }}>
          {opsLog.length === 0 ? <div style={{ color: "#6a8a78" }}>운영 로그 없음 (LLM 검수 실행 시 [DOSSIER_CREATED]…[PUBLISHED] 기록)</div>
            : opsLog.map((e, i) => (
              <div key={i}>[{e.tag}] {e.dossierNo || e.contentId || ""} {e.detail ? `· ${e.detail}` : ""} <span style={{ color: "#5a7a68" }}>{new Date(e.at).toLocaleTimeString("ko-KR")}</span></div>
            ))}
        </div>
      )}

      {/* 상태 필터 */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: S.sm }}>
        {["전체", ...STAGES].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: "4px 11px", borderRadius: R.full, fontSize: 11, fontWeight: 700, cursor: "pointer",
              border: `1px solid ${filter === s ? C.brand : C.bgWarm}`, background: filter === s ? C.brand : "#fff", color: filter === s ? "#fff" : C.text2 }}>
            {s}{s !== "전체" ? ` ${counts[s] || 0}` : ""}
          </button>
        ))}
      </div>

      {loading && <div style={{ fontSize: 12, color: C.text3 }}>불러오는 중…</div>}
      {!loading && shown.length === 0 && <div style={{ fontSize: 12, color: C.text3 }}>{isExec ? "인수할 BOARD_APPROVED 품의가 없습니다." : "표시할 품의서가 없습니다."}</div>}

      {shown.slice(0, 30).map(({ r, d }) => {
        const stage = dossierStage(d);
        const isLlm = d.reviewMode === "llm";
        return (
          <div key={d.contentId} style={box}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "monospace", fontSize: 10.5, color: C.text3 }}>{d.dossierNo}</span>
              <span style={chip(STAGE_COLOR[stage] + "22", STAGE_COLOR[stage])}>{stage}</span>
              <span style={chip(C.bg, C.text2)}>{d.track}</span>
              {!isExec && <span style={chip(C.bg, C.text2)}>품질 {d.qualityScore}·{d.grade}</span>}
              {!isExec && <span style={chip(isLlm ? "#2E5F4B22" : C.bg, isLlm ? C.brand : C.text3)}>{isLlm ? "🤖 LLM 검수" : "규칙 기반"}</span>}
              <span style={{ flex: 1 }} />
              {d.image?.url && <img src={d.image.url} alt={d.image.alt} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: R.sm, border: `1px solid ${C.bgWarm}` }} />}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text1, margin: "5px 0", wordBreak: "break-word" }}>{d.title}</div>

            {/* ── 품의실: 4인 서명 ── */}
            {!isExec && (
              <div style={{ marginBottom: 4 }}>
                {d.reviewers.map((rv) => (
                  <span key={rv.role} style={chip(DEC_COLOR(rv) + "18", DEC_COLOR(rv))} title={rv.signedAt ? `SIGNED ${rv.signedAt}` : "미서명"}>
                    {rv.name} {rv.signed ? "✔" : "✕"}
                  </span>
                ))}
                <span style={chip(d.boardApproved ? "#05966922" : C.bg, d.boardApproved ? "#059669" : C.text3)}>{d.boardApproved ? "BOARD_APPROVED" : "검토중"}</span>
              </div>
            )}

            {/* ── 총괄비서실: 집행 상태 ── */}
            {isExec && (
              <div style={{ fontSize: 11, color: C.text2, marginBottom: 4 }}>
                총괄비서실장: <b style={{ color: d.chiefSecretary.received ? "#059669" : C.text3 }}>{d.chiefSecretary.received ? `인수 · ${d.chiefSecretary.action}` : `대기 (${d.chiefSecretary.reason || ""})`}</b>
                {" · "}발행: <b style={{ color: d.publishMode === "HOLD" ? C.red : d.publishMode === "IMMEDIATE" ? "#d97706" : "#7c3aed" }}>{d.publishMode === "IMMEDIATE" ? `즉시발행 ${d.priority}` : d.publishMode === "SCHEDULED" ? "예약발행" : "예외함"}</b>
                {d.scheduledAt && d.publishMode === "SCHEDULED" && ` · ${new Date(d.scheduledAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
              </div>
            )}

            {/* 발행결과(§8) — 두 화면 공통(집행 결과) */}
            {d.result && (
              <div style={{ fontSize: 10.5, color: "#059669", marginBottom: 4, wordBreak: "break-all" }}>
                ✅ 발행완료 · <span style={{ fontFamily: "monospace", color: C.brandD }}>{d.result.url}</span>
                {" · "}게시 {new Date(d.result.publishedAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                {d.result.elapsedMin != null && ` · Elapsed ${d.result.elapsedMin}분`}
                {" · ID "}{d.result.publishId}
              </div>
            )}

            {/* 품의실: 타임라인 + LLM 검수 / 총괄비서실: 타임라인만 */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setOpen((o) => ({ ...o, [d.contentId]: !o[d.contentId] }))} style={{ fontSize: 10.5, color: C.text3, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                {open[d.contentId] ? "▲ 타임라인 접기" : "▼ 타임라인 펼치기"}
              </button>
              {!isExec && llmOn && !isLlm && (
                <button onClick={() => reviewLLM(r)} disabled={reviewingId === String(r.id)}
                  style={{ fontSize: 10.5, fontWeight: 700, color: reviewingId === String(r.id) ? C.text3 : C.brand, background: "none", border: `1px solid ${C.brandM}`, borderRadius: R.full, padding: "2px 9px", cursor: "pointer" }}>
                  {reviewingId === String(r.id) ? "검수 중…" : "🤖 실제 LLM 검수"}
                </button>
              )}
            </div>
            {open[d.contentId] && (
              <div style={{ marginTop: 6 }}>
                {/* 품의실만: 4인 의견·수정요청 */}
                {!isExec && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6, paddingBottom: 6, borderBottom: `1px solid ${C.bg}` }}>
                    {d.reviewers.map((rv) => (
                      <div key={rv.role} style={{ fontSize: 10.5, color: C.text2, lineHeight: 1.5 }}>
                        <b style={{ color: C.text1 }}>{rv.name}</b> · <span style={{ fontWeight: 700, color: DEC_COLOR(rv) }}>{rv.decision}</span> · {rv.score}점 {rv.signed ? `· SIGNED ${rv.signedAt}` : "· 미서명"}
                        {((rv.issues || []).length > 0 || (rv.revisionRequests || []).length > 0) && (
                          <div style={{ color: C.text3, marginLeft: 8 }}>
                            {(rv.issues || []).length > 0 && <>의견: {rv.issues.slice(0, 3).join(", ")}<br /></>}
                            {(rv.revisionRequests || []).length > 0 && <>수정요청: {rv.revisionRequests.slice(0, 2).join(", ")}</>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {d.timeline.map((t, i) => (
                    <div key={i} style={{ fontSize: 10.5, color: t.done ? C.text2 : C.text4, display: "flex", gap: 6 }}>
                      <span>{t.done ? "✅" : "⬜"}</span>
                      <span style={{ fontWeight: 700 }}>{t.label}</span>
                      {t.at && <span style={{ color: C.text4 }}>{t.at}</span>}
                      {t.note && <span style={{ color: C.text4 }}>· {t.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
