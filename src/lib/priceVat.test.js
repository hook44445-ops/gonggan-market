// 고객에게 보이는 가격 = 부가세 포함 총액(전자상거래법 21조의2 · 법률 답 10-08) — 표시만, 데이터는 그대로.
import { test } from "node:test";
import assert from "node:assert/strict";
import { vatBreakdown, bidTotalWithVat, quotePriceRows, NO_METHOD_CHARGE, NO_COMPANY_FEE_CHARGE } from "./priceVat.js";
import { compareBids } from "./bidTable.js";

test("최종 견적서 — 부가세 포함 총액을 공급가액·부가세로 나눈다(합은 그대로)", () => {
  assert.deepEqual(vatBreakdown(1100), { totalWon: 11_000_000, supplyWon: 10_000_000, vatWon: 1_000_000 });
  const b = vatBreakdown(247.2);
  assert.equal(b.supplyWon + b.vatWon, 2_472_000);
  assert.equal(b.supplyWon, 2_247_273);
});

test("최종 견적서 금액 줄 — 법률 답 형식 그대로(고객 이용료 0원 · 고객 총 부담액 = 합계)", () => {
  const rows = quotePriceRows(1100);
  assert.deepEqual(rows.map((r) => r[0]), ["공사 공급가액", "부가가치세", "공사대금 합계", "고객 부담 플랫폼 이용료", "고객 총 부담액(부가세 포함)"]);
  assert.equal(rows[3][1], "0원");
  assert.equal(rows[4][1], rows[2][1]);
  assert.equal(NO_METHOD_CHARGE, "카드·가상계좌 선택에 따른 추가 요금은 없습니다");
  assert.equal(NO_COMPANY_FEE_CHARGE, "업체가 부담하는 플랫폼 수수료는 고객에게 별도 청구하지 않습니다");
});

test("입찰가 — «부가세 별도»면 ×1.1 총액으로 보이고, 포함·안 적음은 그대로(안 적음은 확인 안내)", () => {
  assert.equal(bidTotalWithVat(1000, { vat: false }).total, 1100);
  assert.equal(bidTotalWithVat(1234, { vat: false }).total, 1357.4);
  assert.equal(bidTotalWithVat(1000, { vat: true }).total, 1000);
  const none = bidTotalWithVat(1000, null);
  assert.equal(none.total, 1000);
  assert.match(none.note, /안 적음/);
});

test("견적 비교표도 부가세 포함 총액으로 비교한다 — 별도 입찰이 «가장 낮음»으로 잘못 보이지 않게", () => {
  const co = { name: "가", verified: true };
  const r = compareBids([
    { id: 1, price: 1000, period: 20, includes: { vat: false }, company: co },   // 실제 1,100
    { id: 2, price: 1050, period: 20, includes: { vat: true }, company: co },
  ]);
  const price = r.rows.find((x) => x.key === "price");
  assert.equal(price.cells[0].text, "1,100만원");
  assert.equal(price.cells[1].best, true);
  assert.match(price.cells[0].sub, /부가세/);
});
