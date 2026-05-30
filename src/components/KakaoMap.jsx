import { useEffect, useRef, useState } from "react";
import { C, R, GRADE } from "../constants";

const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_MAP_KEY;

// 서울시청 — geolocation 실패 시 fallback 중심
const SEOUL = { lat: 37.5665, lng: 126.9780 };
const RADIUS_M = 3000; // 반경 3km

// 좌표 없는 업체를 중심 주변 3km 내에 결정적으로 산포
// (같은 업체는 항상 같은 위치 → 새로고침해도 안정적)
function scatterPosition(center, index) {
  const angle = index * 2.39996; // golden angle — 고른 분포
  const dist = 500 + (index % 5) * 480; // 500m ~ 2420m
  const dLat = (dist * Math.cos(angle)) / 111000;          // 1° lat ≈ 111km
  const dLng = (dist * Math.sin(angle)) / 88000;           // 1° lng ≈ 88km (서울 위도)
  return { lat: center.lat + dLat, lng: center.lng + dLng };
}

function withCoords(companies, center) {
  return companies.map((c, i) => {
    const hasReal = typeof c.lat === "number" && typeof c.lng === "number";
    const pos = hasReal ? { lat: c.lat, lng: c.lng } : scatterPosition(center, i);
    return { ...c, _lat: pos.lat, _lng: pos.lng };
  });
}

function loadKakaoScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps) { resolve(); return; }
    const existing = document.getElementById("kakao-map-sdk");
    if (existing) {
      existing.addEventListener("load", () => window.kakao.maps.load(resolve));
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.id = "kakao-map-sdk";
    s.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
    s.onload = () => { window.kakao.maps.load(resolve); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── Mock fallback (API 키 없거나 SDK 로드 실패 시) ──
function MockMap({ companies, userRegion, onPinClick, selectedId }) {
  const positioned = withCoords(companies, SEOUL).slice(0, 6);
  return (
    <div style={{ position:"relative", background:"linear-gradient(145deg,#E4EBE0,#D4E2CC,#DCE8D0)",
      borderRadius:R.xl, height:250, overflow:"hidden", border:"1px solid #C4D8BC" }}>
      {[...Array(7)].map((_,i) => <div key={i} style={{ position:"absolute", left:`${i*18}%`, top:0, bottom:0, borderLeft:"1px solid rgba(0,0,0,0.04)" }} />)}
      {[...Array(6)].map((_,i) => <div key={i} style={{ position:"absolute", top:`${i*20}%`, left:0, right:0, borderTop:"1px solid rgba(0,0,0,0.04)" }} />)}
      <div style={{ position:"absolute", left:"44%", top:0, bottom:0, width:4, background:"rgba(255,255,255,0.65)" }} />
      <div style={{ position:"absolute", top:"48%", left:0, right:0, height:4, background:"rgba(255,255,255,0.65)" }} />
      {/* 반경 3km 표시 원 */}
      <div style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)",
        width:180, height:180, borderRadius:"50%", border:`2px dashed ${C.brand}55`, background:`${C.brand}0d` }} />
      {positioned.map((c, i) => {
        const positions = [{x:28,y:40},{x:57,y:28},{x:71,y:57},{x:42,y:70},{x:62,y:36},{x:34,y:58}];
        const pos = positions[i] ?? {x:50,y:50};
        const g = GRADE(c.temp ?? 36.5);
        const active = selectedId === c.id;
        return (
          <div key={c.id} onClick={() => onPinClick?.(c)}
            style={{ position:"absolute", left:`${pos.x}%`, top:`${pos.y}%`, transform:"translate(-50%,-100%)", cursor:"pointer", zIndex:active?20:10 }}>
            <div style={{ background:active?C.brand:g.bar, color:"#fff", borderRadius:R.full, padding:"5px 10px",
              fontSize:11, fontWeight:800, boxShadow:active?`0 4px 14px ${C.brand}88`:"0 3px 10px rgba(0,0,0,0.2)",
              whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:4,
              transform:active?"scale(1.12)":"scale(1)", transition:"transform 0.15s" }}>
              {c.online && <div style={{ width:5, height:5, borderRadius:"50%", background:C.green }} />}
              🏠 {(c.name ?? "?").slice(0,4)}
            </div>
            <div style={{ width:2, height:8, background:active?C.brand:g.bar, margin:"0 auto" }} />
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
          목업 지도
        </div>
      )}
    </div>
  );
}

// ── 실제 카카오 지도 ──
function RealMap({ companies, userRegion, onPinClick, selectedId }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const circleRef = useRef(null);
  const myMarkerRef = useRef(null);
  const overlaysRef = useRef([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [center, setCenter] = useState(SEOUL);

  // SDK 로드
  useEffect(() => {
    let alive = true;
    loadKakaoScript(KAKAO_API_KEY)
      .then(() => { if (alive) setReady(true); })
      .catch(() => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, []);

  // 지도 1회 생성 + geolocation
  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    const { maps } = window.kakao;
    const c = new maps.LatLng(center.lat, center.lng);
    const map = new maps.Map(containerRef.current, { center: c, level: 6 });
    mapRef.current = map;

    myMarkerRef.current = new maps.Marker({
      map, position: c,
      image: new maps.MarkerImage(
        "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png",
        new maps.Size(24, 35)
      ),
    });

    // geolocation — 성공 시 중심 갱신, 실패 시 서울 유지
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { timeout: 5000 }
      );
    }
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // center 변경 시 지도 이동 + 내 위치 마커 갱신
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;
    const { maps } = window.kakao;
    const c = new maps.LatLng(center.lat, center.lng);
    mapRef.current.setCenter(c);
    myMarkerRef.current?.setPosition(c);
  }, [center]);

  // center / companies / selectedId 변경 시 반경원 + 업체 핀 재배치
  useEffect(() => {
    if (!mapRef.current || !window.kakao?.maps) return;
    const { maps } = window.kakao;
    const map = mapRef.current;
    const c = new maps.LatLng(center.lat, center.lng);

    // 반경 3km 원
    circleRef.current?.setMap(null);
    circleRef.current = new maps.Circle({
      center: c, radius: RADIUS_M,
      strokeWeight: 2, strokeColor: C.brand, strokeOpacity: 0.5, strokeStyle: "shortdash",
      fillColor: C.brand, fillOpacity: 0.06,
    });
    circleRef.current.setMap(map);

    // 기존 핀 제거
    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];

    // 업체 핀 (좌표 없으면 중심 주변 산포)
    withCoords(companies, center).forEach(co => {
      const pos = new maps.LatLng(co._lat, co._lng);
      const g = GRADE(co.temp ?? 36.5);
      const active = selectedId === co.id;
      const bg = active ? C.brand : g.bar;
      const scale = active ? "scale(1.12)" : "scale(1)";
      const shadow = active ? `0 4px 14px ${C.brand}aa` : "0 3px 10px rgba(0,0,0,0.2)";
      const content = document.createElement("div");
      content.style.cssText = `background:${bg};color:#fff;border-radius:20px;padding:5px 10px;font-size:11px;font-weight:800;white-space:nowrap;box-shadow:${shadow};cursor:pointer;transform:${scale};transition:transform 0.15s;`;
      content.textContent = `🏠 ${(co.name ?? "?").slice(0, 4)}`;
      content.addEventListener("click", () => onPinClick?.(co));
      const overlay = new maps.CustomOverlay({ map, position: pos, content, yAnchor: 1, zIndex: active ? 20 : 5 });
      overlaysRef.current.push(overlay);
    });
  }, [center, companies, selectedId, onPinClick]);

  // 언마운트 정리
  useEffect(() => () => {
    overlaysRef.current.forEach(o => o.setMap(null));
    circleRef.current?.setMap(null);
  }, []);

  if (loadError) return <MockMap companies={companies} userRegion={userRegion} onPinClick={onPinClick} selectedId={selectedId} />;

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

export default function KakaoMap({ companies = [], userRegion = "", onPinClick, selectedId = null }) {
  if (!KAKAO_API_KEY) {
    return <MockMap companies={companies} userRegion={userRegion} onPinClick={onPinClick} selectedId={selectedId} />;
  }
  return <RealMap companies={companies} userRegion={userRegion} onPinClick={onPinClick} selectedId={selectedId} />;
}
