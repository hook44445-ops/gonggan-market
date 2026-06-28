// 관리자 — 채팅/대화 관리 (read-only)
//
// 신규 DB 없이 기존 데이터만 조회해 표시한다:
//   - 프로젝트 대화(거래 채팅): getAdminProjectFlow RPC (참여자/상태/증빙 후보·공식 파생/직거래)
//   - 라운지 대화 신청: getAdminLoungeChatRequests (상태/20토큰 차감 여부)
//   - 직거래 의심: getDirectDealReports
//   - admin_logs: getAdminLogs (최근 기록 표시만)
// 조회/표시 전용 — 어떤 mutation 도 하지 않는다. 자동 제재 없음.

import { useEffect, useState } from "react";
import {
  getAdminProjectFlow,
  getAdminLoungeChatRequests,
  getDirectDealReports,
  getAdminLogs,
  getProjectChatSummary,
} from "../../lib/supabase";

const C = {
  bg: "#f3f0ea", surface: "#fff", line: "#e4ddd0", text1: "#3a352c",
  text2: "#5a5346", text3: "#8a8270", brand: "#2E5F4B", red: "#c0392b",
  amber: "#b8860b", blue: "#2b6cb0",
};

// ── 파생 로직 (deriveFlowFlags 와 동일 기준의 축약본, 읽기 전용) ──
const cpTypes = (row) => (row.checkpoints || []).map((c) => c.checkpoint_type);
function deriveStatus(row) {
  const ts = row.escrow?.transaction_status;
  const t = cpTypes(row);
  const has = (arr) => arr.some((x) => t.includes(x));
  if (ts === "COMPLETED" || ts === "SETTLED" || row.escrow?.step4_approved_at) return "완료";
  if (["STARTED", "MID_INSPECTION"].includes(ts)) return "에스크로 진행";
  if (["CONTRACTED", "COMPANY_SELECTED"].includes(ts) || has(["contract"])) return "계약 진행";
  if (has(["site_visit"]) || row.site_visit) return "현장방문 확정";
  if ((row.bids_count ?? 0) > 0 || row.selected_bid) return "견적 상담";
  return "일반 채팅";
}
function deriveEvidence(row) {
  const ts = row.escrow?.transaction_status;
  const t = cpTypes(row);
  const has = (arr) => arr.some((x) => t.includes(x));
  const official =
    has(["contract", "start", "construction_start", "middle", "mid_inspection", "complete", "completion"]) ||
    ["CONTRACTED", "STARTED", "MID_INSPECTION", "COMPLETED", "SETTLED"].includes(ts);
  if (official) return "공식";
  if (has(["site_visit"]) || row.site_visit) return "후보";
  return "없음";
}
function deriveOrigin(row) {
  if (row.escrow) return "contract";
  if (row.selected_bid || (row.bids_count ?? 0) > 0) return "bid";
  return "request";
}
const short = (id) => (id ? String(id).slice(0, 8) : "—");
const fmt = (ts) => {
  if (!ts) return "—";
  try { return new Date(ts).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }); }
  catch { return String(ts); }
};

function Badge({ label, tone = C.text2, bg = "#f0ece3" }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 800, color: tone, background: bg,
      borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{label}</span>
  );
}
function Section({ title, count, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: 8 }}>
        {title} <span style={{ color: C.brand }}>{count}</span>
      </div>
      {children}
    </div>
  );
}

export default function AdminChatOverview({ adminId }) {
  const [flow, setFlow] = useState([]);
  const [lounge, setLounge] = useState([]);
  const [ddr, setDdr] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [chatCache, setChatCache] = useState({}); // request_id -> summary

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const [f, l, d, lg] = await Promise.all([
          getAdminProjectFlow(adminId, { limit: 200 }),
          getAdminLoungeChatRequests({ limit: 200 }),
          getDirectDealReports({ limit: 100 }),
          getAdminLogs(),
        ]);
        if (!alive) return;
        setFlow(f?.data ?? []);
        setLounge(l?.data ?? []);
        setDdr(d?.data ?? []);
        setLogs((lg?.data ?? []).slice(0, 30));
        if (f?.error) setErr(f.error.message || "프로젝트 흐름 조회 오류");
      } catch (e) {
        if (alive) setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [adminId]);

  const toggle = async (row) => {
    const id = row.request_id;
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!chatCache[id]) {
      const sum = await getProjectChatSummary({
        customerId: row.customer?.id,
        companyId: row.company?.id,
        ownerId: row.company?.owner_id ?? row.company?.owner_user_id,
      });
      setChatCache((p) => ({ ...p, [id]: sum }));
    }
  };

  if (loading) return <div style={{ padding: 24, color: C.text3 }}>불러오는 중…</div>;

  return (
    <div style={{ padding: "4px 2px" }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: 6 }}>💬 채팅/대화 관리</div>
      <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.6, marginBottom: 16 }}>
        조회·표시 전용입니다. 기존 데이터를 기준으로 표시하며 자동 제재/삭제는 하지 않습니다.
        증빙 후보/공식은 현재 checkpoint 기준 <b>파생 표시</b>입니다(별도 상태 컬럼은 향후 도입).
      </div>
      {err && (
        <div style={{ background: "#fbeae7", border: `1px solid #e6b8b0`, color: C.red,
          borderRadius: 10, padding: "10px 12px", fontSize: 12, marginBottom: 14 }}>
          일부 데이터 조회 실패: {err}
        </div>
      )}

      {/* 1) 프로젝트 대화(거래 채팅) */}
      <Section title="🏗 프로젝트 대화 (거래)" count={flow.length}>
        {flow.length === 0 ? (
          <div style={{ color: C.text3, fontSize: 13, padding: "8px 0" }}>표시할 프로젝트 대화가 없습니다.</div>
        ) : flow.map((row) => {
          const status = deriveStatus(row);
          const evi = deriveEvidence(row);
          const ddrN = row.direct_deal_reports?.length ?? 0;
          const reviewN = row.review_count ?? 0;
          const sum = chatCache[row.request_id];
          return (
            <div key={row.request_id} style={{ background: C.surface, border: `1px solid ${C.line}`,
              borderRadius: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }}
              onClick={() => toggle(row)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text1 }}>
                  {row.customer?.name ?? "고객"} ↔ {row.company?.name ?? "업체"}
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <Badge label={`경로:${deriveOrigin(row)}`} />
                  <Badge label={status} tone={C.brand} bg="#e8f0ea" />
                  <Badge label={`증빙:${evi}`} tone={evi === "공식" ? C.brand : evi === "후보" ? C.amber : C.text3}
                    bg={evi === "공식" ? "#e8f0ea" : evi === "후보" ? "#fbf3df" : "#f0ece3"} />
                  {ddrN > 0 && <Badge label={`직거래의심 ${ddrN}`} tone="#fff" bg={C.red} />}
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: C.text3, marginTop: 5 }}>
                {row.area ?? "—"} · {row.space_type ?? "—"} · req {short(row.request_id)} · 후기 {reviewN} · {fmt(row.created_at)}
              </div>
              {expanded === row.request_id && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                  <div style={{ fontSize: 12, color: C.text2, marginBottom: 4 }}>
                    최근 메시지: {sum ? (sum.last ? `${sum.recent?.[0]?.text ?? ""} (${fmt(sum.last)})` : "메시지 없음") : "불러오는 중…"}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.text3 }}>
                    메시지 수: {sum?.count ?? "—"} · 단계 증빙: {(row.checkpoints || []).map(c => c.checkpoint_type).join(", ") || "없음"}
                    {row.escrow?.transaction_status ? ` · 에스크로:${row.escrow.transaction_status}` : ""}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Section>

      {/* 2) 라운지 대화 신청 */}
      <Section title="📨 라운지 대화 신청" count={lounge.length}>
        {lounge.length === 0 ? (
          <div style={{ color: C.text3, fontSize: 13, padding: "8px 0" }}>
            표시할 라운지 신청이 없습니다. (RLS 로 관리자 전수 조회가 제한될 수 있음 — 향후 read-only RPC로 보완 예정)
          </div>
        ) : lounge.map((r) => {
          const left = r.requester_left_at || r.target_left_at;
          const statusLabel = left && r.status !== "accepted" ? "cancelled" : r.status;
          return (
            <div key={r.id} style={{ background: C.surface, border: `1px solid ${C.line}`,
              borderRadius: 12, padding: "10px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>
                  신청자 {short(r.requester_id)} → 수신자 {short(r.target_id)}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <Badge label={statusLabel}
                    tone={r.status === "accepted" ? C.brand : r.status === "rejected" ? C.red : C.text2}
                    bg={r.status === "accepted" ? "#e8f0ea" : r.status === "rejected" ? "#fbeae7" : "#f0ece3"} />
                  <Badge label={r.token_charged ? "20토큰 차감됨" : "토큰 미차감"}
                    tone={r.token_charged ? C.blue : C.text3} bg={r.token_charged ? "#e6eef7" : "#f0ece3"} />
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: C.text3, marginTop: 4 }}>
                신청 {fmt(r.created_at)}{r.accepted_at ? ` · 수락 ${fmt(r.accepted_at)}` : ""}
              </div>
            </div>
          );
        })}
      </Section>

      {/* 3) 직거래 의심 (요약, 상세 처리는 '직거래 의심' 탭) */}
      <Section title="🚨 직거래 의심" count={ddr.length}>
        {ddr.length === 0 ? (
          <div style={{ color: C.text3, fontSize: 13, padding: "8px 0" }}>직거래 의심 항목이 없습니다.</div>
        ) : ddr.slice(0, 20).map((d) => (
          <div key={d.id} style={{ background: C.surface, border: `1px solid ${C.line}`,
            borderRadius: 12, padding: "10px 14px", marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ fontSize: 12.5, color: C.text1, fontWeight: 700 }}>{d.trigger_type ?? "감지"}</div>
              <Badge label={d.status ?? "pending"} tone={C.red} bg="#fbeae7" />
            </div>
            <div style={{ fontSize: 11.5, color: C.text3, marginTop: 4 }}>
              {d.trigger_detail?.matched ?? d.trigger_detail?.keyword ?? ""} · {fmt(d.detected_at)}
            </div>
          </div>
        ))}
        {ddr.length > 20 && <div style={{ fontSize: 11.5, color: C.text3 }}>… 외 {ddr.length - 20}건 (전체는 ‘직거래 의심’ 탭)</div>}
      </Section>

      {/* 4) 최근 관리자 로그 (조회 표시만) */}
      <Section title="📑 최근 관리자 로그" count={logs.length}>
        {logs.length === 0 ? (
          <div style={{ color: C.text3, fontSize: 13, padding: "8px 0" }}>표시할 로그가 없습니다. (전체는 ‘관리자로그’ 탭)</div>
        ) : logs.map((g) => (
          <div key={g.id} style={{ fontSize: 11.5, color: C.text2, padding: "6px 0", borderBottom: `1px solid ${C.bg}` }}>
            <b>{g.action ?? g.event ?? "action"}</b> · {g.target_type ?? ""} {short(g.target_id)} · {fmt(g.created_at)}
          </div>
        ))}
      </Section>
    </div>
  );
}
