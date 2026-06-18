// ════════════════════════════════════════════════════════════════════════════
// activitySchema.js — 공간 활동기록 "미래 확장 설계" (DESIGN ONLY · v5.6)
// ────────────────────────────────────────────────────────────────────────────
// ⚠️ 이 파일은 설계(상수/주석)만 담는다. 어떤 저장/생성/트리거/자동 누적도 구현하지 않는다.
//   · activity_logs 테이블 생성 금지 / 저장 로직 금지 / Trigger 금지 / 자동 생성 금지.
//   · 현재 집계 방식(spaceActivity.js: bids/reviews/escrow_payments/lounge_posts/
//     lounge_comments 실시간 count)은 그대로 유지된다. 이 파일은 그것을 변경하지 않는다.
//   · 향후 "활동 발생 → Activity 자동 생성 → ActivityRecord 자동 누적" 으로 확장할 때
//     참조할 타입/출처/표시 메타/로그 형태(설계)를 한 곳에 모아둔다.
//
// 현재 → 미래 확장 흐름(설계):
//   [현재] 활동 테이블을 매번 count 집계 → ActivityRecord 표시
//   [미래] 리뷰 작성 / 프로젝트 완료 / 견적 응답 / 라운지 활동 발생 시
//          Activity(activity_logs) 1행 자동 생성 → ActivityRecord 가 누적값을 조회
//   ※ 전환 시에도 기존 집계는 폴백으로 유지 가능(점진적 마이그레이션).
// ════════════════════════════════════════════════════════════════════════════

// 단일 출처(SSOT): 타입 식별자는 spaceActivity.js 의 ACTIVITY_TYPES 를 그대로 사용한다.
// (여기서 재정의하지 않고 import 하여 분기/중복을 방지 — 기존 파일은 수정하지 않음)
import { ACTIVITY_TYPES } from "./spaceActivity";

export { ACTIVITY_TYPES };

// ── 각 활동 타입이 "현재" 어떤 실DB 에서 도출되는지(설계 참조) ────────────────────
// 미래에 activity_logs 로 누적하더라도, 백필/검증 시 출처 매핑으로 활용한다.
// 값은 설명용 메타일 뿐, 런타임 집계는 spaceActivity.js 가 담당한다.
export const ACTIVITY_SOURCE = Object.freeze({
  [ACTIVITY_TYPES.BID_RESPONSE]:       { table: "bids",            derive: "company_id = N" },
  [ACTIVITY_TYPES.PROJECT_COMPLETE]:   { table: "escrow_payments", derive: "company_id = N, transaction_status ∈ (SETTLED, COMPLETED)" },
  [ACTIVITY_TYPES.REVIEW_RECEIVED]:    { table: "reviews",         derive: "company_id = N, not hidden/deleted" },
  [ACTIVITY_TYPES.LOUNGE_POST]:        { table: "lounge_posts",    derive: "user_id = U, is_story = false, not hidden/deleted" },
  [ACTIVITY_TYPES.LOUNGE_COMMENT]:     { table: "lounge_comments", derive: "user_id = U, not deleted" },
  // 아래 둘은 아직 출처가 없다(향후 기능에서 발생). 설계상 예약만 한다.
  [ACTIVITY_TYPES.PROJECT_PHOTO]:      { table: null, derive: "(미정 — 향후 시공 사진 업로드 시)" },
  [ACTIVITY_TYPES.CUSTOMER_RECOMMEND]: { table: null, derive: "(미정 — 향후 고객 추천 시)" },
});

// ── 표시 메타(라벨/아이콘) — 향후 ActivityRecord 가 타입 기반으로 렌더할 때 사용 ────
// 현재 UI 는 지표 타일을 직접 구성하므로 이 메타는 아직 사용되지 않는다(설계 준비).
export const ACTIVITY_META = Object.freeze({
  [ACTIVITY_TYPES.BID_RESPONSE]:       { label: "견적 응답",     unit: "회", icon: "📝", actor: "company" },
  [ACTIVITY_TYPES.PROJECT_COMPLETE]:   { label: "프로젝트 완료", unit: "건", icon: "✅", actor: "company" },
  [ACTIVITY_TYPES.REVIEW_RECEIVED]:    { label: "리뷰",          unit: "개", icon: "⭐", actor: "company" },
  [ACTIVITY_TYPES.LOUNGE_POST]:        { label: "라운지 게시글", unit: "개", icon: "🗂️", actor: "user" },
  [ACTIVITY_TYPES.LOUNGE_COMMENT]:     { label: "라운지 답변",   unit: "개", icon: "💬", actor: "user" },
  [ACTIVITY_TYPES.PROJECT_PHOTO]:      { label: "시공 사진",     unit: "장", icon: "📷", actor: "company" },
  [ACTIVITY_TYPES.CUSTOMER_RECOMMEND]: { label: "고객 추천",     unit: "회", icon: "🤝", actor: "customer" },
});

// ── 향후 activity_logs "행 형태"(설계만 — 실제 테이블/Migration 생성 금지) ──────────
// 아래는 JSDoc 타입 정의일 뿐이며, 코드/DB 에 어떤 부수효과도 없다.
/**
 * @typedef {Object} FutureActivityLog  // ⚠️ 미구현 — 설계 참조용 타입
 * @property {string}  id            // uuid (gen_random_uuid)
 * @property {string}  actor_id      // users.id (전문가/고객 공용)
 * @property {string|null} company_id// companies.id (업체 활동일 때)
 * @property {keyof typeof ACTIVITY_TYPES} type // 활동 타입
 * @property {string|null} ref_table // 출처 테이블(예: 'bids')
 * @property {string|null} ref_id    // 출처 row id (멱등/역추적용)
 * @property {Object} [meta]         // 부가 정보(점수/제목 등, 자유 JSON)
 * @property {string}  created_at    // timestamptz
 */

// 공용 재사용 대상(설계): 업체 / 고객 / 관리자 모두 동일 Activity 구조를 공유한다.
export const ACTIVITY_ACTORS = Object.freeze(["company", "user", "customer", "admin"]);

// 🚧 미구현 가드(의도 명시) — 아래 기능은 이번 작업 범위가 아니다.
//   · createActivityLog()     // 저장 로직 — 금지
//   · activity DB trigger      // 자동 생성 — 금지
//   · ActivityRecord 누적 조회  // 전환 후 도입 예정
// 현재 ActivityRecord 는 spaceActivity.js 의 실시간 집계만 사용한다(변경 없음).
