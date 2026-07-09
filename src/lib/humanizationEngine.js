// ════════════════════════════════════════════════════════════════════
// 공간라운지 Humanization Engine (Phase 19)
//
//   실제 LLM 이 생성한 글에서 "AI 티"를 감지하고, Hook(첫 문단)·Ending(마무리) 다양성과
//   반복 위험을 평가한다. Phase 18 editorialEngine 이 이 결과를 confidence/verdict/retry 에 반영한다.
//
//   순수 함수 · 결정론 · 저장/API 없음.
// ════════════════════════════════════════════════════════════════════

import { BANNED_GPT_PHRASES } from "../constants/editorialPrompt.js";

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const stripMd = (s) => String(s ?? "").replace(/^#{1,6}\s+/gm, "").replace(/^[-•*]\s+/gm, "").replace(/\*\*(.+?)\*\*/g, "$1");
const paragraphs = (body) => String(body).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
const sentences = (s) => stripMd(s).split(/(?<=[.!?。…])\s+|\n+/).map((x) => x.trim()).filter((x) => x.length > 6);
// 본문 산문 "줄"(소제목/목록 제외) — Hook/Ending 은 실제 문장 줄에서 판정한다.
const proseLines = (body) => String(body).split("\n").map((l) => l.trim()).filter((l) => l && !/^#{1,6}\s/.test(l) && !/^[-•*]\s/.test(l));
const firstBodyPara = (body) => proseLines(body)[0] || "";
const lastBodyPara = (body) => { const ls = proseLines(body); return ls[ls.length - 1] || ""; };

// ── AI 티 감지 ───────────────────────────────────────────────────────
export function detectAiTone(body = "") {
  const text = String(body);
  const bodyLen = text.length || 1;
  const phrases = BANNED_GPT_PHRASES.filter((p) => text.includes(p));

  // 같은 문장 반복.
  const sents = sentences(text);
  const seen = new Map();
  let repeatedSentences = 0;
  for (const s of sents) { const k = s.replace(/\s/g, ""); if (k.length < 10) continue; seen.set(k, (seen.get(k) || 0) + 1); }
  for (const [, c] of seen) if (c > 1) repeatedSentences += c - 1;

  // 문단 구조 반복 — 문단들이 같은 어절로 시작.
  const ps = paragraphs(text).filter((p) => !/^#{1,6}\s/.test(p));
  const openings = ps.map((p) => p.slice(0, 6));
  const repeatedStructure = new Set(openings).size < Math.max(1, openings.length) - 1 && openings.length >= 3;

  // 결론을 너무 빨리 — 앞부분 30% 안에 "결론/요약/정리하면/한마디로".
  const head = text.slice(0, Math.floor(bodyLen * 0.3));
  const earlyConclusion = /결론|요약하면|정리하면|한마디로|한 줄로/.test(head);

  const severity = clamp(phrases.length * 22 + repeatedSentences * 15 + (repeatedStructure ? 25 : 0) + (earlyConclusion ? 18 : 0));
  return { phrases, repeatedSentences, repeatedStructure, earlyConclusion, severity, isStrong: severity >= 40 };
}

// ── Hook(첫 문단) 유형 ──────────────────────────────────────────────
export const HOOK_TYPES = ["질문형", "장면형", "뉴스형", "대화형", "숫자형", "여운형", "서술형"];
export function classifyHook(body = "") {
  const p = firstBodyPara(body);
  if (!p) return "없음";
  if (/["'“”].+["'“”]/.test(p) || /라고\s|물었다|말했다/.test(p)) return "대화형";
  if (/\d[\d,.%조억만원℃]/.test(p)) return "숫자형";
  if (/\?$|무엇|왜|어떻게|어디|누가/.test(p) && p.includes("?")) return "질문형";
  if (/지난|오늘|발표|공개|밝혔|에 따르면|보도/.test(p)) return "뉴스형";
  if (/있었다|보였다|들렸다|앉아|걸었다|바라보|풍경|장면/.test(p)) return "장면형";
  if (p.length <= 45 || /…$/.test(p)) return "여운형";
  return "서술형";
}
export function hookQuality(body = "") {
  const type = classifyHook(body);
  const p = firstBodyPara(body);
  // 상투적 시작(‘최근/요즘 ~ 대해’)이면 감점, 구체 Hook 이면 가점.
  const cliché = /^(최근|요즘|오늘날|현대\s*사회)/.test(p);
  const score = clamp((type === "서술형" ? 60 : 82) - (cliché ? 22 : 0) + (p.length >= 25 ? 6 : 0));
  return { type, score };
}

// ── Ending(마무리) 유형 ─────────────────────────────────────────────
export const ENDING_TYPES = ["질문", "다음 이야기 암시", "여운", "체크포인트", "짧은 종료"];
export function classifyEnding(body = "") {
  const p = lastBodyPara(body);
  if (!p) return "없음";
  if (/\?$/.test(p) || /인가\?|일까\?|걸까\?/.test(p)) return "질문";
  if (p.length <= 40) return "짧은 종료";
  if (/체크|기억해|해보세요|정리|기록해|남겨/.test(p)) return "체크포인트";
  if (/다음|이어질|계속|지켜|기대|또 다른|남는다/.test(p)) return "다음 이야기 암시";
  return "여운";
}
export function endingQuality(body = "") {
  const type = classifyEnding(body);
  const p = lastBodyPara(body);
  const cliché = /(결론적으로|정리해보면|마무리하며|이상으로)/.test(p);
  const score = clamp(78 - (cliché ? 25 : 0) + (type === "질문" || type === "여운" ? 8 : 0));
  return { type, score };
}

// ── 반복 위험 ────────────────────────────────────────────────────────
export function repetitionRisk(body = "") {
  const ai = detectAiTone(body);
  return clamp(ai.repeatedSentences * 18 + (ai.repeatedStructure ? 30 : 0));
}

// ── 종합 Humanization ───────────────────────────────────────────────
export function analyzeHumanization(body = "") {
  const ai = detectAiTone(body);
  const hook = hookQuality(body);
  const ending = endingQuality(body);
  const repRisk = repetitionRisk(body);
  const humanTone = clamp(100 - ai.severity);
  return { ai, hook, ending, repetitionRisk: repRisk, humanTone };
}
