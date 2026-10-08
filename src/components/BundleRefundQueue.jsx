// 관리자 «결제·환불» 맨 위 — 분할 결제 환불 요청 큐(SQL 205 · 대표 10-08).
//   기한이 지나 멈춘 분할 결제에서 고객이 «환불 요청»을 고르면 여기로 온다(자동 환불 없음).
//   실제 환불은 결제 건마다 토스 취소(api/confirm-payment action=cancel) — 다 돌려준 뒤 «처리 완료».
import { useEffect, useState } from "react";
import { C, R, S } from "../constants";
import { adminBundleRefundList, adminBundleRefundSet } from "../lib/supabase";
import { authHeader } from "../lib/session";
import { fmtWon, addBusinessDays, REFUND_BUSINESS_DAYS } from "../lib/bundlePay";

export default function BundleRefundQueue({ userId, showToast, setConfirm }) {
  const [rows, setRows] = useState([]);
  const [refunded, setRefunded] = useState({});   // 이 화면에서 환불 보낸 주문번호

  const load = () => adminBundleRefundList()
    .then(({ data, error }) => setRows(!error && Array.isArray(data) ? data : []))
    .catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  if (!rows.length) return null;

  const refundOrder = (o) => setConfirm({
    emoji: "↩", title: "이 결제 환불",
    msg: `토스에 ${fmtWon(o.amount_won)} 결제의 전액 취소를 보냅니다 — 고객에게 실제로 환불돼요. 되돌릴 수 없어요.`,
    needsReason: true,
    onConfirm: async (reason) => {
      try {
        const r = await fetch("/api/confirm-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader(userId) },
          body: JSON.stringify({ action: "cancel", orderId: o.order_id, reason }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { showToast(j?.error ?? "환불하지 못했어요", false); return; }
        setRefunded((m) => ({ ...m, [o.order_id]: true }));
        showToast("토스 결제를 취소(환불)했어요");
      } catch { showToast("서버 연결에 실패했어요", false); }
    },
  });

  const close = (row, status) => setConfirm({
    emoji: status === "DONE" ? "✅" : "✋", title: status === "DONE" ? "환불 처리 완료" : "환불 요청 반려",
    msg: status === "DONE" ? "결제 건을 모두 돌려줬나요? 고객에게 «환불을 마쳤어요» 알림이 가요." : "반려 사유가 고객에게 알림으로 가요.",
    needsReason: status !== "DONE",
    onConfirm: async (note) => {
      const { data, error } = await adminBundleRefundSet(row.id, status, note ?? null);
      if (error || data?.error) { showToast("처리하지 못했어요", false); return; }
      setRows((rs) => rs.filter((x) => x.id !== row.id));
      showToast(status === "DONE" ? "처리 완료로 바꿨어요" : "반려했어요");
    },
  });

  return (
    <div style={{ background: "#FBF3E2", border: "1px solid #EADFC4", borderRadius: R.xl, padding: S.lg, marginBottom: S.lg }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#8A6420" }}>분할 결제 환불 요청 {rows.length}건</div>
      <div style={{ fontSize: 12, color: C.text3, marginTop: 2, lineHeight: 1.6 }}>입금 기한이 지나 멈춘 결제에서 고객이 환불을 골랐어요. 결제 건마다 환불한 뒤 «처리 완료».</div>
      {rows.map((row) => {
        const orders = Array.isArray(row.orders) ? row.orders : [];
        const allDone = orders.length > 0 && orders.every((o) => refunded[o.order_id]);
        // 환불 기한 = 접수일 + 3영업일(청약철회 환급 원칙) — 지나면 빨갛게
        const due = addBusinessDays(row.created_at);
        const overdue = due && Date.now() > due.getTime();
        return (
          <div key={row.id} style={{ background: C.surface, borderRadius: R.lg, padding: S.md, marginTop: S.md, border: `1px solid ${C.bgWarm}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: S.sm }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: C.text1 }}>{row.customer?.name ?? "고객"} <span style={{ fontSize: 11, color: C.text4 }}>{row.customer?.phone ?? ""}</span></span>
              <span style={{ fontSize: 13.5, fontWeight: 900, color: C.text1 }}>{fmtWon(row.paid_won)}</span>
            </div>
            <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>
              {new Date(row.created_at).toLocaleString("ko-KR")}{row.reason ? ` · “${row.reason}”` : ""}
            </div>
            {due && (
              <div style={{ fontSize: 12, fontWeight: 800, marginTop: 4, color: overdue ? C.red : "#8A6420" }}>
                환불 기한 {due.getMonth() + 1}월 {due.getDate()}일(접수 + {REFUND_BUSINESS_DAYS}영업일){overdue ? " · 기한 지남" : ""}
              </div>
            )}
            {orders.map((o) => (
              <div key={o.order_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm, marginTop: 6, fontSize: 12, color: C.text2 }}>
                <span>{o.method === "VIRTUAL_ACCOUNT" ? "가상계좌" : "카드"} {fmtWon(o.amount_won)}</span>
                {refunded[o.order_id]
                  ? <span style={{ fontWeight: 700, color: C.brand }}>환불 보냄</span>
                  : <button type="button" onClick={() => refundOrder(o)}
                      style={{ padding: "5px 10px", background: "#FBF5E8", color: C.gold, border: `1px solid ${C.gold44}`, borderRadius: R.md, fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>
                      결제 취소(환불)
                    </button>}
              </div>
            ))}
            <div style={{ display: "flex", gap: S.sm, marginTop: S.md }}>
              <button type="button" onClick={() => close(row, "DONE")}
                style={{ flex: 1, padding: "8px", background: allDone ? C.brand : C.surface, color: allDone ? "#fff" : C.brand, border: `1px solid ${C.brandM}`, borderRadius: R.md, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
                처리 완료
              </button>
              <button type="button" onClick={() => close(row, "REJECTED")}
                style={{ flex: 1, padding: "8px", background: C.surface, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.md, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                반려
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
