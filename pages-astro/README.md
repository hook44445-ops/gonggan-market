# 공간마켓 업체 공개 페이지 (Astro)

`/p/*` 공개 읽기 화면만 서버에서 HTML로 만든다. React 앱·운영 rewrite·SQL·운영 환경변수는 이 PR에서 변경하지 않는다. 커버 6장과 빈 상태 2장은 PR #826의 대표 승인 자산을 재사용한다.

## 로컬 실행

Node 22.12 이상. `npm ci`, `npm test`, `npm run dev`, `npm run build`.
`.env.example`을 참고해 **대표가** Supabase URL과 anon 키를 설정한다. 서비스 역할 키는 사용하지 않는다. 환경변수가 없거나 DB에 문제가 생기면 503/no-store로 표시하고, 없는 업체만 404/noindex로 처리한다.

읽기 데이터: companies의 공개 표시 필드, portfolios 12개, published 상태이며 숨김·삭제되지 않은 계약 후기, 별도 external_reviews 5개. 계약 후기 집계는 페이지 제한에 잘리지 않도록 이어 읽는다. 외부 후기는 계약 후기 평균·건수·레벨에 넣지 않는다.

원본 규칙: 앱의 `TrustEmblems`, `guarantee`, `growth`, `companyCover`, `companySlug`, `testCompany`, `siteSeo`, `referral`, `appInstall`. Astro는 독립 Vercel 루트에서 빌드되어야 하므로 표시 규칙을 출처 주석과 함께 복사했다. 변경 시 앱을 기준으로 같이 갱신한다.

## 운영 전환 전 대표가 할 것

1. Vercel 새 프로젝트 `gonggan-pages`, Root Directory `pages-astro`, Node 24. 환경변수 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SITE_URL=https://gongganland.com`. Apple 등록 뒤 `APP_STORE_ID`, Play 공개 뒤 `PLAY_PUBLIC=1`. 현재 비공개 테스트면 0.
2. 새 프로젝트 미리보기에서 실제 업체 UUID/한글 slug/사례 있음/없음/없는 주소를 확인한다. 로컬 fixture 검증은 운영 DB·정책 검증을 대신하지 않는다.
3. 별도 **운영 전환 PR**에서 아래 순서로 기존 `vercel.json.rewrites` 맨 앞에 추가한다. 실제 도메인을 확인하기 전 임의 도메인을 커밋하지 않는다.

```json
[
  {"source":"/p/:ref", "has":[{"type":"query","key":"app","value":"1"}], "destination":"/index.html"},
  {"source":"/p/:ref", "has":[{"type":"query","key":"write","value":"1"}], "destination":"/index.html"},
  {"source":"/p/:path*", "destination":"https://<확인된-gonggan-pages-도메인>/p/:path*"}
]
```

첫 두 규칙은 필수다. 151 이후 `?write=1` 후기 링크와 로그인 후 복귀를 React에 남겨야 한다. 이 예외 없이 `/p/*`를 모두 Astro로 보내면 후기를 쓰지 못하고 되돌아오는 문제가 생긴다. Astro의 후기 작성 링크는 `?write=1&app=1`을 사용한다.

4. `/p/sitemap.xml`은 이 프로젝트가 제공한다. 운영 확인 후 별도 PR로 기존 사이트맵과 연결한다. 기존 사이트맵에 빈/미배포 주소를 추가하지 않는다.
5. 대표가 머지한 뒤 카카오 미리보기, 추천 코드→가입, 안드로이드 배너, 후기 쓰기→로그인→복귀를 실기기로 확인한다. 코드·폰 번호·키 입력 및 실제 가입·후기 작성은 대표가 한다.

## 경로·캐시·되돌리기

- CSS는 HTML에 넣고, Astro JS는 `/p/_astro/`, 그림은 `public/p/images/`에 둔다. `/p/*`만 외부 rewrite할 때 CSS·JS·그림이 원래 React 프로젝트로 잘못 가지 않게 전용 경로를 사용한다.
- 업체 200 응답: `s-maxage=600, stale-while-revalidate=86400`. 404/503: no-store. 503에는 Retry-After 60.
- OG는 실제 시공 사진→업체 업로드 커버→공종별 분위기 그림 순이다. 기본 그림을 JSON-LD의 실제 업체 사진으로 등록하지 않는다.
- 초대 `?ref`는 기존 `gonggan_pending_ref={code,at}` 형식에 보관한다. 같은 도메인 rewrite 후에 앱과 저장소를 공유한다. 별도 preview 도메인에서 가입까지 이어지는지는 보장하지 않는다.
- 운영 전환을 되돌릴 때 새 외부 rewrite만 제거한다. 기존 React 라우트와 봇 프리렌더는 남겨 둔다.

## 검증 범위

### 2026-09-29 방문 집계·견적 연결

- 검증: `npm test` 14개 통과, `npm run build` 성공. 합성 REST 데이터 + 실제 빌드 렌더러/Chrome 390px에서 첫 방문 1회·새로고침 추가 없음·주인 제외, 견적 저장값/상대 홈 링크/초대 코드 공존/저장 차단 폴백을 확인했다. 실행 JS는 인라인 2,674바이트, 외부 JS 0개(기존 기록 1,457바이트 대비 +1,217). 성능 점수는 이번에 재측정하지 않았다.

- `PageView.astro`의 브라우저 스크립트만 anon RPC `company_page_view`를 POST한다. SSR에서는 호출하지 않는다. `gonggan_pv:<업체ID>`에 한국 날짜를 저장하며 앱의 `gonggan_user.id`가 업체 주인과 같으면 제외한다. 저장소 차단 시 집계를 건너뛰고 HTTP/통신 실패 시 당일 표시를 해제해 다음 방문에 재시도한다. 동시 탭 경합·저장소 삭제까지 서버가 중복 방지하는 방식은 아니다.
- 견적 버튼에 업체 알림 안내를 표시하고 선택 업체 값 저장 후 같은 도메인의 `/`로 이동한다. 운영 rewrite·SQL·키·환경변수 변경은 없다.
- 운영 전환 전 실제 폰 2대로 견적 클릭→로그인→요청 저장→업체 폰 알림 및 ⭐ 배지, 방문 수 +1/새로고침 시 유지/주인 방문 제외를 확인한다. 미리보기 도메인은 앱과 저장소를 공유하지 않는다.
- 초대 코드 저장·주소 정리와 `?write=1`/`?app=1` React 예외는 유지한다. 선택 사항인 초대 환영 띠와 추천 전용 OG 문안의 Astro 동등성은 이번 변경 범위 밖이며 OG 운영 전환 전에 확인한다.

단위 테스트는 DB 오류/구형 스키마/숨겨진 데이터 필터/계약·외부 후기 분리/공종 커버/사이트맵을 검증한다. 운영 계정과 DB를 수정하지 않는다. 390px fixture 캡처는 홍보용 실제 시공 실적이 아니다.

2026-09-29 로컬 결과: `npm test` 8개 통과, `npm run build` 성공. Vercel 산출물의 실제 fetch 핸들러에 합성 REST 데이터를 연결하고 Chrome 390px에서 사례 없음/있음/404를 캡처했다. 503/no-store, 한글 주소, JS 비활성 상태의 본문, 이미지 로딩·가로 넘침, 사진 확대/ESC 닫기, 초대 코드 저장·주소 정리, 비공개 Play 안내·닫기 유지가 통과했다. 계약 후기 2점과 외부 후기 5점을 넣었을 때 계약 집계는 2.0/1건이었다. 실행용 JS는 인라인과 외부 스크립트를 합쳐 비압축 1,457바이트였다. 실제 Supabase RLS·Vercel 캐시·카카오 미리보기·실제 가입 연동은 운영 전환 전 확인이 필요하다.

### 모바일 성능: 목표 미달 — 운영 전환 보류

Lighthouse 13.5.0 기본 모바일 설정, 로컬 Vercel 렌더러와 합성 REST 데이터에서 최종 **성능 81 / 접근성 100 / SEO 100**. 요청된 성능 90점은 아직 달성하지 못했다. 최초 55점에는 호스트 CPU 경고가 있었고, 이미지 최적화 후 74점, 화면 밖 레이아웃 지연 후 82점, 한국어 시스템 글꼴 우선 적용 후 최종 81점이었다. 실행 환경 차이가 포함되므로 점수 변화 전체를 코드 효과로 단정하지 않는다.

- 기본 화면의 작은 그림 5개를 표시 크기의 2배 사본으로 바꾸어 합계 61,872 → 22,838바이트(약 63% 감소). 원본을 보존하고 새 파일명으로 연결했다.
- 이미지 캐시 1일, 화면 밖 section/footer의 `content-visibility`, 다운로드 없는 시스템 글꼴을 사용한다.
- 마지막 변경 후에도 프로덕션 빌드와 390px 기능·이미지 회귀 검증은 통과했다.
- 증거: 대표 PC `D:\project\codex-growth\company-covers\astro-verification`의 캡처 3장, Lighthouse JSON 4개 및 검증 스크립트. 최초 CLI는 보고서 저장 후 임시 Chrome 폴더 정리에서 EPERM으로 종료했으며, 이후 측정은 직접 관리한 Chrome에서 정상 종료했다.
- 다음: 별도 Vercel 미리보기의 실제 업체 데이터로 성능/권한을 측정하고 남은 레이아웃·긴 작업 병목을 해결한다. 90점 통과와 실제 데이터 검증 전에는 운영 rewrite를 추가하거나 전환 완료로 처리하지 않는다.
- #831과 같은 `gonggan_pref_company={id,name,ownerId,at,opened:false}`를 견적 버튼 클릭 때 저장한 뒤 앱 홈으로 이동한다. 방문만으로 업체 선택을 바꾸지 않는다. 앱의 `src/lib/preferredCompany.js`와 같은 구현을 독립 빌드에 복사했으므로 정책 변경 시 함께 갱신한다. 로컬 Chrome에서 클릭·업체 주인 ID·초대 코드 공존·저장 차단 시 링크 유지, 단위 테스트에서 3일 만료·자기 업체 알림 제외를 검증했다. 실제 로그인 후 요청서와 알림 발송은 대표의 운영 검증이 남아 있다. 미리보기 도메인은 운영 앱과 localStorage를 공유하지 않으므로 실제 같은 도메인 연결에서 최종 확인한다.
