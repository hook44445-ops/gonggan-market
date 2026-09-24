// 파트너 카드 등급 — 화면과 떼어 둔 순수 로직(표시 전용, DB 쓰기 없음).
//
// 왜 등급을 나누나
//   업체가 사업자등록증·시공보험·보증금을 «스스로» 내고 싶어져야 한다. 그러려면 낸 만큼
//   카드가 눈에 띄게 좋아져야 한다. 한 모양의 카드에 뱃지만 붙여서는 차이가 안 보인다.
//     기본       — 아무것도 안 냄. 깔끔하지만 수수하다.
//     확인된 업체 — 1~2개. 초록 테두리가 붙는다.
//     프리미엄    — 셋 다. 대표 시공 사진·금테·문장이 붙는다. 한눈에 급이 다르다.
//   의뢰인에게도 거짓이 없다: 프리미엄은 «세 가지를 모두 증빙했다»는 뜻 그대로다.
//
// (확장자까지 적는다 — node --test 로 이 파일만 돌릴 때도 불러올 수 있게)

export const TIERS = {
  basic:    { key: "basic",    rank: 0, label: "기본",         line: "아직 증빙을 내지 않은 업체" },
  verified: { key: "verified", rank: 1, label: "확인된 업체",   line: "증빙 일부를 확인한 업체" },
  premium:  { key: "premium",  rank: 2, label: "프리미엄 파트너", line: "사업자·시공보험·보증금을 모두 증빙한 업체" },
};

// 증빙 셋 — 순서가 곧 화면 순서다.
export const PROOFS = [
  { key: "biz",       label: "사업자",   ask: "사업자등록증" },
  { key: "insurance", label: "시공보험", ask: "시공보험 증권" },
  { key: "deposit",   label: "보증금",   ask: "공간보증 보증금" },
];

// { biz, insurance, deposit } → 등급. 무엇이 빠졌는지도 함께 돌려준다(파트너에게 «다음 한 가지»를 권할 때).
export function partnerTier(state = {}) {
  const have = PROOFS.filter(p => !!state[p.key]);
  const missing = PROOFS.filter(p => !state[p.key]);
  const tier = have.length === PROOFS.length ? TIERS.premium
             : have.length > 0              ? TIERS.verified
             :                                 TIERS.basic;
  return { ...tier, count: have.length, total: PROOFS.length, missing };
}

// 카드 대표 사진 — 업체마다 사진이 담긴 모양이 달라 여러 길을 차례로 본다. 없으면 null.
export function coverOf(company = {}) {
  if (company.cover) return company.cover;
  if (company.cover_image) return company.cover_image;
  const items = Array.isArray(company.portfolio) ? company.portfolio : [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const pick =
      (Array.isArray(it.afterPhotos) && it.afterPhotos[0]) ||
      it.after || it.after_url || it.image || it.image_url ||
      (Array.isArray(it.photos) && it.photos[0]) ||
      (Array.isArray(it.images) && it.images[0]);
    if (pick) return pick;
  }
  return null;
}

// 비교 줄 — 모든 카드가 같은 자리에 같은 순서로 숫자를 보인다(그래야 «비교»가 된다).
export function compareStats(company = {}) {
  const h = Number(company.avgResponseHours) || 0;
  const response = h > 0 ? (h < 1 ? `${Math.round(h * 60)}분` : `${Math.round(h)}시간`) : "—";
  const rating = Number(company.rating) > 0 ? Number(company.rating).toFixed(1) : "—";
  return [
    { key: "done",     label: "완료",  value: `${Number(company.completedJobs) || 0}`, unit: "건" },
    { key: "rating",   label: "평점",  value: rating, unit: "" },
    { key: "response", label: "응답",  value: response, unit: "" },
    { key: "dispute",  label: "분쟁",  value: `${Number(company.disputeRate) || 0}`, unit: "%" },
  ];
}

// ════════════════════════════════════════════════════════════════════
// 1건 최대 공사 금액(수주 한도) — 안전안 (2026-09-24 제안 · 숫자는 대표 확정 전 기본값)
//
//   원칙: 공사가 클수록 의뢰인이 맡기는 돈이 커진다 → 업체가 걸어 둔 안전장치도 커져야 한다.
//
//   사업자 없음(개인 기술자)
//     가입만                          300만원   — 도배·부분 수리. 입구는 열어 둔다
//     + 시공보험 또는 보증금            500만원   — 그 이상은 사업자등록을 해야 열린다(프리미엄 불가)
//   사업자 있음
//     사업자등록(관리자 확인)           500만원
//     + 시공보험(증권 승인)           1,000만원
//     + 보증금 = 프리미엄             보증금 × 10, 1,500만원 미만까지
//     + 실내건축공사업 등록(면허)      보증금 × 10, 최대 1억원
//
//   보증금 × 10 — 보증금이 «가장 큰 공사의 계약금(10%)»과 같아진다. 업체가 계약금만 받고
//   사라져도 보증금으로 돌려줄 수 있다는 계산이다.
//   1,500만원 — 면허 없이 할 수 있는 실내건축 공사의 법정 상한(건설산업기본법 «경미한 공사»)으로
//   알려진 값. ⚠ 법무 확인이 필요하다. 다르면 UNLICENSED_CEILING 하나만 바꾼다.
//   숫자는 여기 한 곳에서만 바꾼다(서버 트리거 101 도 같은 숫자를 쓴다).
// ════════════════════════════════════════════════════════════════════
export const LIMITS = {
  NONE:               300,    // 가입만
  NO_BIZ_BACKED:      500,    // 사업자 없음 + 시공보험 또는 보증금
  BIZ:                500,    // 사업자 확인
  BIZ_INSURED:       1000,    // 사업자 + 시공보험
  UNLICENSED_CEILING: 1499,   // 면허 없이: 1,500만원 «미만»
  MAX:              10000,    // 1억원
};
export const DEPOSIT_MULTIPLIER = 10;

// { biz, insurance, depositManwon, license } → 1건 최대 금액(만원)
export function bidLimit({ biz = false, insurance = false, depositManwon = 0, license = false } = {}) {
  const dep = Math.max(0, Number(depositManwon) || 0);
  if (!biz) return (insurance || dep > 0) ? LIMITS.NO_BIZ_BACKED : LIMITS.NONE;
  let cap = insurance ? LIMITS.BIZ_INSURED : LIMITS.BIZ;
  if (insurance && dep > 0) {
    const ceiling = license ? LIMITS.MAX : LIMITS.UNLICENSED_CEILING;
    cap = Math.max(cap, Math.min(dep * DEPOSIT_MULTIPLIER, ceiling));
  }
  return cap;
}

// 화면에 쓰는 금액 글자 — 1,499 는 「1,500만원 미만」으로 읽힌다.
export function limitText(manwon) {
  const n = Number(manwon) || 0;
  if (n === LIMITS.UNLICENSED_CEILING) return "1,500만원 미만";
  if (n >= 10000) return `${(n / 10000).toLocaleString("ko-KR")}억원`;
  return `${n.toLocaleString("ko-KR")}만원`;
}

// 다음 한 가지 — 지금 상태에서 «하나만 더 내면» 한도가 얼마가 되는지. 업체 화면·가입 완료 화면이 쓴다.
export function nextUnlock(state = {}) {
  const s = { biz: false, insurance: false, depositManwon: 0, license: false, ...state };
  const now = bidLimit(s);
  const tries = [
    !s.biz       && { key: "biz",       ask: "사업자등록증",           next: { ...s, biz: true } },
    s.biz && !s.insurance && { key: "insurance", ask: "시공보험 증권",   next: { ...s, insurance: true } },
    s.biz && s.insurance && !(s.depositManwon > 0) && { key: "deposit", ask: "공간보증 보증금", next: { ...s, depositManwon: 150 } },
    s.biz && s.insurance && s.depositManwon > 0 && !s.license && { key: "license", ask: "실내건축공사업 등록증", next: { ...s, license: true } },
  ].filter(Boolean);
  for (const t of tries) {
    const after = bidLimit(t.next);
    if (after > now) return { key: t.key, ask: t.ask, from: now, to: after };
  }
  return null;
}

// 입찰 금액이 한도를 넘을 때 — 무엇을 내면 이 공사에 입찰할 수 있는지(없으면 null = 이미 가능).
export function unlockFor(amountManwon, state = {}) {
  const amt = Number(amountManwon) || 0;
  const s = { biz: false, insurance: false, depositManwon: 0, license: false, ...state };
  if (amt <= bidLimit(s)) return null;
  const need = [];
  if (!s.biz && amt > LIMITS.NO_BIZ_BACKED) need.push("사업자등록증");
  else if (!s.biz) need.push("시공보험 증권 또는 보증금");
  const bizOk = s.biz || need.includes("사업자등록증");
  if (bizOk && amt > LIMITS.BIZ && !s.insurance) need.push("시공보험 증권");
  if (amt > LIMITS.BIZ_INSURED) {
    const depNeed = Math.ceil(amt / DEPOSIT_MULTIPLIER);
    if (s.depositManwon < depNeed) need.push(`보증금 ${depNeed.toLocaleString("ko-KR")}만원 이상`);
  }
  if (amt > LIMITS.UNLICENSED_CEILING && !s.license) need.push("실내건축공사업 등록증");
  if (amt > LIMITS.MAX) return { need: [], over: true };
  return { need, over: false };
}

// 계단 — 가입 완료 화면·업체 화면이 그대로 그린다. 금액은 bidLimit 에서 뽑는다(숫자를 두 번 적지 않는다).
export const LADDER = [
  { key: "none",      label: "가입만",                     note: "도배·부분 수리",     state: {} },
  { key: "biz",       label: "사업자등록증",               note: "관리자 확인",        state: { biz: true } },
  { key: "insurance", label: "+ 시공보험",                 note: "증권 승인",          state: { biz: true, insurance: true } },
  { key: "deposit",   label: "+ 보증금 · 프리미엄 파트너", note: "보증금 × 10",        state: { biz: true, insurance: true, depositManwon: 150 } },
  { key: "license",   label: "+ 실내건축공사업 등록증",    note: "대형 공사",          state: { biz: true, insurance: true, depositManwon: 1000, license: true } },
].map(r => ({ ...r, limit: bidLimit(r.state) }));
