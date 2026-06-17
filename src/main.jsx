import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import DebugOverlay from "./components/DebugOverlay";
import { SHOW_DEBUG_UI } from "./constants/release";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    {/* 디버그 오버레이 — dev 에서만 노출. production(import.meta.env.PROD)에서는 미렌더. 기능 코드는 유지. */}
    {SHOW_DEBUG_UI && <DebugOverlay />}
  </StrictMode>
);
