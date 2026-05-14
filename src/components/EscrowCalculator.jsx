import { useState } from "react";
import { C, R, S } from "../constants";
import { fmtMoney, calculateCustomerTotal, calculateStagePayments } from "../utils/calculations";

export default function EscrowCalculator() {
  const [price, setPrice] = useState("");
  const amount = parseInt(price, 10) || 0;
  const customerTotal = amount > 0 ? calculateCustomerTotal(amount) : 0;
  const escrowFee    = amount > 0 ? Math.round((customerTotal - amount) * 10) / 10 : 0;
  const stages       = amount > 0 ? calculateStagePayments(amount) : [];
  const companyTotal = amount > 0 ? Math.round(amount * 0.96 * 10) / 10 : 0;

  return (
    <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
      border:`1px solid ${C.bgWarm}`, marginBottom:S.lg }}>
      <div style={{ fontSize:15, fontWeight:800, color:C.text1, marginBottom:4 }}>🧮 정산 예시 계산기</div>
      <div style={{ fontSize:12, color:C.text3, marginBottom:S.lg }}>
        견적 금액을 입력하면 수수료와 단계별 정산액을 자동 계산합니다
      </div>

      <input
        value={price}
        onChange={e => setPrice(e.target.value)}
        placeholder="견적 금액 (만원, 예: 3000)"
        type="number"
        style={{ width:"100%", padding:"13px 16px", border:`1.5px solid ${amount > 0 ? C.brand : C.bgWarm}`,
          borderRadius:R.md, fontSize:15, outline:"none", boxSizing:"border-box",
          marginBottom:amount > 0 ? S.lg : 0, fontFamily:"inherit",
          color:C.text1, background:C.surface, transition:"border-color 0.2s" }}
      />

      {amount > 0 && (
        <>
          {/* 고객 부담 */}
          <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg,
            marginBottom:S.md, border:`1px solid ${C.brandM}` }}>
            <div style={{ fontSize:12, fontWeight:800, color:C.brand, marginBottom:S.sm }}>
              👤 고객 부담
            </div>
            {[
              ["시공비",              fmtMoney(amount),      C.text2],
              ["에스크로 이용료 (3%)", `+${fmtMoney(escrowFee)}`, C.brand],
            ].map(([k, v, vc]) => (
              <div key={k} style={{ display:"flex", justifyContent:"space-between",
                fontSize:12, marginBottom:4 }}>
                <span style={{ color:C.text3 }}>{k}</span>
                <span style={{ fontWeight:700, color:vc }}>{v}</span>
              </div>
            ))}
            <div style={{ height:1, background:C.brandM, margin:`${S.xs}px 0 ${S.sm}px` }} />
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:13, fontWeight:800, color:C.text1 }}>총 예치 금액</span>
              <span style={{ fontSize:15, fontWeight:900, color:C.brand }}>{fmtMoney(customerTotal)}</span>
            </div>
          </div>

          {/* 단계별 정산 */}
          <div style={{ background:C.surface2, borderRadius:R.lg, padding:S.lg,
            marginBottom:S.md, border:`1px solid ${C.bgWarm}` }}>
            <div style={{ fontSize:12, fontWeight:800, color:C.text1, marginBottom:S.sm }}>
              🏗 단계별 정산 · 착공 30% / 중간 40% / 완료 30%
            </div>
            {stages.map(({ name, percent, amount: sa, companyReceiveAmount }) => (
              <div key={name} style={{ display:"flex", justifyContent:"space-between",
                alignItems:"center", padding:`${S.xs}px 0`,
                borderBottom:`1px solid ${C.bgWarm}` }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:C.text2 }}>{name} ({percent}%)</div>
                  <div style={{ fontSize:10, color:C.text4 }}>업체 수수료 4% 차감 후 수령액</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:12, color:C.text3 }}>{fmtMoney(sa)}</div>
                  <div style={{ fontSize:12, fontWeight:800, color:C.brand }}>→ {fmtMoney(companyReceiveAmount)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 업체 최종 수령 */}
          <div style={{ background:C.navyL, borderRadius:R.lg, padding:S.lg,
            border:`1px solid ${C.trustM}` }}>
            <div style={{ fontSize:12, fontWeight:800, color:C.navy, marginBottom:S.sm }}>
              🏢 업체 최종 수령액 (수수료 4% 차감)
            </div>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <span style={{ fontSize:12, color:C.text3 }}>
                {fmtMoney(amount)} × 96%
              </span>
              <span style={{ fontSize:16, fontWeight:900, color:C.navy }}>{fmtMoney(companyTotal)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
