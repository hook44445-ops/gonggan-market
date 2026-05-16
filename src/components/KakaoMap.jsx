import { useEffect, useRef, useState } from "react";
import { C, R, S, GRADE } from "../constants";

const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_MAP_KEY;

function loadKakaoScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps) { resolve(); return; }
    const existing = document.getElementById("kakao-map-sdk");
    if (existing) { existing.addEventListener("load", resolve); return; }
    const s = document.createElement("script");
    s.id = "kakao-map-sdk";
    s.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
    s.onload = () => { window.kakao.maps.load(resolve); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Fallback map component when no API key is configured
function MockMap({ companies, userRegion, onPinClick }) {
  return (
    <div style={{ position:"relative", background:"linear-gradient(145deg,#E4EBE0,#D4E2CC,#DCE8D0)",
      borderRadius:R.xl, height:250, overflow:"hidden", border:"1px solid #C4D8BC" }}>
      {[...Array(7)].map((_,i) => <div key={i} style={{ position:"absolute", left:`${i*18}%`, top:0, bottom:0, borderLeft:"1px solid rgba(0,0,0,0.04)" }} />)}
      {[...Array(6)].map((_,i) => <div key={i} style={{ position:"absolute", top:`${i*20}%`, left:0, right:0, borderTop:"1px solid rgba(0,0,0,0.04)" }} />)}
      <div style={{ position:"absolute", left:"44%", top:0, bottom:0, width:4, background:"rgba(255,255,255,0.65)" }} />
      <div style={{ position:"absolute", top:"48%", left:0, right:0, height:4, background:"rgba(255,255,255,0.65)" }} />
      {companies.slice(0, 5).map((c, i) => {
        const positions = [{x:28,y:40},{x:57,y:28},{x:71,y:57},{x:42,y:70},{x:62,y:36}];
        const pos = positions[i] ?? {x:50,y:50};
        const g = GRADE(c.temp ?? 70);
        return (
          <div key={c.id} onClick={() => onPinClick?.(c)}
            style={{ position:"absolute", left:`${pos.x}%`, top:`${pos.y}%`, transform:"translate(-50%,-100%)", cursor:"pointer", zIndex:10 }}>
            <div style={{ background:g.bar, color:"#fff", borderRadius:R.full, padding:"5px 10px",
              fontSize:11, fontWeight:800, boxShadow:"0 3px 10px rgba(0,0,0,0.2)", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:4 }}>
              {c.online && <div style={{ width:5, height:5, borderRadius:"50%", background:C.green }} />}
              🏠 {(c.name ?? "?").slice(0,4)}
            </div>
            <div style={{ width:2, height:8, background:g.bar, margin:"0 auto" }} />
          </div>
        );
      })}
      <div style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)" }}>
        <div style={{ width:14, height:14, borderRadius:"50%", background:C.brand, border:"3px solid #fff", boxShadow:`0 0 0 8px ${C.brand}22` }} />
      </div>
      <div style={{ position:"absolute", bottom:10, right:12, background:"rgba(255,255,255,0.92)", borderRadius:R.full, padding:"4px 12px", fontSize:11, color:C.text2, fontWeight:600 }}>
        📍 {userRegion} · 반경 3km
      </div>
      {!KAKAO_API_KEY && (
        <div style={{ position:"absolute", top:8, left:12, background:"rgba(0,0,0,0.5)", color:"#fff", borderRadius:R.sm, padding:"3px 8px", fontSize:10 }}>
          VITE_KAKAO_MAP_KEY 미설정 (목업 지도)
        </div>
      )}
    </div>
  );
}

// Real Kakao Map component
function RealMap({ companies, userRegion, onPinClick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    loadKakaoScript(KAKAO_API_KEY)
      .then(() => setReady(true))
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const { maps } = window.kakao;

    // Default center: Seoul city hall (fallback when no user coords)
    const center = new maps.LatLng(37.5665, 126.9780);
    const map = new maps.Map(containerRef.current, { center, level: 5 });
    mapRef.current = map;

    // Current location marker
    const myMarker = new maps.Marker({
      map,
      position: center,
      image: new maps.MarkerImage(
        "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png",
        new maps.Size(24, 35)
      ),
    });

    // Company pins
    companies.forEach(c => {
      if (!c.lat || !c.lng) return;
      const pos = new maps.LatLng(c.lat, c.lng);
      const g = GRADE(c.temp ?? 70);
      const content = `<div style="background:${g.bar};color:#fff;border-radius:20px;padding:5px 10px;font-size:11px;font-weight:800;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.2);">🏠 ${(c.name ?? "?").slice(0,4)}</div>`;
      const overlay = new maps.CustomOverlay({ map, position: pos, content, yAnchor: 1 });
      maps.event.addListener(overlay, "click", () => onPinClick?.(c));
    });

    // Try geolocation for real user position
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const userPos = new maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        map.setCenter(userPos);
        myMarker.setPosition(userPos);
      }, () => {});
    }
  }, [ready, companies]);

  if (loadError) return <MockMap companies={companies} userRegion={userRegion} onPinClick={onPinClick} />;

  return (
    <div style={{ position:"relative", borderRadius:R.xl, overflow:"hidden", height:250, border:`1px solid ${C.bgWarm}` }}>
      <div ref={containerRef} style={{ width:"100%", height:"100%" }} />
      {!ready && (
        <div style={{ position:"absolute", inset:0, background:C.bgWarm, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:C.text3 }}>
          지도 로딩 중...
        </div>
      )}
      <div style={{ position:"absolute", bottom:10, right:12, background:"rgba(255,255,255,0.92)", borderRadius:R.full, padding:"4px 12px", fontSize:11, color:C.text2, fontWeight:600 }}>
        📍 {userRegion} · 반경 3km
      </div>
    </div>
  );
}

export default function KakaoMap({ companies = [], userRegion = "", onPinClick }) {
  if (!KAKAO_API_KEY) {
    return <MockMap companies={companies} userRegion={userRegion} onPinClick={onPinClick} />;
  }
  return <RealMap companies={companies} userRegion={userRegion} onPinClick={onPinClick} />;
}
