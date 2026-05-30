import { useEffect, useRef, useState } from "react";
import { C, R, GRADE } from "../constants";

const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_MAP_KEY;

// ── 진단 로그 — production 콘솔에서 mock/real 판별용 (UI 노출 없음) ──
function mapLog(...args) {
  // eslint-disable-next-line no-console
  console.log("[KakaoMap]", ...args);
}

// 키 존재 여부만 1회 보고 (키 값 자체는 노출하지 않음)
mapLog("env VITE_KAKAO_MAP_KEY:", KAKAO_API_KEY ? `present(len=${String(KAKAO_API_KEY).length})` : "MISSING → mock fallback");

// 서울시청 — geolocation 실패 시 fallback 중심
const SEOUL = { lat: 37.5665, lng: 126.9780 };
const RADIUS_M = 3000; // 반경 3km
const SDK_TIMEOUT_MS = 8000; // SDK 로드 타임아웃 → 초과 시 mock fallback

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
    if (!apiKey) { reject(new Error("no-api-key")); return; }
    if (window.kakao?.maps) { mapLog("SDK already present (window.kakao.maps OK)"); resolve(); return; }

    // 타임아웃 — SDK가 끝내 로드되지 않으면 fallback 으로 넘긴다
    let settled = false;
    const done = (fn, arg) => { if (settled) return; settled = true; clearTimeout(timer); fn(arg); };
    const timer = setTimeout(() => {
      mapLog("SDK load TIMEOUT (>", SDK_TIMEOUT_MS, "ms) → mock fallback");
      done(reject, new Error("sdk-timeout"));
    }, SDK_TIMEOUT_MS);

    const finishOk = () => {
      // window.kakao.maps.load 는 maps 네임스페이스 준비 후 콜백 실행
      if (window.kakao?.maps) {
        window.kakao.maps.load(() => { mapLog("SDK ready (window.kakao.maps loaded)"); done(resolve); });
      } else {
        mapLog("script loaded but window.kakao missing → mock fallback");
        done(reject, new Error("kakao-undefined"));
      }
    };

    const existing = document.getElementById("kakao-map-sdk");
    if (existing) {
      // 이미 삽입된 스크립트가 로드 완료됐을 수도 있으므로 폴링으로도 확인
      mapLog("SDK script tag exists — waiting/polling for window.kakao.maps");
      existing.addEventListener("load", finishOk);
      existing.addEventListener("error", () => done(reject, new Error("sdk-load-error")));
      const poll = setInterval(() => {
        if (settled) { clearInterval(poll); return; }
        if (window.kakao?.maps) { clearInterval(poll); finishOk(); }
      }, 200);
      return;
    }

    mapLog("injecting Kakao SDK script:", `//dapi.kakao.com/v2/maps/sdk.js?appkey=***&autoload=false`);
    const s = document.createElement("script");
    s.id = "kakao-map-sdk";
    s.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
    s.onload = finishOk;
    s.onerror = () => { mapLog("SDK script onerror → mock fallback (도메인 미등록/네트워크 확인)"); done(reject, new Error("sdk-load-error")); };
    document.head.appendChild(s);
  });
}

// ── Mock fallback (API 키 없거나 SDK 로드 실패 시) ──
function MockMap({ companies, userRegion, onPinClick, selectedId, onRequestLocation, gpsLoading }) {
  const positioned = withCoords(companies, SEOUL).slice(0, 6);
  const empty = companies.length === 0;
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
      {!empty && positioned.map((c, i) => {
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
      {empty && (
        <div style={{ position:"absolute", left:"50%", top:"58%", transform:"translate(-50%,-50%)",
          background:"rgba(255,255,255,0.92)", borderRadius:R.md, padding:"8px 16px",
          fontSize:12, color:C.text2, fontWeight:600, textAlign:"center", whiteSpace:"nowrap" }}>
          현재 등록된 업체를 준비 중입니다
        </div>
      )}
      <div style={{ position:"absolute", top:10, left:12, background:"rgba(255,255,255,0.92)", borderRadius:R.full, padding:"4px 12px", fontSize:11, color:C.text2, fontWeight:700, pointerEvents:"none" }}>
        내 활동지역: {userRegion || "서울·경기·인천"} · 반경 3km
      </div>
      {onRequestLocation && (
        <button onClick={onRequestLocation} disabled={gpsLoading}
          style={{ position:"absolute", bottom:10, right:12, background:"rgba(255,255,255,0.95)", border:`1px solid ${C.bgWarm}`,
            borderRadius:R.full, padding:"7px 13px", fontSize:11, color:C.brand, fontWeight:800,
            cursor: gpsLoading ? "default" : "pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.12)" }}>
          {gpsLoading ? "위치 확인 중..." : "📍 현재 위치로 보기"}
        </button>
      )}
      {!KAKAO_API_KEY && (
        <div style={{ position:"absolute", bottom:10, left:12, background:"rgba(0,0,0,0.5)", color:"#fff", borderRadius:R.sm, padding:"3px 8px", fontSize:10 }}>
          목업 지도
        </div>
      )}
    </div>
  );
}

// ── 실제 카카오 지도 ──
function RealMap({ companies, userRegion, onPinClick, selectedId, center: centerProp, onRequestLocation, gpsLoading }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const circleRef = useRef(null);
  const myMarkerRef = useRef(null);
  const overlaysRef = useRef([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // 중심은 부모가 제어(controlled). 자동 geolocation 없음 — GPS 정책 준수.
  const center = centerProp ?? SEOUL;

  // SDK 로드
  useEffect(() => {
    let alive = true;
    loadKakaoScript(KAKAO_API_KEY)
      .then(() => { if (alive) { setReady(true); mapLog("render: REAL Kakao map"); } })
      .catch((e) => { if (alive) { setLoadError(true); mapLog("render: MOCK map (SDK 실패:", e?.message, ")"); } });
    return () => { alive = false; };
  }, []);

  // 지도 1회 생성 (자동 위치요청 제거 — '현재 위치로 보기' 버튼에서만 GPS 요청)
  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;
    const { maps } = window.kakao;
    const c = new maps.LatLng(center.lat, center.lng);
    const map = new maps.Map(containerRef.current, { center: c, level: 6 });
    mapRef.current = map;
    // 줌 컨트롤 — 실제 카카오 지도임을 시각적으로 확인 가능
    try { map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT); } catch { /* SDK 버전 차이 무시 */ }

    myMarkerRef.current = new maps.Marker({
      map, position: c,
      image: new maps.MarkerImage(
        "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png",
        new maps.Size(24, 35)
      ),
    });
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

  if (loadError) return <MockMap companies={companies} userRegion={userRegion} onPinClick={onPinClick} selectedId={selectedId} onRequestLocation={onRequestLocation} gpsLoading={gpsLoading} />;

  return (
    <div style={{ position:"relative", borderRadius:R.xl, overflow:"hidden", height:250, border:`1px solid ${C.bgWarm}` }}>
      <div ref={containerRef} style={{ width:"100%", height:"100%" }} />
      {!ready && (
        <div style={{ position:"absolute", inset:0, background:C.bgWarm, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:C.text3 }}>
          지도 로딩 중...
        </div>
      )}
      {ready && companies.length === 0 && (
        <div style={{ position:"absolute", left:"50%", top:"62%", transform:"translate(-50%,-50%)",
          background:"rgba(255,255,255,0.92)", borderRadius:R.md, padding:"8px 16px",
          fontSize:12, color:C.text2, fontWeight:600, whiteSpace:"nowrap", pointerEvents:"none" }}>
          현재 등록된 업체를 준비 중입니다
        </div>
      )}
      {/* 활동지역 라벨 (좌상단) */}
      <div style={{ position:"absolute", top:10, left:12, background:"rgba(255,255,255,0.92)", borderRadius:R.full, padding:"4px 12px", fontSize:11, color:C.text2, fontWeight:700, pointerEvents:"none" }}>
        내 활동지역: {userRegion || "서울·경기·인천"} · 반경 3km
      </div>
      {/* 현재 위치로 보기 — 클릭 시에만 GPS 요청 (정책 준수) */}
      {onRequestLocation && (
        <button onClick={onRequestLocation} disabled={gpsLoading}
          style={{ position:"absolute", bottom:10, right:12, background:"rgba(255,255,255,0.95)", border:`1px solid ${C.bgWarm}`,
            borderRadius:R.full, padding:"7px 13px", fontSize:11, color:C.brand, fontWeight:800,
            cursor: gpsLoading ? "default" : "pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.12)", display:"flex", alignItems:"center", gap:4 }}>
          {gpsLoading ? "위치 확인 중..." : "📍 현재 위치로 보기"}
        </button>
      )}
    </div>
  );
}

export default function KakaoMap({ companies = [], userRegion = "", onPinClick, selectedId = null, center = null, onRequestLocation, gpsLoading = false }) {
  if (!KAKAO_API_KEY) {
    mapLog("render: MOCK map (no API key) — Vercel 환경변수 VITE_KAKAO_MAP_KEY 확인 필요");
    return <MockMap companies={companies} userRegion={userRegion} onPinClick={onPinClick} selectedId={selectedId} onRequestLocation={onRequestLocation} gpsLoading={gpsLoading} />;
  }
  return <RealMap companies={companies} userRegion={userRegion} onPinClick={onPinClick} selectedId={selectedId} center={center} onRequestLocation={onRequestLocation} gpsLoading={gpsLoading} />;
}
