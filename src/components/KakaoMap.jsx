import { useEffect, useRef, useState } from "react";
import { C, R, GRADE } from "../constants";
import { SHOW_DEBUG_UI } from "../constants/release";

const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_MAP_KEY;

// 환경변수 요약 문자열 (DebugBadge 표시용)
const ENV_INFO = KAKAO_API_KEY
  ? `present(len=${String(KAKAO_API_KEY).length},prefix=${String(KAKAO_API_KEY).slice(0, 4)}...)`
  : "MISSING";

// ── 진단 로그 — 개발 환경에서만 출력 (production 에서는 no-op) ──
function mapLog(...args) {
  if (!SHOW_DEBUG_UI) return;
  // eslint-disable-next-line no-console
  console.log("[KakaoMap]", ...args);
}

// 모듈 초기화 시 1회 — 키 앞 4자리 출력(디버그용, 보안상 나머지 마스킹)
mapLog(
  "INIT — VITE_KAKAO_MAP_KEY:",
  KAKAO_API_KEY
    ? `present (len=${String(KAKAO_API_KEY).length}, prefix=${String(KAKAO_API_KEY).slice(0, 4)}...)`
    : "⛔ MISSING → mock fallback immediately. Vercel env 'VITE_KAKAO_MAP_KEY' 설정 확인 후 재배포 필요."
);
mapLog("INIT — window.kakao at module load:", typeof window !== "undefined" ? !!window.kakao : "N/A");

// 서울시청 — geolocation 실패 시 fallback 중심
const SEOUL = { lat: 37.5665, lng: 126.9780 };
const RADIUS_M = 3000; // 반경 3km
const SDK_TIMEOUT_MS = 3000; // SDK 로드 타임아웃 → 초과 시 fallback UI

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

// SDK script src — 명시적 https (protocol-relative '//' 는 일부 webview/CSP에서 차단됨)
const SDK_SRC = KAKAO_API_KEY
  ? `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_API_KEY}&autoload=false`
  : "";
// debug 표시용 — appkey 마스킹한 src
const SDK_SRC_MASKED = KAKAO_API_KEY
  ? `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${String(KAKAO_API_KEY).slice(0, 4)}...&autoload=false`
  : "(no key)";

// ── 온스크린 진단 배지 — 모바일 콘솔 대체 ──
function DebugBadge({ env, sdk, windowKakao, kakaoMaps, mode, reason, src, inserted, online }) {
  return (
    <div style={{
      position: "absolute", top: 6, left: 6, right: 6,
      background: "rgba(0,0,0,0.88)", color: "#4AFF91",
      borderRadius: 8, padding: "8px 12px", fontSize: 10,
      fontFamily: "monospace", lineHeight: 1.8, zIndex: 200, pointerEvents: "none",
      wordBreak: "break-all",
    }}>
      <div style={{ color: "#FFD700", fontWeight: 700 }}>[KakaoMap Debug]</div>
      <div>env: {env}</div>
      <div>sdk: {sdk}</div>
      <div>window.kakao: {String(windowKakao)}</div>
      <div>kakao.maps: {String(kakaoMaps)}</div>
      <div>mode: {mode}</div>
      {typeof inserted !== "undefined" && <div>script_inserted: {String(inserted)}</div>}
      {typeof online !== "undefined" && <div>navigator.online: {String(online)}</div>}
      {src && <div style={{ color: "#9AD0FF" }}>src: {src}</div>}
      {reason && <div style={{ color: "#FF6B6B" }}>fallback_reason: {reason}</div>}
    </div>
  );
}

function loadKakaoScript(apiKey) {
  return new Promise((resolve, reject) => {
    // STEP 1 — key guard
    if (!apiKey) {
      mapLog("STEP1 FAIL: apiKey is empty/undefined → mock fallback");
      reject(new Error("no-api-key")); return;
    }
    mapLog("STEP1 OK: apiKey present");

    // STEP 2 — already loaded?
    if (window.kakao?.maps) {
      mapLog("STEP2 OK: window.kakao.maps already present — resolving immediately ✅");
      resolve(); return;
    }
    mapLog("STEP2: window.kakao.maps not yet present — will load SDK");

    // 타임아웃 — maps.load() 콜백이 끝내 안 오면 fallback
    // (도메인 미등록/잘못된 키일 때 onerror 없이 콜백만 안 옴)
    let settled = false;
    const done = (fn, arg) => { if (settled) return; settled = true; clearTimeout(timer); fn(arg); };
    const timer = setTimeout(() => {
      mapLog(`TIMEOUT: maps.load() callback never fired within ${SDK_TIMEOUT_MS}ms.`,
        "원인 후보: ① Kakao Developers 도메인 미등록",
        "② 잘못된 appkey",
        "③ 네트워크 차단 (CSP / ad-blocker)",
        "→ mock fallback 사용");
      done(reject, new Error("sdk-timeout"));
    }, SDK_TIMEOUT_MS);

    const finishOk = () => {
      mapLog("STEP3: script onload fired — window.kakao:", !!window.kakao,
        "| window.kakao.maps:", !!window.kakao?.maps,
        "| typeof maps.load:", typeof window.kakao?.maps?.load);

      if (window.kakao?.maps && typeof window.kakao.maps.load === "function") {
        mapLog("STEP4: calling window.kakao.maps.load() — waiting for auth callback...");
        window.kakao.maps.load(() => {
          mapLog("STEP5 ✅ maps.load() callback FIRED — SDK fully ready. Real Kakao map will render.");
          done(resolve);
        });
      } else if (window.kakao && !window.kakao?.maps) {
        mapLog("STEP3 FAIL: window.kakao exists but window.kakao.maps is undefined — appkey invalid or SDK version issue");
        done(reject, new Error("kakao-maps-undefined"));
      } else {
        mapLog("STEP3 FAIL: window.kakao missing after script load");
        done(reject, new Error("kakao-undefined"));
      }
    };

    // onerror 상세 reason 생성 — script src / 네트워크 / blocked 여부
    const errorReason = (label) => {
      const online = typeof navigator !== "undefined" ? navigator.onLine : "n/a";
      return `${label} (online=${online})`;
    };

    // 이미 삽입된 script 태그가 있는 경우
    const existing = document.getElementById("kakao-map-sdk");
    if (existing) {
      mapLog("STEP2b: SDK script tag already in DOM — polling for window.kakao.maps");
      existing.addEventListener("load", finishOk);
      existing.addEventListener("error", () => {
        mapLog("STEP2b FAIL: existing script onerror");
        done(reject, new Error(errorReason("sdk-load-error[existing]")));
      });
      const poll = setInterval(() => {
        if (settled) { clearInterval(poll); return; }
        if (window.kakao?.maps) { clearInterval(poll); mapLog("STEP2b poll: window.kakao.maps appeared"); finishOk(); }
      }, 200);
      return;
    }

    // 신규 script 삽입 — 명시적 https (protocol-relative '//' 차단 회피)
    mapLog("STEP2c: injecting new SDK script tag, src:", SDK_SRC_MASKED);
    const s = document.createElement("script");
    s.id = "kakao-map-sdk";
    s.async = true;
    s.src = SDK_SRC;
    // NOTE: crossOrigin 미설정 — dapi.kakao.com CDN 이 CORS 헤더를 보장하지 않아
    // 'anonymous' 설정 시 오히려 로드가 실패할 수 있음.
    s.onload = finishOk;
    s.onerror = (ev) => {
      // ev.type / blocked 여부 — 콘솔 없이 badge 로 전달
      const t = ev?.type || "error";
      mapLog("STEP3 FAIL: SDK script onerror — type:", t,
        "| src:", SDK_SRC_MASKED,
        "| navigator.onLine:", typeof navigator !== "undefined" ? navigator.onLine : "n/a",
        "→ 네트워크 오류/차단(CSP·adblock·webview) 또는 dapi.kakao.com 도달 실패. 도메인 등록 확인.");
      done(reject, new Error(errorReason(`sdk-load-error[onerror:${t}]`)));
    };
    document.head.appendChild(s);
    mapLog("STEP2c: script appended to <head> — DOM inserted ✅");
  });
}

// ── Mock fallback (API 키 없거나 SDK 로드 실패 시) ──
function MockMap({ companies, userRegion, onPinClick, selectedId, onRequestLocation, gpsLoading, debugInfo, loadFailed }) {
  const positioned = withCoords(companies, SEOUL).slice(0, 6);
  const empty = companies.length === 0;
  return (
    <div style={{ position:"relative", background:"linear-gradient(145deg,#E4EBE0,#D4E2CC,#DCE8D0)",
      borderRadius:R.xl, height:250, overflow:"hidden", border:"1px solid #C4D8BC" }}>
      {SHOW_DEBUG_UI && debugInfo && <DebugBadge {...debugInfo} />}
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
      {/* 카카오맵 SDK 로드 실패/타임아웃 시 사용자 안내 + 새로고침 */}
      {loadFailed && (
        <div style={{ position:"absolute", inset:0, zIndex:60, background:"rgba(245,241,234,0.96)",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
          gap:8, textAlign:"center", padding:20 }}>
          <div style={{ fontSize:30 }}>📍</div>
          <div style={{ fontSize:14, fontWeight:800, color:C.text1 }}>지도를 불러오지 못했어요</div>
          <div style={{ fontSize:12, color:C.text3 }}>잠시 후 새로고침 해주세요</div>
          <button onClick={() => window.location.reload()}
            style={{ marginTop:6, padding:"8px 20px", borderRadius:R.full, border:"none",
              background:C.brand, color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer" }}>
            새로고침
          </button>
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
  const [sdkInfo, setSdkInfo] = useState({ sdk: "loading", windowKakao: false, kakaoMaps: false, reason: null, inserted: false, online: typeof navigator !== "undefined" ? navigator.onLine : undefined });
  // 중심은 부모가 제어(controlled). 자동 geolocation 없음 — GPS 정책 준수.
  const center = centerProp ?? SEOUL;

  // SDK 로드
  useEffect(() => {
    let alive = true;
    const scriptInserted = () => !!document.getElementById("kakao-map-sdk");
    loadKakaoScript(KAKAO_API_KEY)
      .then(() => {
        if (alive) {
          setReady(true);
          setSdkInfo({
            sdk: "loaded", windowKakao: !!window.kakao, kakaoMaps: !!window.kakao?.maps, reason: null,
            inserted: scriptInserted(), online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
          });
          mapLog("render: REAL Kakao map");
        }
      })
      .catch((e) => {
        if (alive) {
          setLoadError(true);
          setSdkInfo({
            sdk: e?.message?.startsWith("sdk-timeout") ? "timeout" : "failed",
            windowKakao: !!window.kakao,
            kakaoMaps: !!window.kakao?.maps,
            reason: e?.message ?? "unknown",
            inserted: scriptInserted(),
            online: typeof navigator !== "undefined" ? navigator.onLine : undefined,
          });
          mapLog("render: MOCK map (SDK 실패:", e?.message, ")");
        }
      });
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

  if (loadError) return (
    <MockMap
      companies={companies} userRegion={userRegion} onPinClick={onPinClick} selectedId={selectedId}
      onRequestLocation={onRequestLocation} gpsLoading={gpsLoading}
      loadFailed={!!KAKAO_API_KEY}
      debugInfo={{ env: ENV_INFO, sdk: sdkInfo.sdk, windowKakao: sdkInfo.windowKakao, kakaoMaps: sdkInfo.kakaoMaps, mode: "fallback", reason: sdkInfo.reason, src: SDK_SRC_MASKED, inserted: sdkInfo.inserted, online: sdkInfo.online }}
    />
  );

  return (
    <div style={{ position:"relative", borderRadius:R.xl, overflow:"hidden", height:250, border:`1px solid ${C.bgWarm}` }}>
      {SHOW_DEBUG_UI && (
      <DebugBadge
        env={ENV_INFO}
        sdk={sdkInfo.sdk}
        windowKakao={sdkInfo.windowKakao}
        kakaoMaps={sdkInfo.kakaoMaps}
        mode={ready ? "real" : "loading"}
        reason={sdkInfo.reason}
        src={SDK_SRC_MASKED}
        inserted={sdkInfo.inserted}
        online={sdkInfo.online}
      />
      )}
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
      <div style={{ position:"absolute", bottom:38, left:12, background:"rgba(255,255,255,0.92)", borderRadius:R.full, padding:"4px 12px", fontSize:11, color:C.text2, fontWeight:700, pointerEvents:"none" }}>
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
    mapLog("RENDER: MOCK map — VITE_KAKAO_MAP_KEY absent in this build bundle. Vercel 환경변수 설정 후 재배포 필요.");
    return (
      <MockMap
        companies={companies} userRegion={userRegion} onPinClick={onPinClick} selectedId={selectedId}
        onRequestLocation={onRequestLocation} gpsLoading={gpsLoading}
        debugInfo={{ env: ENV_INFO, sdk: "n/a", windowKakao: !!window.kakao, kakaoMaps: !!window.kakao?.maps, mode: "fallback", reason: "no-api-key" }}
      />
    );
  }
  mapLog("RENDER: attempting RealMap (key present)");
  return <RealMap companies={companies} userRegion={userRegion} onPinClick={onPinClick} selectedId={selectedId} center={center} onRequestLocation={onRequestLocation} gpsLoading={gpsLoading} />;
}
