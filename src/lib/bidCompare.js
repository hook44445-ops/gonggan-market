// 입찰 비교 — 화면과 분리한 순수 로직(표시 전용. 선택·계약 로직과 무관).
// 왜: 카드가 길어서 두세 곳을 견주려면 위아래로 오가야 했고, 정렬도 금액 요약도 없었다.

export const SORT_KEYS = [
  { id: "recommended", label: "추천순" },
  { id: "price", label: "금액 낮은 순" },
  { id: "period", label: "기간 짧은 순" },
  { id: "temp", label: "공간온도 높은 순" },
];

const num = (v) => (Number(v) > 0 ? Number(v) : null);
const temp = (b) => Number(b?.company?.temp ?? 0);

// 2곳 이상일 때만 표를 단다(한 곳뿐이면 «최저가»가 의미 없다). 동점이면 함께 붙는다.
export function bidTags(bids, bid) {
  if (!Array.isArray(bids) || bids.length < 2) return [];
  const prices = bids.map(b => num(b.price)).filter(Boolean);
  const periods = bids.map(b => num(b.period)).filter(Boolean);
  const temps = bids.map(temp);
  const out = [];
  if (prices.length > 1 && num(bid.price) === Math.min(...prices)) out.push("💰 최저가");
  if (periods.length > 1 && num(bid.period) === Math.min(...periods)) out.push("⚡ 가장 빨라요");
  if (Math.max(...temps) > 0 && temp(bid) === Math.max(...temps) && new Set(temps).size > 1) out.push("⭐ 평판 최고");
  return out;
}

// 추천순 = 받은 순서 그대로(서버 정렬 유지). 나머지는 값이 없는 입찰을 뒤로 보낸다.
export function sortBids(bids = [], key = "recommended") {
  const rows = [...bids];
  const byMissingLast = (a, b, pick, dir) => {
    const x = pick(a), y = pick(b);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return (x - y) * dir;
  };
  if (key === "price")  return rows.sort((a, b) => byMissingLast(a, b, r => num(r.price), 1));
  if (key === "period") return rows.sort((a, b) => byMissingLast(a, b, r => num(r.period), 1));
  if (key === "temp")   return rows.sort((a, b) => byMissingLast(a, b, r => (temp(r) > 0 ? temp(r) : null), -1));
  return rows;
}

// 한 줄 요약 — 몇 곳이, 얼마부터 얼마까지, 가장 싼 곳과 비싼 곳 차이가 얼마인지.
export function bidSummary(bids = []) {
  const prices = bids.map(b => num(b.price)).filter(Boolean);
  const periods = bids.map(b => num(b.period)).filter(Boolean);
  if (prices.length === 0) return { count: bids.length, min: null, max: null, gap: 0, minPeriod: null, maxPeriod: null };
  const min = Math.min(...prices), max = Math.max(...prices);
  return {
    count: bids.length,
    min, max, gap: max - min,
    minPeriod: periods.length ? Math.min(...periods) : null,
    maxPeriod: periods.length ? Math.max(...periods) : null,
  };
}
