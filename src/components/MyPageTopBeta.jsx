// MyPageTopBeta — UX 편의성 고도화 Beta (마이페이지 최종 = 개인 대시보드).
//   ⚠️ 표현 전용 / UI 재배치. 데이터·액션은 props·콜백 위임. CompanyMetrics(CompanyLevelBar) 재사용.
//   원본(여권 카드) 보존 · UX_BETA=false 즉시 복구. 레벨/XP/DB/API/로직 무수정.
//   업체: 신뢰·성장 대시보드(프로필[Lv/공간보증/공간온도] → XP → KPI → 관리 → AI 리포트).
//   의뢰인: 프로젝트·기록 대시보드(프로필 → XP → 활동요약 → 내 활동 → 최근 프로젝트).
import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { CompanyLevelBar } from "./company/CompanyMetrics";

// 150~200ms Count Up (분석 대표 수치 전용).
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
    <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: 20,
      boxShadow: "0 1px 4px rgba(28,23,18,0.04)", ...style }}>{children}</div>
  );
}

export default function MyPageTopBeta({
  name, avatarChar, verified, metaText, profileBadges = [],
  levelCompany, activity = [], myActivity = [], analysis, recentProject,
  onLogout, onForgetDevice, showForgetConfirm, setShowForgetConfirm,
  showSettings = true, isConsumer = false,
}) {
  const [toast, setToast] = useState(null);
  const headlineNum = analysis?.headlineNumber;
  const shownHeadline = useCountUp(headlineNum ?? 0);

  const share = async () => {
    const text = analysis?.shareText ?? `[공간사이] ${name}`;
    try {
      if (navigator.share) { await navigator.share({ title: "공간사이", text }); return; }
      await navigator.clipboard?.writeText(text);
      setToast("리포트를 복사했어요");
      setTimeout(() => setToast(null), 2000);
    } catch { /* 취소/미지원 무시 */ }
  };

  const GAP = 22; // 카드 간격(≈24px)

  return (
    <div style={{ marginBottom: S.lg, animation: "mp-fade 200ms ease both" }}>
      <style>{`@keyframes mp-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>

      <div style={{ marginBottom: S.lg }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: C.text1, letterSpacing: "-0.4px" }}>마이페이지</span>
        {isConsumer && (
          <div style={{ fontSize: 12.5, color: C.text3, marginTop: 4, lineHeight: 1.6 }}>
            좋은 공간은 삶을 바꾸고,<br/>좋은 기록은 그 이야기를 남깁니다.
          </div>
        )}
      </div>

      {/* 1) 프로필 — Lv/공간보증/공간온도 등을 칩으로 함께 노출(별도 카드 없음) */}
      <Card style={{ display: "flex", alignItems: "center", gap: S.lg, padding: `${S.lg}px ${S.xl}px`, marginBottom: GAP }}>
        <div style={{ width: 54, height: 54, borderRadius: R.full, background: C.brandL, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: C.brand }}>{avatarChar}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: C.text1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
            {verified && <span title="인증" style={{ fontSize: 13 }}>🛡️</span>}
          </div>
          {profileBadges.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
              {profileBadges.map((b) => (
                <span key={b.label} style={{ display: "inline-flex", alignItems: "center", gap: 3, background: C.brandL,
                  border: `1px solid ${C.brandM}`, borderRadius: R.full, padding: "2px 9px", fontSize: 11, fontWeight: 700, color: C.brand }}>
                  {b.icon} {b.label}
                </span>
              ))}
            </div>
          )}
          {metaText && <div style={{ fontSize: 12, color: C.text3, marginTop: 5 }}>{metaText}</div>}
        </div>
      </Card>

      {/* 2) 성장 — XP Progress 가 먼저 보이도록 (CompanyMetrics 재사용) */}
      {levelCompany && (
        <Card style={{ padding: S.xl, marginBottom: GAP }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text3, marginBottom: S.sm }}>나의 성장</div>
          <CompanyLevelBar company={levelCompany} marginTop={0} />
        </Card>
      )}

      {/* 3) 활동 요약 — KPI 4개(숫자 강조) */}
      {activity.length > 0 && (
        <div style={{ display: "flex", gap: S.sm, marginBottom: GAP }}>
          {activity.map((a, i) => (
            <div key={i} style={{ flex: "1 1 0", minWidth: 0, textAlign: "center", background: C.surface,
              border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "14px 4px" }}>
              <div style={{ fontSize: 11, marginBottom: 4 }}>{a.icon}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: C.text1, lineHeight: 1.05,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.value}</div>
              <div style={{ fontSize: 12, color: C.text3, marginTop: 4, whiteSpace: "nowrap" }}>{a.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 4) 내 활동 — 2x2 */}
      {myActivity.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: S.sm, marginBottom: GAP }}>
          {myActivity.map((m) => (
            <button key={m.label} onClick={m.onClick} style={{ display: "flex", alignItems: "center", gap: S.md,
              background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: 20, padding: `${S.lg}px`,
              cursor: "pointer", fontFamily: "inherit", textAlign: "left", boxShadow: "0 1px 4px rgba(28,23,18,0.04)" }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>{m.icon}</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text1 }}>{m.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* 5-A) 최근 프로젝트 (의뢰인) */}
      {recentProject && (
        <Card style={{ padding: S.xl, marginBottom: GAP }}>
          <div style={{ fontSize: 12, color: C.text3, fontWeight: 700, marginBottom: 4 }}>{recentProject.label}</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>{recentProject.title}</div>
          {recentProject.sub && <div style={{ fontSize: 13, color: C.text3, marginTop: 3 }}>{recentProject.sub}</div>}
          {recentProject.cta && (
            <button onClick={recentProject.cta.onClick} style={{ marginTop: S.md, width: "100%", padding: "12px",
              background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
              {recentProject.cta.label}
            </button>
          )}
        </Card>
      )}

      {/* 5-B) AI 업체 리포트 (업체) — 분석형 + 공유 */}
      {analysis && (
        <Card style={{ padding: S.xl, marginBottom: GAP }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: S.md }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>{analysis.title}</span>
            <button onClick={share} aria-label="공유" style={{ display: "inline-flex", alignItems: "center",
              justifyContent: "center", height: 32, minWidth: 72, padding: "0 10px",
              background: "transparent", border: `1px solid ${C.bgWarm}`, borderRadius: R.md,
              fontSize: 12, fontWeight: 600, color: C.text3, cursor: "pointer", fontFamily: "inherit" }}>공유</button>
          </div>
          {analysis.headlineText && (
            <div style={{ background: C.brandL, borderRadius: R.lg, padding: "10px 13px", marginBottom: S.md,
              fontSize: 13.5, fontWeight: 700, color: C.brand, lineHeight: 1.5 }}>
              {analysis.headlineIcon} {headlineNum != null ? `${shownHeadline}${analysis.headlineSuffix ?? ""} · ` : ""}{analysis.headlineText}
            </div>
          )}
          {analysis.rows?.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: `${S.sm}px 0`, borderBottom: i < analysis.rows.length - 1 ? `1px solid ${C.bg}` : "none" }}>
              <span style={{ fontSize: 13, color: C.text2 }}>{r.icon} {r.label}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>{r.value}{r.note ? <span style={{ fontSize: 11, color: C.text3, fontWeight: 600 }}> {r.note}</span> : null}</span>
            </div>
          ))}
        </Card>
      )}

      {/* 6) 설정 — 로그아웃 / 기기 인증 삭제 (기능 보존) */}
      {showSettings && (
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
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.82)",
          color: "#fff", borderRadius: 20, padding: "10px 20px", fontSize: 13, fontWeight: 600, zIndex: 500, whiteSpace: "nowrap" }}>{toast}</div>
      )}
    </div>
  );
}
