import { useState } from "react";
import { GRADE, R, C } from "../../constants";

const TEMP_INFO = "공간온도는 거래, 후기, 응답 등을 기반으로 형성되는 신뢰 지수입니다.";

export default function TempBadge({ temp, lg, info }) {
  const g     = GRADE(temp ?? 0);
  const pad   = lg ? "6px 14px" : "3px 10px";
  const fs    = lg ? 14 : 11;
  const dotSz = lg ? 8 : 6;
  const [open, setOpen] = useState(false);
  return (
    <span style={{
      background: g.bg, color: g.color, borderRadius: R.full,
      padding: pad, fontWeight: 700, fontSize: fs,
      display: "inline-flex", alignItems: "center", gap: 5, position: "relative",
      border: `1px solid ${g.bar}28`,
    }}>
      <span style={{
        width: dotSz, height: dotSz, borderRadius: "50%",
        background: g.bar, flexShrink: 0, display: "inline-block",
      }} />
      {temp != null ? `${temp}°` : "—"}
      <span style={{ fontWeight: 500, opacity: 0.75 }}>{g.label}</span>
      {info && (
        <span
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
          style={{ marginLeft: 2, cursor: "pointer", opacity: 0.6, fontSize: fs - 1 }}
          aria-label="공간온도 설명"
          role="button"
        >
          ⓘ
          {open && (
            <span
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50,
                width: 220, background: "rgba(31,42,36,0.96)", color: "#fff",
                borderRadius: R.md, padding: "8px 10px", fontSize: 11, fontWeight: 500,
                lineHeight: 1.6, boxShadow: "0 6px 20px rgba(0,0,0,0.22)", whiteSpace: "normal",
              }}
            >
              {TEMP_INFO}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
