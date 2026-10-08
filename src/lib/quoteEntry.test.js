import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { quoteCtaTarget, QUOTE_START_ID } from "./quoteEntry.js";

const landing = readFileSync(new URL("../screens/LandingScreen.jsx", import.meta.url), "utf8");

test("처음 온 사람은 인증이 아니라 아래 요청서로 내려간다", () => {
  assert.equal(quoteCtaTarget({ hasSavedAccounts: false }), "preview");
  assert.equal(quoteCtaTarget(), "preview");
});

test("이 기기에서 이미 인증한 사람은 지금처럼 계정 선택으로", () => {
  assert.equal(quoteCtaTarget({ hasSavedAccounts: true }), "account");
});

test("«무료 비교견적 받기» 단추(맨 위 · 저녁 · 아래 고정)는 모두 goQuote 를 부른다", () => {
  const ctas = [...landing.matchAll(/<button onClick=\{(\w+)\}[^>]*>\s*무료 비교견적 받기/g)];
  assert.ok(ctas.length >= 3, `«무료 비교견적 받기» 단추를 ${ctas.length}개만 찾음`);
  for (const m of ctas) assert.equal(m[1], "goQuote", "인증으로 직행하는 견적 단추가 남아 있다");
});

test("내려갈 자리(요청서 미리 골라 보기)가 화면에 있다", () => {
  assert.ok(landing.includes("id={QUOTE_START_ID}"), "요청서 칸에 id 가 없다");
  assert.equal(QUOTE_START_ID, "quote-start");
  // 요청서 칸 안의 단추는 그대로 인증으로 이어진다(보낼 때만 인증)
  assert.ok(/<RequestPreview onStart=\{goConsumer\}/.test(landing));
});
