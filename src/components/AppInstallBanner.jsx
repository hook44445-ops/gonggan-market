import { useEffect, useState } from "react";
import {
  detectAndRememberInApp, shouldShowAndroidBanner, androidInstallUrl, closedAt, closeBanner, smartBannerContent,
} from "../lib/appInstall";

// 웹 방문자 → 앱 설치 입구(대표 09-28 「1등 다운로드 앱」 · 규칙은 lib/appInstall).
//   아이폰 사파리는 Apple 스마트 앱 배너(메타 태그), 안드로이드 브라우저는 화면 맨 위 얇은 띠.
//   앱 안에서는 둘 다 보이지 않는다. 화면 흐름 안에 두어(고정 X) 앱 머리글을 가리지 않는다.
const APP_STORE_ID = import.meta.env.VITE_APP_STORE_ID ?? "";
const PLAY_PUBLIC = import.meta.env.VITE_PLAY_PUBLIC === "1";

export default function AppInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const inApp = detectAndRememberInApp();
    // 아이폰 — 사파리가 알아서 그린다(앱 안 WKWebView 에선 무시됨)
    // 빌드 때 index.html 에 이미 넣었으면(vite.config appleSmartBanner) 그대로 둔다 — 사파리는 처음 HTML 만 읽는다
    const already = !!document.querySelector('meta[name="apple-itunes-app"]');
    const content = inApp || already ? null : smartBannerContent(APP_STORE_ID, window.location.href);
    let meta = null;
    if (content) {
      meta = document.createElement("meta");
      meta.name = "apple-itunes-app";
      meta.content = content;
      document.head.appendChild(meta);
    }
    setShow(shouldShowAndroidBanner({
      ua: navigator.userAgent, inApp, closedAt: closedAt(), path: window.location.pathname,
    }));
    return () => { meta?.remove(); };
  }, []);

  if (!show) return null;
  return (
    <div role="region" aria-label="앱 설치 안내"
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px 9px 14px", background: "#1D3D2F", color: "#fff",
        fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif" }}>
      <img src="/icons/icon-192-v6.png" alt="" width={30} height={30} style={{ borderRadius: 8, flexShrink: 0, background: "#fff" }}
        onError={(e) => { e.currentTarget.style.display = "none"; }} />
      <div style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>공간마켓 앱</div>
        <div style={{ fontSize: 11.5, opacity: 0.8 }}>견적 도착을 알림으로 받아요</div>
      </div>
      <a href={androidInstallUrl(PLAY_PUBLIC)}
        style={{ flexShrink: 0, background: "#fff", color: "#1D3D2F", borderRadius: 999, padding: "7px 13px",
          fontSize: 12.5, fontWeight: 800, textDecoration: "none" }}>앱으로 보기</a>
      <button onClick={() => { closeBanner(); setShow(false); }} aria-label="앱 설치 안내 닫기"
        style={{ flexShrink: 0, background: "none", border: "none", color: "#fff", opacity: 0.7, fontSize: 18, padding: "0 2px", cursor: "pointer" }}>✕</button>
    </div>
  );
}
