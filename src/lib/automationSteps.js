// ════════════════════════════════════════════════════════════════════
// 공간마켓 Automation Steps — 리서치/SEO/이미지/검수 단계 (Phase 32)
//
//   각 단계는 기존 엔진을 "호출만" 한다:
//     - 리서치: 기존 callLLM(OpenRouter, Perplexity 슬러그 시도 → 실패 시 자동 대체)
//     - SEO:    기존 blogPublisher.buildBlogSeo 재사용
//     - 검수:   기존 autoPublishGate.evaluateGate + shareability.scoreShareability 재사용
//     - 이미지: 이미지 생성 모델 미연결 → "이미지 프롬프트"만 생성(정직한 범위)
//
//   ⚠️ 기존 엔진 무수정. DB/API/ENV 변경 없음. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { callLLM } from "./llmClient.js";
import { buildBlogSeo } from "./blogPublisher.js";
import { evaluateGate } from "./autoPublishGate.js";
import { scoreShareability } from "./shareability.js";
import { classifyContentType } from "./contentTypes.js";

// 1) 자동 리서치 — 참고자료 노트를 만든다(기존 OpenRouter 구조). 실패해도 작성은 진행.
export async function autoResearch(topic, { signal = null } = {}) {
  const t = String(topic || "").trim();
  if (!t) return { notes: "", ok: false };
  try {
    const { text } = await callLLM({
      system: "당신은 공간마켓의 리서처입니다. 사실 중심으로 간결히 정리합니다.",
      user: `주제 "${t}" 에 대해 글 작성에 쓸 핵심 사실·배경·수치·관점을 5~8개 불릿으로 정리하라. 확실하지 않은 것은 표시하라.`,
      model: "perplexity/llama-3.1-sonar-large-128k-online", // 미가용 시 callLLM 내부 대체
      temperature: 0.4, maxTokens: 700, signal,
    });
    return { notes: (text || "").trim(), ok: true };
  } catch (e) {
    return { notes: "", ok: false, error: e?.message ?? String(e) };
  }
}

// 2) 자동 SEO — 기존 blogPublisher.buildBlogSeo 재사용(제목/메타/키워드/태그/카테고리 + slug).
export function autoSeo({ title, body, contentType } = {}) {
  const seo = buildBlogSeo({ title, content: body, contentType: contentType || classifyContentType(title || "") });
  const slug = String(title || "")
    .toLowerCase().replace(/[^\w가-힣\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || `post-${Date.now()}`;
  return { ...seo, slug };
}

// 3) 자동 이미지 — 이미지 프롬프트 생성(실제 이미지 생성 모델은 향후 편입).
export function autoImagePrompt({ title, body } = {}) {
  const t = String(title || "").trim();
  const hint = String(body || "").replace(/[#*>\-]/g, " ").replace(/\s+/g, " ").slice(0, 80);
  return {
    prompt: `Editorial cover image for "${t}". Clean, warm, trustworthy Korean lifestyle/space magazine style, soft natural light, no text. Context: ${hint}`,
    model: "(미연결: GPT Image / Flux 편입 시 자동)", note: "이미지 프롬프트만 생성됨 — 실제 생성은 이미지 모델 편입 후",
  };
}

// 4) 자동 검수 — 기존 게이트 + shareability 로 종합 점수(92/95/98 식).
export function autoReview({ title, body, contentType, existing = [] } = {}) {
  const gate = evaluateGate(
    { title, content: body, ai_topic: title },
    { confidence: null, existing, stage: null, cfg: { testMode: true, minBodyLength: 500 } }
  );
  const sh = scoreShareability({ title, body, contentType: contentType || classifyContentType(title || "") });
  const editorial = gate.quality ?? 0;
  // 종합: 유용성(게이트) 0.6 + 공유성 0.4, 검사 통과 시 소폭 가산.
  const composite = Math.min(99, Math.round(editorial * 0.6 + sh.shareScore * 0.4 + (gate.pass ? 3 : 0)));
  return {
    editorial, seo: null, share: sh.shareScore, composite,
    pass: gate.pass, reasons: gate.reasons, warnings: gate.warnings || [],
  };
}
