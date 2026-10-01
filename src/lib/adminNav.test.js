// 관리자 메뉴 정리(10-01) — 자주 쓰는 탭만 앞 · «더 보기» · 첫 화면 «숫자 보기» 접기
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { splitTabs } from "./adminNav.js";

const T = [{ key: "a" }, { key: "b" }, { key: "x", more: true }, { key: "y", more: true }];

test("접힘 — 앞 탭만 · «더 보기» 보임", () => {
  const n = splitTabs(T, { mainTab: "a" });
  assert.deepEqual(n.front.map((t) => t.key), ["a", "b"]);
  assert.equal(n.showMore, true);
  assert.equal(n.expanded, false);
});

test("지금 보는 탭이 접힌 칸에 있으면 자동으로 펼침 · 눌러서 펼침", () => {
  assert.equal(splitTabs(T, { mainTab: "y" }).expanded, true);
  assert.equal(splitTabs(T, { mainTab: "a", open: true }).expanded, true);
});

test("운영자 권한으로 앞 탭이 다 걸러지면 «더 보기» 없이 다 보인다", () => {
  const n = splitTabs([{ key: "x", more: true }], { mainTab: "x" });
  assert.equal(n.showMore, false);
  assert.deepEqual(n.front.map((t) => t.key), ["x"]);
  assert.equal(splitTabs([{ key: "a" }]).showMore, false);
});

test("관리자 화면 — 콘텐츠 AI 앞 3개 · 실험 9개는 실험실 · 숫자 보기 접기 · 모르는 0 은 «—»", () => {
  const adm = readFileSync(new URL("../screens/AdminScreen.jsx", import.meta.url), "utf8");
  const content = adm.slice(adm.indexOf('{ key: "content"'), adm.indexOf('{ key: "settings"'));
  assert.equal((content.match(/", true\]/g) ?? []).length, 6);
  assert.match(content, /\["lounge_ai_factory", "AI 글 공장"\], \["autopilot", "발행 대기"\], \["lounge_insights", "성과"\]/);
  const settings = adm.slice(adm.indexOf('{ key: "settings"'), adm.indexOf("const SETTINGS_TAB_KEYS"));
  assert.equal((settings.match(/"실험: [^"]+", true\]/g) ?? []).length, 9);
  assert.match(adm, /moreLabel: "실험실"/);
  assert.match(adm, /\{showNumbers && \(/);
  assert.match(adm, /\{count \?\? "—"\}/);
  assert.match(adm, /\["결제 대기",\s+tabLoaded\.payments \? stats\.payments : null/);
});
