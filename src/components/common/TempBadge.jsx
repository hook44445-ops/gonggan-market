import { GRADE, R } from "../../constants";

export default function TempBadge({ temp, lg }) {
  const g = GRADE(temp);
  return (
    <span style={{ background:g.bg, color:g.color, borderRadius:R.full,
      padding:lg?"5px 13px":"2px 10px", fontWeight:800, fontSize:lg?14:11,
      display:"inline-flex", alignItems:"center", gap:4 }}>
      {g.icon} {temp}° <span style={{ opacity:0.85, fontWeight:600 }}>{g.label}</span>
    </span>
  );
}
