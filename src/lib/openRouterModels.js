// ════════════════════════════════════════════════════════════════════
// OpenRouter 최신 모델 고르기 — 2026-09-26 (대표 「AI 조직도에 AI 가 제대로 연결 · 추천 AI 가 늘 업데이트」)
//
//   예전 조직도는 모델 이름(claude-3.5-sonnet · gemini-flash-1.5 …)이 코드에 박혀 있어 새 모델이 나와도 그대로였다.
//   이제 OpenRouter 공개 모델 목록(키 없이 읽힌다)에서 «역할마다 가장 최근에 나온 모델»을 고른다.
//   서버(api/trend/check-trends?mode=llm_status)가 6시간마다 새로 읽고, 관리자 AI 운영본부·조직도와
//   라운지 글쓰기가 그 결과를 쓴다. 목록을 못 읽으면 아래 기본값.
//   ⚠️ 순수 함수(목록 → 고른 결과). 호출은 serverLoungeWriter 에서.
// ════════════════════════════════════════════════════════════════════

/** 역할(조직도 직원 id) → 계열. match 에 맞는 모델 중 가장 최근(created) 것. */
export const ROLE_FAMILIES = {
  claude_magazine:  { match: /^anthropic\/claude-.*sonnet/, fallback: "anthropic/claude-sonnet-5" },
  claude_reviewer:  { match: /^anthropic\/claude-.*sonnet/, fallback: "anthropic/claude-sonnet-5" },
  gemini_breaking:  { match: /^google\/gemini-.*flash/,     fallback: "google/gemini-3.8-flash" },
  gemini_trend:     { match: /^google\/gemini-.*flash/,     fallback: "google/gemini-3.8-flash" },
  gpt_seo:          { match: /^openai\/gpt-.*mini/,         fallback: "openai/gpt-5.4-mini" },
  grok_sns:         { match: /^x-ai\/grok-/,                fallback: "x-ai/grok-4.7" },
  deepseek_analyst: { match: /^deepseek\/deepseek-(chat|v)/, fallback: "deepseek/deepseek-chat" },
  qwen_translator:  { match: /^qwen\/qwen[\d.-]*-.*instruct/, fallback: "qwen/qwen-2.5-72b-instruct" },
};

/* 글쓰기에 맞지 않는 변형(무료·이미지·음성·검색·실험판 등)은 뺀다 */
const SKIP = /:free|:batch|:beta|:thinking|:extended|:online|image|audio|vision|search|preview|exp|embed|lite|nano|guard|tts|realtime|deep-research|codex|-vl-|-vl$|coder|math/i;

/** OpenRouter /api/v1/models 의 data 배열 → { [role]: modelId } */
export function pickLatestModels(list = []) {
  const usable = (Array.isArray(list) ? list : []).filter((m) => m && typeof m.id === "string" && !SKIP.test(m.id));
  const out = {};
  for (const [role, fam] of Object.entries(ROLE_FAMILIES)) {
    const hits = usable.filter((m) => fam.match.test(m.id)).sort((a, b) => (Number(b.created) || 0) - (Number(a.created) || 0));
    out[role] = hits[0]?.id ?? fam.fallback;
  }
  return out;
}

export function defaultModels() {
  return Object.fromEntries(Object.entries(ROLE_FAMILIES).map(([r, f]) => [r, f.fallback]));
}

/* 채용 후보(대표 「추천 AI 가 늘 업데이트」) — 주요 회사의 가장 최근 모델 n개(글쓰기용 변형만) */
const MAKERS = /^(anthropic|openai|google|x-ai|deepseek|qwen|meta-llama|mistralai)\//;
export function pickNewest(list = [], n = 6) {
  return (Array.isArray(list) ? list : [])
    .filter((m) => m && typeof m.id === "string" && MAKERS.test(m.id) && !SKIP.test(m.id))
    .sort((a, b) => (Number(b.created) || 0) - (Number(a.created) || 0))
    .slice(0, n)
    .map((m) => ({ model: m.id, name: m.name || m.id, created: m.created ? new Date(Number(m.created) * 1000).toISOString().slice(0, 10) : null }));
}
