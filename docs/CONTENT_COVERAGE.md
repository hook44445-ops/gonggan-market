# 공간라운지 Content Coverage Expansion (Phase 12)

생성 엔진(Category Voice Writer · Raw Knowledge · LLM · Workbench)은 **수정하지 않는다.**
이번 Phase 는 "생성 품질"이 아니라 **지원 분야(Coverage)**를 늘린다 — 인테리어 중심을 넘어
경제·주식·AI·책·여행 등을 같은 품질로 생성하는 범용 AI 매거진으로 확장.

## 지원 콘텐츠 영역 (19)

경제 · 국내주식 · 해외주식 · 부동산 · 창업 · AI · IT · 과학 · 좋은 책 · 영화 · 드라마 ·
게임 · 자동차 · 여행 · 맛집 · 건강 · 자기계발 · 역사 · 철학

각 영역은 **Category Voice · Coverage · Keyword · Prompt(의도)**를 분리 관리한다
(`src/constants/contentAreas.js` 레지스트리).

## 어떻게 엔진 수정 없이 확장되나

생성 엔진은 `categoryVoice.js` 의 `voiceFor(category, topic)` 로 톤/구성/공간정책을 읽는다.
그래서 **데이터(voice·concept)만 추가하면** 새 영역이 기존 파이프라인(Plan → Prompt →
renderFromPlan/LLM → Workbench)을 그대로 타고 흐른다. 엔진 코드는 한 줄도 바뀌지 않는다.

| 확장 항목 | 파일 | 방식 |
|---|---|---|
| Category Voice | `src/constants/categoryVoice.js` | voice 3종(tech/review_pick/growth) + 개념 감지 13종 **추가** |
| 레지스트리(Voice/Coverage/Keyword/Prompt 분리) | `src/constants/contentAreas.js` | **신규** |
| Space Coverage | `src/lib/spaceCoverage.js` | 레지스트리에서 새 영역을 **덧붙임**(기존 순서·로직 불변) |

## Voice 매핑 (억지 공간연결 금지)

| 영역 | Voice | spaceLinkPolicy |
|---|---|---|
| 경제·부동산·주식(국내/해외) | analytical | light / none — 데이터·리스크 명시, 투자 권유 금지 |
| AI | analytical(기존 유지) · IT | tech — 기술 설명·실제 활용·최신 트렌드 |
| 과학·자동차 | informational | none / light |
| 좋은 책·영화·드라마·게임 | review_pick | **none** — 줄거리보다 핵심 메시지·적용점, 추천 대상 명시 |
| 자기계발 | growth | none — 실천 중심, 단정 금지 |
| 역사·철학 | contemplative | none — 맥락·깊이 |
| 여행·맛집 | experiential | light |
| 건강 | careful_health | none — 진단 아님, 전문가 상담 |

**공간 연결은 필요할 때만 light**, 개념 영역(책/영화/철학 등)은 **none**(억지 연결 금지).
생성 테스트 6개 영역 모두 `forcedLinks = 0` 확인.

## 추천 키워드

각 영역에 연관/추천/자동확장 키워드를 등록(`recommendedKeywordsFor(topic)`).
예) 경제 → 금리·물가·환율·소비·고용·GDP / 주식 → 반도체·배당·ETF·실적 /
책 → 베스트셀러·인문·경제경영·소설·자기계발.

## 검색 지원

Knowledge Search(`spaceSearch`)는 제목·본문·태그·카테고리를 검색한다. 새 영역으로 생성된
콘텐츠는 해당 키워드를 본문/제목에 담으므로 **별도 엔진 수정 없이 검색·연관검색에 자동 노출**된다.

## Regression Zero

- **신규 1개**(`contentAreas.js`) + **데이터 확장 2개**(`categoryVoice.js`, `spaceCoverage.js`)
- 절대수정금지 대상 **diff 0**: `categoryVoiceWriter`(생성 엔진) · LLM Client · LLM Generator ·
  AI Editor Workbench · Prompt Version · Quality Panel · Mock Fallback · SpaceGraph ·
  CommunityEngine · ReadingExperience · PublishingOS 코어(`publishingOs.js`) · SpaceMedia ·
  AdminScreen · `api/` · `vercel.json`
- `spaceCoverage.js` 는 **데이터만 덧붙임**(기존 영역·`spaceCoverage()`/`spaceIndex` 로직 불변)
- 서버리스 함수 **12개 불변** · 크론 불변 · DB/Migration/API 없음
- 기존 voice/concept 항목 **무변경** — 기존 생성 품질 그대로 유지
- 생성 테스트: 경제·주식·책·AI·IT·여행 6개 영역 정상 생성(voice 적용·억지연결 0) · `vite build` 통과
