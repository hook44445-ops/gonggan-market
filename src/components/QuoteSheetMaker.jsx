import { useState } from "react";
import { C, R, S } from "../constants";
import { qrMatrix, qrSvgPath } from "../lib/qr";
import { kstDay } from "../lib/pageViews";
import { buildQuote, formatWon, quoteFileName, QUOTE_MAX_ITEMS, QUOTE_NOTICE } from "../lib/quoteSheet";

// 간단 견적서 만들기(대표 09-29) — 적으면 이미지 한 장(1080 폭 PNG)으로. 저장은 하지 않는다(기기 사진첩·공유로).
//   맨 아래 공간마켓 업체 페이지 QR — 받은 사람이 사례·후기를 보고 들어온다(가입하면 초대로 잡힌다).
const W = 1080, PAD = 72;
const FONT = "'Pretendard','Apple SD Gothic Neo',sans-serif";

export function drawQuote(canvas, q, { companyName, phone, pageUrl }) {
  const rowH = 78;
  const H = 520 + q.items.length * rowH + (q.memo ? 90 : 0) + 330;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#1D3D2F"; ctx.fillRect(0, 0, W, 16);
  ctx.textBaseline = "alphabetic";
  const text = (s, x, y, size, weight = 600, color = "#1F2A24", align = "left") => {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(s, x, y);
  };
  text("견적서", PAD, 120, 58, 900);
  text(kstDay(), W - PAD, 120, 30, 600, "#7A8A7E", "right");
  text(String(companyName || "").slice(0, 20), PAD, 178, 34, 800, "#2E5F4B");
  if (phone) text(phone, W - PAD, 178, 30, 600, "#5C6B61", "right");
  let y = 262;
  text(`${q.customer ? `${q.customer} 님 · ` : ""}${q.title}`.slice(0, 34), PAD, y, 36, 800);
  if (q.period) { y += 50; text(`기간 ${q.period}`, PAD, y, 28, 600, "#5C6B61"); }
  y += 44;
  ctx.fillStyle = "#1F2A24"; ctx.fillRect(PAD, y, W - PAD * 2, 3);
  y += 16;
  for (const it of q.items) {
    y += rowH;
    text(it.name, PAD, y - 26, 32, 600);
    text(formatWon(it.amount), W - PAD, y - 26, 32, 700, "#1F2A24", "right");
    ctx.fillStyle = "#E7E1D6"; ctx.fillRect(PAD, y, W - PAD * 2, 2);
  }
  y += 78;
  text(`합계 (${q.vatLine})`, PAD, y, 34, 800);
  text(formatWon(q.total), W - PAD, y, 46, 900, "#2E5F4B", "right");
  if (q.memo) { y += 80; text(q.memo.slice(0, 44), PAD, y, 28, 600, "#3D3A36"); }
  y += 60;
  text(QUOTE_NOTICE, W / 2, y, 22, 500, "#8A958D", "center");
  // 아래 띠 — QR + 안내
  const top = H - 250;
  ctx.fillStyle = "#F6F3EE"; ctx.fillRect(0, top, W, 250);
  if (pageUrl) {
    const { d, size } = qrSvgPath(qrMatrix(pageUrl), 2);
    const box = 190, cell = box / size;
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(PAD, top + 30, box, box);
    ctx.fillStyle = "#111111"; ctx.save(); ctx.translate(PAD, top + 30); ctx.scale(cell, cell); ctx.fill(new Path2D(d)); ctx.restore();
  }
  const tx = pageUrl ? PAD + 230 : PAD;
  text("시공 사례·후기 보기", tx, top + 100, 34, 800);
  text(pageUrl ? "휴대폰 카메라로 QR을 찍어 보세요" : "공간마켓에서 업체를 찾아보세요", tx, top + 150, 27, 600, "#5C6B61");
  text("공간마켓", tx, top + 200, 30, 900, "#2E5F4B");
  return canvas;
}

const emptyItems = () => [{ name: "", amount: "" }, { name: "", amount: "" }, { name: "", amount: "" }];

export default function QuoteSheetMaker({ companyName, phone, pageUrl, onClose }) {
  const fmt = (p) => { const d = String(p ?? "").replace(/\D/g, "").replace(/^82/, "0"); return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d; };
  const [form, setForm] = useState({ title: "", customer: "", period: "", memo: "", vat: "included", items: emptyItems(), phone: fmt(phone) });
  const [err, setErr] = useState(null);
  const [img, setImg] = useState(null);   // { url, blob, name }
  const [msg, setMsg] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setItem = (i, k, v) => setForm((f) => ({ ...f, items: f.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)) }));

  const make = async () => {
    const { quote, error } = buildQuote(form);
    if (error) { setErr(error); return; }
    setErr(null);
    try {
      const canvas = drawQuote(document.createElement("canvas"), quote, { companyName, phone: String(form.phone ?? "").trim().slice(0, 20), pageUrl });
      const blob = await new Promise((ok) => canvas.toBlob(ok, "image/png"));
      if (!blob) throw new Error("NO_BLOB");
      if (img?.url) URL.revokeObjectURL(img.url);
      setImg({ url: URL.createObjectURL(blob), blob, name: quoteFileName(quote.title, kstDay()) });
      setMsg(null);
    } catch { setErr("이 기기에선 이미지를 만들 수 없어요"); }
  };

  const send = async () => {
    if (!img) return;
    const file = new File([img.blob], img.name, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "견적서" }); setMsg("보냈어요"); } catch { /* 취소 */ }
      return;
    }
    const a = document.createElement("a");
    a.href = img.url; a.download = img.name;
    document.body.appendChild(a); a.click(); a.remove();
    setMsg("이미지를 내려받았어요 · 문자·카톡에 붙여 보내세요");
  };

  const input = { width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: R.md, border: `1px solid ${C.bgWarm}`,
    fontSize: 14.5, fontFamily: "inherit", color: C.text1, background: C.surface };
  const label = { fontSize: 12.5, fontWeight: 700, color: C.text2, margin: "12px 0 6px" };

  return (
    <div role="dialog" aria-label="간단 견적서 만들기" onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.55)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", background: C.surface, borderRadius: "22px 22px 0 0", padding: "22px 20px 30px" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>간단 견적서 만들기</div>
        <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.6, marginTop: 4 }}>
          지인·전화 공사 견적을 이미지 한 장으로 보내요. 아래에 내 업체 페이지 QR이 들어가요.
        </div>

        {img ? (
          <>
            <img src={img.url} alt="만든 견적서" style={{ width: "100%", marginTop: S.lg, borderRadius: R.md, border: `1px solid ${C.bgWarm}` }} />
            <button onClick={send} style={{ marginTop: S.lg, width: "100%", padding: 14, borderRadius: R.lg, border: "none", background: C.brand, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
              카카오톡·문자로 보내기
            </button>
            {msg && <div style={{ fontSize: 12.5, color: C.text2, marginTop: 8, textAlign: "center" }}>{msg}</div>}
            <button onClick={() => setImg(null)} style={{ marginTop: 8, width: "100%", padding: 12, background: "none", border: "none", color: C.text2, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
              고치기
            </button>
          </>
        ) : (
          <>
            <div style={label}>공사 이름</div>
            <input style={input} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="예: 욕실 실리콘·줄눈 보수" maxLength={40} />
            <div style={{ display: "flex", gap: S.sm }}>
              <div style={{ flex: 1 }}>
                <div style={label}>고객 이름(선택)</div>
                <input style={input} value={form.customer} onChange={(e) => set("customer", e.target.value)} placeholder="김○○" maxLength={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={label}>기간(선택)</div>
                <input style={input} value={form.period} onChange={(e) => set("period", e.target.value)} placeholder="하루 · 10/12" maxLength={30} />
              </div>
            </div>
            <div style={label}>항목과 금액</div>
            {form.items.map((it, i) => (
              <div key={i} style={{ display: "flex", gap: S.sm, marginBottom: 6 }}>
                <input style={{ ...input, flex: 3 }} value={it.name} onChange={(e) => setItem(i, "name", e.target.value)} placeholder={i === 0 ? "예: 실리콘 재시공" : "항목"} maxLength={30} />
                <input style={{ ...input, flex: 2 }} value={it.amount} inputMode="numeric" onChange={(e) => setItem(i, "amount", e.target.value.replace(/[^\d]/g, ""))} placeholder="금액(원)" />
              </div>
            ))}
            {form.items.length < QUOTE_MAX_ITEMS && (
              <button onClick={() => set("items", [...form.items, { name: "", amount: "" }])}
                style={{ background: "none", border: "none", color: C.brand, fontSize: 13, fontWeight: 800, cursor: "pointer", padding: "4px 0" }}>+ 항목 추가</button>
            )}
            <div style={{ display: "flex", gap: S.sm, marginTop: 8 }}>
              {[["included", "부가세 포함"], ["separate", "부가세 별도"]].map(([k, l]) => (
                <button key={k} onClick={() => set("vat", k)}
                  style={{ flex: 1, padding: "10px 0", borderRadius: R.full, border: `1.5px solid ${form.vat === k ? C.brand : C.bgWarm}`,
                    background: form.vat === k ? C.brandL : C.surface, color: form.vat === k ? C.brand : C.text2, fontSize: 13, fontWeight: 800, cursor: "pointer" }}>{l}</button>
              ))}
            </div>
            <div style={label}>연락처(견적서에 보여요 · 지워도 돼요)</div>
            <input style={input} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="010-0000-0000" maxLength={20} inputMode="tel" />
            <div style={label}>한 줄 메모(선택)</div>
            <input style={input} value={form.memo} onChange={(e) => set("memo", e.target.value)} placeholder="예: 자재는 방곰팡이 실리콘으로 해요" maxLength={120} />
            {err && <div style={{ fontSize: 13, color: "#B4432F", fontWeight: 700, marginTop: 10 }}>{err}</div>}
            <button onClick={make} style={{ marginTop: S.lg, width: "100%", padding: 14, borderRadius: R.lg, border: "none", background: C.brand, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>
              견적서 이미지 만들기
            </button>
          </>
        )}
        <button onClick={onClose} style={{ marginTop: 6, width: "100%", padding: 12, background: "none", border: "none", color: C.text3, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>닫기</button>
      </div>
    </div>
  );
}
