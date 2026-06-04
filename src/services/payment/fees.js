// ── 수수료 산출 — payment_fee_rules 기반 (3.7% 하드코딩 제거) ────────────────
// 결제수단별 요율을 코드에 박지 않고 DB 규칙(payment_fee_rules)에서 읽는다.
// 규칙 미조회 시에만 DEFAULT_CUSTOMER_FEE_RATE 로 폴백(현재 시드값과 동일 → 동작 보존).
import { getPaymentFeeRules } from "../../lib/supabase";
import { ACTIVE_PROVIDER, DEFAULT_CUSTOMER_FEE_RATE } from "./constants";

let _cache = null;

// 활성 수수료 규칙 목록(캐시). 실패해도 빈 배열 → 폴백 요율 사용.
export async function loadFeeRules() {
  if (_cache) return _cache;
  try {
    const { data } = await getPaymentFeeRules();
    _cache = Array.isArray(data) ? data : [];
  } catch {
    _cache = [];
  }
  return _cache;
}

// 캐시 무효화(관리자 요율 수정 후 재조회용).
export function clearFeeRulesCache() {
  _cache = null;
}

// 규칙 배열에서 요율 산출(동기). rules 미전달/미매칭 시 폴백.
export function feeRateFromRules(rules, method, provider = ACTIVE_PROVIDER) {
  const r = (rules ?? []).find(
    (x) => x.provider === provider && x.payment_method === method && x.is_active
  );
  return r ? Number(r.fee_rate) : DEFAULT_CUSTOMER_FEE_RATE;
}

// 비동기 요율 조회(규칙 자동 로드).
export async function getFeeRate(method, provider = ACTIVE_PROVIDER) {
  const rules = await loadFeeRules();
  return feeRateFromRules(rules, method, provider);
}

// 금액(만원 단위) → 수수료/합계. 기존 calcCustomerFee 와 동일 반올림(소수1자리) 유지.
export function computeFeeWithRate(amount, rate) {
  const feeAmount = Math.round(Number(amount) * rate * 10) / 10;
  return {
    rate,
    feeAmount,
    netAmount: Math.round((Number(amount) - feeAmount) * 10) / 10,
    total: Math.round((Number(amount) + feeAmount) * 10) / 10,
  };
}

export async function computeFee(amount, method, provider = ACTIVE_PROVIDER) {
  const rate = await getFeeRate(method, provider);
  return computeFeeWithRate(amount, rate);
}
