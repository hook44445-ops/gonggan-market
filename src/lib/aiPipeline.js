// ════════════════════════════════════════════════════════════════════
// 공간마켓 AI 자동 파이프라인 — 전체 흐름 시각화 데이터 (Phase 29 · V2)
//
//   주제 입력 → AI 분석 → AI 추천 → Fusion → 본문 작성 → SEO → 이미지 → 검수 →
//   미리보기 → 승인 → 예약 → 자동발행. 각 단계의 상태/담당/자동화 여부를 조립한다.
//
//   ⚠️ 기존 발행/예약/통계 로직 무변경. 이 파일은 "파이프라인 뷰"만 만든다(시각화).
//   Regression Zero: 순수 함수 · DB/API/Cron 없음.
// ════════════════════════════════════════════════════════════════════

import { isLLMConfigured } from "./llmClient.js";

// 파이프라인 12단계 정의. auto=현재 자동 수행 여부, actor=담당.
export const PIPELINE_STAGES = [
  { id: "topic",    label: "주제 입력",   icon: "✍️", actor: "관리자/AI", auto: true },
  { id: "analyze",  label: "AI 분석",     icon: "🔎", actor: "총괄비서", auto: true },
  { id: "recommend",label: "AI 추천",     icon: "🎯", actor: "총괄비서", auto: true },
  { id: "fusion",   label: "Fusion 구성", icon: "🧩", actor: "총괄비서", auto: true },
  { id: "write",    label: "본문 작성",   icon: "📝", actor: "편집국",   auto: true },
  { id: "seo",      label: "SEO",         icon: "🔑", actor: "지원실",   auto: true },
  { id: "image",    label: "이미지",      icon: "🖼️", actor: "지원실",   auto: false, note: "향후(이미지 모델 편입 시)" },
  { id: "review",   label: "검수",        icon: "🔍", actor: "지원실",   auto: true },
  { id: "preview",  label: "미리보기",    icon: "👀", actor: "관리자",   auto: true },
  { id: "approve",  label: "승인",        icon: "✅", actor: "관리자",   auto: false, note: "관리자 최종 승인(사람)" },
  { id: "schedule", label: "예약",        icon: "🗓️", actor: "운영실",   auto: true },
  { id: "publish",  label: "자동발행",    icon: "🚀", actor: "운영실",   auto: true },
];

// 현재 설정 기준 파이프라인 뷰. autoPublishEnabled 등은 호출부가 주입(기존 로직 재사용).
//   반환: { stages:[{...,ready}], readyCount, total, llmReady }
export function pipelineView({ autoPublishEnabled = false } = {}) {
  const llmReady = isLLMConfigured();
  const stages = PIPELINE_STAGES.map((s) => {
    let ready = s.auto;
    if (["analyze", "recommend", "fusion", "write", "seo", "review"].includes(s.id)) ready = llmReady; // LLM 필요 단계
    if (s.id === "schedule" || s.id === "publish") ready = autoPublishEnabled; // 자동발행 설정 필요
    if (s.id === "approve") ready = true; // 사람 승인은 항상 가능
    return { ...s, ready };
  });
  return { stages, readyCount: stages.filter((s) => s.ready).length, total: stages.length, llmReady };
}
