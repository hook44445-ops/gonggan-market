// Phase 11 — 레벨업 축하 연출. 카드 확대 + 가벼운 Confetti + 진동.
//   과도한 게임 효과는 지양. 4초 후 자동 닫힘 · 탭하면 즉시 닫힘.
import { useEffect, useRef } from "react";

const CONFETTI = ["#5B9DF9", "#7FD8A6", "#FFC85C", "#F08FB0", "#B79BFF"];

export default function LevelUpOverlay({ open, from = 1, to = 2, onClose }) {
  const fired = useRef(false);

  useEffect(() => {
    if (!open) { fired.current = false; return; }
    if (!fired.current) {
      fired.current = true;
      try { navigator.vibrate?.([0, 40, 60, 40]); } catch { /* 미지원 무시 */ }
    }
    const t = setTimeout(() => onClose?.(), 4000);
    return () => clearTimeout(t);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 700,
        background: "rgba(6,11,22,0.66)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes lvup-pop { 0%{transform:scale(0.7);opacity:0} 55%{transform:scale(1.06);opacity:1} 100%{transform:scale(1)} }
        @keyframes lvup-fall { 0%{transform:translateY(-12vh) rotate(0);opacity:1} 100%{transform:translateY(108vh) rotate(540deg);opacity:0.9} }
      `}</style>

      {/* 가벼운 Confetti — 14조각 */}
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} style={{
          position: "absolute", top: 0, left: `${(i * 7 + 4) % 100}%`,
          width: 8, height: 12, borderRadius: 2,
          background: CONFETTI[i % CONFETTI.length],
          animation: `lvup-fall ${1.8 + (i % 5) * 0.3}s ${(i % 7) * 0.12}s ease-in forwards`,
        }} />
      ))}

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 320, textAlign: "center",
          background: "linear-gradient(135deg,#0C1526,#13203A)",
          border: "1px solid rgba(255,255,255,0.12)", borderRadius: 24, padding: "34px 26px",
          boxShadow: "0 24px 70px rgba(5,10,22,0.6)",
          animation: "lvup-pop 0.5s cubic-bezier(.2,.9,.3,1.2) both",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 6 }}>🎉</div>
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "3px", color: "#7FA8E0", marginBottom: 14 }}>LEVEL UP</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 18 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: "rgba(255,255,255,0.45)" }}>LV.{from}</span>
          <span style={{ fontSize: 18, color: "rgba(255,255,255,0.4)" }}>→</span>
          <span style={{ fontSize: 34, fontWeight: 900, color: "#fff" }}>LV.{to}</span>
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.8, color: "rgba(255,255,255,0.72)" }}>
          Space OS가<br />당신의 성장을 기록했습니다.
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: 22, width: "100%", padding: "12px", border: "none", borderRadius: 14,
            background: "linear-gradient(135deg,#5B9DF9,#3D7FE0)", color: "#fff",
            fontSize: 14, fontWeight: 800, cursor: "pointer",
          }}
        >
          확인
        </button>
      </div>
    </div>
  );
}
