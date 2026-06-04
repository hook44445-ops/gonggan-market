// ─────────────────────────────────────────────────────────────────────────
// Kakao 역지오코딩 + GPS 1회 캡처 유틸 (체크포인트 전용)
//   · GPS 정책 준수: watchPosition / 백그라운드 추적 없음. 버튼 클릭 시 1회 getCurrentPosition.
//   · 좌표 → 도로명/지번 주소 변환은 kakao.maps.services.Geocoder.coord2Address 사용
//     (지도 SDK 와 동일한 VITE_KAKAO_MAP_KEY). SDK 미로드 시 1회 로드.
//   · 실패해도 앱 정상 동작 — 주소는 null 로 폴백(좌표만 저장).
// ─────────────────────────────────────────────────────────────────────────

const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_MAP_KEY?.trim();
const SDK_SRC = KAKAO_API_KEY
  ? `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_API_KEY)}&autoload=false&libraries=services`
  : null;

let sdkPromise = null;

function loadServices() {
  if (typeof window !== "undefined" && window.kakao?.maps?.services) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (!SDK_SRC) { reject(new Error("no-kakao-key")); return; }
    const finish = () => {
      if (window.kakao?.maps && typeof window.kakao.maps.load === "function") {
        window.kakao.maps.load(() => resolve());
      } else reject(new Error("kakao-undefined"));
    };
    // 이미 로드된 스크립트가 있으면 재사용
    const existing = document.querySelector('script[data-kakao-sdk="1"]');
    if (existing) { existing.addEventListener("load", finish); return; }
    const s = document.createElement("script");
    s.src = SDK_SRC;
    s.async = true;
    s.dataset.kakaoSdk = "1";
    s.onload = finish;
    s.onerror = () => reject(new Error("sdk-load-failed"));
    const timer = setTimeout(() => reject(new Error("sdk-timeout")), 8000);
    s.addEventListener("load", () => clearTimeout(timer), { once: true });
    document.head.appendChild(s);
  });
  return sdkPromise;
}

// 좌표 → 주소 세트. 실패 시 모든 주소 필드 null(좌표만 저장하도록 호출측에서 처리).
//   { road_address, jibun_address, address_full, sido, sigungu, dong, bunji }
export async function reverseGeocodeAddress(lat, lng) {
  const EMPTY = { road_address: null, jibun_address: null, address_full: null, sido: null, sigungu: null, dong: null, bunji: null };
  try {
    await loadServices();
    const services = window.kakao.maps.services;
    const geocoder = new services.Geocoder();
    return await new Promise((resolve) => {
      geocoder.coord2Address(lng, lat, (result, status) => {
        if (status === services.Status.OK && Array.isArray(result) && result.length) {
          const r = result[0];
          const a = r.address ?? null;          // 지번
          const road = r.road_address ?? null;  // 도로명
          const jibun = a?.address_name ?? null;
          const roadName = road?.address_name ?? null;
          const bunji = a?.main_address_no
            ? `${a.main_address_no}${a.sub_address_no ? "-" + a.sub_address_no : ""}`
            : null;
          resolve({
            road_address: roadName,
            jibun_address: jibun,
            address_full: jibun ?? roadName,           // 전체주소(지번 우선)
            sido: a?.region_1depth_name ?? road?.region_1depth_name ?? null,
            sigungu: a?.region_2depth_name ?? road?.region_2depth_name ?? null,
            dong: a?.region_3depth_name ?? road?.region_3depth_name ?? null,
            bunji,
          });
        } else {
          resolve({ ...EMPTY });
        }
      });
    });
  } catch {
    return { ...EMPTY };
  }
}

// 현재 위치 1회 캡처 → { lat, lng, accuracy } 또는 null(미지원/거부/실패).
export function getCurrentPositionOnce() {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? null }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 60000 }
    );
  });
}

// 체크포인트 1회 캡처: GPS + 역지오코딩 결합. 위치 거부/실패 시 null.
export async function captureCheckpointLocation() {
  const pos = await getCurrentPositionOnce();
  if (!pos) return null;
  const addr = await reverseGeocodeAddress(pos.lat, pos.lng);
  return { ...pos, ...addr };
}
