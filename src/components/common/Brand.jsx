import { C } from "../../constants";

// ─────────────────────────────────────────────────────
// 공간사이 브랜드 마크 — 둥근 집 + 잎사귀
// ─────────────────────────────────────────────────────
export function LogoMark({ size = 32, rounded = true, bare = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {!bare && <rect width="48" height="48" rx={rounded ? 13 : 0} fill={C.brandL} />}
      {/* 집 외곽 */}
      <path d="M24 11.5 L35 20 V34.5 a1.5 1.5 0 0 1 -1.5 1.5 H14.5 A1.5 1.5 0 0 1 13 34.5 V20 Z"
        fill="none" stroke={C.brand} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      {/* 문 */}
      <path d="M21 36 V27.5 a3 3 0 0 1 6 0 V36"
        fill="none" stroke={C.brand} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {/* 잎사귀 */}
      <path d="M30.5 13.5 c3.2 -0.4 5.6 -2.4 6.4 -5.2 c-3.2 0.2 -5.8 1.9 -6.7 4.6"
        fill={C.brand} />
      <path d="M31 9.5 c1.8 0.4 3.6 0.1 5 -1" fill="none" stroke={C.brandL} strokeWidth="1" strokeLinecap="round" />
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
