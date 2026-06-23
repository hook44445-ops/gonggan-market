import { useState, useEffect } from "react";
import { dlog } from "../utils/devLog"; // 프로덕션 무출력 진단 로거(운영 콘솔 정리)
import { C, R, S } from "../constants";
import {
  getAdminProjectFlow, getTestAccounts,
  getSettlementAdminState, setSettlementStatus, saveSettlementMemo,
} from "../lib/supabase";
import { manwonToWon, formatWon, contractFinance } from "../lib/financeUtils";
import {
  flowStageLabel, paymentStatus, escrowStatusLabel, shortId, fmtDate, txMatchesSearch,
} from "../lib/transactionUtils";
import { buildTestAccountSet, isTestRow } from "../lib/testAccounts";
import { downloadCsv, csvStamp } from "../utils/exportCsv";
import { Chip, Th, Td } from "./common/AdminTableUI";

// ── 정산관리 고도화(V2.2) — "업체에게 얼마를 지급해야 하는지" 중심 화면 ──────
// 데이터 소스: admin_project_flow_list(escrow) + settlement_admin_state(072).
// 정산상태 = 관리자 오버라이드(settlement_admin_state) 우선, 없으면 escrow 파생.
// 실제 송금/환불/PG 출금 없음 — 표시/상태/메모만 관리.
const STATUS_META = {
  READY:     { label: "정산대기", color: C.brand },
  APPROVED:  { label: "지급승인", color: "#2980B9" },
  HELD:      { label: "지급보류", color: C.gold },
  PAID:      { label: "지급완료", color: "#27AE60" },
  CANCELLED: { label: "정산취소", color: C.red },
  DISPUTE:   { label: "분쟁보류", color: "#9B59B6" },
};
const FILTERS = [
  ["all", "전체"], ["READY", "정산대기"], ["APPROVED", "지급승인"],
  ["PAID", "지급완료"], ["HELD", "지급보류"], ["DISPUTE", "분쟁보류"], ["CANCELLED", "정산취소"],
];

// 거래 한 행의 정산 파생값(관리상태 오버라이드 + escrow 파생).
export function deriveSettlement(row, adminMap) {
  const esc = row.escrow;
  const ts = esc?.transaction_status;
  const disputed = ts === "DISPUTE" || esc?.dispute_status != null;
  const admin = adminMap?.get(String(esc?.id)) || null;
  let code;
  if (admin?.status) code = admin.status;        // 관리자 명시 우선
  else if (ts === "CANCELLED") code = "CANCELLED";
  else if (disputed) code = "DISPUTE";
  else if (ts === "SETTLED") code = "PAID";
  else code = "READY";
  return { code, disputed, admin };
}

export default function SettlementManagement({ adminUserId, showToast }) {
  const [rows, setRows]       = useState([]);
  const [adminMap, setAdminMap] = useState(new Map());
  const [testSet, setTestSet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg]   = useState(null);
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("all");
  const [excludeTest, setExcludeTest] = useState(true);
  const [selected, setSelected] = useState(null);

  const loadAdminState = async () => {
    try {
      const { data } = await getSettlementAdminState(adminUserId);
      const m = new Map();
      for (const s of Array.isArray(data) ? data : []) m.set(String(s.contract_id), s);
      setAdminMap(m);
      return m;
    } catch { setAdminMap(new Map()); return new Map(); }
  };

  const load = async () => {
    setLoading(true); setErrMsg(null);
    try {
      const { data: ta } = await getTestAccounts(adminUserId);
      setTestSet(buildTestAccountSet(Array.isArray(ta) ? ta : []));
    } catch { setTestSet(buildTestAccountSet([])); }
    await loadAdminState();
    const { data, error } = await getAdminProjectFlow(adminUserId, { limit: 1000 });
    if (error) {
      setErrMsg(error.message || "조회 실패"); setRows([]);
      dlog("[GONGGAN_DEBUG][Settlement] error", error.message);
    } else {
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      dlog("[GONGGAN_DEBUG][Settlement] count", list.length);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [adminUserId]);

  // 계약(에스크로) 성립 거래만 정산 대상.
  const txRows = rows.filter(r => r.escrow);
  const testCount = txRows.filter(r => isTestRow(r, testSet)).length;
  const visibleRows = (excludeTest ? txRows.filter(r => !isTestRow(r, testSet)) : txRows);
  const filtered = visibleRows.filter(row => {
    if (!txMatchesSearch(row, search)) return false;
    if (filter === "all") return true;
    return deriveSettlement(row, adminMap).code === filter;
  });

  // KPI 집계(표시 대상 기준 — 테스트 제외 여부 반영).
  const kpi = { ready: 0, approved: 0, paid: 0, held: 0, dispute: 0, readyCnt: 0, paidCnt: 0 };
  for (const row of visibleRows) {
    const fin = contractFinance(manwonToWon(row.escrow?.total_amount));
    const { code } = deriveSettlement(row, adminMap);
    if (code === "READY")     { kpi.ready += fin.companyPayout; kpi.readyCnt += 1; }
    else if (code === "APPROVED") kpi.approved += fin.companyPayout;
    else if (code === "PAID")  { kpi.paid += fin.companyPayout; kpi.paidCnt += 1; }
    else if (code === "HELD")     kpi.held += fin.companyPayout;
    else if (code === "DISPUTE")  kpi.dispute += fin.companyPayout;
  }

  // CSV 다운로드 — 현재 필터된 정산 목록(읽기 전용, 계산 로직 미변경)
  const exportCsv = () => {
    const cols = [
      { label: "거래번호", get: (r) => shortId(r.request_id) },
      { label: "계약번호", get: (r) => shortId(r.escrow?.id) },
      { label: "업체", get: (r) => r.company?.name ?? "" },
      { label: "고객", get: (r) => r.customer?.name ?? "" },
      { label: "계약금액(원)", get: (r) => contractFinance(manwonToWon(r.escrow?.total_amount)).gmv },
      { label: "플랫폼수수료(원)", get: (r) => contractFinance(manwonToWon(r.escrow?.total_amount)).feeTotal },
      { label: "부가세(원)", get: (r) => contractFinance(manwonToWon(r.escrow?.total_amount)).feeVat },
      { label: "정산예정금(원)", get: (r) => contractFinance(manwonToWon(r.escrow?.total_amount)).companyPayout },
      { label: "정산상태", get: (r) => (STATUS_META[deriveSettlement(r, adminMap).code] || {}).label ?? "" },
      { label: "분쟁", get: (r) => deriveSettlement(r, adminMap).disputed ? "Y" : "N" },
      { label: "테스트", get: (r) => isTestRow(r, testSet) ? "Y" : "N" },
      { label: "결제일", get: (r) => fmtDate(r.escrow?.step1_deposited_at) },
      { label: "완료확인일", get: (r) => fmtDate(r.escrow?.step4_approved_at) },
    ];
    downloadCsv(`정산관리_${csvStamp()}.csv`, filtered, cols);
  };

  const SBadge = ({ code }) => {
    const m = STATUS_META[code] || STATUS_META.READY;
    return <span style={{ background: `${m.color}1A`, color: m.color, borderRadius: R.sm, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{m.label}</span>;
  };
  const KCard = ({ label, value, sub, accent }) => (
    <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "12px 14px", flex: "1 1 130px", minWidth: 130 }}>
      <div style={{ fontSize: 11, color: C.text3, fontWeight: 700, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: accent || C.text1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.text4, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding: "8px 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>거래별 정산</div>
        <button onClick={exportCsv} disabled={loading || filtered.length === 0}
          style={{ marginLeft: "auto", background: C.brandL, color: C.brand, border: `1px solid ${C.brandM ?? C.bgWarm}`, borderRadius: R.md, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>CSV 다운로드</button>
        <button onClick={load} disabled={loading}
          style={{ background: C.bgWarm, color: C.text2, border: "none", borderRadius: R.md, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>새로고침</button>
      </div>
      <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.7, marginBottom: 10 }}>
        업체에게 지급해야 할 정산예정금을 거래 단위로 관리합니다. 정산예정금 = 계약금액 − 플랫폼 수수료(4.4%). 상태/메모만 기록하며 실제 송금은 발생하지 않습니다.
      </div>

      {/* 테스트 거래 제외 토글 */}
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer",
        background: C.surface, border: `1px solid ${excludeTest ? C.brand : C.bgWarm}`, borderRadius: R.lg, padding: "8px 12px" }}>
        <input type="checkbox" checked={excludeTest} onChange={e => setExcludeTest(e.target.checked)}
          style={{ width: 16, height: 16, accentColor: C.brand, cursor: "pointer" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text2 }}>
          테스트 거래 제외 {!loading && testCount > 0 && <span style={{ color: C.text4, fontWeight: 500 }}>({testCount}건)</span>}
        </span>
      </label>

      {/* KPI */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <KCard label="정산대기금액" value={formatWon(kpi.ready)} accent={C.brand} sub={`${kpi.readyCnt}건`} />
        <KCard label="지급승인금액" value={formatWon(kpi.approved)} accent="#2980B9" />
        <KCard label="지급완료금액" value={formatWon(kpi.paid)} accent="#27AE60" sub={`${kpi.paidCnt}건`} />
        <KCard label="지급보류금액" value={formatWon(kpi.held)} accent={C.gold} />
        <KCard label="분쟁보류금액" value={formatWon(kpi.dispute)} accent="#9B59B6" />
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

      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
        {FILTERS.map(([v, l]) => (
          <Chip key={v} active={filter === v} onClick={() => setFilter(v)}>{l}</Chip>
        ))}
      </div>

      {errMsg && (
        <div style={{ background: "#FFF0F0", color: C.red, border: `1px solid #F5C6C6`, borderRadius: R.lg, padding: "10px 12px", fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>
          조회 실패: {errMsg}
          {/(Could not find the function|does not exist|schema cache|PGRST202|settlement_admin)/i.test(errMsg) && <><br/>RPC 없음 — 072_settlement_admin_state.sql 적용 필요</>}
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: 8 }}>
        정산 {loading ? "…" : filtered.length}건 {!loading && visibleRows.length !== filtered.length && <span style={{ color: C.text4, fontWeight: 500 }}>/ 전체 {visibleRows.length}</span>}
      </div>

      {loading ? (
        <div style={{ color: C.text3, fontSize: 13, padding: "12px 0" }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: C.text4, fontSize: 13, padding: "12px 0" }}>해당 조건의 정산 건이 없습니다</div>
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${C.bgWarm}`, borderRadius: R.lg }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1400 }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.bgWarm}` }}>
                <Th>거래번호</Th><Th>업체</Th><Th>고객</Th><Th>계약금액</Th>
                <Th>플랫폼 수수료</Th><Th>매출 공급가액</Th><Th>부가세</Th>
                <Th>정산예정금</Th><Th>실제 정산금</Th><Th>정산상태</Th>
                <Th>결제일</Th><Th>완료확인일</Th><Th>정산예정일</Th><Th>정산완료일</Th><Th>분쟁</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const esc = row.escrow;
                const fin = contractFinance(manwonToWon(esc?.total_amount));
                const { code, disputed, admin } = deriveSettlement(row, adminMap);
                const isTest = isTestRow(row, testSet);
                const paidActual = code === "PAID" ? fin.companyPayout : null;
                const settledAt = code === "PAID" ? (admin?.updated_at || esc?.updated_at || esc?.step4_approved_at) : null;
                return (
                  <tr key={row.request_id} onClick={() => setSelected(row)}
                    style={{ borderBottom: i === filtered.length - 1 ? "none" : `1px solid ${C.bgWarm}`,
                      cursor: "pointer", background: isTest ? "#FFFBEF" : C.surface }}>
                    <Td mono>
                      {isTest && <span style={{ background: "#8A5C00", color: "#fff", borderRadius: R.sm, padding: "1px 6px", fontSize: 10, fontWeight: 800, marginRight: 6 }}>TEST</span>}
                      {shortId(row.request_id)}
                    </Td>
                    <Td>{row.company?.name || "미배정"}</Td>
                    <Td>{row.customer?.name || "—"}</Td>
                    <Td>{fin.gmv ? formatWon(fin.gmv) : "—"}</Td>
                    <Td>{formatWon(fin.feeTotal)}</Td>
                    <Td>{formatWon(fin.revenue)}</Td>
                    <Td>{formatWon(fin.feeVat)}</Td>
                    <Td>{fin.gmv ? formatWon(fin.companyPayout) : "—"}</Td>
                    <Td>{paidActual != null ? formatWon(paidActual) : "—"}</Td>
                    <Td><SBadge code={code} /></Td>
                    <Td>{fmtDate(esc?.step1_deposited_at)}</Td>
                    <Td>{fmtDate(esc?.step4_approved_at)}</Td>
                    <Td>{fmtDate(esc?.step4_approved_at)}</Td>
                    <Td>{fmtDate(settledAt)}</Td>
                    <Td>{disputed ? <span style={{ color: C.red, fontWeight: 700 }}>분쟁</span> : <span style={{ color: C.text4 }}>—</span>}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <SettlementDetail
          row={selected} adminMap={adminMap} adminUserId={adminUserId} showToast={showToast}
          onClose={() => setSelected(null)}
          onChanged={async () => { await loadAdminState(); }}
        />
      )}
    </div>
  );
}

// ── 정산 상세(모달) — 거래/금액/결제/증빙/관리자 액션·메모 ──────────────────
function SettlementDetail({ row, adminMap, adminUserId, showToast, onClose, onChanged }) {
  const esc = row.escrow;
  const fin = contractFinance(manwonToWon(esc?.total_amount));
  const { code, disputed, admin } = deriveSettlement(row, adminMap);
  const cps = row.checkpoints || [];
  const photoCps = cps.filter(c => (c.photo_urls?.length ?? 0) > 0 || c.photo_url).length;

  const [busy, setBusy] = useState(false);
  const [holdReason, setHoldReason]     = useState(admin?.hold_reason ?? "");
  const [paidMemo, setPaidMemo]         = useState(admin?.paid_memo ?? "");
  const [internalMemo, setInternalMemo] = useState(admin?.internal_memo ?? "");
  const paidActual = code === "PAID" ? fin.companyPayout : null;
  const settledAt = code === "PAID" ? (admin?.updated_at || esc?.updated_at || esc?.step4_approved_at) : null;

  const act = async (status) => {
    if (busy) return;
    setBusy(true);
    const reason = status === "HELD" ? (holdReason || null) : null;
    const { error } = await setSettlementStatus(adminUserId, esc?.id, status, reason);
    setBusy(false);
    if (error) {
      const m = error.message || "";
      if (/settlement_admin|Could not find the function|PGRST202|does not exist/i.test(m)) showToast?.("RPC 없음 — 072 적용 필요", false);
      else if (m.includes("ADMIN_ONLY")) showToast?.("관리자(role=admin)만 처리할 수 있어요", false);
      else showToast?.(`처리 실패: ${m}`, false);
      return;
    }
    showToast?.(`정산상태: ${STATUS_META[status]?.label ?? status} 처리`);
    await onChanged?.();
    onClose();
  };

  const saveMemo = async () => {
    if (busy) return;
    setBusy(true);
    const { error } = await saveSettlementMemo(adminUserId, esc?.id, holdReason || null, paidMemo || null, internalMemo || null);
    setBusy(false);
    if (error) { showToast?.("메모 저장 실패", false); return; }
    showToast?.("메모 저장 완료");
    await onChanged?.();
  };

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
  const sm = STATUS_META[code] || STATUS_META.READY;
  const ActBtn = ({ label, bg, color, onClick }) => (
    <button disabled={busy} onClick={onClick}
      style={{ flex: "1 1 30%", minWidth: 88, padding: "9px", background: bg, color, border: `1px solid ${color}33`,
        borderRadius: R.lg, fontWeight: 700, fontSize: 12, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
      {label}
    </button>
  );
  const memoInput = (val, set, ph) => (
    <textarea value={val} onChange={e => set(e.target.value)} placeholder={ph}
      style={{ width: "100%", minHeight: 44, padding: "8px 10px", border: `1px solid ${C.bgWarm}`, borderRadius: R.md,
        fontSize: 12, outline: "none", color: C.text1, background: C.surface, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", marginTop: 4 }} />
  );

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: C.surface, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto",
          borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, padding: "18px 18px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>정산 상세</div>
          <span style={{ background: `${sm.color}1A`, color: sm.color, borderRadius: R.sm, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{sm.label}</span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.text3 }}>×</button>
        </div>

        <Section title="거래 정보">
          <Row k="거래번호(request)" v={shortId(row.request_id)} />
          <Row k="계약번호(contract)" v={shortId(esc?.id)} />
          <Row k="고객" v={`${row.customer?.name || "—"} (${row.customer?.phone || "—"})`} />
          <Row k="업체" v={row.company?.name || "미배정"} />
          <Row k="지역 · 공간" v={`${row.area || "—"} · ${row.space_type || "—"}`} />
          <Row k="진행단계" v={flowStageLabel(row.flow_stage)} />
        </Section>

        <Section title="금액 정보">
          <Row k="계약금액(GMV)" v={fin.gmv ? formatWon(fin.gmv) : "—"} />
          <Row k="플랫폼 수수료 총액(4.4%)" v={formatWon(fin.feeTotal)} />
          <Row k="ㄴ 매출 공급가액(4.0%)" v={formatWon(fin.revenue)} />
          <Row k="ㄴ 수수료 부가세(0.4%)" v={formatWon(fin.feeVat)} />
          <Row k="정산예정금" v={fin.gmv ? formatWon(fin.companyPayout) : "—"} />
          <Row k="실제 정산금" v={paidActual != null ? formatWon(paidActual) : "—"} />
        </Section>

        <Section title="결제 / 에스크로 정보">
          <Row k="결제상태" v={paymentStatus(esc).label} />
          <Row k="에스크로상태" v={escrowStatusLabel(esc?.transaction_status)} />
          <Row k="결제일" v={fmtDate(esc?.step1_deposited_at)} />
          <Row k="완료확인일" v={fmtDate(esc?.step4_approved_at)} />
          <Row k="정산완료일" v={fmtDate(settledAt)} />
        </Section>

        <Section title="증빙 연결">
          <Row k="GPS 체크포인트" v={`${cps.length}건`} />
          <Row k="사진 증빙" v={`${photoCps}건`} />
          <Row k="직거래 의심 신고" v={`${(row.direct_deal_reports || []).length}건`} />
          <Row k="리뷰" v={`${row.review_count ?? 0}건`} />
          <Row k="분쟁 여부" v={disputed ? "분쟁 있음" : "없음"} />
        </Section>

        <Section title="관리자 액션">
          <div style={{ fontSize: 11, color: C.text4, marginBottom: 8, lineHeight: 1.6 }}>
            상태·메모 표시만 저장됩니다. 실제 송금/환불/PG 출금은 발생하지 않습니다.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            <ActBtn label="지급승인" bg="#EAF2FB" color="#2980B9" onClick={() => act("APPROVED")} />
            <ActBtn label="지급보류" bg="#FBF5E8" color={C.gold} onClick={() => act("HELD")} />
            <ActBtn label="지급완료" bg="#EAF7EE" color="#27AE60" onClick={() => act("PAID")} />
            <ActBtn label="정산취소" bg="#FFF0F0" color={C.red} onClick={() => act("CANCELLED")} />
            <ActBtn label="대기로" bg={C.brandL} color={C.brand} onClick={() => act("READY")} />
          </div>
        </Section>

        <Section title="관리자 메모">
          <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>보류 사유</div>
          {memoInput(holdReason, setHoldReason, "지급 보류 사유")}
          <div style={{ fontSize: 11, color: C.text3, marginTop: 8 }}>지급완료 메모</div>
          {memoInput(paidMemo, setPaidMemo, "지급 완료 관련 메모")}
          <div style={{ fontSize: 11, color: C.text3, marginTop: 8 }}>내부 메모</div>
          {memoInput(internalMemo, setInternalMemo, "내부용 메모")}
          <button disabled={busy} onClick={saveMemo}
            style={{ width: "100%", marginTop: 10, padding: "10px", background: C.brand, color: "#fff", border: "none",
              borderRadius: R.lg, fontWeight: 800, fontSize: 13, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
            메모 저장
          </button>
        </Section>

        <div style={{ fontSize: 11, color: C.text4, lineHeight: 1.6 }}>
          ※ 정산상태는 관리자 표시값(settlement_admin_state)이 있으면 우선하며, 없으면 에스크로 단계에서 파생합니다. 분쟁 여부는 항상 에스크로/분쟁 상태에서 파생됩니다.
        </div>
      </div>
    </div>
  );
}
