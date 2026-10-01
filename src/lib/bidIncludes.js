// 견적 «포함 항목» — 본질 ②(2026-10-01 · docs/USP-2026-10-01.md 5절).
//
// 왜: 인테리어에서 가장 많이 다투는 건 «나중에 붙는 추가금»이다. 입찰 금액만 보면
//     부가세·철거·폐기물·자재비가 어떤 업체엔 들어 있고 어떤 업체엔 빠져 있어서,
//     싼 견적이 계약 때 비싸진다. 업체가 입찰할 때 항목마다 «포함 / 별도»를 누르게 하고,
//     고객 비교표에 한 줄로 보여 준다.
//
// 지키는 것
//   1) 업체를 막지 않는다 — 안 눌러도 입찰은 된다. 대신 고객 표에 «안 적음»이 그대로 보인다.
//   2) «별도»는 나쁜 게 아니다(정직하게 적은 것). 다만 고객이 «계약 때 물어볼 것»으로 짚어 준다.
//   3) 없는 금액을 지어내지 않는다 — 별도 항목이 얼마인지는 말하지 않는다.
//
// 저장 모양(bids.includes · SQL 186): { vat: true|false, demolition: …, waste: …, material: …, as_months: 0|6|12|24 }
//   true = 포함 · false = 별도 · 칸이 없으면 = 안 적음. as_months: 0 = AS 없음.
// 순수 JS — React·DOM 없음.

export const INCLUDE_ITEMS = [
  { key: "vat",        label: "부가세" },
  { key: "demolition", label: "철거" },
  { key: "waste",      label: "폐기물 처리" },
  { key: "material",   label: "자재비" },
];

export const AS_OPTIONS = [0, 6, 12, 24];   // 개월 · 0 = 없음

// 아무 값이나 받아 저장 모양으로 — 모르는 칸·이상한 값은 버린다(«안 적음»으로 남긴다)
export function normalizeIncludes(raw) {
  let v = raw;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { v = null; } }
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out = {};
  for (const { key } of INCLUDE_ITEMS) if (typeof v[key] === "boolean") out[key] = v[key];
  const as = Number(v.as_months);
  if (v.as_months !== undefined && v.as_months !== null && AS_OPTIONS.includes(as)) out.as_months = as;
  return out;
}

export const hasIncludes = (raw) => Object.keys(normalizeIncludes(raw)).length > 0;

// 항목별 상태 — "in"(포함) · "out"(별도) · "none"(안 적음)
export function includeState(raw, key) {
  const v = normalizeIncludes(raw)[key];
  return v === true ? "in" : v === false ? "out" : "none";
}

export function asLabel(raw) {
  const inc = normalizeIncludes(raw);
  if (inc.as_months === undefined) return null;
  return inc.as_months > 0 ? `AS ${inc.as_months}개월` : "AS 없음";
}

// 비교표 한 칸 — { text, missing, warn }
//   «포함: 부가세·자재비 / 별도: 철거 / AS 12개월» · 하나도 안 적었으면 «안 적음»
export function includesCell(raw) {
  const inc = normalizeIncludes(raw);
  if (!Object.keys(inc).length) return { text: "안 적음", missing: true, warn: false };
  const ins = INCLUDE_ITEMS.filter(i => inc[i.key] === true).map(i => i.label);
  const outs = INCLUDE_ITEMS.filter(i => inc[i.key] === false).map(i => i.label);
  const blank = INCLUDE_ITEMS.filter(i => inc[i.key] === undefined).map(i => i.label);
  const parts = [];
  if (ins.length) parts.push(`포함: ${ins.join("·")}`);
  if (outs.length) parts.push(`별도: ${outs.join("·")}`);
  if (blank.length) parts.push(`안 적음: ${blank.join("·")}`);
  const as = asLabel(inc);
  if (as) parts.push(as);
  return { text: parts.join(" / "), missing: false, warn: outs.length + blank.length > 0, outs, blank };
}

// 고객이 계약 전에 물어볼 것 — 별도 + 안 적은 항목(중복 없이)
export function askBeforeContract(raw) {
  const c = includesCell(raw);
  if (c.missing) return INCLUDE_ITEMS.map(i => i.label);
  return [...c.outs, ...c.blank];
}

// 카드 한 줄 — 포함 항목을 다 적고 별도가 없으면 «부가세·철거·폐기물 처리·자재비 포함»
export function includesLine(raw) {
  const c = includesCell(raw);
  if (c.missing) return null;
  if (!c.warn) {
    const as = asLabel(raw);
    return `${INCLUDE_ITEMS.map(i => i.label).join("·")} 포함${as ? ` · ${as}` : ""}`;
  }
  return c.text;
}
