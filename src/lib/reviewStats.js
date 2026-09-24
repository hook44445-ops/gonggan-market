// 업체별 후기 평점·개수 — 업체 목록(지도·비교 카드)에 붙인다(D16).
//   companies 표에는 평점 칸이 없다. 예전엔 목록이 없는 row.rating 을 읽어 모든 업체가 「0.0」이었다.
//   공개 후기(업체 상세와 같은 거르기)만 센다. 1~5 밖의 값은 버린다.
export function reviewStatsByCompany(rows = []) {
  const acc = new Map();
  for (const r of rows ?? []) {
    const id = r?.company_id;
    const n = Number(r?.rating);
    if (!id || !Number.isFinite(n) || n < 1 || n > 5) continue;
    const s = acc.get(id) ?? { sum: 0, count: 0 };
    s.sum += n;
    s.count += 1;
    acc.set(id, s);
  }
  const out = {};
  for (const [id, s] of acc) out[id] = { rating: Math.round((s.sum / s.count) * 10) / 10, reviews: s.count };
  return out;
}

// 목록 행에 합친다. 후기가 없는 업체는 0 / 0 — 없는 평점을 만들지 않는다.
export function withReviewStats(companies = [], stats = {}) {
  return (companies ?? []).map((c) => {
    const s = stats?.[c.id];
    return s ? { ...c, rating: s.rating, reviews: s.reviews } : { ...c, rating: 0, reviews: 0 };
  });
}
