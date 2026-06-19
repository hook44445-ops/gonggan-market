// 업체 성장 — XP 진행도 바 (SVG 블록 10개 · 채움 애니메이션).
//   filled 가 늘어나면 각 블록이 약간의 stagger 와 함께 자연스럽게 채워진다(fill transition).
export default function XpProgressBar({
  filled = 0,
  blocks = 10,
  height = 16,
  gap = 5,
  color = "#5B9DF9",
  track = "rgba(255,255,255,0.10)",
}) {
  const n = Math.max(1, blocks);
  const f = Math.min(n, Math.max(0, filled));
  const W = 320;
  const H = height;
  const bw = (W - gap * (n - 1)) / n;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }}>
      {Array.from({ length: n }).map((_, i) => {
        const on = i < f;
        return (
          <rect
            key={i}
            x={i * (bw + gap)} y={0} width={bw} height={H} rx={4} ry={4}
            fill={on ? color : track}
            style={{
              transition: "fill 0.45s ease",
              transitionDelay: `${i * 45}ms`,
              filter: on ? `drop-shadow(0 0 4px ${color}88)` : "none",
            }}
          />
        );
      })}
    </svg>
  );
}
