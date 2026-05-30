import { C } from "../../constants";

// ─────────────────────────────────────────────────────
// 공간마켓 브랜드 마크 — 01 공간·연결형
// 원형 연결(링) + 집(공간) + 창문 + 잎(자연)
// 모든 브랜드 아이콘(앱/파비콘/PWA/헤더/스플래시)의 단일 소스.
// 좌표는 48 그리드 기준으로 정의되어 모든 에셋과 동일하게 유지됩니다.
// ─────────────────────────────────────────────────────
export function LogoMark({ size = 32, rounded = true, bare = false, tone = "brand" }) {
  // tone="brand": 딥그린 단색 (밝은 배경/헤더용)
  // tone="light": 아이보리 + 세이지 잎 (딥그린 배경/히어로용)
  const mark = tone === "light" ? "#FFFFFF" : C.brand;
  const leaf = tone === "light" ? C.brandM : C.brand;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {!bare && <rect width="48" height="48" rx={rounded ? 13 : 0} fill={C.brandL} />}
      {/* 원형 연결 링 */}
      <circle cx="24" cy="24" r="20" fill="none" stroke={mark} strokeWidth="2.2" />
      {/* 집 외곽 (공간) */}
      <path d="M13.8 21.6 L24 12.4 L34.2 21.6 L34.2 30.6 Q34.2 32.6 32.2 32.6 L15.8 32.6 Q13.8 32.6 13.8 30.6 Z"
        fill="none" stroke={mark} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {/* 창문 2×2 */}
      <g fill={mark}>
        <rect x="18.0" y="17.8" width="3.0" height="3.0" rx="0.5" />
        <rect x="22.0" y="17.8" width="3.0" height="3.0" rx="0.5" />
        <rect x="18.0" y="21.8" width="3.0" height="3.0" rx="0.5" />
        <rect x="22.0" y="21.8" width="3.0" height="3.0" rx="0.5" />
      </g>
      {/* 잎 (자연·새싹) */}
      <path d="M27 32 C23 31 21.2 28 22 25.6 C25 26.6 27.2 29 27 32 Z" fill={leaf} />
      <path d="M27 32 C31 31 32.8 28 32 25.6 C29 26.6 26.8 29 27 32 Z" fill={leaf} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────
// 공간사이 / 공간마켓 워드마크 (마크 + 텍스트)
// ─────────────────────────────────────────────────────
export function BrandLockup({ size = 32, dark = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <LogoMark size={size} />
      <div>
        <div style={{ fontSize: size * 0.47, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.3px",
          color: dark ? "#fff" : C.brandD }}>공간사이</div>
        <div style={{ fontSize: size * 0.28, lineHeight: 1, letterSpacing: "0.4px",
          color: dark ? "rgba(255,255,255,0.7)" : C.text3 }}>공간마켓</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// 보타니컬 장식 — 잎가지 (히어로/카드 배경에 은은하게)
// color, opacity, style로 위치 조정
// ─────────────────────────────────────────────────────
export function LeafSprig({ size = 80, color = C.brand, opacity = 0.12, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none"
      style={{ opacity, pointerEvents: "none", ...style }} aria-hidden="true">
      {/* 줄기 */}
      <path d="M50 92 C50 70 50 48 54 26" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      {/* 잎 (좌우 교차) */}
      <path d="M52 64 C40 60 32 50 31 38 C44 40 53 50 52 64 Z" fill={color} />
      <path d="M52 52 C64 48 72 38 73 26 C60 28 51 38 52 52 Z" fill={color} />
      <path d="M53 40 C43 35 37 26 37 16 C48 19 55 28 53 40 Z" fill={color} />
      <path d="M54 30 C64 26 70 18 70 9 C60 11 53 19 54 30 Z" fill={color} />
    </svg>
  );
}

// 작은 단일 잎 — 인라인 포인트용
export function LeafMark({ size = 14, color = C.brand, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ display: "inline-block", verticalAlign: "middle", ...style }} aria-hidden="true">
      <path d="M5 19 C5 11 11 5 19 5 C19 13 13 19 5 19 Z" fill={color} />
      <path d="M5 19 C9 15 13 11 17 8" stroke={C.brandL} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
