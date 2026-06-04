// ── TossPayments 어댑터 (실연동) ────────────────────────────────────────────
// 화면 컴포넌트에서 Toss SDK 로딩/호출을 직접 하지 않도록 분리.
export const id = "TOSS";
export const isActive = true;

const SDK_SRC = "https://js.tosspayments.com/v1/payment";

// SDK 로드(타임아웃 포함). onload 가 영원히 오지 않을 때를 대비해 race.
export async function loadSdk(timeoutMs = 15000) {
  if (typeof window === "undefined") throw new Error("Toss SDK requires browser");
  if (window.TossPayments) return window.TossPayments;
  await Promise.race([
    new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SDK_SRC;
      s.onload = resolve;
      s.onerror = () => reject(new Error("Toss SDK load failed"));
      document.head.appendChild(s);
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Toss SDK load timeout (15s)")), timeoutMs)
    ),
  ]);
  if (!window.TossPayments) throw new Error("Toss SDK unavailable after load");
  return window.TossPayments;
}

// 결제창 호출. 성공 시 successUrl 로 리다이렉트되므로 보통 반환되지 않는다.
// tossMethod 는 한글 method 인자("카드"/"계좌이체"/"가상계좌").
export async function requestPayment({
  clientKey, tossMethod, amount, orderId, orderName, customerName, successUrl, failUrl,
}) {
  if (!clientKey) throw new Error("Missing Toss client key");
  if (!tossMethod) throw new Error("Unsupported Toss payment method");
  const TossPayments = await loadSdk();
  const toss = TossPayments(clientKey);
  return toss.requestPayment(tossMethod, {
    amount, orderId, orderName, customerName, successUrl, failUrl,
  });
}

// 결제 승인(서버 확인). 시크릿 키는 서버(api/confirm-payment)에서만 사용.
export async function confirmPayment({ paymentKey, orderId, amount }) {
  const res = await fetch("/api/confirm-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Toss confirm failed");
  return data;
}
