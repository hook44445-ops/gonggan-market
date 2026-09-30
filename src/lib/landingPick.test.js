import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { saveLandingPick, takeLandingPick, pickToPrefill, normalizePick, LANDING_PICK_TTL_MS, LANDING_WORK_TAGS } from "./landingPick.js";

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

test("로그인 뒤 요청서를 한 번 열어 준다(MainApp 이 꺼낸다)", () => {
  const src = readFileSync(new URL("../components/MainApp.jsx", import.meta.url), "utf8");
  assert.ok(src.includes("takeLandingPick()"), "MainApp 이 랜딩에서 고른 것을 꺼내지 않는다");
});
