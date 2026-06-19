// ════════════════════════════════════════════════════════════════════
// Space OS — 성실견적 분석 엔진 (Phase 2)
//
//   철학: Space OS 는 업체를 평가하는 시스템이 아니라, 업체의 성실함·정직함을
//        데이터로 이해하고 그 노력을 성장(XP)으로 인정하는 운영체제다.
//
//   원칙:
//     · XP 는 "버튼을 눌렀다"고 지급하지 않는다. 견적의 완성도(구체성·투명성·
//       고객 이해도)를 분석한 결과로 지급한다.
//     · 결과 코칭은 항상 "제안형" 문장. "필수/작성하지 않으면" 같은 강요 문구 금지.
//
//   본 모듈은 순수 함수(부수효과·DB·네트워크 없음). 입력 견적 폼 → 분석 결과.
// ════════════════════════════════════════════════════════════════════

import { XP_AWARDS } from "./growth";

const ESTIMATE_MIN = XP_AWARDS.ESTIMATE_MIN; // 30
const ESTIMATE_MAX = XP_AWARDS.ESTIMATE_MAX; // 150
const XP_SPAN = ESTIMATE_MAX - ESTIMATE_MIN; // 120

// ── 소형 헬퍼 ───────────────────────────────────────────────────────
const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const str = (v) => (v == null ? "" : String(v)).trim();
const len = (v) => str(v).length;
const arr = (v) => (Array.isArray(v) ? v : []);
// 길이 기반 충실도 — full 글자수에서 만점. 짧아도 일부 인정.
const lenScore = (v, full = 40) => clamp01(len(v) / full);
const filledRatio = (a, b) => (b > 0 ? clamp01(a / b) : 0);

// ── 분석 항목 정의 (weight 합 = 100) ────────────────────────────────
//   각 항목: quality(form) → 0~1 (구체성/완성도). coach 는 보완 제안(제안형).
export const ESTIMATE_CRITERIA = [
  {
    key: "workScope", label: "공사범위", weight: 12,
    coach: "공사범위(공정명)를 구체적으로 적어주시면 고객이 작업 범위를 더 명확히 이해할 수 있어요.",
    quality: (f) => filledRatio(arr(f.items).filter(i => len(i.name) > 0).length, Math.max(1, arr(f.items).length)),
  },
  {
    key: "quantity", label: "수량", weight: 8,
    coach: "공정별 수량을 적어주시면 견적의 근거가 더 분명해집니다.",
    quality: (f) => filledRatio(arr(f.items).filter(i => Number(i.qty) > 0).length, Math.max(1, arr(f.items).length)),
  },
  {
    key: "unitPrice", label: "단가", weight: 8,
    coach: "단가를 적어주시면 고객이 금액 구성을 투명하게 이해할 수 있어요.",
    quality: (f) => filledRatio(arr(f.items).filter(i => Number(i.unitPrice) > 0).length, Math.max(1, arr(f.items).length)),
  },
  {
    key: "materialName", label: "자재정보", weight: 10,
    coach: "사용 자재명을 적어주시면 고객이 시공 품질을 더 신뢰할 수 있어요.",
    quality: (f) => {
      const fromItems = arr(f.items).some(i => len(i.material) > 0) ? 0.6 : 0;
      const fromMats  = arr(f.materials).filter(m => len(m.name) > 0).length;
      return clamp01(fromItems + Math.min(0.4, fromMats * 0.2));
    },
  },
  {
    key: "materialSpec", label: "자재 규격·브랜드", weight: 10,
    coach: "자재 규격·브랜드를 함께 기록하면 고객이 자재를 더 신뢰할 수 있어요.",
    quality: (f) => {
      const mats = arr(f.materials);
      if (mats.length === 0) return 0;
      const avg = mats.reduce((s, m) => s + lenScore(m.record, 24), 0) / mats.length;
      return clamp01(avg);
    },
  },
  {
    key: "processNote", label: "공정·시공 설명", weight: 12,
    coach: "공정 설명을 조금 더 구체적으로 작성하면 신뢰도가 높아집니다.",
    quality: (f) => lenScore(f.constructionNote, 60),
  },
  {
    key: "schedule", label: "공사 일정", weight: 6,
    coach: "공사 일정을 적어주시면 고객이 일정을 예상하기 더 쉬워요.",
    quality: (f) => (Number(f.durationDays) > 0 ? 1 : 0),
  },
  {
    key: "customerExplain", label: "고객 설명", weight: 10,
    coach: "고객 설명을 덧붙이면 견적의 이해도가 한층 높아집니다.",
    quality: (f) => lenScore(f.note, 50),
  },
  {
    key: "warranty", label: "A/S 내용", weight: 8,
    coach: "A/S 조건을 안내하면 고객이 더 안심하고 결정할 수 있어요.",
    quality: (f) => lenScore(f.warrantyNote, 30),
  },
  {
    key: "specialNote", label: "특이사항", weight: 8,
    coach: "특이사항을 조금 더 작성하면 고객이 더욱 이해하기 쉬운 견적이 됩니다.",
    quality: (f) => lenScore(f.specialNote, 30),
  },
  {
    key: "sitePhotos", label: "현장 사진", weight: 8,
    coach: "사진을 추가하면 시공 내용을 더욱 명확하게 전달할 수 있습니다.",
    quality: (f) => {
      const main = arr(f.photoUrls).length;
      const mat  = arr(f.materials).reduce((s, m) => s + arr(m.photos).length, 0);
      return clamp01((main + mat) / 3); // 3장 이상이면 만점
    },
  },
];

// ── 분석 실행 ───────────────────────────────────────────────────────
//   반환: { score(0~100), gainedXp, tier, items[], strongItems[], improveItems[] }
export function analyzeEstimate(form = {}) {
  const items = ESTIMATE_CRITERIA.map((c) => {
    const q = clamp01(c.quality(form));
    // 이 항목을 더 채우면 얻을 수 있는 추가 XP (정직한 marginal 값).
    const potentialXp = Math.round(XP_SPAN * (c.weight / 100) * (1 - q));
    return { key: c.key, label: c.label, weight: c.weight, quality: q, coach: c.coach, potentialXp };
  });

  const score = Math.round(items.reduce((s, it) => s + it.weight * it.quality, 0)); // 0~100
  const gainedXp = Math.round(ESTIMATE_MIN + (score / 100) * XP_SPAN);              // 30~150

  const tier =
    score >= 85 ? "매우 성실한 견적" :
    score >= 65 ? "성실견적" :
    score >= 35 ? "보통 견적" : "간단 견적";

  const strongItems  = items.filter((it) => it.quality >= 0.7);
  const improveItems = items
    .filter((it) => it.quality < 0.6 && it.potentialXp > 0)
    .sort((a, b) => b.potentialXp - a.potentialXp);

  return { score, gainedXp, tier, items, strongItems, improveItems };
}
