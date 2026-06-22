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

// ─────────────────────────────────────────────────────
// UX 편의성 고도화 Beta (Layout & Convenience Only) — 즉시 롤백용 스위치.
//   true  : 개선된 베타 UI 사용(기능/로직/데이터 동일, 표현만 개선).
//   false : 기존 UI 로 즉시 복구(원본 컴포넌트는 보존되어 있음).
// ※ UI/레이아웃 전용 플래그. 비즈니스 로직/라우팅/State 구조와 무관.
export const UX_BETA = true;

// ─────────────────────────────────────────────────────
// 베타 서비스 운영 모드 (토스페이먼츠 승인 전 무료 베타) — 안내 UI 전용 스위치.
//   true  (APP_MODE=beta)       : 베타 배지·무료 안내·안전결제 미제공 안내·공간보증 사전신청 표시.
//   false (APP_MODE=production)  : 베타 안내 전부 숨김 → 정식 서비스 문구/공간보증 신청.
// ※ 표시(문구·배지·안내 모달)만 제어. 결제/에스크로/계약/견적/입찰/공간보증 로직과 무관.
//    환경변수 VITE_APP_MODE=production 이면 강제 OFF(코드 삭제 없이 끔).
// ─────────────────────────────────────────────────────
export const SHOW_BETA_UI = import.meta.env.VITE_APP_MODE !== "production";

