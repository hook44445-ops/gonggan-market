// ════════════════════════════════════════════════════════════════════
// 공간라운지 AI Editor Workbench — 편집자 워크벤치 (Phase 11)
//
//   LLM 이 생성한 글을 바로 발행하지 않고 "생성 → 편집 → 비교 → 승인 → 발행"으로 운영한다.
//   이 파일은 관리자 워크벤치에 필요한 데이터를 조립한다: 생성 결과(9필드) + 메타(프롬프트/모델/
//   지연/confidence/raw) + Quality Panel(정보성/자연스러움/중복/SEO/제목/읽기난이도).
//
//   ⚠️ Regression Zero: Phase 10 엔진(llmClient/llmContentGenerator/categoryVoiceWriter)을
//   전혀 "수정하지 않고" 그들이 export 한 순수 함수만 호출한다. DB/Migration/API/Cron 없음 —
//   워크벤치 기록은 localStorage 에만 저장한다(운영 참고용).
// ════════════════════════════════════════════════════════════════════

import { buildWritePlan, buildPrompt, generateVoicedDraft } from "./categoryVoiceWriter.js";
import { callLLM, llmConfig, isLLMConfigured } from "./llmClient.js";
import { parseLLMJson, normalizeResult } from "./llmContentGenerator.js";
import { scoreUsefulness } from "./contentUsefulness.js";
import { detectForcedSpaceLinks, stripForcedSpaceLinks } from "./forcedSpaceLinkFilter.js";
import { readingTime } from "./readingExperience.js";
import { CATEGORY_LABEL } from "../constants/lounge.js";
import { logActivity } from "./activityLog.js";

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

// ── Prompt Version 관리 (v1/v2/v3) ──────────────────────────────────
// 각 버전은 system 프롬프트의 강조점을 바꾼다. user 는 buildPrompt(plan)(엔진 구조) 재사용.
export const PROMPT_VERSIONS = [
  { id: "v1", label: "v1 · 균형", note: "Phase 8 표준 규칙(카테고리 본질·유용성·억지 공간연결 금지)" },
  { id: "v2", label: "v2 · 실용 강화", note: "체크리스트·비용·근거 강조. 더 짧고 실행 중심." },
  { id: "v3", label: "v3 · 깊이 강화", note: "맥락·서사·통찰 강조. 차분하고 읽는 맛 있게." },
];

const RULES_BASE = (plan) => [
  "당신은 '공간라운지'의 콘텐츠 에디터입니다. 한국어로 씁니다.",
  "철학(Space is Everything)은 유지하되 '공간'에 억지로 끼워맞추지 않습니다. 카테고리 본질을 최우선합니다.",
  plan.voice.spaceLinkPolicy === "none"
    ? "이 글은 공간 연결을 강요하지 마세요('우리 집/공간/인테리어' 상투구 금지)."
    : "공간 연결은 자연스러울 때만. 억지 상투구 금지.",
  "과장·단정('무조건','100%','확실히 오른다') 금지. 근거·사례 중심으로 신뢰감 있게.",
  "Humanization: 사람이 쓴 것처럼 자연스럽게. GPT 상투구·반복 문단·뻔한 나열을 피하고, 구체적 사례와 리듬 있는 문장으로 씁니다.",
];

const VERSION_EXTRA = {
  v1: [],
  v2: ["형식: 핵심 요약 → 체크리스트/단계 → 비용·주의 → 마무리. 실행 가능한 항목 위주로 간결하게."],
  v3: ["형식: 맥락과 배경을 짚고, 하나의 관점을 깊이 있게 풀어냅니다. 문장은 차분하게, 통찰을 담아."],
};

const JSON_CONTRACT = (plan) => [
  "반드시 아래 JSON '하나의 객체'로만 응답하세요(코드펜스·다른 텍스트 금지):",
  "{",
  '  "title": "제목", "summary": "2~3문장 요약", "body": "마크다운 본문(##/목록)",',
  '  "tags": ["3~6개"], "keywords": ["3~8개"], "readingMinutes": 3, "relatedTopics": ["2~5개"],',
  '  "focusKeyword": "핵심 SEO 키워드 1개", "metaDescription": "검색결과용 요약(80~120자)",',
  `  "category": "${plan.category}", "tone": "${plan.voice.tone}"`,
  "}",
].join("\n");

export function buildWorkbenchMessages(plan, versionId = "v1") {
  const v = PROMPT_VERSIONS.find((x) => x.id === versionId) ? versionId : "v1";
  const mode = plan.mode === "raw"
    ? ["형식은 Raw Knowledge Mode: 오늘 무슨 일/왜 중요/핵심 포인트/앞으로 볼 것/참고 키워드/후속 후보. 꾸미지 말 것."]
    : (VERSION_EXTRA[v] || []);
  const system = [...RULES_BASE(plan), ...mode].join("\n");
  const user = [buildPrompt(plan), "", JSON_CONTRACT(plan)].join("\n");
  return { system, user, version: v };
}

// ── Mock → 9필드(폴백 형태 통일) ─────────────────────────────────────
function mockResult(draft, plan) {
  const body = draft.content;
  return {
    title: draft.title,
    summary: body.replace(/[#*>\-]/g, "").replace(/\s+/g, " ").trim().slice(0, 120),
    body,
    tags: draft.tags || [plan.topic, plan.category].filter(Boolean),
    keywords: Array.from(new Set([plan.topic, CATEGORY_LABEL[plan.category] || plan.category, ...(draft.tags || [])])).filter(Boolean).slice(0, 8),
    readingMinutes: readingTime(body, 0).minutes,
    relatedTopics: [],
    category: plan.category,
    tone: plan.voice.tone,
  };
}

// ── Quality Panel ───────────────────────────────────────────────────
const tokens = (s) => String(s ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2);

function duplicationScore(title, existing = []) {
  const a = new Set(tokens(title));
  if (a.size === 0) return { score: 0, label: "낮음", nearest: null };
  let best = 0, nearest = null;
  for (const p of existing) {
    const b = new Set(tokens(p.title));
    if (b.size === 0) continue;
    let inter = 0; for (const x of a) if (b.has(x)) inter += 1;
    const j = inter / (a.size + b.size - inter);
    if (j > best) { best = j; nearest = p.title; }
  }
  const score = clamp(best * 100);
  return { score, label: score >= 60 ? "높음" : score >= 30 ? "보통" : "낮음", nearest: score >= 30 ? nearest : null };
}

function seoScore({ title, body, keywords = [] }) {
  const tlen = String(title).length;
  const titleFit = tlen >= 8 && tlen <= 40 ? 100 : tlen < 8 ? 55 : 70;
  const headings = (String(body).match(/^##\s/gm) ?? []).length;
  const kw = Math.min(keywords.length, 6) / 6;
  return clamp(titleFit * 0.5 + Math.min(headings, 4) / 4 * 100 * 0.25 + kw * 100 * 0.25);
}

function titleScore(title) {
  const t = String(title).trim();
  const len = t.length;
  const generic = /^(제목|무제|오늘의 이야기)$/.test(t);
  return clamp((len >= 10 && len <= 38 ? 90 : len < 10 ? 50 : 70) - (generic ? 40 : 0));
}

function readability(body) {
  const text = String(body).replace(/^#{1,6}\s+/gm, "").replace(/^[-•]\s+/gm, "");
  const sentences = text.split(/[.!?。\n]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  if (sentences.length === 0) return { score: 60, label: "보통", avgLen: 0 };
  const avg = Math.round(sentences.reduce((n, s) => n + s.length, 0) / sentences.length);
  const label = avg <= 40 ? "쉬움" : avg <= 70 ? "보통" : "어려움";
  const score = clamp(avg <= 40 ? 90 : avg <= 70 ? 72 : 50);
  return { score, label, avgLen: avg };
}

// Quality Panel 전체 계산. existing: 중복 판정용 기존 글([{title}]).
export function computeQuality({ title = "", body = "", category = "", keywords = [] } = {}, existing = []) {
  const u = scoreUsefulness({ title, content: body, category });
  const dup = duplicationScore(title, existing);
  const seo = seoScore({ title, body, keywords });
  const ttl = titleScore(title);
  const read = readability(body);
  const forced = detectForcedSpaceLinks(body).length;
  return {
    infoValue: u.axes.infoValue,          // 정보성
    naturalness: u.axes.naturalness,      // 자연스러움
    usefulness: u.total,
    duplication: dup,                     // 중복 {score,label,nearest}
    seo,                                  // SEO
    title: ttl,                           // 제목
    readability: read,                    // 읽기 난이도 {score,label,avgLen}
    forcedLinks: forced,
    recommendPublish: u.recommendPublish && dup.score < 60,
  };
}

// AI Confidence(0~100) — Quality 종합 + 소스(LLM/Mock) 반영.
export function computeConfidence(quality, source = "mock") {
  const base =
    quality.usefulness * 0.34 +
    quality.naturalness * 0.16 +
    (100 - quality.duplication.score) * 0.18 +
    quality.seo * 0.14 +
    quality.title * 0.10 +
    quality.readability.score * 0.08;
  // Mock 은 템플릿이라 상한을 낮춰 LLM 결과와 구분(운영 신뢰도 표시).
  return clamp(source === "llm" ? base : Math.min(base, 78));
}

// Editorial Score(0~100) — 편집 관점 종합 등급(유용성·신뢰도·SEO·가독성).
export function computeEditorialScore(quality, confidence) {
  return clamp(quality.usefulness * 0.45 + confidence * 0.30 + quality.seo * 0.15 + quality.readability.score * 0.10);
}

// ── 워크벤치 생성 — 결과 + 메타 + 품질 ──────────────────────────────
//   반환: { result(9필드), meta:{prompt,promptVersion,llmModel,llmProvider,temperature,tokensEstimated,
//           latencyMs,confidence,rawResponse,source}, quality }
export async function generateForWorkbench(
  { issue, category, region = null, mode = "voice", promptVersion = "v1", temperature = 0.85 } = {},
  { signal = null, existing = [], maxTokens = 2400 } = {}
) {
  const plan = buildWritePlan({ issue, category, region, mode });
  const cfg = llmConfig();
  const messages = buildWorkbenchMessages(plan, promptVersion);
  const baseMeta = { prompt: messages, promptVersion: messages.version, llmModel: cfg.model, llmProvider: cfg.provider, temperature };

  // Phase 20.6 — Production: LLM 미설정 시 생성하지 않고 명확히 안내(Mock 생성 금지).
  if (!isLLMConfigured()) {
    return { error: "LLM 미설정 (VITE_LLM_API_KEY 필요)", result: null, quality: null, meta: { ...baseMeta, source: "unconfigured" } };
  }

  const t0 = Date.now();
  let rawResponse = null, usage = { promptTokens: null, completionTokens: null, totalTokens: null };
  try {
    const llm = await callLLM({ system: messages.system, user: messages.user, temperature, maxTokens, signal });
    rawResponse = llm.text;
    usage = llm.usage || usage;
    const latencyMs = Date.now() - t0;
    const parsed = normalizeResult(parseLLMJson(rawResponse), plan);
    if (!parsed) throw new Error("LLM 응답 파싱 실패(JSON 형식 아님/본문 미달)");
    // Natural Category — 정책상 억지 공간연결 정리.
    if (plan.voice.spaceLinkPolicy !== "natural") parsed.body = stripForced(parsed.body);

    const quality = computeQuality({ title: parsed.title, body: parsed.body, category: plan.category, keywords: parsed.keywords }, existing);
    const confidence = computeConfidence(quality, "llm");
    const editorialScore = computeEditorialScore(quality, confidence);

    return {
      result: parsed,
      quality,
      meta: {
        ...baseMeta,
        source: "llm",
        latencyMs,
        confidence,
        editorialScore,
        rawResponse,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        tokensEstimated: usage.totalTokens ?? Math.round((messages.system.length + messages.user.length + rawResponse.length) / 4),
      },
    };
  } catch (e) {
    // Phase 20.6 — 실패 시에도 Mock 생성 금지. "LLM 호출 실패"만 반환.
    return {
      error: `LLM 호출 실패: ${e?.message ?? String(e)}`,
      result: null,
      quality: null,
      meta: { ...baseMeta, source: "error", latencyMs: Date.now() - t0, rawResponse },
    };
  }
}

// stripForcedSpaceLinks 안전 래퍼(엔진 무수정 — export 함수 호출만).
function stripForced(text) { try { return stripForcedSpaceLinks(text).text; } catch { return text; } }

// ── 워크벤치 기록 저장(localStorage · DB 아님) ──────────────────────
const STORE_KEY = "space_editor_workbench_v1";
const CAP = 50;

// 저장 구조: draft + prompt + promptVersion + llmModel + llmProvider + temperature + tokens +
//   latency + confidence + rawResponse (요구 스키마). DB 대신 로컬 보관(운영 참고).
export function saveWorkbenchRecord({ result, meta } = {}) {
  if (!result || !meta) return getWorkbenchRecords();
  const rec = {
    id: `wb_${Date.now()}`,
    savedAt: Date.now(),
    draft: {
      title: result.title, summary: result.summary, body: result.body, tags: result.tags, keywords: result.keywords,
      category: result.category, tone: result.tone,
      focusKeyword: result.focusKeyword ?? "", metaDescription: result.metaDescription ?? "",
    },
    prompt: meta.prompt,
    promptVersion: meta.promptVersion,
    llmModel: meta.llmModel,
    llmProvider: meta.llmProvider,
    temperature: meta.temperature,
    tokens: meta.tokensEstimated,
    promptTokens: meta.promptTokens ?? null,
    completionTokens: meta.completionTokens ?? null,
    totalTokens: meta.totalTokens ?? null,
    latency: meta.latencyMs,
    confidence: meta.confidence,
    editorialScore: meta.editorialScore ?? null,
    rawResponse: meta.rawResponse,
    source: meta.source,
  };
  try {
    const cur = getWorkbenchRecords();
    localStorage.setItem(STORE_KEY, JSON.stringify([rec, ...cur].slice(0, CAP)));
  } catch { /* 저장 실패 무시 */ }
  // Phase 24 — Activity Log 기록(생성/응답/실패). 실패해도 무해(호출만).
  try {
    const inTok = Number(rec.promptTokens) || 0, outTok = Number(rec.completionTokens) || 0;
    const costKRW = Math.round(((inTok / 1e6) * 3.0 + (outTok / 1e6) * 15.0) * 1350);
    logActivity(rec.source === "llm" ? "llm_response" : "failed", {
      title: rec.draft?.title || meta.prompt?.slice(0, 24) || "생성",
      model: rec.llmModel, tokens: rec.totalTokens, latencyMs: rec.latency,
      costKRW, ok: rec.source === "llm", note: rec.source === "llm" ? `Editorial ${rec.editorialScore ?? "-"} · Conf ${rec.confidence ?? "-"}` : rec.source,
    });
  } catch { /* 로그 실패 무시 */ }
  return getWorkbenchRecords();
}

export function getWorkbenchRecords() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
