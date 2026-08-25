# 공간마켓 — 구축 성과 문서 (What has been built)

> 작성일 2026-08-07 · 근거: `hook44445-ops/gonggan-market` 저장소 코드·DB 스키마·마이그레이션 직접 조사.
> 목적: 지금까지 실제로 만들어진 것을 **과장 없이·근거와 함께** 기록한다. (계획이 아니라 코드에 존재하는 것만 적는다.)

---

## 0. 한눈에 보는 규모 (측정값)

| 지표 | 값 | 근거 |
|---|---|---|
| 개발 기간(현 이력 기준) | 2026-07-09 ~ 2026-08-07 (약 1개월 집중) | `git log` |
| 병합 PR | ~#654까지 | git 이력 |
| `src` 파일 수 | 329개 (전부 JS/JSX, TS 0) | `find src` |
| 화면(screens) | 27개 | `src/screens/*.jsx` |
| 컴포넌트 | 76개 | `src/components/*.jsx` |
| 도메인 로직 모듈(lib) | 118개 | `src/lib/*.js` |
| DB 마이그레이션 | 124개 파일(번호 001–098) | `supabase/migrations` |
| DB 테이블 | 약 32개 | `supabase/schema.sql` |
| 서버리스 함수 | **12/12** (Vercel Hobby 상한 만석) | `api/**` |
| 자동화 유닛 테스트 | 7개 파일 | `*.test.js` |
| 배포 | production 운영 중 (`gonggan-market-qkdh.vercel.app`) | 배포 URL |
| 모바일 | Android TWA 패키지 존재(Play 스토어용) | `android-twa/` |

> ⚠️ 규모가 크다는 것이 곧 "출시 준비 완료"를 뜻하지 않는다. 핵심 거래 흐름의 미해결 이슈는 인계지시서(`HANDOFF_INSTRUCTIONS.md`) §2에 별도로 정리했다.

---

## 1. 인증 · 계정 (완성도 높음)

- **전화번호 OTP 로그인**: `api/send-otp.js` / `api/verify-otp.js` (Twilio Verify).
- **기기 인증 + 계정 복원**: `src/lib/deviceAuth.js` — 인증된 기기에서는 OTP 없이 저장 계정 카드 선택(`AccountPicker.jsx`)으로 즉시 복원.
- **단일 계정 세션**: `localStorage`(`gonggan_user`) 기반, `supabase.auth`와 독립(`src/App.jsx`). → **3개 제품 단일 계정이 이미 달성됨.**
- **역할 체계**: 소비자(consumer) / 업체(company) / 운영자(operator, PIN 로그인) / 관리자(admin, 코드 로그인).
- **게스트 딥링크**: `/lounge/...` 공유 URL로 비회원이 회원가입 없이 읽기 진입(`ensureGuestId`).

## 2. 공간마켓 핵심 거래 흐름 (요청 → 견적 → 계약 → 안전결제 → 리뷰)

- **요청(requests)**: 고객 견적 요청 + 재요청(`request_reposts`). 마이그레이션 12건 — 가장 많이 다듬어진 도메인 중 하나.
- **견적(bids)**: 업체 입찰/비교(`BidCard`, `BidCompareCard`, `BidStatusScreen`).
- **채팅(chats)**: 고객↔업체 1:1(`ChatScreen`).
- **안전결제/에스크로**: `escrow_payments` / `escrow_payouts` / `payment_orders` / `payment_transactions` / `fee_config`, 결제 확정 `api/confirm-payment.js` (Toss Payments). 착공·중간·완료 **단계별 고객 승인** 후 분할 지급. **자동 송금·자동 환불은 의도적으로 미구현**(정책).
- **계약 부속**: 변경(`change_orders`), 범위(`contract_scopes`), 메모(`contract_notes`), 공정 사진(`phase_photos`), 분쟁 기록(`customer_reports`, `DisputeNotice`).
- **리뷰**: `reviews` + 고객 평가 모달(`CustomerEvaluationModal`, `ReviewScreen`).

## 3. 업체(공급자) 온보딩 · 검증

- **무인 입점 3스텝 위저드**(PR #650) — 실 API 유지.
- **서류**: `company_documents` — 사업자등록증, **대표자 신분증(선택) 업로드 풀구현 + 관리자 조회**(PR #652).
- **포트폴리오**: `portfolios` + 관리 패널(`PortfolioManagePanel`, `PortfolioScreen`).
- **검증 배지**: `CompanyVerificationBadges`, `GuaranteeBadge`.

## 4. 지역 매칭 · 지도

- **다중 지역(jsonb, 최대 2)**: 고객 `users.activity_regions` ∩ 업체 `companies.service_regions` (마이그레이션 010/011).
- **4단계 폴백 매칭**: exact → legacy text → 같은 시/도 → 전국 (`src/utils/regionMatching.js`).
- **지도**: Kakao Map(`KakaoMap.jsx`) + 실패 시 `MockMap` 폴백(제거 금지 정책).
- ⚠️ **미해결**: 지역 탭은 정상인데 지도 리스트가 tier-4(전국)로 떨어지는 이슈 — `HANDOFF_INSTRUCTIONS.md` §2 참조.

## 5. 공간라운지 (커뮤니티) — 마켓과 한 앱·한 DB

- **게시/상호작용**: `lounge_posts` + `lounge_comments` / `lounge_post_likes` / `lounge_comment_likes` / `lounge_saves` / `lounge_blocks` / `lounge_reports` / `lounge_categories`. **라운지 관련 마이그레이션 30건**으로 가장 많이 다듬어진 도메인.
- **1:1 대화 신청**: `lounge_chat_requests`(보낸/받은/수락).
- **스토리**: `LoungeStoryUploadScreen`, `LoungeStoryBar`.

## 6. 공간매거진 = 라운지 위 SEO 레이어 (별도 DB 없음)

- **매거진 뷰**: `src/lib/magazine.js` — `lounge_posts`를 매거진 섹션(오늘의 Space·Editor's Pick·Deep Article 등)으로 재구성하는 순수 함수(저장/테이블 없음).
- **외부 블로그 신디케이션**: `src/lib/blogPublisher.js` — 라운지 글 → 네이버 블로그(JAFA1) 발행 준비물 생성 → 검색 유입 선순환.

## 7. AI 콘텐츠·운영 자동화 (Phase 29–51, 라운지/매거진 축)

> 인상적이지만 **마켓 핵심 거래와는 분리된 축**이다. 출시 임계경로는 아니다(인계지시서 §4).

- **Editorial OS / Fusion Engine**: 주제 → 생성 → 품질 85+ 자동 보정 루프(생성→평가→보완→재평가) → 예약/즉시 발행 판단 → 일일 발행 예산(정기10/비정기5/총15).
- **AI Executive Office**(Phase 48–51): AI 품의서 + LLM 4인 검수 서명 + 총괄비서실장 결재 + 운영 로그(조직형 대시보드).
- **Mission Control / Server Autonomous**: 브라우저가 닫혀도 서버 cron이 운영(자가 감시·이상 징후·알림).
- **테스트**: `quality.test.js`, `editorialBoard.test.js`, `fusionPipeline.test.js`, `executiveOffice.test.js`, `publishMode.test.js`, `approvalDossier.test.js` — 이 자동화 축에 유닛 테스트가 집중.

## 8. 알림 · 관리자 · 운영

- **알림**: `notifications` + 인앱(`NotificationBell`, `NotificationInbox`) + 푸시(`api/push/enqueue.js`, `api/push/dispatch.js`, 매일 09:00 cron).
- **관리자 콘솔**: `AdminScreen` + 권한 게이팅(`can_operations` / `can_transactions` / `can_project_proof` / `can_contents` / `can_system`). **admin 관련 마이그레이션 32건**(RPC 다수) — KPI·정산·거래·문서 검토 관리 포함.

## 9. 법적 고지 · 신뢰 장치

- **약관/개인정보**: `LegalScreen`(`/terms`, `/privacy` 정적 라우트), `TermsModal`, `ConsentGate`, `BusinessInfoModal`.
- **통신판매업 신고번호 2026-성남중원-0463** 반영(단일 소스, PR #654).
- **보호 고지**: 공간안전결제 기반 보호·기록 안내(강제 환불·품질 감정 기관이 아님을 명시).

## 10. SEO · 인프라

- **SEO 함수**: `api/sitemap.js`, `api/robots.js`, `api/prerender.js`(`/lounge/:path*` rewrite로 프리렌더).
- **Cron**: 푸시 발송(09:00), 트렌드 체크/자율 사이클(06:00) — `vercel.json`.
- **배포**: Vercel(단일 프로젝트, catch-all rewrite SPA), Supabase, Android TWA.

---

## 11. 정직한 한계 (성과와 함께 반드시 읽을 것)

1. **핵심 거래 흐름에 미해결 이슈 존재** — 지역 매칭이 전국 폴백으로 떨어지는 문제(§4). 실사용 전 반드시 해결.
2. **서버리스 함수 12/12 만석** — 신규 기능이 함수를 요구하면 기존 통합/삭제가 강제됨.
3. **핵심(중개) 대비 비핵심(AI 콘텐츠 자동화) 코드 비중이 매우 큼** — 1인 유지보수 부담·복잡도의 근원. 출시 정리 필요(§4 of handoff).
4. **TypeScript 미사용**(전부 JS) — 지시서 전제(React+TS)와 다름. 대규모 앱에 타입 안전망이 없다.
5. **서명 키스토어가 저장소에 포함**(`android-twa/gonggan-release.keystore`) — 보안 점검 대상(인계지시서 §6).
6. **미확정 사업 파라미터** — 수수료율·정산 방식, 성공 지표 수치, 출시 시점.

> 다음 작업자는 이 문서와 함께 **`HANDOFF_INSTRUCTIONS.md`(인계지시서)** 를 반드시 읽고 시작할 것.
