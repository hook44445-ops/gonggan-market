import { useState, useCallback } from "react";

// ─────────────────────────────────────────────────────
// GPS 정책 — 엄격 준수 (베타: 지도=현재위치 우선)
//   ❌ 자동 권한요청(프롬프트) 금지 — 권한이 'prompt'/'denied' 면 아무것도 안 함
//   ❌ watchPosition / 백그라운드 추적 금지
//   ✅ requestCurrentLocation() (버튼 클릭) 시 1회 요청 (필요 시 프롬프트)
//   ✅ autoLocateIfGranted() (진입 시) — 권한이 '이미 허용(granted)' 인 경우에만
//      프롬프트 없이 1회 조회해 현재 위치를 지도에 표시. 미허용이면 no-op.
//   ✅ 권한 거부 시 앱 정상 동작 — 호출측은 활동지역/서울시청 fallback 유지
//   ✅ 위치값은 지도 중심 표시 용도로만 사용(저장 안 함 — 체크포인트 저장과 무관)
// ─────────────────────────────────────────────────────

export function useGPS() {
  const [gpsCenter, setGpsCenter] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  // 'unsupported' | 'denied' | 'unavailable' | null — 호출측 안내문구 분기용
  const [gpsErrorCode, setGpsErrorCode] = useState(null);
  // 동일 좌표가 다시 와도 호출측 effect 가 감지하도록 매 응답마다 증가
  const [gpsTick, setGpsTick] = useState(0);
  const [loading, setLoading] = useState(false);

  const requestCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("이 기기에서는 위치 서비스를 지원하지 않습니다.");
      setGpsErrorCode("unsupported");
      setGpsTick((t) => t + 1);
      return;
    }
    setLoading(true);
    setGpsError(null);
    setGpsErrorCode(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCenter({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGpsTick((t) => t + 1);
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        if (error?.code === error?.PERMISSION_DENIED) {
          setGpsError("위치 권한이 거부되었습니다. 설정에서 허용 후 다시 시도하세요.");
          setGpsErrorCode("denied");
        } else {
          setGpsError("현재 위치를 가져올 수 없습니다.");
          setGpsErrorCode("unavailable");
        }
        setGpsTick((t) => t + 1);
        // 권한 거부여도 앱은 정상 동작 — 중심은 호출측 fallback 유지
      },
      { timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  // 진입 시 현재 위치 표시 — 단, 권한이 '이미 허용(granted)' 일 때만 프롬프트 없이 1회 조회.
  // 권한이 'prompt'(미결정)/'denied' 이거나 Permissions API 미지원이면 아무것도 하지 않는다
  // (자동 권한요청 금지 정책 유지). 호출측은 fallback(활동지역/서울시청)을 그대로 쓴다.
  const autoLocateIfGranted = useCallback(() => {
    if (!navigator.geolocation || !navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((res) => { if (res.state === "granted") requestCurrentLocation(); })
      .catch(() => {});
  }, [requestCurrentLocation]);

  // 외부에서 GPS 중심을 비울 수 있도록 (예: 저장 지역 탭 클릭 시)
  const clearGps = useCallback(() => { setGpsCenter(null); setGpsError(null); setGpsErrorCode(null); }, []);

  return { gpsCenter, gpsError, gpsErrorCode, gpsTick, loading, requestCurrentLocation, autoLocateIfGranted, clearGps };
}
