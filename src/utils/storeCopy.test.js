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

// ── 스토어 자산이 앱과 갈라지지 않게 (2026-09-30) ──────────────────
// 09-30 점검에서 store/ASO-ko.md 가 아이콘을 «icon-512-v3.png» 로 가리키고 있었다.
// manifest 는 v6 이라, 이대로 스토어에 올렸으면 폰 아이콘과 스토어 아이콘이 달랐다.
const aso = readFileSync(fileURLToPath(new URL("../../store/ASO-ko.md", import.meta.url)), "utf-8");
const manifest = readFileSync(fileURLToPath(new URL("../../public/manifest.json", import.meta.url)), "utf-8");

test("스토어 문안의 앱 아이콘이 manifest 와 같은 판이다", () => {
  const cur = manifest.match(/icon-512-v(\d+)\.png/);
  assert.ok(cur, "manifest 에서 512 아이콘을 못 찾았다");
  const row = aso.split("\n").find(l => l.includes("앱 아이콘 512"));
  assert.ok(row, "store/ASO-ko.md 에 «앱 아이콘 512» 줄이 없다");
  assert.ok(row.includes(`icon-512-v${cur[1]}.png`),
    `스토어 문안 아이콘이 manifest(v${cur[1]}) 와 다르다: ${row.trim()}`);
});

// 스토어 문안도 사업자등록을 «계약»에 붙인다(사실 · contractGate 로 막혀 있다).
// «견적·입찰»에 붙이면 사실이 아니다 — 가입만 해도 300만원까지 입찰한다(partnerTier LIMITS.NONE).
//
// 설명하는 글(«왜 고쳤나» 같은 메모)에는 틀린 문구가 인용으로 나올 수밖에 없다.
// 그래서 문서 전체가 아니라 «실제로 스토어에 붙여 넣는 칸»만 본다.
function section(full, title, stops) {
  const i = full.indexOf(`## ${title}`);
  assert.ok(i >= 0, `칸이 없다: ${title}`);
  const rest = full.slice(i + title.length + 3);
  const ends = stops.map(t => rest.indexOf(`## ${t}`)).filter(n => n >= 0);
  return rest.slice(0, ends.length ? Math.min(...ends) : rest.length);
}

test("스토어에 붙여 넣는 칸이 견적에 없는 검증을 붙이지 않는다", () => {
  const banned = /확인 업체만 견적|사업자등록을? 확인한? 업체[^.]{0,24}(견적을? 보|견적을? 받|입찰)/;
  const cells = [
    ["APPSTORE 앱 이름", field("앱 이름")],
    ["APPSTORE 부제", field("부제")],
    ["APPSTORE 프로모션 텍스트", field("프로모션 텍스트")],
    ["ASO 앱 이름", section(aso, "앱 이름 (30자)", ["간단한 설명"])],
    ["ASO 간단한 설명", section(aso, "간단한 설명 (80자) — 매력", ["자세한 설명"])],
    ["ASO 자세한 설명", section(aso, "자세한 설명 (4000자)", ["이미지 (Play)"])],
  ];
  for (const [name, text] of cells) assert.ok(!banned.test(text), `${name} 에 없는 검증 광고가 있다`);
});

// 반대로 «계약은 사업자등록 확인 업체와만» 은 코드로 막혀 있는 우리만의 말이다 — 자세한 설명에서 빠지지 않게.
test("스토어 자세한 설명이 계약 단계의 사업자등록 확인을 말한다", () => {
  const body = section(aso, "자세한 설명 (4000자)", ["이미지 (Play)"]);
  assert.ok(/계약은 사업자등록을 확인한 업체와만/.test(body), "ASO 자세한 설명에서 사라졌다");
});
