import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isExpoPushToken, hasNativePushIn, parseNativePushMessage, nativeDeniedReason,
  safeAppUrl, expoPushMessage, readExpoTickets, PUSH_ASK_MESSAGE,
} from "./nativePush.js";

const TOKEN = "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]";

test("Expo 토큰 모양만 받는다", () => {
  assert.equal(isExpoPushToken(TOKEN), true);
  assert.equal(isExpoPushToken("ExpoPushToken[abc-_1]"), true);
  assert.equal(isExpoPushToken("fcm-web-token"), false);
  assert.equal(isExpoPushToken("ExponentPushToken[<script>]"), false);
  assert.equal(isExpoPushToken(null), false);
});

test("앱 안인지: GongganApp.push + ReactNativeWebView.postMessage 둘 다 있어야", () => {
  const post = () => {};
  assert.equal(hasNativePushIn({ GongganApp: { push: true }, ReactNativeWebView: { postMessage: post } }), true);
  assert.equal(hasNativePushIn({ GongganApp: { push: true } }), false);
  assert.equal(hasNativePushIn({ ReactNativeWebView: { postMessage: post } }), false);
  assert.equal(hasNativePushIn({ GongganApp: { push: "yes" }, ReactNativeWebView: { postMessage: post } }), false);
  assert.equal(hasNativePushIn(undefined), false);
});

test("앱 메시지 읽기 — 문자열 JSON · gonggan: 만", () => {
  assert.deepEqual(parseNativePushMessage(JSON.stringify({ type: "gonggan:push-token", token: TOKEN, platform: "ios_expo" })), { kind: "token", token: TOKEN });
  assert.deepEqual(parseNativePushMessage(JSON.stringify({ type: "gonggan:push-denied", reason: "denied", platform: "ios_expo" })), { kind: "denied", reason: "denied" });
  // 객체(문자열 아님) · 다른 창 메시지 · 이상한 토큰 · 다른 플랫폼은 무시
  assert.equal(parseNativePushMessage({ type: "gonggan:push-token", token: TOKEN }), null);
  assert.equal(parseNativePushMessage(JSON.stringify({ type: "webpackOk" })), null);
  assert.equal(parseNativePushMessage("not json"), null);
  assert.equal(parseNativePushMessage(JSON.stringify({ type: "gonggan:push-token", token: "abc" })), null);
  assert.equal(parseNativePushMessage(JSON.stringify({ type: "gonggan:push-token", token: TOKEN, platform: "android" })), null);
  assert.equal(JSON.parse(PUSH_ASK_MESSAGE).type, "gonggan:push-ask");
});

test("거절 이유 → 웹 공통 이유", () => {
  assert.equal(nativeDeniedReason("denied"), "permission_denied");
  assert.equal(nativeDeniedReason("not_granted"), "permission_denied");
  assert.equal(nativeDeniedReason("simulator"), "native_simulator");
  assert.equal(nativeDeniedReason(""), "native_unknown");
});

test("알림 누르면 열 주소 — 경로 또는 gongganland.com 만", () => {
  assert.equal(safeAppUrl("/?open=invite"), "/?open=invite");
  assert.equal(safeAppUrl("https://gongganland.com/c/abc"), "https://gongganland.com/c/abc");
  assert.equal(safeAppUrl("https://www.gongganland.com/x"), "https://www.gongganland.com/x");
  assert.equal(safeAppUrl("https://gongganmarket.com/c/abc"), "https://gongganmarket.com/c/abc"); // 옛 도메인 알림도 계속 연다
  assert.equal(safeAppUrl("//evil.com"), "/");
  assert.equal(safeAppUrl("https://evil.com/?gongganland.com"), "/");
  assert.equal(safeAppUrl("https://gongganland.com.evil.com/"), "/");
  assert.equal(safeAppUrl("http://gongganland.com/"), "/");
  assert.equal(safeAppUrl("javascript:alert(1)"), "/");
  assert.equal(safeAppUrl(null), "/");
});

test("Expo 메시지 모양", () => {
  assert.deepEqual(expoPushMessage(TOKEN, { title: "새 견적", body: "3건", target_url: "/?open=bids" }),
    { to: TOKEN, title: "새 견적", body: "3건", data: { url: "/?open=bids" }, sound: "default" });
  assert.equal(expoPushMessage(TOKEN, {}).title, "공간랜드");
});

test("Expo 응답 — 성공 수 · 지워진 기기 토큰", () => {
  const a = "ExponentPushToken[a]", b = "ExponentPushToken[b]", c = "ExponentPushToken[c]";
  const r = readExpoTickets([a, b, c], { data: [
    { status: "ok", id: "1" },
    { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } },
    { status: "error", message: "too big", details: { error: "MessageTooBig" } },
  ] });
  assert.equal(r.okCount, 1);
  assert.deepEqual(r.deadTokens, [b]);
  assert.equal(r.lastErr, "MessageTooBig");
  const bad = readExpoTickets([a], { errors: [{ code: "VALIDATION_ERROR" }] });
  assert.equal(bad.okCount, 0);
  assert.match(bad.lastErr, /VALIDATION_ERROR/);
});
