import { test } from "node:test";
import assert from "node:assert/strict";
import { safeStorageKey } from "./storageKey.js";

test("한글 파일 이름 → 영문·숫자만 남기고 확장자는 지킨다", () => {
  assert.equal(safeStorageKey("escrow/3/1790309357027_점검6차-착공.png"), "escrow/3/1790309357027_6.png");
});

test("이름이 전부 한글이면 무작위 이름", () => {
  const k = safeStorageKey("portfolio/abc/before/사진.JPG");
  assert.match(k, /^portfolio\/abc\/before\/f[a-z0-9]{1,6}\.jpg$/);
});

test("영문 이름·폴더는 그대로", () => {
  assert.equal(safeStorageKey("escrow/3/1790_check6-start.png"), "escrow/3/1790_check6-start.png");
  assert.equal(safeStorageKey("site_visits/b1/1790_IMG 0001.jpeg"), "site_visits/b1/1790_IMG_0001.jpeg");
});
