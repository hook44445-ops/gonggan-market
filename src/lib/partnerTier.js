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
