// 베타 서비스 안내 UI — 배지 / 배너 / 진입 안내 모달 (Add Only · 표시 전용).
//   ⚠️ SHOW_BETA_UI=false 면 배지·배너는 자동으로 사라진다(렌더 null). 결제/계약/로직 무관.
//   토스페이먼츠 승인 전 '무료 베타 + 안전결제 미제공' 안내를 한 곳에서 관리.
import { C, R, S } from "../../constants";
import { SHOW_BETA_UI } from "../../constants/release";

// 🎉 베타 배지 — 랜딩 우상단 등.
export function BetaBadge({ label = "베타 서비스", style }) {
  if (!SHOW_BETA_UI) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: C.sun ?? "#F6DDAA", color: C.brandD ?? "#1D3D2F",
      border: `1px solid ${C.gold ?? "#C8A15A"}`, borderRadius: R.full,
      padding: "4px 11px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap", ...style,
    }}>🎉 {label}</span>
  );
}

// 베타 안내 배너 — 견적/입찰 작성 화면 상단 등.
export function BetaBanner({ text, style }) {
  if (!SHOW_BETA_UI) return null;
  return (
    <div style={{
      background: C.brandL, border: `1px solid ${C.brandM}`, borderRadius: R.lg,
      padding: `${S.sm}px ${S.md}px`, marginBottom: S.md,
      fontSize: 12.5, color: C.brand, fontWeight: 700, lineHeight: 1.6, ...style,
    }}>🎉 {text}</div>
  );
}

const GATE_CONTENT = {
  quote: {
    lines: [
      "현재 공간마켓은 베타 서비스입니다.",
      "견적요청과 상담은 무료입니다.",
      "토스페이먼츠 승인 전까지 앱 내 안전결제는 제공되지 않습니다.",
      "실제 계약 및 결제는 고객과 업체가 상호 협의하여 진행합니다.",
    ],
    confirm: "확인하고 견적요청하기",
  },
  bid: {
    lines: [
      "현재 공간마켓은 베타 서비스입니다.",
      "가입 · 견적 참여 · 상담 모두 무료입니다.",
      "토스페이먼츠 승인 전까지 앱 내 안전결제는 제공되지 않습니다.",
      "실제 계약 및 결제는 고객과 업체 간 상호 협의하여 진행합니다.",
    ],
    confirm: "확인하고 입찰하기",
  },
};

// 진입 안내 모달 — 견적요청/입찰 직전 1회 고지. open 일 때만 렌더.
//   onConfirm: 확인 → 기존 흐름 계속 / onClose: 취소.
export function BetaGateModal({ open, kind = "quote", onConfirm, onClose }) {
  if (!open || !SHOW_BETA_UI) return null;
  const c = GATE_CONTENT[kind] ?? GATE_CONTENT.quote;
  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.6)", zIndex: 700,
        display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 360, background: C.surface, borderRadius: R.xl, padding: "26px 22px",
          boxShadow: "0 20px 60px rgba(5,10,22,0.35)" }}>
        <div style={{ fontSize: 32, textAlign: "center", marginBottom: 10 }}>🎉</div>
        <div style={{ fontSize: 17, fontWeight: 900, color: C.text1, textAlign: "center", marginBottom: 14 }}>베타 서비스 안내</div>
        <div style={{ fontSize: 13.5, color: C.text2, lineHeight: 1.9, marginBottom: 20 }}>
          {c.lines.map((l, i) => (
            <div key={i} style={{ marginBottom: i === 1 ? 8 : 4, color: i >= 2 ? C.text3 : C.text2, fontWeight: i === 1 ? 800 : 600 }}>{l}</div>
          ))}
        </div>
        <button onClick={onConfirm} style={{ width: "100%", padding: "15px", background: C.brand, color: "#fff",
          border: "none", borderRadius: R.lg, fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
          {c.confirm}
        </button>
        <button onClick={onClose} style={{ width: "100%", padding: "11px", marginTop: 8, background: "none",
          color: C.text3, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          취소
        </button>
      </div>
    </div>
  );
}
