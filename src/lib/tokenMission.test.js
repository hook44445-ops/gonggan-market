// 194 — 공간토큰 미션 적립: 서버가 «정말 했는지» 세어 보고 준다(앱 기준과 같게)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../supabase/migrations/194_token_mission_check.sql", import.meta.url), "utf8");
const hook = readFileSync(new URL("../hooks/useSpaceToken.js", import.meta.url), "utf8");

test("194 — 매일 미션 기준이 앱(useSpaceToken)과 같다", () => {
  for (const [action, n] of [["likes_received_20", 20], ["comments_written_10", 10], ["posts_written_3", 3]]) {
    assert.match(hook, new RegExp(`action: '${action}',\\s+key: '\\w+',\\s+threshold: ${n}`));
    assert.match(sql, new RegExp(`when '${action}' then[\\s\\S]*?return v >= ${n};`));
  }
});

test("194 — 한 번 보상도 했는지 확인 · 안 되면 not_met · 191 확인은 그대로", () => {
  for (const a of ["first_post", "first_story", "first_comment", "first_quote_request", "profile_complete"]) assert.match(sql, new RegExp(`when '${a}' then`));
  assert.match(sql, /if not public\._token_mission_met\(p_user_id, v_action\) then\s+return jsonb_build_object\('status', 'not_met'\);/);
  assert.match(sql, /p_user_id := auth\.uid\(\);/);
  assert.match(sql, />= \(select count\(\*\) from public\.reviews r where r\.user_id = p_user_id\)/);
  assert.match(sql, /revoke execute on function public\._token_mission_met\(uuid, text\) from public, anon, authenticated;/);
  assert.match(sql, /as mission_check,/);
  assert.match(sql, /as helper_closed;/);
});
