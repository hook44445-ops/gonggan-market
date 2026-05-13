import { C } from "../../constants";

export default function Stars({ rating, size = 14 }) {
  return (
    <span style={{ color:C.gold, fontSize:size, letterSpacing:-1 }}>
      {"★".repeat(Math.floor(rating))}{"☆".repeat(5-Math.floor(rating))}
    </span>
  );
}
