# 공간마켓 출시 전 QA 체크리스트

> 출시(production) 배포 전 수동 점검용. 각 항목 통과 시 `[x]` 체크.
> 환경: production(Vercel) / 모바일 우선(PWA). 표시는 `[ ]` 미확인 · `[x]` 통과 · `[!]` 이슈.

마지막 갱신: 2026-05-31

---

## 1. 고객(의뢰인) 플로우
- [ ] 로그인 / 세션 유지 (새로고침·앱 재실행 후 유지)
- [ ] 견적 요청 작성 (공간 유형·평형·예산·스타일·설명)
- [ ] 이미지 업로드 (사진 첨부·미리보기·저장)
- [ ] 지역 선택 (RegionSelectSheet, 최대 2곳, 기본지역 지정)
- [ ] 입찰 확인 (업체 입찰 목록·견적 비교)
- [ ] 업체 선택 (계약 진행)
- [ ] 결제 / 에스크로 진입 (예치 금액·단계 안내)
- [ ] 단계 승인 (착공→중간→완료, 사진 확인 후 승인)
- [ ] 거래 완료 (정산 처리)
- [ ] 리뷰 작성 (별점·태그·내용 저장)

## 2. 업체 플로우
- [ ] 업체 온보딩 (사업자/보험 서류·서약·뱃지·예치)
- [ ] 업체 상태 ACTIVE 확인 (company_status)
- [ ] **영업지역 2곳 설정** (온보딩 + 마이페이지에서 수정, 기본 영업지역 지정)
- [ ] open 요청 확인 (지역/전문분야 매칭 목록)
- [ ] 입찰 제출 (금액·메시지·기간)
- [ ] 진행중 프로젝트 확인 (대시보드)
- [ ] 착공 사진 업로드
- [ ] 중간 / 완료 사진 업로드
- [ ] 승인 대기 상태 표시
- [ ] 완료 목록 / 통계 확인 (낙찰·후기·공간온도)

## 3. 관리자 플로우
- [ ] 업체 승인 / 보류 / 반려 (doc_status 변경)
- [ ] 신고 관리 (customer_reports / lounge_reports 처리)
- [ ] 리뷰 숨김 / 복구
- [ ] 정산 보류 / 승인 (escrow payout)
- [ ] admin_logs 기록 생성 확인
- [ ] notifications 생성 확인 (상태 변경 시 알림)

## 4. 지도 / 지역
- [ ] RegionSelectorBar 표시 (저장된 활동지역 탭 + "지역 추가")
- [ ] 지역 추가 / 삭제 / 기본지역 설정 동작
- [ ] **GPS 자동 요청 없음** (mount 시 geolocation / watchPosition 호출 없음)
- [ ] "현재 위치로 보기" 클릭 시에만 위치 요청
- [ ] fallback map(mock) 정상 동작 + 디버그 배지 표시 (env/sdk/mode/fallback_reason)
- [ ] Kakao real map — **PC에서 도메인 등록 후 재확인** (보류 항목)

### 4-1. 지역 매칭 우선순위 (유지 확인)
- [ ] 1차: 고객 `activity_regions` ∩ 업체 `service_regions` (tier=exact)
- [ ] 2차: legacy `region` text fallback (tier=legacy)
- [ ] 3차: 같은 시/도·인접 확장 (tier=city, isFallback)
- [ ] 4차: 전체 ACTIVE 업체 추천 (tier=all, isFallback)
- [ ] fallback 시 안내문구 "아직 이 지역 등록 업체가 적어, 전국 업체도 함께 보여드려요"
- [ ] fallback 시 추천 배지 / "내 지역만 보기" 버튼 / 전국 기준 표시 유지

## 5. 데이터 / 마이그레이션
- [ ] migration 010 + 011 적용 (`scripts/verify_010_region_multi.sql` 로 확인)
  - `users.activity_regions`, `users.default_activity_region_id`
  - `companies.service_regions`, `companies.default_service_region_id`
  - max-2 CHECK 제약 2건, GIN 인덱스 2건
- [ ] 미적용 상태에서도 legacy `region` text fallback 으로 앱 정상 동작
- [ ] 지역 저장 실패 시 앱 crash 없음 (console.warn + region text fallback)
- [ ] 기존 `region` / `mainRegion` 컬럼 보존(삭제되지 않음)

## 6. PWA / 브랜드
- [ ] 앱 아이콘 / favicon / splash = 01 공간·연결형
- [ ] manifest / apple-touch-icon 정상 로드
- [ ] Landing Hero 배경(내부 고정 asset) 정상 표시, 외부 이미지 의존 없음
- [ ] 오프라인/재방문 시 white-screen 없음 (service worker)

---

### 참고: 데이터 형태
```jsonc
// companies.service_regions (예시)
[
  { "id": "서울 강서구", "sido": "서울", "sigungu": "강서구", "label": "서울 강서구",
    "lat": 37.5509, "lng": 126.8495, "radiusKm": 3,
    "city": "서울", "district": "강서구", "is_primary": true },
  { "id": "인천 부평구", "sido": "인천", "sigungu": "부평구", "label": "인천 부평구",
    "lat": 37.5074, "lng": 126.7220, "radiusKm": 3,
    "city": "인천", "district": "부평구", "is_primary": false }
]
// companies.default_service_region_id = "서울 강서구"
```
> `id`/`label` 은 안정적 식별자(기본지역 매칭용), `city`/`district`/`is_primary` 는 매칭·지도 로직 호환용.
> PC 작업(Kakao Developers 도메인 등록 / 카카오 공유 디버거)은 보류 항목으로 별도 진행.
