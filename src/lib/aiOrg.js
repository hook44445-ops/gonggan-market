// ════════════════════════════════════════════════════════════════════
// 공간마켓 AI Headquarters — AI 조직도 (Phase 29 · V2)
//
//   AI 를 "직원"으로, 총괄비서(Orchestrator)를 "팀장"으로, 관리자를 "최종 승인자"로 본다.
//   각 직원 = OpenRouter 슬러그 1개. 새 AI 가 나오면 STAFF 에 항목 1개만 추가하면 편입 완료.
//
//   ⚠️ 기존 호출 구조/환경변수/Provider 연결 무변경. 이 파일은 "조직도 데이터"만 정의한다.
//   상태는 기존 OpenRouter 키(isLLMConfigured) 기준으로 표시만 한다(호출 방식 불변).
//   Regression Zero: 순수 데이터/함수 · DB/API/Cron/Migration 없음.
// ════════════════════════════════════════════════════════════════════

import { isLLMConfigured } from "./llmClient.js";
import { providerStatus } from "./llmProviders.js";

// 부서 — AI 총괄비서(Orchestrator) 산하 편집국/운영실/지원실.
export const DEPARTMENTS = {
  orchestrator: { id: "orchestrator", name: "AI 총괄비서", role: "Orchestrator", icon: "🧠", desc: "주제 분석 → 담당 AI 선정 → Fusion 구성 → 파이프라인 지휘" },
  editorial:    { id: "editorial",    name: "AI 편집국",   role: "Editorial",    icon: "📰", desc: "기사·매거진·SNS·블로그 원고 작성" },
  operations:   { id: "operations",   name: "AI 운영실",   role: "Operations",   icon: "⚙️", desc: "트렌드·편성·예약·발행 운영" },
  support:      { id: "support",      name: "AI 지원실",   role: "Support",      icon: "🔍", desc: "검수·팩트체크·SEO·이미지(향후)" },
};

// 비용/품질 티어(표시용). OpenRouter 실단가는 모델별 상이 — 상대 티어로 안내.
const TIER = { low: "낮음", mid: "보통", high: "높음", top: "최상" };

// ── AI 직원 레지스트리 ───────────────────────────────────────────────
//   새 AI 편입: 아래 배열에 { id, name, dept, provider, model(OpenRouter 슬러그), duty, ... } 1줄 추가.
//   provider 는 표시/상태용(claude/gpt/gemini/openrouter). 실제 호출은 기존 구조(OpenRouter) 그대로.
export const AI_STAFF = [
  { id: "claude_magazine", name: "심층 매거진 기자", dept: "editorial", provider: "claude", model: "anthropic/claude-3.5-sonnet", duty: "심층 매거진·칼럼·인터뷰·스토리텔링", defaultFor: ["magazine", "space_market", "series", "column"], cost: "high", quality: "top" },
  { id: "gemini_breaking", name: "속보 기자",        dept: "editorial", provider: "gemini", model: "google/gemini-flash-1.5",     duty: "속보·긴급뉴스·트렌드 요약(빠름)",     defaultFor: ["breaking", "trend_present", "trend_past", "trend_future"], cost: "low", quality: "mid" },
  { id: "gpt_seo",         name: "SEO 에디터",        dept: "support",   provider: "gpt",    model: "openai/gpt-4o-mini",           duty: "SEO 정리·정보형·Morning Brief",       defaultFor: ["morning_brief", "seo", "info"], cost: "low", quality: "mid" },
  { id: "grok_sns",        name: "SNS 카피라이터",     dept: "editorial", provider: "openrouter", model: "x-ai/grok-2-1212",         duty: "SNS·짧고 강한 문장·바이럴 카피",       defaultFor: ["sns"], cost: "mid", quality: "mid" },
  { id: "claude_reviewer", name: "검수 데스크",        dept: "support",   provider: "claude", model: "anthropic/claude-3.5-sonnet", duty: "팩트/품질 검수·최종 데스킹",           defaultFor: ["review"], cost: "high", quality: "top" },
  { id: "gemini_trend",    name: "트렌드 스카우트",    dept: "operations",provider: "gemini", model: "google/gemini-flash-1.5",     duty: "트렌드 발굴·편성 후보·발행 타이밍",     defaultFor: ["trend"], cost: "low", quality: "mid" },
  // ── 확장 예시(향후 편입 가능) — 상태는 OpenRouter 키/모델 가용성에 따름 ──
  { id: "deepseek_analyst", name: "데이터 분석원",     dept: "support",   provider: "openrouter", model: "deepseek/deepseek-chat",   duty: "데이터·수치 분석·리서치",             defaultFor: ["data"], cost: "low", quality: "mid" },
  { id: "qwen_translator",  name: "다국어 담당",       dept: "support",   provider: "openrouter", model: "qwen/qwen-2.5-72b-instruct", duty: "번역·다국어 콘텐츠",                 defaultFor: ["i18n"], cost: "low", quality: "mid" },
];

const providerConnected = (provider) => {
  // Claude/OpenRouter 라우팅: OpenRouter 키(isLLMConfigured) 있으면 OpenRouter 경유 모델 사용 가능.
  if (provider === "openrouter" || provider === "claude") return isLLMConfigured();
  const st = providerStatus().find((p) => p.id === provider);
  // gpt/gemini 는 별도 키가 있으면 직접, 없어도 OpenRouter 슬러그로 호출 가능(키 있으면).
  return (st && st.connected) || isLLMConfigured();
};

// 직원 1명의 상태(연결/대기).
export function staffStatus(staff) {
  const connected = providerConnected(staff.provider);
  return {
    ...staff,
    deptName: DEPARTMENTS[staff.dept]?.name || staff.dept,
    connected,
    statusLabel: connected ? "Active" : "Standby",
    costLabel: TIER[staff.cost] || staff.cost,
    qualityLabel: TIER[staff.quality] || staff.quality,
  };
}

// 전체 조직도 — 부서별 직원 묶음 + 상태.
export function orgChart() {
  const byDept = {};
  for (const d of Object.keys(DEPARTMENTS)) byDept[d] = [];
  for (const s of AI_STAFF) (byDept[s.dept] ||= []).push(staffStatus(s));
  const activeCount = AI_STAFF.filter((s) => providerConnected(s.provider)).length;
  return {
    orchestrator: DEPARTMENTS.orchestrator,
    departments: Object.values(DEPARTMENTS).filter((d) => d.id !== "orchestrator").map((d) => ({ ...d, staff: byDept[d.id] || [] })),
    totalStaff: AI_STAFF.length,
    activeStaff: activeCount,
  };
}

// id 로 직원 조회.
export function getStaff(id) { const s = AI_STAFF.find((x) => x.id === id); return s ? staffStatus(s) : null; }

// 콘텐츠 유형 → 기본 담당 직원(defaultFor 매칭, 없으면 심층 매거진 기자).
export function staffForContentType(contentType) {
  const t = String(contentType || "");
  const hit = AI_STAFF.find((s) => (s.defaultFor || []).some((k) => t.includes(k) || k === t));
  return staffStatus(hit || AI_STAFF[0]);
}
