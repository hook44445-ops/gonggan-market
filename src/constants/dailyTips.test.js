import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DAILY_TIPS, pickDailyTip, checkinEarn, daysToBonus, CHECKIN_REWARD } from "./dailyTips.js";
import { tagsFromPost } from "../lib/loungeToRequest.js";

const at = (iso) => Date.parse(iso);

test("팁 — 같은 날은 같은 팁 · 다음 날은 다른 팁 · 그 달에 맞는 것만", () => {
  const a = pickDailyTip(at("2026-10-02T08:00:00+09:00"));
  assert.equal(pickDailyTip(at("2026-10-02T23:30:00+09:00")), a);
  assert.notEqual(pickDailyTip(at("2026-10-03T08:00:00+09:00")), a);
  for (let d = 1; d <= 31; d++) {
    const t = pickDailyTip(at(`2026-10-${String(d).padStart(2, "0")}T12:00:00+09:00`));
    assert.ok(!t.months || t.months.includes(10), `${t.title} 은 10월 팁이 아님`);
  }
  // 한겨울엔 장마·에어컨 팁이 안 나온다
  for (let d = 1; d <= 31; d++) {
    const t = pickDailyTip(at(`2026-01-${String(d).padStart(2, "0")}T12:00:00+09:00`));
    assert.ok(!/장마|에어컨/.test(t.title));
  }
});

test("팁 — 제목·본문 길이 · 칩은 요청서 칩 이름", () => {
  for (const t of DAILY_TIPS) {
    assert.ok(t.title.length <= 20, t.title);
    assert.ok(t.body.length <= 90, t.title);
    if (t.tag) assert.ok(tagsFromPost({ title: t.title, content: t.body }).length > 0, `${t.title} — 요청서 칩이 안 나옴`);
  }
});

test("출석 보상 — 매일 1 · 7일마다 +5 · 서버(162)와 같다", () => {
  assert.deepEqual([1, 2, 6, 7, 8, 14].map(checkinEarn), [1, 1, 1, 6, 1, 6]);
  assert.deepEqual([0, 1, 6, 7, 8].map(daysToBonus), [0, 6, 1, 0, 6]);
  const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/162_daily_checkin.sql", import.meta.url)), "utf-8");
  assert.ok(sql.includes(`v_earn := ${CHECKIN_REWARD.daily} + case when v_streak % ${CHECKIN_REWARD.bonusEvery} = 0 then ${CHECKIN_REWARD.weeklyBonus} else 0 end;`));
  assert.ok(sql.includes("(now() at time zone 'Asia/Seoul')::date"));
});

test("출석 알림(164) — 연속 2일 이상 · 하루 한 번 · 푸시는 광고 규칙", () => {
  const sql = readFileSync(fileURLToPath(new URL("../../supabase/migrations/164_checkin_reminder.sql", import.meta.url)), "utf-8");
  assert.ok(sql.includes("y.streak >= 2"));
  assert.ok(sql.includes("n.type = 'CHECKIN_REMINDER'"));
  assert.ok(sql.includes("'event_promo'") && sql.includes("'(광고) '") && sql.includes("push_marketing"));
  assert.ok(sql.includes(`% ${CHECKIN_REWARD.bonusEvery} = 0 then ' 오늘은 7일 보너스 +${CHECKIN_REWARD.weeklyBonus} 날이에요.'`));
});
