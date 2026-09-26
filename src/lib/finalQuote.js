// 파트너 최종 견적서(현장 방문 뒤) — 화면과 분리한 순수 로직.
// 왜: 한 장에 15칸이 늘어서 있어 현장에서 폰으로 쓰기 어려웠고, 임시저장 뒤 다시 열면
//     공정·기간·메모가 비어 보였다(사진만 복원). 저장 payload 모양은 그대로 두고 표시·복원만 돕는다.

export const QUOTE_STEPS = [
  { id: 1, label: "공정·금액" },
  { id: 2, label: "기간·사진" },
  { id: 3, label: "확인·전송" },
];

// 의뢰인이 요청서에서 고른 공사 태그(요청 설명에 들어간다) → 파트너 공정 칩 순서의 앞쪽.
const REQUEST_TAGS = ["철거", "도배", "바닥", "필름", "욕실", "주방", "타일", "페인트", "조명·전기", "창호",
  "중문", "도어", "몰딩", "붙박이장·가구", "방수", "누수·배관", "줄눈", "탄성코트", "발코니 확장", "단열", "블라인드·커튼",
  "매입등", "간접조명", "펜던트", "레일조명", "스마트 조명"];   // 요청서 «조명: …» 세부(09-26)
// 요청 태그와 무관하게 대부분 견적에 들어가는 공정.
// 09-26: «조명»을 기본에 — 예전엔 «전기»뿐이라 조명 기구·설치가 견적서에서 빠지기 쉬웠다.
const BASE_TRADES = ["철거", "목공", "전기", "조명", "설비", "타일", "도장", "도배", "바닥", "가구", "준공 청소"];

export const DURATION_PRESETS = [3, 7, 14, 30];
export const WARRANTY_PRESETS = ["완료 후 1년 무상 A/S", "누수·방수 2년", "자재는 제조사 보증 기준"];

const emptyItem = (seed = 0) => ({ id: `it-${Date.now()}-${seed}-${Math.random().toString(36).slice(2, 6)}`, name: "", material: "", qty: "", unitPrice: "" });
export const makeEmptyItem = emptyItem;

// 요청 설명·공간 유형에서 이 현장에 맞는 공정 칩을 뽑는다(요청에 있던 것 먼저, 최대 12개).
export function suggestTrades(request = {}) {
  const hay = [request.description, request.desc, request.detail, request.space_type].filter(Boolean).join(" ");
  const fromRequest = REQUEST_TAGS.filter(t => hay.includes(t) || t.split("·").some(p => p.length > 1 && hay.includes(p)));
  // «조명·전기»가 이미 있으면 기본 «전기»는 뺀다(같은 공정 두 칩 방지).
  const base = BASE_TRADES.filter(b => !fromRequest.some(t => t.split("·").includes(b)));
  return [...new Set([...fromRequest, ...base])].slice(0, 12);
}

// 칩을 누르면: 이름이 빈 첫 줄에 채우고, 빈 줄이 없으면 새 줄(최대 10줄). 이미 있는 공정이면 그대로.
export function applyTrade(items, name, max = 10) {
  if (items.some(it => it.name.trim() === name)) return items;
  const i = items.findIndex(it => !it.name.trim());
  if (i >= 0) return items.map((it, k) => (k === i ? { ...it, name } : it));
  if (items.length >= max) return items;
  return [...items, { ...emptyItem(items.length), name }];
}

// 저장된 견적(estimates 행) → 폼 상태. 없으면 빈 줄 3개.
export function restoreQuote(estimate) {
  const rows = Array.isArray(estimate?.items) ? estimate.items : [];
  const items = rows.length
    ? rows.map((r, i) => ({ ...emptyItem(i), name: r.name ?? "", material: r.material ?? "",
        qty: r.qty ? String(r.qty) : "", unitPrice: (r.unit_price ?? r.unitPrice) ? String(r.unit_price ?? r.unitPrice) : "" }))
    : [emptyItem(0), emptyItem(1), emptyItem(2)];
  return {
    items,
    durationDays: estimate?.duration_days ? String(estimate.duration_days) : "",
    note: estimate?.note ?? "",
    warrantyNote: estimate?.warranty_note ?? "",
  };
}

export const itemAmount = (it) => (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
export const quoteTotal = (items) => items.reduce((s, it) => s + itemAmount(it), 0);

// 빈 줄(아무것도 안 쓴 줄)은 제출 검사에서 빼고, 반쯤 쓴 줄만 막는다.
export const filledItems = (items) => items.filter(it => it.name.trim() || it.material.trim() || it.qty || it.unitPrice);

// 단계별로 «다음»을 막는 이유(없으면 null).
export function stepBlocker(step, { items = [], durationDays = "" } = {}) {
  if (step === 1) {
    const rows = filledItems(items);
    if (rows.length === 0) return "공정을 한 줄 이상 적어 주세요";
    const bad = rows.findIndex(it => !it.name.trim() || !(Number(it.qty) > 0) || !(Number(it.unitPrice) > 0));
    if (bad >= 0) return `${bad + 1}번째 공정의 이름·수량·단가를 채워 주세요`;
    return null;
  }
  if (step === 2) {
    if (!(Number(durationDays) > 0)) return "공사 기간을 골라 주세요";
    return null;
  }
  return null;
}
