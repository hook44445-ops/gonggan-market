import { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────
// 아이콘 버전 스위치 — 이모지(v1) ↔ 라인 아이콘(v2) 즉시 전환.
//   v1 : 기존 이모지 아이콘 그대로 (원본 보존)
//   v2 : lucide 라인 아이콘 (브랜드 톤에 맞춘 신규 세트) — 기본값
// localStorage 기반 브라우저별 설정. 관리자 화면 토글에서 변경하며,
// 새 값은 같은 탭 안의 모든 <Icon/> 에도 즉시 반영된다(CustomEvent 브로드캐스트).
// ─────────────────────────────────────────────────────
const STORAGE_KEY = "gonggan_icon_version";
const EVENT_NAME = "gonggan:icon-version-change";
export const DEFAULT_ICON_VERSION = "v2";

export function getIconVersion() {
  if (typeof window === "undefined") return DEFAULT_ICON_VERSION;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "v1" || v === "v2" ? v : DEFAULT_ICON_VERSION;
  } catch {
    return DEFAULT_ICON_VERSION;
  }
}

export function setIconVersion(version) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, version);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: version }));
  } catch {}
}

export function useIconVersion() {
  const [version, setVersion] = useState(getIconVersion);

  useEffect(() => {
    const onChange = (e) => setVersion(e?.detail || getIconVersion());
    window.addEventListener(EVENT_NAME, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return [version, setIconVersion];
}
