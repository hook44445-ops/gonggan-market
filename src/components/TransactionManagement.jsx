import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { getAdminProjectFlow } from "../lib/supabase";
import { manwonToWon, formatWon, contractFinance } from "../lib/financeUtils";
import {
  flowStageLabel, paymentStatus, settlementStatus, escrowStatusLabel,
  isTxCompleted, shortId, fmtDate,
} from "../lib/transactionUtils";

// ── 거래관리 — 프로젝트 전체 흐름을 한 화면에서 조회(조회 전용) ──────────────
// 데이터 소스: admin_project_flow_list(047~056, 배포 완료) — 신규 migration 없음.
// 견적요청→입찰→업체선택→계약→결제(예치)→에스크로→착공→중간점검→완료→리뷰→정산
export default function TransactionManagement({ adminUserId, showToast }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState(null);
  const [search, setSearch]   = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | ongoing | completed | dispute
  const [selected, setSelected] = useState(null);

  const load = async (searchVal) => {
    setLoading(true); setErrMsg(null);
    const { data, error } = await getAdminProjectFlow(adminUserId, { search: searchVal ?? null, limit: 1000 });
    if (error) {
      setErrMsg(error.message || "조회 실패");
      setRows([]);
      console.log("[GONGGAN_DEBUG][Transactions] error", error.message);
    } else {
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      console.log("[GONGGAN_DEBUG][Transactions] count", list.length);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [adminUserId]);

  // 계약(에스크로) 성립 거래만 거래관리 대상으로 본다.
  const txRows = rows.filter(r => r.escrow && r.escrow.transaction_status !== "CANCELLED");

  const filtered = txRows.filter(row => {
    if (statusFilter === "completed" && !isTxCompleted(row)) return false;
    if (statusFilter === "ongoing"   &&  isTxCompleted(row)) return false;
    if (statusFilter === "dispute"   && !(row.escrow?.transaction_status === "DISPUTE" || row.escrow?.dispute_status))
      return false;
    return true;
  });

  const Chip = ({ active, onClick, children }) => (
    <button onClick={onClick}
      style={{ padding: "6px 12px", borderRadius: R.full, fontSize: 12, fontWeight: 700,
        border: `1px solid ${active ? C.brand : C.bgWarm}`, cursor: "pointer", whiteSpace: "nowrap",
        background: active ? C.brand : C.surface, color: active ? "#fff" : C.text2 }}>{children}</button>
  );

  const Th = ({ children, w }) => (
    <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 700,
      color: C.text3, whiteSpace: "nowrap", width: w }}>{children}</th>
  );
  const Td = ({ children, mono }) => (
    <td style={{ padding: "9px 10px", fontSize: 12, color: C.text1, whiteSpace: "nowrap",
      fontFamily: mono ? "monospace" : "inherit" }}>{children}</td>
  );
  const Badge = ({ label, color }) => (
    <span style={{ background: `${color}1A`, color, borderRadius: R.sm, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{label}</span>
  );

  return (
    <div style={{ padding: "8px 4px" }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: 6 }}>거래관리</div>
      <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.7, marginBottom: 12 }}>
        견적요청부터 정산까지 전체 거래 흐름을 한 화면에서 조회합니다. 계약(에스크로) 성립 거래만 표시하며, 결제·정산 상태는 에스크로 단계값 기준입니다. (읽기 전용)
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="고객명 · 업체명 · 전화번호 · 거래번호 · 지역"
          onKeyDown={e => { if (e.key === "Enter") load(search.trim() || null); }}
          style={{ flex: 1, padding: "11px 14px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.lg, fontSize: 14, outline: "none", color: C.text1, background: C.surface, fontFamily: "inherit" }} />
        <button onClick={() => load(search.trim() || null)}
          style={{ background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, padding: "0 18px", fontSize: 14, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>검색</button>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
        <Chip active={statusFilter === "all"}       onClick={() => setStatusFilter("all")}>전체</Chip>
        <Chip active={statusFilter === "ongoing"}   onClick={() => setStatusFilter("ongoing")}>진행중</Chip>
        <Chip active={statusFilter === "completed"} onClick={() => setStatusFilter("completed")}>완료</Chip>
        <Chip active={statusFilter === "dispute"}   onClick={() => setStatusFilter("dispute")}>분쟁</Chip>
      </div>

      {errMsg && (
        <div style={{ background: "#FFF0F0", color: C.red, border: `1px solid #F5C6C6`, borderRadius: R.lg, padding: "10px 12px", fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>
          조회 실패: {errMsg}
          {/(Could not find the function|does not exist|schema cache|PGRST202)/i.test(errMsg) && <><br/>RPC 없음 — admin_project_flow_list 미적용</>}
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: 8 }}>
        거래 {loading ? "…" : filtered.length}건 {!loading && txRows.length !== filtered.length && <span style={{ color: C.text4, fontWeight: 500 }}>/ 전체 {txRows.length}</span>}
      </div>

      {loading ? (
        <div style={{ color: C.text3, fontSize: 13, padding: "12px 0" }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: C.text4, fontSize: 13, padding: "12px 0" }}>해당 조건의 거래가 없습니다</div>
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${C.bgWarm}`, borderRadius: R.lg }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 920 }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.bgWarm}` }}>
                <Th>거래번호</Th><Th>고객</Th><Th>업체</Th><Th>계약금액</Th><Th>진행단계</Th>
                <Th>결제</Th><Th>에스크로</Th><Th>정산</Th><Th>분쟁</Th><Th>생성일</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const esc = row.escrow;
                const won = manwonToWon(esc?.total_amount);
                const pay = paymentStatus(esc);
                const set = settlementStatus(esc);
                const disputed = esc?.transaction_status === "DISPUTE" || esc?.dispute_status != null;
                return (
                  <tr key={row.request_id} onClick={() => setSelected(row)}
                    style={{ borderBottom: i === filtered.length - 1 ? "none" : `1px solid ${C.bgWarm}`,
                      cursor: "pointer", background: C.surface }}>
                    <Td mono>{shortId(row.request_id)}</Td>
                    <Td>{row.customer?.name || "—"}</Td>
                    <Td>{row.company?.name || "미배정"}</Td>
                    <Td>{won ? formatWon(won) : "—"}</Td>
                    <Td>{flowStageLabel(row.flow_stage)}</Td>
                    <Td><Badge label={pay.label} color={pay.color} /></Td>
                    <Td>{escrowStatusLabel(esc?.transaction_status)}</Td>
                    <Td><Badge label={set.label} color={set.color} /></Td>
                    <Td>{disputed ? <Badge label="분쟁" color={C.red} /> : <span style={{ color: C.text4 }}>—</span>}</Td>
                    <Td>{fmtDate(row.created_at)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && <TransactionDetail row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ── 거래 상세(모달) — 요청/입찰/업체/계약/결제/정산/증빙/리뷰 요약 ──────────
function TransactionDetail({ row, onClose }) {
  const esc = row.escrow;
  const won = manwonToWon(esc?.total_amount);
  const fin = contractFinance(won);
  const cps = row.checkpoints || [];
  const Row = ({ k, v }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: 12 }}>
      <span style={{ color: C.text3 }}>{k}</span>
      <span style={{ color: C.text1, fontWeight: 600, textAlign: "right" }}>{v}</span>
    </div>
  );
  const Section = ({ title, children }) => (
    <div style={{ background: C.bg, borderRadius: R.md, padding: "10px 12px", marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: C.text2, marginBottom: 4 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: C.surface, width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto",
          borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: "18px 18px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>거래 상세</div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.text3 }}>×</button>
        </div>

        <Section title="요청 / 고객 / 업체">
          <Row k="거래번호" v={shortId(row.request_id)} />
          <Row k="지역 · 공간" v={`${row.area || "—"} · ${row.space_type || "—"}`} />
          <Row k="고객" v={`${row.customer?.name || "—"} (${row.customer?.phone || "—"})`} />
          <Row k="업체" v={row.company?.name || "미배정"} />
          <Row k="입찰 수" v={`${row.bids_count ?? 0}건`} />
        </Section>

        <Section title="계약 / 재무">
          <Row k="계약금액(GMV)" v={won ? formatWon(won) : "—"} />
          <Row k="플랫폼 수수료(4.4%)" v={formatWon(fin.feeTotal)} />
          <Row k="ㄴ 매출 공급가액(4.0%)" v={formatWon(fin.revenue)} />
          <Row k="ㄴ 수수료 부가세(0.4%)" v={formatWon(fin.feeVat)} />
          <Row k="업체 정산예정금" v={formatWon(fin.companyPayout)} />
        </Section>

        <Section title="결제 / 에스크로 / 정산">
          <Row k="결제(예치)" v={paymentStatus(esc).label} />
          <Row k="에스크로 상태" v={escrowStatusLabel(esc?.transaction_status)} />
          <Row k="정산 상태" v={settlementStatus(esc).label} />
          <Row k="전액예치일" v={fmtDate(esc?.step1_deposited_at)} />
          <Row k="완료확인일" v={fmtDate(esc?.step4_approved_at)} />
          {(esc?.dispute_status || esc?.disputed_at) && (
            <Row k="분쟁" v={`${esc.dispute_status || "—"} (${fmtDate(esc.disputed_at)})`} />
          )}
        </Section>

        <Section title="증빙 / 리뷰">
          <Row k="GPS 체크포인트" v={`${cps.length}건`} />
          <Row k="직거래 의심 신고" v={`${(row.direct_deal_reports || []).length}건`} />
          <Row k="리뷰" v={`${row.review_count ?? 0}건`} />
        </Section>

        <div style={{ fontSize: 11, color: C.text4, lineHeight: 1.6 }}>
          ※ 결제·정산 상태는 에스크로 단계값 기준 파생값입니다. PG 결제행/업체 정산행 정밀 조회는 2차(전용 RPC) 연동 예정입니다.
        </div>
      </div>
    </div>
  );
}
