// ════════════════════════════════════════════════════════════════════
// 공간마켓 AI 자동 추천 — 주제 분석 → 담당 AI 자동 선정 (Phase 29 · V2)
//
//   사용자는 주제만 입력한다. 총괄비서(Orchestrator)가 콘텐츠 종류·길이·SEO·긴급성·예상 비용·
//   예상 품질을 분석해 담당 AI(직원)를 자동 추천한다. 관리자는 승인만 한다.
//
//   ⚠️ 기존 엔진 무수정: classifyContentType(contentTypes)·staffForContentType(aiOrg)를 호출만.
//   Regression Zero: 순수 함수 · DB/API 없음.
// ════════════════════════════════════════════════════════════════════

import { classifyContentType, contentTypeMeta } from "./contentTypes.js";
import { staffForContentType, getStaff } from "./aiOrg.js";

// OpenRouter 상대 단가(입력/출력, USD per 1M) 근사 — 예상 비용 티어 산정용(표시 목적).
const PRICE = {
  "anthropic/claude-3.5-sonnet": [3, 15],
  "google/gemini-flash-1.5":     [0.075, 0.3],
  "openai/gpt-4o-mini":          [0.15, 0.6],
  "x-ai/grok-2-1212":            [2, 10],
  "deepseek/deepseek-chat":      [0.14, 0.28],
  "qwen/qwen-2.5-72b-instruct":  [0.35, 0.4],
};
const USD_TO_KRW = 1350;

// 주제 길이/키워드로 예상 분량·긴급성·SEO 성격 추정.
function analyze(topic, { contentType } = {}) {
  const t = String(topic || "");
  const ct = contentType || classifyContentType(t);
  const urgent = /속보|긴급|발표|사고|재난|급등|급락|규제|판결/.test(t) || ct === "breaking";
  const seo = /morning_brief/.test(ct) || /정리|헤드라인|요약|가이드|방법|정보/.test(t);
  const deep = /magazine|space_market|series|column/.test(ct) || /심층|분석|칼럼|인터뷰|스토리/.test(t);
  const targetChars = deep ? 2500 : seo ? 900 : urgent ? 700 : 1200;
  return { contentType: ct, urgent, seo, deep, targetChars };
}

// 예상 비용(KRW) — 목표 분량 기준 토큰 근사(1토큰≈2.5자, 출력=본문, 입력≈600토큰).
function estCostKRW(model, targetChars) {
  const [pin, pout] = PRICE[model] || [1, 3];
  const outTok = Math.round(targetChars / 2.5);
  const inTok = 600;
  return Math.max(1, Math.round(((inTok / 1e6) * pin + (outTok / 1e6) * pout) * USD_TO_KRW));
}

// 주제 → 추천. 반환: { staff, contentType, contentLabel, urgent, seo, deep, targetChars, estCostKRW, reasons[] }
export function recommend(topic, opts = {}) {
  const a = analyze(topic, opts);
  const staff = staffForContentType(a.contentType);
  const cost = estCostKRW(staff.model, a.targetChars);
  const reasons = [];
  reasons.push(`유형: ${contentTypeMeta(a.contentType).label}`);
  if (a.urgent) reasons.push("긴급성 높음 → 빠른 모델 우선");
  if (a.deep) reasons.push("심층/분석형 → 고품질 모델");
  if (a.seo) reasons.push("SEO/정보형 → 정리 특화 모델");
  reasons.push(`담당: ${staff.name}(${staff.model.split("/").pop()})`);
  reasons.push(`예상 분량 ~${a.targetChars}자 · 예상 비용 ₩${cost} · 품질 ${staff.qualityLabel}`);
  return { staff, contentType: a.contentType, contentLabel: contentTypeMeta(a.contentType).label, urgent: a.urgent, seo: a.seo, deep: a.deep, targetChars: a.targetChars, estCostKRW: cost, reasons };
}

// 추천 결과 → 기존 generateForWorkbench 가 이해하는 provider(claude/gpt/gemini) 로 매핑.
//   OpenRouter 전용 슬러그(grok/deepseek/qwen)는 아직 실행 경로 미연결 → claude 로 안전 폴백(표시는 원 직원).
export function providerForStaff(staff) {
  if (!staff) return "claude";
  if (["claude", "gpt", "gemini"].includes(staff.provider)) return staff.provider;
  return "claude"; // openrouter 전용 직원 실행은 향후 확장(키/경로 추가 시). 지금은 Claude 로 안전 처리.
}
