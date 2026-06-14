// ── 재무 계산 유틸 (재무대시보드 / 거래관리 공용) ──────────────────────────
// 정책(작업지시서 ADMIN V2.0 기준):
//   · 업체 수수료 4.4% (부가세 포함) = 매출 4.0% + 부가세 0.4%
//   · 토큰 8,800원 = 매출 8,000원 + 부가세 800원
//   · 공간마켓 매출로 보지 않음: 고객부담 PG 결제수수료 / 가상계좌 660원 /
//     업체 정산 시공대금 / 부가세 / 에스크로 보관금
//
// 주의: escrow_payments.total_amount / bids.price 등은 "만원 단위" 정수로 저장된다.
//       원(KRW) 환산은 manwonToWon() 으로 ×10000 한다.

export const PLATFORM_FEE_RATE     = 0.044; // 부가세 포함 업체 수수료
export const PLATFORM_REVENUE_RATE = 0.040; // 공급가액(매출)
export const PLATFORM_VAT_RATE     = 0.004; // 수수료 부가세

export const TOKEN_PRICE   = 8800; // 토큰 1건 결제금액(원)
export const TOKEN_REVENUE = 8000; // 토큰 매출(원)
export const TOKEN_VAT     = 800;  // 토큰 부가세(원)

// 만원 단위 → 원
export const manwonToWon = (v) => Math.round((Number(v) || 0) * 10000);

// 원화 표기(₩1,234,567)
export const formatWon = (won) =>
  "₩" + (Math.round(Number(won) || 0)).toLocaleString("ko-KR");

// 계약금액(원) → 플랫폼 수수료/매출/부가세 + 업체 정산예정금
export function contractFinance(amountWon) {
  const gmv     = Math.round(Number(amountWon) || 0);
  const feeTotal = Math.round(gmv * PLATFORM_FEE_RATE);
  const revenue  = Math.round(gmv * PLATFORM_REVENUE_RATE);
  const feeVat   = Math.round(gmv * PLATFORM_VAT_RATE);
  const companyPayout = gmv - feeTotal; // 업체 정산예정금 = 거래액 − 수수료총액
  return { gmv, feeTotal, revenue, feeVat, companyPayout };
}

// escrow 가 정산/취소/분쟁 등 어떤 상태인지로 GMV 집계 대상 판정.
// CANCELLED 는 제외. 그 외(예치~정산)는 거래 성립으로 본다.
const COUNTED_ESCROW = new Set([
  "CONTRACTED", "STARTED", "MID_INSPECTION", "COMPLETED", "SETTLED", "DISPUTE",
]);

// admin_project_flow_list 행 배열 → 재무 집계.
// 각 행의 escrow.total_amount(만원) 를 원으로 환산해 합산한다.
export function aggregateFinance(rows) {
  const acc = {
    contractCount: 0,   // 계약(에스크로) 성립 건수
    paidCount: 0,       // 결제(전액예치) 완료 건수
    settledCount: 0,    // 정산 완료 건수
    gmv: 0,             // 총 거래액(원)
    feeTotal: 0,        // 플랫폼 수수료 총액(4.4%)
    revenue: 0,         // 플랫폼 매출 공급가액(4.0%)
    feeVat: 0,          // 수수료 부가세(0.4%)
    expectedPayout: 0,  // 예상 정산액(업체 정산예정금 합계)
    settleReady: 0,     // 정산 대기금액(업체 정산예정금 기준)
    settleDone: 0,      // 정산 완료금액(지급완료액)
    settleHeld: 0,      // 정산 보류금액(분쟁/DISPUTE)
  };
  for (const r of rows || []) {
    const esc = r.escrow;
    if (!esc || !COUNTED_ESCROW.has(esc.transaction_status)) continue;
    const gmv = manwonToWon(esc.total_amount);
    const f = contractFinance(gmv);
    acc.contractCount += 1;
    if (esc.step1_deposited_at ||
        ["CONTRACTED","STARTED","MID_INSPECTION","COMPLETED","SETTLED"].includes(esc.transaction_status))
      acc.paidCount += 1;
    if (esc.transaction_status === "SETTLED") acc.settledCount += 1;
    acc.gmv      += f.gmv;
    acc.feeTotal += f.feeTotal;
    acc.revenue  += f.revenue;
    acc.feeVat   += f.feeVat;
    acc.expectedPayout += f.companyPayout;

    const held = esc.transaction_status === "DISPUTE" || esc.dispute_status != null;
    if (esc.transaction_status === "SETTLED")      acc.settleDone += f.companyPayout;
    else if (held)                                  acc.settleHeld += f.companyPayout;
    else                                            acc.settleReady += f.companyPayout;
  }
  acc.unsettled     = acc.settleReady + acc.settleHeld; // 미정산금액
  // 예상 부가세 / 순매출 (토큰·PG 는 1차에서 미연동 → escrow 기준만)
  acc.expectedVat   = acc.feeVat;
  acc.expectedNet   = acc.revenue;
  return acc;
}

// ── 시계열 집계 (일별/주별/월별 GMV·건수) ───────────────────────────────
// period: 'day' | 'week' | 'month'. created_at 기준 버킷, 최근 limit 버킷 반환.
function bucketKey(d, period) {
  const y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
  if (period === "month") return `${y}-${String(m + 1).padStart(2, "0")}`;
  if (period === "week") {
    // ISO 주 시작(월요일) 기준
    const t = new Date(Date.UTC(y, m, day));
    const dow = (t.getUTCDay() + 6) % 7; // 월=0
    t.setUTCDate(t.getUTCDate() - dow);
    return `${t.getUTCFullYear()}-W${String(t.getUTCMonth() + 1).padStart(2, "0")}${String(t.getUTCDate()).padStart(2, "0")}`;
  }
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function bucketLabel(d, period) {
  if (period === "month") return `${d.getMonth() + 1}월`;
  if (period === "week")  return `${d.getMonth() + 1}/${d.getDate()}`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function buildTimeSeries(rows, period = "day", limit = 14) {
  const map = new Map(); // key -> {label, gmv, count, ts}
  for (const r of rows || []) {
    const esc = r.escrow;
    if (!esc || !COUNTED_ESCROW.has(esc.transaction_status)) continue;
    if (!r.created_at) continue;
    const d = new Date(r.created_at);
    const key = bucketKey(d, period);
    const cur = map.get(key) || { label: bucketLabel(d, period), gmv: 0, count: 0, ts: d.getTime() };
    cur.gmv += manwonToWon(esc.total_amount);
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => a.ts - b.ts).slice(-limit);
}
