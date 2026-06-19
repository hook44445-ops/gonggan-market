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
          width: "100%", maxWidth: 360,
          background: "linear-gradient(135deg,#0C1526,#13203A)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 22, padding: "28px 24px",
          boxShadow: "0 20px 60px rgba(5,10,22,0.6)",
        }}
      >
        <div style={{ fontSize: 38, textAlign: "center", marginBottom: 14 }}>🌱</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", textAlign: "center", marginBottom: 14 }}>
          성장은 경쟁이 아닙니다
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.9, color: "rgba(255,255,255,0.72)", textAlign: "center", marginBottom: 24 }}>
          공간사이는<br />성실과 정직을<br />데이터로 기록합니다.<br /><br />
          프로젝트를 성실하게 수행할수록<br />Space OS가<br />여러분의 노력을 XP로 인정합니다.<br /><br />
          XP는<br />업체의 꾸준한 성장 기록이며,<br />절대 감소하지 않습니다.
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
