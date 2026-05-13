import { C } from "../../constants";

export default function Stars({ rating, size = 14 }) {
  const r = Math.min(5, Math.max(0, Math.floor(rating ?? 0)));
  return (
    <span style={{ color:C.gold, fontSize:size, letterSpacing:-1 }}>
      {"★".repeat(r)}{"☆".repeat(5 - r)}
    </span>
  );
}
