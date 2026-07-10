// ════════════════════════════════════════════════════════════════════
// 공간마켓 AI Fusion — 다중 AI 자동 조합 플랜 (Phase 29 · V2)
//
//   콘텐츠 특성에 따라 1~3개 AI 를 자동 조합한다.
//     예) 매거진: Claude(원고) → GPT(SEO) → Gemini(검수)
//         SNS   : Claude(원고) → Grok(SNS 변환)
//         속보  : Gemini(속보) → Claude(검수)
//   각 단계는 "직원(AI)"과 "역할"로 구성된다. 실제 실행은 기존 생성 엔진을 단계별로 호출만 한다.
//
//   ⚠️ 기존 호출 구조 무변경. 이 파일은 "조합 플랜"을 만든다(실행은 관리자 승인 하에 기존 엔진 재사용).
//   Regression Zero: 순수 함수 · DB/API 없음.
// ════════════════════════════════════════════════════════════════════

import { classifyContentType } from "./contentTypes.js";
import { getStaff } from "./aiOrg.js";

const stage = (staffId, role) => { const s = getStaff(staffId); return s ? { role, staffId, staff: s.name, model: s.model, provider: s.provider, connected: s.connected } : null; };

// 콘텐츠 유형 → Fusion 프리셋(단계 배열). 존재하는 직원만 남긴다.
function presetFor(contentType) {
  const ct = String(contentType || "");
  if (/magazine|space_market|series|column/.test(ct)) return [["claude_magazine", "원고 작성"], ["gpt_seo", "SEO 보강"], ["claude_reviewer", "검수·데스킹"]];
  if (/breaking|trend/.test(ct))                       return [["gemini_breaking", "속보 작성"], ["claude_reviewer", "팩트 검수"]];
  if (/morning_brief|seo|info/.test(ct))               return [["gpt_seo", "SEO 정리"], ["claude_reviewer", "검수"]];
  if (/sns/.test(ct))                                  return [["claude_magazine", "원고 요약"], ["grok_sns", "SNS 카피"]];
  if (/qt|astrology/.test(ct))                         return [["claude_magazine", "작성"]];
  return [["claude_magazine", "원고 작성"], ["claude_reviewer", "검수"]];
}

export const FUSION_MODES = { single: "단독", dual: "2-AI", triple: "3-AI", chain: "체인" };

// 주제/유형 → Fusion 플랜. 반환: { contentType, mode, stages:[{role, staff, model, provider, connected}], summary }
export function planFusion(topicOrType, { contentType = null } = {}) {
  const ct = contentType || classifyContentType(topicOrType);
  const stages = presetFor(ct).map(([id, role]) => stage(id, role)).filter(Boolean);
  const n = stages.length;
  const mode = n <= 1 ? "single" : n === 2 ? "dual" : n === 3 ? "triple" : "chain";
  const summary = stages.map((s) => `${s.staff}(${s.role})`).join(" → ");
  return { contentType: ct, mode, modeLabel: FUSION_MODES[mode], stages, summary };
}

// 플랜 실행 계획(관리자 승인용 · 실제 호출은 호출부가 기존 엔진으로 단계 수행).
//   각 단계의 provider 를 기존 generateForWorkbench 호환값으로 매핑(openrouter 전용은 claude 폴백).
export function fusionRunPlan(plan) {
  if (!plan?.stages?.length) return [];
  return plan.stages.map((s) => ({
    role: s.role, staff: s.staff, model: s.model,
    provider: ["claude", "gpt", "gemini"].includes(s.provider) ? s.provider : "claude",
    connected: s.connected,
  }));
}
