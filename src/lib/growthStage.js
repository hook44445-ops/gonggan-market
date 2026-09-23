// 업체 성장 단계 — 화면과 분리한 순수 로직(표시 전용. XP·레벨 계산은 constants/growth.js 그대로).
// 왜: 레벨이 숫자와 막대뿐이라 「Lv.3」이 무슨 뜻인지, 다음에 뭘 하면 되는지 알 수 없었다.
//     10레벨을 다섯 단계로 묶어 이름·그림·뜻을 주고, 남은 XP를 «완료 몇 건» 같은 행동으로 바꾼다.
// (확장자까지 적는다 — node --test 로 이 파일만 돌릴 때도 불러올 수 있게)
import { XP_PER_COMPLETED_PROJECT, XP_AWARDS } from "../constants/growth.js";

export const GROWTH_STAGES = [
  { id: "seed",   name: "씨앗",  levels: [1, 2],  art: "/images/growth/seed.webp",
    line: "첫 기록을 남기는 때입니다." },
  { id: "root",   name: "뿌리",  levels: [3, 4],  art: "/images/growth/root.webp",
    line: "성실이 반복되어 자리를 잡는 때입니다." },
  { id: "stem",   name: "줄기",  levels: [5, 6],  art: "/images/growth/stem.webp",
    line: "쌓인 기록을 고객이 알아보기 시작합니다." },
  { id: "tree",   name: "나무",  levels: [7, 8],  art: "/images/growth/tree.webp",
    line: "이름만으로 믿고 맡기는 업체가 됩니다." },
  { id: "forest", name: "숲",    levels: [9, 10], art: "/images/growth/forest.webp",
    line: "동네의 기준이 되는 자리입니다." },
];

export function stageFor(level) {
  const lv = Math.max(1, Math.min(10, Math.floor(Number(level) || 1)));
  return GROWTH_STAGES.find(s => lv >= s.levels[0] && lv <= s.levels[1]) ?? GROWTH_STAGES[0];
}

export const stageIndex = (level) => GROWTH_STAGES.indexOf(stageFor(level));

// 다음 단계(없으면 null) — 「나무까지 두 레벨」 같은 안내에 쓴다.
export function nextStage(level) {
  const i = stageIndex(level);
  return i >= 0 && i < GROWTH_STAGES.length - 1 ? GROWTH_STAGES[i + 1] : null;
}

// 남은 XP → 「완료 n건」. 완료 한 건이 거치는 생애주기 XP(현장방문~완료)를 기준으로 올림.
export function projectsToNextLevel(xpToNext) {
  const left = Math.max(0, Number(xpToNext) || 0);
  if (left === 0) return 0;
  return Math.max(1, Math.ceil(left / XP_PER_COMPLETED_PROJECT));
}

// 다음 레벨까지 한 줄 — 최고 레벨이면 그 말만 한다. 없는 보상을 약속하지 않는다.
export function nextLevelHint({ xpToNext = 0, isMax = false } = {}) {
  if (isMax) return "최고 레벨입니다";
  const n = projectsToNextLevel(xpToNext);
  return `공사 ${n}건을 끝까지 기록하면 다음 레벨`;
}

// 무엇이 XP가 되는지 — 실제 상수에서 뽑는다(화면에 숫자를 손으로 적지 않는다).
export function xpSources() {
  return [
    { label: "현장 방문 기록", xp: XP_AWARDS.SITE_VISIT },
    { label: "실측 기록",      xp: XP_AWARDS.MEASUREMENT },
    { label: "전자계약",       xp: XP_AWARDS.E_CONTRACT },
    { label: "착공·중간·완료 사진", xp: XP_AWARDS.CONSTRUCTION_START + XP_AWARDS.MID_INSPECTION + XP_AWARDS.COMPLETION },
    { label: "고객 후기",      xp: XP_AWARDS.CUSTOMER_REVIEW },
    { label: "A/S 완료",       xp: XP_AWARDS.AS_COMPLETE },
  ];
}
