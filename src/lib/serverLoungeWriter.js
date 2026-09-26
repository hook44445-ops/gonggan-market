// ════════════════════════════════════════════════════════════════════
// 라운지 글 AI 작성(서버) — 2026-09-26
//
//   대표 「글 품질이 너무 떨어지면 제대로 된 글이 써지는 쪽으로 · SEO/GEO/AEO · 덕후들이 좋아하게 · 클릭률 1등 ·
//          구글·네이버에 제대로 나오게 · 오픈라우터(프루비에서 끌어와도)」.
//
//   · 키: 서버 환경변수 OPENROUTER_API_KEY(프루비와 같은 이름 — 대표가 Vercel 에 넣는다). VITE_ 가 아니라 브라우저에 안 나간다.
//     없으면 이 파일은 아무것도 하지 않고(null) 자동 사이클은 예전 틀 글로 돌아간다.
//   · 모델: LOUNGE_LLM_MODEL 이 있으면 그것, 없으면 OpenRouter 공개 목록에서 «가장 최근 Sonnet»(openRouterModels).
//     목록은 6시간마다 새로 읽는다 → 새 모델이 나오면 저절로 바뀐다(조직도·추천도 같은 목록).
//   · 결과는 검사한다(길이·소제목·FAQ·제목 길이). 못 미치면 버리고 틀 글로.
// ⚠️ 비밀은 응답·로그에 절대 싣지 않는다.
// ════════════════════════════════════════════════════════════════════

import { pickLatestModels, defaultModels, pickNewest } from "./openRouterModels.js";
import { voiceFor } from "../constants/categoryVoice.js";
import { CATEGORY_LABEL } from "../constants/lounge.js";

const KEY = () => process.env.OPENROUTER_API_KEY || process.env.LOUNGE_LLM_API_KEY || "";
const MODELS_URL = "https://openrouter.ai/api/v1/models";
const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const CACHE_MS = 6 * 3600 * 1000;
let cache = { at: 0, models: null, source: "default" };

export function llmWriterConfigured() { return writerOrder().length > 0; }

/** 역할별 최신 모델(6시간 캐시). 목록을 못 읽으면 기본값. */
export async function latestModels({ force = false } = {}) {
  if (!force && cache.models && Date.now() - cache.at < CACHE_MS) return cache;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(MODELS_URL, { signal: ctrl.signal });
    clearTimeout(t);
    if (r.ok) {
      const j = await r.json();
      cache = { at: Date.now(), models: pickLatestModels(j?.data ?? []), newest: pickNewest(j?.data ?? []), source: "openrouter" };
      return cache;
    }
  } catch { /* 기본값으로 */ }
  if (!cache.models) cache = { at: Date.now(), models: defaultModels(), source: "default" };
  return cache;
}

export async function writerModel() {
  if (process.env.LOUNGE_LLM_MODEL) return process.env.LOUNGE_LLM_MODEL;
  return (await latestModels()).models.claude_magazine;
}

/** 관리자 화면용 상태 — 비밀 없음 */
export async function llmStatus() {
  const m = await latestModels();
  return {
    configured: llmWriterConfigured(),
    provider: writerOrder()[0] ?? null,          // 지금 먼저 쓰는 AI
    order: writerOrder(),                        // 차례(키가 있는 것만) — 플랜 A 유료 → 플랜 B 무료
    paid: !!KEY(), free: { gemini: !!GEMINI_KEY(), openrouter_free: !!KEY(), groq: !!GROQ_KEY() },
    writerModel: process.env.LOUNGE_LLM_MODEL || m.models.claude_magazine,
    models: m.models,
    newest: m.newest ?? [],
    freeModel: KEY() ? await freeModel() : null,
    geminiModel: GEMINI_KEY() ? await geminiModel(GEMINI_KEY()) : null,
    modelsSource: m.source,
    modelsCheckedAt: new Date(m.at).toISOString(),
  };
}

const AUDIENCE = {
  consumer: "집을 고치거나 꾸미려는 사람(인테리어 수요자)",
  partner: "인테리어·시공 업체 사장님(공급자)",
  brand: "공간마켓 라운지 독자",
  category: "이 주제를 좋아하는 라운지 독자",
};

export function buildLoungePrompt(item) {
  const cat = item.category || "daily";
  const label = CATEGORY_LABEL?.[cat] || cat;
  const voice = voiceFor(cat, item.topic);
  const region = item.region ? `지역: ${item.region} — 제목 앞부분과 첫 문단, 본문 한두 곳에 자연스럽게(GEO). 지역 사정은 지어내지 말고 «지역마다 다를 수 있는 것»으로만.` : "지역: 없음";
  const brand = item.brand
    ? "이 글은 공간마켓(비교견적·공사 기록) 또는 PRUBI(기록 앱)를 «쓰는 법» 정보로 소개하는 글이다. 광고 문구·과장 없이 실제 사용 흐름으로."
    : "공간마켓 언급은 꼭 필요할 때 마지막에 한 문장만. 억지로 넣지 않는다.";
  const hint = item.points ? `참고 핵심(더 깊게 풀어 쓸 것): ${item.points.join(" / ")}` : "";

  const system = [
    "너는 한국 커뮤니티 «공간마켓 라운지»의 수석 에디터다. 네이버·구글 검색 1페이지에 오르고, 검색 결과에서 가장 먼저 클릭되고,",
    "그 분야 «덕후»가 끝까지 읽고 저장·공유하는 글을 쓴다. 한국어 존댓말, 읽기 쉬운 짧은 문장.",
    "",
    "반드시 지킬 것:",
    "1) 제목(title): 16~34자. 검색어(핵심 키워드)를 앞쪽에. 구체적 상황·숫자 개수(예: 5가지)·궁금증 중 하나로 클릭하고 싶게. 낚시·과장·물음표 남발 금지.",
    "2) 본문(content) 마크다운 1,800~2,800자:",
    "   - 첫 줄: «**한 줄 답**: …» 검색 질문에 바로 답하는 한두 문장(AEO — AI 검색이 그대로 인용할 수 있게).",
    "   - 도입 2~3문장: 독자가 «내 얘기다» 싶게.",
    "   - «## » 소제목 4~6개. 그중 두 개 이상은 사람들이 실제로 검색하는 질문형.",
    "   - 덕후가 좋아할 디테일: 현장 용어를 풀어 설명, 흔한 실수와 이유, 고르는 기준, 순서, 체크리스트(- [ ]) 또는 비교표(마크다운 표) 하나 이상.",
    "   - 끝에 «## 자주 묻는 질문» + «### 질문» 3~4개와 짧은 답.",
    "   - 마지막 줄: 댓글을 부르는 질문 한 줄.",
    "3) 사실: 가격·통계·법 조항·수치를 지어내지 않는다. 금액은 «무엇이 금액을 정하는가»와 «지역·업체마다 다르다»로. 건강은 일반 정보(진단·치료 단정 금지), 돈·주식은 투자 권유 금지.",
    "4) 금지: 특정 업체·브랜드 비방/광고, 링크, 이모지 남발(소제목 앞 0~1개), «결론적으로» 같은 기계 문체.",
    "5) meta_description: 검색 결과 아래 보일 80~120자 요약(핵심 키워드 포함, 클릭 이유).",
    "6) tags: 검색 키워드 5~8개(띄어쓰기 포함 실제 검색어).",
    "7) image_query: 대표 사진을 고를 영어 키워드 3~6단어(사람 얼굴·로고·글자 없는 실내/사물 장면).",
    "JSON 한 개만 출력: {\"title\":\"\",\"meta_description\":\"\",\"content\":\"\",\"tags\":[],\"image_query\":\"\"}",
  ].join("\n");

  const user = [
    `주제: ${item.topic}`,
    item.angle ? `독자의 질문(검색 의도): ${item.angle}` : "",
    `라운지 카테고리: ${label}`,
    `독자: ${AUDIENCE[item.audience] || AUDIENCE.category}`,
    `말투·구성: ${voice.tone}`,
    region,
    brand,
    hint,
    item.variant ? `이 주제는 전에 다룬 적이 있다. 이번엔 다른 각도(${["실전 사례 중심", "초보자 입문", "전문가의 체크포인트", "자주 하는 실수"][item.variant % 4]})로.` : "",
  ].filter(Boolean).join("\n");
  return { system, user };
}

/** 결과 검사 — 통과하면 정리된 글, 아니면 null(틀 글로 돌아간다) */
export function validateLoungePost(j) {
  if (!j || typeof j !== "object") return null;
  const title = String(j.title ?? "").replace(/\s+/g, " ").trim().replace(/^["「]|["」]$/g, "");
  const content = String(j.content ?? "").trim();
  if (title.length < 10 || title.length > 40) return null;
  if (content.length < 1200) return null;
  if ((content.match(/^##\s/gm) ?? []).length < 3) return null;
  if (!/자주 묻는 질문/.test(content)) return null;
  if (/https?:\/\//.test(content)) return null;
  const tags = (Array.isArray(j.tags) ? j.tags : []).map((t) => String(t).replace(/^#/, "").trim()).filter(Boolean).slice(0, 8);
  return {
    title, content, tags,
    meta_description: String(j.meta_description ?? "").trim().slice(0, 160),
    image_query: String(j.image_query ?? "").trim().slice(0, 80),
  };
}

function parseJson(text) {
  const s = String(text ?? "");
  try { return JSON.parse(s); } catch { /* 코드블록 등 */ }
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* noop */ } }
  return null;
}

// ── 글쓰기 AI 차례(09-26 대표 「오픈라우터 · 무료는 일단 플랜 B」) ─────────────────────────
//   플랜 A: OpenRouter 유료(최신 Sonnet) — OPENROUTER_API_KEY
//   플랜 B(무료): ① 구글 Gemini API 무료 등급(GEMINI_API_KEY) ② OpenRouter 무료 모델(:free, 같은 OpenRouter 키)
//                 ③ Groq 무료 등급(GROQ_API_KEY — 프루비와 같은 이름)
//   앞 차례가 실패·검사 탈락이면 다음으로. 다 안 되면 null → 틀 글.
//   LOUNGE_LLM_ORDER="gemini,openrouter_free,groq,openrouter" 처럼 순서를 바꿀 수 있다(예: 무료만 쓰기).
const GEMINI_KEY = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";
const GROQ_KEY = () => process.env.GROQ_API_KEY || "";
const DEFAULT_ORDER = ["openrouter", "gemini", "openrouter_free", "groq"];

export function writerOrder() {
  const raw = String(process.env.LOUNGE_LLM_ORDER || "").split(",").map((x) => x.trim()).filter(Boolean);
  const order = raw.length ? raw : DEFAULT_ORDER;
  const has = { openrouter: !!KEY(), openrouter_free: !!KEY(), gemini: !!GEMINI_KEY(), groq: !!GROQ_KEY() };
  return order.filter((p) => has[p]);
}

/* OpenRouter 무료 모델 중 글쓰기에 쓸 만한 것 — 계열 선호 순서 → 그 안에서 가장 최근 */
const FREE_PREF = [/^deepseek\/deepseek-(chat|v|r)/, /^qwen\/qwen3[\d.]*-\d+b/, /^google\/gemma-\d+-\d+b/, /^nvidia\/nemotron-\d+-(ultra|super)/, /^meta-llama\/llama-4-maverick/];
export function pickFreeModel(list = []) {
  const free = (Array.isArray(list) ? list : []).filter((m) => typeof m?.id === "string" && m.id.endsWith(":free") && !/code|safety|guard|nano|lightning|-vl|omni|preview|small|\b[1-9]b\b/i.test(m.id));
  for (const re of FREE_PREF) {
    const hit = free.filter((m) => re.test(m.id)).sort((a, b) => (Number(b.created) || 0) - (Number(a.created) || 0))[0];
    if (hit) return hit.id;
  }
  return free.sort((a, b) => (Number(b.created) || 0) - (Number(a.created) || 0))[0]?.id ?? null;
}
let freeCache = { at: 0, model: null };
async function freeModel() {
  if (process.env.LOUNGE_FREE_MODEL) return process.env.LOUNGE_FREE_MODEL;
  if (freeCache.model && Date.now() - freeCache.at < CACHE_MS) return freeCache.model;
  try {
    const r = await fetch(MODELS_URL);
    if (r.ok) freeCache = { at: Date.now(), model: pickFreeModel((await r.json())?.data ?? []) };
  } catch { /* noop */ }
  return freeCache.model;
}

async function withTimeout(ms, fn) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fn(ctrl.signal); } finally { clearTimeout(t); }
}

async function callOpenAiCompatible(url, key, model, system, user, signal, extraHeaders = {}) {
  const r = await fetch(url, {
    method: "POST", signal,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify({
      model, temperature: 0.8, max_tokens: 4000,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json().catch(() => null);
  return data?.choices?.[0]?.message?.content ?? "";
}

const OR_HEADERS = () => ({ "HTTP-Referer": process.env.SITE_URL || "https://gongganmarket.com", "X-Title": "Gonggan Market Lounge" });

/* Gemini — 모델 목록에서 가장 최근 flash(무료 등급이 넉넉한 계열). GEMINI_MODEL 로 바꿀 수 있다. */
let gemCache = { at: 0, model: null };
async function geminiModel(key) {
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;
  if (gemCache.model && Date.now() - gemCache.at < CACHE_MS) return gemCache.model;
  let model = "gemini-2.5-flash";
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": key } });
    if (r.ok) {
      const list = ((await r.json())?.models ?? [])
        .filter((m) => /^models\/gemini-[\d.]+-flash$/.test(m.name) && (m.supportedGenerationMethods ?? []).includes("generateContent"))
        .map((m) => m.name.replace(/^models\//, ""))
        .sort((a, b) => parseFloat(b.split("-")[1]) - parseFloat(a.split("-")[1]));
      if (list[0]) model = list[0];
    }
  } catch { /* 기본값 */ }
  gemCache = { at: Date.now(), model };
  return model;
}

async function callGemini(key, model, system, user, signal) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", signal,
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 8192, responseMimeType: "application/json" },
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json().catch(() => null);
  return (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
}

async function tryProvider(p, system, user, signal) {
  if (p === "openrouter") { const m = await writerModel(); return { model: m, text: await callOpenAiCompatible(CHAT_URL, KEY(), m, system, user, signal, OR_HEADERS()) }; }
  if (p === "openrouter_free") { const m = await freeModel(); if (!m) throw new Error("no free model"); return { model: m, text: await callOpenAiCompatible(CHAT_URL, KEY(), m, system, user, signal, OR_HEADERS()) }; }
  if (p === "gemini") { const m = await geminiModel(GEMINI_KEY()); return { model: `google/${m}`, text: await callGemini(GEMINI_KEY(), m, system, user, signal) }; }
  if (p === "groq") { const m = process.env.GROQ_MODEL || "openai/gpt-oss-120b"; return { model: `groq/${m}`, text: await callOpenAiCompatible("https://api.groq.com/openai/v1/chat/completions", GROQ_KEY(), m, system, user, signal) }; }
  throw new Error(`unknown provider ${p}`);
}

/** 라운지 글 한 편 — 차례대로 시도, 모두 실패·검사 탈락이면 null(틀 글) */
export async function writeLoungePost(item, { timeoutMs = 40000 } = {}) {
  const order = writerOrder();
  if (!order.length) return null;
  const { system, user } = buildLoungePrompt(item);
  const started = Date.now();
  for (const p of order) {
    const left = timeoutMs - (Date.now() - started);
    if (left < 8000) break;                       // 서버 시간 한도 안에서만
    try {
      const { model, text } = await withTimeout(left, (signal) => tryProvider(p, system, user, signal));
      const post = validateLoungePost(parseJson(text));
      if (post) return { ...post, category: item.category || "daily", model, provider: p };
      console.warn(`[lounge-writer] 검사 탈락 provider=${p} model=${model} topic=${item.topic}`);
    } catch (e) {
      console.warn(`[lounge-writer] 실패 provider=${p} ${e?.name === "AbortError" ? "timeout" : e?.message ?? e}`);
    }
  }
  return null;
}
