// ════════════════════════════════════════════════════════════════════
// 공간라운지 Real LLM Editorial Engine (Phase 18)
//
//   Mock 템플릿 생성을 종료하고 실제 OpenRouter LLM 으로 "매거진 수준" 콘텐츠를 만든다.
//   흐름: 카테고리 자동 분류 → Category Voice → Editorial Prompt → LLM 호출 →
//         JSON 파싱/정규화(제목/본문/요약/태그/SEO) → GPT 흔적 제거 → Confidence(7축) →
//         90점 미만 자동 Retry(≤3, 최고점 채택) → Editor's Pick 계산.
//
//   ⚠️ 이 엔진은 Mock 본문을 생성하지 않는다. LLM 미설정/전량 실패 시 {ok:false, reason}
//      을 반환할 뿐(가짜 매거진 글을 만들지 않는다). 기존 generateVoicedDraft(Mock 폴백)는
//      건드리지 않는다(자동발행 파이프라인 안전용) — Regression Zero.
//
//   테스트 용이성: opts._callLLM 로 LLM 호출을 주입 가능(미주입 시 실제 callLLM).
// ════════════════════════════════════════════════════════════════════

import { callLLM as realCallLLM, isLLMConfigured } from "./llmClient.js";
import { parseLLMJson } from "./llmContentGenerator.js";
import {
  classifyEditorialCategory, EDITORIAL_VOICE, BANNED_GPT_PHRASES,
  editorialSystemPrompt, editorialUserPrompt,
} from "../constants/editorialPrompt.js";
import { getEditorialConfig } from "./editorialConfig.js";

const SENTENCE_SPLIT = /(?<=[.!?。…])\s+|\n+/;
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const asArray = (v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []);

// ── GPT 흔적 ─────────────────────────────────────────────────────────
export function detectGptTraces(text = "") {
  const t = String(text);
  return BANNED_GPT_PHRASES.filter((p) => t.includes(p));
}
// 상투구가 든 헤딩 줄은 제거, 문장 안이면 그 문장만 제거.
export function scrubGptTraces(text = "") {
  let removed = 0;
  const out = [];
  for (const line of String(text).split("\n")) {
    const isHeading = /^#{1,6}\s+/.test(line);
    const bare = line.replace(/^#{1,6}\s+/, "");
    if (isHeading && BANNED_GPT_PHRASES.some((p) => bare.includes(p))) { removed += 1; continue; }
    if (!line.trim()) { out.push(line); continue; }
    const kept = [];
    for (const sent of line.split(SENTENCE_SPLIT)) {
      if (sent.trim() && BANNED_GPT_PHRASES.some((p) => sent.includes(p))) { removed += 1; continue; }
      kept.push(sent);
    }
    const rebuilt = kept.join(" ").replace(/\s{2,}/g, " ").trimEnd();
    if (rebuilt.trim() || isHeading) out.push(rebuilt);
  }
  return { text: out.join("\n").replace(/\n{3,}/g, "\n\n").trim(), removed };
}

// ── 정규화 ───────────────────────────────────────────────────────────
export function normalizeEditorial(obj, category) {
  if (!obj || typeof obj !== "object") return null;
  const title = String(obj.title ?? "").trim();
  let body = String(obj.body ?? obj.content ?? "").trim();
  if (!title || body.length < 400) return null; // 매거진 최소 분량 미달 → 실패로 간주.

  const seoIn = obj.seo && typeof obj.seo === "object" ? obj.seo : {};
  const seo = {
    metaTitle: String(seoIn.metaTitle ?? title).trim().slice(0, 60),
    metaDescription: String(seoIn.metaDescription ?? obj.summary ?? "").trim().slice(0, 160),
    focusKeyword: String(seoIn.focusKeyword ?? "").trim(),
    searchIntent: String(seoIn.searchIntent ?? "informational").trim(),
  };
  const summary = String(obj.summary ?? "").trim().slice(0, 170)
    || body.replace(/[#*>\-]/g, "").replace(/\s+/g, " ").slice(0, 150);
  // 태그 6~10, 중복 제거.
  const tags = Array.from(new Set(asArray(obj.tags))).slice(0, 10);

  return { title, summary, body, tags, seo, category: String(obj.category ?? category).trim() || category };
}

// ── Confidence (7축) ─────────────────────────────────────────────────
const CONF_LABELS = {
  information: "정보 가치", originality: "독창성", naturalness: "자연스러움",
  readability: "가독성", seo: "SEO", categoryMatch: "카테고리 적합성", editorial: "편집 완성도",
};
const count = (t, ws) => ws.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);

export function computeConfidence(draft) {
  const body = String(draft?.body ?? "");
  const title = String(draft?.title ?? "");
  const len = body.replace(/\s/g, "").length;
  const sents = body.split(SENTENCE_SPLIT).filter((s) => s.trim());
  const paras = body.split(/\n{2,}/).filter((p) => p.trim());
  const traces = detectGptTraces(body).length;
  const voice = EDITORIAL_VOICE[draft?.category];

  // 정보 가치 — 분량/문단 구성(매거진 분량이면 높게).
  const information = clamp(50 + Math.min(len / 25, 32) + Math.min(paras.length * 4, 18));
  // 독창성 — 문장 길이 편차(사람은 리듬이 다양) + 질문/여백 신호.
  const lens = sents.map((s) => s.length);
  const avg = lens.reduce((a, b) => a + b, 0) / (lens.length || 1);
  const variance = lens.reduce((a, b) => a + (b - avg) ** 2, 0) / (lens.length || 1);
  const originality = clamp(56 + Math.min(Math.sqrt(variance) * 1.7, 32) + (body.includes("?") ? 8 : 0));
  // 자연스러움 — GPT 흔적 없을수록 높음, 과장 단정 감점.
  const naturalness = clamp(100 - traces * 22 - count(body, ["무조건", "100%", "확실히", "반드시 성공"]) * 12);
  // 가독성 — 평균 문장 길이 적정(한국어는 짧아 18~90자 허용), 소제목.
  const readability = clamp(66 + (avg >= 18 && avg <= 90 ? 20 : -8) + Math.min((body.match(/^##\s/gm) ?? []).length * 4, 16));
  // SEO — meta/focusKeyword/제목 길이.
  const s = draft?.seo ?? {};
  const seo = clamp(40 + (s.metaTitle ? 15 : 0) + (s.metaDescription ? 20 : 0) + (s.focusKeyword ? 15 : 0) + (title.length >= 8 && title.length <= 40 ? 10 : 0));
  // 카테고리 적합성 — voice 축 어휘가 자연스럽게 반영됐는지(강제 아님, 신호로만).
  const categoryMatch = clamp(64 + (voice ? count(body, voice.axes) * 8 : 0) + 12);
  // 편집 완성도 — 요약/태그/여백(GPT 흔적 없음).
  const editorial = clamp(52 + (draft?.summary ? 15 : 0) + Math.min((draft?.tags?.length ?? 0) * 3, 21) + (traces === 0 ? 12 : 0));

  const axes = { information, originality, naturalness, readability, seo, categoryMatch, editorial };
  const total = clamp(
    information * 0.18 + originality * 0.16 + naturalness * 0.18 + readability * 0.14 +
    seo * 0.12 + categoryMatch * 0.10 + editorial * 0.12
  );
  return { axes, total, gptTraces: traces };
}

// ── Editor's Pick ────────────────────────────────────────────────────
export function editorsPickScore(draft, confidence) {
  const body = String(draft?.body ?? "");
  const len = body.replace(/\s/g, "").length;
  const saveValue = clamp(40 + Math.min(len / 30, 30) + (draft?.tags?.length >= 6 ? 15 : 0));   // 저장 가치
  const shareValue = clamp(35 + (draft?.summary ? 25 : 0) + (body.includes("?") ? 10 : 0));      // 공유 가치
  const searchValue = clamp(40 + (draft?.seo?.focusKeyword ? 25 : 0) + (draft?.seo?.metaDescription ? 15 : 0)); // 검색 가치
  const longevity = clamp((confidence?.axes?.originality ?? 50) * 0.5 + (len > 1200 ? 40 : 15)); // 오래 읽힐 가능성
  const total = clamp(saveValue * 0.3 + shareValue * 0.25 + searchValue * 0.25 + longevity * 0.2);
  return { saveValue, shareValue, searchValue, longevity, total, isPick: total >= 78 };
}

// ── 메인: 생성(분류→프롬프트→LLM→정규화→scrub→confidence→retry→pick) ──
export async function generateEditorial(args = {}, opts = {}) {
  const { topic, categoryHint = null, region = null } = args;
  const t = String(topic ?? "").trim();
  if (!t) return { ok: false, reason: "empty_topic" };

  const call = opts._callLLM || realCallLLM;
  const configured = opts._callLLM ? true : isLLMConfigured();
  if (!configured) return { ok: false, reason: "llm_not_configured" };

  const cfg = getEditorialConfig();
  const model = args.model || cfg.model;
  const temperature = Number.isFinite(args.temperature) ? args.temperature : cfg.temperature;
  const maxTokens = Number.isFinite(args.maxTokens) ? args.maxTokens : cfg.maxTokens;
  const maxRetries = Math.max(1, Math.min(Number(args.maxRetries) || cfg.maxRetries || 3, 3));
  const minConfidence = Number(cfg.minConfidence) || 90;

  const category = categoryHint || classifyEditorialCategory(t);
  const voice = EDITORIAL_VOICE[category];
  const system = editorialSystemPrompt(category, voice);
  const user = editorialUserPrompt({ topic: t, category, voice, region });

  let best = null;
  const attempts = [];
  for (let i = 0; i < maxRetries; i++) {
    try {
      // 재시도는 temperature 를 조금씩 올려 변주(정형화 탈출).
      const text = await call({ system, user, temperature: Math.min(temperature + i * 0.07, 1), maxTokens, model, signal: opts.signal });
      const parsed = parseLLMJson(text);
      let draft = normalizeEditorial(parsed, category);
      if (!draft) { attempts.push({ attempt: i + 1, ok: false, reason: "invalid_json" }); continue; }
      const scrub = scrubGptTraces(draft.body);
      draft = { ...draft, body: scrub.text, scrubbedTraces: scrub.removed };
      const confidence = computeConfidence(draft);
      attempts.push({ attempt: i + 1, ok: true, confidence: confidence.total });
      if (!best || confidence.total > best.confidence.total) best = { draft, confidence };
      if (confidence.total >= minConfidence) break; // 90점 이상이면 채택 후 종료.
    } catch (e) {
      attempts.push({ attempt: i + 1, ok: false, reason: e?.message || "llm_error" });
    }
  }

  if (!best) return { ok: false, reason: "all_attempts_failed", attempts };
  const editorsPick = editorsPickScore(best.draft, best.confidence);
  return {
    ok: true,
    draft: best.draft,
    category,
    confidence: best.confidence,
    editorsPick,
    attempts,
    passed: best.confidence.total >= minConfidence,
    model,
  };
}

export { CONF_LABELS };
