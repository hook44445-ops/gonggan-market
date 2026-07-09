# 공간라운지 AI 콘텐츠 공장 — Trend Pipeline (v1.1 Beta · Phase 2)

Phase 1(`docs/AI_CONTENT_FACTORY.md`)의 "①이슈 수집"을 수동 프리셋에서 **자동 수집 구조**로
확장한다. 이번 Phase 도 **자동 발행은 하지 않는다** — 파이프라인의 산출물은 항상
`lounge_posts.publish_status='draft'`(관리자 검수 대기)이다.

## 파이프라인

```
Trend Collect ──▶ Duplicate Check(48h) ──▶ Topic Score/Priority ──▶ Category Mapping ──▶ Draft Generate ──▶ DRAFT 저장
```

| 단계 | 파일 |
|---|---|
| Trend Collect | `src/constants/trendProviders.js`(Provider 정의) + `src/lib/trendCollector.js`(수집 orchestration) |
| Duplicate Check | `src/lib/duplicateChecker.js` — title/slug/topic 슬러그 비교, 48시간 윈도우 |
| Topic Score / Priority | `src/lib/topicScore.js` — 관련성·검색량·시의성·인테리어관련도·지역성 가중합 → breaking/high/medium/low |
| Category Mapping | `src/lib/categoryMapper.js` — 트렌드 힌트 우선, Phase1 `classifyCategory()` 폴백(원본 파일 무수정) |
| Draft Generate | Phase1 `src/constants/aiContentFactory.js` `generateDraft()` 재사용(신규 로직 없음) |
| 실행(스케줄러) | `api/trend/check-trends.js` — Vercel Cron 3시간마다(`vercel.json`) + 관리자 화면 수동 트리거 버튼 |
| 관리자 화면 | `AdminScreen.jsx` "AI 콘텐츠 공장" 탭 — **Trend Queue** 섹션(이슈/추천점수/우선순위/카테고리/생성일) 신설 |

## Provider 인터페이스 (Phase 2 = 구조만, Phase 3 = 실제 연결)

```js
// TrendItem = { providerId, topic, sourceUrl, collectedAt, raw }
{ id, label, kind, enabled, collect: () => Promise<TrendItem[]> }
```

| Provider | 상태(Phase 2) |
|---|---|
| Google Trends | `enabled:false` — Phase 3에서 API 연결 후 활성화 |
| 네이버 뉴스 | `enabled:false` |
| 다음 뉴스 | `enabled:false` |
| 날씨 | `enabled:false` |
| 정부 발표 | `enabled:false` |
| 수동 이슈 | `enabled:true` — 파이프라인이 끝까지 동작하도록 하는 Phase 2 유일한 실동작 소스(시드 이슈 목록) |

`enabled:false` Provider 는 `trendCollector`가 호출조차 하지 않는다(`status:'not_configured'`로만 표시). Phase 3 는 `collect()` 함수 내부를 실제 API 호출로 교체하고 `enabled:true`로 바꾸면 된다 — 다른 파일은 수정할 필요가 없다.

## 안전 규칙 (하드코딩)

`api/trend/check-trends.js`는 항상 `publish_status:'draft'`, `is_visible:false`로만
INSERT한다. 자동 발행 경로가 전혀 없다(코드에 published/scheduled 를 쓰는 분기 자체가
없음). 발행은 오직 관리자가 "AI 콘텐츠 공장" 탭에서 직접 승인해야 한다(Phase 1과 동일).

또한 한 번 실행에 최대 5건(`MAX_DRAFTS_PER_RUN`)까지만 생성해 무한 증식을 막는다.

## Migration 여부

없음. 신규 테이블/컬럼 없음 — Phase 1에서 추가한 `lounge_posts.publish_status`/
`scheduled_at`/`ai_topic`(migration 094)을 그대로 재사용한다. Topic Score/Priority/
Category 신뢰도는 **저장하지 않고** 관리자 화면에서 `ai_topic` 값으로 항상 다시
계산한다(결정론적 함수라 재계산 결과가 동일) — 이 방식으로 스키마 변경 없이
"Trend Queue" 요구사항(이슈/추천점수/카테고리/생성일)을 충족한다.

## 운영 정책 제안 (사용자 제안 반영, 향후 검토)

- 고정 SEO 콘텐츠: 카테고리별 하루 1개씩(총 10개) — Phase 1 수동 프리셋 흐름으로 지속 가능
- 실시간 트렌드/뉴스: 3시간마다 수집 + 초안 생성(이번 Phase 2)
- 관리자 승인 후 발행 — 자동 발행 여부는 Phase 3 이후 별도 검토 대상(이번 Phase 에서 도입하지 않음)

## Phase 3 (미착수)

- Google Trends / 네이버·다음 뉴스 / 날씨 / 정부 발표 API 실제 연결(`collect()` 내부 교체)
- 실제 LLM 연결(Claude/OpenAI) — Draft Generate 단계 교체
- 이미지 자동 생성
- 자동 발행 여부 재검토
- Topic Score 에 실제 검색량 반영(현재는 플레이스홀더 고정값)

## 수정 금지 원칙 준수

이번 Phase 2 는 신규 파일 7개(`src/lib/*.js` 4개, `src/constants/trendProviders.js`,
`api/trend/check-trends.js`, 본 문서) + 기존 파일 확장 2개(`AdminScreen.jsx`에 Trend
Queue 섹션 추가, `vercel.json`에 cron 1개 추가)로 구성된다. 고객/업체/관리자 기존
기능, GPS/증빙/계약/Escrow/리뷰, 기존 라운지(게시글/댓글/좋아요/스토리/채팅),
Seed 콘텐츠, Phase 1 AI 콘텐츠 공장의 기존 동작(초안 생성/검수/예약발행), 기존
Migration을 전혀 수정하지 않았다.
