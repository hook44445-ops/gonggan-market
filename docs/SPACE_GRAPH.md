# 공간라운지 Space Graph — 공간 지식 네트워크 (Phase 3)

> "Space is Everything." — 우리는 게시판을 만드는 것이 아니라, 세상의 모든 지식을
> '공간'이라는 하나의 언어로 연결하는 플랫폼을 만든다.

Phase 1(AI 콘텐츠 공장)·Phase 2(AI 편집국)가 **글을 잘 만드는** 단계였다면, Phase 3 는
**글을 잘 연결하는** 단계다. 이제부터 중요한 건 "새 글을 얼마나 잘 쓰느냐"가 아니라
"기존 글을 얼마나 잘 연결하느냐"다. 콘텐츠가 1만·10만 개가 돼도 서로 유기적으로 이어져
하나의 **Space Knowledge Network(공간 지식 네트워크)**를 이루면, 이것이 공간라운지의
가장 강력한 진입장벽이 된다.

## 최상위 철학

공간은 세상의 모든 것을 담는 가장 큰 개념이다. 모든 콘텐츠는 공간 아래 존재한다.
AI 는 콘텐츠를 생산하는 것이 아니라, **공간이라는 관점으로 세상을 연결한다.**
AI 는 새 글을 쓰기 전에 이미 존재하는 콘텐츠를 먼저 이해하고, 새 글을 기존 글과 연결한다.

## 구현 (신규 파일 / 결정론적 · 저장 없음)

| 작업지시서 기능 | 구현 |
|---|---|
| ① Space Graph (콘텐츠를 공간 기준으로 연결) | `src/lib/spaceGraph.js` `buildSpaceGraph()` — 글 노드 + 공간 연결도 엣지 |
| ② Related Article ("같이 보면 좋은 글" 자동 추천) | `spaceGraph.js` `relatedArticles()` / `rankBySpaceGraph()` — 글 상세 하단 관련글에 적용 |
| ③ Knowledge Map (카테고리 지식 연결) | `src/constants/knowledgeMap.js` `KNOWLEDGE_CHAINS` + `spaceGraph.js` `knowledgeMap()` |
| ④ AI Topic Cluster (콘텐츠를 클러스터로 관리) | `knowledgeMap.js` `TOPIC_CLUSTERS` + `spaceGraph.js` `clusterBreakdown()` |
| ⑥ Space Connection Engine (모든 글을 읽고 공간 연결) | `spaceGraph.js` `postSignature()` + `relatednessScore()` |
| ⑦ 오늘의 Space (Top10) | `spaceGraph.js` `todaysSpace()` — 인기 + 네트워크 허브 |
| ⑧ Editor's Pick | `spaceGraph.js` `editorsPick()` — 연결이 가장 많은 허브형 글 |
| 콘텐츠 원칙(중복 방지 · AI 체크) | `src/lib/preGenerationCheck.js` — 생성 "전에" 기존 글 이해/중복/관련 연결 확인 |
| 콘텐츠 연결률 | `spaceGraph.js` `connectionRate()` |

관리자 화면: `AdminScreen.jsx` "AI 콘텐츠 공장" 탭 → **🕸️ Space Graph** 섹션(연결률·클러스터·
지식 지도·오늘의 Space/Editor's Pick·AI 체크).

## 연결 신호 (relatednessScore)

두 글의 "공간 연결도"(0~100)를 여러 신호로 가중 합산한다. 가장 강한 신호는 **같은 공간
관점(spaceKeyword)** — 같은 렌즈로 세상을 본 글이다.

| 신호 | 가중 |
|---|---|
| 같은 공간 관점(spaceKeyword) | +34 (같은 재해석 렌즈 +18) |
| 같은 카테고리 | +22 (같은 클러스터 +14 / 지식 지도 인접 +10) |
| 태그 겹침(Jaccard) | +24 |
| 제목 토큰 겹침(Jaccard) | +20 |

`spaceKeyword`·렌즈는 Phase 2 `spacePhilosophy.js` `reinterpretThroughSpace()`를 재사용한다 —
"폭염·금리·창업·AI·주식·반려동물"이 모두 공간 관점으로 착지되므로, 서로 다른 카테고리의
글도 같은 공간 관점이면 연결된다(예: `interior` 시공후기 ↔ `quote_worry` 견적고민).

## 지식 사슬 (KNOWLEDGE_CHAINS)

작업지시서의 사슬을 실제 라운지 카테고리 id 로 착지시켜 카테고리 인접 지도를 만든다.

```
사람 → 집 → 거래 :  연애 → 결혼 → 이사입주 → 인테리어 → 시공후기 → 견적고민
창업 → 상업공간   :  창업 → 사장님수다 → 인테리어 → 부동산 → 주식
경제 → 공간산업   :  주식 → 취업 → 부동산 → 인테리어
```

사슬에서 앞뒤로 이어지거나 같은 토픽 클러스터에 속한 카테고리는 "지식으로 연결"된 것으로
본다. `knowledgeMap()`은 **실제 글이 있는 카테고리끼리만** 엣지를 만들어 관리자 화면에 노출한다.

## AI 체크 — 중복 방지 (preGenerationCheck)

콘텐츠 원칙: **AI 는 절대로 중복 글을 만들지 않는다.** 편집회의에서 "이 이슈로 초안 생성"을
누르면, 생성 전에 5가지를 확인한다:

1. 기존 글 존재 여부 · 2. 중복 여부(48h 슬러그 동일, Phase 2 `duplicateChecker` 재사용) ·
3. 더 좋은 글 작성 가능 여부(가장 닮은 글의 연결도) · 4. 관련 글 연결 여부 · 5. 카테고리 연결 여부

판정(`verdict`):
- **skip** — 48h 내 사실상 동일한 글이 있음(중복). 생성을 건너뛴다.
- **enrich** — 매우 유사한 글이 있음. 새로 쓰지 말고 "부족한 부분만" 보강 권장.
- **create** — 중복 아님. 생성하되 관련 글과 연결한다.

## Migration 여부: 없음

신규 테이블/컬럼 없음. 연결도·클러스터·지식 지도·연결률·오늘의 Space 는 **저장하지 않고**
기존 데이터(`lounge_posts`)로 관리자 화면/글 상세에서 항상 재계산한다(결정론적 순수 함수).

## PC Version 고려 (구조 준비)

Phase 3 의 엔진(`spaceGraph.js`)은 표시 레이어와 분리된 순수 함수다. 향후 PC 버전의
Magazine / Archive / Knowledge / Search 화면은 이 함수들(`knowledgeMap`·`clusterBreakdown`·
`relatedArticles`·`todaysSpace`)을 그대로 호출해 구성할 수 있다(모바일과 로직 공유).

## Phase 4 (미착수)

- `relatednessScore` 내부를 임베딩/LLM 의미 유사도로 교체(반환 형태 유지)
- 오늘의 Space / Editor's Pick 을 홈 화면에 노출(현재는 엔진 + 관리자 노출까지)
- Deep Article(3000~6000자 심층 콘텐츠) 자동 생성
- Space Encyclopedia(백과사전형 카테고리 허브 페이지)

## 수정 금지 원칙 준수 (Regression Zero · Additive)

신규 파일 4개(`src/constants/knowledgeMap.js`, `src/lib/spaceGraph.js`,
`src/lib/preGenerationCheck.js`, 본 문서) + 기존 파일 확장 2개(`AdminScreen.jsx` 에 Space
Graph 섹션 추가, `LoungePostDetailScreen.jsx` 관련글을 그래프로 재정렬). 로그인·회원가입·
고객·업체·프로젝트·계약·GPS·리뷰·관리자 기존 기능·기존 라운지·AI 콘텐츠 공장·AI 편집국의
기존 로직을 전혀 수정하지 않았다. 관련글 재정렬은 그래프 실패 시 기존 순서로 폴백한다.
