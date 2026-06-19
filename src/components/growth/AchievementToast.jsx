// Phase 12 — 업적 획득 토스트. 🏅 새로운 업적 + 라벨 + 보상 XP(표시 전용).
//   큐의 첫 항목을 보여주고 일정 시간 뒤 onDone 으로 다음 항목 진행.
import { useEffect } from "react";

export default function AchievementToast({ item, onDone }) {
  useEffect(() => {
    if (!item) return;
    try { navigator.vibrate?.(30); } catch { /* 무시 */ }
    const t = setTimeout(() => onDone?.(), 3200);
    return () => clearTimeout(t);
  }, [item, onDone]);

  if (!item) return null;

  return (
    <div style={{
      position: "fixed", left: "50%", bottom: 28, transform: "translateX(-50%)", zIndex: 720,
      width: "calc(100% - 40px)", maxWidth: 360,
    }}>
      <style>{`@keyframes ach-in{0%{transform:translateY(24px);opacity:0}100%{transform:translateY(0);opacity:1}}`}</style>
      <div
        onClick={onDone}
        style={{
          display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
          background: "linear-gradient(135deg,#13203A,#0C1526)",
          border: "1px solid rgba(255,200,92,0.4)", borderRadius: 16, padding: "14px 18px",
          boxShadow: "0 12px 36px rgba(5,10,22,0.5)", animation: "ach-in 0.35s ease both",
        }}
      >
        <div style={{ fontSize: 28, lineHeight: 1 }}>{item.icon || "🏅"}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1px", color: "#FFC85C", marginBottom: 2 }}>새로운 업적</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#7FD8A6", flexShrink: 0 }}>+{item.xp} XP</div>
      </div>
    </div>
  );
}
