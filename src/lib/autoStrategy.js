// ════════════════════════════════════════════════════════════════════
// 공간라운지 Auto Strategy — AI 자동 생성 전략 선택 (Phase 20.7)
//
//   운영자가 프롬프트를 몰라도 "주제만 입력"하면 AI 가 글 성격을 분석해 최적의 생성 전략을
//   자동 선택한다: 모드(원석지식/카테고리톤/공간관점) · Prompt Version(v1/v2/v3) · Temperature.
//
//   예)
//     폭염 → 생활·공간 연결 → 공간관점 · v2 · 0.75  ("생활형 공간 칼럼")
//     엔비디아 실적 → 경제 뉴스 → 원석지식 · v1 · 0.5 ("객관적 뉴스")
//     우리집을 바꾸는 작은 습관 → 칼럼 → 카테고리톤 · v2 · 0.8 ("생활 칼럼")
//     민수의 원룸 이야기 → 연재 → v3 · 1.0 ("연재 스토리")
//
//   ⚠️ Regression Zero: 순수 함수 · 기존 엔진(contentAreas/categoryVoice/spacePhilosophy/
//   publishingPriority) 호출만. 기존 수동 모드 동작은 전혀 바꾸지 않는다(추가만).
// ════════════════════════════════════════════════════════════════════

import { contentAreaFor } from "../constants/contentAreas.js";
import { classifyCategory } from "../constants/aiContentFactory.js";
import { reinterpretThroughSpace } from "../constants/spacePhilosophy.js";
import { isBreakingTopic } from "./publishingPriority.js";
import { CATEGORY_LABEL } from "../constants/lounge.js";
import { classifyContentType, shouldApplySpacePerspective, contentTypeMeta } from "./contentTypes.js";

const norm = (s) => String(s ?? "").toLowerCase();

// Phase 24 — 콘텐츠 타입별 프롬프트/Temperature 매핑(지시서 item 15). "뉴스는 뉴스로."
//   mode: raw=원석지식 · voice=카테고리톤 · space=공간관점.
export const CONTENT_TYPE_STRATEGY = {
  morning_brief: { mode: "raw",   promptVersion: "v1", temperature: 0.35, style: "아침 뉴스 정리(SEO)" },
  qt:            { mode: "voice", promptVersion: "v2", temperature: 0.55, style: "말씀/묵상" },
  astrology:     { mode: "voice", promptVersion: "v2", temperature: 0.75, style: "월별 운세" },
  breaking:      { mode: "raw",   promptVersion: "v1", temperature: 0.45, style: "긴급 뉴스" },
  space_market:  { mode: "space", promptVersion: "v3", temperature: 0.75, style: "공간마켓(공간관점)" },
  series:        { mode: "voice", promptVersion: "v3", temperature: 1.0,  style: "연재 스토리" },
  trend_past:    { mode: "voice", promptVersion: "v3", temperature: 0.75, style: "Time Trend · Past" },
  trend_present: { mode: "voice", promptVersion: "v2", temperature: 0.65, style: "Time Trend · Present" },
  trend_future:  { mode: "voice", promptVersion: "v3", temperature: 0.85, style: "Time Trend · Future" },
};

// 뉴스/객관 데이터 성격 영역(원석지식이 어울리는 곳).
const NEWS_AREAS = new Set(["economy", "kr_stock", "us_stock", "ai", "it", "science"]);
const NEWS_CATEGORIES = new Set(["stock", "realestate", "jobs"]);
// 공간과 본질적으로 연결되는 생활 카테고리(공간관점이 자연스러운 곳).
const SPACE_LIFE_CATEGORIES = new Set(["daily", "interior", "room_deco", "move_in", "quote_worry", "review", "local"]);

// 연재/스토리 신호.
const STORY_HINTS = ["이야기", "연재", "소설", "에세이", "원룸 이야기", "씨의", "의 하루", "우리동네", "공간에서 만난"];

// 주제 텍스트 → 자동 전략.
//   반환: { mode:'raw'|'voice'|'space', promptVersion:'v1'|'v2'|'v3', temperature, category,
//           style, isNews, isStory, spaceConnected, chain:[...], reason }
export function analyzeStrategy(issue, { categoryHint = null, typeHint = null } = {}) {
  const t = norm(issue);
  const reinterpret = reinterpretThroughSpace(issue);
  const area = contentAreaFor(issue);
  const category = categoryHint || area?.category || reinterpret.category || classifyCategory(issue);
  const catLabel = CATEGORY_LABEL[category] || category;

  // Phase 24 — 콘텐츠 타입 우선 판별. 뉴스/큐티/운세/연재/트렌드는 공간 관점을 강제하지 않는다.
  const contentType = classifyContentType(issue, { typeHint });
  const typeMeta = contentTypeMeta(contentType);
  const applySpace = shouldApplySpacePerspective(contentType);

  const breaking = isBreakingTopic(issue);
  const isNews = typeMeta.news || breaking || (area && NEWS_AREAS.has(area.id)) || NEWS_CATEGORIES.has(category);
  const isStory = contentType === "series" || STORY_HINTS.some((h) => t.includes(norm(h)));
  // 공간 연결: 타입 규칙상 공간관점 허용 타입 + (재해석 렌즈 비-기본 & 생활형 카테고리)일 때만.
  const spaceConnected = applySpace && reinterpret.lensId !== "life" && SPACE_LIFE_CATEGORIES.has(category);
  const isColumn = /습관|팁|노하우|방법|가이드|칼럼|생각|이유|후기/.test(t);

  let mode, promptVersion, temperature, style;
  const typeStrat = CONTENT_TYPE_STRATEGY[contentType];
  if (typeStrat && (typeHint || contentType !== "trend_present")) {
    // 명시 타입(또는 뉴스/큐티/운세/연재/공간마켓/트렌드 Past·Future 등)은 타입 전략을 그대로 쓴다.
    ({ mode, promptVersion, temperature, style } = typeStrat);
  } else if (isStory) {
    mode = "voice"; promptVersion = "v3"; temperature = 1.0; style = "연재 스토리";
  } else if (isNews) {
    mode = "raw"; promptVersion = "v1"; temperature = 0.5; style = "객관적 뉴스";
  } else if (spaceConnected) {
    mode = "space"; promptVersion = "v2"; temperature = 0.75; style = "생활형 공간 칼럼";
  } else if (isColumn) {
    mode = "voice"; promptVersion = "v2"; temperature = 0.8; style = "생활 칼럼";
  } else {
    mode = "voice"; promptVersion = "v1"; temperature = 0.8; style = "카테고리 칼럼";
  }

  const modeLabel = { raw: "원석지식", voice: "카테고리톤", space: "공간관점" }[mode];
  const chain = [typeMeta.label, modeLabel, promptVersion, `Temp ${temperature}`, applySpace ? "공간관점 허용" : "공간관점 미적용"];
  const reason = `${typeMeta.label} → ${modeLabel}(${promptVersion}, ${temperature})${applySpace ? "" : " · 공간관점 미적용(뉴스는 뉴스로)"}`;

  return { mode, promptVersion, temperature, category, categoryLabel: catLabel, style, isNews, isStory, spaceConnected,
    contentType, contentTypeLabel: typeMeta.label, applySpacePerspective: applySpace, modeLabel, chain, reason };
}

export const MODE_HELP = {
  raw:   "뉴스·경제·주식·통계·정책·과학·의학처럼 객관적인 사실과 데이터를 기반으로 작성합니다. AI 의견은 최소화됩니다.",
  voice: "인테리어·생활·창업·여행·자기계발 등 해당 분야 전문 에디터처럼 자연스럽게 작성합니다.",
  space: "공간라운지 전용. 모든 주제를 공간 → 사람 → 생활 → 문화 → 미래 관점으로 재해석합니다.",
};
export const VERSION_HELP = {
  v1: "균형형 — 사실 전달 위주의 안정적인 글. (추천 ★★★★★)",
  v2: "실용형 — 체크리스트·팁·실행방법 강화.",
  v3: "심층형 — 칼럼·인사이트·철학·미래 전망 강화.",
};
export const TEMPERATURE_HELP = "AI의 창의성을 조절합니다. 낮을수록 사실 중심·안정적, 높을수록 창의적·감성적·표현 다양. 추천값 0.8.";
