// ════════════════════════════════════════════════════════════════════
// 공간라운지 LLM Content Generator — Plan → 실제 LLM → JSON (Phase 10)
//
//   buildWritePlan/buildPrompt/renderFromPlan 구조는 유지한다. 이 파일은 renderFromPlan 의
//   "Mock 출력"을 실제 LLM 호출로 교체하는 계층이다(renderFromPlanLLM). 실패하면 호출부가
//   기존 Mock 렌더러로 자동 폴백한다.
//
//   Phase 8 규칙 전면 적용: Category Voice(카테고리 본질 톤) · Raw Knowledge Mode ·
//   Usefulness(정보가치/실제도움/신뢰성/…) · Natural Category(공간 억지 연결 금지).
//   Space Philosophy 는 유지하되 억지 연결 금지 · 카테고리 본질 우선.
//
//   결과는 반드시 JSON: title, summary, body, tags, keywords, readingMinutes,
//   relatedTopics, category, tone.
// ════════════════════════════════════════════════════════════════════

import { callLLM } from "./llmClient.js";
import { buildPrompt } from "./categoryVoiceWriter.js";
import { USEFULNESS_AXIS_LABELS } from "./contentUsefulness.js";

// 시스템 프롬프트 — 편집국의 역할·규칙(Phase 8)을 고정한다.
function systemPrompt(plan) {
  const noForce = plan.voice.spaceLinkPolicy === "none";
  return [
    "당신은 '공간라운지'의 콘텐츠 에디터입니다. 한국어로 씁니다.",
    "철학: Space is Everything(공간은 최상위 개념). 그러나 글은 '공간'에 억지로 끼워맞추지 않습니다.",
    "카테고리 본질을 최우선으로 합니다 — 연애 글은 연애답게, 자격증 글은 정보답게, 종교 글은 깊이 있게, 주식 글은 데이터답게.",
    noForce
      ? "이 글은 공간 연결을 강요하지 마세요. '우리 집/공간/인테리어' 같은 상투적 연결을 넣지 마세요."
      : "공간 연결은 자연스러울 때만. 억지 상투구는 금지합니다.",
    "품질 기준(유용성 우선): " + Object.values(USEFULNESS_AXIS_LABELS).join(" · ") + ".",
    "과장·단정('무조건', '100%', '확실히 오른다')을 쓰지 말고, 근거·사례 중심으로 신뢰감 있게 씁니다.",
    plan.mode === "raw"
      ? "형식은 Raw Knowledge Mode: 꾸미지 않은 원석 지식(오늘 무슨 일/왜 중요/핵심 포인트/앞으로 볼 것/참고 키워드/후속 후보)."
      : "본문은 마크다운 소제목(##)과 목록(-)을 적절히 사용해 읽기 좋게 구성합니다.",
    "반드시 아래 JSON 스키마 '하나의 객체'로만 응답하세요. JSON 외 다른 텍스트·코드펜스를 절대 출력하지 마세요.",
  ].join("\n");
}

// 사용자 프롬프트 — buildPrompt(plan)(엔진 구조 유지) + 출력 JSON 계약.
function userPrompt(plan) {
  return [
    buildPrompt(plan),
    "",
    "출력(JSON only):",
    "{",
    '  "title": "제목(공간 억지 연결 없이, 카테고리 본질에 맞게)",',
    '  "summary": "2~3문장 요약",',
    '  "body": "마크다운 본문(## 소제목/목록 활용)",',
    '  "tags": ["태그", "3~6개"],',
    '  "keywords": ["검색 키워드", "3~8개"],',
    '  "readingMinutes": 3,',
    `  "relatedTopics": ["관련 주제", "2~5개"],`,
    `  "category": "${plan.category}",`,
    `  "tone": "${plan.voice.tone}"`,
    "}",
  ].join("\n");
}

// LLM 응답 텍스트에서 JSON 객체를 견고하게 파싱. 코드펜스/앞뒤 잡텍스트 제거.
export function parseLLMJson(text) {
  if (!text) return null;
  let s = String(text).trim();
  // ```json ... ``` 펜스 제거.
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // 첫 '{' ~ 마지막 '}' 만 취한다.
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const slice = s.slice(first, last + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

const asArray = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);

// 파싱 결과를 스키마에 맞게 정규화·검증. 필수(title, body) 없으면 null(→폴백).
export function normalizeResult(obj, plan) {
  if (!obj || typeof obj !== "object") return null;
  const title = String(obj.title ?? "").trim();
  const body = String(obj.body ?? obj.content ?? "").trim();
  if (!title || body.length < 40) return null; // 너무 짧으면 실패로 간주 → 폴백.

  const chars = body.replace(/[#*\-\s]/g, "").length;
  const readingMinutes = Number(obj.readingMinutes) > 0 ? Math.round(Number(obj.readingMinutes)) : Math.max(1, Math.round(chars / 500));

  return {
    title,
    summary: String(obj.summary ?? "").trim() || body.replace(/[#*>\-]/g, "").replace(/\s+/g, " ").slice(0, 120),
    body,
    tags: asArray(obj.tags).slice(0, 8),
    keywords: asArray(obj.keywords).slice(0, 10),
    readingMinutes,
    relatedTopics: asArray(obj.relatedTopics).slice(0, 6),
    category: String(obj.category ?? plan.category ?? "").trim() || plan.category,
    tone: String(obj.tone ?? plan.voice?.tone ?? "").trim() || plan.voice?.tone || "",
  };
}

// renderFromPlan 의 LLM 버전 — 실제 LLM 호출 → JSON 파싱/검증. 실패 시 throw(호출부 폴백).
//   반환: { title, summary, body, tags, keywords, readingMinutes, relatedTopics, category, tone }
export async function renderFromPlanLLM(plan, { signal = null, temperature = 0.7, maxTokens = 1800 } = {}) {
  const text = await callLLM({ system: systemPrompt(plan), user: userPrompt(plan), temperature, maxTokens, signal });
  const parsed = parseLLMJson(text);
  const result = normalizeResult(parsed, plan);
  if (!result) throw new Error("LLM returned invalid/short JSON");
  return result;
}
