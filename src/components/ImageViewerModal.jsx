import { useState, useEffect, useRef } from "react";

export default function ImageViewerModal({ images, startIndex = 0, onClose }) {
  const [idx, setIdx] = useState(startIndex);
  const touchStartX = useRef(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx(i => Math.min(i + 1, images.length - 1));
      if (e.key === "ArrowLeft")  setIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [images.length, onClose]);

  const prev = () => setIdx(i => Math.max(i - 1, 0));
  const next = () => setIdx(i => Math.min(i + 1, images.length - 1));

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd   = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx < -50) next();
    else if (dx > 50) prev();
    touchStartX.current = null;
  };

  if (!images?.length) return null;

  return (
    <div
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.93)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 16, right: 16,
          width: 36, height: 36, background: "rgba(255,255,255,0.13)",
          border: "none", borderRadius: "50%", color: "#fff",
          fontSize: 20, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1,
        }}
      >✕</button>

      {images.length > 1 && (
        <div style={{
          position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 13, fontWeight: 700,
          padding: "3px 12px", borderRadius: 20, pointerEvents: "none",
        }}>
          {idx + 1} / {images.length}
        </div>
      )}

      <img
        src={images[idx]}
        alt=""
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: "100vw", maxHeight: "100vh",
          objectFit: "contain", display: "block", userSelect: "none",
        }}
      />

      {idx > 0 && (
        <button
          onClick={e => { e.stopPropagation(); prev(); }}
          style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            width: 40, height: 40, background: "rgba(255,255,255,0.14)",
            border: "none", borderRadius: "50%", color: "#fff",
            fontSize: 24, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >‹</button>
      )}

      {idx < images.length - 1 && (
        <button
          onClick={e => { e.stopPropagation(); next(); }}
          style={{
            position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
            width: 40, height: 40, background: "rgba(255,255,255,0.14)",
            border: "none", borderRadius: "50%", color: "#fff",
            fontSize: 24, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >›</button>
      )}

      {images.length > 1 && (
        <div style={{
          position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
          display: "flex", gap: 6,
        }}>
          {images.map((_, i) => (
            <div
              key={i}
              onClick={e => { e.stopPropagation(); setIdx(i); }}
              style={{
                width: i === idx ? 16 : 6, height: 6, borderRadius: 3,
                background: i === idx ? "#fff" : "rgba(255,255,255,0.38)",
                cursor: "pointer", transition: "all 0.2s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
