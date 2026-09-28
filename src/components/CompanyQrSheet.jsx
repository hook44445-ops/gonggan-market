import { useMemo, useState } from "react";
import { C, R, S } from "../constants";
import { qrMatrix, qrSvgPath } from "../lib/qr";

// 내 업체 페이지 QR — 명함·현장 전단·차량 스티커용(대표 09-28 · 1인 사업자).
//   폰 카메라로 찍으면 /p/내주소?ref=내코드 로 들어온다(가입하면 초대로 잡힌다).
//   «이미지 저장»은 인쇄용 카드(1080×1350 PNG) — 공유창에 파일을 넘기고, 못 하면 내려받기.
const CARD_W = 1080, CARD_H = 1350;

function drawCard(canvas, { matrix, name, url }) {
  const ctx = canvas.getContext("2d");
  canvas.width = CARD_W; canvas.height = CARD_H;
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = "#1F2A24"; ctx.textAlign = "center";
  ctx.font = "800 64px 'Pretendard','Apple SD Gothic Neo',sans-serif";
  ctx.fillText(String(name || "우리 업체").slice(0, 16), CARD_W / 2, 150);
  ctx.fillStyle = "#5C6B61"; ctx.font = "600 38px 'Pretendard','Apple SD Gothic Neo',sans-serif";
  ctx.fillText("시공 사례·후기 보기", CARD_W / 2, 215);
  const { d, size } = qrSvgPath(matrix, 2);
  const box = 760, x0 = (CARD_W - box) / 2, y0 = 280, cell = box / size;
  ctx.fillStyle = "#111111";
  ctx.save(); ctx.translate(x0, y0); ctx.scale(cell, cell); ctx.fill(new Path2D(d)); ctx.restore();
  ctx.fillStyle = "#1F2A24"; ctx.font = "700 40px 'Pretendard','Apple SD Gothic Neo',sans-serif";
  ctx.fillText("휴대폰 카메라로 찍어 보세요", CARD_W / 2, 1120);
  ctx.fillStyle = "#7A8A7E"; ctx.font = "500 30px 'Pretendard','Apple SD Gothic Neo',sans-serif";
  ctx.fillText(url.replace(/^https?:\/\//, "").replace(/\?ref=.*$/, ""), CARD_W / 2, 1175);
  ctx.fillStyle = "#2E5F4B"; ctx.font = "800 36px 'Pretendard','Apple SD Gothic Neo',sans-serif";
  ctx.fillText("공간마켓", CARD_W / 2, 1270);
}

export default function CompanyQrSheet({ url, name, onClose }) {
  const matrix = useMemo(() => qrMatrix(url), [url]);
  const { d, size } = useMemo(() => qrSvgPath(matrix, 2), [matrix]);
  const [msg, setMsg] = useState(null);

  const save = async () => {
    try {
      const canvas = document.createElement("canvas");
      drawCard(canvas, { matrix, name, url });
      const blob = await new Promise((ok) => canvas.toBlob(ok, "image/png"));
      if (!blob) throw new Error("NO_BLOB");
      const file = new File([blob], "공간마켓-업체QR.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: `${name || "업체"} QR` }); setMsg("사진으로 저장하거나 인쇄소에 보내세요"); } catch { /* 취소 */ }
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setMsg("이미지를 내려받았어요");
    } catch {
      setMsg("이 기기에선 저장이 안 돼요 — 화면을 캡처해 주세요");
    }
  };

  return (
    <div role="dialog" aria-label="내 업체 QR코드" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.55)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, background: C.surface, borderRadius: "22px 22px 0 0", padding: "22px 22px 30px", textAlign: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>명함·전단용 QR코드</div>
        <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.6, marginTop: 6 }}>
          폰 카메라로 찍으면 내 업체 페이지가 열려요. 명함·현장 안내문·차량에 붙여 두세요.
        </div>
        <svg viewBox={`0 0 ${size} ${size}`} width="220" height="220" role="img" aria-label="업체 페이지 QR코드"
          shapeRendering="crispEdges" style={{ display: "block", margin: `${S.lg}px auto 0`, background: "#fff", borderRadius: R.md, border: `1px solid ${C.bgWarm}` }}>
          <path d={d} fill="#111" />
        </svg>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginTop: S.sm }}>{name || "우리 업체"}</div>
        <button onClick={save}
          style={{ marginTop: S.lg, width: "100%", padding: "14px", borderRadius: R.lg, border: "none", background: C.brand, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
          인쇄용 이미지 저장
        </button>
        {msg && <div style={{ fontSize: 12.5, color: C.text2, marginTop: 8 }}>{msg}</div>}
        <button onClick={onClose}
          style={{ marginTop: 8, width: "100%", padding: "12px", background: "none", border: "none", color: C.text3, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
          닫기
        </button>
      </div>
    </div>
  );
}
