// ════════════════════════════════════════════════════════════════════
// 공간라운지 Daily Publish Budget — 정기/비정기 발행 상한 (Phase 47)
//
//   정기(기본편성) 일일 최대 10건 · 비정기 최대 5건 · 총 15건. 생성/발행 수를 분리 집계한다.
//   긴급뉴스 때문에 상한을 넘겨야 해도 자동 초과하지 않고 limit_exceeded 로 표시(§16).
//   ⚠️ 순수 함수 · KST 기준. 기존 컬럼(created_at/updated_at/publish_status)만 사용. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { editorialDateKST } from "./editorialKey.js";
import { classifyContentType } from "./contentTypes.js";

export const CAP_REGULAR = 10;
export const CAP_IRREGULAR = 5;
export const CAP_TOTAL = 15;

// 정기(기본편성) 유형.
const REGULAR = new Set(["qt", "astrology", "morning_brief", "space_market", "series", "trend_past", "trend_present", "trend_future"]);
export function isRegular(type) { return REGULAR.has(type); }

// 오늘(KST) 생성·발행 집계. records: lounge_posts 배열.
export function computeBudget(records = [], { now = Date.now() } = {}) {
  const today = editorialDateKST(now);
  const b = {
    regular: { gen: 0, pub: 0, cap: CAP_REGULAR },
    irregular: { gen: 0, pub: 0, immediate: 0, scheduled: 0, cap: CAP_IRREGULAR },
    total: { gen: 0, pub: 0, cap: CAP_TOTAL },
  };
  for (const r of records) {
    const type = classifyContentType(r.title || r.ai_topic || "");
    const reg = isRegular(type);
    const bucket = reg ? b.regular : b.irregular;
    if (editorialDateKST(r.created_at) === today) { bucket.gen += 1; b.total.gen += 1; }
    if ((r.publish_status || "") === "published" && editorialDateKST(r.updated_at || r.created_at) === today) {
      bucket.pub += 1; b.total.pub += 1;
    }
  }
  return b;
}

// 발행 여지가 있는가(§16 자동 초과 금지).
export function canPublish(type, budget) {
  if (!budget) return true;
  const reg = isRegular(type);
  const bucket = reg ? budget.regular : budget.irregular;
  if (budget.total.pub >= CAP_TOTAL) return false;
  return bucket.pub < bucket.cap;
}

export function limitState(budget) {
  return {
    regularExceeded: budget.regular.pub >= CAP_REGULAR,
    irregularExceeded: budget.irregular.pub >= CAP_IRREGULAR,
    totalExceeded: budget.total.pub >= CAP_TOTAL,
    limitExceeded: budget.total.pub >= CAP_TOTAL || budget.regular.pub >= CAP_REGULAR || budget.irregular.pub >= CAP_IRREGULAR,
  };
}
