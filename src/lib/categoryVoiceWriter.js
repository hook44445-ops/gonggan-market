// ════════════════════════════════════════════════════════════════════
// 공간라운지 Category Voice Writer + Raw Knowledge Mode (Phase 8)
//
//   기존 generateDraft(공간 관점 강제 템플릿, Phase 1)는 그대로 두고(무수정), 카테고리
//   본질에 맞는 초안을 만드는 "다른 모드"를 추가한다. 억지 공간 연결을 하지 않는다.
//
//   두 가지 모드:
//     · voice : 카테고리 voice(톤/구성)에 맞춰 자연스럽게 작성
//     · raw   : Raw Knowledge Mode — 꾸미지 않은 원석 지식(오늘 무슨 일/왜 중요/핵심/…)
//
//   LLM Ready 구조: buildWritePlan(계획) → buildPrompt(LLM 프롬프트) → renderFromPlan(결정론 렌더).
//   지금은 renderFromPlan(템플릿)을 쓰고, 나중에 LLM 응답으로 renderFromPlan 만 교체하면 된다.
// ════════════════════════════════════════════════════════════════════

import { voiceFor } from "../constants/categoryVoice.js";
import { classifyCategory } from "../constants/aiContentFactory.js";
import { stripForcedSpaceLinks } from "./forcedSpaceLinkFilter.js";

const RAW_SECTIONS = ["오늘 무슨 일이 있었나", "왜 중요한가", "핵심 포인트", "앞으로 볼 것", "참고 키워드", "후속 콘텐츠 후보"];

// 1) 생성 계획(스펙) — LLM 교체 지점. 무엇을/어떤 톤으로/어떤 구성으로 쓸지 결정만 한다.
export function buildWritePlan({ issue, category, region = null, mode = "voice" } = {}) {
  const topic = String(issue ?? "").trim() || "이야기";
  const cat = category || classifyCategory(topic);
  const voice = voiceFor(cat, topic);
  const m = mode === "raw" ? "raw" : "voice";
  return { topic, category: cat, region, mode: m, voice, sections: m === "raw" ? RAW_SECTIONS : voice.sections };
}

// 2) LLM 프롬프트(향후 Claude/OpenAI 교체용) — 지금은 호출하지 않지만 구조로 분리해둔다.
export function buildPrompt(plan) {
  return [
    `주제: ${plan.topic}`,
    `카테고리: ${plan.category}`,
    `톤: ${plan.voice.tone}`,
    plan.mode === "raw"
      ? "형식: Raw Knowledge — 오늘 무슨 일/왜 중요/핵심 포인트/앞으로 볼 것/참고 키워드/후속 후보. 꾸미지 말 것."
      : `구성: ${plan.sections.join(" → ")}`,
    plan.voice.spaceLinkPolicy === "none"
      ? "규칙: '공간'에 억지로 연결하지 말 것. 카테고리 본질에 충실할 것."
      : "규칙: 공간 연결은 자연스러울 때만. 억지 상투구 금지.",
  ].join("\n");
}

// 섹션 본문 생성(결정론 템플릿) — 제목 키워드로 형식(리스트/문단)을 고른다.
function renderSection(title, topic, voice) {
  const t = topic;
  if (/체크|확인|준비|핵심 포인트|공부법|실천|팁/.test(title)) {
    return [
      `## ${title}`,
      `- ${t}에서 먼저 볼 지점을 하나 정하기`,
      `- 지금 당장 할 것과 뒤로 미뤄도 되는 것 나누기`,
      `- 믿을 만한 근거·사례를 하나 이상 확인하기`,
    ].join("\n");
  }
  if (/비용|주의/.test(title)) {
    return [`## ${title}`, `${t}은(는) 상황에 따라 편차가 큽니다. 무리한 결정을 미루고, 비교와 기록으로 판단 근거를 남겨두면 후회가 줄어듭니다.`].join("\n");
  }
  if (/키워드/.test(title)) {
    return [`## ${title}`, `\`${t}\` 관련해 더 찾아볼 검색어를 메모해두면 다음 글이 쉬워집니다.`].join("\n");
  }
  if (/후속|앞으로 볼 것|전망/.test(title)) {
    return [`## ${title}`, `${t}은(는) 한 번에 끝나는 주제가 아닙니다. 이어질 변화와 후속 이야기를 지켜볼 가치가 있습니다.`].join("\n");
  }
  // 톤별 일반 문단.
  const flavor = {
    empathy:        `${t}은(는) 정답이 있는 문제가 아닙니다. 지금 마음이 어떤지부터 가만히 들여다봐도 괜찮습니다.`,
    insight_light:  `${t}을(를) 너무 진지하게 말고, 가볍게 그러나 한 뼘 더 깊이 들여다보면 재미가 생깁니다.`,
    informational:  `${t}에 대해 알아두면 유용한 정보를 담담하게 정리합니다. 과장 없이, 사실 위주로.`,
    contemplative:  `${t}을(를) 조용히 들여다봅니다. 문화와 역사의 결을 따라가면 오늘의 의미가 달라 보입니다.`,
    analytical:     `${t}을(를) 감정이 아니라 데이터로 봅니다. 단정 대신 균형 잡힌 관점을 유지합니다.`,
    experiential:   `${t}에서 직접 겪은 것을 생생하게 남깁니다. 숫자보다 장면이 기억에 남습니다.`,
    careful_health: `${t}은(는) 일반적인 정보일 뿐이며, 몸 상태는 사람마다 다릅니다. 필요하면 전문가와 상담하세요.`,
    practical:      `${t}을(를) 실용적으로 정리합니다. 바로 써먹을 수 있는 것 위주로.`,
    general:        `${t}에 대해 편안하게 이야기해봅니다.`,
  }[voice.id] || `${t}에 대해 이야기합니다.`;
  return [`## ${title}`, flavor].join("\n");
}

// 3) 결정론 렌더 — 계획을 실제 본문으로. (LLM 붙으면 이 함수만 교체)
export function renderFromPlan(plan) {
  const { topic, voice, sections, region, mode } = plan;
  const regionPrefix = region ? `${region} ` : "";
  const title = mode === "raw"
    ? `[오늘의 지식] ${regionPrefix}${topic}`
    : `${regionPrefix}${topic}`;

  const introByVoice = {
    empathy:        `요즘 ${topic}으로 마음이 복잡한 분들이 있습니다. 오늘은 관계와 마음의 흐름을 함께 짚어봅니다.`,
    insight_light:  `${topic}, 가볍게 보면 재밌고 깊게 보면 통찰이 있습니다.`,
    informational:  `${topic}을(를) 준비하는 분들을 위해 핵심 정보를 정리했습니다.`,
    contemplative:  `${topic}을(를) 조용히 들여다보는 시간입니다.`,
    analytical:     `${topic}, 무슨 일이 있었고 왜 중요한지 데이터 관점에서 살펴봅니다.`,
    experiential:   `${topic} 이야기를 경험 그대로 나눠봅니다.`,
    careful_health: `${topic}에 대해 일반적으로 알려진 정보를 조심스럽게 정리합니다.`,
    practical:      `${topic}을(를) 바로 써먹을 수 있게 실용적으로 정리했습니다.`,
    general:        `${topic}에 대해 편하게 이야기해봅니다.`,
  };

  const body = mode === "raw"
    ? [
        `${topic}에 대한 원석 그대로의 지식 메모입니다. 다듬기 전이라도 알아둘 값어치가 있습니다.`,
        "",
        ...RAW_SECTIONS.flatMap((sec) => [renderSection(sec, topic, voice), ""]),
      ].join("\n").trim()
    : [
        introByVoice[voice.id] || `${topic}에 대해 이야기합니다.`,
        "",
        ...sections.flatMap((sec) => [renderSection(sec, topic, voice), ""]),
      ].join("\n").trim();

  return { title, content: body };
}

// 4) 최종 초안 — 계획→렌더→(정책상 억지 공간연결 정리). generateDraft 와 같은 반환 형태 + voice/mode.
export function generateVoicedDraft(args = {}) {
  const plan = buildWritePlan(args);
  let { title, content } = renderFromPlan(plan);
  let stripped = 0;
  if (plan.voice.spaceLinkPolicy !== "natural") {
    const r = stripForcedSpaceLinks(content);
    content = r.text;
    stripped = r.removed;
  }
  return {
    title,
    content,
    category: plan.category,
    tags: [plan.topic, plan.category].filter(Boolean),
    voice: { id: plan.voice.id, label: plan.voice.label, tone: plan.voice.tone, spaceLinkPolicy: plan.voice.spaceLinkPolicy, area: plan.voice.area },
    mode: plan.mode,
    strippedForcedLinks: stripped,
  };
}
