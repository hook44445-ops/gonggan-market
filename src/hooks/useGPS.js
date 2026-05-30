import { useState, useCallback } from "react";

// ─────────────────────────────────────────────────────
// GPS 정책 — 엄격 준수
//   ❌ 앱/지도 진입 시 자동 위치 권한 요청 금지
//   ❌ watchPosition / 백그라운드 추적 금지
//   ✅ requestCurrentLocation() (버튼 클릭) 시에만 1회 요청
//   ✅ 권한 거부 시 앱 정상 동작 — 호출측은 fallback 중심 유지
//   ✅ 위치값은 지도 중심 이동 용도로만 사용
// ─────────────────────────────────────────────────────

export function useGPS() {
  const [gpsCenter, setGpsCenter] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [loading, setLoading] = useState(false);

  const requestCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("이 기기에서는 위치 서비스를 지원하지 않습니다.");
      return;
    }
    setLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        if (error?.code === error?.PERMISSION_DENIED) {
          setGpsError("위치 권한이 거부되었습니다. 설정에서 허용 후 다시 시도하세요.");
        } else {
          setGpsError("현재 위치를 가져올 수 없습니다.");
        }
        // 권한 거부여도 앱은 정상 동작 — 중심은 호출측 fallback 유지
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  // 외부에서 GPS 중심을 비울 수 있도록 (예: 저장 지역 탭 클릭 시)
  const clearGps = useCallback(() => { setGpsCenter(null); setGpsError(null); }, []);

  return { gpsCenter, gpsError, loading, requestCurrentLocation, clearGps };
}
