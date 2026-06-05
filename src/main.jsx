import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import DebugOverlay from "./components/DebugOverlay";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    {/* 임시 디버그 오버레이 — 모바일에서 [GONGGAN_DEBUG] 로그 확인용. cleanup PR 에서 제거 예정. */}
    <DebugOverlay />
  </StrictMode>
);
