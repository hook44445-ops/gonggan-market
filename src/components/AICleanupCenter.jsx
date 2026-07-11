// ════════════════════════════════════════════════════════════════════
// AICleanupCenter — AI 청소센터(읽기 전용 탐지·4단계 승인 표시) (Phase 46)
//
//   중복/오류/정체 후보를 탐지하고 4단계(탐지→영향→안전→관리자) 판정을 보여준다.
//   ⚠️ 이 화면은 데이터를 삭제/격리/변경하지 않는다(읽기 전용). 격리 실행은 별도(스키마 논의 후).
//   기존 published·게시 URL·정상 미래예약·사용자 글은 보호되어 청소 후보에서 제외/거부된다.
// ════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { C, R, S } from "../constants";
import { supabase } from "../lib/supabase";
import { detectCleanupCandidates, classifyQueue } from "../lib/cleanupDetector";
import { reviewCleanupBatch } from "../lib/cleanupApprovalBoard";
import { classifyContentType } from "../lib/contentTypes";

const BUCKET_KO = {
  normal_future: "정상 미래예약", overdue_unpublished: "도래 미발행(발행 복구)", exact_duplicate: "완전 중복",
  date_error: "날짜 오류", manual_test: "수동 테스트", broken: "깨진 결과", published: "발행 완료(보호)",
};
const DEC_KO = {
  APPROVED_FOR_QUARANTINE: "격리 승인", APPROVED_FOR_ARCHIVE: "보관 승인", REVIEW_REQUIRED: "관리자 검토", REJECTED: "청소 거부(보호)",
};
const DEC_COLOR = { APPROVED_FOR_QUARANTINE: "#d97706", APPROVED_FOR_ARCHIVE: "#7c3aed", REVIEW_REQUIRED: "#6b7280", REJECTED: "#059669" };

export default function AICleanupCenter() {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const { data, error } = await supabase
        .from("lounge_posts")
        .select("id,title,category,publish_status,scheduled_at,created_at,content,is_seed,ai_topic")
        .not("ai_topic", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setRows((data ?? []).map((r) => ({ ...r, content_type: classifyContentType(r.title || r.ai_topic || "") })));
    } catch (e) { setErr(e?.message ?? String(e)); setRows([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const now = Date.now();
  const cands = rows ? detectCleanupCandidates(rows, { now }) : [];
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));
  const { results, summary } = reviewCleanupBatch(cands, byId, { now });
  const buckets = rows ? classifyQueue(rows, { now }) : {};
  const box = { background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.lg };
  const decById = new Map(results.map((r) => [r.targetId, r]));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>🧹 AI 청소센터</div>
        <button onClick={load} style={{ padding: "6px 14px", background: C.brandD, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>새로고침</button>
      </div>
      <div style={{ fontSize: 11.5, color: C.text3, marginBottom: S.lg, lineHeight: 1.7 }}>
        중복·오류·정체를 <b>탐지만</b> 하고 4단계(탐지→영향→안전→관리자) 판정을 표시합니다. <b>읽기 전용</b> — 삭제/격리하지 않습니다.
        published·게시 URL·정상 미래예약·사용자 글은 보호됩니다.
      </div>

      {loading && <div style={{ fontSize: 12, color: C.text3 }}>불러오는 중…</div>}
      {err && <div style={{ fontSize: 12, color: C.red }}>조회 오류: {err}</div>}

      {!loading && rows && (
        <>
          {/* 요약 */}
          <div style={{ ...box, display: "flex", gap: S.sm, flexWrap: "wrap" }}>
            {[["후보", cands.length, C.text1], ["격리 승인", summary.quarantine, "#d97706"], ["관리자 검토", summary.review, C.text2], ["보호(거부)", summary.rejected, "#059669"], ["발행 복구", summary.recover, "#7c3aed"]].map(([k, v, col]) => (
              <div key={k} style={{ flex: "1 1 90px", textAlign: "center", background: C.bg, borderRadius: R.md, padding: "9px 6px" }}>
                <div style={{ fontSize: 19, fontWeight: 800, color: col }}>{v}</div>
                <div style={{ fontSize: 10.5, color: C.text3 }}>{k}</div>
              </div>
            ))}
          </div>

          {/* 분류표(⑭) */}
          <div style={box}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>📋 큐 분류 ({(rows || []).length}건)</div>
            {Object.entries(buckets).map(([k, list]) => list.length > 0 && (
              <details key={k} style={{ marginBottom: 4 }}>
                <summary style={{ fontSize: 12, fontWeight: 700, color: C.text2, cursor: "pointer" }}>{BUCKET_KO[k] || k} · {list.length}건</summary>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 5 }}>
                  {list.slice(0, 30).map((r) => {
                    const dec = decById.get(r.id);
                    return (
                      <div key={r.id} style={{ fontSize: 10.5, color: C.text2, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "baseline", borderBottom: `1px solid ${C.bg}`, padding: "2px 0" }}>
                        <span style={{ color: C.text4, fontFamily: "monospace" }}>{String(r.id).slice(0, 6)}</span>
                        <span style={{ flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.text1 }}>{r.title}</span>
                        <span style={{ color: C.text3 }}>{r.content_type}</span>
                        <span style={{ color: C.text3 }}>{r.editorial_date}</span>
                        <span style={{ fontWeight: 700, color: r.representative ? "#059669" : C.text3 }}>{r.representative ? "대표본" : "복사본"}</span>
                        {dec && <span style={{ fontWeight: 800, color: DEC_COLOR[dec.finalDecision] }}>{DEC_KO[dec.finalDecision]}</span>}
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>

          {/* 4단계 승인 상세 */}
          {results.length > 0 && (
            <div style={box}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>🧑‍⚖️ 4단계 청소 승인 ({results.length})</div>
              {results.slice(0, 40).map((r) => (
                <details key={r.targetId} style={{ borderBottom: `1px solid ${C.bg}`, padding: "3px 0" }}>
                  <summary style={{ fontSize: 11, cursor: "pointer", color: C.text2 }}>
                    <span style={{ fontFamily: "monospace", color: C.text4 }}>{String(r.targetId).slice(0, 6)}</span> · {r.type} · <b style={{ color: DEC_COLOR[r.finalDecision] }}>{DEC_KO[r.finalDecision]}</b>
                  </summary>
                  <div style={{ fontSize: 10.5, color: C.text3, marginTop: 4, lineHeight: 1.7 }}>
                    1) 탐지: {r.stages.detect.type} (신뢰 {r.stages.detect.confidence}) · {r.stages.detect.reason}<br />
                    2) 영향: {r.stages.impact.decision} · {r.stages.impact.reason}<br />
                    3) 안전: {r.stages.safety.decision}{r.stages.safety.protect?.length ? ` · 보호: ${r.stages.safety.protect.join(", ")}` : ""}<br />
                    4) 관리자: <b>{r.stages.manager.decision}</b> · {r.stages.manager.reason}
                  </div>
                </details>
              ))}
              <div style={{ fontSize: 10, color: C.text3, marginTop: 8 }}>※ 격리/보관 실행은 별도(스키마 컬럼 논의 후). 현재는 탐지·판정만 제공합니다.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
