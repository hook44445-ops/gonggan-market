# 공간라운지 AI Editor Workbench (Phase 11)

LLM 이 생성한 글을 바로 발행하지 않고 **생성 → 편집 → 비교 → 승인 → 발행**으로 운영한다.
Phase 10(실제 LLM 생성) 위에, 사람이 검토하기 쉬운 **편집자 워크벤치**를 얹는다.

## 위치
관리자 → AI 콘텐츠 공장 → "새 초안 만들기" → 모드 voice/raw 로 **✨ 초안 생성** 시 워크벤치 표시.

## 구성

| 영역 | 내용 |
|---|---|
| **AI Draft** | 제목 · 본문(편집 가능) |
| **AI Confidence** | 92% 형태의 종합 신뢰도(품질 지표 가중 + LLM/Mock 반영) |
| **AI 분석** | 톤 · 유용성 · 예상 읽는시간 · 카테고리 · provider/tokens/latency |
| **Quality Panel** | 정보성 · 자연스러움 · 중복 · SEO · 제목 · 읽기 난이도 (자동 계산) |
| **편집** | 제목 · 본문 · 요약 · 태그 · 키워드 수정 |
| **LLM Prompt 보기** | 사용된 system+user 프롬프트 + 📋 복사 |
| **Raw Response 보기** | LLM 원문(JSON) — 개발/검수용 |
| **Prompt Version** | v1(균형) / v2(실용 강화) / v3(깊이 강화) 선택 |
| **Temperature** | 0.0~1.0 슬라이더 |
| **저장 / 발행** | 기존 초안 저장·발행 흐름 재사용 |

## 저장 구조 (localStorage · DB 아님)

승인 시 워크벤치 기록을 로컬에 보관한다(운영 참고용): `draft · prompt · promptVersion ·
llmModel · llmProvider · temperature · tokens · latency · confidence · rawResponse`.
발행되는 초안 자체는 기존과 동일하게 `title/content/category` 만 `lounge_posts` 로 저장한다
(**스키마 변경·Migration 없음**). 요약/태그/키워드는 DB 컬럼이 없어 워크벤치 기록에만 남는다.

## Quality Panel 계산

- **정보성/자연스러움**: Phase 8 `scoreUsefulness` 축 재사용
- **중복**: 제목 토큰 Jaccard 로 기존 초안/발행글과 비교(낮음/보통/높음 + 가장 닮은 글)
- **SEO**: 제목 길이 + 소제목 수 + 키워드 수
- **제목**: 길이·일반성
- **읽기 난이도**: 평균 문장 길이(쉬움/보통/어려움)
- **AI Confidence**: 유용성·자연스러움·(100−중복)·SEO·제목·가독성 가중합. Mock 은 상한 78 로 캡.

## Regression Zero (핵심)

**신규 파일 1개**(`src/lib/editorWorkbench.js`) + **기존 파일 1개**(`src/screens/AdminScreen.jsx`)만.
`editorWorkbench.js` 는 Phase 10 엔진(`llmClient`/`llmContentGenerator`/`categoryVoiceWriter`)을
**전혀 수정하지 않고** export 함수만 호출한다. 확인:

- `llmClient.js` · `llmContentGenerator.js` · `categoryVoiceWriter.js` · `spaceGraph` · `communityScore` ·
  `SpaceMediaScreen` · `readingExperience` · `forcedSpaceLinkFilter` · `categoryVoice` · `api/` · `vercel.json`
  **diff 0**
- 서버리스 함수 **12개 불변** · 크론 불변 · DB/Migration/API 없음
- LLM 미설정 시 기존 Mock 폴백 그대로(옵트인·기본 OFF 유지)

## 다음 단계(제안)

- 예약 발행 · A/B 테스트(Prompt Version 비교) · 자동 SEO 최적화
- **콘텐츠 영역 확장**(사용자 제안): 책/독서 리뷰 Voice·Coverage 신규 추가 + 경제/주식 이슈 생성
  강화 — 생성 엔진(categoryVoice/spaceCoverage) 확장이 필요하므로 별도 Phase 로 진행 권장.
