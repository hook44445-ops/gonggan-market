import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shouldAskPush, PUSH_ON_PREFS, pushFailText } from "./pushAsk.js";

const base = { supported: true, configured: true, permission: "default", now: 100 * 86400000 };
test("물어볼 때만 — 지원·설정·default·아이폰 앱 아님·14일", () => {
  assert.equal(shouldAskPush(base), true);
  assert.equal(shouldAskPush({ ...base, permission: "granted" }), false);
  assert.equal(shouldAskPush({ ...base, permission: "denied" }), false);
  assert.equal(shouldAskPush({ ...base, iosShell: true }), false);
  assert.equal(shouldAskPush({ ...base, supported: false }), false);
  assert.equal(shouldAskPush({ ...base, lastAskedAt: base.now - 3 * 86400000 }), false);
  assert.equal(shouldAskPush({ ...base, lastAskedAt: base.now - 15 * 86400000 }), true);
});

test("켜는 것은 내 소식만 — 광고 동의는 따로", () => {
  assert.equal(PUSH_ON_PREFS.push_enabled, true);
  assert.equal("push_marketing" in PUSH_ON_PREFS, false);
  assert.match(pushFailText("permission_denied"), /폰 설정/);
});

test("요청 보낸 화면에 연결", () => {
  const src = readFileSync(new URL("../components/v3/RequestSentSheet.jsx", import.meta.url), "utf8");
  assert.match(src, /shouldAskPush\(/);
  assert.match(src, /upsertPushPreferences\(userId, PUSH_ON_PREFS\)/);
});

test("업체 홈 새 요청 목록 위에도", () => {
  const home = readFileSync(new URL("../screens/v3/HomeV3.jsx", import.meta.url), "utf8");
  assert.match(home, /<PushAskCard userId=\{user\?\.id\} title="우리 동네 새 견적 요청, 폰으로 바로 받을까요\?"/);
  const card = readFileSync(new URL("../components/PushAskCard.jsx", import.meta.url), "utf8");
  assert.match(card, /upsertPushPreferences\(userId, PUSH_ON_PREFS\)/);
});

test("설정 화면 — 이 기기 푸시가 안 켜진 이유를 코드와 함께(Android·웹도 · 10-09)", async () => {
  const { pushDiagText } = await import("./pushAsk.js");
  assert.match(pushDiagText({ reason: "permission_denied" }), /폰 설정.*\(permission_denied\)$/);
  assert.match(pushDiagText({ reason: "error", message: "Registration failed - push service error" }), /\(error · Registration failed/);
  assert.match(pushDiagText({}), /\(unknown\)$/);
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../components/PushNotificationSettings.jsx", import.meta.url), "utf8");
  assert.ok(src.includes("pushDiagText(res)"), "Android·웹 실패 이유를 보여 주지 않는다");
});

test("토큰 저장이 막히면 «성공»이 아니라 save_failed (10-09)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./push.js", import.meta.url), "utf8");
  assert.match(src, /const saved = await upsertFcmToken\([\s\S]{0,200}if \(saved\?\.error\)[\s\S]{0,80}save_failed/);
  const { pushDiagText } = await import("./pushAsk.js");
  assert.match(pushDiagText({ reason: "save_failed", message: "new row violates row-level security" }), /다시 로그인.*\(save_failed · new row violates/);
});
