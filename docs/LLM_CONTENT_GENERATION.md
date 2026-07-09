# 공간라운지 Real LLM Content Generation (Phase 10)

Phase 8 의 `renderFromPlan`(Mock 템플릿)을 실제 Claude(OpenRouter/Anthropic) 호출로 교체한다.
엔진 구조(`buildWritePlan → buildPrompt → renderFromPlan`)는 유지하고, **렌더 단계만** LLM 으로 바꾼다.

## 구조 (구조 변경 없음 · Additive)

```
buildWritePlan(계획)  ── 유지
   ↓
buildPrompt(프롬프트)  ── 유지(LLM userPrompt 의 베이스로 재사용)
   ↓
renderFromPlan(Mock)  ── 유지 (= Fallback Renderer)
renderFromPlanLLM(실제 LLM)  ── 신규(Phase 10)
   ↓
generateVoicedDraft(Mock, sync)        ── 유지
generateVoicedDraftLLM(LLM→Mock, async) ── 신규(오케스트레이션 + 폴백)
```

`generateVoicedDraft`(동기 Mock)는 **그대로 남아 Fallback 으로 쓰인다.** 새 async
`generateVoicedDraftLLM` 이 LLM 을 시도하고, 실패/미설정 시 이 Mock 을 자동 사용한다.

## 생성 결과 (반드시 JSON)

`title · summary · body · tags · keywords · readingMinutes · relatedTopics · category · tone`

LLM 응답은 코드펜스/잡텍스트를 제거하고 첫 `{`~마지막 `}` 만 파싱한다(`parseLLMJson`).
`title` 이 없거나 `body` 가 너무 짧으면 실패로 간주해 Mock 으로 폴백한다(`normalizeResult`).
Mock 폴백도 **동일한 9개 필드 JSON** 으로 매핑해 호출부가 형태를 신경 쓰지 않게 한다.

## Prompt — Phase 8 규칙 전면 적용

- **Category Voice**: 카테고리 본질 톤(연애=공감, 자격증=정보, 종교=묵상, 주식=데이터…)
- **Raw Knowledge Mode**: 꾸미지 않은 원석 지식(오늘 무슨 일/왜 중요/핵심/앞으로 볼 것/…)
- **Usefulness**: 정보가치·실제도움·신뢰성·독창성·저장가치·카테고리 적합성·자연스러움
- **Natural Category / Space Philosophy**: 철학은 유지하되 **공간 억지 연결 금지 · 카테고리 본질 우선**.
  `spaceLinkPolicy !== "natural"` 카테고리는 LLM 본문에도 `stripForcedSpaceLinks` 를 사후 적용.

## 안정성 (llmClient.js)

- **Timeout / AbortController**: `VITE_LLM_TIMEOUT_MS`(기본 30s), 외부 signal 결합.
- **Retry / Rate Limit**: 429/408/5xx/네트워크만 재시도(`VITE_LLM_MAX_RETRIES`, 기본 2).
  429 는 `Retry-After` 존중 후 지수 백오프. 그 외 4xx 는 즉시 실패 → 폴백.
- **Error Handling**: 모든 실패 경로는 예외로 수렴하고, `generateVoicedDraftLLM` 이 잡아 Mock 폴백.

## 서버리스 함수 없음 (배포 설정 불변)

Vercel 12 functions 한도를 지키기 위해 **API 라우트를 추가하지 않는다.** 관리자 브라우저에서
직접 호출하는 클라이언트 fetch 다(기본 OpenRouter — 브라우저 호출 허용).

## 보안 · 옵트인 · 기본 OFF (Regression Zero)

`VITE_LLM_API_KEY` 가 **비어 있으면 LLM 경로는 전혀 실행되지 않고** 기존 Mock 을 그대로 쓴다.
즉 **키를 넣기 전까지 프로덕션 동작은 100% 이전과 동일**하다(회귀 없음). 키를 넣어 켤 때는:

- `VITE_` 변수는 브라우저 번들에 노출되므로 **사용 한도가 제한된 OpenRouter 키**를 권장.
- Anthropic 직접 호출은 CORS/키노출 위험으로 비권장(지원은 하되 `dangerous-direct-browser-access` 필요).

## 설정

`.env.local.example` 의 `VITE_LLM_*` 참고. 최소 설정: `VITE_LLM_API_KEY` 만 채우면 OpenRouter
+ `anthropic/claude-3.5-sonnet` 로 동작한다.

## 수정 금지 준수

신규 파일 3개(`llmClient.js`, `llmContentGenerator.js`, 본 문서) + 기존 파일 확장 3개
(`categoryVoiceWriter.js` 에 async LLM 함수 추가, `AdminScreen.jsx` 호출부 async 화,
`.env.local.example` 문서). 기존 `buildWritePlan/buildPrompt/renderFromPlan/generateVoicedDraft`
동작 무변경. 로그인·결제·견적·입찰·GPS·Supabase·Migration·Cron·Publishing/Community/Space Graph
엔진 무수정. 서버리스 함수 수(12)·크론(2) 불변.
