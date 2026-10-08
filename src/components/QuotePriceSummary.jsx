// 최종 견적서 금액 블록 — 고객 화면(결제 단계)과 견적서 PDF 가 같은 줄을 쓴다(lib/priceVat · 법률 답 10-08).
//   공사 공급가액 / 부가가치세 / 공사대금 합계 / 고객 부담 플랫폼 이용료 0원 / 고객 총 부담액(부가세 포함)
//   + «카드·가상계좌 선택에 따른 추가 요금은 없습니다» + «업체가 부담하는 플랫폼 수수료는 고객에게 별도 청구하지 않습니다»
import { quotePriceRows, NO_METHOD_CHARGE, NO_COMPANY_FEE_CHARGE } from "../lib/priceVat";

export default function QuotePriceSummary({ totalManwon, ink = "#1F2A24", sub = "#6B6F68", accent = "#2F5D46", bg = "#F3F6F2", line = "#E4E0D8" }) {
  const rows = quotePriceRows(totalManwon);
  return (
    <div style={{ background: bg, padding: "12px 14px" }}>
      {rows.map(([k, v, strong]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12,
          padding: strong ? "8px 0 2px" : "3px 0", marginTop: strong ? 6 : 0, borderTop: strong ? `1px solid ${line}` : "none" }}>
          <span style={{ fontSize: strong ? 13.5 : 12.5, fontWeight: strong ? 800 : 600, color: strong ? ink : sub }}>{k}</span>
          <span style={{ fontSize: strong ? 20 : 13, fontWeight: strong ? 900 : 700, color: strong ? accent : ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{v}</span>
        </div>
      ))}
      <div style={{ fontSize: 11.5, color: sub, lineHeight: 1.7, marginTop: 6 }}>
        {NO_METHOD_CHARGE}<br />{NO_COMPANY_FEE_CHARGE}
      </div>
    </div>
  );
}
