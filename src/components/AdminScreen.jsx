import { C, R, S } from "../constants";

export default function AdminScreen({ onBack }) {
  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background:C.surface, padding:"14px 20px", borderBottom:`1px solid ${C.bgWarm}`,
        position:"sticky", top:0, zIndex:10, display:"flex", alignItems:"center", gap:S.md }}>
        <button onClick={onBack} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.text1, padding:0 }}>←</button>
        <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>관리자</div>
      </div>
      <div style={{ padding:S.xl, textAlign:"center", paddingTop:80 }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🔧</div>
        <div style={{ fontSize:16, fontWeight:700, color:C.text1, marginBottom:8 }}>관리자 페이지</div>
        <div style={{ fontSize:13, color:C.text3 }}>준비 중입니다</div>
      </div>
    </div>
  );
}
