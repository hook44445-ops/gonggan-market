// 공간보증 배지 — guarantee_badge_visible=true AND guarantee_status='ACTIVE' 일 때만 노출.
// 업체카드/입찰카드/업체상세/프로필/라운지 전문가 표시 공용.
import { GUARANTEE_GRADE_MAP, isGuaranteeBadgeVisible } from "../constants/guarantee";

export default function GuaranteeBadge({ company, size = "sm" }) {
  if (!isGuaranteeBadgeVisible(company)) return null;
  const g = GUARANTEE_GRADE_MAP[company.guarantee_grade];
  if (!g) return null;

  const small = size === "sm";
  return (
    <span
      title={`공간보증 ${g.label}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        background: "rgba(46,95,75,0.10)", border: "1px solid rgba(46,95,75,0.30)",
        color: "#2E5F4B", borderRadius: 999,
        padding: small ? "2px 8px" : "3px 11px",
        fontSize: small ? 10.5 : 12, fontWeight: 800, whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: small ? 11 : 13 }}>{g.emoji}</span>
      공간보증 {g.label}
    </span>
  );
}
