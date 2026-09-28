// Public-page atmosphere only. These images must never stand in for completed work.
const COVER_KEYS = new Map([
  ['욕실', 'bath'], ['방수/누수', 'bath'], ['줄눈/탄성코트', 'bath'],
  ['주방', 'kitchen'],
  ['인테리어 필름', 'film'], ['몰딩/도어', 'film'],
  ['바닥/도배', 'finish'], ['페인트', 'finish'], ['타일', 'finish'],
  ['집수리 일반', 'repair'], ['조명/전기', 'repair'], ['철거', 'repair'],
  ['아파트 전체/부분', 'space'], ['원룸', 'space'], ['카페/식당', 'space'],
  ['아파트 전체', 'space'], ['아파트 부분', 'space'], ['원룸/오피스텔', 'space'],
  ['오피스', 'space'], ['상가', 'space'],
]);

export function coverKeyFor(specialties) {
  const first = Array.isArray(specialties) ? specialties[0] : undefined;
  return COVER_KEYS.get(typeof first === 'string' ? first.trim() : '') ?? 'repair';
}

export function coverFor(company) {
  return company?.cover || `/images/company-cover/${coverKeyFor(company?.specialties)}.webp`;
}
