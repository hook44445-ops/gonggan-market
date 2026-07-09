# 공간라운지 AI 콘텐츠 자동화 공장 (v1.0 Beta · Phase 1)

> "Space is Everything. 공간 안에 모든 것이 있다." — 공간라운지 철학과 자동화 시스템
> (첨부 이미지 기준, 2026-07)

## 철학 → 구현 매핑

| 철학 이미지 | 구현 |
|---|---|
| SPACE(최상위) → 6개 하위 도메인(주거공간/업무공간/사람/사회/라이프/문화) | `src/constants/aiContentFactory.js` `SPACE_DOMAINS` — 기존 `LOUNGE_CATEGORIES`(변경 없음)를 6개 도메인으로 그룹핑(표시/문서 참고용) |
| ①이슈/데이터 수집 | Phase 1: 관리자가 이슈 프리셋 선택 또는 직접 입력(`ISSUE_PRESETS`). 외부 트렌드 API 연동은 Phase 2 |
| ②주제 기획 (공간 관점 재해석) | `classifyCategory()` — 이슈 텍스트를 기존 라운지 카테고리로 매핑 |
| ③제목/구성 생성 | `generateDraft()` — "공간 관점 재해석" 문구를 제목으로 |
| ④본문 작성 | `generateDraft()` — `docs/LOUNGE_SEO_POLICY.md` 구조(도입→소제목→체크리스트→공간마켓 연결→CTA) 템플릿. **Template 기반**(Phase 1) — Claude/OpenAI 연결은 Phase 2에서 이 함수 내부만 교체 |
| ⑤이미지/태그 생성 | Phase 1 미포함(수동 업로드 가능하도록 `image_urls` 필드는 준비돼 있음). AI 이미지 생성은 Phase 2/3 |
| ⑥초안 등록(DRAFT) | `adminCreateLoungeDraft()` — `lounge_posts.publish_status='draft'`, `is_visible=false` |
| ⑦검수/수정 | AdminScreen "AI 콘텐츠 공장" 탭 — 제목/본문 직접 수정 후 저장 |
| ⑧예약 발행 | `adminUpdateLoungeDraft(..., publishStatus:'scheduled', scheduledAt)` |
| ⑨자동 발행 | `api/lounge/publish-scheduled.js` — Vercel Cron(매일 1회, 철학 이미지의 "자동화 운영 흐름(매일)"과 동일 주기)이 예약 시각 도래 건만 발행. **새로운 승인 결정을 내리지 않음** — 관리자가 이미 승인한 예약을 정해진 시각에 실행만 함 |
| ⑩카테고리별 콘텐츠 축적 | AdminScreen 탭 하단 — 발행된 AI 콘텐츠를 카테고리별 집계(건수/조회/좋아요/댓글) |
| 이야기→신뢰→연결→거래 (공간마켓 생태계) | 발행 글은 실제 `lounge_posts`(SEO permalink·sitemap·prerender 대상)에 저장되어 검색 유입 → 라운지 참여 → 견적 요청까지 기존 거래 흐름과 자연스럽게 연결(본문 마지막 CTA로만 연결, 광고 문구 없음) |

## 왜 `seed_lounge_posts`가 아니라 `lounge_posts`인가

관리자 화면에는 이미 "라운지 시딩"(`seed_lounge_posts` 테이블) 기능이 있지만, 이는
**클라이언트에서 피드에 끼워 넣는 표시 전용 콘텐츠**로, 개별 URL·sitemap·봇 프리렌더
(SEO) 대상이 아니다. AI 콘텐츠 공장의 목표는 "검색 유입 증가"이므로, 실제 개별
퍼머링크·sitemap·구조화 데이터를 갖는 **`lounge_posts`**(기존 `is_seed=true` "운영"
콘텐츠와 동일한 테이블)에 저장한다. 새 테이블은 만들지 않았다.

## 이번 PR(Phase 1)에서 만든 것

- `lounge_posts`에 컬럼 3개 추가: `publish_status`(draft/scheduled/published),
  `scheduled_at`, `ai_topic` (migration `094_lounge_ai_content_factory.sql`)
- 템플릿 기반 기획/분류/본문 생성: `src/constants/aiContentFactory.js`
- 관리자 CRUD 함수: `src/lib/supabase.js`
  (`adminCreateLoungeDraft`/`adminUpdateLoungeDraft`/`adminListLoungeDrafts`/
  `adminListPublishedAiContent`/`adminDeleteLoungeDraft`)
- 관리자 UI: AdminScreen "AI 콘텐츠 공장" 탭(`LoungeAiFactoryTab`)
- 예약 발행 배치: `api/lounge/publish-scheduled.js` + `vercel.json` cron(매일)

## Phase 2 (권장, 미착수)

- 외부 트렌드 연동(Google Trends/뉴스 API) — `ISSUE_PRESETS`를 대체/보강
- 실제 LLM 연결(Claude/OpenAI) — `generateDraft()` 시그니처 유지한 채 내부 교체
- SEO 자동 최적화 — `buildPostMeta()`(기존 `loungeSeo.js`) 재사용해 title/description 자동 보정
- 내부 데이터 기반 주제 추천 — 견적 요청/인기 검색어 등 공간마켓 내부 데이터를
  `ISSUE_PRESETS` 후보로 자동 제안

## Phase 3 (장기, 미착수)

- 성과 기반 자가 개선(어떤 카테고리/톤이 조회·좋아요가 높은지 학습해 다음 기획에 반영)
- AI 이미지 생성/썸네일 자동 연결
- 다국어 콘텐츠

## 수정 금지 원칙 준수

이번 PR은 고객/업체/관리자 거래 기능, 신뢰 시스템(GPS/증빙/Digital Twin), 기존 라운지
기능(게시글/댓글/좋아요/스토리/대화신청/카테고리)을 전혀 수정하지 않았다. 새 컬럼은
기본값(`publish_status='published'`)이라 기존 행/기존 흐름에 영향이 없다.
