# 공간라운지 Community Engine — 살아있는 공간 (Phase 4)

> "AI 가 글을 만들고, 사람이 반응하고, 그 반응이 다시 AI 의 다음 기획으로 돌아간다."
> 이 순환이 만들어지면 공간라운지는 단순 콘텐츠 플랫폼이 아니라 살아있는 공간 커뮤니티가 된다.

Phase 1(콘텐츠 공장)·2(편집국)·3(Space Graph)이 "AI 가 글을 만들고 연결하는" 단계였다면,
Phase 4 는 **사용자 참여·댓글·저장·반응이 쌓이고, 그 신호가 다시 AI 의 기획으로 돌아가는**
살아있는 커뮤니티 엔진을 만든다.

이번 Phase 는 **기존 라운지 화면을 바꾸지 않는다.** 새 기능을 무리하게 노출하는 것이 아니라
참여 데이터 엔진 + 관리자 시각화를 만드는 것이 목표다.

## 최상위 철학 — Space is Everything

공간은 모든 것의 상위 개념이고, 모든 콘텐츠는 공간 아래 존재한다. 공간라운지는 단순
게시판이 아니라 글과 사진으로 세상을 기록하는 공간 기반 콘텐츠 플랫폼이다.

## 구현 (신규 엔진 5개 · UI 분리 · 결정론적 · 저장 없음)

| 작업지시서 기능 | 구현 |
|---|---|
| 4-1 User Signal Engine | `src/lib/userSignals.js` — `extractSignals()` 조회·좋아요·댓글·저장·공유·신고·숨김·나이 정규화 |
| 4-2 Community Score | `src/lib/communityScore.js` — `communityScore()` = engagement/discussion/trust + evergreen |
| 4-3 Today's Living Space | `communityScore.js` `todaysLivingSpace()` — 최근성 + 커뮤니티 점수(+Graph 허브) |
| 4-4 Comment Insight Engine | `src/lib/commentInsight.js` — `classifyComment()`(질문/후기/논쟁) + `commentInsightByPost()` |
| 4-5 Follow-up Recommendation | `src/lib/followupRecommender.js` — 질문→Q&A · 저장→심화 · 조회↑반응↓→개선 · 상승 카테고리→추가 |
| 4-6 Save/Bookmark Intelligence | `userSignals.js` `saveSignal()` — 저장 데이터 있으면 사용, 없으면 프록시(구조만 · 새 UI 없음) |
| 4-7 Community Temperature | `src/lib/communityTemperature.js` — `communityTemperature()` 온도·상승/조용 카테고리 |
| 4-8 Admin Visualization | `AdminScreen.jsx` "AI 콘텐츠 공장" 탭 → 🌡️ Community Engine 섹션(additive) |

## 점수 정의

- **engagementScore** — 조회 대비 반응률(좋아요·댓글·저장·공유). 조회만 많고 반응 없는 글을 걸러낸다.
- **discussionScore** — 댓글 중심. 댓글이 붙어 토론이 일어나는 정도.
- **trustScore** — 신고/숨김이 적을수록 높다(숨김은 강한 감점).
- **communityScore** — 위를 종합한 총점(0~100).
- **evergreen** — 7일 이상 지났는데도 저장·반응이 살아있는 "오래 읽히는 글"(Deep/아카이브 후보).

로그 스케일로 소수 대박글이 척도를 지배하지 않게 완충한다.

## Comment Insight — 댓글은 콘텐츠 개선 신호

댓글을 단순 "수"가 아니라 신호로 읽는다. "이거 비용 얼마예요?"가 많으면 AI 가 "비용 정리 글"을
후속 콘텐츠로 추천한다. 분류(키워드 휴리스틱, 우선순위 dispute > question > review > general):

- **question** — 후속 Q&A/정리 글 신호
- **review** — 경험 공유(신뢰) 신호
- **dispute** — 관리자 주의 + 균형 잡힌 후속 글 신호(`needsAttention`)

관리자 화면에서 **"💬 댓글 인사이트 분석"** 버튼을 눌렀을 때만 최근 댓글(`adminGetLoungeComments`,
기존 함수 재사용)을 온디맨드로 불러와 계산한다 — **기본 로드 경로는 무변경**(Regression Zero).

## Community Temperature — 공간 온도

라운지 전체 활성도를 체온(36.5°) 기준 온도로 요약한다. 최근 활동(글·댓글·반응)에 따라 오르고,
신고/숨김 비율이 냉각 요인이다(30~42° 클램프). 함께 반환:
- **activeCategories** — 오늘 활발한 카테고리
- **risingTopics** — 반응이 오르는 카테고리(후속 생성 추천의 입력)
- **quietCategories** — 조용한 카테고리(콘텐츠 보강 필요)

## PC Version 고려 (구조 준비)

모든 엔진은 UI 와 분리된 순수 함수다. 향후 PC 버전의
Magazine / Archive / Knowledge / Search / Today's Space / Editor's Pick / Related / **Community Insight**
화면이 이 함수들을 그대로 호출해 구성할 수 있다(모바일과 로직 공유).

## Migration 여부: 없음

신규 테이블/컬럼 없음. 커뮤니티 점수·온도·인사이트·후속 추천은 **저장하지 않고** 기존 데이터
(`lounge_posts` + `lounge_comments`)로 관리자 화면에서 항상 재계산한다(결정론적 순수 함수).
저장(bookmark) 카운트 컬럼이 미래에 추가되면 `saveSignal`/`communityScore`가 자동 반영한다
(코드 변경 없이 `save_count`/`share_count`/`report_count` 를 읽도록 설계).

## 이번 Phase 에서 하지 않은 것 (작업지시서 §8 준수)

라운지 홈 UI 개편 · 게시글 상세 대규모 변경 · PC 버전 실제 제작 · 실시간 알림 · 구독/멤버십 ·
자동 댓글 작성 · 자동 커뮤니티 개입 · AI 직접 답변 · 무제한 자동 발행 · 새 카테고리 자동 생성.
추천은 **추천만** 한다(자동 생성/발행 없음).

## 수정 금지 원칙 준수 (Regression Zero · Additive)

신규 파일 6개(`userSignals.js`, `communityScore.js`, `commentInsight.js`,
`followupRecommender.js`, `communityTemperature.js`, 본 문서) + 기존 파일 확장 1개
(`AdminScreen.jsx` 에 Community Engine 섹션 추가). 로그인·회원가입·견적·입찰·계약·GPS·증빙·
리뷰·에스크로·정산·관리자 기본 기능·기존 라운지(게시글/댓글/좋아요/스토리/대화/카테고리)·
AI 콘텐츠 공장·AI Editor·Space Graph 로직을 전혀 수정하지 않았다. 댓글 로드는 온디맨드 버튼으로만
발생하고, 기존 `adminGetLoungeComments`(읽기 전용)를 재사용한다.

## Phase 5 (미착수)

- `classifyComment`/유사도 판정을 LLM 으로 교체(반환 형태 유지)
- 오늘의 살아있는 공간 / 후속 추천을 편집국 편성표에 자동 반영(현재는 관리자 노출까지)
- 저장(bookmark) 기능 실제 구현 → `save_count` 연결
- PC 버전 Community Insight 화면
