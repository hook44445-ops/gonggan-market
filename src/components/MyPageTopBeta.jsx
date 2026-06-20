// MyPageTopBeta — UX 편의성 고도화 Beta (마이페이지 상단 재구성).
//   ⚠️ 표현 전용. 데이터·액션은 모두 props/콜백으로 위임(로그인/세션/권한/DB/API 무관).
//   원본(MainApp 마이페이지 여권 카드)은 보존되며 UX_BETA=false 로 즉시 복구.
//   레퍼런스 레이아웃 차용: 프로필 행 → 3분할 퀵카드 → 통계/신뢰도 → 정돈된 설정 행.
//   기존 기능 보존: 통계·신뢰도·등급·로그아웃·기기 인증 삭제.
import { C, R, S } from "../constants";

export default function MyPageTopBeta({
  name, avatarChar, metaText, roleLabel, verified, gradeChip,
  stats = [], trust, cards = [],
  onLogout, onForgetDevice, showForgetConfirm, setShowForgetConfirm,
}) {
  return (
    <div style={{ marginBottom: S.lg }}>
      {/* 타이틀 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: S.lg }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: C.text1, letterSpacing: "-0.4px" }}>마이페이지</span>
        {roleLabel && (
          <span style={{ fontSize: 11, fontWeight: 700, color: C.brand, background: C.brandL,
            border: `1px solid ${C.brandM}`, borderRadius: R.full, padding: "4px 11px" }}>{roleLabel}</span>
        )}
      </div>

      {/* 프로필 행 */}
      <div style={{ display: "flex", alignItems: "center", gap: S.lg, background: C.surface,
        border: `1px solid ${C.bgWarm}`, borderRadius: R.xl, padding: S.xl, marginBottom: S.md }}>
        <div style={{ width: 58, height: 58, borderRadius: R.full, background: C.brandL,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, fontWeight: 800, color: C.brand, flexShrink: 0 }}>{avatarChar}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: C.text1,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
            {verified && <span title="인증 회원" style={{ fontSize: 14, lineHeight: 1 }}>🛡️</span>}
          </div>
          {metaText && <div style={{ fontSize: 12.5, color: C.text3, marginTop: 3 }}>{metaText}</div>}
        </div>
        {gradeChip && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: C.brandL,
            border: `1px solid ${C.brandM}`, borderRadius: R.full, padding: "5px 11px", flexShrink: 0 }}>
            <span style={{ fontSize: 14 }}>{gradeChip.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.brand }}>{gradeChip.label}</span>
          </div>
        )}
      </div>

      {/* 3분할 퀵카드 */}
      {cards.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cards.length},1fr)`, gap: S.sm, marginBottom: S.md }}>
          {cards.map((c) => (
            <button key={c.label} onClick={c.onClick} style={{
              background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.xl,
              padding: `${S.lg}px ${S.sm}px`, cursor: "pointer", fontFamily: "inherit",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 8, minHeight: 82,
            }}>
              <span style={{ fontSize: 24, lineHeight: 1 }}>{c.icon}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text2 }}>{c.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* 통계 스트립 (기존 보존) */}
      {stats.length > 0 && (
        <div style={{ display: "flex", background: C.surface, border: `1px solid ${C.bgWarm}`,
          borderRadius: R.xl, padding: `${S.md}px 0`, marginBottom: S.md }}>
          {stats.map(([v, l], i) => (
            <div key={l} style={{ flex: 1, textAlign: "center",
              borderRight: i < stats.length - 1 ? `1px solid ${C.bgWarm}` : "none" }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: C.brand }}>{v}</div>
              <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* 신뢰도 지수 (기존 보존) */}
      {trust && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          background: C.brandL, border: `1px solid ${C.brandM}`, borderRadius: R.lg,
          padding: `${S.sm}px ${S.lg}px`, marginBottom: S.md }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.brand }}>🤝 신뢰도 지수</span>
          <span style={{ fontSize: 15, fontWeight: 900, color: C.brand }}>{trust.score.toFixed(1)}</span>
          <span style={{ fontSize: 11, color: C.text3 }}>업체 평가 {trust.count}건</span>
        </div>
      )}

      {/* 설정 — 로그아웃 / 기기 인증 삭제 (기존 기능 보존) */}
      <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.xl, overflow: "hidden" }}>
        <button onClick={onLogout} style={{ width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: `${S.lg}px ${S.xl}px`, background: "none",
          border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          <span style={{ fontSize: 14, color: C.text2 }}>↩ 로그아웃</span>
          <span style={{ fontSize: 16, color: C.text3 }}>›</span>
        </button>
        {onForgetDevice && (
          <div style={{ borderTop: `1px solid ${C.bg}` }}>
            {!showForgetConfirm ? (
              <button onClick={() => setShowForgetConfirm(true)} style={{ width: "100%", textAlign: "left",
                padding: `${S.md}px ${S.xl}px`, background: "none", border: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 12, color: C.text4 }}>
                이 기기 인증 삭제 (완전 로그아웃)
              </button>
            ) : (
              <div style={{ padding: S.lg }}>
                <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.6, marginBottom: 10 }}>
                  이 기기에 저장된 계정 목록과 전화번호 인증이 삭제됩니다.<br />
                  다음 로그인 시 전화번호 인증을 다시 진행해야 합니다.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setShowForgetConfirm(false)} style={{ flex: 1, padding: "10px",
                    background: C.surface, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.md,
                    fontWeight: 700, fontSize: 13, cursor: "pointer" }}>취소</button>
                  <button onClick={() => { setShowForgetConfirm(false); onForgetDevice(); }} style={{ flex: 1,
                    padding: "10px", background: C.red, color: "#fff", border: "none", borderRadius: R.md,
                    fontWeight: 800, fontSize: 13, cursor: "pointer" }}>삭제하고 로그아웃</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
