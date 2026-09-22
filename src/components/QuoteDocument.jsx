import { useEffect } from "react";
import { createPortal } from "react-dom";

// 최종 견적서 — 미리보기 + 인쇄/PDF 저장(A4 한 장 모양).
// 파트너(작성 중 폼)와 의뢰인(받은 견적) 둘 다 같은 문서를 본다. estimate 는 estimates 행 모양
// (items[{name, material, qty, unit_price, amount}], total_price(만원), duration_days, note, warranty_note, 사진 url).
// 인쇄는 브라우저 기본 인쇄 → «PDF로 저장» 도 된다. 인쇄할 때는 이 문서만 나오게 앱 화면을 가린다.

const PRINT_CSS = `
@page { size: A4; margin: 14mm; }
#quote-print .qd-narrow { display: none; }
@media (max-width: 520px) {
  #quote-print .qd-wide { display: none; }
  #quote-print .qd-narrow { display: block; }
  #quote-print .qd-sheet { padding: 24px 16px !important; }
}
@media print {
  body > *:not(#quote-print) { display: none !important; }
  #quote-print { position: static !important; background: #fff !important; overflow: visible !important; }
  #quote-print .qd-bar { display: none !important; }
  #quote-print .qd-sheet { box-shadow: none !important; margin: 0 !important; max-width: none !important; padding: 0 !important; }
  #quote-print .qd-photo { break-inside: avoid; }
  #quote-print .qd-wide { display: table-cell !important; }
  #quote-print .qd-narrow { display: none !important; }
}`;

const won = (man) => `${Math.round((Number(man) || 0) * 10000).toLocaleString("ko-KR")}원`;
const qtyText = (q) => (q == null || q === "" ? "" : Number(q).toLocaleString("ko-KR"));

export default function QuoteDocument({ estimate = {}, companyName, request = {}, docNo, issuedAt, onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const items = (Array.isArray(estimate.items) ? estimate.items : []).filter(it => it && (it.name || it.amount || it.unit_price));
  const rowAmount = (it) => it.amount ?? (Number(it.qty) || 0) * (Number(it.unit_price ?? it.unitPrice) || 0);
  const total = Number(estimate.total_price) || items.reduce((s, it) => s + rowAmount(it), 0);
  const photos = estimate.final_quote_photo_urls ?? estimate.photo_urls ?? [];
  const date = new Date(issuedAt || estimate.submitted_at || estimate.updated_at || estimate.created_at || Date.now());
  const place = [request.space_type, request.size, request.area].filter(Boolean).join(" · ");

  const th = { textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "#6B6F68", padding: "8px 6px", borderBottom: "1.5px solid #1F2A24" };
  const td = { fontSize: 12.5, color: "#1F2A24", padding: "9px 6px", borderBottom: "1px solid #E4E0D8", verticalAlign: "top" };

  return createPortal(
    <div id="quote-print" role="dialog" aria-label="최종 견적서 미리보기"
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#EDEAE4", overflowY: "auto", fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif" }}>
      <style>{PRINT_CSS}</style>

      <div className="qd-bar" style={{ position: "sticky", top: 0, zIndex: 1, display: "flex", gap: 8, alignItems: "center", padding: "10px 16px", background: "#fff", borderBottom: "1px solid #E4E0D8" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 14, fontWeight: 700, color: "#3A4A40", cursor: "pointer", padding: "6px 4px", fontFamily: "inherit" }}>← 닫기</button>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 800, color: "#1F2A24" }}>견적서 미리보기</div>
        <button onClick={() => window.print()}
          style={{ background: "#2F5D46", color: "#fff", border: "none", borderRadius: 999, padding: "9px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
          인쇄 · PDF 저장
        </button>
      </div>

      <div className="qd-sheet" style={{ maxWidth: 720, margin: "16px auto 40px", background: "#fff", padding: "32px 24px", boxShadow: "0 4px 24px rgba(31,42,36,0.12)", color: "#1F2A24" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, borderBottom: "3px solid #1F2A24", paddingBottom: 12, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: 6 }}>견 적 서</div>
            {place && <div style={{ fontSize: 12.5, color: "#6B6F68", marginTop: 4 }}>{place}</div>}
          </div>
          <div style={{ textAlign: "right", fontSize: 11.5, color: "#6B6F68", lineHeight: 1.7 }}>
            {docNo && <div>번호 {docNo}</div>}
            <div>발행일 {date.toLocaleDateString("ko-KR")}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18, fontSize: 12.5, lineHeight: 1.8 }}>
          <div style={{ border: "1px solid #E4E0D8", padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: "#6B6F68", fontWeight: 700 }}>받는 분</div>
            <div style={{ fontWeight: 800 }}>의뢰인 귀하</div>
            {request.area && <div style={{ color: "#6B6F68" }}>{request.area}</div>}
          </div>
          <div style={{ border: "1px solid #E4E0D8", padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: "#6B6F68", fontWeight: 700 }}>시공 업체</div>
            <div style={{ fontWeight: 800 }}>{companyName || "시공 업체"}</div>
            {estimate.duration_days ? <div style={{ color: "#6B6F68" }}>공사 기간 {estimate.duration_days}일</div> : null}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", background: "#F3F6F2", padding: "12px 14px", marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 800 }}>합계 금액</span>
          <span style={{ fontSize: 22, fontWeight: 900, color: "#2F5D46" }}>{won(total)}</span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 18 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 24 }}>#</th>
              <th style={th}>공정 · 자재</th>
              <th className="qd-wide" style={{ ...th, textAlign: "right", width: 52 }}>수량</th>
              <th className="qd-wide" style={{ ...th, textAlign: "right", width: 92 }}>단가</th>
              <th style={{ ...th, textAlign: "right", width: 104 }}>금액</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td style={{ ...td, color: "#9A9D96" }}>{i + 1}</td>
                <td style={td}>
                  <div style={{ fontWeight: 700 }}>{it.name || "공정"}</div>
                  {it.material && <div style={{ fontSize: 11.5, color: "#6B6F68" }}>{it.material}</div>}
                  <div className="qd-narrow" style={{ fontSize: 11.5, color: "#6B6F68" }}>{qtyText(it.qty)} × {won(it.unit_price ?? it.unitPrice)}</div>
                </td>
                <td className="qd-wide" style={{ ...td, textAlign: "right" }}>{qtyText(it.qty)}</td>
                <td className="qd-wide" style={{ ...td, textAlign: "right" }}>{won(it.unit_price ?? it.unitPrice)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{won(rowAmount(it))}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...td, borderBottom: "1.5px solid #1F2A24" }} />
              <td style={{ ...td, textAlign: "right", fontWeight: 800, borderBottom: "1.5px solid #1F2A24" }}>합계</td>
              <td className="qd-wide" colSpan={2} style={{ ...td, borderBottom: "1.5px solid #1F2A24" }} />
              <td style={{ ...td, textAlign: "right", fontWeight: 900, borderBottom: "1.5px solid #1F2A24" }}>{won(total)}</td>
            </tr>
          </tbody>
        </table>

        {(estimate.warranty_note || estimate.note) && (
          <div style={{ fontSize: 12.5, lineHeight: 1.8, marginBottom: 18 }}>
            {estimate.warranty_note && <div><b>하자보수</b> · {estimate.warranty_note}</div>}
            {estimate.note && <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}><b>업체 메모</b><br />{estimate.note}</div>}
          </div>
        )}

        {photos.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>현장 사진</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {photos.map((u, i) => (
                <div key={u + i} className="qd-photo" style={{ aspectRatio: "4/3", overflow: "hidden", border: "1px solid #E4E0D8" }}>
                  <img src={u} alt={`현장 사진 ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 10.5, color: "#9A9D96", borderTop: "1px solid #E4E0D8", paddingTop: 10, lineHeight: 1.7 }}>
          공간마켓에서 업체가 현장 확인 후 작성한 견적서입니다. 금액 단위: 원(부가세 포함 여부는 업체와 확인해 주세요).
        </div>
      </div>
    </div>,
    document.body
  );
}
