// 업체 성장 안내 모달 — 성장 카드 클릭 시 표시.
//   "성장은 경쟁이 아니라 성실과 정직에서 시작됩니다." 철학 안내.
export default function GrowthModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 600,
        background: "rgba(6,11,22,0.6)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 360, maxHeight: "86vh", overflowY: "auto",
          background: "linear-gradient(135deg,#0C1526,#13203A)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 22, padding: "28px 24px",
          boxShadow: "0 20px 60px rgba(5,10,22,0.6)",
        }}
      >
        <div style={{ fontSize: 38, textAlign: "center", marginBottom: 14 }}>🌱</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", textAlign: "center", marginBottom: 14 }}>
          성장은 경쟁이 아닙니다
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.9, color: "rgba(255,255,255,0.72)", textAlign: "center", marginBottom: 20 }}>
          공간사이는<br />성실과 정직을<br />데이터로 기록합니다.<br /><br />
          프로젝트를 성실하게 수행할수록<br />Space OS가<br />여러분의 노력을 XP로 인정합니다.<br /><br />
          XP는<br />업체의 꾸준한 성장 기록이며,<br />절대 감소하지 않습니다.
        </div>

        {/* 앱 전체 기준 문장 */}
        <div style={{
          background: "rgba(91,157,249,0.08)", border: "1px solid rgba(91,157,249,0.18)",
          borderRadius: 14, padding: "14px 16px", marginBottom: 24,
          fontSize: 13, lineHeight: 1.8, color: "rgba(255,255,255,0.82)", textAlign: "center",
        }}>
          기록은 사람을 감시하기 위해 존재하지 않습니다.<br />
          기록은 <span style={{ color: "#9FE3BE", fontWeight: 700 }}>성실한 사람을 보호</span>하기 위해 존재합니다.
        </div>

        {/* 왜 기록을 남기나요? */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 22, marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", textAlign: "center", marginBottom: 12 }}>
            왜 기록을 남기나요?
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.9, color: "rgba(255,255,255,0.72)", textAlign: "center" }}>
            공간사이는<br />업체를 감시하지 않습니다.<br /><br />
            성실하게 남긴 기록이<br />나중에 업체 스스로를<br />보호해주기 때문입니다.<br /><br />
            좋은 기록은<br />좋은 평판보다 오래갑니다.
          </div>
        </div>

        {/* 추천업체는 어떻게 정해지나요 */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 22, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", textAlign: "center", marginBottom: 12 }}>
            공간사이 추천업체는
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.9, color: "rgba(255,255,255,0.72)", textAlign: "center" }}>
            광고비가 아니라<br /><br />
            <span style={{ color: "#9FE3BE", fontWeight: 700 }}>성실한 기록</span><br />
            <span style={{ color: "#9FE3BE", fontWeight: 700 }}>정직한 수행</span><br />
            <span style={{ color: "#9FE3BE", fontWeight: 700 }}>책임 있는 마무리</span><br /><br />
            가 꾸준히 쌓인 업체입니다.
          </div>
        </div>

        {/* Space OS 흐름 */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 22, marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "1px", color: "#7FA8E0", textAlign: "center", marginBottom: 16 }}>
            Space OS
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            {["기록", "증명", "보호", "신뢰", "성장"].map((step, i, a) => (
              <div key={step} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: i === a.length - 1 ? "#7FD0A8" : "#fff" }}>{step}</span>
                {i < a.length - 1 && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>↓</span>}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.8, color: "rgba(255,255,255,0.7)", textAlign: "center", marginTop: 18 }}>
            공간사이는 사람을 통제하지 않습니다.<br />성실한 사람이 보호받는 구조를 만듭니다.
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "14px", border: "none", borderRadius: 14,
            background: "linear-gradient(135deg,#5B9DF9,#3D7FE0)", color: "#fff",
            fontSize: 15, fontWeight: 800, cursor: "pointer",
          }}
        >
          확인
        </button>
      </div>
    </div>
  );
}
