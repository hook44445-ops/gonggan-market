# Phase 8 — Content Quality & Natural Category System

## 핵심 원칙

**Space is Everything은 플랫폼의 최상위 "철학"이다. 하지만 모든 글을 억지로 "공간"에 끼워맞추지 않는다.**
글은 각 카테고리의 본질을 우선한다 — 연애 글은 연애답게, 자격증 글은 정보답게, 종교 글은 깊이 있게,
주식 글은 데이터답게. 공간 연결은 자연스러울 때만 사용한다(억지 연결 금지).

## 구현 (전부 신규 모듈 · 기존 엔진 무수정)

| 기능 | 파일 |
|---|---|
| Category Voice System | `src/constants/categoryVoice.js` — 카테고리별 톤/구성 + `voiceFor(category, topic)` |
| Category Voice Writer + Raw Mode | `src/lib/categoryVoiceWriter.js` — `generateVoicedDraft({mode:"voice"\|"raw"})` |
| Forced Space Link Filter | `src/lib/forcedSpaceLinkFilter.js` — 억지 공간연결 감지/제거 |
| Content Usefulness Score | `src/lib/contentUsefulness.js` — 유용성 중심 7축(공간 관련성은 보조 지표) |
| Category Expansion Preparation | `src/constants/categoryExpansion.js` — 확장 후보(추천만, 사주·타로 제외) |
| 관리자 미리보기 개선 | `src/screens/AdminScreen.jsx` — 생성 모드 3종 + 품질 패널(추가만) |

## 1. Category Voice System
`voiceFor(category, topic)` 가 카테고리 또는 토픽 키워드(MBTI·자격증·종교·AI·인도점성술 등)를 보고
voice 를 정한다. voice 는 `spaceLinkPolicy` 를 가진다: `natural`(인테리어/집꾸미기/창업 등 공간이 본질),
`light`(경제/여행/AI), `none`(연애/MBTI/자격증/종교/건강 — 공간 연결 강요 금지).

## 2. Category Voice Writer + Raw Knowledge Mode
- `voice` 모드: 카테고리 톤/구성에 맞춰 작성. 정책이 `natural`이 아니면 억지 공간연결을 자동 제거.
- `raw` 모드: 오늘 무슨 일 / 왜 중요 / 핵심 포인트 / 앞으로 볼 것 / 참고 키워드 / 후속 후보 — 꾸미지 않은 원석 지식.
- **LLM Ready**: `buildWritePlan()`(계획) → `buildPrompt()`(LLM 프롬프트) → `renderFromPlan()`(결정론 렌더)로
  분리. 향후 Claude/OpenAI 로 교체 시 `renderFromPlan` 만 LLM 응답 파싱으로 바꾸면 된다(반환 형태 유지).

## 3. Forced Space Link Filter
"연애도 결국 공간에서 시작됩니다" 류 상투구를 패턴으로 감지(`detectForcedSpaceLinks`)하고 제거
(`stripForcedSpaceLinks`)한다. 관리자 미리보기의 "억지 연결" 경고, writer 의 자동 정리에 함께 쓰인다.

## 4. Content Usefulness Score
가중치: 정보 가치 0.22 · 실제 도움 0.18 · 신뢰성 0.13 · 독창성 0.12 · 저장 가치 0.13 ·
카테고리 적합성 0.14 · 자연스러움 0.08. **공간 관련성은 총점에서 제외하고 보조 지표(aux)로만 표시**한다.
과장/단정(무조건·100%·대박) 감점, 근거 어휘 가점, 억지 연결 시 자연스러움 감점.
Phase 2 `contentScore`(공간 관련성 최상위)는 무수정으로 그대로 둔다 — 별도 점수기다.

## 5. Category Expansion Preparation
`EXPANSION_AREAS` 는 작업지시서 영역(인테리어…인도점성술)을 담는다. 대응 라운지 카테고리가 없는
개념 영역(MBTI·자격증·종교·사회·AI·인도점성술)은 `expansionCandidates()` 로 **추천만** 한다 —
자동 생성하지 않으며 관리자 승인 후 공식 카테고리로 전환한다. **사주·타로는 확장 제외**(`EXPANSION_EXCLUDED`).

## 6. 관리자 미리보기 개선
"AI 콘텐츠 공장 → 새 초안 만들기"에 생성 모드(카테고리 톤/공간 관점/원석 지식) 선택과 품질 패널을 추가.
품질 패널: 카테고리 톤 · 공간 연결 강도 · 억지 연결 여부 · 유용성 점수 · 저장 가치 · 발행 추천 여부.
두 생성 경로(모드 생성 · AI 편집국 생성) 모두에서 표시된다.

## 수정 금지 / 원칙 준수
- Additive Only · Regression Zero · **Migration 없음** · 기존 배포 설정/Cron/API 함수 개수 무변경.
- 기존 엔진(generateDraft·contentScore·spacePhilosophy·SpaceGraph·CommunityEngine·ReadingExperience·
  PublishingOS 등) 핵심 동작 무수정 — 전부 신규 모듈로 "추가 호출"만.
- 로그인·결제·견적·입찰·계약·GPS·업체·리뷰·기존 라운지 핵심·DB·Supabase 무관.
