# Phase 20.6 — OpenRouter Production Activation + Admin RLS Fix

실제 OpenRouter LLM 을 활성화하고, Mock 생성을 실제 생성 경로에서 완전히 제거한다.
관리자 수정/삭제(lounge_posts RLS)를 정상 동작하게 한다.

## 1. OpenRouter 활성화

- 키: `VITE_LLM_API_KEY`(또는 `VITE_OPENROUTER_API_KEY`). **없으면 호출하지 않고** 명확히 안내
  ("LLM 미설정 (VITE_LLM_API_KEY 필요)"). 관리자 화면에 `🟢 LLM 연결됨 (OpenRouter)` / `⚪ LLM 미설정` 표시.
- 기본 모델: `anthropic/claude-3.5-sonnet` (모델 입력 미지정 시 자동 선택).
- 생성 기본값: **temperature 0.85 · max_tokens 2400**.
- Vercel Environment 에 `VITE_LLM_API_KEY` 를 넣고 재배포하면 즉시 활성화된다(서버리스 함수 추가 없음 — 브라우저 fetch).

## 2. 실제 LLM 호출

`callLLM()` 이 실제 OpenRouter `/chat/completions` 를 호출하고 `{ text, usage }` 를 반환한다.
`usage = { promptTokens, completionTokens, totalTokens }` (관리자 로그용).

## 3. Mock 완전 종료 (실제 생성 경로)

`generateForWorkbench()`(관리자 생성/트렌드→Draft의 실제 경로)는 **더 이상 Mock 을 생성하지 않는다.**
- 키 없음 → `{ error: "LLM 미설정 (VITE_LLM_API_KEY 필요)", result: null }`
- 호출/파싱 실패 → `{ error: "LLM 호출 실패: …", result: null }` (Mock 대체 없음)
- Template/Placeholder/Lorem/"무슨 일이 있었나"/반복 문단은 실제 경로에서 나오지 않는다.
- 프롬프트에 **Humanization** 규칙 추가(GPT 상투구·반복 금지).

## 4. 생성 결과 저장

LLM 결과에 **focusKeyword · metaDescription** 추가(제목/요약/본문/태그/키워드/…와 함께).
관리자가 편집 후 **초안으로 저장** 시 워크벤치 기록(localStorage)에 저장:
제목·본문·요약·SEO(focusKeyword/metaDescription)·태그·키워드·Confidence·**Editorial Score**·
prompt/model/provider/temperature/**토큰(prompt/completion/total)**/latency.
발행 draft 는 기존과 동일하게 `lounge_posts`(title/content/category) 로 저장 → Draft→발행→Lounge 정상.

## 5. 관리자 로그

워크벤치 패널에 표시: Provider · Model · Latency · Prompt/Completion/Total Tokens · Confidence · Editorial Score.
→ OpenRouter 응답이 실제인지(토큰·지연) 확인 가능.

## 6. 관리자 수정/삭제 RLS 수정

`supabase/migrations/095_lounge_posts_admin_rls_fix.sql` — **Supabase 에서 실행 필요**(앱 배포로는 적용 안 됨).
- 관리자(`users.role='admin'`): 모든 `lounge_posts` 수정/소프트삭제 가능 (USING + **WITH CHECK** 명시).
- 일반 사용자: 자신의 글만(owner 정책 유지). 타인 글 불가.
- 삭제는 기존 **Soft Delete**(`is_deleted=true`) 유지 — Hard Delete 없음.
- 범위: `lounge_posts` 만. 다른 테이블 RLS·기존 기능 무변경.

> 적용: Supabase Dashboard → SQL Editor 에 095 파일 내용 실행. 이후 관리자 삭제 시
> "new row violates row-level security policy" 가 사라진다. 앱 코드(`adminSoftDeleteLoungePost`)는
> 그대로 직접 update 를 쓰며, 정책이 이를 통과시킨다.

## Regression Zero

- 수정 범위: **LLM 엔진(llmClient/llmContentGenerator/editorWorkbench) + 워크벤치 UI(AdminScreen) + lounge_posts RLS(095)** 만.
- 무변경: 견적·입찰·계약·채팅·결제·에스크로·GPS·리뷰·인증·로그인·다른 테이블 RLS·`api/`·`vercel.json`·Cron·
  SpaceGraph·CommunityEngine·PublishingOS·Publishing Pipeline·AutoPublish·TrendDiscovery (diff 0).
- 서버리스 함수 **12개 불변** · 기존 발행/생성 흐름 유지 · `vite build` 통과.

## 검증 체크리스트

키 설정 후: OpenRouter 200 · 실제 제목/본문/태그/SEO/Summary 생성 · Humanization 적용 ·
Editorial/Confidence 계산 · 토큰 표시 · Draft 저장 · 발행 → Lounge 표시 · 관리자 수정/삭제(095 적용 후).
