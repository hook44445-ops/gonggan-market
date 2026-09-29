import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewLoginCode } from "./reviewLogin.js";

const env = { reviewPhone: "+821012345678", reviewCode: "482913" };

test("심사용 로그인 — 정한 번호만 · 둘 다 있을 때만", () => {
  assert.equal(reviewLoginCode("+821012345678", env), "482913");
  assert.equal(reviewLoginCode("+821099998888", env), null);
  assert.equal(reviewLoginCode("+821012345678", { reviewPhone: env.reviewPhone }), null);
  assert.equal(reviewLoginCode("+821012345678", {}), null);
});

test("심사용 로그인 — 모양이 틀리거나 쉬운 번호면 꺼짐", () => {
  assert.equal(reviewLoginCode("01012345678", { reviewPhone: "01012345678", reviewCode: "482913" }), null);
  assert.equal(reviewLoginCode("+821012345678", { ...env, reviewCode: "12345" }), null);
  assert.equal(reviewLoginCode("+821012345678", { ...env, reviewCode: "000000" }), null);
  assert.equal(reviewLoginCode("+821012345678", { ...env, reviewCode: "123456" }), null);
});

test("아이폰 앱 안에서는 토큰 판매 화면을 열지 않는다(App Store 3.1.1)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../constants/release.js", import.meta.url), "utf-8");
  assert.ok(src.includes("export const tokenSalesOpen = () => PAYMENTS_LIVE && !isStoreAppShell();"));
  assert.ok(src.includes("sessionStorage.setItem(TWA_SESSION_KEY"), "Play 앱(TWA) 표시는 이 창에만 — 크롬 브라우저 구매를 막지 않게");
  const store = readFileSync(new URL("../screens/TokenStoreScreen.jsx", import.meta.url), "utf-8");
  assert.ok(store.includes("!(iosShell && id === 'store')"), "아이폰 앱에선 «토큰 구매» 탭을 숨긴다");
});
