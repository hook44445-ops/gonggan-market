// 198 — 매일 미션: «오늘(한국 날짜)» 숫자 · 하루 한 번(앱과 서버가 같다)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { kstDay, earnedToday, getMissionList } from "../utils/tokenCalculator.js";
import { isTokenRpc } from "./session.js";

const sql = readFileSync(new URL("../../supabase/migrations/198_token_daily_missions_today.sql", import.meta.url), "utf8");

test("한국 날짜 — UTC 15시는 다음 날", () => {
  assert.equal(kstDay("2026-10-01T14:59:00Z"), "2026-10-01");
  assert.equal(kstDay("2026-10-01T15:00:00Z"), "2026-10-02");
});

test("오늘 받았나 — 어제(한국) 받은 건 오늘 다시 받을 수 있다", () => {
  const now = Date.parse("2026-10-02T01:00:00Z");   // 한국 10-02 10시
  const logs = [{ type: "earn", action: "posts_written_3", created_at: "2026-10-01T14:00:00Z" }];   // 한국 10-01 23시
  assert.equal(earnedToday(logs, "posts_written_3", now), false);
  assert.equal(earnedToday([{ ...logs[0], created_at: "2026-10-01T15:30:00Z" }], "posts_written_3", now), true);
});

test("진행도는 오늘 숫자 · 문구에 «오늘»", () => {
  const m = getMissionList([], { posts: 50, posts_today: 1, comments_today: 4, likes_today: 25 });
  const by = Object.fromEntries(m.map((x) => [x.action, x]));
  assert.deepEqual(by.posts_written_3.progress, { current: 1, total: 3 });
  assert.deepEqual(by.comments_written_10.progress, { current: 4, total: 10 });
  assert.deepEqual(by.likes_received_20.progress, { current: 20, total: 20 });
  assert.match(by.posts_written_3.label, /^오늘 /);
});

test("198 — 서버: 오늘 0시(한국)부터 · 하루 한 번 · 내 좋아요 빼고 · 진행도 함수는 토큰", () => {
  assert.match(sql, /date_trunc\('day', now\(\) at time zone 'Asia\/Seoul'\)\) at time zone 'Asia\/Seoul'/);
  assert.match(sql, /and l\.created_at >= public\._kst_today_start\(\)\)/);
  assert.match(sql, /k\.user_id <> p_uid and k\.created_at >= v_from/);
  assert.match(sql, /revoke execute on function public\.token_mission_today\(\) from public, anon;/);
  assert.ok(isTokenRpc("token_mission_today"));
  assert.match(sql, /as today_rule,/);
  assert.match(sql, /as today_fn;/);
});
