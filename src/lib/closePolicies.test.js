// 180 — 운영에서 누구나 열려 있던 정책 닫기(09-30 대표가 뽑은 pg_policies 근거)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../supabase/migrations/180_close_open_policies.sql", import.meta.url), "utf8");

test("열린 정책을 조건으로 찾아 지운다 · 푸시 설정의 «로그인 안 함 허용» 도", () => {
  assert.match(sql, /coalesce\(qual, ''\) = 'true' or coalesce\(with_check, ''\) = 'true'/);
  assert.match(sql, /ilike '%auth\.uid\(\) IS NULL%'/);
});

test("알림은 본인만 · 후기 읽기는 누구나 · 업체는 답글 칸만", () => {
  assert.match(sql, /g180_notif_read on public\.notifications for select using \(auth\.uid\(\) = user_id or public\.is_admin\(\)\)/);
  assert.match(sql, /g180_reviews_read on public\.reviews for select using \(true\)/);
  assert.match(sql, /\(to_jsonb\(new\) - 'reply' - 'updated_at'\) is distinct from \(to_jsonb\(old\) - 'reply' - 'updated_at'\)/);
  assert.match(sql, /g180_pp_self on public\.push_preferences for all\s+using \(user_id::text = auth\.uid\(\)::text\)/);
});
