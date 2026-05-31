// ─────────────────────────────────────────────────────
// 출시(Release) 모드 제어 — Google Play / 웹 production 대비
//
// 핵심 규칙: production 빌드(import.meta.env.PROD)에서는 디버그 UI/로그가
// 절대 렌더링되지 않는다. VITE_CLEAN_RELEASE 는 dev/QA 환경에서만 영향.
// (process.env.NODE_ENV === 'production' 동등 — Vite 는 import.meta.env.PROD)
// ─────────────────────────────────────────────────────

const explicit = import.meta.env.VITE_CLEAN_RELEASE;
const isProd =
  import.meta.env.PROD === true || import.meta.env.MODE === "production";

// production 이면 항상 clean. dev 에서는 VITE_CLEAN_RELEASE="true" 일 때만 clean.
export const CLEAN_RELEASE_MODE = isProd ? true : explicit === "true";

// 디버그 UI/로그 노출 여부 — production 에서는 무조건 false.
// dev 에서는 기본 노출, VITE_CLEAN_RELEASE="true" 로 끌 수 있음.
export const SHOW_DEBUG_UI = !isProd && explicit !== "true";
