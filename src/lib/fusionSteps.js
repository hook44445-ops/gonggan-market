// ════════════════════════════════════════════════════════════════════
// 공간마켓 Fusion Steps — 단계별 프롬프트 조립 (Phase 31)
//
//   Fusion 각 단계(원고→SEO→교정→검수 등)의 system/user 프롬프트를 만든다.
//   각 단계는 "이전 단계 결과(prev)"를 입력으로 받아 이어서 개선한다(순차 체이닝).
//
//   ⚠️ 기존 프롬프트/엔진 무수정. 이 파일은 Fusion 전용 프롬프트만 만든다(additive).
//   순수 함수 · DB/API 없음.
// ════════════════════════════════════════════════════════════════════

const SYS = "당신은 공간마켓(공간라운지)의 전문 에디터입니다. 과장·상투어·AI 티를 피하고, 담백하고 신뢰감 있게 씁니다.";

// role 키워드 → 단계 유형.
function kind(role) {
  const r = String(role || "");
  if (/SEO/i.test(r)) return "seo";
  if (/교정/.test(r)) return "proof";
  if (/검수|팩트|데스킹/.test(r)) return "review";
  if (/SNS|카피/.test(r)) return "sns";
  if (/요약/.test(r)) return "summary";
  return "draft";
}

// 단계 프롬프트. { system, user }
export function buildStagePrompt(role, { topic, prev = "", region = null } = {}) {
  const k = kind(role);
  const t = String(topic || "").trim();
  const base = prev ? `\n\n[이전 단계 결과]\n${prev}` : "";
  if (k === "seo") {
    return { system: SYS, user: `다음 글의 검색 노출(SEO)을 강화하라. 제목을 매력적·명확하게 다듬고, 핵심 키워드를 자연스럽게 배치하며, 소제목(##) 구조를 정리하라. 의미는 유지하되 전체 본문을 다시 완성해 출력하라.${base}` };
  }
  if (k === "proof") {
    return { system: SYS, user: `다음 글을 문장·리듬·가독성 관점에서 교정하라. 어색한 표현·중복·상투어를 다듬고, 첫 줄은 제목으로 유지하라. 교정된 전체 본문을 출력하라.${base}` };
  }
  if (k === "review") {
    return { system: SYS, user: `다음 글을 사실관계·품질 관점에서 최종 검수하라. 과장/근거 부족 표현을 보정하고, 제목을 첫 줄에 유지한 채 발행 가능한 최종본을 출력하라.${base}` };
  }
  if (k === "sns") {
    return { system: SYS, user: `다음 글을 바탕으로 SNS 공유용 짧고 강한 카피 3개를 작성하라(각 2~3문장, 해시태그 포함).${base}` };
  }
  if (k === "summary") {
    return { system: SYS, user: `다음 주제로 핵심을 요약한 원고를 작성하라. 첫 줄은 제목.\n주제: ${t}${base}` };
  }
  // draft — 첫 단계 원고.
  return { system: SYS, user: `아래 주제로 매거진 수준의 글을 작성하라. 첫 줄은 제목, 이후 본문(소제목 ## 사용). 담백하고 구체적으로.${region ? ` 지역 맥락: ${region}.` : ""}\n주제: ${t}` };
}
