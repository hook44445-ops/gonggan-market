import { useEffect, useState } from "react";
import { C, R, S } from "../constants";
import { qrMatrix, qrSvgPath } from "../lib/qr";
import { kstDay } from "../lib/pageViews";
import { bidShareRows, bidShareTitle, bidShareText } from "../lib/bidShare";
import { inviteUrl } from "../lib/referral";
import { myRefCode } from "../lib/myRefCode";

// 견적 비교표 한 장(가족과 같이 고르기) — 업체 이름·금액·기간·공간온도 + 내 초대 QR. 저장하지 않는다(공유·내려받기).
const W = 1080, PAD = 64;
const FONT = "'Pretendard','Apple SD Gothic Neo',sans-serif";

export function drawBidShare(canvas, { title, rows, qrUrl, day }) {
  const rowH = 96;
  const H = 300 + rows.length * rowH + 300;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const text = (s, x, y, size, weight = 700, color = "#1F2A24", align = "left") => {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y);
  };
  ctx.fillStyle = "#F6F3EE"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#1D3D2F"; ctx.fillRect(0, 0, W, 14);
  text(title, PAD, 118, 54, 900, "#1D3D2F");
  text(`${day} · 받은 견적 ${rows.length}곳`, PAD, 172, 30, 600, "#5C6B61");
  // 표 머리
  const cx = { name: PAD, price: 640, period: 820, temp: W - PAD };
  let y = 250;
  text("업체", cx.name, y, 26, 700, "#7A8A7E"); text("금액", cx.price, y, 26, 700, "#7A8A7E", "right");
  text("기간", cx.period, y, 26, 700, "#7A8A7E", "right"); text("공간온도", cx.temp, y, 26, 700, "#7A8A7E", "right");
  ctx.fillStyle = "#1F2A24"; ctx.fillRect(PAD, y + 18, W - PAD * 2, 3);
  y += 18;
  for (const r of rows) {
    if (r.cheapest) { ctx.fillStyle = "#E3EFE8"; ctx.fillRect(PAD - 12, y + 6, W - PAD * 2 + 24, rowH - 8); }
    const base = y + rowH / 2 + 16;
    text(r.name, cx.name, r.cheapest ? base - 12 : base, 36, 800);
    if (r.cheapest) text("가장 낮은 금액", cx.name, base + 22, 22, 700, "#2E5F4B");
    text(r.price, cx.price, base, 38, 900, "#2E5F4B", "right");
    text(r.period, cx.period, base, 32, 700, "#3D3A36", "right");
    text(r.temp, cx.temp, base, 32, 700, "#3D3A36", "right");
    y += rowH;
    ctx.fillStyle = "#E7E1D6"; ctx.fillRect(PAD, y, W - PAD * 2, 2);
  }
  text("금액만 말고 자재·범위·하자보수를 같이 봐 주세요", W / 2, y + 60, 26, 600, "#5C6B61", "center");
  // 아래 띠 — 초대 QR
  const top = H - 210;
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, top, W, 210);
  if (qrUrl) {
    const { d, size } = qrSvgPath(qrMatrix(qrUrl), 2);
    const box = 170, cell = box / size;
    ctx.fillStyle = "#111111"; ctx.save(); ctx.translate(PAD, top + 20); ctx.scale(cell, cell); ctx.fill(new Path2D(d)); ctx.restore();
  }
  const tx = qrUrl ? PAD + 210 : PAD;
  text("같이 골라 주세요", tx, top + 80, 36, 900);
  text("공간마켓 · QR로 가입하면 공간토큰 선물", tx, top + 130, 27, 600, "#5C6B61");
  return canvas;
}

export default function BidShareCard({ bids, space, userId }) {
  const rows = bidShareRows(bids);
  const [code, setCode] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  // 초대 코드를 미리 받아 둔다(버튼에서 기다리면 아이폰이 공유창을 막는다)
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    myRefCode(userId).then((c) => { if (alive) setCode(c); }).catch(() => {});
    return () => { alive = false; };
  }, [userId]);
  if (rows.length < 2) return null;

  const share = async () => {
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const url = code ? inviteUrl(code) : "https://gongganmarket.com";
      const canvas = drawBidShare(document.createElement("canvas"), { title: bidShareTitle(space), rows, qrUrl: url, day: kstDay() });
      const blob = await new Promise((ok) => canvas.toBlob(ok, "image/png"));
      if (!blob) throw new Error("NO_BLOB");
      const file = new File([blob], `견적비교_${kstDay().replace(/-/g, "")}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], text: bidShareText(code, url) }); setMsg("보냈어요 · 같이 골라 봐요"); } catch { /* 취소 */ }
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove();
        setMsg("이미지를 내려받았어요 · 카톡에 붙여 보내세요");
      }
    } catch { setMsg("이 기기에선 이미지를 만들 수 없어요"); }
    setBusy(false);
  };

  return (
    <div style={{ marginBottom: S.sm }}>
      <button onClick={share} disabled={busy}
        style={{ width: "100%", padding: "11px 12px", borderRadius: R.lg, border: `1px solid ${C.brandM}`, background: C.brandL,
          color: C.brand, fontSize: 13.5, fontWeight: 800, cursor: busy ? "wait" : "pointer", textAlign: "left" }}>
        👨‍👩‍👧 가족에게 비교표 보내기 — 같이 골라요
      </button>
      {msg && <div style={{ fontSize: 12, color: C.text2, marginTop: 6 }}>{msg}</div>}
    </div>
  );
}
