import { C, R } from "../constants";

// ─────────────────────────────────────────────────────
// 업체 신뢰 스크리닝 시각화 — 검증 항목을 한눈에.
//   완료 항목: 딥그린 ✅ / 미완료: 회색 처리.
//   업체 카드 하단 또는 상세 페이지 상단에 배치. 기존 배지 시스템과 통합.
// ─────────────────────────────────────────────────────

function deriveChecks(company = {}) {
  const hasBadge = !!company.badge && company.badge !== "none";
  return [
    { key: "biz",       label: "사업자 확인",   done: !!(company.verified || company.bizCert || company.is_verified) },
    { key: "insurance", label: "시공보험 가입", done: !!(company.hasInsurance || company.insurance || company.has_insurance) },
    { key: "portfolio", label: "포트폴리오 보유", done: !!(company.portfolioCount > 0 || (Array.isArray(company.portfolios) && company.portfolios.length) || company.hasPortfolio) },
    { key: "guarantee", label: "공간보증 배지", done: hasBadge },
    { key: "reviewed",  label: "관리자 검수 완료", done: company.companyStatus === "ACTIVE" || company.company_status === "ACTIVE" || !!company.verified },
  ];
}

export default function CompanyVerificationBadges({ company, style }) {
  if (!company) return null;
  const checks = deriveChecks(company);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, ...style }}>
      {checks.map((c) => (
        <span key={c.key} style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          borderRadius: R.full, padding: "3px 9px", fontSize: 11, fontWeight: 700,
          background: c.done ? C.greenL : C.surface2,
          color: c.done ? C.green : C.text4,
          border: `1px solid ${c.done ? C.green + "33" : C.bgWarm}`,
        }}>
          <span>{c.done ? "✅" : "▫️"}</span> {c.label}
        </span>
      ))}
    </div>
  );
}
