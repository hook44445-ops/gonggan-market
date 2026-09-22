// 시공 사례 — 홈 사진 타일·「시공 사례」 모음·상세가 같은 모양의 데이터를 쓰도록 한 곳에서 정리한다.
//
// 원천은 세 가지다(보이는 순서도 이 순서).
//  · topReviews  : 실제 고객 리뷰(getTopReviews) — before/after/image_urls 배열 · companies.name
//  · portfolios  : 업체가 직접 올린 시공 사례(getRecentPortfolios) — before_photos/after_photos · companies.name
//                  업체가 스스로 공개한 것이라 이름을 가리지 않는다(고객 리뷰의 업체 이름 가림과 다르다).
//  · seedReviews : 운영 예시 리뷰(getSeedReviews) — before_image_url/after_image_url 단일 값
// 사진이 하나도 없는 리뷰는 사례로 쓰지 않는다(누르면 빈 화면이 되기 때문).

const listOf = (arr) => (Array.isArray(arr) ? arr.filter(Boolean) : []);

export function normalizeShowcases({ topReviews = [], portfolios = [], seedReviews = [], maskName = (n) => n } = {}) {
  const real = topReviews.map((r) => {
    const after = listOf(r.after_image_urls);
    const before = listOf(r.before_image_urls);
    const extra = listOf(r.image_urls);
    return {
      id: String(r.id),
      photo: after[0] ?? extra[0] ?? before[0] ?? null,
      before: before[0] ?? null,
      gallery: [...after, ...extra].filter((u, i, a) => a.indexOf(u) === i),
      text: (r.content ?? "").trim(),
      author: r.user_name ?? "익명",
      company: r.companies?.name ? maskName(r.companies.name) : null,
      companyId: r.company_id ?? null,
      region: r.region ?? null,
      spaceType: r.space_type ?? null,
      rating: Number.isFinite(Number(r.rating)) ? Number(r.rating) : null,
      createdAt: r.created_at ?? null,
      isSeed: false,
    };
  });
  const seed = seedReviews.map((s) => ({
    id: `seed_${s.id}`,
    photo: s.after_image_url ?? s.before_image_url ?? null,
    before: s.before_image_url ?? null,
    gallery: listOf([s.after_image_url]),
    text: (s.content ?? "").trim(),
    author: s.user_name ?? "익명",
    company: s.masked_company_name ?? "공간○○",
    companyId: null,
    region: s.region ?? null,
    spaceType: s.space_type ?? s.category ?? null,
    rating: Number.isFinite(Number(s.rating)) ? Number(s.rating) : null,
    createdAt: s.created_at ?? null,
    isSeed: true,
  }));
  const partner = (portfolios ?? []).map((p) => {
    const after = listOf(p.after_photos);
    const before = listOf(p.before_photos);
    const name = p.companies?.name ?? null;
    return {
      id: `pf_${p.id}`,
      photo: after[0] ?? before[0] ?? null,
      before: before[0] ?? null,
      gallery: after.length ? after : before,
      text: (p.desc ?? "").trim(),
      author: name ?? "시공 업체",
      company: name,
      companyId: p.company_id ?? null,
      region: p.area ?? null,
      spaceType: p.space_type ?? null,
      rating: null,
      createdAt: p.created_at ?? null,
      isSeed: false,
      isPortfolio: true,
    };
  });
  return [...real, ...partner, ...seed]
    .filter((x) => x.photo)
    .map((x) => ({ ...x, title: x.spaceType ?? "시공 사례", meta: [x.region, x.company].filter(Boolean).join(" · ") }));
}

/** 필터 칩 — 실제 데이터에 있는 공간 유형만 보여준다(빈 칩 금지). */
export function showcaseTypes(items = []) {
  const seen = [];
  for (const x of items) if (x.spaceType && !seen.includes(x.spaceType)) seen.push(x.spaceType);
  return seen;
}
