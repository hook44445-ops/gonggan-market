// ─────────────────────────────────────────────────────
// 공간라운지 Editorial Config (Phase 18) — 관리자 조정 가능한 LLM 설정
//   model / temperature / maxTokens 를 관리자 브라우저(localStorage)에서 조정한다.
//   미설정 시 env 기본 모델(DEFAULT_MODEL)과 편집 기본값을 쓴다. DB/API 무관.
// ─────────────────────────────────────────────────────

import { DEFAULT_MODEL } from "./llmClient.js";

const KEY = "editorial_llm_config_v1";

export const EDITORIAL_DEFAULTS = {
  model: DEFAULT_MODEL,
  temperature: 0.85,   // 사람처럼 리듬 다양 → 약간 높게(단정·과장은 프롬프트로 억제)
  maxTokens: 2400,     // 본문 1200~2500자 + JSON 여유
  minConfidence: 90,
  maxRetries: 3,
};

export function getEditorialConfig() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { ...EDITORIAL_DEFAULTS, ...(v && typeof v === "object" ? v : {}) };
  } catch {
    return { ...EDITORIAL_DEFAULTS };
  }
}

export function setEditorialConfig(patch) {
  const next = { ...getEditorialConfig(), ...(patch || {}) };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}
