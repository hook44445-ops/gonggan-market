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
  premium:  { key: "premium",  rank: 2, label: "프리미엄 파트너", line: "사업자·시공보험·보증금을 모두 확인해 1,000만원이 넘는 공사도 맡는 업체" },
};

// 증빙 셋 — 순서가 곧 화면 순서다.
export const PROOFS = [
  { key: "biz",       label: "사업자",   ask: "사업자등록증" },
  { key: "insurance", label: "시공보험", ask: "시공보험 증권" },
  { key: "deposit",   label: "보증금",   ask: "공간보증 보증금" },
];

// { biz, insurance, deposit } → 등급. 무엇이 빠졌는지도 함께 돌려준다(파트너에게 «다음 한 가지»를 권할 때).
// 프리미엄 파트너 = 1,000만원이 넘는 공사를 받을 수 있는 업체(대표: 「1,000만원까지는 사업자 + 시공보험,
// 그 이상은 보증금 · 프리미엄 파트너」). 셋을 다 냈어도 보증금이 한도를 못 올리는 등급(베이직 50·스탠다드 100)이면
// 확인된 업체에 둔다 — 카드는 금테인데 1,000만원 넘는 공사에 입찰할 수 없는 일이 없게.
// depositManwon 이 없으면(예전 호출) 예전처럼 셋이면 프리미엄.
export function partnerTier(state = {}) {
  const have = PROOFS.filter(p => !!state[p.key]);
  const depOk = state.depositManwon == null || Number(state.depositManwon) * DEPOSIT_MULTIPLIER > LIMITS.BIZ_BACKED;
  const missing = PROOFS.filter(p => !state[p.key]);
  const tier = have.length === PROOFS.length && depOk ? TIERS.premium
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
// 1건 최대 공사 금액(수주 한도) — 안전안 (2026-09-24)
//
//   원칙: 공사가 클수록 의뢰인이 맡기는 돈이 커진다 → 업체가 걸어 둔 안전장치도 커져야 한다.
//
//   사업자 없음(개인 기술자)
//     가입만                            300만원   — 도배·부분 수리. 입구는 열어 둔다
//     + 시공보험 또는 보증금              500만원   — 그 이상은 사업자등록을 해야 열린다(프리미엄 불가)
//   사업자 있음
//     사업자등록(관리자 확인)             500만원
//     + 시공보험(증권 승인)            1,000만원
//       또는 보험 없이 보증금 20%       보증금 × 5, 1,000만원까지 (1,000만원이면 200만원)
//                                                    이 구간의 대표 공사가 욕실·주방 — 배관·전기가 들어간다.
//                                                    진짜 위험은 공사 사고(아랫집 누수·화재)이고 그건 보험만 막는다.
//                                                    그래서 보험이 없으면 보증금을 두 배(20%)로 건다(대표 확정).
//                                                    보험 없는 길은 1,000만원에서 멈춘다 — 그 위는 보험 필수.
//     + 시공보험 + 보증금 10% = 프리미엄 보증금 × 10, 1,500만원 미만까지
//     + 실내건축공사업 등록(면허)        보증금 × 10, 최대 1억원
//
//   보증금 = 공사 금액의 10%(시공보험 있음) / 20%(없음) — 대표 확정 2026-09-24.
//   10% 는 «가장 큰 공사의 계약금»과 같다: 업체가 계약금만 받고 사라져도 보증금으로 돌려줄 수 있다.
//   1,500만원 — 면허 없이 할 수 있는 실내건축 공사의 법정 상한(건설산업기본법 «경미한 공사»)으로
//   알려진 값. ⚠ 법무 확인이 필요하다. 다르면 UNLICENSED_CEILING 하나만 바꾼다.
//   숫자는 여기 한 곳에서만 바꾼다(서버 트리거 101 도 같은 숫자를 쓴다).
// ════════════════════════════════════════════════════════════════════
export const LIMITS = {
  NONE:               300,    // 가입만
  NO_BIZ_BACKED:      500,    // 사업자 없음 + 시공보험 또는 보증금
  BIZ:                500,    // 사업자 확인
  BIZ_BACKED:        1000,    // 사업자 + (시공보험 또는 보증금 20%)
  UNLICENSED_CEILING: 1499,   // 면허 없이: 1,500만원 «미만»
  MAX:              10000,    // 1억원
};
export const DEPOSIT_RATE_INSURED   = 0.10;   // 시공보험 있음
export const DEPOSIT_RATE_UNINSURED = 0.20;   // 시공보험 없음 — 사고를 막아 줄 보험이 없으니 두 배를 건다
export const DEPOSIT_MULTIPLIER = 10;          // 1 / 10%
const UNINSURED_MULTIPLIER = 5;                // 1 / 20%

// { biz, insurance, depositManwon, license } → 1건 최대 금액(만원)
export function bidLimit({ biz = false, insurance = false, depositManwon = 0, license = false } = {}) {
  const dep = Math.max(0, Number(depositManwon) || 0);
  if (!biz) return (insurance || dep > 0) ? LIMITS.NO_BIZ_BACKED : LIMITS.NONE;
  if (!insurance) {
    // 보험 없이 보증금 20% — 1,000만원까지만. 그 위는 보험 필수.
    return dep > 0 ? Math.max(LIMITS.BIZ, Math.min(dep * UNINSURED_MULTIPLIER, LIMITS.BIZ_BACKED)) : LIMITS.BIZ;
  }
  let cap = LIMITS.BIZ_BACKED;
  if (dep > 0) {
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

// 대표 2026-09-24: 「1안 위주, 2안은 문의 시」 — 화면은 1안(시공보험 → 1,000만원, 초과부터 보험 + 보증금 10%)
// 하나만 말한다. 2안(보험 없이 보증금 20%)과 사업자 없이 보험·보증금으로 500만원 가는 길은 계산에만 남긴다 —
// 문의한 업체의 보증금을 관리자가 승인하면 그대로 반영되지만, 안내 문구에는 나오지 않는다(기본 규정이 헷갈리지 않게).
// 다음 한 가지 — 지금 상태에서 «하나만 더 내면» 한도가 얼마가 되는지. 업체 화면·가입 완료 화면이 쓴다.
export function nextUnlock(state = {}) {
  const s = { biz: false, insurance: false, depositManwon: 0, license: false, ...state };
  const dep = Number(s.depositManwon) || 0;
  const now = bidLimit(s);
  const tries = [
    !s.biz && { key: "biz", ask: "사업자등록증", next: { ...s, biz: true } },
    s.biz && !s.insurance &&
      { key: "insurance", ask: "시공보험 증권", next: { ...s, insurance: true } },
    // 보증금이 없거나, 걸었어도 한도를 못 올리는 베이직(50)·스탠다드(100)면 — 등급은 정해진 금액뿐이라
    // 한도를 올리는 첫 등급(프리미엄 200만원)을 콕 집어 말한다.
    s.biz && s.insurance && dep * DEPOSIT_MULTIPLIER <= LIMITS.BIZ_BACKED &&
      { key: "premium", ask: "공간보증 200만원(프리미엄 등급)", next: { ...s, depositManwon: 200 } },
    s.biz && s.insurance && dep * DEPOSIT_MULTIPLIER > LIMITS.BIZ_BACKED && !s.license &&
      { key: "license", ask: "실내건축공사업 등록증", next: { ...s, license: true } },
  ].filter(Boolean);
  for (const t of tries) {
    const after = bidLimit(t.next);
    if (after > now) return { key: t.key, ask: t.ask, from: now, to: after };
  }
  return null;
}

// 공간보증은 정해진 다섯 등급뿐이다(constants/guarantee.js). 필요한 보증금을 «걸 수 있는» 가장 가까운 등급으로 올려
// 말한다 — 「보증금 120만원 이상」은 걸 수 없는 금액이라 헷갈렸다.
const GUARANTEE_STEPS = [[50, "베이직"], [100, "스탠다드"], [200, "프리미엄"], [500, "마스터"], [1000, "시그니처"]];
export function guaranteeAsk(needManwon) {
  const hit = GUARANTEE_STEPS.find(([amt]) => amt >= needManwon);
  return hit ? `공간보증 ${hit[1]}(${hit[0].toLocaleString("ko-KR")}만원)` : `공간보증 ${needManwon.toLocaleString("ko-KR")}만원`;
}

// 입찰 금액이 한도를 넘을 때 — 무엇을 내면 이 공사에 입찰할 수 있는지(null = 이미 가능).
export function unlockFor(amountManwon, state = {}) {
  const amt = Number(amountManwon) || 0;
  const s = { biz: false, insurance: false, depositManwon: 0, license: false, ...state };
  if (amt <= bidLimit(s)) return null;
  if (amt > LIMITS.MAX) return { need: [], over: true };
  const dep = Number(s.depositManwon) || 0;
  const depNeed = Math.ceil(amt / DEPOSIT_MULTIPLIER);
  // 300~500 — 사업자 없이도 된다. 셋 중 하나면 된다.
  if (amt <= LIMITS.NO_BIZ_BACKED) return { need: ["사업자등록증"], over: false };
  const need = [];
  if (!s.biz) need.push("사업자등록증");
  if (amt <= LIMITS.BIZ_BACKED) {
    // 500~1,000 — 시공보험, 또는 보험 없이 보증금 20%
    if (!s.insurance) need.push("시공보험 증권");
    return { need, over: false };
  }
  if (!s.insurance) need.push("시공보험 증권");
  if (dep < depNeed) need.push(guaranteeAsk(depNeed));
  if (amt > LIMITS.UNLICENSED_CEILING && !s.license) need.push("실내건축공사업 등록증");
  return { need, over: false };
}

// 한 문장으로 — 「이 공사는 ○○을/를 내면 입찰할 수 있어요」. 조사를 받침에 맞춘다.
const hasBatchim = (ch) => { const c = (ch || "").charCodeAt(0) - 0xAC00; return c >= 0 && c <= 11171 && c % 28 !== 0; };
export function unlockMessage(u) {
  if (!u) return null;
  if (u.over) return "공간마켓에서는 공사 1건 1억원까지 입찰할 수 있어요";
  const text = u.need.join(" + ");
  return `이 공사는 ${text}${hasBatchim(text.trim().slice(-1)) ? "을" : "를"} 내면 입찰할 수 있어요`;
}

// 계단 — 가입 완료 화면·업체 화면이 그대로 그린다. 금액은 bidLimit 에서 뽑는다(숫자를 두 번 적지 않는다).
export const LADDER = [
  { key: "none",    label: "가입만",                        note: "도배·부분 수리",  state: {} },
  { key: "biz",     label: "사업자등록증",                  note: "관리자 확인",     state: { biz: true } },
  { key: "insurance", label: "+ 시공보험",                  note: "관리자 확인", state: { biz: true, insurance: true } },
  { key: "premium", label: "+ 보증금 · 프리미엄 파트너",    note: "1,000만원 초과부터 · 보증금 10%", state: { biz: true, insurance: true, depositManwon: 150 } },
  { key: "license", label: "+ 실내건축공사업 등록증",       note: "대형 공사",       state: { biz: true, insurance: true, depositManwon: 1000, license: true } },
].map(r => ({ ...r, limit: bidLimit(r.state) }));

// 지금 계단 어느 칸인지 — «낸 증빙»으로 정한다. 금액으로 찾으면(한도 ≥ 칸 금액) 면허 칸(기준 1억)에
// 보증금이 적은 면허 업체가 닿지 못해 「면허 안 냄」처럼 보였다.
export function ladderKeyOf(state = {}) {
  const dep = Number(state.depositManwon) || 0;
  // 프리미엄·면허 칸은 «보증금이 실제로 한도를 1,000만원 위로 올렸을 때»만. 공간보증 베이직(50)·스탠다드(100)는
  // 보증금 × 10 이 1,000 을 넘지 못해 한도가 그대로인데, 예전엔 보증금만 있으면 프리미엄 칸으로 올려
  // 위 카드(1,000만원)와 계단 칸(1,500만원 미만)이 한 화면에서 서로 다른 말을 했다.
  const raised = state.biz && state.insurance && dep * DEPOSIT_MULTIPLIER > LIMITS.BIZ_BACKED;
  if (raised && state.license) return "license";
  if (raised) return "premium";
  // 보험 대신 보증금 20% 도 «한도를 실제로 올렸을 때»만(× 5 가 500 을 넘을 때 — 공간보증 200만원부터).
  if (state.biz && (state.insurance || dep * UNINSURED_MULTIPLIER > LIMITS.BIZ)) return "insurance";
  if (state.biz) return "biz";
  return "none";
}

// 더 낼 서류가 없을 때의 한 줄 — 최고 한도가 아니면 «보증금을 늘리면 커진다»고 말한다.
// (다음 서류가 없다는 것과 가장 큰 공사까지 된다는 것은 다르다.)
export function maxedText(state = {}) {
  return bidLimit(state) >= LIMITS.MAX
    ? "가장 큰 공사까지 받을 수 있어요"
    : `보증금을 늘리면 보증금의 ${DEPOSIT_MULTIPLIER}배, 최대 ${limitText(LIMITS.MAX)}까지 커져요`;
}

// 업체 정보 → 한도 계산 입력. 전부 «관리자가 확인한 값»만 본다(스스로 켠 값·결제 없이 적힌 badge 는 보지 않는다).
//   biz       companies.verified — 관리자가 업체를 승인할 때만 켜진다
//   insurance companies.has_insurance — 보험 증권 승인 때 켜진다
//   deposit   공간보증(068) ACTIVE 일 때의 예치금 — guarantee_amount, 없으면 등급 금액
//   license   companies.license_verified — 실내건축공사업 등록증 승인(마이그레이션 101)
// 등급 금액은 constants/guarantee.js GUARANTEE_GRADES.amount 와 같다(= 한도의 10%).
const GRADE_DEPOSIT = { BASIC: 50, STANDARD: 100, PREMIUM: 200, MASTER: 500, SIGNATURE: 1000 };

export function limitStateOf(company = {}) {
  const active = company.guarantee_status === "ACTIVE";
  const amount = Number(company.guarantee_amount) || GRADE_DEPOSIT[company.guarantee_grade] || 0;
  return {
    biz: company.verified === true,
    insurance: (company.has_insurance ?? company.hasInsurance ?? company.insurance) === true,
    depositManwon: active ? amount : 0,
    license: company.license_verified === true,
  };
}

// 카드 한 장의 «다음 한 가지» — 입찰 카드·입찰 폼이 같은 문장을 보인다(대표 2026-09-24:
// 「입찰 카드는 보이되 사업자·시공보험을 내도록 유도, 1,000만원 이상 카드는 보증금을 내도록 안내」).
// 서류를 안 내는 이유는 대개 귀찮아서다 → 막지 않고, 이 카드에서 «내면 무엇이 되는지»를 한 줄로.
//   1) 이 공사가 내 한도 밖  → 무엇을 내면 이 공사에 입찰할 수 있는지(1,000만원 초과면 보증금이 여기서 나온다)
//   2) 한도 안 · 사업자 없음 → 선택돼도 계약은 사업자 확인 뒤(A안) — 미리 올려 두면 바로 계약
//   3) 사업자 있음 · 보험 없음 → 시공보험을 내면 한도가 커진다
//   null = 더 권할 것 없음
export function cardNudge(budgetManwon, state = {}) {
  const s = { biz: false, insurance: false, depositManwon: 0, license: false, ...state };
  const amt = Number(budgetManwon) || 0;
  const u = amt > 0 ? unlockFor(amt, s) : null;
  if (u) return { key: "unlock", text: unlockMessage(u), cta: u.over ? null : "서류 올리기" };
  if (!s.biz) return { key: "biz", text: "선택되면 계약은 사업자등록증 확인 뒤에 해요 — 미리 올려 두면 선택되자마자 계약돼요(홈택스 당일 발급)", cta: "사업자등록증 올리기" };
  if (!s.insurance) {
    const next = bidLimit({ ...s, insurance: true });
    if (next > bidLimit(s)) return { key: "insurance", text: `시공보험 증권을 올리면 ${limitText(next)} 공사까지 입찰할 수 있어요`, cta: "시공보험 올리기" };
  }
  return null;
}
