// 견적 «나란히 비교» 표 — 「비교견적」이라는 이름값을 채우는 자리.
// (정렬·최저가 태그·한 줄 요약은 옆 파일 bidCompare.js 가 맡는다. 이 파일은 표 한 장만.)
//
// 왜 만들었나(2026-09-30 본질 점검 ①):
//   입찰 카드(BidCompareCard)는 «금액 + 공사 N일» 만 크게 보였다. 업체가 입찰할 때
//   이미 적어 낸 «주요 자재»(bids.material_note)와 «한마디»(bids.comment)는 화면에 없었다.
//   그래서 고객은 덜 아는 상태에서 금액으로 고르게 됐다 — 기존 방식과 다를 게 없다.
//   항목별 최종 견적서(QuoteDocument)는 이미 잘 만들어져 있지만 «업체를 고른 뒤»에 나온다.
//
// 이 파일이 지키는 것
//   1) 있는 데이터만 쓴다. 표 하나 만들자고 새 칸·새 SQL 을 만들지 않는다.
//   2) **빈 칸을 빈 칸으로 보여준다.** 비교의 핵심은 같은 것끼리 놓는 게 아니라
//      «무엇이 빠졌는지»가 보이는 것이다. 안 적은 업체를 가려 주면 비교가 아니라 광고가 된다.
//   3) 없는 숫자를 지어내지 않는다. 최종 금액은 현장 확인 뒤 견적서에서 확정된다.
//
// 순수 JS — React·DOM 없음(테스트가 그대로 부른다).

export const MAX_COMPARE = 3;

const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const text = (v) => String(v ?? "").trim();

// 하루당 얼마 — 「싼데 오래 걸리는 집」과 「비싼데 빨리 끝나는 집」을 같은 자로 잰다.
// 기간을 안 적었으면 계산하지 않는다(0일로 나눠 이상한 숫자를 만들지 않는다).
export function perDay(priceManwon, periodDays) {
  const p = num(priceManwon), d = num(periodDays);
  if (!p || !d) return null;
  return Math.round((p / d) * 10) / 10;
}

// 업체가 낸 증빙 — limitStateOf 와 같은 칸을 본다(카드 엠블럼과 어긋나지 않게).
export function proofsOf(company = {}) {
  const deposit = company.guarantee_status === "ACTIVE" && num(company.guarantee_amount) > 0;
  return {
    biz: company.verified === true,
    insurance: (company.has_insurance ?? company.hasInsurance ?? company.insurance) === true,
    deposit,
  };
}

export const PROOF_LABEL = { biz: "사업자등록", insurance: "시공보험", deposit: "보증금" };

// 한 업체의 칸 — 표의 세로 한 줄.
export function bidColumn(bid = {}) {
  const company = bid.company ?? {};
  const price = num(bid.price);
  const period = num(bid.period ?? bid.period_days);
  const material = text(bid.material ?? bid.material_note);
  const comment = text(bid.comment);
  const proofs = proofsOf(company);
  return {
    id: bid.id,
    name: text(company.name) || "파트너",
    price, period,
    perDay: perDay(price, period),
    material, comment, proofs,
    proofCount: Object.values(proofs).filter(Boolean).length,
    done: num(company.completedJobs),
    rating: Number(company.rating) > 0 ? Number(company.rating) : null,
    // 고객이 물어봐야 하는 것 — 이 업체가 «안 적은» 칸
    missing: [!period && "공사 기간", !material && "주요 자재", !comment && "업체 한마디"].filter(Boolean),
  };
}

const cell = (value, unit = "") =>
  value == null || value === "" || value === 0
    ? { text: "안 적음", missing: true }
    : { text: `${value}${unit}`, missing: false };

// 표 전체. bids 는 normalizeBid 모양({ id, price, period, material, comment, company }).
export function compareBids(bids = []) {
  const cols = (Array.isArray(bids) ? bids : []).slice(0, MAX_COMPARE).map(bidColumn);
  if (cols.length === 0) return { cols: [], rows: [], spread: null, missingCount: 0, notes: [] };

  const prices = cols.map(c => c.price).filter(Boolean);
  const low = prices.length ? Math.min(...prices) : 0;
  const high = prices.length ? Math.max(...prices) : 0;

  const priceCell = (c) => {
    if (!c.price) return { text: "안 적음", missing: true };
    const gap = low && c.price > low ? c.price - low : 0;
    return {
      text: `${c.price.toLocaleString("ko-KR")}만원`,
      missing: false,
      best: low > 0 && c.price === low && prices.length > 1,
      bestText: "가장 낮음",
      sub: gap ? `+${gap.toLocaleString("ko-KR")}만원` : null,
    };
  };

  const proofCell = (c) => {
    const got = Object.entries(c.proofs).filter(([, v]) => v).map(([k]) => PROOF_LABEL[k]);
    return got.length
      // 「가장 낮음」은 금액 줄에서만 쓰는 말이다 — 증빙 줄에는 증빙 줄의 말을 붙인다
      ? { text: got.join(" · "), missing: false, best: c.proofCount === 3, bestText: "셋 다 냄" }
      : { text: "아직 없음", missing: true };
  };

  const rows = [
    { key: "price",    label: "견적 금액",  cells: cols.map(priceCell) },
    { key: "period",   label: "공사 기간",  cells: cols.map(c => cell(c.period, "일")) },
    { key: "perDay",   label: "하루당",     cells: cols.map(c => cell(c.perDay, "만원")), hint: "금액 ÷ 공사 기간" },
    { key: "material", label: "주요 자재",  cells: cols.map(c => cell(c.material)), wrap: true },
    { key: "proof",    label: "낸 증빙",    cells: cols.map(proofCell) },
    // 0건은 «안 적음»이 아니라 사실이다 — 새 업체를 «뭔가 빠뜨린 업체»처럼 보이게 하지 않는다.
    { key: "done",     label: "완료 공사",  cells: cols.map(c => (c.done ? { text: `${c.done}건`, missing: false } : { text: "아직 없음", missing: false })) },
    { key: "comment",  label: "업체 한마디", cells: cols.map(c => cell(c.comment)), wrap: true },
  ];

  const missingCount = rows.reduce((n, r) => n + r.cells.filter(c => c.missing).length, 0);

  // 안내 — 지어낸 숫자 없이, 고객이 다음에 할 일만.
  const notes = [];
  if (prices.length > 1 && high > low) {
    const gap = high - low;
    const pct = Math.round((gap / low) * 100);
    notes.push(`가장 싼 곳과 비싼 곳이 ${gap.toLocaleString("ko-KR")}만원(${pct}%) 차이예요. 자재와 기간을 같이 보세요.`);
  }
  if (missingCount > 0) notes.push(`안 적힌 칸이 ${missingCount}개 있어요. 상담에서 물어보면 채워집니다.`);
  notes.push("최종 금액은 현장 확인 뒤 견적서에서 확정돼요.");

  return { cols, rows, spread: prices.length > 1 ? { low, high, gap: high - low } : null, missingCount, notes };
}
