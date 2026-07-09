// ════════════════════════════════════════════════════════════════════
// 공간라운지 Content Usefulness Score (Phase 8)
//
//   Phase 2 contentScore(공간 관련성 가중치 최상)는 그대로 두고(무수정), "유용성 중심"
//   점수기를 별도로 추가한다. 평가 기준:
//     정보 가치 · 실제 도움 · 신뢰성 · 독창성 · 저장 가치 · 카테고리 적합성 · 자연스러움
//   공간 관련성은 "보조 지표(aux)"로만 낮게 반영한다(총점 가중에서 제외, 참고용 표시).
//
//   결정론적 휴리스틱 · 순수 함수. 향후 LLM 자기평가로 scoreUsefulness 내부만 교체 가능.
// ════════════════════════════════════════════════════════════════════

import { voiceFor } from "../constants/categoryVoice.js";
import { detectForcedSpaceLinks } from "./forcedSpaceLinkFilter.js";

const SPACE_WORDS = ["공간", "집", "방", "주거", "인테리어", "거실", "구조"];
const RELIABLE_WORDS = ["일반적으로", "알려진", "참고", "출처", "사례", "데이터", "기준", "확인"];
const HEDGE_WORDS = ["무조건", "반드시 성공", "확실히 오른다", "100%", "대박"]; // 과장/단정 — 신뢰성 감점

const WEIGHTS = {
  infoValue:    0.22, // 정보 가치
  realHelp:     0.18, // 실제 도움
  reliability:  0.13, // 신뢰성
  originality:  0.12, // 독창성
  saveValue:    0.13, // 저장 가치
  categoryFit:  0.14, // 카테고리 적합성
  naturalness:  0.08, // 자연스러움(억지 연결 없음)
};

export const USEFULNESS_THRESHOLD = 70;

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const countHits = (t, ws) => ws.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0);

export function scoreUsefulness({ title = "", content = "", category = "" } = {}) {
  const T = String(title);
  const B = String(content);
  const full = `${T}\n${B}`;
  const len = B.length;
  const headings = (B.match(/^##\s/gm) ?? []).length;
  const bullets = (B.match(/^-\s/gm) ?? []).length;
  const voice = voiceFor(category, title);
  const forced = detectForcedSpaceLinks(B).length;

  // 정보 가치 — 구조(소제목/목록) + 충분한 길이.
  const infoValue = clamp(40 + headings * 10 + bullets * 4 + Math.min(len / 20, 20));
  // 실제 도움 — 실행 가능한 요소(목록/체크/팁/일정).
  const realHelp = clamp(40 + bullets * 7 + countHits(full, ["체크", "팁", "방법", "준비", "일정", "실천", "단계"]) * 6);
  // 신뢰성 — 근거 어휘 가점, 과장/단정 감점.
  const reliability = clamp(55 + countHits(full, RELIABLE_WORDS) * 8 - countHits(full, HEDGE_WORDS) * 20);
  // 독창성 — 관점/사례 언급.
  const originality = clamp(48 + countHits(full, ["관점", "사례", "직접", "경험", "다르게"]) * 10 + (headings >= 3 ? 8 : 0));
  // 저장 가치 — 다시 꺼내볼 실용 요소.
  const saveValue = clamp(45 + bullets * 6 + countHits(full, ["체크리스트", "정리", "요약", "가이드"]) * 10);
  // 카테고리 적합성 — voice 섹션 제목이 실제 본문에 얼마나 반영됐나.
  const secHits = voice.sections.filter((s) => B.includes(s)).length;
  const categoryFit = clamp(45 + Math.round((secHits / Math.max(voice.sections.length, 1)) * 45) + (len > 300 ? 10 : 0));
  // 자연스러움 — 억지 공간 연결이 없을수록 높음.
  const naturalness = clamp(100 - forced * 25);

  const axes = { infoValue, realHelp, reliability, originality, saveValue, categoryFit, naturalness };
  const total = clamp(
    infoValue * WEIGHTS.infoValue + realHelp * WEIGHTS.realHelp + reliability * WEIGHTS.reliability +
    originality * WEIGHTS.originality + saveValue * WEIGHTS.saveValue + categoryFit * WEIGHTS.categoryFit +
    naturalness * WEIGHTS.naturalness
  );

  // 공간 관련성 — 보조 지표(총점에 넣지 않음). 참고용 표시만.
  const spaceRelevanceAux = clamp(countHits(full, SPACE_WORDS) === 0 ? 15 : 40 + countHits(full, SPACE_WORDS) * 10);

  return {
    axes,
    total,
    saveValue,
    spaceRelevanceAux,
    forcedLinks: forced,
    voice: { id: voice.id, label: voice.label, spaceLinkPolicy: voice.spaceLinkPolicy },
    recommendPublish: total >= USEFULNESS_THRESHOLD && forced <= 1,
  };
}

export const USEFULNESS_AXIS_LABELS = {
  infoValue: "정보 가치", realHelp: "실제 도움", reliability: "신뢰성",
  originality: "독창성", saveValue: "저장 가치", categoryFit: "카테고리 적합성", naturalness: "자연스러움",
};
