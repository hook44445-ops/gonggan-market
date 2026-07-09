# Phase 18 — Real LLM Editorial Engine

Mock 템플릿 생성을 종료하고 실제 **OpenRouter** 기반 Editorial Engine으로 전환한다.
목표: 사용자가 읽었을 때 ChatGPT가 쓴 글이 아니라 **전문 편집자가 기획·집필한 온라인 매거진** 품질.

## 구성 (전부 신규/additive, 기존 엔진 무수정)

| 항목 | 파일 |
|---|---|
| Editorial Prompt · 10카테고리 분류 · Category Voice · 금지어 | `src/constants/editorialPrompt.js` |
| 관리자 조정(모델/temperature/maxTokens) | `src/lib/editorialConfig.js` |
| 엔진(분류→프롬프트→LLM→정규화→scrub→Confidence→Retry→Editor's Pick) | `src/lib/editorialEngine.js` |
| OpenRouter 호출(모델 override 추가) | `src/lib/llmClient.js` (additive: `model` 파라미터·`DEFAULT_MODEL`) |
| 관리자 UI(생성/설정/신뢰도/SEO/Pick) | `src/screens/AdminScreen.jsx` (AI 콘텐츠 공장 탭에 패널 추가) |

## 흐름
1. **카테고리 자동 분류** — 트렌드 제목 → 경제/주식/AI/공간/창업/라이프/문화/여행/건강/신앙 중 하나.
2. **Category Voice** — 카테고리별 전개의 결(예: 경제=데이터·영향·앞으로, 여행=왜 가는가·직접 가보면·추천, 신앙=말씀·묵상·적용). 단, 이 축을 소제목으로 그대로 쓰지 않음.
3. **Space Lounge Editorial Prompt** — 철학·발견·연결·기록·여백·사람 중심. 클릭베이트/과장/단정 금지, 구조 반복 금지, 사람처럼(문단·문장·리듬 다양, 질문·은유·여백 허용).
4. **LLM 호출**(OpenRouter) → JSON(title/summary/body/tags/seo{metaTitle,metaDescription,focusKeyword,searchIntent}).
5. **GPT 흔적 제거** — "무슨 일이 있었나 / 왜 중요할까 / 데이터로 보기 / 앞으로 볼 것 / 이 글에서는 / 살펴보겠습니다 / 정리해보겠습니다" 등 상투구 감지·제거.
6. **Confidence(7축)** — 정보/독창성/자연스러움/가독성/SEO/카테고리 적합성/편집 완성도 → 가중 총점.
7. **Retry** — 90점 미만이면 자동 재작성(최대 3회, temperature 미세 상향으로 변주, 최고점 채택).
8. **Editor's Pick** — 저장/공유/검색/오래 읽힐 가능성 → Pick 후보 판정.

## Mock 제거
Editorial Engine은 **Mock 본문을 생성하지 않는다**. LLM 미설정(키 없음)·전량 실패 시
`{ok:false, reason}`을 반환할 뿐(가짜 매거진 글을 만들지 않음). 관리자 UI는 이때 "미설정/실패"만 알린다.
기존 `generateVoicedDraft`(Mock)와 Phase 10 `generateVoicedDraftLLM`은 **건드리지 않는다** —
자동발행 파이프라인의 안전 폴백으로 남는다(Regression Zero).

## 관리자 설정
"AI 콘텐츠 공장" 탭 상단 **📰 AI 편집국** 패널에서 모델·Temperature·Max Tokens를 조정하고
"실제 매거진 생성"을 누른다. 결과의 신뢰도(7축)·SEO·Editor's Pick이 함께 표시되며,
아래 기존 미리보기에서 확인·수정 후 "초안으로 저장"(기존 `adminCreateLoungeDraft` 재사용)한다.

## 환경변수(옵트인, 기본 OFF)
`VITE_LLM_API_KEY`(또는 `VITE_OPENROUTER_API_KEY`) 미설정 시 LLM 경로는 동작하지 않는다.
`VITE_LLM_MODEL`로 기본 모델 지정(관리자에서 재정의 가능). 서버리스 함수 추가 없음(브라우저 직접 호출).

## Regression Zero
신규 API/Cron/Migration 없음 · Vercel 서버리스 함수 12개 불변 · DB 스키마 무변경.
견적/입찰/계약/채팅/에스크로/결제/GPS/리뷰/인증/기존 라운지/기존 Cron/API/엔진 무수정.
