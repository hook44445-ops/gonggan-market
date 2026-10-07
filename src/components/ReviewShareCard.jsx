import { useEffect, useState } from "react";
import { trackUsp } from "../lib/uspTrack"; // USP 12 «공유» 사용 기록(187)
import { C, R, S } from "../constants";
import { qrMatrix, qrSvgPath } from "../lib/qr";
import { kstDay } from "../lib/pageViews";
import { shareableReviews, clampReview, stars } from "../lib/reviewShare";
import { getReviews } from "../lib/supabase";
import { loadCardBg, paintCardBg, CARD_BG } from "../lib/canvasImage";

// 후기 카드(업체) — 받은 좋은 후기 하나를 골라 이미지 한 장으로(1080×1350) · 아래 내 업체 페이지 QR.
//   공간랜드 안 후기만(밖 공사 후기는 넣지 않는다) · 고객 이름은 첫 글자만. 저장하지 않는다(공유·내려받기).
const W = 1080, H = 1350, PAD = 80;
const FONT = "'Pretendard','Apple SD Gothic Neo',sans-serif";

function wrap(ctx, text, maxW) {
  const lines = []; let line = "";
  for (const ch of [...text]) {
    const next = line + ch;
    if (ctx.measureText(next).width > maxW && line) { lines.push(line); line = ch.trimStart(); }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function drawReviewCard(canvas, { review, companyName, qrUrl, bg = null }) {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const text = (s, x, y, size, weight = 700, color = "#1F2A24", align = "left") => {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y);
  };
  ctx.fillStyle = "#1D3D2F"; ctx.fillRect(0, 0, W, H);
  paintCardBg(ctx, bg, W); // 깊은 초록 종이 · 금 테 · 창가 빛(힉스필드) · 없으면 단색
  text("공간랜드 고객 후기", PAD, 140, 34, 800, "#D6A756");
  text(stars(review.rating), PAD, 230, 64, 900, "#D6A756");
  text("“", PAD - 10, 380, 160, 900, "rgba(244,239,228,0.25)");
  ctx.font = `800 52px ${FONT}`;
  const lines = wrap(ctx, clampReview(review.text), W - PAD * 2).slice(0, 7);
  let y = 400;
  for (const l of lines) { text(l, PAD, y, 52, 800, "#F4EFE4"); y += 76; }
  const meta = [review.who, review.region, review.space].filter(Boolean).join(" · ");
  text(meta, PAD, y + 30, 32, 600, "rgba(244,239,228,0.75)");
  // 아래 띠
  const top = H - 260;
  ctx.fillStyle = "#F4EFE4"; ctx.fillRect(0, top, W, 260);
  if (qrUrl) {
    const { d, size } = qrSvgPath(qrMatrix(qrUrl), 2);
    const box = 200, cell = box / size;
    ctx.fillStyle = "#111111"; ctx.save(); ctx.translate(PAD - 10, top + 30); ctx.scale(cell, cell); ctx.fill(new Path2D(d)); ctx.restore();
  }
  const tx = qrUrl ? PAD + 240 : PAD;
  text(String(companyName || "우리 업체").slice(0, 14), tx, top + 100, 44, 900, "#1D3D2F");
  text("QR을 찍으면 시공 사례·후기를 볼 수 있어요", tx, top + 155, 28, 600, "#5C6B61");
  text("공간랜드에서 견적 받기", tx, top + 205, 28, 800, "#2E5F4B");
  return canvas;
}

export default function ReviewShareCard({ companyId, companyName, pageUrl, onClose }) {
  const [list, setList] = useState(null);   // null=불러오는 중 · []=없음
  const [pick, setPick] = useState(null);
  const [img, setImg] = useState(null);
  const [msg, setMsg] = useState(null);
  const [bg, setBg] = useState(null);
  useEffect(() => { let alive = true; loadCardBg(CARD_BG.review).then((img) => { if (alive) setBg(img); }); return () => { alive = false; }; }, []);

  useEffect(() => {
    let alive = true;
    getReviews(companyId).then(({ data }) => {
      if (!alive) return;
      const l = shareableReviews(data ?? []);
      setList(l); setPick(l[0]?.id ?? null);
    }).catch(() => alive && setList([]));
    return () => { alive = false; };
  }, [companyId]);

  const make = async () => {
    const review = list?.find((r) => r.id === pick);
    if (!review) return;
    try {
      const canvas = drawReviewCard(document.createElement("canvas"), { review, companyName, qrUrl: pageUrl, bg });
      const blob = await new Promise((ok) => canvas.toBlob(ok, "image/png"));
      if (!blob) throw new Error("NO_BLOB");
      if (img?.url) URL.revokeObjectURL(img.url);
      setImg({ url: URL.createObjectURL(blob), blob, name: `공간랜드_후기_${kstDay().replace(/-/g, "")}.png` });
      setMsg(null);
    } catch { setMsg("이 기기에선 이미지를 만들 수 없어요"); }
  };

  const send = async () => {
    if (!img) return;
    const file = new File([img.blob], img.name, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      trackUsp(12, { meta: { kind: "review_card" } }); try { await navigator.share({ files: [file], title: "고객 후기" }); setMsg("보냈어요"); } catch { /* 취소 */ }
      return;
    }
    const a = document.createElement("a");
    a.href = img.url; a.download = img.name;
    document.body.appendChild(a); a.click(); a.remove();
    setMsg("이미지를 내려받았어요 · 인스타·블로그·카톡에 올려 보세요");
  };

  return (
    <div role="dialog" aria-label="후기 카드 만들기" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.55)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", background: C.surface, borderRadius: "22px 22px 0 0", padding: "22px 20px 30px" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>⭐ 후기 카드 만들기</div>
        <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.6, marginTop: 4 }}>
          받은 좋은 후기 하나를 이미지로 — 아래에 내 업체 페이지 QR이 들어가요. 고객 이름은 첫 글자만 보여요.
        </div>
        {img ? (
          <>
            <img src={img.url} alt="만든 후기 카드" style={{ width: "100%", marginTop: S.lg, borderRadius: R.md }} />
            <button onClick={send} style={{ marginTop: S.lg, width: "100%", padding: 14, borderRadius: R.lg, border: "none", background: C.brand, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
              인스타·카톡으로 보내기
            </button>
            {msg && <div style={{ fontSize: 12.5, color: C.text2, marginTop: 8, textAlign: "center" }}>{msg}</div>}
            <button onClick={() => setImg(null)} style={{ marginTop: 8, width: "100%", padding: 12, background: "none", border: "none", color: C.text2, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>다른 후기 고르기</button>
          </>
        ) : list === null ? (
          <div style={{ fontSize: 13, color: C.text3, padding: S.lg, textAlign: "center" }}>후기를 불러오는 중…</div>
        ) : list.length === 0 ? (
          <div style={{ background: C.bg, borderRadius: R.lg, padding: S.lg, marginTop: S.lg, fontSize: 13, color: C.text2, lineHeight: 1.7 }}>
            아직 카드로 만들 후기가 없어요(별 4개 이상 · 공간랜드 안 후기). 공사를 마친 고객에게 후기를 부탁해 보세요.
          </div>
        ) : (
          <>
            {list.map((r) => (
              <button key={r.id} onClick={() => setPick(r.id)} aria-pressed={pick === r.id}
                style={{ display: "block", width: "100%", textAlign: "left", marginTop: S.sm, padding: "11px 12px", borderRadius: R.md, cursor: "pointer",
                  border: `1.5px solid ${pick === r.id ? C.brand : C.bgWarm}`, background: pick === r.id ? C.brandL : C.surface }}>
                <div style={{ fontSize: 12, color: "#B8892E", fontWeight: 800 }}>{stars(r.rating)} <span style={{ color: C.text3, fontWeight: 600 }}>{r.who}</span></div>
                <div style={{ fontSize: 13.5, color: C.text1, marginTop: 3, lineHeight: 1.5 }}>{clampReview(r.text, 60)}</div>
              </button>
            ))}
            {msg && <div style={{ fontSize: 13, color: "#B4432F", marginTop: 8 }}>{msg}</div>}
            <button onClick={make} disabled={!pick}
              style={{ marginTop: S.lg, width: "100%", padding: 14, borderRadius: R.lg, border: "none", background: C.brand, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
              카드 만들기
            </button>
          </>
        )}
        <button onClick={onClose} style={{ marginTop: 6, width: "100%", padding: 12, background: "none", border: "none", color: C.text3, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>닫기</button>
      </div>
    </div>
  );
}
