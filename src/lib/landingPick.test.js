import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { saveLandingPick, takeLandingPick, takeLandingDraft, hasLandingSend, isDraftComplete, pickToPrefill, normalizePick, LANDING_PICK_TTL_MS, LANDING_WORK_TAGS, LANDING_SIZES, LANDING_BUDGETS, LANDING_MEMO_MAX } from "./landingPick.js";

function mem() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}

test("고른 공간·공사가 요청서 initialData 모양으로 돌아온다", () => {
  const ls = mem();
  assert.equal(saveLandingPick({ type: "아파트 부분", tags: ["도배", "바닥"] }, 1000, ls), true);
  assert.deepEqual(takeLandingPick(2000, ls), { type: "아파트 부분", desc: "도배, 바닥 — " });
});

test("한 번 꺼내면 지운다 — 다음 요청서를 오염시키지 않는다", () => {
  const ls = mem();
  saveLandingPick({ type: "상가", tags: [] }, 0, ls);
  assert.deepEqual(takeLandingPick(10, ls), { type: "상가" });
  assert.equal(takeLandingPick(20, ls), null);
});

test("3시간 지난 것은 버린다", () => {
  const ls = mem();
  saveLandingPick({ type: "오피스", tags: ["조명·전기"] }, 0, ls);
  assert.equal(takeLandingPick(LANDING_PICK_TTL_MS + 1, ls), null);
});

test("모르는 공간·공사 이름은 걸러진다 · 아무것도 없으면 저장하지 않는다", () => {
  assert.deepEqual(normalizePick({ type: "우주선", tags: ["도배", "해킹", "도배"] }), { type: "", tags: ["도배"] });
  assert.equal(pickToPrefill({ type: "x", tags: ["y"] }), null);
  const ls = mem();
  assert.equal(saveLandingPick({}, 0, ls), false);
  assert.equal(ls.m.size, 0);
});

test("깨진 값·저장소 없음에도 죽지 않는다", () => {
  const ls = mem();
  ls.setItem("gm_landing_pick_v1", "{not json");
  assert.equal(takeLandingPick(0, ls), null);
  assert.equal(takeLandingPick(0, null), null);
  assert.equal(saveLandingPick({ type: "상가" }, 0, null), false);
});

test("랜딩 공사 칩은 요청서 칩과 같은 이름이다(요청서가 칩으로 되읽는다)", () => {
  const src = readFileSync(new URL("../components/RequestModalBeta.jsx", import.meta.url), "utf8");
  const m = src.match(/const WORK_TAGS = \[([^\]]+)\]/);
  assert.ok(m, "요청서 WORK_TAGS 를 찾지 못함");
  const reqTags = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  for (const t of LANDING_WORK_TAGS) assert.ok(reqTags.includes(t), `요청서에 없는 칩: ${t}`);
});

test("로그인 뒤 꺼낸다 — 보내기를 누른 요청은 submitReq 로, 아니면 요청서를 연다(MainApp)", () => {
  const src = readFileSync(new URL("../components/MainApp.jsx", import.meta.url), "utf8");
  assert.ok(src.includes("takeLandingDraft()"), "MainApp 이 랜딩에서 쓴 것을 꺼내지 않는다");
  assert.match(src, /if \(draft\.send\)[\s\S]{0,200}submitReq\(/, "보내기 누른 요청을 submitReq 로 보내지 않는다");
  // 인증 없이 보내지 않는다 — submitReq 안의 로그인 확인이 그대로 있어야 한다.
  assert.match(src, /async function submitReq\(form\)[\s\S]{0,1500}if \(!user\?\.id\)/, "submitReq 의 로그인 확인이 사라졌다");
});

// ── 10-09 일감 2 «먼저 쓰고, 보낼 때 인증» ──
const FULL = { type: "아파트 부분", tags: ["욕실", "타일"], size: "20평대", budget: "300~500만원", memo: "  이사 전에 끝내고 싶어요 " };

test("다 쓴 요청서는 보낼 수 있다 · 하나라도 비면 못 보낸다", () => {
  assert.equal(isDraftComplete(normalizePick(FULL)), true);
  for (const k of ["type", "size", "budget"]) assert.equal(isDraftComplete(normalizePick({ ...FULL, [k]: "" })), false, k);
  assert.equal(isDraftComplete(normalizePick({ ...FULL, tags: [] })), false);
});

test("보내기를 누른 요청서는 그대로(메모 포함) 돌아오고 send=true · 한 번만", () => {
  const ls = mem();
  saveLandingPick({ ...FULL, send: true }, 0, ls);
  assert.equal(hasLandingSend(10, ls), true);
  assert.equal(hasLandingSend(10, ls), true, "엿보기는 지우지 않는다");
  assert.deepEqual(takeLandingDraft(20, ls), {
    send: true,
    form: { type: "아파트 부분", size: "20평대", budget: "300~500만원", desc: "욕실, 타일 — 이사 전에 끝내고 싶어요" },
  });
  assert.equal(takeLandingDraft(30, ls), null, "두 번 나가지 않는다");
  assert.equal(hasLandingSend(30, ls), false);
});

test("다 안 쓴 채 send 를 붙여도 보내지 않는다(요청서만 연다)", () => {
  const ls = mem();
  saveLandingPick({ type: "상가", tags: ["도배"], send: true }, 0, ls);
  assert.equal(hasLandingSend(1, ls), false);
  assert.deepEqual(takeLandingDraft(1, ls), { send: false, form: { type: "상가", desc: "도배 — " } });
});

test("send 없이 다시 저장하면 send 가 빠진다 · 3시간 지나면 보내지 않는다", () => {
  const ls = mem();
  saveLandingPick({ ...FULL, send: true }, 0, ls);
  saveLandingPick(FULL, 1, ls);
  assert.equal(hasLandingSend(2, ls), false);
  saveLandingPick({ ...FULL, send: true }, 0, ls);
  assert.equal(takeLandingDraft(LANDING_PICK_TTL_MS + 1, ls), null);
});

test("모르는 평수·예산은 버리고 메모는 길이를 자른다", () => {
  const p = normalizePick({ ...FULL, size: "100평", budget: "1억", memo: "가".repeat(LANDING_MEMO_MAX + 50) });
  assert.equal(p.size, undefined);
  assert.equal(p.budget, undefined);
  assert.equal(p.memo.length, LANDING_MEMO_MAX);
});

test("랜딩 평수·예산 칩은 요청서 칩과 같은 값이다", () => {
  const src = readFileSync(new URL("../components/RequestModalBeta.jsx", import.meta.url), "utf8");
  const read = (name) => { const i = src.indexOf(`const ${name} = [`); assert.ok(i >= 0, name); const body = src.slice(i, src.indexOf("]", i)); return [...body.matchAll(/"([^"]+)"/g)].map((x) => x[1]); };
  assert.deepEqual(LANDING_SIZES, read("SIZE_QUICK"));
  assert.deepEqual(LANDING_BUDGETS, read("BUDGET_QUICK"));
});

test("인증 화면은 보내기를 누르고 온 고객에게 왜 번호가 필요한지 말한다", () => {
  const src = readFileSync(new URL("../screens/LoginScreen.jsx", import.meta.url), "utf8");
  assert.ok(src.includes("hasLandingSend()"));
  assert.ok(src.includes("이 요청을 업체에 보내려면 번호 확인이 필요해요(업체 연락·사기 방지)"));
});
