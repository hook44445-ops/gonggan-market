// 업체 지표 공유 컴포넌트 — 업체카드 / 입찰비교 등에서 동일하게 재사용(중복 UI 방지).
//   ⚠️ 표현 전용. Lv/XP/현재·필요 XP 는 기존 levelInfo/computeCompanyXp/LEVEL_THRESHOLDS
//      읽기 전용 파생 — XP 계산·레벨 계산 로직은 수정하지 않는다.
import { C, R, S } from "../../constants";
import { computeCompanyXp, levelInfo, LEVEL_THRESHOLDS, MAX_LEVEL } from "../../constants/growth";

export function responseValue(company = {}) {
  if (company.avgResponseHours > 0) {
    return company.avgResponseHours < 1
      ? `${Math.round(company.avgResponseHours * 60)}분`
      : `${company.avgResponseHours}시간`;
  }
  return company.responseTime ?? "준비";
}

// Lv/XP — 메인카드와 동일 입력으로 읽기 전용 파생.
export function deriveLevel(company = {}) {
  const hasGuarantee = company.guarantee_status === "ACTIVE" || !!company.guarantee_grade || !!company.badge;
  return levelInfo(computeCompanyXp({ completedCount: company.completedJobs ?? 0, hasGuarantee }));
}

// 비교 핵심 지표 3종 — 아이콘/숫자/라벨 크기·위치·높이 완전 통일.
//   tiles 를 넘기면 해당 항목을 그대로 렌더(상세 Hero 등에서 재사용 · 스타일 동일).
export function CompanyKpiTiles({ company = {}, marginTop = S.lg, tiles }) {
  const rating = company.rating > 0 ? company.rating.toFixed(1) : "0.0";
  const resolved = tiles ?? [
    { icon: "⭐", value: rating,                          label: "후기" },
    { icon: "🏗", value: `${company.completedJobs ?? 0}`, label: "시공" },
    { icon: "⚡", value: responseValue(company),           label: "응답" },
  ];
  return (
    <div style={{ display: "flex", gap: S.sm, marginTop }}>
      {resolved.map((t, i) => (
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

// 성장 — Lv 강조 + XP 진행도(현재 / 필요 XP).
export function CompanyLevelBar({ company = {}, marginTop = S.lg }) {
  const gv = deriveLevel(company);
  const curBase  = LEVEL_THRESHOLDS[Math.min(gv.level, MAX_LEVEL) - 1] ?? 0;
  const nextBase = gv.level >= MAX_LEVEL ? null : LEVEL_THRESHOLDS[gv.level];
  const intoXp   = Math.max(0, gv.totalXp - curBase);
  const spanXp   = nextBase != null ? Math.max(1, nextBase - curBase) : 0;
  const xpPct    = nextBase != null ? Math.round((gv.progress ?? 0) * 100) : 100;

  return (
    <div style={{ marginTop }}>
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
  );
}

// 검증배지 — 아이콘 중심 미니 칩(홈/입찰 최대 3개).
export function CompanyMiniBadges({ company = {}, marginTop = 6 }) {
  const hasGuarantee = company.guarantee_status === "ACTIVE" || !!company.guarantee_grade || !!company.badge;
  const items = [];
  if (hasGuarantee) items.push("공간보증");
  if (company.verified || company.bizCert || company.is_verified) items.push("사업자");
  if (company.companyStatus === "ACTIVE" || company.company_status === "ACTIVE") items.push("관리자 검수");
  if (items.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop }}>
      {items.map((b) => (
        <span key={b} style={{
          display: "inline-flex", alignItems: "center", gap: 2,
          background: C.brandL, color: C.brand, borderRadius: R.full,
          padding: "1px 7px", fontSize: 10, fontWeight: 700, lineHeight: 1.5,
        }}>✓ {b}</span>
      ))}
    </div>
  );
}
