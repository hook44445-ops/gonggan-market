// 173 — 고객이 견적 비교 화면을 열면 입찰 업체에 한 번 «고객이 내 견적을 확인했어요»
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isTokenRpc } from "./session.js";

const sql = readFileSync(new URL("../../supabase/migrations/173_bid_viewed_notify.sql", import.meta.url), "utf8");

test("요청 주인(토큰)만 · 아직 표시 안 된 입찰만 · 밤엔 알림함만", () => {
  assert.match(sql, /v_req\.user_id is distinct from v_uid then return 0/);
  assert.match(sql, /where request_id = p_request_id and viewed_at is null/);
  assert.match(sql, /if v_hour >= 9 and v_hour < 21 then/);
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ""), /users u|u\.name|phone/);   // 고객 이름·연락처를 알리지 않는다
  assert.ok(isTokenRpc("bids_mark_viewed"));
});

test("견적 비교 화면이 한 번 부르고, 업체는 알림을 누르면 대시보드로", () => {
  const scr = readFileSync(new URL("../screens/BidStatusScreen.jsx", import.meta.url), "utf8");
  assert.match(scr, /markBidsViewed\(rid\)/);
  assert.match(scr, /viewedMarkRef\.current === rid/);
  const main = readFileSync(new URL("../components/MainApp.jsx", import.meta.url), "utf8");
  assert.match(main, /t === "BID_VIEWED"\) && activeRole === "company"/);
});
