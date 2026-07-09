# 공간라운지 Publishing OS — 콘텐츠 운영 파이프라인 (Phase 6)

> AI 가 글을 만들고, AI 가 연결하고, 사람이 반응하고, 관리자가 운영하고, 다시 AI 가
> 다음 기획으로 반영한다. Phase 6 의 핵심은 **콘텐츠 운영 자동화**다.

Phase 1~5 가 개별 엔진(콘텐츠 공장·편집국·Space Graph·Community·Space Media)을 만든 단계였다면,
Phase 6 는 그 엔진들을 **하나의 운영 파이프라인(Publishing OS)** 으로 연결한다. AI 가
기획 → 생성 → 검수 → 연결 → 발행 → 분석 → 재기획까지 관리하는 운영 콘솔이다.

## 최상위 철학 — Space is Everything

공간은 모든 것의 최상위 개념이며, 모든 콘텐츠는 공간 아래 존재하는 하위 콘텐츠다.

## 구현 (신규 엔진 4개 · UI 분리 · 결정론적 · 저장 없음)

| 작업지시서 | 구현 |
|---|---|
| 1. Publishing Pipeline | `publishingOs.js` `pipelineStages()` — 12단계 흐름 + 각 단계 수치 |
| 2. Draft Queue | `publishingOs.js` `buildDraftQueue()` — 품질/공간관련성/우선순위/관련글수/추천여부 |
| 3. Today's Dashboard | `publishingOs.js` `todaysDashboard()` — 오늘 생성/예정/인기/댓글/저장후보/Space/Pick/부족카테고리/추천슬롯 |
| 4. Publishing Calendar | `publishingOs.js` `publishingCalendar()` — 14일 예약 그리드 + 빈/과밀 경고 + 카테고리 분포 |
| 5. Category Health | `categoryHealth.js` — 카테고리별 글수/최근발행/반응/커뮤니티/evergreen + 상태(empty/stale/quiet/rising/healthy) |
| 6. Space Coverage | `spaceCoverage.js` — 18개 삶의 영역 커버리지 + 부족 영역 **추천만** |
| 7. Space Index | `spaceIndex.js` — 글별 통합 색인(영역·연결 카테고리·관련 글·후속·PC/Archive/Search 사용처) |

관리자 화면: `AdminScreen.jsx` "AI 콘텐츠 공장" 탭 → **🛰️ Publishing OS** 섹션.

## Publishing Pipeline (12단계)

```
오늘의 이슈 → AI Editor 편집회의 → 품질평가 → 재작성 루프 → Space Graph 연결 →
Community Score 예상 → Draft Queue → 예약발행 → Magazine 편성 → Archive 등록 →
Search Index → Encyclopedia 연결
```

각 단계는 기존 엔진을 재사용해 현재 수치를 표시한다 — 새 판단 로직을 만들지 않는다.

## Space Coverage — 추천만, 자동 생성 없음

"Space is Everything." 인테리어·집꾸미기·시공후기·견적고민·연애·MBTI·자격증·종교·경제·사회·
주식·AI·여행·맛집·건강·창업·반려동물·인도점성술 등 삶의 영역을 콘텐츠가 얼마나 커버하는지 센다.
라운지 카테고리가 있는 영역은 카테고리 id 로, 없는 개념 영역(MBTI·종교·인도점성술 등)은 제목/토픽
키워드로 매칭한다. **부족한 영역은 추천만 한다** — 자동 생성/자동 카테고리 생성은 하지 않는다.

## Space Index — 통합 데이터 레이어

각 글을 (1) 공간 영역 (2) 연결 카테고리 (3) 관련 글 id (4) 후속 글 필요 (5) PC/Archive/Search
사용처로 색인한다. Publishing OS 의 최종 산출물이자, 향후 PC 버전(Magazine/Archive/Search/
Knowledge)이 그대로 읽어 쓰는 통합 레이어다.

## Migration 여부: 없음

신규 테이블/컬럼 없음. 파이프라인·큐·대시보드·캘린더·건강·커버리지·색인은 **저장하지 않고**
기존 데이터(`lounge_posts`)로 관리자 화면에서 항상 재계산한다(결정론적 순수 함수).

## 이번 Phase 에서 하지 않은 것 (작업지시서 준수)

실제 PC 버전 제작 · 라운지 홈/글 상세 전면 개편 · 자동 무제한 발행 · 새 카테고리 자동 생성 ·
외부 LLM 실연동 · 결제/계약/GPS/업체 기능 수정. **모든 발행 결정은 여전히 관리자 승인**을 거친다.

## 수정 금지 원칙 준수 (Regression Zero · Additive)

신규 파일 5개(`publishingOs.js`, `categoryHealth.js`, `spaceCoverage.js`, `spaceIndex.js`, 본 문서)
+ 기존 파일 확장 1개(`AdminScreen.jsx` 에 Publishing OS 섹션 추가). 로그인·회원가입·견적·입찰·
계약·GPS·증빙·리뷰·에스크로·정산·관리자 기본·기존 라운지(게시글/댓글/좋아요/스토리/대화)·
AI 공장·Editor·Space Graph·Community Engine·Space Media 로직을 전혀 수정하지 않았다.

## Phase 7 (미착수)

- 추천 발행 슬롯 → 예약발행 원클릭 연결(현재는 추천 표시까지)
- Space Index 를 실제 PC Magazine/Archive/Search 화면에 연결
- 외부 LLM 실연동(기획·생성·자기평가·재작성)
- 발행 성과 학습 → 다음 기획 자동 반영(재기획 루프 완성)
