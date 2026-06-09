import { useState, useEffect } from "react";

// ════════════════════════════════════════════════════════════════════
// DebugOverlay — 모바일에서 [GONGGAN_DEBUG] 콘솔 로그를 화면에서 직접 보는 임시 오버레이.
// (production 에서도 보이도록 의도적으로 게이팅하지 않음 — 원인 확인 후 cleanup PR 에서 제거)
//   · 우하단 floating 버튼 → 로그 패널 토글
//   · [GONGGAN_DEBUG] 로 시작하는 console.log 만 캡처(최대 500줄)
//   · 전체 복사 / 지우기 지원 → 로그를 그대로 붙여넣어 공유 가능
// ════════════════════════════════════════════════════════════════════

const BUF = [];
const SUBS = new Set();

function pushLine(line) {
  BUF.push(line);
  if (BUF.length > 500) BUF.shift();
  SUBS.forEach((fn) => { try { fn(); } catch { /* noop */ } });
}

// 모듈 로드 시점(앱 첫 렌더 이전)에 console.log 패치 — 초기 로그부터 캡처.
if (typeof window !== "undefined" && !window.__GG_DEBUG_PATCHED__) {
  window.__GG_DEBUG_PATCHED__ = true;
  const orig = console.log.bind(console);
  console.log = (...args) => {
    orig(...args);
    try {
      const first = args[0];
      if (typeof first === "string" && (first.indexOf("[GONGGAN_DEBUG]") !== -1 || first.indexOf("[GONGGAN_DIAG]") !== -1)) {
        const body = args.slice(1).map((a) => {
          if (typeof a === "string") return a;
          try { return JSON.stringify(a); } catch { return String(a); }
        }).join(" ");
        const ts = new Date().toLocaleTimeString("ko-KR", { hour12: false });
        pushLine(`${ts} ${first.replace("[GONGGAN_DEBUG]", "").replace("[GONGGAN_DIAG]", "").trim()} ${body}`.trim());
      }
    } catch { /* noop */ }
  };
}

export default function DebugOverlay() {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fn = () => force((x) => x + 1);
    SUBS.add(fn);
    return () => { SUBS.delete(fn); };
  }, []);

  const copyAll = async () => {
    const text = BUF.join("\n");
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
      }
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  const clearAll = () => { BUF.length = 0; force((x) => x + 1); };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "fixed", right: 12, bottom: 96, zIndex: 2147483647,
          minWidth: 64, height: 64, padding: "0 10px", borderRadius: 16, border: "2px solid #fff",
          background: "#2563EB", color: "#fff", fontSize: 11, fontWeight: 900,
          boxShadow: "0 6px 18px rgba(0,0,0,0.5)", cursor: "pointer", lineHeight: 1.15,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}
        aria-label="debug logs"
      >
        <span style={{ fontSize: 18 }}>🐞</span>
        <span>DEBUG {BUF.length}</span>
      </button>

      {open && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2147483646, background: "rgba(0,0,0,0.55)",
          display: "flex", flexDirection: "column", justifyContent: "flex-end",
        }} onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0b0f0d", color: "#d6f5e2", maxHeight: "80vh",
              borderRadius: "16px 16px 0 0", display: "flex", flexDirection: "column",
              fontFamily: "monospace",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid #1f2a24" }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: "#7fe0a6" }}>GONGGAN_DEBUG · {BUF.length}줄</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button onClick={copyAll} style={btn}>{copied ? "복사됨 ✓" : "전체 복사"}</button>
                <button onClick={clearAll} style={btn}>지우기</button>
                <button onClick={() => setOpen(false)} style={btn}>닫기</button>
              </div>
            </div>
            <div style={{ overflowY: "auto", padding: "10px 14px", fontSize: 11, lineHeight: 1.6 }}>
              {BUF.length === 0 ? (
                <div style={{ color: "#5a7a66" }}>아직 로그가 없습니다. 화면을 조작하면 로그가 쌓입니다.</div>
              ) : (
                BUF.map((l, i) => (
                  <div key={i} style={{ borderBottom: "1px solid #131a16", padding: "3px 0", wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{l}</div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const btn = {
  background: "#1f2a24", color: "#d6f5e2", border: "1px solid #2e5f4b",
  borderRadius: 8, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
};
