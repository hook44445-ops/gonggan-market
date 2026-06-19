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
//   각 항목: quality(form) → 0~1 (구체성/완성도).
//   coach  : 보완 제안(제안형 · 보호/신뢰 언어).
//   reason : XP 가 지급된 이유(행동 단위 · 과거형 · "기록/증명" 언어).
export const ESTIMATE_CRITERIA = [
  {
    key: "workScope", label: "공사범위", weight: 12,
    coach: "공사범위를 적어두면 나중에 업체 자신도 지켜주는 기록이 됩니다.",
    reason: "공사범위를 명확하게 정리했습니다.",
    quality: (f) => filledRatio(arr(f.items).filter(i => len(i.name) > 0).length, Math.max(1, arr(f.items).length)),
  },
  {
    key: "quantity", label: "수량", weight: 8,
    coach: "수량을 남겨두면 견적의 근거가 오래 남는 기록이 됩니다.",
    reason: "수량을 꼼꼼하게 기록했습니다.",
    quality: (f) => filledRatio(arr(f.items).filter(i => Number(i.qty) > 0).length, Math.max(1, arr(f.items).length)),
  },
  {
    key: "unitPrice", label: "단가", weight: 8,
    coach: "단가를 투명하게 남기면 고객과의 신뢰를 먼저 만듭니다.",
    reason: "단가를 투명하게 남겼습니다.",
    quality: (f) => filledRatio(arr(f.items).filter(i => Number(i.unitPrice) > 0).length, Math.max(1, arr(f.items).length)),
  },
  {
    key: "materialName", label: "자재정보", weight: 10,
    coach: "자재명을 기록하면 시공 품질이 신뢰로 오래 남습니다.",
    reason: "자재 정보를 자세히 기록했습니다.",
    quality: (f) => {
      const fromItems = arr(f.items).some(i => len(i.material) > 0) ? 0.6 : 0;
      const fromMats  = arr(f.materials).filter(m => len(m.name) > 0).length;
      return clamp01(fromItems + Math.min(0.4, fromMats * 0.2));
    },
  },
  {
    key: "materialSpec", label: "자재 규격·브랜드", weight: 10,
    coach: "자재 규격·브랜드를 함께 남기면 분쟁보다 신뢰가 먼저 쌓입니다.",
    reason: "자재 규격·브랜드를 함께 남겼습니다.",
    quality: (f) => {
      const mats = arr(f.materials);
      if (mats.length === 0) return 0;
      const avg = mats.reduce((s, m) => s + lenScore(m.record, 24), 0) / mats.length;
      return clamp01(avg);
    },
  },
  {
    key: "processNote", label: "공정·시공 설명", weight: 12,
    coach: "공정 순서를 설명하면 고객의 이해를 돕고 업체의 성실함을 증명합니다.",
    reason: "공정 순서를 명확하게 설명했습니다.",
    quality: (f) => lenScore(f.constructionNote, 60),
  },
  {
    key: "schedule", label: "공사 일정", weight: 6,
    coach: "공사 일정을 남기면 고객이 일정을 함께 예상할 수 있어요.",
    reason: "공사 일정을 안내했습니다.",
    quality: (f) => (Number(f.durationDays) > 0 ? 1 : 0),
  },
  {
    key: "customerExplain", label: "고객 설명", weight: 10,
    coach: "고객 설명을 덧붙이면 견적이 고객을 더 잘 이해시킵니다.",
    reason: "고객 설명을 충실히 남겼습니다.",
    quality: (f) => lenScore(f.note, 50),
  },
  {
    key: "warranty", label: "A/S 내용", weight: 8,
    coach: "A/S 범위를 기록하면 책임 있는 마무리가 신뢰로 남습니다.",
    reason: "A/S 범위를 기록했습니다.",
    quality: (f) => lenScore(f.warrantyNote, 30),
  },
  {
    key: "specialNote", label: "특이사항", weight: 8,
    coach: "특이사항을 남기면 고객 이해를 돕고 나중에 업체 자신도 지켜줍니다.",
    reason: "특이사항을 남겨 고객 이해를 도왔습니다.",
    quality: (f) => lenScore(f.specialNote, 30),
  },
  {
    key: "sitePhotos", label: "현장 사진", weight: 8,
    coach: "현장 사진은 시공 내용을 증명하는 든든한 보호자료가 됩니다.",
    reason: "현장 사진으로 시공 내용을 증명했습니다.",
    quality: (f) => {
      const main = arr(f.photoUrls).length;
      const mat  = arr(f.materials).reduce((s, m) => s + arr(m.photos).length, 0);
      return clamp01((main + mat) / 3); // 3장 이상이면 만점
    },
  },
];

// ── 분석 실행 ───────────────────────────────────────────────────────
//   반환: { score(0~100), gainedXp, tier, items[], strongItems[], improveItems[] }
//   items[i]: { key, label, weight, quality, coach, reason, potentialXp, earnedXp }
//     · earnedXp: 이 행동이 실제로 인정받은 XP(과정 가치 — "왜 XP를 주는가"의 근거).
export function analyzeEstimate(form = {}) {
  const raw = ESTIMATE_CRITERIA.map((c) => {
    const q = clamp01(c.quality(form));
    const potentialXp = Math.round(XP_SPAN * (c.weight / 100) * (1 - q)); // 더 채우면 얻을 XP
    const contribution = c.weight * q;                                    // score 기여분
    return { key: c.key, label: c.label, weight: c.weight, quality: q, coach: c.coach, reason: c.reason, potentialXp, contribution };
  });

  const score = Math.round(raw.reduce((s, it) => s + it.contribution, 0)); // 0~100
  const gainedXp = Math.round(ESTIMATE_MIN + (score / 100) * XP_SPAN);      // 30~150

  // 획득 XP 를 행동(항목)별로 정직하게 배분 — 기여도 비례. 합 ≈ gainedXp.
  const totalContribution = raw.reduce((s, it) => s + it.contribution, 0) || 1;
  const items = raw.map((it) => ({
    ...it,
    earnedXp: Math.round(gainedXp * (it.contribution / totalContribution)),
  }));

  const tier =
    score >= 85 ? "매우 성실한 견적" :
    score >= 65 ? "성실견적" :
    score >= 35 ? "보통 견적" : "간단 견적";

  const strongItems  = items.filter((it) => it.quality >= 0.7 && it.earnedXp > 0)
    .sort((a, b) => b.earnedXp - a.earnedXp);
  const improveItems = items
    .filter((it) => it.quality < 0.6 && it.potentialXp > 0)
    .sort((a, b) => b.potentialXp - a.potentialXp);

  return { score, gainedXp, tier, items, strongItems, improveItems };
}

// ── 프로젝트 단계 XP 지급 사유 (행동 단위 · 과정 가치) ──────────────
//   결과/매출이 아니라 "성실하게 남긴 과정"에 XP 를 인정한다.
export const STAGE_XP_REASON = {
  site_visit:  { xp: 30, reason: "현장 기록을 남겨 성실함을 증명했습니다." },
  measurement: { xp: 30, reason: "실측 정보를 꼼꼼하게 기록했습니다." },
  contract:    { xp: 50, reason: "서로를 보호하는 약속을 남겼습니다." },
  escrow:      { xp: 40, reason: "안전한 거래 약속을 함께 지켰습니다." },
  start:       { xp: 40, reason: "착공 기록을 남겨 과정을 투명하게 했습니다." },
  mid:         { xp: 40, reason: "중간 기록으로 진행을 정직하게 남겼습니다." },
  complete:    { xp: 50, reason: "고객과의 약속을 끝까지 완료했습니다." },
  review:      { xp: 30, reason: "고객의 이야기를 신뢰로 남겼습니다." },
  as:          { xp: 40, reason: "책임 있는 마무리를 남겼습니다." },
};

// ════════════════════════════════════════════════════════════════════
// Space OS 점수 철학 — A(Attitude) / S(Skill) 구조 (Phase 7 · 설계 문서)
//
//   공간사이는 기술을 가장 먼저 평가하지 않는다.
//   성실과 정직(A)을 먼저 보고, 실력(S)은 그 위에 더해지는 '보너스'로 둔다.
//   실력은 성실과 정직 위에서 더욱 빛난다.
//
//     A Score (Attitude) — 기본 점수, 총 100점. 업체의 '사람됨'.
//       성실 · 정직 · 책임감 · 기록 충실도 · 약속 이행 · 투명성 · 꾸준함 ·
//       원칙 · 양심(거룩함·깨끗함 등 태도의 철학 포함).
//     S Score (Skill)    — 보너스 점수, 최대 +20. 기술력.
//       시공 품질 · 기술력 · 문제 해결 · 완성도 · A/S 품질.
//
//   ▶ 절대 원칙: S 가 아무리 높아도 A 가 낮으면 프리미엄 추천 대상이 될 수 없다.
//       예) A 42 / S +20 → 추천 불가      A 97 / S +8 → 추천 가능
//
//   ⚠️ 본 구조는 "설계 기준 문서(표시/주석 전용)"이다. 현재 XP 계산
//      (analyzeEstimate · computeCompanyXp)이나 추천업체 선정 로직을
//      변경하지 않는다(Add Only). 향후 점수·추천 산정이 도입될 때
//      이 상수를 단일 기준(SSOT)으로 사용한다.
// ════════════════════════════════════════════════════════════════════
export const SPACE_OS_SCORE_MODEL = Object.freeze({
  A: Object.freeze({
    key: "attitude", label: "A · 사람됨(Attitude)", max: 100, role: "base",
    criteria: ["성실", "정직", "책임감", "기록 충실도", "약속 이행", "투명성", "꾸준함", "원칙", "양심"],
  }),
  S: Object.freeze({
    key: "skill", label: "S · 실력(Skill)", max: 20, role: "bonus",
    criteria: ["시공 품질", "기술력", "문제 해결", "완성도", "A/S 품질"],
  }),
  // 프리미엄 추천 가능 최소 A (설계 기준 — 추천 로직 미연결).
  PREMIUM_MIN_A: 90,
});

// Space OS 최종 철학 문구 — 안내/표시용(Add Only).
//   ※ 성장 모달은 '성장'만 보여준다(Phase 9). 아래 문구들은 각자 어울리는 화면
//      (기록 화면 · 추천업체 화면 · About Space OS)에서 필요할 때 사용하는 SSOT.
export const SPACE_OS_PHILOSOPHY = Object.freeze({
  attitudeFirst: "성실과 정직은 기본입니다. 실력은 그 위에 더해지는 보너스입니다.",
  peopleFirst:   "우리는 기술보다 먼저 사람을 봅니다. 실력은 성실과 정직 위에서 더욱 빛납니다.",
  rareTrust:     "좋은 기술자는 많지만, 신뢰받는 전문가는 드뭅니다. 공간사이는 그 신뢰를 기록하고 성장시키는 플랫폼입니다.",
  // 기록 화면용 — "왜 기록을 남기나요?"
  recordWhy:     "공간사이는 업체를 감시하지 않습니다. 성실하게 남긴 기록이 나중에 업체 스스로를 보호해주기 때문입니다. 좋은 기록은 좋은 평판보다 오래갑니다.",
  recordBase:    "기록은 사람을 감시하기 위해 존재하지 않습니다. 기록은 성실한 사람을 보호하기 위해 존재합니다.",
  // 추천업체 화면용
  recommend:     "공간사이 추천업체는 광고비가 아니라 성실한 기록·정직한 수행·책임 있는 마무리가 꾸준히 쌓인 업체입니다.",
  // About Space OS — 브랜드 화면용
  flow:          Object.freeze(["기록", "증명", "보호", "신뢰", "성장"]),
  guardian:      "공간사이는 사람을 통제하지 않습니다. 성실한 사람이 보호받는 구조를 만듭니다.",
});
