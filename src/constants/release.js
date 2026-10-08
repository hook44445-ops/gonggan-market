import { parsePayMethods } from "../lib/bundlePay.js";

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
// 베타 서비스 운영 모드 (토스페이먼츠 승인 전 무료 베타) — 안내 UI 전용 스위치(단일 제어).
//   · APP_MODE 가 'beta' 면 베타 안내 ON. 'production' 으로 바꾸면 전부 OFF.
//   · 강제 ON: VITE_SHOW_BETA_UI="true" (production 모드에서도 베타 안내를 켜고 싶을 때).
//   · 정식 전환은 환경변수 한 번(VITE_APP_MODE=production)으로 끝 — 코드 삭제 없음.
// ※ 표시(문구·배지·배너·안내 모달)만 제어. 결제/에스크로/계약/견적/입찰/공간보증 로직과 무관.
//    모든 베타 UI 는 반드시 SHOW_BETA_UI 만 참조하고, false 면 렌더하지 않는다(return null).
// ─────────────────────────────────────────────────────
export const APP_MODE = import.meta.env.VITE_APP_MODE || "beta";
export const SHOW_BETA_UI =
  APP_MODE === "beta" || import.meta.env.VITE_SHOW_BETA_UI === "true";

// 앱 안 결제가 실제로 열렸는가 — 베타 스위치와 한 몸(스위치를 둘로 두면 화면마다 말이 갈린다, 대표 09-25).
//   토스페이먼츠 상점이 열리고 키를 넣은 뒤 VITE_APP_MODE=production 한 번으로
//   결제 버튼 · 「공간랜드가 보관」 문구 · 에스크로 안내가 함께 켜진다. 그 전에는 모두 «결제 준비 중 · 계약서대로 직접».
export const PAYMENTS_LIVE = !SHOW_BETA_UI;

// 공정 묶음 분할 결제(10-07 · SQL 205 · lib/bundlePay) — 토스 «1회 판매 1천만 원 초과 입점 불가» 때문에
//   최종 견적서를 1천만 원 미만 묶음으로 나눠 받는다. 스위치는 셋이고 «모두» 켜져야 실제 결제 버튼이 눌린다:
//     ① PAYMENTS_LIVE(VITE_APP_MODE=production) ② VITE_BUNDLE_PAY="on" ③ 서버 ops_config.bundle_pay_open = true
//   그 전에는 «결제가 열리면 이렇게 나눠 낼 수 있어요» 미리 보기만(버튼은 꺼짐).
//   토스가 «안 된다»고 하면 VITE_BUNDLE_PAY="off" — 묶음 화면을 숨기고 예전 한 번에 결제(1천만 미만)만.
export const BUNDLE_PAY_MODE = import.meta.env.VITE_BUNDLE_PAY ?? "preview";   // "on" | "preview" | "off"
export const BUNDLE_PAY_LIVE = PAYMENTS_LIVE && BUNDLE_PAY_MODE === "on";
export const SHOW_BUNDLE_PLAN = BUNDLE_PAY_MODE !== "off";
// 받을 결제 수단(대표 10-08 · 첫 개통은 가상계좌만) — VITE_PAY_METHODS="VIRTUAL_ACCOUNT,CARD" 처럼. 기본 가상계좌만.
//   서버 ops_config.pay_methods 와 같게 맞춘다(서버가 목록 밖 수단은 거절). 목록에 없는 수단은 화면에서 숨긴다.
export const PAY_METHODS = parsePayMethods(import.meta.env.VITE_PAY_METHODS);

// 아이폰 앱(Expo 쉘 · WKWebView) 안인가 — 쉘이 window.ReactNativeWebView 를 심는다.
//   App Store 가이드라인 3.1.1: 앱 안에서 디지털 상품(공간토큰)을 애플 결제 없이 팔거나 가격·외부 결제를 안내하면 반려.
//   그래서 아이폰 앱 안에서는 토큰 구매 화면을 아예 보이지 않는다(공사 대금 같은 실물 서비스 결제는 해당 없음).
export function isIosAppShell() {
  try {
    return typeof window !== "undefined" && typeof window.ReactNativeWebView !== "undefined"
      && /iPhone|iPad|iPod/i.test(window.navigator?.userAgent ?? "");
  } catch { return false; }
}
// 안드로이드 Play 앱(TWA) 안인가 — Play 결제 정책도 앱 안 디지털 상품은 구글 결제(또는 등록한 대체 결제)만.
//   TWA 는 첫 화면에만 referrer «android-app://» 가 붙는다 → 이 창(sessionStorage)에만 기억한다.
//   (localStorage 에 두면 TWA 와 저장소를 같이 쓰는 크롬 브라우저에서도 구매가 숨겨진다)
const TWA_SESSION_KEY = "gonggan_twa_session";
export function isAndroidAppShell() {
  try {
    if (typeof document === "undefined") return false;
    if (String(document.referrer ?? "").startsWith("android-app://")) {
      try { sessionStorage.setItem(TWA_SESSION_KEY, "1"); } catch { /* noop */ }
      return true;
    }
    return sessionStorage.getItem(TWA_SESSION_KEY) === "1";
  } catch { return false; }
}
export const isStoreAppShell = () => isIosAppShell() || isAndroidAppShell();

// 토큰을 돈 주고 살 수 있는 화면을 보여도 되나 — 결제가 열렸고, 스토어 앱(아이폰·Play) 안이 아닐 때만
export const tokenSalesOpen = () => PAYMENTS_LIVE && !isStoreAppShell();

// 브라우저(관리자 화면)에서 AI 글을 만들고 자동 발행하는 반복 작업 — 끔(09-26 AI 운영 검토).
//   화면을 열어 두기만 해도 25초·60초마다 글이 발행됐고, 상태가 기기마다 따로라 중복이 생길 수 있었다.
//   아침 뉴스 정리는 AI 가 실제 사설을 볼 수 없어 신문사 사설을 지어낼 수 있었다.
//   글 만들기·발행은 서버 자율 사이클(외부 스케줄러 → /api/cron/autonomous-cycle) 하나로만. 초안 수동 발행은 「AI 콘텐츠 공장」.
export const BROWSER_AI_AUTOPUBLISH = false;


// ─────────────────────────────────────────────────────
// 본인인증(휴대폰 실명 확인 · 포트원) — 키가 들어오면 켜진다(lib/identity.js).
//   예전 「본인인증하기」 버튼은 아무 확인 없이 users.is_identity_verified 를 true 로 적고
//   「본인인증이 완료됐습니다」라고 말했다(identity_provider: "mock"). 거짓 완료였다.
//   이제 포트원 인증창 → 서버가 포트원에 다시 물어 확인 → 서버가 완료로 표시(마이그레이션 102).
//   키가 없으면 버튼·「본인인증 전/완료」 표시를 숨긴다(가짜 완료를 다시 만들지 않는다).
// ─────────────────────────────────────────────────────
export const IDENTITY_VERIFY_READY = !!(
  import.meta.env.VITE_PORTONE_STORE_ID && import.meta.env.VITE_PORTONE_IDENTITY_CHANNEL_KEY
);
