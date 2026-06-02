import { useState } from "react";
import { C, R, S } from "../constants";

// ─────────────────────────────────────────────────────
// 공간마켓 보호 범위 안내 — 경고 톤 금지, 보호/안내/따뜻함.
//   variant="short" : 간단 안내 박스 (항상 펼침)
//   variant="full"  : 아코디언 ("공간마켓 보호 범위 보기 ▼")
// 색상: 딥그린/아이보리만. 빨강·주황 금지.
// ─────────────────────────────────────────────────────
export default function ProtectionNotice({ variant = "short", defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  if (variant === "short") {
    return (
      <div style={{
        background: C.brandL, border: `1px solid ${C.brandM}`, borderRadius: 12,
        padding: "14px 16px", fontSize: 14, lineHeight: 1.8, color: C.text2,
        display: "flex", gap: 10, alignItems: "flex-start",
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>🛡️</span>
        <div>
          <b style={{ color: C.brand }}>공간안전결제</b>로 진행하시면 에스크로 보호, 거래 기록,
          분쟁 지원이 적용됩니다.<br />
          플랫폼 밖 거래는 공간마켓 보호 범위에 포함되지 않습니다.
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
        <span>🛡️ 공간마켓 보호 범위 보기</span>
        <span style={{ fontSize: 13, color: C.text3, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
      </button>
      {open && (
        <div style={{ padding: "0 16px 16px", fontSize: 14, lineHeight: 1.8, color: C.text2 }}>
          <div style={{ marginBottom: S.md }}>
            공간안전결제를 선택하시면<br /><br />
            공사가 끝날 때까지 여러분의 돈은 <b style={{ color: C.brand }}>토스페이먼츠</b>가
            안전하게 보관합니다. 문제가 생기면 공간마켓이 원만한 해결을 도와드립니다.
          </div>
          <div style={{ background: C.brandL, borderRadius: 10, padding: "12px 14px", marginBottom: S.md }}>
            {[
              "토스페이먼츠 에스크로 보호",
              "착공·중간·완료 단계별 정산",
              "계약서 자동 보관",
              "분쟁 발생 시 중재 지원",
              "후기 및 신뢰 기록 축적",
            ].map(t => (
              <div key={t} style={{ display: "flex", gap: 8, padding: "3px 0", color: C.text2 }}>
                <span style={{ color: C.brand }}>✅</span><span>{t}</span>
              </div>
            ))}
          </div>
          <div style={{ color: C.text3, marginBottom: S.sm }}>
            플랫폼 밖 거래는 공간마켓이 도와드리기 어렵습니다.
          </div>
          <div style={{ background: C.surface2, borderRadius: 10, padding: "12px 14px", marginBottom: S.md }}>
            {[
              "에스크로 보호 없음",
              "분쟁 중재 없음",
              "거래 기록 없음",
            ].map(t => (
              <div key={t} style={{ display: "flex", gap: 8, padding: "3px 0", color: C.text3 }}>
                <span style={{ color: C.text4 }}>✕</span><span>{t}</span>
              </div>
            ))}
          </div>
          <div style={{ fontWeight: 700, color: C.text1 }}>
            이것은 제한이 아닙니다. 선택의 차이입니다.
          </div>
        </div>
      )}
    </div>
  );
}
