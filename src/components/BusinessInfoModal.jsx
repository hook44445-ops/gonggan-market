import { C, R, S } from "../constants";
import { BIZ_ROWS } from "./AppFooter";

const DISPLAY_ORDER = ["상호", "사업자등록번호", "대표자", "통신판매업신고번호", "주소", "고객센터", "이메일"];

export default function BusinessInfoModal({ onClose }) {
  const rows = DISPLAY_ORDER
    .map(label => BIZ_ROWS.find(([l]) => l === label))
    .filter(Boolean);

  return (
    <div
      style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.65)",
        display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:500 }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={{
        background:C.surface, borderRadius:"24px 24px 0 0",
        width:"100%", maxWidth:480,
        padding:"24px 24px 40px", maxHeight:"88vh", overflowY:"auto",
      }}>
        <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />

        <div style={{ display:"flex", alignItems:"center", gap:S.sm, marginBottom:S.xl }}>
          <div style={{ fontSize:22 }}>🏢</div>
          <div style={{ fontSize:18, fontWeight:900, color:C.text1 }}>사업자정보</div>
        </div>

        <div style={{ background:C.bg, borderRadius:R.md, padding:S.lg, border:`1px solid ${C.bgWarm}` }}>
          {rows.map(([label, value], i) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between", gap:S.md,
              padding:`${S.sm}px 0`, borderBottom: i < rows.length - 1 ? `1px solid ${C.bgWarm}` : "none" }}>
              <span style={{ fontSize:13, color:C.text3, flexShrink:0 }}>{label}</span>
              <span style={{ fontSize:13, color:C.text1, fontWeight:600, textAlign:"right" }}>{value}</span>
            </div>
          ))}
        </div>

        <button onClick={onClose}
          style={{ width:"100%", marginTop:S.xl, padding:S.lg, background:C.brand, color:"#fff",
            border:"none", borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer",
            boxShadow:`0 4px 14px ${C.brand}44` }}>
          확인
        </button>
      </div>
    </div>
  );
}
