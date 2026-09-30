import { useEffect, useState } from "react";
import { C, R, S } from "../constants";
import { qrMatrix, qrSvgPath } from "../lib/qr";
import { kstDay } from "../lib/pageViews";
import { CARD_W, CARD_H, coverCrop, cardTitle, cardFooter, cardFileName } from "../lib/beforeAfter";
import { inviteUrl, companyPageUrl, REFERRAL_REWARD } from "../lib/referral";
import { myRefCode } from "../lib/myRefCode";
import { loadImage, loadCardBg, paintCardBg, CARD_BG } from "../lib/canvasImage";

// 전·후 사진 카드 — 사진 두 장을 고르면 한 장짜리 이미지(1080×1350). 저장하지 않는다(기기 사진첩·공유로).
//   고객: 아래 QR = 내 초대 링크 · 업체: 아래 QR = 내 업체 페이지
const FONT = "'Pretendard','Apple SD Gothic Neo',sans-serif";

export async function drawBeforeAfter(canvas, { before, after, title, footer, qrUrl }) {
  canvas.width = CARD_W; canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#F6F3EE"; ctx.fillRect(0, 0, CARD_W, CARD_H);
  paintCardBg(ctx, await loadCardBg(CARD_BG.beforeAfter), CARD_W); // 리넨 종이(힉스필드) · 못 오면 단색
  const text = (s, x, y, size, weight = 700, color = "#1F2A24", align = "left") => {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y);
  };
  text(title, CARD_W / 2, 96, 50, 900, "#1D3D2F", "center");
  const [bImg, aImg] = await Promise.all([loadImage(before), loadImage(after)]);
  const PX = 40, PW = CARD_W - PX * 2, PH = 470;
  const panel = (img, y, label, tag) => {
    const c = coverCrop(img.naturalWidth || img.width, img.naturalHeight || img.height, PW, PH);
    ctx.save();
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(PX, y, PW, PH, 28) : ctx.rect(PX, y, PW, PH); ctx.clip();
    ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, PX, y, PW, PH);
    ctx.restore();
    ctx.fillStyle = tag; ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(PX + 22, y + 22, 150, 58, 29) : ctx.rect(PX + 22, y + 22, 150, 58); ctx.fill();
    text(label, PX + 97, y + 62, 30, 900, "#FFFFFF", "center");
  };
  panel(bImg, 140, "공사 전", "rgba(31,42,36,0.78)");
  panel(aImg, 630, "공사 후", "#2E5F4B");
  // 아래 띠 — QR + 문구
  const top = 1120;
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, top, CARD_W, CARD_H - top);
  if (qrUrl) {
    const { d, size } = qrSvgPath(qrMatrix(qrUrl), 2);
    const box = 190, cell = box / size;
    ctx.fillStyle = "#111111"; ctx.save(); ctx.translate(PX + 10, top + 20); ctx.scale(cell, cell); ctx.fill(new Path2D(d)); ctx.restore();
  }
  const tx = qrUrl ? PX + 240 : PX + 10;
  text(footer.head, tx, top + 88, 36, 900);
  text(footer.sub, tx, top + 140, 28, 600, "#5C6B61");
  text("공간마켓", tx, top + 192, 30, 900, "#2E5F4B");
  return canvas;
}

function Slot({ label, src, onPick }) {
  return (
    <label style={{ flex: 1, position: "relative", aspectRatio: "1 / 1", borderRadius: R.lg, overflow: "hidden", cursor: "pointer",
      border: `2px dashed ${src ? "transparent" : C.bgWarm}`, background: C.bg, display: "grid", placeItems: "center" }}>
      {src ? <img src={src} alt={label} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ fontSize: 13, fontWeight: 800, color: C.text3, textAlign: "center" }}>📷<br />{label} 사진</span>}
      {src && <span style={{ position: "absolute", left: 8, top: 8, background: "rgba(31,42,36,0.75)", color: "#fff", borderRadius: R.full,
        padding: "3px 10px", fontSize: 12, fontWeight: 800 }}>{label}</span>}
      <input type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(URL.createObjectURL(f)); e.target.value = ""; }} />
    </label>
  );
}

export default function BeforeAfterCard({ userId, isCompany = false, companyName = "", companyKey = null, refCode = null,
  initialBefore = null, initialAfter = null, space = "", onClose }) {
  const [before, setBefore] = useState(initialBefore);
  const [after, setAfter] = useState(initialAfter);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState(refCode);
  const [img, setImg] = useState(null);   // { url, blob, name }
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  // 초대 코드를 미리 받아 둔다(버튼에서 기다리면 아이폰이 공유창을 막는다)
  useEffect(() => {
    if (code || !userId) return;
    let alive = true;
    myRefCode(userId).then((c) => { if (alive) setCode(c); }).catch(() => {});
    return () => { alive = false; };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const qrUrl = isCompany && companyKey ? companyPageUrl(companyKey, code) : (code ? inviteUrl(code) : "https://gongganmarket.com");

  const make = async () => {
    if (!before || !after) { setErr("공사 전·후 사진을 한 장씩 골라 주세요"); return; }
    setErr(null); setBusy(true);
    try {
      const canvas = await drawBeforeAfter(document.createElement("canvas"), {
        before, after, title: cardTitle(title, space),
        footer: cardFooter({ isCompany, companyName, reward: REFERRAL_REWARD.invitee }), qrUrl,
      });
      const blob = await new Promise((ok) => canvas.toBlob(ok, "image/png"));
      if (!blob) throw new Error("NO_BLOB");
      if (img?.url) URL.revokeObjectURL(img.url);
      setImg({ url: URL.createObjectURL(blob), blob, name: cardFileName(kstDay()) });
      setMsg(null);
    } catch {
      setErr("이 사진으로는 카드를 만들 수 없어요 · 휴대폰에서 사진을 다시 골라 주세요");
    } finally { setBusy(false); }
  };

  const send = async () => {
    if (!img) return;
    const file = new File([img.blob], img.name, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "공사 전·후" }); setMsg("보냈어요"); } catch { /* 취소 */ }
      return;
    }
    const a = document.createElement("a");
    a.href = img.url; a.download = img.name;
    document.body.appendChild(a); a.click(); a.remove();
    setMsg("이미지를 내려받았어요 · 카톡·인스타에 올려 보세요");
  };

  return (
    <div role="dialog" aria-label="전·후 사진 카드 만들기" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.55)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", background: C.surface, borderRadius: "22px 22px 0 0", padding: "22px 20px 30px" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>📸 전·후 사진 카드 만들기</div>
        <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.6, marginTop: 4 }}>
          {isCompany
            ? "시공 전·후를 한 장으로 — 아래에 내 업체 페이지 QR이 들어가요. 사진은 저장되지 않아요."
            : `바뀐 우리 집을 자랑해 보세요 — 아래 QR로 친구가 가입하면 공간토큰 ${REFERRAL_REWARD.invitee}개를 받아요. 사진은 저장되지 않아요.`}
        </div>
        {img ? (
          <>
            <img src={img.url} alt="만든 전·후 카드" style={{ width: "100%", marginTop: S.lg, borderRadius: R.md, border: `1px solid ${C.bgWarm}` }} />
            <button onClick={send} style={{ marginTop: S.lg, width: "100%", padding: 14, borderRadius: R.lg, border: "none", background: C.brand, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
              카카오톡·인스타로 보내기
            </button>
            {msg && <div style={{ fontSize: 12.5, color: C.text2, marginTop: 8, textAlign: "center" }}>{msg}</div>}
            <button onClick={() => setImg(null)} style={{ marginTop: 8, width: "100%", padding: 12, background: "none", border: "none", color: C.text2, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
              고치기
            </button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: S.sm, marginTop: S.lg }}>
              <Slot label="공사 전" src={before} onPick={setBefore} />
              <Slot label="공사 후" src={after} onPick={setAfter} />
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text2, margin: "14px 0 6px" }}>제목(선택)</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={24} placeholder={cardTitle("", space)}
              style={{ width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: R.md, border: `1px solid ${C.bgWarm}`, fontSize: 14.5, fontFamily: "inherit", color: C.text1, background: C.surface }} />
            {err && <div style={{ fontSize: 13, color: "#B4432F", fontWeight: 700, marginTop: 10 }}>{err}</div>}
            <button onClick={make} disabled={busy}
              style={{ marginTop: S.lg, width: "100%", padding: 14, borderRadius: R.lg, border: "none", background: C.brand, color: "#fff", fontSize: 15, fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>
              {busy ? "만드는 중…" : "카드 만들기"}
            </button>
          </>
        )}
        <button onClick={onClose} style={{ marginTop: 6, width: "100%", padding: 12, background: "none", border: "none", color: C.text3, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>닫기</button>
      </div>
    </div>
  );
}
