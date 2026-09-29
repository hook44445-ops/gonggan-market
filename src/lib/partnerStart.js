// 파트너 시작 체크리스트(09-28) — 새 업체(1인 파트너·대표 직영 포함)가 «믿고 부를 업체»가 되기까지 여덟 칸.
//   순서 = 고객이 업체를 믿는 순서: 서류(사업자·보험) → 내 페이지 주소 → 페이지 꾸미기(154) → 첫 사례 → 첫 후기 → 알리기.
//   값은 모두 이미 있는 데이터(companies · 파트너 성장 집계 · 151 밖 공사 후기 · 기기 기록)에서만 — 새 저장 없음.

export const PARTNER_STEPS = [
  { key: "biz",       label: "사업자등록 확인",    hint: "사업자등록증을 올리면 관리자가 확인해요 · 입찰이 열려요", action: "documents" },
  { key: "insurance", label: "시공보험 확인",      hint: "보험 증권을 올리면 «시공보험» 엠블럼이 붙어요",          action: "documents" },
  { key: "slug",      label: "내 업체 주소 만들기", hint: "명함·인스타에 넣을 짧은 주소(/p/…)",                   action: "slug" },
  { key: "profile",   label: "커버 사진·소개글 올리기", hint: "링크를 연 고객이 가장 먼저 보는 곳이에요",           action: "profile" },
  { key: "showcase",  label: "첫 시공 사례 올리기", hint: "전·후 사진 한 쌍이면 페이지가 살아나요",                 action: "portfolio" },
  { key: "review",    label: "첫 후기 받기",       hint: "지인 공사도 «공간마켓 밖 공사 후기»로 받을 수 있어요",     action: "askReview" },
  { key: "share",     label: "내 업체 페이지 알리기", hint: "블로그·인스타·카톡에 주소를 걸어요",                    action: "sharePage" },
  { key: "qr",        label: "명함·전단 QR 저장",   hint: "명함·현장 안내문에 붙이면 폰 카메라로 바로 내 페이지",     action: "qr" },
];

// company: companies 행 · growth: { showcases, reviews } · extReviews: 밖 공사 후기 수 · shared: 기기에 공유 기록
export function partnerStartState({ company = {}, growth = null, extReviews = 0, shared = false, qrSaved = false } = {}) {
  const done = {
    biz: company.verified === true,
    insurance: (company.has_insurance ?? company.hasInsurance) === true,
    slug: !!company.slug,
    profile: !!company.cover_url && !!String(company.intro ?? "").trim(),
    showcase: Number(growth?.showcases ?? 0) > 0,
    review: Number(growth?.reviews ?? 0) + Number(extReviews ?? 0) > 0,
    share: !!shared,
    qr: !!qrSaved,
  };
  const items = PARTNER_STEPS.map(s => ({ ...s, done: done[s.key] }));
  const count = items.filter(i => i.done).length;
  return { items, count, total: items.length, next: items.find(i => !i.done) ?? null, complete: count === items.length };
}

const sharedKey = (companyId) => `gonggan_page_shared:${companyId}`;
export function markPageShared(companyId) {
  if (!companyId) return;
  try { localStorage.setItem(sharedKey(companyId), "1"); } catch { /* noop */ }
}
export function wasPageShared(companyId) {
  if (!companyId) return false;
  try { return localStorage.getItem(sharedKey(companyId)) === "1"; } catch { return false; }
}

const qrKey = (companyId) => `gonggan_qr_saved:${companyId}`;
export function markQrSaved(companyId) {
  if (!companyId) return;
  try { localStorage.setItem(qrKey(companyId), "1"); } catch { /* noop */ }
}
export function wasQrSaved(companyId) {
  if (!companyId) return false;
  try { return localStorage.getItem(qrKey(companyId)) === "1"; } catch { return false; }
}
