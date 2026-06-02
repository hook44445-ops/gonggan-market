import { useState } from "react";
import { C, R, S } from "../constants";

// ─────────────────────────────────────────────────────
// 분쟁 지원 범위 안내 — 공간마켓은 판사가 아니다. 기록 기반 합의 지원.
//   variant="short" : 간단 안내 박스
//   variant="full"  : 아코디언 ("분쟁 지원 범위 보기 ▼")
// 색상: 딥그린/아이보리/네이비만. 빨강·주황 금지(분쟁 화면이라도 경고색 X).
// ─────────────────────────────────────────────────────
export default function DisputeNotice({ variant = "short", defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  if (variant === "short") {
    return (
      <div style={{
        background: C.surface2, border: `1px solid ${C.bgWarm}`, borderRadius: 12,
        padding: "14px 16px", fontSize: 14, lineHeight: 1.8, color: C.text2,
        display: "flex", gap: 10, alignItems: "flex-start",
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>🤝</span>
        <div>
          분쟁이 생기면 공간마켓이 <b style={{ color: C.brand }}>기록을 토대로</b> 원만한 해결을
          도와드립니다.<br />
          단, 공간마켓은 법적 판단을 내리는 기관이 아닙니다.
        </div>
      </div>
    );
  }

  // variant === "full"
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: 12, overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 16px", background: "none", border: "none", cursor: "pointer",
          fontSize: 14, fontWeight: 700, color: C.text1, fontFamily: "inherit", textAlign: "left",
        }}>
        <span>🤝 분쟁 지원 범위 보기</span>
        <span style={{ fontSize: 13, color: C.text3, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: "0 16px 16px", fontSize: 14, lineHeight: 1.8, color: C.text2 }}>
          <div style={{ fontWeight: 700, color: C.brand, marginBottom: S.xs }}>공간마켓이 해드릴 수 있는 것</div>
          <div style={{ background: C.brandL, borderRadius: 10, padding: "12px 14px", marginBottom: S.md }}>
            {[
              "계약서·사진·채팅 기록 제공",
              "에스크로 정산 일시 보류",
              "고객·업체 간 소통 중재",
              "합의를 통한 환불 협의 지원",
            ].map(t => (
              <div key={t} style={{ display: "flex", gap: 8, padding: "3px 0", color: C.text2 }}>
                <span style={{ color: C.brand }}>✅</span><span>{t}</span>
              </div>
            ))}
          </div>
          <div style={{ fontWeight: 700, color: C.text2, marginBottom: S.xs }}>공간마켓이 할 수 없는 것</div>
          <div style={{ background: C.surface2, borderRadius: 10, padding: "12px 14px", marginBottom: S.md }}>
            {[
              "법적 판단 및 판결",
              "강제 환불 집행",
              "공사 품질 전문 감정",
              "형사 고발 대행",
            ].map(t => (
              <div key={t} style={{ display: "flex", gap: 8, padding: "3px 0", color: C.text3 }}>
                <span style={{ color: C.text4 }}>✕</span><span>{t}</span>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: S.sm }}>
            공간마켓은 판사가 아닙니다. 기록을 근거로 양측이 합의할 수 있도록 돕는 역할입니다.
          </div>
          <div style={{ color: C.text3 }}>
            법적 해결이 필요하시면 <b style={{ color: C.text2 }}>한국소비자원</b> 또는
            관할 법원을 이용해 주세요.
          </div>
        </div>
      )}
    </div>
  );
}
