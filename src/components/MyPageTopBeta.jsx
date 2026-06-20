// MyPageTopBeta — UX 편의성 고도화 Beta (마이페이지 = 개인 대시보드).
//   ⚠️ 표현 전용 / UI 재배치. 데이터·액션은 모두 props·콜백으로 위임.
//   CompanyMetrics(CompanyLevelBar) 재사용 — 레벨/XP 계산 로직은 수정하지 않는다.
//   원본(여권 카드)은 보존되며 UX_BETA=false 로 즉시 복구.
//   구성: 프로필 → 신뢰상태 → 성장(Lv/XP) → 활동요약 → 내 활동 → 분석카드(공유) → 설정.
//   메뉴보다 '내 상태'가 먼저 보이는 구조(블릿 리포트 UX → 공간사이 신뢰·경험·성장).
import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { CompanyLevelBar } from "./company/CompanyMetrics";

// 150~200ms Count Up (분석 카드 대표 수치 전용).
function useCountUp(target, ms = 200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const n = Number(target);
    if (!Number.isFinite(n) || n <= 0) { setV(n || 0); return; }
    let raf; const t0 = performance.now();
    const tick = (now) => { const p = Math.min(1, (now - t0) / ms); setV(Math.round(n * p)); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Card({ children, style }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: 18,
      boxShadow: "0 1px 4px rgba(28,23,18,0.04)", ...style }}>{children}</div>
  );
}

export default function MyPageTopBeta({
  name, avatarChar, verified, metaText, badgeChip,
  levelCompany, trust, activity = [], myActivity = [], analysis,
  onLogout, onForgetDevice, showForgetConfirm, setShowForgetConfirm,
}) {
  const [toast, setToast] = useState(null);
  const headlineNum = analysis?.headlineNumber;
  const shownHeadline = useCountUp(headlineNum ?? 0);

  const share = async () => {
    const text = analysis?.shareText ?? `[공간사이] ${name}`;
    try {
      if (navigator.share) { await navigator.share({ title: "공간사이", text }); return; }
      await navigator.clipboard?.writeText(text);
      setToast("공유 내용을 복사했어요");
      setTimeout(() => setToast(null), 2000);
    } catch { /* 취소/미지원 무시 */ }
  };

  return (
    <div style={{ marginBottom: S.lg, animation: "mp-fade 200ms ease both" }}>
      <style>{`@keyframes mp-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>

      {/* 타이틀 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: S.lg }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: C.text1, letterSpacing: "-0.4px" }}>마이페이지</span>
      </div>

      {/* 1) 프로필 — 높이 축소·여백 확보 */}
      <Card style={{ display: "flex", alignItems: "center", gap: S.lg, padding: `${S.lg}px ${S.xl}px`, marginBottom: S.xl }}>
        <div style={{ width: 54, height: 54, borderRadius: R.full, background: C.brandL, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: C.brand }}>{avatarChar}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: C.text1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
            {verified && <span title="인증" style={{ fontSize: 13 }}>🛡️</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            {badgeChip && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: C.brandL,
                border: `1px solid ${C.brandM}`, borderRadius: R.full, padding: "2px 9px", fontSize: 11, fontWeight: 700, color: C.brand }}>
                {badgeChip.icon} {badgeChip.label}
              </span>
            )}
            {metaText && <span style={{ fontSize: 12, color: C.text3 }}>{metaText}</span>}
          </div>
        </div>
      </Card>

      {/* 2) 신뢰 상태 */}
      {trust && (
        <Card style={{ display: "flex", alignItems: "center", gap: 10, padding: `${S.md}px ${S.xl}px`, marginBottom: S.md }}>
          <span style={{ fontSize: 18 }}>{trust.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text2 }}>{trust.label}</span>
          <span style={{ marginLeft: "auto", fontSize: 16, fontWeight: 900, color: C.brand }}>{trust.value}</span>
          {trust.sub && <span style={{ fontSize: 11, color: C.text3 }}>{trust.sub}</span>}
        </Card>
      )}

      {/* 3) 성장 — Lv/XP (CompanyMetrics 재사용) */}
      {levelCompany && (
        <Card style={{ padding: S.xl, marginBottom: S.md }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text3, marginBottom: S.sm }}>나의 성장</div>
          <CompanyLevelBar company={levelCompany} marginTop={0} />
        </Card>
      )}

      {/* 4) 활동 요약 — 작은 KPI 4개(숫자 강조) */}
      {activity.length > 0 && (
        <div style={{ display: "flex", gap: S.sm, marginBottom: S.md }}>
          {activity.map((a, i) => (
            <div key={i} style={{ flex: "1 1 0", minWidth: 0, textAlign: "center", background: C.surface,
              border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "12px 4px" }}>
              <div style={{ fontSize: 12, marginBottom: 3 }}>{a.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, lineHeight: 1.05,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.value}</div>
              <div style={{ fontSize: 10, color: C.text3, marginTop: 3, whiteSpace: "nowrap" }}>{a.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 5) 내 활동 — 2x2 그리드 */}
      {myActivity.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: S.sm, marginBottom: S.xl }}>
          {myActivity.map((m) => (
            <button key={m.label} onClick={m.onClick} style={{ display: "flex", alignItems: "center", gap: S.md,
              background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: 18, padding: `${S.lg}px ${S.lg}px`,
              cursor: "pointer", fontFamily: "inherit", textAlign: "left",
              boxShadow: "0 1px 4px rgba(28,23,18,0.04)" }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>{m.icon}</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text1 }}>{m.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* 6) 분석 카드 — 공유 버튼 포함 */}
      {analysis && (
        <Card style={{ padding: S.xl, marginBottom: S.xl }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: S.md }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>{analysis.title}</span>
            <button onClick={share} aria-label="공유" style={{ display: "inline-flex", alignItems: "center", gap: 4,
              background: C.bg, border: `1px solid ${C.bgWarm}`, borderRadius: R.full, padding: "5px 12px",
              fontSize: 12, fontWeight: 700, color: C.text2, cursor: "pointer", fontFamily: "inherit" }}>
              ↗ 공유
            </button>
          </div>

          {/* 대표 헤드라인 */}
          {analysis.headline && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: S.lg }}>
              <span style={{ fontSize: 22 }}>{analysis.headline.icon}</span>
              <span style={{ fontSize: 26, fontWeight: 900, color: C.brand, lineHeight: 1 }}>
                {headlineNum != null ? `${shownHeadline}${analysis.headlineSuffix ?? ""}` : analysis.headline.text}
              </span>
              {headlineNum != null && analysis.headline.text && (
                <span style={{ fontSize: 13, color: C.text3 }}>{analysis.headline.text}</span>
              )}
            </div>
          )}

          {/* 항목 */}
          {analysis.items?.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(4, analysis.items.length)},1fr)`, gap: S.sm, marginBottom: analysis.ctas?.length ? S.lg : 0 }}>
              {analysis.items.map((it, i) => (
                <div key={i} style={{ textAlign: "center", background: C.surface2, borderRadius: R.lg, padding: "10px 4px" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, lineHeight: 1.1 }}>{it.value}</div>
                  <div style={{ fontSize: 10, color: C.text3, marginTop: 3, whiteSpace: "nowrap" }}>{it.icon} {it.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          {analysis.ctas?.length > 0 && (
            <div style={{ display: "flex", gap: S.sm }}>
              {analysis.ctas.map((c, i) => (
                <button key={c.label} onClick={c.onClick} style={{ flex: 1, padding: "12px", borderRadius: R.lg,
                  fontSize: 13.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                  background: i === 0 ? C.brand : C.surface, color: i === 0 ? "#fff" : C.text2,
                  border: i === 0 ? "none" : `1px solid ${C.bgWarm}` }}>{c.label}</button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 7) 설정 — 로그아웃 / 기기 인증 삭제 (기능 보존) */}
      <Card style={{ overflow: "hidden" }}>
        <button onClick={onLogout} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: `${S.lg}px ${S.xl}px`, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          <span style={{ fontSize: 14, color: C.text2 }}>↩ 로그아웃</span>
          <span style={{ fontSize: 16, color: C.text3 }}>›</span>
        </button>
        {onForgetDevice && (
          <div style={{ borderTop: `1px solid ${C.bg}` }}>
            {!showForgetConfirm ? (
              <button onClick={() => setShowForgetConfirm(true)} style={{ width: "100%", textAlign: "left",
                padding: `${S.md}px ${S.xl}px`, background: "none", border: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 12, color: C.text4 }}>이 기기 인증 삭제 (완전 로그아웃)</button>
            ) : (
              <div style={{ padding: S.lg }}>
                <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.6, marginBottom: 10 }}>
                  이 기기에 저장된 계정 목록과 전화번호 인증이 삭제됩니다.<br />다음 로그인 시 전화번호 인증을 다시 진행해야 합니다.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setShowForgetConfirm(false)} style={{ flex: 1, padding: "10px", background: C.surface,
                    color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.md, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>취소</button>
                  <button onClick={() => { setShowForgetConfirm(false); onForgetDevice(); }} style={{ flex: 1, padding: "10px",
                    background: C.red, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>삭제하고 로그아웃</button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {toast && (
        <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.82)",
          color: "#fff", borderRadius: 20, padding: "10px 20px", fontSize: 13, fontWeight: 600, zIndex: 500, whiteSpace: "nowrap" }}>{toast}</div>
      )}
    </div>
  );
}
