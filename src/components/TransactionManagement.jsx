import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { getAdminProjectFlow, getTestAccounts } from "../lib/supabase";
import { manwonToWon, formatWon, contractFinance } from "../lib/financeUtils";
import { buildTestAccountSet, isTestRow } from "../lib/testAccounts";
import { downloadCsv, csvStamp } from "../utils/exportCsv";
import {
  flowStageLabel, paymentStatus, settlementStatus, escrowStatusLabel,
  isTxCompleted, shortId, fmtDate, txMatchesFilter, txMatchesSearch,
} from "../lib/transactionUtils";

// ── 거래관리 — 프로젝트 전체 흐름을 한 화면에서 관리(조회 전용) ──────────────
// 데이터 소스: admin_project_flow_list(배포 완료) — 신규 migration 없음.
// 견적요청→입찰→업체선정→계약→결제(예치)→에스크로→착공→중간점검→완료→리뷰→정산
// 결제/정산 상태·금액은 escrow 단계값에서 파생(1차 무-migration). PG 정밀행은 2차 RPC 예정.
const FILTERS = [
  ["all", "전체"], ["ongoing", "진행중"], ["completed", "완료"],
  ["dispute", "분쟁"], ["settle_ready", "정산대기"], ["settled", "정산완료"], ["cancelled", "취소"],
];

export default function TransactionManagement({ adminUserId, showToast }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState(null);
  const [search, setSearch]   = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [testFilter, setTestFilter] = useState("all"); // all | real | test
  const [testSet, setTestSet] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true); setErrMsg(null);
    // 테스트 계정 목록(배지/필터용) — 실패해도 거래 조회는 계속.
    try {
      const { data: ta } = await getTestAccounts(adminUserId);
      setTestSet(buildTestAccountSet(Array.isArray(ta) ? ta : []));
    } catch { setTestSet(buildTestAccountSet([])); }

    // 검색은 클라이언트에서 처리(contract_id 포함) → 전량 조회.
    const { data, error } = await getAdminProjectFlow(adminUserId, { limit: 1000 });
    if (error) {
      setErrMsg(error.message || "조회 실패"); setRows([]);
      console.log("[GONGGAN_DEBUG][Transactions] error", error.message);
    } else {
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      console.log("[GONGGAN_DEBUG][Transactions] count", list.length);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [adminUserId]);

  // 계약(에스크로) 성립 거래만 거래관리 대상. (취소 포함 — 취소 필터에서 조회)
  const txRows = rows.filter(r => r.escrow);
  const matchesTest = (row) => {
    if (testFilter === "all") return true;
    const t = isTestRow(row, testSet);
    return testFilter === "test" ? t : !t;
  };
  const filtered = txRows.filter(row =>
    txMatchesFilter(row, statusFilter) && txMatchesSearch(row, search) && matchesTest(row));

  // CSV 다운로드 — 현재 필터링된 거래 목록(읽기 전용, 계산 로직 미변경)
  const exportCsv = () => {
    const cols = [
      { label: "거래번호", get: (r) => shortId(r.request_id) },
      { label: "계약번호", get: (r) => shortId(r.escrow?.id) },
      { label: "고객", get: (r) => r.customer?.name ?? "" },
      { label: "업체", get: (r) => r.company?.name ?? "" },
      { label: "진행단계", get: (r) => flowStageLabel(r.flow_stage) },
      { label: "계약금액(원)", get: (r) => manwonToWon(r.escrow?.total_amount) },
      { label: "플랫폼수수료(원)", get: (r) => contractFinance(manwonToWon(r.escrow?.total_amount)).feeTotal },
      { label: "정산예정금(원)", get: (r) => contractFinance(manwonToWon(r.escrow?.total_amount)).companyPayout },
      { label: "결제상태", get: (r) => paymentStatus(r.escrow).label },
      { label: "정산상태", get: (r) => settlementStatus(r.escrow).label },
      { label: "분쟁", get: (r) => (r.escrow?.transaction_status === "DISPUTE" || r.escrow?.dispute_status != null) ? "Y" : "N" },
      { label: "테스트", get: (r) => isTestRow(r, testSet) ? "Y" : "N" },
      { label: "결제일", get: (r) => fmtDate(r.escrow?.step1_deposited_at) },
    ];
    downloadCsv(`거래관리_${csvStamp()}.csv`, filtered, cols);
  };

  const Chip = ({ active, onClick, children }) => (
    <button onClick={onClick}
      style={{ padding: "6px 12px", borderRadius: R.full, fontSize: 12, fontWeight: 700,
        border: `1px solid ${active ? C.brand : C.bgWarm}`, cursor: "pointer", whiteSpace: "nowrap",
        background: active ? C.brand : C.surface, color: active ? "#fff" : C.text2 }}>{children}</button>
  );
  const Th = ({ children }) => (
    <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 700,
      color: C.text3, whiteSpace: "nowrap" }}>{children}</th>
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>거래관리</div>
        <button onClick={exportCsv} disabled={loading || filtered.length === 0}
          style={{ marginLeft: "auto", background: C.brandL, color: C.brand, border: `1px solid ${C.brandM ?? C.bgWarm}`, borderRadius: R.md, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>CSV 다운로드</button>
        <button onClick={load} disabled={loading}
          style={{ background: C.bgWarm, color: C.text2, border: "none", borderRadius: R.md, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>새로고침</button>
      </div>
      <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.7, marginBottom: 12 }}>
        견적요청부터 정산까지 전체 거래 흐름을 한 화면에서 관리합니다. 계약(에스크로) 성립 거래 기준이며, 결제·정산 상태/금액은 에스크로 단계값에서 파생합니다. (읽기 전용)
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="고객명 · 업체명 · 전화번호 · request_id · contract_id · 지역"
          style={{ flex: 1, padding: "11px 14px", border: `1.5px solid ${C.bgWarm}`, borderRadius: R.lg, fontSize: 14, outline: "none", color: C.text1, background: C.surface, fontFamily: "inherit" }} />
        {search && (
          <button onClick={() => setSearch("")}
            style={{ background: C.surface, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "0 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>지우기</button>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 8, overflowX: "auto" }}>
        {FILTERS.map(([v, l]) => (
          <Chip key={v} active={statusFilter === v} onClick={() => setStatusFilter(v)}>{l}</Chip>
        ))}
      </div>

      {/* 실거래/테스트 거래 필터 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
        {[["all", "전체"], ["real", "실거래"], ["test", "테스트거래"]].map(([v, l]) => (
          <Chip key={v} active={testFilter === v} onClick={() => setTestFilter(v)}>{l}</Chip>
        ))}
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
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1280 }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.bgWarm}` }}>
                <Th>거래번호</Th><Th>고객</Th><Th>업체</Th><Th>진행단계</Th>
                <Th>계약금액</Th><Th>에스크로 보관금</Th><Th>예상 정산금</Th><Th>실제 정산금</Th>
                <Th>결제</Th><Th>정산</Th><Th>분쟁</Th><Th>결제일</Th><Th>정산일</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const esc = row.escrow;
                const won = manwonToWon(esc?.total_amount);
                const fin = contractFinance(won);
                const st = esc?.transaction_status;
                const pay = paymentStatus(esc);
                const set = settlementStatus(esc);
                const disputed = st === "DISPUTE" || esc?.dispute_status != null;
                const held = (esc?.step1_deposited_at && st !== "SETTLED" && st !== "CANCELLED") ? fin.gmv : 0;
                const actualPayout = st === "SETTLED" ? fin.companyPayout : null;
                const paidAt = esc?.step1_deposited_at;
                const settledAt = st === "SETTLED" ? (esc?.updated_at || esc?.step4_approved_at) : null;
                const isTest = isTestRow(row, testSet);
                return (
                  <tr key={row.request_id} onClick={() => setSelected(row)}
                    style={{ borderBottom: i === filtered.length - 1 ? "none" : `1px solid ${C.bgWarm}`,
                      cursor: "pointer", background: isTest ? "#FFFBEF" : C.surface }}>
                    <Td mono>
                      {isTest && <span style={{ background: "#8A5C00", color: "#fff", borderRadius: R.sm, padding: "1px 6px", fontSize: 10, fontWeight: 800, marginRight: 6 }}>TEST</span>}
                      {shortId(row.request_id)}
                    </Td>
                    <Td>{row.customer?.name || "—"}</Td>
                    <Td>{row.company?.name || "미배정"}</Td>
                    <Td>{flowStageLabel(row.flow_stage)}</Td>
                    <Td>{won ? formatWon(won) : "—"}</Td>
                    <Td>{held ? formatWon(held) : "—"}</Td>
                    <Td>{won ? formatWon(fin.companyPayout) : "—"}</Td>
                    <Td>{actualPayout != null ? formatWon(actualPayout) : "—"}</Td>
                    <Td><Badge label={pay.label} color={pay.color} /></Td>
                    <Td><Badge label={set.label} color={set.color} /></Td>
                    <Td>{disputed ? <Badge label="분쟁" color={C.red} /> : <span style={{ color: C.text4 }}>—</span>}</Td>
                    <Td>{fmtDate(paidAt)}</Td>
                    <Td>{fmtDate(settledAt)}</Td>
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
  const st = esc?.transaction_status;
  const cps = row.checkpoints || [];
  const held = (esc?.step1_deposited_at && st !== "SETTLED" && st !== "CANCELLED") ? fin.gmv : 0;
  const actualPayout = st === "SETTLED" ? fin.companyPayout : null;
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
          <Row k="거래번호(request)" v={shortId(row.request_id)} />
          <Row k="계약번호(contract)" v={shortId(esc?.id)} />
          <Row k="지역 · 공간" v={`${row.area || "—"} · ${row.space_type || "—"}`} />
          <Row k="고객" v={`${row.customer?.name || "—"} (${row.customer?.phone || "—"})`} />
          <Row k="업체" v={row.company?.name || "미배정"} />
          <Row k="입찰 수" v={`${row.bids_count ?? 0}건`} />
          <Row k="진행단계" v={flowStageLabel(row.flow_stage)} />
        </Section>

        <Section title="계약 / 재무">
          <Row k="계약금액(GMV)" v={won ? formatWon(won) : "—"} />
          <Row k="에스크로 보관금" v={held ? formatWon(held) : "—"} />
          <Row k="플랫폼 수수료(4.4%)" v={formatWon(fin.feeTotal)} />
          <Row k="ㄴ 매출 공급가액(4.0%)" v={formatWon(fin.revenue)} />
          <Row k="ㄴ 수수료 부가세(0.4%)" v={formatWon(fin.feeVat)} />
          <Row k="예상 정산금" v={formatWon(fin.companyPayout)} />
          <Row k="실제 정산금" v={actualPayout != null ? formatWon(actualPayout) : "—"} />
        </Section>

        <Section title="결제 / 에스크로 / 정산">
          <Row k="결제(예치)" v={paymentStatus(esc).label} />
          <Row k="에스크로 상태" v={escrowStatusLabel(st)} />
          <Row k="정산 상태" v={settlementStatus(esc).label} />
          <Row k="결제일(전액예치)" v={fmtDate(esc?.step1_deposited_at)} />
          <Row k="완료확인일" v={fmtDate(esc?.step4_approved_at)} />
          <Row k="정산일" v={fmtDate(st === "SETTLED" ? (esc?.updated_at || esc?.step4_approved_at) : null)} />
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
          ※ 결제·정산 상태/금액은 에스크로 단계값 기준 파생값입니다. PG 결제행/업체 정산행 정밀 조회는 2차(전용 RPC) 연동 예정입니다.
        </div>
      </div>
    </div>
  );
}
