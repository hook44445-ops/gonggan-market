// 보완 S1(168) — 대화는 방의 당사자·관리자만. 서버가 토큰의 사용자로 판단하므로 앱의 대화 읽기·쓰기·실시간은 토큰 연결로.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isTokenRpc } from "./session.js";

const sql = readFileSync(new URL("../../supabase/migrations/168_chats_parties_only.sql", import.meta.url), "utf8");
const lib = readFileSync(new URL("./supabase.js", import.meta.url), "utf8");
const chat = readFileSync(new URL("../screens/ChatScreen.jsx", import.meta.url), "utf8");

test("정책: 누구나(using true) 없이 당사자 판정 함수로만", () => {
  assert.match(sql, /create policy chats_party_read on public\.chats for select\s+using \(public\.chat_room_party\(room_id, auth\.uid\(\)\)\)/);
  assert.match(sql, /with check \(public\.chat_room_party\(room_id, auth\.uid\(\)\) and \(sender_id is null or sender_id = auth\.uid\(\)\)\)/);
  assert.doesNotMatch(sql.replace(/^--.*$/gm, ""), /using \(true\)|with check \(true\)/);
});

test("방 ID 규칙 두 가지(고객_업체 · lounge_요청)를 모두 판정한다", () => {
  assert.match(sql, /like 'lounge\\_%'/);
  assert.match(sql, /q\.requester_id, q\.target_id/);
  assert.match(sql, /c\.owner_id = p_uid and c\.id in \(v_a, v_b\)/);
});

test("앱의 대화 표 접근은 모두 토큰 연결(chatDb)", () => {
  assert.doesNotMatch(lib, /\bsupabase\s*\.from\("chats"\)/);
  assert.match(chat, /const channel = chatConn\s*\n\s*\.channel\(`chat:\$\{roomId\}`\)/);
  assert.match(chat, /chatConn\.removeChannel\(channel\)/);
  assert.ok(isTokenRpc("chat_mark_room_read"));
});

test("대화 사진 보관함: 목록·올리기는 당사자만, 올리기는 토큰 연결", () => {
  assert.match(sql, /with check \(bucket_id = 'chat-photos' and public\.chat_room_party\(split_part\(name, '\/', 1\), auth\.uid\(\)\)\)/);
  assert.match(sql, /using \(bucket_id = 'chat-photos' and public\.chat_room_party\(split_part\(name, '\/', 1\), auth\.uid\(\)\)\)/);
  assert.match(lib, /uploadFile\("chat-photos", path, file, userDb\(\)\)/);
});
