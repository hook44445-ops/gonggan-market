import { useState } from "react";
import { C, R, S } from "../constants";

// ─────────────────────────────────────────────────────
// 업체 → 고객 신뢰평가 (양방향 후기)
//   계약이행도(1~5) · 응답성(1~5) · 분쟁이력(Y/N) + 한줄 메모.
//   디자인: 기존 톤 유지. 빨강·주황 경고색 금지.
// ─────────────────────────────────────────────────────
export default function CustomerEvaluationModal({ onClose, onSubmit, submitting = false }) {
  const [compliance, setCompliance] = useState(0);
  const [response, setResponse] = useState(0);
  const [dispute, setDispute] = useState(false);
  const [note, setNote] = useState("");
  const canSubmit = compliance > 0 && response > 0 && !submitting;

  const StarRow = ({ label, value, onChange }) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
      <span style={{ fontSize:14, color:C.text2, fontWeight:600 }}>{label}</span>
      <div style={{ display:"flex", gap:4 }}>
        {[1,2,3,4,5].map(s => (
          <span key={s} onClick={() => onChange(s)}
            style={{ fontSize:24, cursor:"pointer", color: s <= value ? C.gold : "#E8E4DC" }}>★</span>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.6)",
      display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:300 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={{ background:C.surface, borderRadius:"24px 24px 0 0",
        width:"100%", maxWidth:480, padding:"22px 24px 36px", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 18px" }} />
        <div style={{ fontSize:18, fontWeight:900, color:C.text1, marginBottom:3 }}>고객 신뢰평가</div>
        <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>
          이번 거래에서 고객님은 어떠셨나요? 평가는 신뢰 기록으로 쌓입니다.
        </div>

        <div style={{ background:C.surface2, borderRadius:R.lg, padding:`${S.lg}px ${S.lg}px`, marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>
          <StarRow label="계약이행도" value={compliance} onChange={setCompliance} />
          <StarRow label="응답성" value={response} onChange={setResponse} />
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6, paddingTop:10, borderTop:`1px solid ${C.bgWarm}` }}>
            <span style={{ fontSize:14, color:C.text2, fontWeight:600 }}>분쟁 이력</span>
            <div style={{ display:"flex", gap:6 }}>
              {[[false,"없음"],[true,"있음"]].map(([v,label]) => (
                <button key={label} onClick={() => setDispute(v)}
                  style={{ padding:"5px 14px", borderRadius:R.full, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                    border:"none", background: dispute === v ? C.brand : C.bgWarm, color: dispute === v ? "#fff" : C.text2 }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder="한줄 메모 (선택)" rows={2}
          style={{ width:"100%", padding:"12px 14px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.lg,
            fontSize:14, outline:"none", resize:"none", boxSizing:"border-box", fontFamily:"inherit",
            color:C.text1, background:C.surface, marginBottom:S.lg }} />

        <div style={{ display:"flex", gap:S.sm }}>
          <button onClick={onClose}
            style={{ flex:1, padding:S.lg, background:C.bg, color:C.text2, border:`1px solid ${C.bgWarm}`,
              borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>취소</button>
          <button disabled={!canSubmit}
            onClick={() => canSubmit && onSubmit?.({ contractCompliance: compliance, responseScore: response, disputeHistory: dispute, content: note })}
            style={{ flex:2, padding:S.lg, background: canSubmit ? C.brand : C.bgWarm, color: canSubmit ? "#fff" : C.text4,
              border:"none", borderRadius:R.lg, fontWeight:800, fontSize:14, cursor: canSubmit ? "pointer" : "not-allowed", fontFamily:"inherit" }}>
            {submitting ? "제출 중..." : "평가 제출"}
          </button>
        </div>
      </div>
    </div>
  );
}
