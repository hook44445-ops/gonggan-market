# 공간라운지 Space Media — 매거진 경험 (Phase 5)

> "YouTube 가 영상을 기록했다면, Space Lounge 는 글과 사진으로 세상을 기록한다."
> 우리는 게시판·블로그·"AI 가 글 쓰는 사이트"를 만드는 것이 아니다. 글과 사진으로 세상을
> 기록하는 **Space Media** 를 만든다. 모든 콘텐츠는 하나의 철학으로 연결된다 — Space is Everything.

Phase 1~4 가 AI 의 두뇌(콘텐츠 공장·편집국·Space Graph·Community Engine)를 만든 단계였다면,
Phase 5 는 **사용자 경험(UX)** 단계다. 이제부터 성공 기준은 "기능을 얼마나 더 만들었는가"가 아니라
**사용자가 얼마나 오래 머무르고, 얼마나 읽고, 얼마나 저장하는가**다.

핵심 원칙(작업지시서 §16): **AI 는 뒤에서만.** AI 는 콘텐츠를 돕고, 주인공은 사람이다.

## 구현 (신규 엔진 · UI 분리 · PC Version First · 결정론적 · 저장 없음)

| 작업지시서 | 구현 | 상태 |
|---|---|---|
| §4 Magazine Home | `src/lib/magazine.js` `composeMagazine()` — 오늘의 Space·Editor's Pick·Deep·인기·이번 주 Best·새 글·Trending·Insight | 엔진 + 관리자 미리보기 |
| §5 Archive | `src/lib/archive.js` — 시간(오늘/주/달/해)·카테고리·태그 아카이브 | 엔진 + 관리자 요약 |
| §6 Reading Experience | `src/lib/readingExperience.js` — 읽는 시간·목차(TOC)·태그·다음 글 | **글 상세에 실제 적용** |
| §7 Photo First | 기존 `image_urls`·이미지 뷰어 재사용 + 매거진 카드 cover/imageCount | 구조 준비 |
| §8 Search Experience | `src/lib/spaceSearch.js` — 제목·본문·태그·카테고리 + Space Graph 확장 | 엔진 + 관리자 데모 |
| §9 Author System | `src/lib/authorSystem.js` — AI Editor/Official/Partner/Community 배지 | **글 상세에 적용** |
| §10 Topic Hub | `src/lib/topicHub.js` `composeTopicHub()` — 카테고리 허브 + 지식 사슬 | 엔진 준비 |
| §11 Encyclopedia | `topicHub.js` `encyclopediaLinks()` — 관련 글/카테고리/공간/클러스터 | 엔진 준비 |
| §14 SEO | `src/utils/articleSchema.js` — Article/Breadcrumb(JSON-LD)·Reading Time | **글 상세 head 주입** |
| §15 Analytics | Phase 4 Community Engine + Phase 5 매거진/아카이브 관리자 미리보기 | 관리자 노출 |

관리자 화면: `AdminScreen.jsx` "AI 콘텐츠 공장" 탭 → **📖 Space Media** 섹션(매거진 섹션·Trending·
Archive 요약·지식 검색 데모).

## Reading Experience — 실제 사용자 UX

글 상세(`LoungePostDetailScreen`)에 **additive** 로 적용했다:
- **읽는 시간** — 한국어 ~550자/분 + 이미지 보정("📖 약 N분").
- **작성자 배지** — 운영/AI/전문가 글에만 표시(일반 사용자 글은 기존 익명 신원 유지). AI 는 담백하게 "AI Editor" 라벨만.
- **목차(TOC)** — 소제목(`##`/`###`)이 2개 이상이면 "이 글에서 다루는 내용" 카드. 클릭 시 해당 소제목으로 부드럽게 스크롤(`RichContent` 무변경 · 본문 컨테이너에서 텍스트 매칭, 실패 시 무시).

## PC Version First

모든 엔진은 UI 와 분리된 순수 함수다. 모바일 글 상세와 향후 PC 매거진이 **같은 함수**를 호출한다:
`composeMagazine` · `composeArchive` · `spaceSearch` · `composeTopicHub` · `readingExperience`.
모바일은 축소판, PC 는 완전한 Magazine 이 되도록 로직을 공유한다.

## SEO — 글 하나가 검색 자산

`articleSchema.js` 가 Article + BreadcrumbList JSON-LD 를 만들고, 글 상세 진입 시 `<head>` 에
주입한다(언마운트 시 제거). 기존 canonical/OG 메타 갱신과 **독립적인 additive 효과**다. Reading Time
(`timeRequired`)·wordCount·작성자·발행일을 구조화 데이터로 노출한다.

## Migration 여부: 없음

신규 테이블/컬럼 없음. 매거진 구성·아카이브·검색·읽는 시간·작성자 유형·구조화 데이터는 **저장하지
않고** 기존 데이터(`lounge_posts`)로 항상 재계산한다(결정론적 순수 함수). 저장(bookmark) 카운트가
미래에 붙으면 Phase 4 엔진과 연동돼 Deep/Archive 후보에 자동 반영된다.

## 이번 Phase 에서 하지 않은 것 (작업지시서 §18 준수)

결제/GPS/프로젝트/업체/로그인 수정 · DB 구조 대규모 변경 · **기존 라운지 UI 파괴 없음**.
매거진/아카이브/검색/토픽허브/백과사전은 사용자 화면을 새로 갈아엎지 않고 **엔진(구조)로 준비**하고
관리자 미리보기로 검증한다. 실제 사용자 접점은 글 상세의 Reading Experience + SEO 로 한정(안전).

## 수정 금지 원칙 준수 (Regression Zero · Additive)

신규 파일 8개(`readingExperience.js`, `authorSystem.js`, `magazine.js`, `archive.js`,
`spaceSearch.js`, `topicHub.js`, `utils/articleSchema.js`, 본 문서) + 기존 파일 확장 2개
(`AdminScreen.jsx` 에 Space Media 섹션, `LoungePostDetailScreen.jsx` 에 Reading Experience·JSON-LD).
로그인·회원가입·견적·입찰·계약·GPS·증빙·리뷰·에스크로·정산·관리자 기본·기존 라운지(게시글/댓글/
좋아요/스토리/대화/카테고리)·AI 공장·Editor·Space Graph·Community Engine 로직을 전혀 수정하지 않았다.
글 상세 추가 요소는 모두 실패 시 무해(폴백)하도록 방어했다.

## Phase 6 (미착수)

- 실제 PC Magazine / Archive / Search / Topic Hub 화면 제작(엔진은 준비 완료)
- 서버 전문검색(FTS)/임베딩으로 `spaceSearch` 교체(반환 형태 유지)
- 저장(bookmark) 기능 실제 구현 → Deep/Archive 자동 연결
- 프리렌더(`api/prerender.js`)에 JSON-LD 서버 사이드 주입(현재는 클라이언트 head 주입)
