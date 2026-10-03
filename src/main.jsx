import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/theme.css"; // 역할별(고객 그린 / 파트너 네이비) 색상 토큰
import DebugOverlay from "./components/DebugOverlay";
import AppInstallBanner from "./components/AppInstallBanner";
import { SHOW_DEBUG_UI } from "./constants/release";

// production 에서는 [GONGGAN_DEBUG]/[GONGGAN_DIAG] 콘솔 로그를 출력하지 않음(dev 는 기존대로 유지).
if (!SHOW_DEBUG_UI && typeof window !== "undefined" && !window.__GG_LOG_SILENCED__) {
  window.__GG_LOG_SILENCED__ = true;
  const origLog = console.log.bind(console);
  console.log = (...args) => {
    const first = args[0];
    if (typeof first === "string" && (first.indexOf("[GONGGAN_DEBUG]") !== -1 || first.indexOf("[GONGGAN_DIAG]") !== -1)) return;
    origLog(...args);
  };
}

// 배포가 바뀐 뒤 옛 탭·앱이 사라진 조각(chunk)을 부르면 빈 화면이 된다 → 한 번만 새로고침해 새 판을 받는다.
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    try {
      if (sessionStorage.getItem("gg_chunk_reload") === "1") return;
      sessionStorage.setItem("gg_chunk_reload", "1");
    } catch { /* 저장소 막힘이면 그냥 한 번 새로고침 */ }
    event.preventDefault();
    window.location.reload();
  });
  window.addEventListener("load", () => {
    setTimeout(() => { try { sessionStorage.removeItem("gg_chunk_reload"); } catch { /* 무시 */ } }, 10000);
  });
}
createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* 웹 방문자 → 앱 설치 입구(안드로이드 띠 · 아이폰 스마트 앱 배너). 앱 안에서는 안 보인다. */}
    <AppInstallBanner />
    <App />
    {/* 디버그 오버레이 — dev 에서만 노출. production(import.meta.env.PROD)에서는 미렌더. 기능 코드는 유지. */}
    {SHOW_DEBUG_UI && <DebugOverlay />}
  </StrictMode>
);
