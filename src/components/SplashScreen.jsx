import { C } from "../constants";
import { LogoMark, LeafSprig } from "./common";

export default function SplashScreen() {
  return (
    <div style={{ position:"relative", minHeight:"100vh", overflow:"hidden",
      background:`linear-gradient(160deg,${C.brand},${C.brandD})`,
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20, color:"#fff" }}>

      <LeafSprig size={220} color="#fff" opacity={0.07}
        style={{ position:"absolute", left:-40, top:-30, transform:"rotate(20deg)" }} />
      <LeafSprig size={180} color="#fff" opacity={0.06}
        style={{ position:"absolute", right:-30, bottom:-20, transform:"rotate(-15deg)" }} />

      <div style={{ position:"relative", textAlign:"center" }}>
        <div style={{ width:96, height:96, borderRadius:28, background:"rgba(255,255,255,0.92)",
          display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 24px",
          boxShadow:"0 8px 28px rgba(0,0,0,0.18)" }}>
          <LogoMark size={62} bare />
        </div>
        <div style={{ fontSize:30, fontWeight:800, letterSpacing:2 }}>공간사이</div>
        <div style={{ fontSize:13, opacity:0.82, letterSpacing:6, marginTop:4 }}>공간마켓</div>
        <div style={{ fontSize:11, opacity:0.55, marginTop:14, lineHeight:1.6 }}>
          사람과 공간 사이, 따뜻한 연결
        </div>
      </div>
    </div>
  );
}
