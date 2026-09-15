import { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────
// UI 버전 스위치 — 화면 구성 v2(기존) ↔ v3(정리본) 즉시 전환.
//   v2 : 기존 화면 그대로 (원본 보존 · 롤백용)
//   v3 : 재설계된 정리 화면 — 중복 제거, 빈 섹션 축약, 설정 하위페이지 분리 (기본값)
// useIconVersion 과 동일한 방식(localStorage + CustomEvent 브로드캐스트).
// 관리자 화면 토글에서 변경하며, 같은 탭의 모든 구독자에 즉시 반영된다.
// ─────────────────────────────────────────────────────
const STORAGE_KEY = "gonggan_ui_version";
const EVENT_NAME = "gonggan:ui-version-change";
export const DEFAULT_UI_VERSION = "v3";

export function getUiVersion() {
  if (typeof window === "undefined") return DEFAULT_UI_VERSION;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "v2" || v === "v3" ? v : DEFAULT_UI_VERSION;
  } catch {
    return DEFAULT_UI_VERSION;
  }
}

export function setUiVersion(version) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, version);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: version }));
  } catch {}
}

export function useUiVersion() {
  const [version, setVersion] = useState(getUiVersion);

  useEffect(() => {
    const onChange = (e) => setVersion(e?.detail || getUiVersion());
    window.addEventListener(EVENT_NAME, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return [version, setUiVersion];
}
