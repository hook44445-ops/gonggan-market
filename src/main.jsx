import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import DebugOverlay from "./components/DebugOverlay";
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

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    {/* 디버그 오버레이 — dev 에서만 노출. production(import.meta.env.PROD)에서는 미렌더. 기능 코드는 유지. */}
    {SHOW_DEBUG_UI && <DebugOverlay />}
  </StrictMode>
);
