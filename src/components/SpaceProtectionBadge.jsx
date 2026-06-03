import { C, R, S } from "../constants";

// ─────────────────────────────────────────────────────
// 공간보호 브랜드 컴포넌트 (AirCover 형) — "고객이 보호받는 플랫폼" 인식 UX.
//   재사용 variant:
//     "badge"  : 상시 노출 단일 pill ("🛡️ 공간안전결제 보호중") — 랜딩 상단 등
//     "list"   : 4개 보호 항목 체크리스트 — 견적/계약 화면 보호 상태 표시
//     "escrow" : 에스크로 상단 고정 배너 (보호 중 + 직거래 경고)
//   색상: 딥그린/아이보리/네이비만. 빨강·주황 금지(경고색 X, 보호/안내 톤).
// ─────────────────────────────────────────────────────

const PROTECTION_ITEMS = [
  "공간안전결제 보호중",
  "공간보증 업체",
  "분쟁지원 가능",
  "보호기록 보유",
];

export default function SpaceProtectionBadge({ variant = "badge", style }) {
  if (variant === "badge") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        background: C.brandL, color: C.brand, border: `1px solid ${C.brandM}`,
        borderRadius: R.full, padding: "5px 12px", fontSize: 12, fontWeight: 800,
        ...style,
      }}>
        🛡️ 공간안전결제 보호중
      </span>
    );
  }

  if (variant === "list") {
    return (
      <div style={{
        background: C.brandL, border: `1px solid ${C.brandM}`, borderRadius: 12,
        padding: "14px 16px", ...style,
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.brand, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
          🛡️ 공간마켓 보호 적용
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px" }}>
          {PROTECTION_ITEMS.map((t) => (
            <div key={t} style={{ fontSize: 13, color: C.text2, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ color: C.green }}>✅</span> {t}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // variant === "escrow" — 상단 고정 배너
  return (
    <div style={{
      background: C.navyL, border: `1px solid ${C.trustM}`, borderRadius: 12,
      padding: "12px 16px", display: "flex", gap: 10, alignItems: "flex-start",
      marginBottom: S.lg, ...style,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>🛡️</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>공간마켓 안전거래로 보호 중</div>
        <div style={{ fontSize: 12, color: C.text3, marginTop: 2, lineHeight: 1.6 }}>
          직거래 시 이 보호가 사라집니다.
        </div>
      </div>
    </div>
  );
}
