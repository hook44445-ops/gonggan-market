// «우리 동네 평당 시세»(170 시세표 space_price_index) — 같은 시·도·공간·건물 유형의 완공 표본을 모아 평당 평균.
//   표본이 적으면(5건 미만) 보이지 않는다 — 몇 건으로 «시세»라고 하지 않는다. 자재 등급은 표본 수로 가중 평균.
export const MIN_SAMPLES = 5;
const PYEONG_M2 = 3.3058;

export function priceIndexSummary(rows = []) {
  const ok = (rows ?? []).filter((r) => Number(r?.price_per_m2) > 0 && Number(r?.sample_count) > 0);
  const n = ok.reduce((s, r) => s + Number(r.sample_count), 0);
  if (n < MIN_SAMPLES) return null;
  const perM2 = ok.reduce((s, r) => s + Number(r.price_per_m2) * Number(r.sample_count), 0) / n;   // 만원/m²
  const perPyeong = Math.round(perM2 * PYEONG_M2);
  return { samples: n, perPyeong, line: `비슷한 공사 평균 평당 약 ${perPyeong.toLocaleString("ko-KR")}만원 · 공간마켓 완공 ${n}건 기준` };
}

// 관리자 «가격 데이터 쌓임»(176) → 칸
export function priceDataCards(s = {}) {
  const pct = (a, b) => (Number(b) > 0 ? `${Math.round((Number(a) / Number(b)) * 100)}%` : "—");
  return [
    { label: "표준 칸 채운 요청(30일)", value: s.requests_with_fields ?? null, sub: `전체 ${s.requests_total ?? "—"}건 중 ${pct(s.requests_with_fields, s.requests_total)}` },
    { label: "자재 등급 적은 견적서", value: s.estimates_graded ?? null, sub: `견적서 ${s.estimates_total ?? "—"}건 중` },
    { label: "시세표 줄", value: s.index_rows ?? null, sub: `완공 표본 ${s.index_samples ?? 0}건` },
  ];
}
