# Phase 2 Evidence 보정 — 2026-09-29

이 절이 아래 Phase 1의 추정/표현보다 우선한다. 운영 사이트 HTTP 200, Vercel 배포와 공개 번들 SHA 5a8cb7b 일치, 로컬 Supabase 프로젝트 일치를 확인했다. 인증·거래 E2E는 실행하지 않았으므로 페이지 가용성 외 기능은 PRODUCTION_CONFIRMED로 올리지 않는다.

## 실제 schema / 데이터 준비도

GET select=<해당열>&limit=0으로 본문 없이 열 존재 여부만 확인했다.

| field | UI input / request payload(current main) | Production DB | final estimate / index trigger | 판정 |
|---|---|---|---|---|
| requests.space_size_m2 | 전용 숫자㎡ 입력·payload 없음. 기존 size UI/p_size 존재 | 400 / 42703: 열 없음 | 저장소 013의 price/m² 분모, 운영 trigger UNKNOWN | NOT_COLLECTED |
| requests.building_type | 전용 입력·payload 없음. space_type은 동일 개념으로 취급하지 않음 | 400 / 42703 | 013 그룹 조건, 운영 trigger UNKNOWN | NOT_COLLECTED |
| requests.region_code | area 설명/지역 텍스트와 달리 표준 코드 payload 없음 | 400 / 42703 | 013 필수 조건, 운영 trigger UNKNOWN | NOT_COLLECTED |
| estimates.material_grade | src 입력/전달 경로 검색 결과 없음 | 200: 열 존재만 확인 | 013 economy/standard/premium/luxury 조건 | NOT_COLLECTED(앱 경로), DB 값은 UNKNOWN |
| estimates.labor_ratio | src 입력/전달 경로 없음 | 200: 열 존재만 확인 | 현 저장 경로 미확인 | NOT_COLLECTED(앱 경로), DB 값은 UNKNOWN |
| requests.size/space_type | UI initialData.size, createRequest p_size/p_space_type 존재 | 둘 다 200 | m²/건물유형 표준값으로 직접 대체 불가 | PARTIAL |
| space_price_index | 앱 입력 경로 없음 | 404 / PGRST205: API schema cache에 없음 | migration 013은 COMPLETED + 지역/면적/유형/등급 조건 필요 | NOT_COLLECTED/운영 집계 UNKNOWN |

PGRST205만으로 실제 테이블 삭제·migration 미실행을 단정하지 않는다(미노출/schema cache 가능). 관찰되지 않은 누적량은 0이 아니라 UNKNOWN. AI 학습 데이터 확보·모델 학습·가격지표 운영은 현재 입증 불가.

## 기능 및 결제

| 기능 | 상태 | 제한 |
|---|---|---|
| 공개 홈페이지 전달 | PRODUCTION_CONFIRMED | HTTP 200·실제 번들 다운로드만, 전체 UI/E2E 아님 |
| 회원가입·견적요청·입찰·견적비교·채팅 | CODE_READY | 코드 경로 존재. 운영 테스트 계정·사용자 쓰기 미실행 |
| 현장방문·GPS·최종견적·계약 | CODE_READY | S3/S4 운영 권한 UNKNOWN; 성공 시나리오 미검증 |
| 착공·중간·완료·후기 | CODE_READY | auth.uid 기반 코드 존재; 운영 함수와 동일성 미확인 |
| 결제 | INTERNAL_LEDGER_ONLY(관측 범위) | 프런트 beta로 결제 닫힘, 장부 count만 확인. Toss secret·실송금·PG 계약은 UNKNOWN |

익명 count로 보인 계약 8·지급 32는 실제 결제·송금·매출 건수가 아니다. 사진 27·채팅 25·문서 13도 학습 가능성·동의·비식별성·품질을 입증하지 않는다. 이 숫자를 지원서 성과 지표로 사용하지 않는다.

보안 증거는 GRANT-01 Phase 2 참조. S1/S2 읽기 범위 노출은 확인됐으나 수정 미완료, S3/S4 미확정. 운영 기능 캡처/테스트 계정 로그인/실사용자 데이터 조작 없음. 과거 스토어 이미지의 BETA 제거 등 편집 여부는 제출 시 정확히 밝힌다.

---
## 아래는 Phase 1 코드 목록(운영 보장/수량 추정으로 사용 금지)

# 정부지원사업 준비 2 — 제품 증거 모음(Evidence Pack) · 구조 · 데이터 (2026-09-29)

기준: main `e02d055` · 저장소 코드/SQL 근거 · 운영 동작 확인 **UNKNOWN**(GRANT-01 참고) · 상태 등급: PRODUCTION / READY / PARTIAL / CODE_EXISTS / PLANNED.
**PRODUCTION 판정 0건** — 운영 확인 전이라 최고 등급은 READY.
⚠ 05·06·07·10 은 GRANT-01 의 S3·S4(보안) 수정 전에는 «증빙»으로 강하게 주장하지 않는다.

## 4. 항목별 증거

| # | 항목 | 화면(코드) | DB · 서버 | 상태 | 지원서에 쓸 수 있는 문장 |
|---|---|---|---|---|---|
| 01 | 견적요청 | 요청서 `src/components/RequestModalBeta.jsx` · 홈 `screens/v3/HomeV3.jsx` | `requests`(area·space_type·size·style·description·budget_min/max·status·expires_at) · 상태 전이 029·030 · 7일 만료 126 | READY | 고객은 공간 유형·면적·예산 범위·설명으로 견적을 요청하고, 요청은 7일 동안 동네 업체에 공개된다. |
| 02 | 입찰 | 업체 홈 요청 목록 `components/BidCard.jsx` | `bids` · 업체당 1건(015) · 사업자 확인 필요(124) · 요청당 최대 5곳(128) · 한도(101) | READY | 사업자 확인을 받은 업체만 입찰하며, 한 요청에 최대 5곳까지 비교 견적이 모인다. |
| 03 | 견적비교 | `screens/BidStatusScreen.jsx` · `components/BidCompareCard.jsx` · `lib/bidCompare.js` | `bids` + 업체 엠블럼·후기 | READY | 고객은 금액과 함께 업체의 확인된 증빙·후기를 한 화면에서 나란히 비교한다. |
| 04 | 현장방문 | `components/SiteVisitModal.jsx` | `site_visits`(013·039·041) · 72시간 견적 기한(018) | READY | 업체는 현장 실측 방문을 기록하고 72시간 안에 최종견적을 낸다. |
| 05 | GPS 체크포인트 | 현장방문 `SiteVisitModal.jsx:113` · 계약(고객) `screens/EscrowScreen.jsx:390` · 착공/중간/완료 `EscrowScreen.jsx:1123` | `project_checkpoints`: request_id·contract_id·site_visit_id·checkpoint_type(site_visit/contract/start/middle/complete)·lat·lng·accuracy·road_address·jibun_address·address_full·sido·sigungu·dong·bunji·photos·note·captured_by·captured_at (032·034·067·082) · 좌표는 관리자만(조회 마스킹) | READY (S4 수정 필요) | 현장방문·계약·착공·중간·완료 5시점에 버튼을 누를 때 1회만 위치·주소·사진을 기록하며, 상시 위치 추적은 하지 않는다. |
| 06 | 사진 증빙 | 단계 보고 `EscrowScreen.jsx` · 최종견적 실측 사진 | `phase_photos`(contract_id·step·photos·uploaded_by·uploader_role·caption·created_at) — 서버 함수로만, 업체 당사자 토큰 확인(136) · `estimates.final_quote_photo_urls`(043) | READY | 공정 단계 사진은 업체 당사자만 서버를 통해 기록하며, 작성자와 시각이 함께 남는다. |
| 07 | 최종견적 | `components/QuoteDocument.jsx`(A4 미리보기·인쇄) | `estimates`(items jsonb·total_price·duration_days·warranty_note·final_quote_photo_urls·status) · `estimate_upsert`/`estimate_submit`(031·043·044) · 추가견적 예외 흐름(033·117) | READY (S4 수정 필요) | 업체는 항목별 최종견적서를 실측 사진과 함께 제출하고, 추가견적은 숨은 하자 등 정해진 예외에서만 쓴다. |
| 08 | 계약기록 | `EscrowScreen.jsx` · 관리자 `components/AdminContractDetail.jsx` | `escrow_payments`(request_id·company_id·total_amount·current_step·status·expected_end_date 015) · 계약 준비 RPC 089·091·092 · 사업자 필요(116) · 동의 기록 `user_consents`(121) | PARTIAL — **전자서명 없음** | 계약 금액·단계·예정 종료일과 약관 동의가 계약 단위로 기록된다. (전자서명·계약서 파일은 아직 없음) |
| 09 | 단계별 승인 | `EscrowScreen.jsx` · `components/v3/JourneyNow.jsx` | `escrow_action`(136 · 토큰 당사자) · `escrow_payouts` 비율(112: <500만 30/70 · ≥500만 10/20/40/30 · 사업자 없음 100) · 48시간 자동 승인 · 분쟁 상태 | READY(장부) · 실제 지급 **없음** | 착공·중간·완료를 고객이 확인·승인하는 단계 구조가 있고, 공사 규모에 따라 서버가 단계 비율을 정한다. (현재 실제 송금 없음) |
| 10 | 업체검증 | 업체 `screens/DocumentCenterScreen.jsx` · 관리자 `components/AdminDocumentReviewModal.jsx` · 엠블럼 `components/TrustEmblems.jsx` | `company_documents`(review_status: draft/submitted/reviewing/approved/held/rejected) · 서류 종류: 사업자등록증·시공보험증권·통장사본·자격증/면허 등(`constants/documentTemplates.js`) · 관리자 RPC 118 · 비공개 버킷+서명 주소 · 본인인증 PortOne(102, 업체 가입) | READY (S2·S3 수정 필요) | 업체가 제출한 사업자등록증·보험 등은 관리자가 승인·보류·반려하며, 승인된 증빙만 고객에게 엠블럼으로 보인다. |
| 11 | 프로젝트 증빙관리 | 관리자 `components/ProjectEvidenceManagement.jsx`(A4 분쟁 증빙 인쇄 315행) · `components/EvidenceTimelineDashboard.jsx` · `lib/evidenceTimeline.js` | 체크포인트·단계 사진·채팅·계약을 요청 단위로 모음 · 체크포인트 완결성 계산 | READY | 관리자는 한 공사의 위치·사진·대화·계약 기록을 시간순으로 모아 보고 한 장으로 출력할 수 있다. |
| 12 | 후기 | `screens/ReviewScreen.jsx` · `components/ReviewModal.jsx` | `reviews`(rating·quality/schedule/communication/price_score·would_recontract·photos·contract_id 087) · 공간온도 서버 계산(109) · 밖 공사 후기 분리(151) | READY | 후기는 계약 단위로 한 번만 쓰고, 품질·일정·소통 점수가 따로 남으며, 플랫폼 밖 공사 후기는 평점에 넣지 않는다. |

보조 증거: 직거래 의심 감지(`constants/directDeal.js` → `direct_deal_reports` 012) · 채팅 신고(`ChatScreen.jsx:609`) · 분쟁 탭(관리자) · 추가견적 정책(033).

## 5. 캡처 목록

### 이미 있는 실제 화면 캡처(스토어용 · 실제 앱 화면 · 저장소)
`store/apple-ko/`: 01 랜딩 · 02 홈 · 03 공간 고르기 · 04 시공 사례 상세 · 05 시공 사례 · 06 약관 동의 · 07 지도 · 08 라운지 · 09 마이 · 10 파트너(업체 소개).
(01 은 «BETA» 표시를 지운 수정본 — 스토어 제출용. 지원서에는 BETA 표시 제거 등 편집 여부와 당시 상태를 명시해야 함)

### 지원서에 필요한데 아직 없는 캡처(허구 UI 금지 — 실제 계정·실제 데이터로 찍어야 함)
| 필요 캡처 | 찍는 방법(AI 수행 조건) |
|---|---|
| 견적요청서 작성 · 제출 완료 | 운영 접속 + 시험 고객 계정 |
| 업체 입찰 카드 · 견적 비교 | 시험 업체 계정 입찰 1건 |
| 업체 서류 제출 · 관리자 승인 화면 | 관리자 계정 |
| 현장방문 GPS 기록 · 착공/중간/완료 보고 | 시험 공사 1건(위치 권한) |
| 관리자 프로젝트 증빙관리 · 분쟁 증빙 인쇄 | 위 공사 뒤 관리자 |
| 후기 | 위 공사 완료 뒤 |
조건: 작업 환경에 운영 사이트 접속 허용 + 시험 계정 로그인 수단(심사용 로그인 번호 `APP_REVIEW_PHONE/CODE` 를 쓰면 문자 없이 가능 — `store/APPSTORE-ko.md`).
시험 데이터는 «시험» 표시 계정으로 만들고 캡처 뒤 숨김 처리(삭제 금지 원칙).

## 6. 구조(실제 코드 기준)

```
[고객] ─ 휴대폰 인증(send-otp/verify-otp · 서버 서명 토큰)
  ↓
[견적요청] requests ──(업체 알림 110·153)──▶ [업체]
  ↓                                         ↓ 서류 제출 company_documents → 관리자 승인(118) → companies.verified·엠블럼
[입찰] bids (사업자 확인 업체만 · 최대 5곳)
  ↓ 고객 선택
[현장방문] site_visits ── GPS 체크포인트(site_visit) · 실측 사진
  ↓
[최종견적] estimates(items·total_price·사진) ── 추가견적(예외) change orders
  ↓
[계약기록] escrow_payments ── 고객 GPS(contract) · 약관 동의 user_consents
  ↓
[공정 체크포인트] 착공·중간·완료: GPS(start/middle/complete) + phase_photos → 고객 승인(escrow_action) → escrow_payouts(장부)
  ↓
[후기] reviews(계약 단위 · 세부 점수) → 공간온도(109)
  ↓
[신뢰 데이터] 업체 엠블럼·공간온도·후기·체크포인트 완결성 · 관리자 증빙관리(A4 출력)
곁가지: 채팅 chats(대화 기록 · 직거래 감지 direct_deal_reports · 신고) · 알림 notifications/push_logs
```
기술: React 18 + Vite(SPA) · Supabase(Postgres·RLS·Storage·Realtime) · Vercel(서버 함수·cron) · Solapi(문자) · Kakao Maps SDK(지도·주소 변환) · 토스페이먼츠(코드, 베타라 닫힘) · PortOne(본인인증) · FCM(푸시) · 안드로이드 TWA · 아이폰 Expo 쉘(저장소 밖) · 라운지 글 AI(OpenRouter, 서버 전용).

## 7. AI/R&D 층 — 현재와 미래 분리

| 구분 | 내용 | 상태 |
|---|---|---|
| CURRENT | 거래 기록(요청→후기) · 견적(항목 jsonb) · GPS 5시점 · 단계 사진 · 채팅 · 공정 단계·승인 · 후기 세부 점수 · 분쟁/신고/직거래 감지 | READY(코드) |
| CURRENT(기반만) | `ai_training_snapshots`·`space_price_index`·요청/견적 AI 칸(013) · 가격 인덱스 자동 집계 트리거 | **CODE_EXISTS — 입력값이 안 채워짐**(아래 8) |
| R&D | 견적 항목 자동 구조화 · 공사비 적정성 분석 · 공정 사진 단계 비교 · 일정/승인 이상신호 · 프로젝트 위험신호 · 시공 신뢰 데이터 모델 | **PLANNED / NOT_IMPLEMENTED** |
| 있음(사업 무관) | 라운지 글 AI 작성(OpenRouter) | CODE_EXISTS |

## 8. 데이터 확보 가능성

| 데이터 | source(table·field) | 지금 쌓이나 | 현재 양 | 라벨 가능성 | 개인정보 위험 |
|---|---|---|---|---|---|
| 요청 | requests: area·space_type·size·style·description·budget_min/max·created_at | 예 | NO_DATA | 공간 유형·예산 구간(이미 구조화) | 중 — 설명에 주소·연락처 가능 → 비식별 필요 |
| 입찰가 | bids: price·status·company_id | 예 | NO_DATA | 선택/비선택(자연 라벨) | 낮음 |
| 최종견적 | estimates: items(jsonb)·total_price·duration_days·final_quote_photo_urls | 예 | NO_DATA | 항목 표준화 필요(자유 입력) | 낮음 |
| AI 칸 | requests.space_size_m2·building_type·region_code · estimates.material_grade·labor_ratio | **아니오 — 앱이 값을 넣지 않음**(src 에 쓰는 코드 없음) | UNKNOWN(Phase 2 운영 schema 확인 참조) | — | — |
| 가격 인덱스 | space_price_index(트리거) | **아니오 — 위 칸이 비어 집계 조건 불충족** | UNKNOWN(Phase 2 운영 schema 확인 참조) | — | 낮음 |
| 계약·공정 | escrow_payments: total_amount·current_step·status·expected_end_date · escrow_payouts: stage·amount·status·phase_duration_days·delay_days | 예(지연 칸은 채우는 코드 확인 필요) | NO_DATA | 지연/정상 · 분쟁 여부 | 중(금액) |
| GPS | project_checkpoints 전 칸 | 예 | NO_DATA | 체크포인트 완결성 · 현장 일치 | **높음(위치)** — 1회 캡처·좌표 관리자만 |
| 사진 | phase_photos · estimates 사진 · 후기 사진 | 예 | NO_DATA | 공정 단계(단계 번호가 라벨) | 중(실내 사진) |
| 채팅 | chats: room_id·sender_type·text·read_at | 예 | NO_DATA | 직거래 키워드(자동 라벨) | **높음** — S1 수정 전 공개 위험 |
| 후기 | reviews: rating·세부 점수 4종·would_recontract | 예 | NO_DATA | 만족도(자연 라벨) | 낮음 |
| 분쟁·신고 | escrow_payments.dispute_status · direct_deal_reports.trigger_type · 신고 | 예 | NO_DATA | 분쟁/직거래 라벨 | 중 |

결론: **라벨이 자연히 붙는 데이터(선택 입찰·단계 번호·후기 점수·분쟁 여부)는 쌓이는 구조**다. 다만 공사비 모델에 필요한 **면적·건물유형·자재등급·지역코드는 지금 입력받지 않는다** — 지원금 과제 1순위(데이터 표준화)의 근거가 된다. 현재 양은 운영 DB 확인 전까지 NO_DATA.
