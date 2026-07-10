// ════════════════════════════════════════════════════════════════════
// 공간마켓 AI 회의실 — AI 협업 심의 로그 + 의견충돌 조정 (Phase 30 · V3)
//
//   AI 들이 "회의"를 한다: 총괄비서가 안건을 열면 담당 후보들이 의견을 내고, 서로 다른
//   관점(심층 vs 검색유입 vs 팩트)이 충돌하면 총괄비서가 최종 구성(Fusion)을 선택한다.
//   실제로 모델이 대화하는 것이 아니라, 콘텐츠 특성 기반의 결정론적 "심의 로그"를 조립한다.
//
//   ⚠️ 기존 엔진 무수정: recommend(aiRecommend)·planFusion(aiFusion)·조직도(aiOrg)를 호출만.
//   Regression Zero: 순수 함수 · DB/API/Cron 없음.
// ════════════════════════════════════════════════════════════════════

import { recommend } from "./aiRecommend.js";
import { planFusion } from "./aiFusion.js";
import { DEPARTMENTS } from "./aiOrg.js";

// 직원별 회의 발언 템플릿(역할 특성 반영).
function speakerLine(staff, role, analysis) {
  const p = staff.provider;
  if (role.includes("검수")) return "발행 전에 팩트와 품질을 제가 검수하겠습니다.";
  if (p === "gemini") return analysis.urgent ? "최신 뉴스·팩트가 관건입니다. 속보로 제가 빠르게 씁니다." : "최신 자료와 팩트를 보강하겠습니다.";
  if (p === "gpt") return "검색 유입이 중요합니다. SEO(제목·키워드)를 제가 강화하겠습니다.";
  if (p === "openrouter" && /grok/i.test(staff.model)) return "SNS 공유 문구는 제가 짧고 강하게 만들겠습니다.";
  if (analysis.deep) return "이번 건은 심층으로 가야 합니다. 원고는 제가 맡겠습니다.";
  return "원고 작성은 제가 담당하겠습니다.";
}

// 안건 회의를 연다. 반환: { topic, contentType, log:[{speaker, model, role, line, provider}], conflict, decision }
export function holdMeeting(topic) {
  const t = String(topic || "").trim();
  const rec = recommend(t);
  const fusion = planFusion(t, { contentType: rec.contentType });
  const analysis = { urgent: rec.urgent, deep: rec.deep, seo: rec.seo };

  const log = [];
  log.push({ speaker: DEPARTMENTS.orchestrator.name, model: "-", role: "Orchestrator", provider: "orchestrator",
    line: `"${t || "새 안건"}" 안건을 개회합니다. 유형은 ${rec.contentLabel}, 담당과 구성을 정합니다.` });

  for (const s of fusion.stages) {
    log.push({ speaker: s.staff, model: s.model, role: s.role, provider: s.provider,
      line: speakerLine({ provider: s.provider, model: s.model }, s.role, analysis) });
  }

  // 의견충돌 — 심층/검색/팩트 관점이 동시에 있으면 총괄비서가 조합을 선택.
  const positions = [];
  if (analysis.deep) positions.push({ who: "심층파", stance: "깊이 있는 분석 우선" });
  if (analysis.seo) positions.push({ who: "검색유입파", stance: "SEO·검색 노출 우선" });
  if (analysis.urgent) positions.push({ who: "팩트파", stance: "속도·팩트 우선" });
  const conflict = positions.length >= 2
    ? { hasConflict: true, positions, resolution: `총괄비서: 관점이 갈립니다 → 조합으로 해결. 최종 구성 "${fusion.summary}".` }
    : { hasConflict: false, positions, resolution: `총괄비서: 이견 없음 → "${fusion.summary}" 로 진행.` };

  log.push({ speaker: DEPARTMENTS.orchestrator.name, model: "-", role: "Decision", provider: "orchestrator", line: conflict.resolution });

  return {
    topic: t, contentType: rec.contentType, contentLabel: rec.contentLabel,
    log, conflict,
    decision: { fusion: fusion.summary, mode: fusion.modeLabel, primary: rec.staff.name, estCostKRW: rec.estCostKRW, quality: rec.staff.qualityLabel },
  };
}
