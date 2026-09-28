import { test } from "node:test";
import assert from "node:assert/strict";
import { qrMatrix, qrSvgPath } from "./qr.js";

test("업체 페이지 주소 QR — 정사각 · 위치 찾기 무늬(왼쪽 위 7칸 테두리)", () => {
  const m = qrMatrix("https://gongganmarket.com/p/bandeut?ref=ABC234");
  const n = m.length;
  assert.ok(n >= 21 && (n - 17) % 4 === 0);
  assert.ok(m.every((row) => row.length === n));
  for (let i = 0; i < 7; i++) { assert.equal(m[0][i], true); assert.equal(m[6][i], true); assert.equal(m[i][0], true); }
  assert.equal(m[1][1], false);
  assert.equal(m[3][3], true);
});

test("SVG 경로 — 둘레 빈칸 포함 크기", () => {
  const { d, size } = qrSvgPath(qrMatrix("x"), 4);
  assert.equal(size, 21 + 8);
  assert.match(d, /^M4 4h1v1h-1z/);
});
