// CompanyCardBeta — UX 편의성 고도화 Beta (업체카드 '한눈에 비교' 재배치).
//   ⚠️ 표현 전용. props·데이터·onClick·onToggleSave 등 기존 인터페이스/로직 100% 동일.
//   원본(CompanyCard.jsx)은 그대로 보존되며, constants/release.UX_BETA=false 로 즉시 복구.
//   v2(피드백 반영): KPI 에 아이콘+의미 표기, 3타일 크기 완전 통일, 재계약률 강조 스트립,
//   인증배지 자동 줄바꿈 간격 통일, 카드 여백 확대.
import { C, R, S, GRADE, SHADOW } from "../constants";
import { BADGES } from "../constants/badges";
import { TempBadge, CertBadge, LeafSprig } from "./common";
import CompanyVerificationBadges from "./CompanyVerificationBadges";
import GuaranteeBadge from "./GuaranteeBadge";

function responseValue(company) {
  if (company.avgResponseHours > 0) {
    return company.avgResponseHours < 1
      ? `${Math.round(company.avgResponseHours * 60)}분`
      : `${company.avgResponseHours}시간`;
  }
  return company.responseTime ?? null; // 데이터 없으면 null → '응답 준비'
}

// 비교 핵심 지표 3종 — 모든 카드에서 같은 위치/순서/크기로 노출(스캔 비교).
//   타일 높이·폭·글자크기·여백을 완전히 동일하게 고정.
function KpiTiles({ company }) {
  const rating = company.rating > 0 ? company.rating.toFixed(1) : "0.0";
  const reviews = company.reviews ?? 0;
  const completed = company.completedJobs ?? 0;
  const resp = responseValue(company);

  const tiles = [
    { icon: "⭐", value: rating,           label: `평점 · 후기 ${reviews}` },
    { icon: "🏗", value: `${completed}건`, label: "시공 실적" },
    { icon: "⚡", value: resp ?? "준비",   label: resp ? "평균 응답" : "응답 준비" },
  ];

  return (
    <div style={{ display: "flex", gap: S.sm, marginTop: S.md }}>
      {tiles.map((t, i) => (
        <div key={i} style={{
          flex: "1 1 0", minWidth: 0, minHeight: 62, boxSizing: "border-box",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          textAlign: "center", background: C.surface2, borderRadius: R.lg, padding: "10px 4px",
          border: `1px solid ${C.bgWarm}`,
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, lineHeight: 1.1,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
            <span style={{ fontSize: 13 }}>{t.icon}</span> {t.value}
          </div>
          <div style={{ fontSize: 10.5, color: C.text3, marginTop: 5, lineHeight: 1.2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{t.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function CompanyCardBeta({ company, onClick, isLoggedIn = false, saved = false, onToggleSave }) {
  if (!company) return null;
  const g  = GRADE(company.temp ?? 0);
  const bm = company.badge ? (BADGES[company.badge] ?? BADGES.basic) : null;
  const showRecontract = isLoggedIn && company.recontractRate != null;
  const showDispute    = !isLoggedIn && company.disputeRate != null;

  // 인증배지 컨테이너 — 자동 줄바꿈 + 간격/높이 통일.
  const badgeRow = { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" };

  return (
    <div onClick={onClick} style={{
      display: "flex", background: C.surface, borderRadius: R.xl,
      marginBottom: S.md, cursor: "pointer",
      border: `1px solid ${C.bgWarm}`,
      boxShadow: SHADOW.card, overflow: "hidden",
    }}>
      {/* Grade accent */}
      <div style={{ width: 4, background: g.bar, flexShrink: 0 }} />

      <div style={{ position: "relative", flex: 1, padding: `${S.xl}px ${S.xl}px ${S.lg}px` }}>
        <LeafSprig size={64} color={C.brand} opacity={0.05}
          style={{ position: "absolute", right: -8, bottom: -10, transform: "rotate(-12deg)" }} />

        {/* Header: 대표 아바타 + 이름 + 온도 + 저장 */}
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 7 }}>
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

            {/* 신뢰 배지 — 공간보증/보험/사업자/활동중 (자동 줄바꿈·간격 통일) */}
            <div style={badgeRow}>
              {bm ? (
                <span style={{
                  background: bm.bg, color: bm.color, borderRadius: R.full,
                  padding: "3px 10px", fontSize: 11, fontWeight: 700,
                  display: "inline-flex", alignItems: "center", gap: 3, lineHeight: 1.4,
                }}>
                  {bm.icon} 공간보증 {bm.label}
                </span>
              ) : (
                <span style={{ background: C.surface2, color: C.text3, borderRadius: R.full, padding: "3px 10px", fontSize: 11, fontWeight: 600, lineHeight: 1.4 }}>공간보증 준비중</span>
              )}
              {company.insurance && <CertBadge type="insurance" />}
              {company.bizCert   && <CertBadge type="biz" />}
              {company.online && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: C.greenL, color: C.green,
                  borderRadius: R.full, padding: "3px 10px", fontSize: 11, fontWeight: 600, lineHeight: 1.4,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green, display: "inline-block" }} />
                  활동중
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 비교 핵심 지표 — 한눈에 비교 (크기 통일 3타일) */}
        <KpiTiles company={company} />

        {/* 재계약률 강조 스트립 — KPI 영역과 연결 */}
        {(showRecontract || showDispute) && (
          <div style={{
            marginTop: S.sm, display: "flex", alignItems: "center", gap: 7,
            background: showRecontract ? C.brandL : C.surface2,
            borderRadius: R.lg, padding: "9px 13px",
          }}>
            <span style={{ fontSize: 14 }}>{showRecontract ? "🔁" : "🛡"}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: showRecontract ? C.brand : C.text2 }}>
              {showRecontract ? "재계약률" : "분쟁률"}
            </span>
            <span style={{ marginLeft: "auto", fontSize: 15, fontWeight: 800, color: showRecontract ? C.brand : C.text1 }}>
              {showRecontract ? `${company.recontractRate}%` : `${company.disputeRate}%`}
            </span>
          </div>
        )}

        {/* 보조 메타 — 거리 · 소개 */}
        {(company.distance || company.desc) && (
          <div style={{ marginTop: S.md, fontSize: 12, color: C.text3, lineHeight: 1.55 }}>
            {company.distance && <span>{company.distance}</span>}
            {company.distance && company.desc && <span> · </span>}
            {company.desc && <span>{company.desc}</span>}
          </div>
        )}

        {/* 공간보증 배지(068) + 신뢰 스크리닝 — 자동 줄바꿈·간격 통일 */}
        <div style={{ marginTop: S.md }}>
          <GuaranteeBadge company={company} />
        </div>
        <CompanyVerificationBadges company={company} style={{ marginTop: S.sm, gap: 6 }} />
      </div>
    </div>
  );
}
