import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { adminGetChangeOrders } from "../lib/supabase";

// 관리자용 추가견적 이력 — "기록 확인" 전용(정당/부당 판단 UI 아님).
// 계약/에스크로 상세 · 분쟁관리 상세 · 정산관리 상세에서 공통 사용.
// admin 만 조회(security-definer RPC가 role=admin 검증, operator 차단).

const REASON_LABEL = {
  hidden_defect: "숨은 하자 발견", plumbing_issue: "배관 노후/문제", leak_issue: "누수",
  electrical_issue: "전기 배선 문제", layout_change: "구조/배치 변경",
  customer_request: "고객 변경 요청", material_upgrade: "자재 업그레이드", etc: "기타 현장 이슈",
};
const STATUS_LABEL = {
  requested: "요청됨", approved: "승인됨", payment_pending: "결제 대기",
  paid: "결제 완료", completed: "완료", rejected: "거절됨", cancelled: "취소됨",
};
const STATUS_COLOR = {
  requested: "#7A5C1E", approved: C.brand, payment_pending: "#7A5C1E",
  paid: C.brand, completed: C.green, rejected: C.text4, cancelled: C.text4,
};

const fmtAmt = (n) => `${Number(n ?? 0).toLocaleString()}만원`;
const fmtTs = (ts) => (ts ? new Date(ts).toLocaleString("ko-KR") : "—");
const roleLabel = (r) => (r === "company" ? "업체" : r === "consumer" ? "고객" : "—");

export default function AdminChangeOrderHistory({ contractId, adminId, title = "추가견적 이력" }) {
  const [orders, setOrders] = useState(null); // null = 로딩, [] = 없음
  const [err, setErr] = useState(null);
  const [openPhotos, setOpenPhotos] = useState(null);

  useEffect(() => {
    if (!contractId) { setOrders([]); return; }
    let alive = true;
    setOrders(null); setErr(null);
    adminGetChangeOrders(contractId, adminId)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) { setErr(error.message ?? "조회 실패"); setOrders([]); return; }
        setOrders(Array.isArray(data) ? data : []);
      })
      .catch((e) => { if (alive) { setErr(String(e?.message ?? e)); setOrders([]); } });
    return () => { alive = false; };
  }, [contractId, adminId]);

  return (
    <div style={{ background: C.bg, borderRadius: R.lg, padding: S.lg, border: `1px solid ${C.bgWarm}`, marginTop: S.md }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>🧩 {title}</span>
        {Array.isArray(orders) && <span style={{ fontSize: 11, color: C.text4 }}>{orders.length}건 · 기록 확인용</span>}
      </div>

      {orders === null && <div style={{ fontSize: 12, color: C.text4, padding: "6px 0" }}>불러오는 중…</div>}
      {err && <div style={{ fontSize: 12, color: C.red, padding: "6px 0" }}>조회 오류: {err}</div>}
      {Array.isArray(orders) && orders.length === 0 && !err && (
        <div style={{ fontSize: 12, color: C.text4, padding: "6px 0" }}>등록된 추가견적이 없습니다.</div>
      )}

      {Array.isArray(orders) && orders.map((o, idx) => (
        <div key={o.id} style={{ border: `1px solid ${C.bgWarm}`, borderRadius: R.md, padding: S.md, marginBottom: S.sm, background: C.surface }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>{idx + 1}. {REASON_LABEL[o.reason_type] ?? "추가 작업"}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[o.status] ?? C.text3 }}>{STATUS_LABEL[o.status] ?? o.status}</span>
          </div>
          {o.description && <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.6, marginBottom: 4 }}>{o.description}</div>}
          <div style={{ fontSize: 11, color: C.text3, lineHeight: 1.9 }}>
            <div>금액: <b style={{ color: C.brand }}>{fmtAmt(o.amount)}</b>{o.extra_days != null && o.extra_days !== 0 ? ` · 추가기간 ${o.extra_days}일` : ""}</div>
            <div>요청자: {roleLabel(o.requested_by_role)} · 사유유형: {o.reason_type ?? "—"}</div>
            <div>추가견적 ID: <span style={{ fontFamily: "monospace", fontSize: 10 }}>{o.id}</span></div>
            <div>생성: {fmtTs(o.created_at)}{o.created_by ? ` · 생성자 ${String(o.created_by).slice(0, 8)}` : (o.requested_by ? ` · 생성자 ${String(o.requested_by).slice(0, 8)}` : "")}</div>
            <div>승인: {fmtTs(o.approved_at)} · 결제: {fmtTs(o.paid_at)}</div>
            <div>완료: {fmtTs(o.completed_at)} · 정산: {fmtTs(o.settled_at)}</div>
          </div>
          {Array.isArray(o.photos) && o.photos.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <button onClick={() => setOpenPhotos(openPhotos === o.id ? null : o.id)}
                style={{ fontSize: 11, fontWeight: 700, color: C.brand, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                사진 {o.photos.length}장 {openPhotos === o.id ? "접기 ▲" : "보기 ▼"}
              </button>
              {openPhotos === o.id && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {o.photos.map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noreferrer" style={{ width: 64, height: 64, borderRadius: R.sm, overflow: "hidden", border: `1px solid ${C.bgWarm}` }}>
                      <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
          {o.reject_reason && <div style={{ fontSize: 11, color: C.text4, marginTop: 4 }}>거절 사유: {o.reject_reason}</div>}
        </div>
      ))}
    </div>
  );
}
