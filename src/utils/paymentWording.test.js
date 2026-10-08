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
