import { useState } from "react";

// 이모지 자리에 힉스필드 그림(09-30) — 그림이 안 오면(오프라인·느린 망) 지금 이모지 그대로.
export default function ArtGlyph({ src, emoji, size = 28, style }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <span aria-hidden style={{ fontSize: Math.round(size * 0.72), lineHeight: 1, ...style }}>{emoji}</span>;
  return <img src={src} alt="" aria-hidden="true" width={size} height={size} onError={() => setBad(true)}
    style={{ width: size, height: size, objectFit: "contain", flexShrink: 0, display: "block", ...style }} />;
}
