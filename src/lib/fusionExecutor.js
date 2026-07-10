// ════════════════════════════════════════════════════════════════════
// 공간마켓 Fusion Executor — 단일 단계 실행 + 모델 Fallback (Phase 31)
//
//   한 단계를 기존 callLLM(OpenRouter) 로 실행한다. 지정 모델이 실패하면
//   Claude → GPT → Gemini → DeepSeek 순으로 대체 시도한다(기존 호출 구조 재사용).
//
//   ⚠️ 기존 llmClient.callLLM 무수정 — model 인자를 넘겨 호출만 한다(additive).
//   DB/API/ENV 변경 없음.
// ════════════════════════════════════════════════════════════════════

import { callLLM } from "./llmClient.js";
import { buildStagePrompt } from "./fusionSteps.js";

// 단계 실패 시 대체 모델 순서(모두 OpenRouter 슬러그 — 기존 키/구조 그대로).
const FALLBACK_CHAIN = [
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o-mini",
  "google/gemini-flash-1.5",
  "deepseek/deepseek-chat",
];

const PRICE = {
  "anthropic/claude-3.5-sonnet": [3, 15], "google/gemini-flash-1.5": [0.075, 0.3],
  "openai/gpt-4o-mini": [0.15, 0.6], "x-ai/grok-2-1212": [2, 10],
  "deepseek/deepseek-chat": [0.14, 0.28], "qwen/qwen-2.5-72b-instruct": [0.35, 0.4],
};
const USD_TO_KRW = 1350;
function costKRW(model, usage) {
  const [pin, pout] = PRICE[model] || [1, 3];
  const inT = Number(usage?.promptTokens) || 0, outT = Number(usage?.completionTokens) || 0;
  return Math.round(((inT / 1e6) * pin + (outT / 1e6) * pout) * USD_TO_KRW);
}

// 한 단계 실행. 반환: { ok, text, role, staff, model, usedModel, fallbackUsed, latencyMs, usage, costKRW, error }
export async function executeStage({ role, staff, model, topic, prev = "", region = null, temperature = 0.85, maxTokens = 2400, signal = null } = {}) {
  const { system, user } = buildStagePrompt(role, { topic, prev, region });
  // 지정 모델 우선, 이후 대체 체인(중복 제거).
  const chain = [model, ...FALLBACK_CHAIN].filter((m, i, a) => m && a.indexOf(m) === i);
  const t0 = Date.now();
  let lastErr = null;
  for (let i = 0; i < chain.length; i++) {
    const useModel = chain[i];
    try {
      const { text, usage } = await callLLM({ system, user, temperature, maxTokens, model: useModel, signal });
      return {
        ok: true, text: (text || "").trim(), role, staff, model,
        usedModel: useModel, fallbackUsed: i > 0,
        latencyMs: Date.now() - t0, usage: usage || {}, costKRW: costKRW(useModel, usage), error: null,
      };
    } catch (e) {
      lastErr = e?.message ?? String(e);
      // 다음 대체 모델로 계속(마지막이면 실패 반환).
    }
  }
  return { ok: false, text: "", role, staff, model, usedModel: null, fallbackUsed: chain.length > 1, latencyMs: Date.now() - t0, usage: {}, costKRW: 0, error: lastErr };
}
