# 공간라운지 AI Publishing Pipeline (Phase 13)

생성 엔진은 수정하지 않는다. 생성된 초안을 실제 운영 가능한 콘텐츠로 관리·발행하는
**AI 생성 → 검토 → 승인 → 발행 → 추천** 흐름을 완성한다.

## 위치
관리자 → 콘텐츠 → **발행 파이프라인** 탭 (`publishing_pipeline`).

## 구성

| # | 기능 | 내용 |
|---|---|---|
| 1 | 초안 관리 | 제목·카테고리·생성시간·Prompt Version·LLM/Mock·Confidence·상태 |
| 2 | 승인 프로세스 | **Draft → Review → Approved → Published** + 검토/승인/발행/삭제 버튼 |
| 3 | 발행 예약 | datetime 예약 → 기존 예약발행 크론이 시각 도래 시 Published |
| 4 | 발행 히스토리 | 발행일·조회·좋아요·저장·카테고리 |
| 5 | 인기 콘텐츠 | Editor's Pick·상승·인기·추천 자동 계산 |
| 6 | Today's Pick | Quality·Confidence·조회·저장 종합 1개 자동 선정 |
| 7 | 운영 통계 | Draft/Published 수·오늘 생성/발행·카테고리별·평균 Confidence·평균 Reading Time |

## Regression Zero — DB/API/Cron 없이 동작하는 원리

- **상태 저장**: DB `publish_status` 는 draft/scheduled/published 만 안다. 추가 운영 상태
  **Review/Approved** 는 `localStorage`(파이프라인 스토어)에 얹는다 — DB 스키마 변경(Migration) 없음.
- **발행/예약**: 기존 `adminUpdateLoungeDraft`(published/scheduled)와 기존 `publish-scheduled`
  **크론을 그대로 재사용**한다 — 새 API/크론 없음. (자동 발행 없음 — 관리자 조작으로만 발행)
- **Confidence/PromptVersion/LLM·Mock**: Phase 11 워크벤치가 `localStorage` 에 저장한 기록을
  제목으로 매칭해 표시한다(신규 저장 없음, 읽기만).
- **인기/추천/통계**: 기존 엔진(`communityScore`·`spaceGraph`·`readingExperience`)을 **호출만** 한다.

## 수정 금지 준수

- **신규 1개**(`src/lib/publishingPipeline.js`) + **변경 1개**(`src/screens/AdminScreen.jsx` — 탭 1개·컴포넌트 1개 추가)
- 절대수정금지 대상 **diff 0**: Category Voice(`categoryVoice`)·Raw Knowledge·LLM Client·LLM
  Generator·**AI Editor Workbench**·Prompt Version·Quality Panel·SpaceGraph·CommunityEngine·
  ReadingExperience·**PublishingOS Core**(`publishingOs.js`)·SpaceMediaScreen·`api/`·`vercel.json`
- DB Migration/API/Cron **없음** · 서버리스 함수 **12개 불변** · 크론 불변
- 기존 생성 품질·Prompt **무변경**

## 완료 조건 대비

Draft→Review→Approved→Published 흐름 ✅ · 예약 발행 ✅(기존 크론) · 발행 이력 ✅ ·
운영 통계 ✅ · 인기 콘텐츠 계산 ✅ · Today's Pick 자동 선정 ✅ · Regression Zero ✅.

## 다음 단계(제안)

- 발행 시각 컬럼(published_at) 도입 시 히스토리 정확도 향상(현재는 created_at 근사)
- 워크벤치 기록의 draft-id 연동(현재 제목 매칭) — 더 정확한 Confidence 연결
