// 고객에게 보이는 가격 = 부가세 포함 총액(전자상거래법 21조의2 · 법률 답 10-08).
//   · 최종 견적서 total_price(만원)는 «고객이 내는 금액» = 부가세 포함 총액으로 본다 → 공급가액·부가세로 나눠 보여 준다.
//     (예전 견적서엔 «부가세 포함/별도» 칸이 없다 — 데이터는 바꾸지 않고 표시만 이렇게 한다)
//   · 입찰가는 업체가 «부가세 별도»를 눌렀으면(bids.includes.vat = false) 고객에게 ×1.1 총액으로 보여 준다(표시만).
//     안 적었으면 금액은 그대로 두고 «부가세 포함 여부 안 적음»을 붙인다(지어내지 않는다).
//   · 고객 부담 플랫폼 이용료 0원 · 결제수단별 추가 요금 없음 · 업체 수수료(4.4%)는 고객에게 청구하지 않는다(대표 10-08).
// 순수 JS — React·DOM 없음.
import { includeState } from "./bidIncludes.js";

export const VAT_RATE = 0.1;

// 부가세 포함 총액(만원) → { totalWon, supplyWon, vatWon }
export function vatBreakdown(totalManwon) {
  const totalWon = Math.round((Number(totalManwon) || 0) * 10_000);
  const supplyWon = Math.round(totalWon / (1 + VAT_RATE));
  return { totalWon, supplyWon, vatWon: totalWon - supplyWon };
}

// 입찰가(만원) → 고객에게 보일 부가세 포함 총액(만원) · vatState("in" 포함 · "out" 별도 · "none" 안 적음) · 한 줄 설명
export function bidTotalWithVat(priceManwon, includes) {
  const base = Number(priceManwon) || 0;
  const vatState = includeState(includes, "vat");
  if (vatState === "out") {
    const total = Math.round(base * (1 + VAT_RATE) * 10) / 10;
    return { total, base, vatState, note: `부가세 포함 · 업체 견적 ${base.toLocaleString("ko-KR")}만원 + 부가세` };
  }
  return { total: base, base, vatState, note: vatState === "in" ? "부가세 포함" : "부가세 포함 여부 안 적음 · 계약 전 확인" };
}

// 최종 견적서 금액 줄(고객 화면 · PDF 같은 말) — [라벨, 값, 강조]
export const NO_METHOD_CHARGE = "카드·가상계좌 선택에 따른 추가 요금은 없습니다";
export const NO_COMPANY_FEE_CHARGE = "업체가 부담하는 플랫폼 수수료는 고객에게 별도 청구하지 않습니다";
export function quotePriceRows(totalManwon) {
  const { totalWon, supplyWon, vatWon } = vatBreakdown(totalManwon);
  const w = (n) => `${n.toLocaleString("ko-KR")}원`;
  return [
    ["공사 공급가액", w(supplyWon), false],
    ["부가가치세", w(vatWon), false],
    ["공사대금 합계", w(totalWon), false],
    ["고객 부담 플랫폼 이용료", "0원", false],
    ["고객 총 부담액(부가세 포함)", w(totalWon), true],
  ];
}
