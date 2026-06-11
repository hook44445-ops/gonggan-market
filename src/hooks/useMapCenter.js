import { useMemo } from "react";
import {
  FALLBACK_CENTER,
  regionCenter,
  getActivityRegions,
  getPrimaryRegion,
} from "../constants/regions";

// ─────────────────────────────────────────────────────
// 지도 중심 좌표 결정 우선순위 (베타 정책: 지역=매칭용 / 지도=현재위치)
//   1) GPS 현재 위치 (gpsCenter) — 최우선. 지역 선택은 매칭 기준일 뿐 지도를 강제 이동시키지 않는다.
//   2) GPS 거부/실패 → 사용자가 선택한 활성 지역 탭 (activeRegion)
//   3) 저장된 활동지역의 기본(primary) 지역
//   4) 견적 요청에 입력된 시공 지역 (quoteRegion)
//   5) 활동지역 미설정 → 서울시청 fallback
//
// 순수 함수(resolveMapCenter) + 메모이즈 훅(useMapCenter) 둘 다 제공.
// GPS 는 (a) 진입 시 권한이 이미 허용된 경우 1회, (b) "현재 위치로 보기" 버튼 클릭 시 채워진다.
// 자동 권한요청(프롬프트)·상시 추적은 하지 않는다(useGPS).
// ─────────────────────────────────────────────────────

export function resolveMapCenter({ user, activeRegion, gpsCenter, quoteRegion } = {}) {
  // 1) GPS 현재 위치 (최우선) — 지역 선택이 지도를 강서구 등으로 강제 이동시키던 문제 해소.
  if (gpsCenter && typeof gpsCenter.lat === "number" && typeof gpsCenter.lng === "number") {
    return gpsCenter;
  }

  // 2) GPS 거부/실패 → 사용자가 선택한 활성 지역 탭
  if (activeRegion?.city) return regionCenter(activeRegion.city, activeRegion.district);

  // 3) 저장된 활동지역의 기본 지역
  const primary = getPrimaryRegion(getActivityRegions(user));
  if (primary?.city) return regionCenter(primary.city, primary.district);

  // 4) 견적 요청 지역
  if (quoteRegion?.city) return regionCenter(quoteRegion.city, quoteRegion.district);

  // 5) 활동지역 미설정 → 서울시청 fallback
  return FALLBACK_CENTER;
}

export function useMapCenter({ user, activeRegion, gpsCenter, quoteRegion } = {}) {
  return useMemo(
    () => resolveMapCenter({ user, activeRegion, gpsCenter, quoteRegion }),
    [user, activeRegion, gpsCenter, quoteRegion]
  );
}
