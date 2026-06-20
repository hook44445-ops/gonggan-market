// CompanyCardBeta — UX 편의성 고도화 Beta (업체카드 최종 마감 · Final Polish).
//   ⚠️ 표현 전용. props·데이터·onClick·onToggleSave 등 기존 인터페이스/로직 100% 동일.
//   원본(CompanyCard.jsx)은 그대로 보존되며, constants/release.UX_BETA=false 로 즉시 복구.
//   목표: 구조 변경 없이 완성도만 — 3초 안에 비교되는 프리미엄 미니멀 카드.
//     1) XP 진행도 직관화(현재/필요 XP + %)  2) Lv 강조  3) 업체명 2줄 허용
//     4) KPI 크기·간격 완전 통일  5) 검증배지 미니멀(홈 2~3개)
//   ※ Lv/XP/현재·필요 XP 는 기존 levelInfo/computeCompanyXp/LEVEL_THRESHOLDS 읽기 전용 파생.
//      XP 계산·레벨 계산 로직은 수정하지 않는다.
import { C, R, S, GRADE, SHADOW } from "../constants";
import { computeCompanyXp, levelInfo, LEVEL_THRESHOLDS, MAX_LEVEL } from "../constants/growth";
import { TempBadge, LeafSprig } from "./common";

function responseValue(company) {
  if (company.avgResponseHours > 0) {
    return company.avgResponseHours < 1
      ? `${Math.round(company.avgResponseHours * 60)}분`
      : `${company.avgResponseHours}시간`;
  }
  return company.responseTime ?? "준비";
}

// 비교 핵심 지표 3종 — 아이콘/숫자/라벨 크기·위치·높이 완전 통일.
function KpiTiles({ company }) {
  const rating = company.rating > 0 ? company.rating.toFixed(1) : "0.0";
  const tiles = [
    { icon: "⭐", value: rating,                          label: "후기" },
    { icon: "🏗", value: `${company.completedJobs ?? 0}`, label: "시공" },
    { icon: "⚡", value: responseValue(company),           label: "응답" },
  ];
  return (
    <div style={{ display: "flex", gap: S.sm, marginTop: S.lg }}>
      {tiles.map((t, i) => (
        <div key={i} style={{
          flex: "1 1 0", minWidth: 0, height: 66, boxSizing: "border-box",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          textAlign: "center", background: C.surface2, borderRadius: R.lg, padding: "10px 4px",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4, maxWidth: "100%" }}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>{t.icon}</span>
            <span style={{ fontSize: 21, fontWeight: 800, color: C.text1, lineHeight: 1.05,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.value}</span>
          </div>
          <div style={{ fontSize: 10.5, color: C.text3, marginTop: 6, lineHeight: 1 }}>{t.label}</div>
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
  // 현재 레벨 구간의 현재/필요 XP (LEVEL_THRESHOLDS 읽기 전용 파생).
  const curBase  = LEVEL_THRESHOLDS[Math.min(gv.level, MAX_LEVEL) - 1] ?? 0;
  const nextBase = gv.level >= MAX_LEVEL ? null : LEVEL_THRESHOLDS[gv.level];
  const intoXp   = Math.max(0, gv.totalXp - curBase);
  const spanXp   = nextBase != null ? Math.max(1, nextBase - curBase) : 0;
  const xpPct    = nextBase != null ? Math.round((gv.progress ?? 0) * 100) : 100;

  // 검증배지 — 홈에서는 2~3개만, 더 미니멀하게.
  const miniBadges = [];
  if (hasGuarantee) miniBadges.push("공간보증");
  if (company.verified || company.bizCert || company.is_verified) miniBadges.push("사업자");
  if (company.companyStatus === "ACTIVE" || company.company_status === "ACTIVE") miniBadges.push("관리자 검수");

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
            {/* 업체명 — 최대 2줄, 말줄임 최소화(브랜드이므로 가장 먼저 읽히게) */}
            <div style={{
              fontSize: 16, fontWeight: 800, color: C.text1, lineHeight: 1.3,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden", wordBreak: "break-word",
            }}>{company.name}</div>
            {/* 미니 배지 — 높이·패딩 축소, 간격 통일 */}
            {miniBadges.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                {miniBadges.map((b) => (
                  <span key={b} style={{
                    display: "inline-flex", alignItems: "center", gap: 2,
                    background: C.brandL, color: C.brand, borderRadius: R.full,
                    padding: "1px 7px", fontSize: 10, fontWeight: 700, lineHeight: 1.5,
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

        {/* 비교 핵심 지표 — 숫자 강조 (크기·간격 통일 3타일) */}
        <KpiTiles company={company} />

        {/* 성장 — Lv 강조 + XP 진행도 직관화(현재 / 필요 XP) */}
        <div style={{ marginTop: S.lg }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: C.text1, lineHeight: 1 }}>Lv.{gv.level}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: C.brand, lineHeight: 1 }}>
              {gv.isMax ? "MAX" : `${xpPct}%`}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: R.full, background: C.bgWarm, overflow: "hidden" }}>
            <div style={{ width: `${xpPct}%`, height: "100%", background: C.brand, borderRadius: R.full, transition: "width 0.4s" }} />
          </div>
          <div style={{ marginTop: 5, fontSize: 10.5, color: C.text4, textAlign: "right" }}>
            {gv.isMax ? "최고 레벨" : `${intoXp.toLocaleString()} / ${spanXp.toLocaleString()} XP`}
          </div>
        </div>
      </div>
    </div>
  );
}
