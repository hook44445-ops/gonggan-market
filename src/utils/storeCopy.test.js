// App Store 문안 글자 수 — 넘치면 App Store Connect 가 저장을 거부하거나(이름·부제·키워드),
// 대표가 붙여 넣다가 잘린다. 문서(store/APPSTORE-ko.md)의 «## 칸 이름» 바로 아래 첫 줄이 값이다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const doc = readFileSync(fileURLToPath(new URL("../../store/APPSTORE-ko.md", import.meta.url)), "utf-8");

function field(title) {
  const lines = doc.split("\n");
  const i = lines.findIndex(l => l.startsWith(`## ${title}`));
  assert.ok(i >= 0, `칸이 없다: ${title}`);
  const v = lines.slice(i + 1).find(l => l.trim());
  return v.trim();
}

test("App Store 이름·부제·키워드·프로모션 텍스트가 칸 크기 안에 든다", () => {
  assert.ok(field("앱 이름").length <= 30, "앱 이름 30자 초과");
  assert.ok(field("부제").length <= 30, "부제 30자 초과");
  assert.ok(field("키워드").length <= 100, "키워드 100자 초과");
  assert.ok(field("프로모션 텍스트").length <= 170, "프로모션 텍스트 170자 초과");
});

test("키워드는 띄어쓰기 없이 · 겹치지 않게 · 이름·부제 낱말과 다르게", () => {
  const kw = field("키워드");
  assert.ok(!/\s/.test(kw), "키워드에 띄어쓰기가 있다(자리 낭비)");
  const words = kw.split(",");
  assert.equal(new Set(words).size, words.length, "키워드가 겹친다");
  const head = field("앱 이름") + " " + field("부제");
  for (const w of words) assert.ok(!head.includes(w), `이름·부제에 이미 있는 낱말: ${w}`);
  for (const brand of ["숨고", "오늘의집", "집닥", "당근"]) assert.ok(!words.includes(brand), `다른 회사 이름: ${brand}`);
});

test("베타에서 에스크로를 운영 중이라 말하지 않는다", () => {
  assert.ok(!/에스크로로|안전결제로 보호/.test(field("프로모션 텍스트")));
});
