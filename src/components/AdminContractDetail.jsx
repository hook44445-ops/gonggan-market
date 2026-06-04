import { useState, useEffect, useCallback } from "react";
import { C, R, S } from "../constants";
import {
  getAdminContractDetail, adminSetPayoutStatus, adminResolveDispute, holdAllPayoutsForEscrow,
} from "../lib/supabase";

// 관리자 계약 통합 상세 — 원계약 결제·정산·GPS 현장기록·추가견적·분쟁을 한 화면에서 "기록 확인".
// 공간마켓은 판단자가 아니라 기록 보관자 → 문구는 기록/상태 중심(정당/부당 표현 금지).
// 실제 돈 이동 없음: 정산/분쟁 액션은 상태 기록만(자동 송금/환불/정산 금지).

const fmtTs = (ts) => (ts ? new Date(ts).toLocaleString("ko-KR") : "—");
const fmtAmt = (n) => `${Number(n ?? 0).toLocaleString()}만원`;

const CHECKPOINT_LABEL = {
  site_visit: "현장방문", construction_start: "착공", mid_inspection: "중간점검", completion: "완료",
};
const PAYOUT_STAGE_LABEL = { 1: "자재비", 2: "착공", 3: "중간", 4: "완료" };
const PAYOUT_STATUS_LABEL = {
  PENDING: "대기", READY: "지급준비(READY)", APPROVED: "지급승인(APPROVED)",
  HELD: "보류(HELD)", PAID_MANUALLY: "수동지급완료(MANUAL_PAID)", MANUAL_PAID: "수동지급완료(MANUAL_PAID)",
  CANCELLED: "취소",
};
const CO_REASON_LABEL = {
  hidden_defect: "숨은 하자 발견", plumbing_issue: "배관 노후/문제", leak_issue: "누수",
  electrical_issue: "전기 배선 문제", layout_change: "구조/배치 변경",
  customer_request: "고객 변경 요청", material_upgrade: "자재 업그레이드", etc: "기타 현장 이슈",
};
const CO_STATUS_LABEL = {
  requested: "요청됨", approved: "승인됨", payment_pending: "결제 대기",
  paid: "결제 완료", completed: "완료", rejected: "거절됨", cancelled: "취소됨",
};

const copy = (text) => {
  try { navigator.clipboard?.writeText(String(text)); } catch { /* noop */ }
};

function Section({ title, sub, children }) {
  return (
    <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.md, border: `1px solid ${C.bgWarm}` }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: sub ? 2 : S.md }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: C.text4, marginBottom: S.md }}>{sub}</div>}
      {children}
    </div>
  );
}

function Row({ k, v, mono }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, padding: "3px 0", borderBottom: `1px solid ${C.bg}` }}>
      <span style={{ color: C.text3, flexShrink: 0 }}>{k}</span>
      <span style={{ color: C.text1, fontWeight: 600, textAlign: "right", wordBreak: "break-all", fontFamily: mono ? "monospace" : "inherit", fontSize: mono ? 10 : 12 }}>{v ?? "—"}</span>
    </div>
  );
}

const btnSm = (bg, fg, border) => ({
  flex: 1, minWidth: 76, padding: "8px", background: bg, color: fg,
  border: border ?? "none", borderRadius: R.lg, fontWeight: 700, fontSize: 11, cursor: "pointer",
});

export default function AdminContractDetail({ requestId = null, contractId = null, adminId, onClose }) {
  const [detail, setDetail] = useState(null); // null=로딩
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setErr(null);
    getAdminContractDetail({ requestId, contractId, adminId })
      .then(({ data, error }) => {
        if (error) { setErr(error.message ?? "조회 실패"); setDetail({}); return; }
        setDetail(data ?? {});
      })
      .catch((e) => { setErr(String(e?.message ?? e)); setDetail({}); });
  }, [requestId, contractId, adminId]);

  useEffect(() => { load(); }, [load]);

  const run = async (promise) => {
    if (busy) return;
    setBusy(true);
    const { error } = (await promise) ?? {};
    setBusy(false);
    if (error) { alert("처리 실패: " + (error.message ?? "")); return; }
    load();
  };

  const request = detail?.request ?? null;
  const escrow = detail?.escrow ?? null;
  const company = detail?.company ?? null;
  const customer = detail?.customer ?? null;
  const allOrders = Array.isArray(detail?.payment_orders) ? detail.payment_orders : [];
  const origOrders = allOrders.filter((o) => o.payment_source !== "change_order" && !o.change_order_id);
  const coOrders = allOrders.filter((o) => o.payment_source === "change_order" || o.change_order_id);
  const payouts = Array.isArray(detail?.payouts) ? detail.payouts : [];
  const checkpoints = Array.isArray(detail?.checkpoints) ? detail.checkpoints : [];
  const changeOrders = Array.isArray(detail?.change_orders) ? detail.change_orders : [];
  const escId = escrow?.id ?? contractId ?? null;

  // 총 지급 예정(기록 확인용): 원계약 미지급 payout net + 추가견적(paid/completed·미정산) amount.
  const pendingPayout = payouts
    .filter((p) => !["PAID_MANUALLY", "MANUAL_PAID", "CANCELLED"].includes(p.status))
    .reduce((s, p) => s + Number(p.net_amount ?? 0), 0);
  const pendingCO = changeOrders
    .filter((co) => ["paid", "completed"].includes(co.status) && !co.settled_at)
    .reduce((s, co) => s + Number(co.amount ?? 0), 0);

  const dispStatus = escrow?.dispute_status ?? null;
  const hasDispute = dispStatus && dispStatus !== "NONE";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.55)", zIndex: 400, display: "flex", justifyContent: "center", alignItems: "flex-start", overflowY: "auto" }} onClick={onClose}>
      <div style={{ background: C.bg, width: "100%", maxWidth: 480, minHeight: "100vh", padding: "0 0 60px" }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ position: "sticky", top: 0, zIndex: 2, background: C.surface, padding: "14px 20px", borderBottom: `1px solid ${C.bgWarm}`, display: "flex", alignItems: "center", gap: S.md }}>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.text1, padding: 0 }}>←</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>계약 통합 상세</div>
            <div style={{ fontSize: 11, color: C.text3 }}>결제·정산·현장기록·추가견적·분쟁 기록 확인</div>
          </div>
        </div>

        <div style={{ padding: S.lg }}>
          {detail === null && <div style={{ fontSize: 13, color: C.text4, padding: 20, textAlign: "center" }}>불러오는 중…</div>}
          {err && <div style={{ fontSize: 12, color: C.red, padding: 12 }}>조회 오류: {err}</div>}

          {detail && !err && (
            <>
              {/* 1) 기본 계약 정보 */}
              <Section title="📄 기본 계약 정보">
                <Row k="고객명" v={customer?.name ?? request?.user_id ?? "—"} />
                <Row k="업체명" v={company?.name ?? "—"} />
                <Row k="공사명" v={request?.space_type ?? request?.type ?? "—"} />
                <Row k="지역" v={request?.area ?? "—"} />
                <Row k="원계약 금액" v={fmtAmt(escrow?.total_amount ?? request?.budget)} />
                <Row k="현재 상태" v={`${request?.status ?? "—"}${escrow?.transaction_status ? ` · ${escrow.transaction_status}` : ""}`} />
                <Row k="생성일" v={fmtTs(escrow?.created_at ?? request?.created_at)} />
                <Row k="결제일" v={fmtTs(escrow?.step1_deposited_at)} />
                <Row k="완료일" v={fmtTs(escrow?.step5_completed_at ?? escrow?.completed_at)} />
                <Row k="request_id" v={request?.id ?? requestId} mono />
                <Row k="escrow_id / contract_id" v={escId} mono />
              </Section>

              {/* 2) 원계약 결제 정보 */}
              <Section title="💳 원계약 결제 기록" sub={`${origOrders.length}건`}>
                {origOrders.length === 0 ? (
                  <div style={{ fontSize: 12, color: C.text4 }}>결제 기록 없음</div>
                ) : origOrders.map((o) => (
                  <div key={o.id} style={{ border: `1px solid ${C.bgWarm}`, borderRadius: R.md, padding: S.md, marginBottom: S.sm }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.brand, marginBottom: 4 }}>
                      {o.provider ?? "—"} / {o.payment_method ?? "—"} / {fmtAmt(o.amount)} / {o.status ?? "—"}
                    </div>
                    <Row k="결제수수료" v={`${fmtAmt(o.fee_amount ?? o.customer_fee)} · 정산원금 ${fmtAmt(o.net_amount ?? o.amount)}`} />
                    <Row k="결제일(paid_at)" v={fmtTs(o.paid_at)} />
                    <Row k="payment_order_id" v={o.id} mono />
                    <Row k="order_id" v={o.order_id} mono />
                    <Row k="payment_key" v={o.payment_key} mono />
                  </div>
                ))}
              </Section>

              {/* 3) 원계약 정산 정보 + 액션 */}
              <Section title="🧾 원계약 정산 (10/20/40/30)" sub="실제 송금 없음 — 상태 기록만">
                {payouts.length === 0 ? (
                  <div style={{ fontSize: 12, color: C.text4 }}>정산 단계 없음</div>
                ) : payouts.map((p) => (
                  <div key={p.id} style={{ border: `1px solid ${C.bgWarm}`, borderRadius: R.md, padding: S.md, marginBottom: S.sm }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.text1 }}>{PAYOUT_STAGE_LABEL[p.stage] ?? `${p.stage}단계`} {p.percent}%</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>{PAYOUT_STATUS_LABEL[p.status] ?? p.status}</span>
                    </div>
                    <Row k="정산액(net)" v={fmtAmt(p.net_amount)} />
                    <Row k="승인/지급" v={`${fmtTs(p.approved_at)} / ${fmtTs(p.paid_at)}`} />
                    <div style={{ display: "flex", gap: S.sm, marginTop: 6 }}>
                      {!["APPROVED", "PAID_MANUALLY", "MANUAL_PAID", "CANCELLED"].includes(p.status) && (
                        <button disabled={busy} onClick={() => { if (window.confirm("이 단계를 지급 승인(APPROVED)으로 기록합니다.")) run(adminSetPayoutStatus(p.id, adminId, "APPROVED")); }} style={btnSm(C.brandL, C.brand)}>지급 승인</button>
                      )}
                      {!["HELD", "PAID_MANUALLY", "MANUAL_PAID", "CANCELLED"].includes(p.status) && (
                        <button disabled={busy} onClick={() => { const r = window.prompt("지급 보류 사유(선택):", ""); if (r !== null) run(adminSetPayoutStatus(p.id, adminId, "HELD", r || null)); }} style={btnSm("#FBF5E8", C.gold)}>지급 보류</button>
                      )}
                      {!["PAID_MANUALLY", "MANUAL_PAID", "CANCELLED"].includes(p.status) && (
                        <button disabled={busy} onClick={() => { if (window.confirm("수동 지급 완료로 기록합니다.\n실제 자동 송금은 발생하지 않습니다.")) run(adminSetPayoutStatus(p.id, adminId, "PAID_MANUALLY")); }} style={btnSm("#EAF7EE", "#27AE60")}>수동 지급완료</button>
                      )}
                    </div>
                  </div>
                ))}
                {/* 추가견적 정산(분리 표시) */}
                <div style={{ marginTop: S.md, paddingTop: S.md, borderTop: `1px dashed ${C.bgWarm}` }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: C.text2, marginBottom: 6 }}>추가견적 정산 (각 100% · 원계약과 분리)</div>
                  {changeOrders.filter((co) => ["paid", "completed"].includes(co.status)).length === 0 ? (
                    <div style={{ fontSize: 11, color: C.text4 }}>지급 대상 추가견적 없음</div>
                  ) : changeOrders.filter((co) => ["paid", "completed"].includes(co.status)).map((co) => (
                    <Row key={co.id} k={`${CO_REASON_LABEL[co.reason_type] ?? "추가 작업"} · ${fmtAmt(co.amount)}`} v={co.settled_at ? `정산완료 ${fmtTs(co.settled_at)}` : "지급대기"} />
                  ))}
                </div>
                <div style={{ marginTop: S.md, padding: "8px 10px", background: C.navyL, borderRadius: R.md, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.navy }}>총 지급 예정(기록 확인용)</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: C.navy }}>{fmtAmt(pendingPayout + pendingCO)}</span>
                </div>
              </Section>

              {/* 4) GPS 현장 기록 */}
              <Section title="📍 현장 기록 (GPS)" sub={`${checkpoints.length}건 · 관리자만 전체 좌표/주소 표시`}>
                {checkpoints.length === 0 ? (
                  <div style={{ fontSize: 12, color: C.text4 }}>현장 기록 없음</div>
                ) : checkpoints.map((cp) => {
                  const addr = cp.road_address || cp.jibun_address || "주소 미상";
                  return (
                    <div key={cp.id} style={{ border: `1px solid ${C.bgWarm}`, borderRadius: R.md, padding: S.md, marginBottom: S.sm }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.text1, marginBottom: 4 }}>{CHECKPOINT_LABEL[cp.checkpoint_type] ?? cp.checkpoint_type}</div>
                      <Row k="도로명" v={cp.road_address} />
                      <Row k="지번" v={cp.jibun_address} />
                      <Row k="좌표 · 정확도" v={cp.lat != null ? `${cp.lat}, ${cp.lng} · ±${cp.accuracy ?? "?"}m` : "—"} />
                      <Row k="기록 시각" v={fmtTs(cp.captured_at)} />
                      {Array.isArray(cp.photos) && cp.photos.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0" }}>
                          {cp.photos.map((u, i) => (
                            <a key={i} href={u} target="_blank" rel="noreferrer" style={{ width: 56, height: 56, borderRadius: R.sm, overflow: "hidden", border: `1px solid ${C.bgWarm}` }}>
                              <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </a>
                          ))}
                        </div>
                      )}
                      {cp.note && <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>메모: {cp.note}</div>}
                      <div style={{ display: "flex", gap: S.sm }}>
                        <button onClick={() => copy(addr)} style={btnSm(C.bg, C.text2, `1px solid ${C.bgWarm}`)}>주소 복사</button>
                        {cp.lat != null && <button onClick={() => copy(`${cp.lat},${cp.lng}`)} style={btnSm(C.bg, C.text2, `1px solid ${C.bgWarm}`)}>좌표 복사</button>}
                        {cp.lat != null && <a href={`https://maps.google.com/?q=${cp.lat},${cp.lng}`} target="_blank" rel="noreferrer" style={{ ...btnSm(C.bg, C.brand, `1px solid ${C.bgWarm}`), textAlign: "center", textDecoration: "none" }}>지도 보기</a>}
                      </div>
                    </div>
                  );
                })}
              </Section>

              {/* 5) 추가견적 이력 + 6) 추가견적 결제 기록 */}
              <Section title="🧩 추가견적 이력" sub={`${changeOrders.length}건 · 원계약과 분리`}>
                {changeOrders.length === 0 ? (
                  <div style={{ fontSize: 12, color: C.text4 }}>추가견적 없음</div>
                ) : changeOrders.map((co, i) => {
                  const poForCo = coOrders.find((o) => o.change_order_id === co.id);
                  return (
                    <div key={co.id} style={{ border: `1px solid ${C.bgWarm}`, borderRadius: R.md, padding: S.md, marginBottom: S.sm }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: C.text1 }}>{i + 1}. {CO_REASON_LABEL[co.reason_type] ?? "추가 작업"}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.brand }}>{CO_STATUS_LABEL[co.status] ?? co.status}</span>
                      </div>
                      {co.description && <div style={{ fontSize: 11, color: C.text2, lineHeight: 1.6, marginBottom: 4 }}>{co.description}</div>}
                      <Row k="요청자 · 금액" v={`${co.requested_by_role === "company" ? "업체" : "고객"} · ${fmtAmt(co.amount)}`} />
                      <Row k="승인 · 결제" v={`${fmtTs(co.approved_at)} / ${fmtTs(co.paid_at)}`} />
                      <Row k="완료 · 정산" v={`${fmtTs(co.completed_at)} / ${fmtTs(co.settled_at)}`} />
                      {poForCo && (
                        <div style={{ marginTop: 4, padding: "6px 8px", background: C.bg, borderRadius: R.sm }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.text2, marginBottom: 2 }}>추가견적 결제 기록</div>
                          <Row k="provider · method" v={`${poForCo.provider ?? "—"} / ${poForCo.payment_method ?? "—"}`} />
                          <Row k="금액 · 상태" v={`${fmtAmt(poForCo.amount)} · ${poForCo.status ?? "—"}`} />
                          <Row k="결제일" v={fmtTs(poForCo.paid_at)} />
                          <Row k="change_order_id" v={poForCo.change_order_id} mono />
                        </div>
                      )}
                      {Array.isArray(co.photos) && co.photos.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                          {co.photos.map((u, j) => (
                            <a key={j} href={u} target="_blank" rel="noreferrer" style={{ width: 52, height: 52, borderRadius: R.sm, overflow: "hidden", border: `1px solid ${C.bgWarm}` }}>
                              <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </Section>

              {/* 7) 분쟁 정보 + 액션 */}
              <Section title="⚖️ 분쟁 기록">
                {!hasDispute ? (
                  <div style={{ fontSize: 12, color: C.text4 }}>현재 분쟁 없음</div>
                ) : (
                  <>
                    <Row k="분쟁 상태" v={dispStatus} />
                    <Row k="사유" v={escrow?.dispute_reason} />
                    <Row k="접수 시각" v={fmtTs(escrow?.disputed_at)} />
                    <Row k="dispute_id(=escrow_id)" v={escId} mono />
                    <div style={{ display: "flex", gap: S.sm, marginTop: 8, flexWrap: "wrap" }}>
                      <button disabled={busy} onClick={() => { const r = window.prompt("지급 보류 — 모든 미지급 단계를 보류합니다. 사유(선택):", ""); if (r !== null) run(holdAllPayoutsForEscrow(escId)); }} style={btnSm("#FBF5E8", C.gold)}>지급 보류</button>
                      <button disabled={busy} onClick={() => { const r = window.prompt("검토중 메모/사유:", ""); if (r !== null) run(adminResolveDispute(escId, adminId, "UNDER_REVIEW", r || null)); }} style={btnSm(C.bg, C.text2, `1px solid ${C.bgWarm}`)}>메모/검토중</button>
                      <button disabled={busy} onClick={() => { const r = window.prompt("분쟁 종료(RESOLVED) 기록 — 사유:", ""); if (r !== null) run(adminResolveDispute(escId, adminId, "RESOLVED", r || null)); }} style={btnSm(C.brandL, C.brand)}>분쟁 종료</button>
                    </div>
                  </>
                )}
              </Section>

              <div style={{ fontSize: 11, color: C.text4, textAlign: "center", padding: "8px 0", lineHeight: 1.7 }}>
                공간마켓은 판단자가 아니라 기록 보관자입니다.<br />관리자는 기록을 확인하고 상태를 관리합니다. (자동 송금/환불/정산 없음)
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
