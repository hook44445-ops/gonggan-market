// ════════════════════════════════════════════════════════════════════
// 공간라운지 Publish Mode Decider — 즉시발행/예약발행/보류 자동 판단 (Phase 47)
//
//   승인된 콘텐츠의 시의성·긴급성·편성 목적을 판단해 발행 방식을 결정한다.
//     IMMEDIATE  — 긴급뉴스·실시간 급등·당일 한정·관리자 지정·누락 복구(P1~P5)
//     SCHEDULED  — 기본편성(Morning Brief/QT/운세/Time Trend/연재)·상시 검색형(Evergreen)
//     HOLD       — Hard Fail·깨짐·심각 중복·이미지 오인 → 자동발행 금지(관리자 예외함)
//
//   ⚠️ Safety Gate 우회 금지: HOLD 는 board.hardGatePassed=false 이면 무조건 적용된다.
//   ⚠️ 순수 함수 · 결정론 · DB/LLM 없음. 기존 정책/게이트 재사용. Regression Zero.
// ════════════════════════════════════════════════════════════════════

const BREAKING = /(속보|긴급|재난|재해|사고|침수|지하차도|폭우|집중호우|호우|태풍|지진|화재|폭발|붕괴|대피|사망|실종|통제|정전|단수|리콜|긴급\s*발표|긴급\s*정책|비상)/;
const SURGE = /(급등|급증|폭등|실시간|화제|난리|논란|속출|품절)/;
const TODAY_ONLY = /(오늘만|당일|금일|오늘\s*마감|오늘\s*밤|오늘\s*중|오늘\s*(교통|날씨|운영|공지)|마감\s*임박)/;

// 기본편성(정기) 유형 — 예약 대상.
const SCHEDULED_TYPES = new Set(["qt", "astrology", "morning_brief", "space_market", "series", "trend_past", "trend_present", "trend_future"]);

// content: { title, content|body, content_type, force_immediate, scheduled_at, isDuplicate }
// board:   reviewByBoard 결과(선택) — hardGatePassed/boardDecision.
export function decidePublishMode(content = {}, { board = null, now = Date.now() } = {}) {
  const title = String(content.title ?? "");
  const body = String(content.content ?? content.body ?? "");
  const full = `${title}\n${body}`;
  const type = content.content_type || content.type || "general";

  // 0) HOLD — 안전/무결성 실패는 무조건 보류(즉시발행 특례로도 우회 금지).
  const hardFail = board ? board.hardGatePassed === false : false;
  const broken = body.replace(/\s/g, "").length < 80;
  if (hardFail || broken || content.imageMisId === true) {
    return { mode: "HOLD", priority: "HOLD", reason: hardFail ? "HARD_FAIL" : broken ? "BROKEN_BODY" : "IMAGE_MISID", confidence: 95 };
  }
  if (content.isDuplicate === true) {
    return { mode: "HOLD", priority: "HOLD", reason: "SEVERE_DUPLICATE", confidence: 90 };
  }

  // 1) 관리자 즉시발행 지정(P4).
  if (content.force_immediate === true) {
    return { mode: "IMMEDIATE", priority: "P4", reason: "ADMIN_FORCE", confidence: 99 };
  }
  // 2) 누락 복구(P5) — 예약 시각이 지났고 유효/무중복(HOLD 아님) → 즉시 회수 발행.
  if (content.scheduled_at && Date.parse(content.scheduled_at) <= now) {
    return { mode: "IMMEDIATE", priority: "P5", reason: "OVERDUE_RECOVERY", confidence: 85 };
  }
  // 3) 긴급뉴스(P1) — 속보 유형 또는 긴급 키워드.
  if (BREAKING.test(full) || type === "breaking") {
    return { mode: "IMMEDIATE", priority: "P1", reason: "BREAKING_NEWS", confidence: 92 };
  }
  // 4) 실시간 급등(P2) — 키워드 기반만. (Time Trend 유형은 §7② 예약 대상이므로 유형만으로 즉시발행 아님)
  if (SURGE.test(full)) {
    return { mode: "IMMEDIATE", priority: "P2", reason: "REALTIME_SURGE", confidence: 84 };
  }
  // 5) 당일 한정(P3).
  if (TODAY_ONLY.test(full)) {
    return { mode: "IMMEDIATE", priority: "P3", reason: "TODAY_ONLY", confidence: 80 };
  }
  // 6) 기본편성/상시 검색형 → 예약.
  const reason = SCHEDULED_TYPES.has(type) ? "PROGRAM_SLOT" : "EVERGREEN_CONTENT";
  return { mode: "SCHEDULED", priority: SCHEDULED_TYPES.has(type) ? "P6" : "P7", reason, confidence: 88 };
}

// P1~P3 은 자동 즉시발행 대상, P4 관리자 지정, P5 복구.
export function isAutoImmediate(priority) {
  return ["P1", "P2", "P3", "P4", "P5"].includes(priority);
}
