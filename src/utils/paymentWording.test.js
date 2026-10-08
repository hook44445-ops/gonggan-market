// 결제 명칭 정리(10-01 · docs/PAYMENTS-2026-10-01-pg.md 7·8절) — 고객·업체·검색에 보이는 문구.
//   «에스크로»는 등록된 결제대금예치업자의 말이라 법정 보호로 오인된다 → 고객에게는 «공간안전결제(단계별 안전지급)».
//   PG 홈페이지 심사는 «면책»처럼 읽히는 문장을 걸러낸다 → «무엇을 하는지»로만 쓴다.
//   코드 이름(escrow_*)·관리자 내부 화면은 그대로 둔다(바꾸면 위험만 크다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PUBLIC = [
  "../components/ProtectionNotice.jsx", "../components/RequestModal.jsx", "../components/RequestModalBeta.jsx",
  "../components/DisputeNotice.jsx", "../components/MainApp.jsx", "../constants/documentTemplates.js",
  "../utils/siteSeo.js", "../screens/DownloadScreen.jsx", "../screens/SafePaymentScreen.jsx",
  "../screens/DashboardScreen.jsx", "../screens/ChatScreen.jsx", "../utils/evidencePrint.js",
];
// 주석 줄을 빼고, 따옴표·백틱 문자열과 JSX 글자만 본다
const visibleText = (src) => src.split("\n")
  .filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
  .flatMap((l) => [...(l.match(/(["'`])(?:(?!\1).)*\1/g) ?? []), ...(l.match(/>[^<{]+</g) ?? [])])
  .join("\n");

test("보이는 문구에 «에스크로»가 없다", () => {
  for (const f of PUBLIC) {
    const t = visibleText(readFileSync(new URL(f, import.meta.url), "utf8"));
    assert.doesNotMatch(t, /에스크로/, `${f} 에 «에스크로»가 다시 들어왔다 — «공간안전결제(단계별 안전지급)»로`);
  }
});

test("면책처럼 읽히는 문장·정해지지 않은 결제사 이름이 없다", () => {
  for (const f of PUBLIC) {
    const t = visibleText(readFileSync(new URL(f, import.meta.url), "utf8"));
    assert.doesNotMatch(t, /강제 환불을 집행하는 기관이 아닙니다|보호할 수 없습니다|토스페이먼츠 에스크로/, f);
  }
});

// 대표 10-08: 고객 금액은 결제수단과 상관없이 견적 금액 그대로 — 이용료는 업체 지급분에서, 수단별 수수료는 우리 비용(여신전문금융업법 19조).
test("결제수단에 따라 고객 금액이 달라진다는 문구 · 이용료를 더한다는 문구가 없다", () => {
  const files = [...PUBLIC, "../screens/BidStatusScreen.jsx", "../screens/EscrowScreen.jsx", "../content/publicPages.js",
    "../components/RequestModalBeta.jsx", "../components/BundlePayPanel.jsx"];
  for (const f of files) {
    const t = visibleText(readFileSync(new URL(f, import.meta.url), "utf8"));
    assert.doesNotMatch(t, /결제수단에 따라 달라집|이용료가 더해|시공비 \+ 공간안전결제 이용료|이용료 660원|카드면 \+/, f);
  }
});

// 대표 10-08 최종: 고객 추가 요금 0원 · 카드·가상계좌 수수료는 고객 화면 어디에도 쓰지 않는다 · 업체 지급 내역엔 «이용료 차감 → 실제 받는 금액».
test("고객 결제 화면 두 곳에 «추가 요금 없음» 한 줄 · 수단별 수수료 숫자는 고객 화면에 없다", async () => {
  const { NO_EXTRA_CHARGE, BUNDLE_METHODS } = await import("../lib/bundlePay.js");
  assert.equal(NO_EXTRA_CHARGE, "어떤 수단으로 내셔도 추가 요금은 없습니다");
  for (const f of ["../screens/BidStatusScreen.jsx", "../components/BundlePayPanel.jsx"]) {
    assert.match(readFileSync(new URL(f, import.meta.url), "utf8"), /NO_EXTRA_CHARGE/, f);
  }
  const customer = ["../screens/BidStatusScreen.jsx", "../components/BundlePayPanel.jsx", "../components/RequestModal.jsx",
    "../components/RequestModalBeta.jsx", "../screens/SafePaymentScreen.jsx", "../content/publicPages.js"];
  for (const f of customer) {
    const t = visibleText(readFileSync(new URL(f, import.meta.url), "utf8"));
    assert.doesNotMatch(t, /3\.5%|3\.7%|건당 660|가장 저렴한 결제수단|카드 수수료|가상계좌 수수료/, f);
  }
  const { PAYMENT_METHODS } = await import("../services/payment/constants.js");
  for (const m of [...BUNDLE_METHODS, ...PAYMENT_METHODS]) assert.doesNotMatch(`${m.label}${m.desc}`, /저렴|수수료|%/, m.id);
});

test("업체 지급 내역 — «공간안전결제 이용료 … 차감 → 실제 받는 금액»(4.4% · 기존 계산 그대로)", async () => {
  const t = readFileSync(new URL("../screens/EscrowScreen.jsx", import.meta.url), "utf8");
  assert.match(t, /공간안전결제 이용료 \{fmtWon\(toWon\(stage\.amount - stage\.companyReceiveAmount\)\)\} 차감 → 실제 받는 금액/);
  const { calculateStagePayments } = await import("./calculations.js");
  const [, start] = calculateStagePayments(1000, undefined, "4STEP");     // 착공 20% = 200만
  assert.equal(start.amount, 200);
  assert.equal(start.companyReceiveAmount, 191.2);                         // 4.4% 차감
});
