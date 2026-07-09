# 공간라운지 Production Auto Publishing OS (Phase 17.5)

90점 이상의 검증된 콘텐츠를 관리자 없이 자동 발행하는 운영 시스템. 기존 엔진은
수정하지 않고(Additive) export 함수만 호출한다. **새 API/Cron/Migration 없음.**

## 위치
관리자 → 콘텐츠 → **자동발행** 탭 (신규).

## 자동발행이 동작하는 방식 (인프라 추가 없이)

게이트를 통과한 콘텐츠를 **3시간 슬롯에 "예약"**(긴급은 즉시 발행)하고, 실제 발행은
**기존 `publish-scheduled` 크론**이 수행한다. 즉 이 OS 는 "무엇을·언제 발행할지 결정"하고,
발행 실행은 이미 있는 인프라를 재사용한다 → 서버리스 함수 12개·크론 그대로.

- **긴급**: `adminUpdateLoungeDraft(publishStatus:'published')` 로 즉시 발행.
- **일반**: `adminUpdateLoungeDraft(publishStatus:'scheduled', scheduledAt: 슬롯)` → 기존 크론이 발행.

## 10개 구현 사항

| # | 기능 | 구현 |
|---|---|---|
| 1 | **Auto Publish Gate** | `autoPublishGate.js` — Quality≥90 · Confidence≥90 · 금칙어 · SEO · 중복(48h) · AI검사(구조/길이) · Review 상태. 모두 통과해야 발행 |
| 2 | **Publish Scheduler** | `nextSlots()` 3시간 슬롯(00,03,…21). 예약글 없으면 게이트 통과 Draft 중 최고점 자동 선택 |
| 3 | **Emergency Publish** | Priority High + Trend Score ≥95 → 예약 무시 즉시 발행(TrendDiscovery 재사용) |
| 4 | **Duplicate Guard** | 48h 내 유사 제목/키워드/토픽 발행 금지(`isDuplicateTopic` 재사용) |
| 5 | **Daily Limit** | 하루 최대 8개(긴급 제외). 실패는 한도에서 제외 |
| 6 | **Publish Log** | 발행시간·자동/수동/긴급·Reason·Quality·Confidence·Trend Score·Version·LLM·Category (localStorage) |
| 7 | **Failure Retry** | 실패 → 5분 후 재시도 → 3회 실패 시 관리자 알림(재시도 상태 localStorage) |
| 8 | **Safe Rollback** | 발행 직후 이상(금칙어) 감지 시 즉시 Draft 복귀(`revert`) |
| 9 | **Dashboard** | 오늘 발행·예약·긴급·평균점수·평균조회·실패·성공률·오늘 사용/한도 |
| 10 | **ON/OFF Switch** | 관리자 즉시 토글(localStorage). OFF 면 실행/예약 안 함 |

## 실행 모델

- 대시보드의 **▶ 지금 자동발행 실행** 이 한 사이클(게이트→긴급 즉시발행/일반 예약→로그)을 수행.
- 예약된 글은 이후 **기존 예약발행 크론**이 시각 도래 시 발행(관리자 없이).
- 재시도/롤백은 실행 사이클 내에서 처리하고 3회 실패 시 알림.

## Regression Zero

- **신규 2개**(`autoPublishGate.js`, `autoPublish.js`) + **변경 1개**(`AdminScreen.jsx` — 탭·컴포넌트 추가)
- 절대수정금지 대상 **diff 0**: PublishingOS(`publishingOs.js`)·Publishing Pipeline·Workbench·
  TrendDiscovery·CommunityEngine·SpaceGraph·LLM·CategoryVoice·ReadingExperience·contentUsefulness·
  duplicateChecker·SpaceMediaScreen·`api/`·`vercel.json` (전부 호출만)
- **Migration/API/Cron 추가 없음** · 서버리스 함수 **12개 불변** · 기존 발행/생성 기능 유지
- 발행/예약/롤백은 기존 `adminUpdateLoungeDraft` 재사용 → 스키마·API 무변경

## 운영 제안(로드맵)

1~2주 자동발행 품질·클릭률 모니터링 → 게이트/한도 조정 → 그다음 개인화 추천(Phase 18).
(향후 서버측 3시간 트리거가 필요하면 예약발행 크론 주기 조정을 별도 검토 — 배포 설정 변경 사안.)
