// ── 추가견적(Change Order) 결제 — 원계약 escrow 결제와 분리 ──────────────────
// 원칙:
//   · 추가견적 금액은 원계약 escrow 원금에 섞지 않는다. 별도 payment_order 로 기록
//     (payment_source='change_order', change_order_id).
//   · 자동 송금/환불 없음. 정산은 관리자 수동(완료 후 100% 별도).
//   · 실제 PG(Toss) 연동이 완전하지 않은 동안에는 승인 단계를 placeholder(시뮬레이션)로
//     처리하되, DB 구조·service layer 는 분리해 둔다(실연동 시 이 파일만 교체).
import { ACTIVE_PROVIDER } from "./constants";
import {
  createChangeOrderPaymentOrder, updateChangeOrderPaymentOrder, markChangeOrderPaid,
} from "../../lib/supabase";

// 추가견적 결제 진행. order: change_orders 행(approved/payment_pending).
// 반환 { data, error } — 호출부(runAction)는 error 만 확인.
export async function payChangeOrder({ order, contractId, requestId = null, userId, paymentMethod = "CARD" }) {
  if (!order?.id || !userId) return { error: new Error("INVALID_CHANGE_ORDER_PAYMENT") };

  // 1) 추가견적 전용 결제주문 생성(원계약과 분리).
  const { data: po, error: poErr } = await createChangeOrderPaymentOrder({
    contractId, requestId, userId,
    changeOrderId: order.id,
    amount: order.amount,
    paymentMethod,
    provider: ACTIVE_PROVIDER,
    status: "PENDING",
  });
  if (poErr) return { error: poErr };

  // 2) PG 승인 — 실제 Toss 연동 전까지 placeholder(시뮬레이션). raw_response 보존.
  //    실연동 시: getProvider(ACTIVE_PROVIDER).requestPayment/confirmPayment 로 교체.
  const rawResponse = {
    simulated: true, provider: ACTIVE_PROVIDER, method: paymentMethod,
    payment_source: "change_order", change_order_id: order.id,
    amount: order.amount, approvedAt: new Date().toISOString(),
  };

  // 3) 결제주문 PAID 전이(+raw_response, paid_at).
  if (po?.id) {
    await updateChangeOrderPaymentOrder(po.id, {
      status: "PAID", rawResponse, paidAt: new Date().toISOString(),
    }).catch(() => {});
  }

  // 4) change_order paid 전이(security-definer RPC, 의뢰인 actor 검증).
  const { error: paidErr } = await markChangeOrderPaid(order.id, userId);
  if (paidErr) return { error: paidErr, data: { paymentOrderId: po?.id ?? null } };

  return { data: { paymentOrderId: po?.id ?? null }, error: null };
}
