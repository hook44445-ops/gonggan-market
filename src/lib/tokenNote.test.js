// 토큰 없는 로그인 — 대화·수첩이 비어 보이면 «사라졌다»로 오해 → 그 화면에 «다시 인증» 버튼
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("대화방 맨 위 안내 · 수첩 오류에 버튼 · App 이 받아 인증 화면으로", () => {
  const chat = readFileSync(new URL("../screens/ChatScreen.jsx", import.meta.url), "utf8");
  assert.match(chat, /<TokenNeededNote userId=\{user\?\.id\} what="대화" \/>/);
  const hc = readFileSync(new URL("../screens/HomeCareScreen.jsx", import.meta.url), "utf8");
  assert.match(hc, /onClick=\{requestReauth\}/);
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(app, /addEventListener\("gonggan:reauth", on\)/);
  assert.match(app, /reauthRef\.current = reauthenticate;/);
  const note = readFileSync(new URL("../components/TokenNeededNote.jsx", import.meta.url), "utf8");
  assert.match(note, /if \(!userId \|\| getSessionToken\(userId\)\) return null;/);
});
