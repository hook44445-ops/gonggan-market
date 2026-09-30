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

test("서류센터·계약 화면 안내 + 견적서·현장방문·추가공사 오류를 사람 말로", () => {
  for (const [f, what] of [["../screens/DocumentCenterScreen.jsx", "서류"], ["../screens/EscrowScreen.jsx", "계약·공사 기록"]]) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.ok(src.includes(`what="${what}"`), f);
  }
  for (const f of ["../components/PlatformEstimateModal.jsx", "../components/SiteVisitModal.jsx", "../components/ChangeOrderPanel.jsx"]) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.doesNotMatch(src, /alert\("[^"]*실패: " \+ \(?(result\.)?error\.message/, f);
    assert.match(src, /alertRpcError\(/, f);
  }
  const note = readFileSync(new URL("../components/TokenNeededNote.jsx", import.meta.url), "utf8");
  assert.match(note, /LOGIN_REQUIRED\|JWT/);
});
