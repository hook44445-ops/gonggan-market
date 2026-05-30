import { useMemo } from "react";
import {
  FALLBACK_CENTER,
  regionCenter,
  getActivityRegions,
  getPrimaryRegion,
} from "../constants/regions";

// ─────────────────────────────────────────────────────
// 지도 중심 좌표 결정 우선순위
//   1) 사용자가 지도에서 선택한 활성 지역 탭 (activeRegion)
//   2) "현재 위치로 보기" 버튼으로 받은 GPS (gpsCenter)
//   3) 저장된 활동지역의 기본(primary) 지역
//   4) 견적 요청에 입력된 시공 지역 (quoteRegion)
//   5) 서울시청 fallback
//
// 순수 함수(resolveMapCenter) + 메모이즈 훅(useMapCenter) 둘 다 제공.
// GPS 는 버튼 클릭 시에만 채워지므로(useGPS), 자동 위치요청은 없다.
// ─────────────────────────────────────────────────────

export function resolveMapCenter({ user, activeRegion, gpsCenter, quoteRegion } = {}) {
  // 1) 사용자가 선택한 활성 지역 탭
  if (activeRegion?.city) return regionCenter(activeRegion.city, activeRegion.district);

  // 2) 버튼으로 받은 현재 위치
  if (gpsCenter && typeof gpsCenter.lat === "number" && typeof gpsCenter.lng === "number") {
    return gpsCenter;
  }

  // 3) 저장된 활동지역의 기본 지역
  const primary = getPrimaryRegion(getActivityRegions(user));
  if (primary?.city) return regionCenter(primary.city, primary.district);

  // 4) 견적 요청 지역
  if (quoteRegion?.city) return regionCenter(quoteRegion.city, quoteRegion.district);

  // 5) fallback
  return FALLBACK_CENTER;
}

export function useMapCenter({ user, activeRegion, gpsCenter, quoteRegion } = {}) {
  return useMemo(
    () => resolveMapCenter({ user, activeRegion, gpsCenter, quoteRegion }),
    [user, activeRegion, gpsCenter, quoteRegion]
  );
}
