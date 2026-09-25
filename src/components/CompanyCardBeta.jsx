// CompanyCardBeta — UX 편의성 고도화 Beta (업체카드 · 디자인 동결).
//   ⚠️ 표현 전용. props·데이터·onClick·onToggleSave 등 기존 인터페이스/로직 100% 동일.
//   원본(CompanyCard.jsx)은 그대로 보존되며, constants/release.UX_BETA=false 로 즉시 복구.
//   KPI/Level/XP/Badge 는 company/CompanyMetrics 공유 컴포넌트를 재사용(중복 UI 없음).
import { C, R, S, GRADE, SHADOW } from "../constants";
import { TempBadge, LeafSprig } from "./common";
import { CompanyKpiTiles } from "./company/CompanyMetrics";
import { CompanyTrustRow } from "./TrustEmblems";

export default function CompanyCardBeta({ company, onClick, isLoggedIn = false, saved = false, onToggleSave }) {
  if (!company) return null;
  const g = GRADE(company.temp ?? 0);

  return (
    <div onClick={onClick} style={{
      display: "flex", background: C.surface, borderRadius: R.xl,
      marginBottom: S.md, cursor: "pointer",
      border: `1px solid ${C.bgWarm}`,
      boxShadow: SHADOW.card, overflow: "hidden",
    }}>
      {/* Grade accent */}
      <div style={{ width: 4, background: g.bar, flexShrink: 0 }} />

      <div style={{ position: "relative", flex: 1, padding: `${S.xxl}px ${S.xl}px` }}>
        <LeafSprig size={60} color={C.brand} opacity={0.04}
          style={{ position: "absolute", right: -8, bottom: -10, transform: "rotate(-12deg)" }} />

        {/* Header: 아바타 + 이름(2줄 허용)/배지 + 온도/저장 */}
        <div style={{ display: "flex", gap: S.md, alignItems: "flex-start" }}>
          <div style={{
            width: 52, height: 52, borderRadius: R.lg, flexShrink: 0, overflow: "hidden",
            background: C.brandL,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 21, fontWeight: 800, color: C.brand, position: "relative",
          }}>
            {/* 업체 얼굴 — 로고가 있으면 그림, 없으면 이름 첫 글자(프로필 화면과 같은 규칙) */}
            {company.logo
              ? <img src={company.logo} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              : (company.name ?? "?")[0]}
            {company.online && (
              <div style={{
                position: "absolute", bottom: -1, right: -1,
                width: 12, height: 12, borderRadius: "50%",
                background: C.green, border: "2px solid #fff",
              }} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* 업체명 — 최대 2줄, 말줄임 최소화(브랜드이므로 가장 먼저 읽히게) */}
            <div style={{
              fontSize: 16, fontWeight: 800, color: C.text1, lineHeight: 1.3,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden", wordBreak: "break-word",
            }}>{company.name}</div>
          </div>

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

        {/* 비교 핵심 지표 (공유) */}
        <CompanyKpiTiles company={company} />

        {/* 신뢰 — 레벨 엠블럼 + 사업자·시공보험·보증금·실내건축(입찰 비교 카드와 같은 줄).
            예전엔 「✓ 공간보증」 글자 칩이라 시공보험·실내건축이 지도에선 아예 안 보였다(대표 09-25). */}
        <CompanyTrustRow company={company} />
      </div>
    </div>
  );
}
