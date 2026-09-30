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
