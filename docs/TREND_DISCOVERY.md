# 공간라운지 AI Trend Discovery Engine (Phase 14)

지금까지는 사람이 이슈를 넣으면 AI 가 "생성"했다. Phase 14 는 그 앞단 — AI 가 먼저
**"무엇을 써야 하는지" 판단하는 기획 AI** 를 추가한다. 생성 AI → **기획 AI**.

## 위치
관리자 → 콘텐츠 → **트렌드 발굴** 탭 (신규).

## 엔진 (`src/lib/trendDiscovery.js`)

- `discoverTrendingTopics({ recentPublished, limit, seed, provider })` — 진입점.
- **Trend Score(0~100)** = 관심도 + 시의성(긴급/상승/일반) − 최근 과다발행 카테고리 페널티.
- **Priority** = High(≥75) / Medium(≥50) / Low.
- **카테고리 다양성** — 최근 발행 기록으로 과다 카테고리 감점 + 같은 카테고리 **연속 배치 금지**(그리디 재정렬).
- **추천 새로 찾기** — `seed` 증가 시 결정론적 지터로 중위권 순위가 바뀐다(표시 점수는 불변·정확).

### Trend Candidate 구조
`topic · keywords · category · priority · reason · trendScore · estimatedInterest · publishRecommendation` (+ area/urgency).

## Mock 데이터 · Provider 분리 (향후 확장)

지금은 실제 뉴스/Google Trends/RSS 를 연결하지 않는다. `mockTrendProvider({seed})` 가 후보 풀을
반환하고, `discoverTrendingTopics(..., { provider })` 로 **주입**한다. 향후 Google Trends / News API /
네이버 뉴스 / 경제 API / RSS 는 **이 provider 함수만 교체**하면 나머지(점수/다양성/우선순위/UI)는
그대로 동작한다. 후보의 카테고리·키워드는 Phase 12 콘텐츠 영역 레지스트리를 재사용한다.

## 관리자 패널

- 요약(High/Medium/Low·카테고리 다양성) + **🔄 추천 새로 찾기**
- 후보 카드: 우선순위 · Trend Score · 주제 · 카테고리 · 예상 조회수 · 발행 추천 · 추천 이유 · 키워드
- 버튼: **✍️ Draft 생성** / **🔎 Review 보내기**
  - Draft 생성: 기존 `generateForWorkbench`(Phase 11)로 생성 → 기존 `adminCreateLoungeDraft`로 저장 →
    워크벤치 기록 저장(파이프라인의 Confidence 표시용).
  - Review 보내기: 위 + 새 초안 id 를 기존 `setPipelineStage(id,'review')`(Phase 13)로 Review 단계 이동.

## Regression Zero

- **신규 1개**(`src/lib/trendDiscovery.js`) + **변경 1개**(`AdminScreen.jsx` — 탭·컴포넌트 1개 추가)
- 절대수정금지 대상 **diff 0**: CommunityEngine·SpaceGraph·**PublishingOS**(`publishingOs.js`)·
  **Publishing Pipeline**(`publishingPipeline.js`)·**Workbench**(`editorWorkbench.js`)·LLM·Prompt Version·
  Quality Panel·CategoryVoice·ReadingExperience·Magazine UI·Search·Archive·`api/`·`vercel.json`
  (전부 호출만, 파일 무수정)
- **Migration 없음 · API 추가 없음 · Cron 추가 없음** · 서버리스 함수 **12개 불변**
- 생성은 기존 흐름/저장(localStorage·lounge_posts draft)만 사용 — 자동 발행 없음(관리자 조작).

## 다음 Phase 제안(로드맵)

- Phase 15: Personalized Feed(사용자별 맞춤 추천)
- Phase 16: AI Writer Team(경제 기자·IT 기자·여행 작가 등 AI 필진 = Category Voice 확장)
- Phase 17: Auto Publishing(90점+ 자동 발행 + 긴급 이슈 즉시 발행) — 이 때 실제 Trends/News provider 연결
