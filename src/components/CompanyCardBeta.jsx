// CompanyCardBeta — UX 편의성 고도화 Beta (업체카드 '한눈에 비교' 재배치).
//   ⚠️ 표현 전용. props·데이터·onClick·onToggleSave 등 기존 인터페이스/로직 100% 동일.
//   원본(CompanyCard.jsx)은 그대로 보존되며, constants/release.UX_BETA=false 로 즉시 복구.
//   개선 포인트: 비교 핵심 지표(평점·후기 / 시공건수 / 응답속도)를 동일 위치의
//   KPI 타일로 정렬해 여러 업체를 스캔하듯 비교할 수 있게 함. 신뢰 배지(공간보증)는 상단 고정.
import { C, R, S, GRADE, SHADOW } from "../constants";
import { BADGES } from "../constants/badges";
import { TempBadge, CertBadge, LeafSprig } from "./common";
import CompanyVerificationBadges from "./CompanyVerificationBadges";
import GuaranteeBadge from "./GuaranteeBadge";

function responseLabel(company) {
  if (company.avgResponseHours > 0) {
    return company.avgResponseHours < 1
      ? `${Math.round(company.avgResponseHours * 60)}분`
      : `${company.avgResponseHours}시간`;
  }
  return company.responseTime ?? "—";
}

// 비교 핵심 지표 3종 — 모든 카드에서 같은 위치/순서로 노출(스캔 비교).
function KpiTiles({ company }) {
  const rating = company.rating > 0 ? company.rating.toFixed(1) : "—";
  const tiles = [
    { top: `★ ${rating}`,                 bot: `후기 ${company.reviews ?? 0}` },
    { top: `${company.completedJobs ?? 0}건`, bot: "시공" },
    { top: responseLabel(company),         bot: "응답속도" },
  ];
  return (
    <div style={{ display: "flex", gap: S.sm, marginTop: S.md }}>
      {tiles.map((t, i) => (
        <div key={i} style={{
          flex: 1, minWidth: 0, textAlign: "center",
          background: C.surface2, borderRadius: R.lg, padding: "9px 4px",
          border: `1px solid ${C.bgWarm}`,
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, lineHeight: 1.15,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.top}</div>
          <div style={{ fontSize: 10.5, color: C.text3, marginTop: 3, whiteSpace: "nowrap" }}>{t.bot}</div>
        </div>
      ))}
    </div>
  );
}

export default function CompanyCardBeta({ company, onClick, isLoggedIn = false, saved = false, onToggleSave }) {
  if (!company) return null;
  const g  = GRADE(company.temp ?? 0);
  const bm = company.badge ? (BADGES[company.badge] ?? BADGES.basic) : null;
  const extraMeta = isLoggedIn
    ? (company.recontractRate != null ? `재계약 ${company.recontractRate}%` : null)
    : (company.disputeRate != null ? `분쟁 ${company.disputeRate}%` : null);

  return (
    <div onClick={onClick} style={{
      display: "flex", background: C.surface, borderRadius: R.xl,
      marginBottom: S.md, cursor: "pointer",
      border: `1px solid ${C.bgWarm}`,
      boxShadow: SHADOW.card, overflow: "hidden",
    }}>
      {/* Grade accent */}
      <div style={{ width: 4, background: g.bar, flexShrink: 0 }} />

      <div style={{ position: "relative", flex: 1, padding: S.xl }}>
        <LeafSprig size={64} color={C.brand} opacity={0.05}
          style={{ position: "absolute", right: -8, bottom: -10, transform: "rotate(-12deg)" }} />

        {/* Header: 대표 아바타 + 이름 + 온도 + 저장 */}
        <div style={{ display: "flex", gap: S.md, alignItems: "flex-start" }}>
          <div style={{
            width: 50, height: 50, borderRadius: R.lg, flexShrink: 0,
            background: C.brandL,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 800, color: C.brand, position: "relative",
          }}>
            {(company.name ?? "?")[0]}
            {company.online && (
              <div style={{
                position: "absolute", bottom: -1, right: -1,
                width: 12, height: 12, borderRadius: "50%",
                background: C.green, border: "2px solid #fff",
              }} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: C.text1, lineHeight: 1.25 }}>{company.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <TempBadge temp={company.temp} info />
                {onToggleSave && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleSave(company); }}
                    aria-label={saved ? "관심 업체 해제" : "관심 업체 저장"}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, lineHeight: 1,
                      padding: 4, margin: -4, color: saved ? C.red : C.text4 }}>
                    {saved ? "♥" : "♡"}
                  </button>
                )}
              </div>
            </div>

            {/* 신뢰 배지 — 공간보증/보험/사업자 (상단 고정) */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {bm ? (
                <span style={{
                  background: bm.bg, color: bm.color, borderRadius: R.full,
                  padding: "3px 10px", fontSize: 11, fontWeight: 700,
                  display: "inline-flex", alignItems: "center", gap: 3,
                }}>
                  {bm.icon} 공간보증 {bm.label}
                </span>
              ) : (
                <span style={{ background: C.surface2, color: C.text3, borderRadius: R.full, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>공간보증 준비중</span>
              )}
              {company.insurance && <CertBadge type="insurance" />}
              {company.bizCert   && <CertBadge type="biz" />}
              {company.online && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: C.greenL, color: C.green,
                  borderRadius: R.full, padding: "3px 10px", fontSize: 11, fontWeight: 600,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green, display: "inline-block" }} />
                  활동중
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 비교 핵심 지표 — 한눈에 비교 */}
        <KpiTiles company={company} />

        {/* 보조 메타 — 거리 · 재계약/분쟁 · 소개 */}
        {(company.distance || extraMeta || company.desc) && (
          <div style={{ marginTop: S.md, fontSize: 12, color: C.text3, lineHeight: 1.55 }}>
            {company.distance && <span>{company.distance}</span>}
            {company.distance && extraMeta && <span> · </span>}
            {extraMeta && <span>{extraMeta}</span>}
            {(company.distance || extraMeta) && company.desc && <span> · </span>}
            {company.desc && <span>{company.desc}</span>}
          </div>
        )}

        {/* 공간보증 배지(068) — badge_visible && ACTIVE 일 때만 */}
        <div style={{ marginTop: S.sm }}><GuaranteeBadge company={company} /></div>

        {/* 신뢰 스크리닝 — 검증 항목 시각화 */}
        <CompanyVerificationBadges company={company} style={{ marginTop: S.sm }} />
      </div>
    </div>
  );
}
