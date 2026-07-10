// ════════════════════════════════════════════════════════════════════
// 공간라운지 Multi-LLM Providers — Claude / GPT / Gemini (Phase 28)
//
//   기존 Claude(OpenRouter) 엔진은 "그대로" 사용한다(callLLM 위임 · 성능/동작 무변경).
//   그 위에 GPT(OpenAI)·Gemini(Google) Provider 를 additive 로 얹고, 공통 인터페이스
//   generateArticle() 하나만 호출하도록 통합한다. 프론트는 Provider 를 의식하지 않는다.
//
//   · Auto: 콘텐츠 유형 → Provider 매핑(함수 1개에서 관리).
//   · 키가 없는 Provider 는 자동 비활성(providerStatus).
//   · 새 서버리스/Cron/Migration 없음. 브라우저 fetch(옵트인, 키 없으면 미동작).
//   ⚠️ Regression Zero: Claude 경로는 llmClient.callLLM 을 그대로 호출(무수정).
// ════════════════════════════════════════════════════════════════════

import { callLLM, llmConfig, LLMError } from "./llmClient.js";

function readEnv() {
  try { if (typeof import.meta !== "undefined" && import.meta.env) return import.meta.env; } catch { /* */ }
  if (typeof process !== "undefined" && process.env) return process.env;
  return {};
}
const ENV = readEnv();
const TIMEOUT_MS = Number(ENV.VITE_LLM_TIMEOUT_MS) || 30000;

// 각 Provider 의 키(브라우저 노출 위해 VITE_ 접두 필요 — 없는 Provider 는 비활성).
const OPENAI_KEY = ENV.VITE_OPENAI_API_KEY || ENV.OPENAI_API_KEY || "";
const GEMINI_KEY = ENV.VITE_GEMINI_API_KEY || ENV.GEMINI_API_KEY || "";
const GPT_MODEL    = ENV.VITE_OPENAI_MODEL || "gpt-4o-mini";
const GEMINI_MODEL = ENV.VITE_GEMINI_MODEL || "gemini-1.5-flash";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeController(externalSignal) {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const cleanup = () => { clearTimeout(timer); if (externalSignal) externalSignal.removeEventListener?.("abort", onAbort); };
  return { controller, cleanup };
}

// 운영자용 리치 에러 — Provider / Status / Endpoint / Model / Response.
function richError({ provider, status, url, model, bodyText }) {
  const body = (bodyText || "").replace(/\s+/g, " ").trim().slice(0, 400) || "(빈 응답)";
  const msg = `LLM 오류\nProvider: ${provider}\nStatus: ${status}\nEndpoint: ${url}\nModel: ${model}\nResponse: ${body}`;
  return new LLMError(msg, { status, retryable: status === 429 || (status >= 500 && status <= 599), url, model, provider, responseBody: bodyText });
}

// 공통 fetch(429/5xx 1회 백오프 재시도). 성공 시 raw json, 실패 시 richError throw.
//   fetchUrl: 실제 요청 URL(키 포함 가능) · displayUrl: 에러/로그 표시용(키 마스킹).
async function postJson({ provider, fetchUrl, displayUrl, headers, body, model, signal }) {
  const url = displayUrl || fetchUrl;
  for (let attempt = 0; attempt <= 1; attempt++) {
    const { controller, cleanup } = makeController(signal);
    try {
      const res = await fetch(fetchUrl, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
      cleanup();
      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        if ((res.status === 429 || (res.status >= 500 && res.status <= 599)) && attempt < 1) {
          const ra = Number(res.headers.get("retry-after"));
          await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 800);
          continue;
        }
        throw richError({ provider, status: res.status, url, model, bodyText });
      }
      return await res.json();
    } catch (e) {
      cleanup();
      if (e instanceof LLMError) throw e;
      const aborted = e?.name === "AbortError";
      if (!aborted && attempt < 1) { await sleep(800); continue; }
      throw new LLMError(aborted ? `LLM timeout/abort\nProvider: ${provider}` : `network error\nProvider: ${provider} · ${e?.message || e}`, { status: 0, retryable: !aborted, url, model, provider });
    }
  }
  throw new LLMError(`LLM failed\nProvider: ${provider}`, { status: 0, retryable: false, url, model, provider });
}

// ── GPT(OpenAI) ─────────────────────────────────────────────────────
async function gptCall({ system, user, temperature, maxTokens, model, signal }) {
  const useModel = model || GPT_MODEL;
  const url = "https://api.openai.com/v1/chat/completions";
  const json = await postJson({
    provider: "gpt", fetchUrl: url, model: useModel, signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${OPENAI_KEY}` },
    body: {
      model: useModel, temperature, max_tokens: maxTokens,
      messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: user }],
    },
  });
  const text = json?.choices?.[0]?.message?.content || "";
  const u = json?.usage || {};
  return { text, usage: { promptTokens: u.prompt_tokens ?? null, completionTokens: u.completion_tokens ?? null, totalTokens: u.total_tokens ?? null }, provider: "gpt", model: useModel };
}

// ── Gemini(Google Generative Language) ──────────────────────────────
async function geminiCall({ system, user, temperature, maxTokens, model, signal }) {
  const useModel = model || GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`;
  const json = await postJson({
    provider: "gemini", fetchUrl: url, displayUrl: url.replace(/key=[^&]+/, "key=***"), model: useModel, signal,
    headers: { "content-type": "application/json" },
    body: {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    },
  });
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p?.text || "").join("");
  const um = json?.usageMetadata || {};
  return { text, usage: { promptTokens: um.promptTokenCount ?? null, completionTokens: um.candidatesTokenCount ?? null, totalTokens: um.totalTokenCount ?? null }, provider: "gemini", model: useModel };
}

// ── Provider 레지스트리 ──────────────────────────────────────────────
export const LLM_PROVIDERS = {
  claude: { id: "claude", label: "Claude", isConfigured: () => llmConfig().configured },
  gpt:    { id: "gpt",    label: "GPT",    isConfigured: () => Boolean(OPENAI_KEY) },
  gemini: { id: "gemini", label: "Gemini", isConfigured: () => Boolean(GEMINI_KEY) },
};

export const PROVIDER_CHOICES = ["claude", "gpt", "gemini", "auto"];

// Provider 연결 상태(관리자 표시용).
export function providerStatus() {
  return Object.values(LLM_PROVIDERS).map((p) => ({ id: p.id, label: p.label, connected: p.isConfigured() }));
}

// Auto 규칙(함수 1개에서 관리) — 콘텐츠 유형 → Provider.
//   매거진/공간마켓/공간라운지 → Claude · 뉴스/트렌드 → Gemini · SEO/정보형 → GPT.
export function autoProvider(contentType) {
  const t = String(contentType || "");
  if (/breaking|news|뉴스|trend_present|trend_past|trend_future|트렌드|trend/.test(t)) return "gemini";
  if (/morning_brief|seo|정보|guide|info/.test(t)) return "gpt";
  // space_market / series / qt / astrology / magazine / 공간 / 기본 → Claude
  return "claude";
}

// 선택(claude/gpt/gemini/auto) + 콘텐츠 유형 → 실제 Provider id. 미설정 Provider 는 Claude 로 안전 폴백.
export function resolveProvider(selection = "claude", contentType = null) {
  let id = selection === "auto" ? autoProvider(contentType) : selection;
  if (!LLM_PROVIDERS[id]) id = "claude";
  if (!LLM_PROVIDERS[id].isConfigured()) {
    // 선택 Provider 미설정 시 Claude 로 안전 폴백(기존 운영 그대로 가능).
    if (LLM_PROVIDERS.claude.isConfigured()) return "claude";
  }
  return id;
}

// ── 통합 인터페이스 — 프론트는 이것만 호출한다 ───────────────────────
//   { text, usage, provider, model } 반환. Claude 는 기존 callLLM 을 그대로 위임(무변경).
export async function generateArticle({ system = "", user = "", temperature = 0.85, maxTokens = 2400, provider = "claude", contentType = null, model = null, signal = null } = {}) {
  const resolved = resolveProvider(provider, contentType);
  if (resolved === "gpt")    return gptCall({ system, user, temperature, maxTokens, model, signal });
  if (resolved === "gemini") return geminiCall({ system, user, temperature, maxTokens, model, signal });
  // Claude(기본) — 기존 엔진 그대로. model 이 claude 계열이 아니면(=GPT/Gemini 잔여값) null 로 두어 기본 사용.
  const claudeModel = model && /claude|anthropic/i.test(model) ? model : null;
  const r = await callLLM({ system, user, temperature, maxTokens, model: claudeModel, signal });
  return { ...r, provider: "claude", model: claudeModel || llmConfig().model };
}
