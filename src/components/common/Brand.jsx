import { C } from "../../constants";

// ─────────────────────────────────────────────────────
// 공간마켓 브랜드 마크 — v6 (2026-09-25) 집 · 마주한 두 사람 · 열린 문 · 민트 지붕
// 앱 아이콘/파비콘(public/icons/gm-logo.svg)과 같은 도형. 1024 그리드.
// ─────────────────────────────────────────────────────
const DOOR = "#E8BD62";
const ROOF_MINT = "#8FDDB6";   // v6(09-25 대표 「깨끗하고 상쾌한 느낌」) — 초록 판·어두운 배경 위에서만 지붕을 민트로
function MarkShapes({ color, roof = color }) {
  return (
    <>
      <path d="M274 590 V410 L512 250 L750 410 V590" fill="none" stroke={roof} strokeWidth="58" strokeLinejoin="round" />
      <g fill={color}>
        <path d="M245 585 L303 585 L345 528 Q396 486 447 538 L447 730 L300 730 Q245 730 245 675 Z" />
        <path d="M779 585 L721 585 L679 528 Q630 488 574 540 L609 562 L612 730 L724 730 Q779 730 779 675 Z" />
        <circle cx="396" cy="455" r="41" />
        <circle cx="628" cy="455" r="41" />
      </g>
      <path fill={DOOR} d="M491 507 L558 546 Q566 551 566 561 L566 671 Q566 680 558 685 L492 725 Q481 731 481 719 L481 517 Q481 502 491 507 Z" />
    </>
  );
}

export function LogoMark({ size = 32, rounded = true, bare = false, tone = "brand" }) {
  // tone="brand": 딥그린 판 + 흰 도형 · 민트 지붕(앱 아이콘 v6 과 같음) · bare 면 판 없이 브랜드색 도형
  // tone="light": 판 없이 흰 도형 + 민트 지붕(딥그린 배경/히어로 위)
  const onDark = tone === "light";
  const plate = !bare && !onDark;
  return (
    <svg width={size} height={size} viewBox={plate ? "0 0 1024 1024" : "200 200 624 580"} fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {plate && <rect width="1024" height="1024" rx={rounded ? 230 : 0} fill="#0E2B1D" />}
      <MarkShapes color={plate || onDark ? "#FFFFFF" : C.brand} roof={plate || onDark ? ROOF_MINT : C.brand} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────
// 공간마켓 워드마크 (마크 + 텍스트) — 앱 이름이 앞, 회사는 작게
// ─────────────────────────────────────────────────────
export function BrandLockup({ size = 32, dark = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <LogoMark size={size} />
      <div>
        <div style={{ fontSize: size * 0.5, fontWeight: 900, lineHeight: 1.15, letterSpacing: "-0.4px",
          color: dark ? "#fff" : C.brandD }}>공간마켓</div>
        <div style={{ fontSize: size * 0.28, lineHeight: 1, letterSpacing: "0.2px",
          color: dark ? "rgba(255,255,255,0.7)" : C.text3 }}>by 공간사이</div>
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
