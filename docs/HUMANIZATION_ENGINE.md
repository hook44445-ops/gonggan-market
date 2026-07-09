# Phase 19 — Real LLM Quality Verification & Humanization Engine

Phase 18 Editorial Engine 위에, 실제 생성 글의 **품질 검증**과 **AI 티 제거(Humanization)**를 얹는다.
목표: 사용자가 "AI가 템플릿 채운 글"이 아니라 "편집자가 고르고 다듬은 매거진 글"로 느끼게 한다.

## 신규 (additive)
- `src/lib/humanizationEngine.js` — AI 티 감지 + Hook/Ending 유형 분류/품질 + 반복 위험
- `src/lib/categoryMatch.js` — 제목/본문/태그 ↔ 카테고리 일치도(불일치 시 상위 카테고리 제안)

## 확장 (기존 Phase 18 파일)
- `src/lib/editorialEngine.js` — Editorial Score(7축) + 최종점수 + 판정(verdict) + AI 티 강제 재생성 + latency/token
- `src/constants/editorialPrompt.js` — Hook/Ending 다양화·카테고리 일치 프롬프트 지시 추가
- `src/screens/AdminScreen.jsx` — LLM 상태·판정·휴먼톤·훅/마무리·지연/토큰 표시

## 1. AI 티 감지 (`detectAiTone`)
금지 상투구("이 글에서는/살펴보겠습니다/정리해보겠습니다/무슨 일이 있었나/왜 중요할까/데이터로 보기") +
같은 문장 반복 + 문단 구조 반복 + 결론을 너무 빨리 → `severity`. severity≥40이면 `isStrong`(강제 재생성).

## 2. Hook Engine (`classifyHook`/`hookQuality`)
첫 문단을 질문형/장면형/뉴스형/대화형/숫자형/여운형/서술형으로 분류. 상투적 도입은 감점.

## 3. Ending Engine (`classifyEnding`/`endingQuality`)
마무리를 질문/다음 이야기 암시/여운/체크포인트/짧은 종료로 분류. "결론적으로/정리하면"은 감점.

## 4. Category Match (`categoryMatchScore`)
제목/본문/태그로 카테고리를 재도출해 배정 카테고리와 비교. 불일치 시 감점 + 본문 기준 상위 카테고리 제안
('자유' 도피 금지).

## 5. Editorial Score (7축, `computeEditorialScore`)
휴먼톤 · 카테고리 적합 · 훅 품질 · 마무리 품질 · 반복 내성 · 편집 가치 · 저장 가치 → 총점.
**최종점수 = 내용 신뢰도(45%) + Editorial Score(55%)**.

## 6. 판정 (`editorialVerdict`)
- AI 티 강함 또는 최종<70 → **발행 비추천**
- 최종 70~89 → **재작성 권장**
- 최종 90+ → **일반 발행 가능** (Editor's Pick이면 **Editor's Pick 가능**)

## 7. Retry (Phase 18 확장)
최종점수 90 미만 **또는 AI 티 강함**이면 재생성(최대 3회, temperature 미세 상향, **최고 최종점수 채택**).

## 8. Mock 차단 · 실호출 표시
Editorial Engine은 Mock 본문을 만들지 않는다 — LLM 미설정/실패 시 `{ok:false, reason}`. 관리자 패널은
`isLLMConfigured()`로 **LLM 연결됨/미설정**을 표시하고, 실제 호출 후 provider·model·latency·token 추정치를 보여준다.
Mock은 기존 수동 생성 모드(카테고리 톤/공간 관점/원석)에서만 사용되며, 편집국 실생성 경로에는 관여하지 않는다.

## Regression Zero
신규 API/Cron/Migration 없음 · vercel.json/package.json 무수정 · 서버리스 함수 12개 불변 · DB 스키마 무변경.
견적/입찰/계약/채팅/에스크로/결제/GPS/리뷰/인증/RLS/기존 라운지·댓글·좋아요·조회수/기존 Cron·API/
SpaceGraph·CommunityEngine·PublishingOS 핵심 엔진 무수정.
