// ════════════════════════════════════════════════════════════════════
// 공간라운지 LLM Client — 실제 Claude(OpenRouter/Anthropic) 호출 (Phase 10)
//
//   Phase 8 의 renderFromPlan(Mock 템플릿)을 실제 LLM 으로 교체하기 위한 HTTP 클라이언트.
//   서버리스 함수를 추가하지 않는다(Vercel 12 functions 한도 유지) — 관리자 브라우저에서
//   직접 호출하는 클라이언트 fetch 다. 기본은 OpenRouter(브라우저 호출 허용).
//
//   ⚠️ 보안: VITE_ 환경변수는 브라우저 번들에 노출된다. 키가 설정되지 않으면 LLM 경로는
//   전혀 동작하지 않고(isLLMConfigured=false) 기존 Mock 렌더러로 폴백한다 — 즉 "옵트인,
//   기본 OFF" 다. 활성화 시에는 반드시 사용 한도가 제한된 OpenRouter 키를 권장한다.
//
//   Timeout / Retry / AbortController / Rate Limit / Error Handling 을 모두 포함한다.
// ════════════════════════════════════════════════════════════════════

// Vite(import.meta.env)와 Node(process.env) 양쪽에서 안전하게 환경변수 읽기.
function readEnv() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) return import.meta.env;
  } catch { /* import.meta 미지원 환경 */ }
  if (typeof process !== "undefined" && process.env) return process.env;
  return {};
}
const ENV = readEnv();

const PROVIDER = (ENV.VITE_LLM_PROVIDER || "openrouter").toLowerCase();
const API_KEY  = ENV.VITE_LLM_API_KEY || ENV.VITE_OPENROUTER_API_KEY || "";
const MODEL    = ENV.VITE_LLM_MODEL || (PROVIDER === "anthropic" ? "claude-3-5-sonnet-latest" : "anthropic/claude-3.5-sonnet");
const BASE_URL = ENV.VITE_LLM_BASE_URL || (PROVIDER === "anthropic" ? "https://api.anthropic.com" : "https://openrouter.ai/api/v1");
const TIMEOUT_MS  = Number(ENV.VITE_LLM_TIMEOUT_MS) || 30000;
const MAX_RETRIES = Number.isFinite(Number(ENV.VITE_LLM_MAX_RETRIES)) ? Number(ENV.VITE_LLM_MAX_RETRIES) : 2;

// 키가 있어야만 LLM 경로를 켠다(없으면 항상 Mock 폴백).
export function isLLMConfigured() {
  return Boolean(API_KEY);
}

export const DEFAULT_MODEL = MODEL;

export function llmConfig() {
  return { provider: PROVIDER, model: MODEL, configured: isLLMConfigured(), timeoutMs: TIMEOUT_MS, maxRetries: MAX_RETRIES };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 재시도 대상 판단 — 429(rate limit)·5xx·네트워크 오류만 재시도. 4xx(그 외)는 즉시 실패.
function isRetryable(status) {
  return status === 429 || status === 408 || (status >= 500 && status <= 599);
}

class LLMError extends Error {
  constructor(message, { status = 0, retryable = false } = {}) {
    super(message);
    this.name = "LLMError";
    this.status = status;
    this.retryable = retryable;
  }
}

// 외부 signal + 자체 timeout 을 결합한 AbortController.
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

// Provider 별 요청 조립. model 미지정 시 env 기본 모델(Phase 18: 관리자 모델 변경 지원).
function buildRequest({ system, user, temperature, maxTokens, model }) {
  const useModel = model || MODEL;
  if (PROVIDER === "anthropic") {
    return {
      url: `${BASE_URL.replace(/\/$/, "")}/v1/messages`,
      headers: {
        "content-type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        // 브라우저 직접 호출 허용(권장하지 않음 — CORS/키 노출). OpenRouter 사용을 권장.
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: {
        model: useModel,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: "user", content: user }],
      },
      extractText: (json) => (Array.isArray(json?.content) ? json.content.map((c) => c?.text || "").join("") : ""),
    };
  }
  // OpenRouter / OpenAI 호환.
  return {
    url: `${BASE_URL.replace(/\/$/, "")}/chat/completions`,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_KEY}`,
      "http-referer": ENV.VITE_PUBLIC_ORIGIN || "https://gonggan.market",
      "x-title": "Gonggan Space Lounge",
    },
    body: {
      model: useModel,
      temperature,
      max_tokens: maxTokens,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: user },
      ],
    },
    extractText: (json) => json?.choices?.[0]?.message?.content || "",
  };
}

// LLM 호출 — 성공 시 응답 텍스트 문자열 반환. 실패 시 LLMError throw(호출부가 Mock 폴백).
//   opts: { system, user, temperature=0.7, maxTokens=1600, signal }
export async function callLLM({ system = "", user = "", temperature = 0.7, maxTokens = 1600, model = null, signal = null } = {}) {
  if (!isLLMConfigured()) throw new LLMError("LLM not configured", { status: 0, retryable: false });
  if (!user.trim()) throw new LLMError("empty prompt", { status: 0, retryable: false });

  const req = buildRequest({ system, user, temperature, maxTokens, model });
  let lastErr = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const { controller, cleanup } = makeController(signal);
    try {
      const res = await fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal: controller.signal });
      cleanup();
      if (!res.ok) {
        const retryable = isRetryable(res.status);
        // Rate limit — Retry-After 존중 후 백오프.
        if (retryable && attempt < MAX_RETRIES) {
          const ra = Number(res.headers.get("retry-after"));
          const backoff = Number.isFinite(ra) && ra > 0 ? ra * 1000 : Math.min(800 * 2 ** attempt, 8000);
          lastErr = new LLMError(`HTTP ${res.status}`, { status: res.status, retryable: true });
          await sleep(backoff);
          continue;
        }
        throw new LLMError(`LLM HTTP ${res.status}`, { status: res.status, retryable });
      }
      const json = await res.json();
      const text = req.extractText(json);
      if (!text || !text.trim()) throw new LLMError("empty LLM response", { status: 200, retryable: false });
      return text;
    } catch (e) {
      cleanup();
      const aborted = e?.name === "AbortError";
      lastErr = e instanceof LLMError ? e : new LLMError(aborted ? "LLM timeout/abort" : (e?.message || "network error"), { status: 0, retryable: !aborted });
      // 네트워크/타임아웃 — 남은 재시도가 있으면 백오프 후 재시도.
      if (lastErr.retryable && attempt < MAX_RETRIES) {
        await sleep(Math.min(800 * 2 ** attempt, 8000));
        continue;
      }
      throw lastErr;
    }
  }
  throw lastErr || new LLMError("LLM failed", { status: 0, retryable: false });
}

export { LLMError };
