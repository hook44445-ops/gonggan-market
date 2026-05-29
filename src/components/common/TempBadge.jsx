import { GRADE, R } from "../../constants";

export default function TempBadge({ temp, lg }) {
  const g     = GRADE(temp ?? 0);
  const pad   = lg ? "6px 14px" : "3px 10px";
  const fs    = lg ? 14 : 11;
  const dotSz = lg ? 8 : 6;
  return (
    <span style={{
      background: g.bg, color: g.color, borderRadius: R.full,
      padding: pad, fontWeight: 700, fontSize: fs,
      display: "inline-flex", alignItems: "center", gap: 5,
      border: `1px solid ${g.bar}28`,
    }}>
      <span style={{
        width: dotSz, height: dotSz, borderRadius: "50%",
        background: g.bar, flexShrink: 0, display: "inline-block",
      }} />
      {temp != null ? `${temp}°` : "—"}
      <span style={{ fontWeight: 500, opacity: 0.75 }}>{g.label}</span>
    </span>
  );
}
