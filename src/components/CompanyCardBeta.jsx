// CompanyCardBeta — UX 편의성 고도화 Beta (업체카드 미니멀 리디자인).
//   ⚠️ 표현 전용. props·데이터·onClick·onToggleSave 등 기존 인터페이스/로직 100% 동일.
//   원본(CompanyCard.jsx)은 그대로 보존되며, constants/release.UX_BETA=false 로 즉시 복구.
//   v3(미니멀): "정보 많은 카드"가 아니라 "3초 안에 비교되는 카드".
//     · 핵심 숫자(평점·시공·응답)만 크게  · Lv+XP 바 소형  · 재계약률/소개 등 절제
//     · 배지 최소화(아이콘 중심)  · 여백 확대
//   ※ Lv/XP 는 기존 levelInfo/computeCompanyXp 를 읽기 전용으로 파생(레벨 계산 로직 무수정).
import { C, R, S, GRADE, SHADOW } from "../constants";
import { computeCompanyXp, levelInfo } from "../constants/growth";
import { TempBadge, LeafSprig } from "./common";

function responseValue(company) {
  if (company.avgResponseHours > 0) {
    return company.avgResponseHours < 1
      ? `${Math.round(company.avgResponseHours * 60)}분`
      : `${company.avgResponseHours}시간`;
  }
  return company.responseTime ?? "준비";
}

// 비교 핵심 지표 3종 — 숫자를 가장 크게. 모든 카드 동일 크기.
function KpiTiles({ company }) {
  const rating = company.rating > 0 ? company.rating.toFixed(1) : "0.0";
  const tiles = [
    { icon: "⭐", value: rating,                      label: "후기" },
    { icon: "🏗", value: `${company.completedJobs ?? 0}`, label: "시공" },
    { icon: "⚡", value: responseValue(company),       label: "응답" },
  ];
  return (
    <div style={{ display: "flex", gap: S.sm, marginTop: S.lg }}>
      {tiles.map((t, i) => (
        <div key={i} style={{
          flex: "1 1 0", minWidth: 0, minHeight: 64, boxSizing: "border-box",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          textAlign: "center", background: C.surface2, borderRadius: R.lg, padding: "12px 4px",
        }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: C.text1, lineHeight: 1.05,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
            <span style={{ fontSize: 13 }}>{t.icon}</span> {t.value}
          </div>
          <div style={{ fontSize: 10.5, color: C.text3, marginTop: 5 }}>{t.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function CompanyCardBeta({ company, onClick, isLoggedIn = false, saved = false, onToggleSave }) {
  if (!company) return null;
  const g = GRADE(company.temp ?? 0);

  // Lv/XP — 메인카드와 동일 입력으로 읽기 전용 파생.
  const hasGuarantee = company.guarantee_status === "ACTIVE" || !!company.guarantee_grade || !!company.badge;
  const gv = levelInfo(computeCompanyXp({ completedCount: company.completedJobs ?? 0, hasGuarantee }));
  const xpPct = Math.round((gv.progress ?? 0) * 100);

  // 배지 최소화 — 아이콘 중심의 소형 칩(불필요한 텍스트 절제).
  const miniBadges = [];
  if (hasGuarantee) miniBadges.push("보증");
  if (company.verified || company.bizCert || company.is_verified) miniBadges.push("사업자");
  if (company.companyStatus === "ACTIVE" || company.company_status === "ACTIVE") miniBadges.push("검수");

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

        {/* Header: 아바타 + 이름/배지 + 온도/저장 */}
        <div style={{ display: "flex", gap: S.md, alignItems: "center" }}>
          <div style={{
            width: 52, height: 52, borderRadius: R.lg, flexShrink: 0,
            background: C.brandL,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 21, fontWeight: 800, color: C.brand, position: "relative",
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
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, lineHeight: 1.25,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{company.name}</div>
            {/* 미니 배지 — 아이콘 중심, 간격 축소 */}
            {miniBadges.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                {miniBadges.map((b) => (
                  <span key={b} style={{
                    display: "inline-flex", alignItems: "center", gap: 2,
                    background: C.brandL, color: C.brand, borderRadius: R.full,
                    padding: "2px 8px", fontSize: 10.5, fontWeight: 700, lineHeight: 1.4,
                  }}>✓ {b}</span>
                ))}
              </div>
            )}
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

        {/* 비교 핵심 지표 — 숫자 강조 (크기 통일 3타일) */}
        <KpiTiles company={company} />

        {/* 성장 — Lv + XP 바 (카드를 방해하지 않는 소형) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: S.md }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: C.brand, flexShrink: 0 }}>Lv.{gv.level}</span>
          <div style={{ flex: 1, height: 5, borderRadius: R.full, background: C.bgWarm, overflow: "hidden" }}>
            <div style={{ width: `${xpPct}%`, height: "100%", background: C.brand, borderRadius: R.full, transition: "width 0.4s" }} />
          </div>
          <span style={{ fontSize: 10.5, color: C.text4, flexShrink: 0 }}>
            {gv.isMax ? "MAX" : `${Number(gv.xpToNext).toLocaleString()} XP`}
          </span>
        </div>
      </div>
    </div>
  );
}
