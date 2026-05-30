// ─────────────────────────────────────────────────────
// 출시(Release) 모드 제어 — Google Play production 대비
//
// CLEAN_RELEASE_MODE = true 이면 모든 개발/디버그 UI를 숨긴다.
// 개발 코드는 남겨두되, production 빌드에서는 절대 노출되지 않게 게이트한다.
//
// 판단 기준 (우선순위):
//   1) VITE_CLEAN_RELEASE === "true"  → 강제 clean (배포용)
//   2) VITE_CLEAN_RELEASE === "false" → 강제 debug 노출 (QA용)
//   3) 미설정 시 → production 빌드면 clean, 그 외(dev)면 debug 노출
// ─────────────────────────────────────────────────────

const explicit = import.meta.env.VITE_CLEAN_RELEASE;
const isProd   = import.meta.env.MODE === "production";

export const CLEAN_RELEASE_MODE =
  explicit === "true"  ? true  :
  explicit === "false" ? false :
  isProd;

// 디버그/개발 UI를 보여도 되는가? (clean release면 항상 false)
export const SHOW_DEBUG_UI = !CLEAN_RELEASE_MODE;
