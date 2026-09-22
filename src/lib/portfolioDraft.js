// 공사 진행 사진 → 시공 사례(포트폴리오) 초안 — 순수 함수(네트워크 0).
//
// 왜: 파트너는 공사 중 단계마다 사진을 올린다(phase_photos · 착공/중간/완료). 그런데 시공 사례는
// 따로 다시 올려야 해서, 실제 공사가 끝나도 업체 프로필과 의뢰인 홈의 «시공 사례»가 비어 있었다.
// 끝난 공사의 사진을 그대로 옮겨 초안을 만들고, 파트너가 확인·수정한 뒤 저장한다(자동 공개 아님).
//
// phase_photos.step 은 EscrowScreen 의 단계 표와 같다: 착공 확인=2 · 중간=3 · 완료 확인=4.
// 이미 만든 사례인지는 portfolios.contract_id(100_portfolios.sql)로, 없으면 «완료 사진 URL이 사례 사진에 있는가»로 가른다.

export const PHOTO_STEP = { start: 2, mid: 3, done: 4 };
const MAX_PHOTOS = 8; // PortfolioManagePanel 과 같은 상한

const urls = (rows, step) =>
  (rows ?? [])
    .filter((r) => r && Number(r.step) === step)
    .flatMap((r) => (Array.isArray(r.photos) ? r.photos : []))
    .filter(Boolean)
    .filter((u, i, a) => a.indexOf(u) === i);

/** 계약 하나 → 초안. 완료 사진이 없으면 null(시공 후 사진 없는 사례는 누르면 빈 화면이 된다). */
export function draftFromContract(contract, photoRows) {
  const after = urls(photoRows, PHOTO_STEP.done).slice(0, MAX_PHOTOS);
  if (after.length === 0) return null;
  const before = urls(photoRows, PHOTO_STEP.start).slice(0, MAX_PHOTOS);
  const req = contract?.requests ?? {};
  const space = req.space_type || req.type || null;
  const total = Number(contract?.total_amount);
  return {
    title: [req.size, space].filter(Boolean).join(" ") + (space || req.size ? " 시공" : "시공 사례"),
    space_type: space,
    area: req.area ?? null,
    size: req.size ?? null,
    budget: Number.isFinite(total) && total > 0 ? Math.round(total / 10000) : null, // 만원
    desc: "",
    tags: [],
    before_photos: before,
    after_photos: after,
  };
}

/** 완료 사진이 있고 아직 사례로 안 만든 계약만 → [{ contract, draft }] (최근 순서 유지). */
export function contractsReadyForShowcase({ contracts = [], photoRows = [], portfolios = [] } = {}) {
  const used = new Set(
    (portfolios ?? []).flatMap((p) => [...(p?.after_photos ?? []), ...(p?.before_photos ?? [])]).filter(Boolean),
  );
  const usedContracts = new Set((portfolios ?? []).map((p) => p?.contract_id).filter(Boolean));
  const byContract = new Map();
  for (const r of photoRows ?? []) {
    if (!r?.contract_id) continue;
    if (!byContract.has(r.contract_id)) byContract.set(r.contract_id, []);
    byContract.get(r.contract_id).push(r);
  }
  const out = [];
  for (const c of contracts ?? []) {
    const draft = draftFromContract(c, byContract.get(c?.id) ?? []);
    if (!draft) continue;
    if (usedContracts.has(c.id)) continue;                      // 이 공사로 만든 사례가 있다(contract_id)
    if (draft.after_photos.some((u) => used.has(u))) continue; // 사진이 이미 다른 사례에 쓰였다
    out.push({ contract: c, draft });
  }
  return out;
}
