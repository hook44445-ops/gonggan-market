# Admin OS 중복 구현 여부 조사 보고서

> 목적: 관리자(Admin) 기능을 추가하기 전에 **이미 구현된 기능과 중복되는지** 조사한다.
> 이 문서는 **조사 전용**이다. 코드/DB/RPC/UI 변경은 일절 포함하지 않는다.
> 조사 기준: `src/screens`, `src/components`, `src/lib`, `src/hooks`, `src/services`, `supabase/migrations`, `api/`.

## 0. 결론 한 줄 요약

> **공간마켓 Admin은 이미 5대분류 · 22개 탭 규모로 광범위하게 구현되어 있다.**
> 신규 "Admin OS"는 **기능을 새로 만드는 것이 아니라**, 이미 흩어져 있는 기능(특히 **신고 시스템**)을
> **통합·정합화**하는 것이 핵심이다. 새로 만들 가치가 있는 것은 **신고 단일화**와 **고객 강제 로그아웃** 정도다.

---

## 1. 현재 Admin IA (이미 존재하는 메뉴)

`src/screens/AdminScreen.jsx` (≈5,540줄) + `src/components/AdminCategoryNav.jsx`.
대분류 5개 / 소분류(탭) 22개. 운영자 권한(`admin_permissions`, can_*)으로 대분류 노출 제어.

| 대분류 | 소분류(탭) |
|---|---|
| 🏢 운영 | 대시보드 · 업체관리 · 고객관리 · 파트너상담 · 숨김요청관리 |
| 💳 거래 | 거래관리 · 결제관리 · 정산관리 · 분쟁관리 |
| 📍 프로젝트증빙 | 프로젝트증빙관리(GPS 흐름) · 직거래 의심 |
| 📝 콘텐츠 | 리뷰관리 · 리뷰 어드민 · 포토후기 시딩 · 라운지관리 · 라운지 시딩 · 신고관리 |
| ⚙️ 시스템 | 재무대시보드 · 알림 · 운영자 설정 · 정리도구 · 관리자로그 |

권한 게이트는 메뉴(`adminCategories`)와 본문(`canAccessTab`) 양쪽에 모두 적용됨(`AdminScreen.jsx:3371-3391`).

---

## 2. 조사 대상별 결과표

| # | 기능 | 구현 | 위치 | 중복/재사용 | 추가 필요 |
|---|---|:---:|---|---|:---:|
| 1 | 업체 승인 | **O** | `adminReviewCompany` / companies 탭 | 없음 | X |
| 1 | 업체 보류·정지·복구 | **O** | `adminSetCompanyStatus` + `COMPANY_STATUS_META` | 없음 | X |
| 1 | 상태(PENDING/ACTIVE/PAUSED/SUSPENDED/BLACKLISTED) | **O** | `constants/index.js:191-207` (+TEMP_RESTRICTED) | 없음 | X |
| 2 | 활동 제한 | **O** | `adminSetUserStatus("TEMP_RESTRICTED")` | 없음 | X |
| 2 | 계정 정지 | **O** | `adminSetUserStatus("SUSPENDED"/"BLACKLISTED")` | 없음 | X |
| 2 | 강제 로그아웃 | **X** | — | 없음(세션 무효화 미존재) | **O** |
| 2 | 토큰 지급/회수 | **O** | `adminAdjustUserTokens` (GRANT/REVOKE) | 없음 | X |
| 3 | 신고관리(전체) | **△** | 3개 시스템으로 분절 | **재사용/통합 대상** | **O** |
| 3 | 라운지 신고(글/댓글/스토리/사용자) | **△** | `ReportModal.jsx` → **localStorage** | DB 미연동 | **O** |
| 3 | 채팅 신고 | **O** | `ChatScreen` → `reportDirectDeal` → `direct_deal_reports` | 없음 | X |
| 3 | 리뷰/업체/고객 신고 | **X** | `customer_reports` 정의만 존재(프로덕션 테이블 없음) | — | **O** |
| 4 | 분쟁관리 | **O** | `getDisputePayments` / `adminResolveDispute` / disputes 탭 | 없음 | X |
| 4 | GPS·사진·계약·체크포인트·증빙 연결 | **O** | `ProjectEvidenceManagement.jsx` 증빙 상세 모달 | **재사용 대상** | X |
| 5 | 관리자 로그(admin_logs) | **O** | `AdminLogView.jsx` + 20개 함수에서 자동 기록 | 없음 | X |
| 6 | 알림(notifications) | **△** | `createNotification`/`getUserNotifications` (탭은 본인 테스트 발송만) | 운영툴 부족 | △ |
| 7 | 리뷰 숨김/삭제/복구 | **O** | `adminHideReview`/`adminSoftDeleteReview`/`adminRestoreReview` | 마이그레이션 의존 | X |
| 8 | 프로젝트/업체/고객 통합검색 | **O** | `AdminGlobalSearch.jsx` | **재사용 대상** | X |

(O=구현됨 / △=부분·분절 / X=미구현)

---

## 3. 영역별 상세

### 1) 업체관리 — ✅ 완성
- 승인/반려: `adminReviewCompany(companyId, adminId, docStatus, rejectNote)` (`supabase.js:1322`).
- 상태 변경: `adminSetCompanyStatus(companyId, adminId, companyStatus, reason)` (`supabase.js:1386`).
- 상태값: `COMPANY_STATUS` = PENDING/ACTIVE/PAUSED/SUSPENDED/BLACKLISTED **+ TEMP_RESTRICTED(활동 제한)** — 요청한 5종을 모두 포함하고 1종을 더 가짐.
- UI: 업체 상세에서 상태 버튼 그리드 + 사유 입력(`AdminScreen.jsx:5178`). 배지/공간보증(`adminSetCompanyBadge`, `adminSetGuarantee`)까지 존재.
- → **추가 구현 불필요. 그대로 재사용.**

### 2) 고객관리 — ✅ 대부분 완성, 강제 로그아웃만 공백
- 상태 변경: `adminSetUserStatus(userId, adminId, status, reason)` → `users.account_status` 갱신 + `admin_logs` 기록(`supabase.js:2151`). 활동제한/계정정지 모두 이 함수로 처리.
- 토큰 지급/회수: `adminAdjustUserTokens` — delta>0 GRANT / delta<0 REVOKE, `admin_logs` 기록(`supabase.js:2198`).
- 공간온도 조정: `adminAdjustSpaceTemp`도 존재.
- **공백: 강제 로그아웃** — 세션/토큰 무효화 로직이 코드·DB에 없음. (account_status로 차단은 가능하나, 활성 세션 즉시 종료는 미구현)
- → **강제 로그아웃만 신규 검토 대상.** 나머지는 재사용.

### 3) 신고관리 — ⚠️ **가장 큰 중복/분절. Admin OS의 핵심 통합 포인트**
현재 신고는 **3개 시스템으로 흩어져 있음**:
1. **라운지 신고**(글/댓글/스토리/사용자): `components/lounge/ReportModal.jsx` → **`localStorage("lounge_reports")`에만 저장**(`ReportModal.jsx:28`). 관리자 신고관리 화면도 동일 localStorage를 읽음(`AdminScreen.jsx:424`). → **서버에 도달하지 않음. 기기 로컬 한정.**
2. **직거래/포트폴리오/채팅 신고**: `direct_deal_reports` 테이블(DB) — `reportDirectDeal`(채팅), `PortfolioReportModal`(이미지) 등이 사용. 신고관리 탭의 실제 DB 조회는 이 테이블 기준(`AdminScreen.jsx:3119-3131`).
3. **`customer_reports`**: `supabase.js:1908-1928`에 함수는 있으나, 코드 주석상 **"운영 DB에 customer_reports 테이블이 없음"**(`AdminScreen.jsx:3120`). 사실상 미사용.
- 별도 DB 테이블도 존재: `lounge_reports`(`getLoungeReports`, `supabase.js:2228`) — ReportModal이 여기에 쓰지 않아 **이름만 같고 연결 안 됨**.
- **업체 신고 / 리뷰 신고 제출 경로는 없음.**
- → **Admin OS 1순위 작업: 신고 단일화.** 모든 신고를 하나의 테이블/엔드포인트로 모으고, 신고관리 탭이 그것만 보게 한다.

### 4) 분쟁관리 — ✅ 완성 + 증빙 연결 이미 존재
- 분쟁 조회/해결: `getDisputePayments` / `adminResolveDispute(paymentId, adminId, resolution, reason)` (`supabase.js:2033`), disputes 탭(`AdminScreen.jsx:3060`). 상태 메타 `DISPUTE_STATUS_META` 7종(`constants/index.js:228`).
- **GPS/사진/계약/체크포인트/증빙 연결**: `ProjectEvidenceManagement.jsx`의 증빙 상세 모달이 이미 **타임라인 · GPS · 사진 · 채팅 · 계약·결제 · 분쟁·신고** 탭으로 통합(`ProjectEvidenceManagement.jsx:274-327`). `direct_deal_reports`, `checkpoints`, `escrow`까지 한 화면에서 파생.
- → **추가 화면 불필요. 분쟁↔증빙은 이미 연결됨. 재사용.**

### 5) 관리자 로그 — ✅ 완성
- 조회 화면: `AdminLogView.jsx`(읽기 전용, admin_logs 탭). 액션 한글 라벨 매핑 보유.
- 기록 방식: `supabase.js` 내 **20곳**에서 `admin_logs.insert`로 자동 기록(상태변경/토큰/리뷰/라운지/운영자/정산 등). 일부는 RPC 내부에서 기록.
- → **그대로 재사용. 신규 작업 시 동일 패턴(admin_logs.insert)만 따르면 됨.**

### 6) 알림 — △ 인프라는 있으나 운영툴 부족
- 생성: `createNotification` (다수 admin 액션에서 호출 — 업체 상태변경/배지 등). 푸시 큐 `api/push/enqueue`.
- 조회: `getUserNotifications` — 사용자별. 알림 탭은 **관리자 본인에게 테스트 1건 발송**만 가능(`AdminScreen.jsx:4891-4922`).
- **공백: 전체 공지/세그먼트 발송(broadcast) 등 관리자 알림 운영툴 없음.**
- → 인프라(notifications/push) 재사용. 운영 알림 발송 도구는 선택적 추가 대상.

### 7) 리뷰관리 — ✅ 완성(마이그레이션 의존)
- `adminHideReview` / `adminSoftDeleteReview` / `adminRestoreReview` (`supabase.js:738-759`), 리뷰 어드민 탭에서 숨김·삭제·복구 UI 완비(`AdminScreen.jsx:169-381`).
- 단, `008_reviews_admin_columns.sql` 미적용 환경에서는 버튼 비활성 안내(`AdminScreen.jsx:255-257`). → 기능은 구현됨, **DB 마이그레이션 적용 여부만 확인 필요.**

### 8) 프로젝트/업체/고객 통합검색 — ✅ 완성
- `AdminGlobalSearch.jsx`: 고객명·업체명·전화번호·사업자번호·request_id·contract_id·order_id·대표자명 부분검색. 데이터는 기존 `getCompanies`/`getAdminProjectFlow`/`getPaymentOrders`/`getPartnerLeads` 재사용(신규 DB 없음). 결과 클릭 시 해당 탭 이동.
- → **추가 검색기능 불필요. 재사용.**

---

## 4. 최종 보고 (요청 7항목)

### 4-1. 이미 구현된 기능 (재사용)
업체 승인/상태변경(전 상태값), 고객 상태변경·토큰 지급/회수·온도조정, 분쟁관리, **증빙 통합 모달(GPS/사진/채팅/계약/분쟁)**, 관리자 로그(조회+자동기록), 리뷰 숨김/삭제/복구, **통합검색(프로젝트/업체/고객)**, 결제·정산·재무 대시보드, 라운지/시딩 관리, 운영자 권한 시스템.

### 4-2. 중복 구현될 위험이 큰 기능 (새로 만들지 말 것)
- **프로젝트/업체/고객 검색** → `AdminGlobalSearch` 이미 존재.
- **분쟁↔증빙 화면** → `ProjectEvidenceManagement` 증빙 상세 모달 이미 존재.
- **업체/고객 상태관리 화면** → companies/customers 탭 이미 존재.
- **관리자 로그 화면** → `AdminLogView` 이미 존재.

### 4-3. 부족한(미구현) 기능
1. **신고 단일화** — 라운지 신고가 localStorage에만 저장(서버 미도달), `customer_reports` 프로덕션 테이블 없음, 업체/리뷰 신고 제출 경로 없음.
2. **고객 강제 로그아웃** — 세션/토큰 무효화 미구현.
3. (선택) **관리자 알림 발송 도구**(broadcast/세그먼트).

### 4-4. 추천 구현 순서
1. **신고 시스템 통합** (1순위): 단일 reports 테이블/RPC 설계 → 라운지 ReportModal을 DB 연동으로 전환 → 신고관리 탭이 통합 소스만 조회. (운영 리스크가 가장 큰 공백)
2. **고객 강제 로그아웃**: `account_status` 기반 차단 + 세션 무효화(예: 토큰 버전 컬럼) 검토.
3. (선택) **관리자 알림 발송 도구**: 기존 `createNotification`+push 큐 재사용.

### 4-5. 절대 건드리면 안 되는 기능 (회귀 위험 高)
- `adminSetCompanyStatus` / `adminSetUserStatus` / `adminAdjustUserTokens` 및 `admin_logs` 기록 패턴 — 감사 추적의 근간.
- `direct_deal_reports` 파이프라인(채팅 키워드 감지 → 직거래 의심) — 거래 안전 핵심.
- `ProjectEvidenceManagement` 증빙 파생 로직(escrow/checkpoints/GPS).
- 운영자 권한 게이트(`adminCategories`/`canAccessTab`, `admin_permissions`).
- 결제·정산·에스크로(`adminResolveDispute`, `adminSetPayoutStatus`, escrow).

### 4-6. 회귀(Regression) 위험 요소
- **신고 데이터 마이그레이션**: 라운지 신고를 localStorage→DB로 옮길 때, 신고관리 탭(`AdminScreen.jsx:424`)이 여전히 localStorage를 읽으면 **신규 신고가 화면에서 사라짐**. 읽기/쓰기 양쪽을 동시에 전환해야 함.
- **`customer_reports` 가정**: 코드가 "테이블 없음"을 전제로 `direct_deal_reports`로 우회 중(`AdminScreen.jsx:3120`). 테이블을 새로 만들면 우회 로직과 충돌 가능.
- **리뷰 admin 컬럼**: `008_reviews_admin_columns.sql` 미적용 환경에서 숨김/삭제 버튼 비활성 — 마이그레이션 상태 확인 없이 동작 가정 금지.
- **권한 게이트 우회**: 신규 탭/액션 추가 시 `CATEGORIES_DEF`+`TAB_PERM` 등록 누락하면 운영자에게 무단 노출.

### 4-7. 재사용 가능한 부분 (신규 기능에서 활용)
- 감사 로그: 모든 변경에 `admin_logs.insert(action, target_type, target_id, before_val, after_val, reason)` 패턴.
- 알림/푸시: `createNotification` + `api/push/enqueue`.
- 검색: `AdminGlobalSearch`에 신규 신고 카테고리 결과 추가만으로 확장 가능.
- IA: `AdminCategoryNav` + `CATEGORIES_DEF`/`MAIN_TABS` 구조에 탭 추가만 하면 됨(신규 네비 불필요).
- 증빙: `ProjectEvidenceManagement` 모달에 신고 통합 결과를 끼워 넣으면 분쟁-신고 동선 일원화 가능.

---

## 핵심 원칙
> **새 기능을 만들기 전에 기존 기능을 최대한 재사용한다.**
> Admin OS의 목표는 기능 증식이 아니라 **분절된 신고/알림을 통합하고 운영 효율을 높이는 것**이다.
> 실제 신규 코드가 필요한 곳은 **① 신고 단일화 ② 강제 로그아웃 ③(선택) 알림 발송 도구** 세 가지로 좁혀진다.
