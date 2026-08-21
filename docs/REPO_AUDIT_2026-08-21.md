# 공간마켓 저장소 점검 리포트

- 점검일: **2026-08-21**
- 대상 커밋: `1a2e702` (`feat: 공간안전결제(에스크로) 공개 안내 페이지 (#657)`)
- 점검 브랜치: `claude/repo-audit-release-prep-rcprbk`
- 점검 환경: Linux / Node **v22.22.2** / npm 10.9.7 / OpenJDK **21.0.10** / Gradle 8.7(wrapper)

---

## 0. 한눈에 보기

| 항목 | 결과 | 비고 |
|---|---|---|
| 의존성 설치 (`npm install`) | ✅ 통과 | 78 packages / 6s |
| 재현 설치 (`npm ci`) | ✅ 통과 | lockfileVersion 3, 정합 |
| 웹 빌드 (`npm run build`) | ✅ 통과 | 11.76s / 경고 1건(청크 크기) |
| 테스트 (`npm test`) | ✅ **67/67 통과** | `node:test`, 342ms |
| `npm audit` | ⚠️ 5건 (high 3) | **전부 devDependencies** — 런타임 무영향 |
| 안드로이드 빌드 | ⛔ **이 환경에서 검증 불가** | `dl.google.com` 이그레스 정책 차단 (§4) |
| 안드로이드 정적 검증 | ✅ 통과 | keystore 지문 ↔ assetlinks.json 일치 확인 |
| `.env.local.example` 정합성 | ❌ **불일치** | 14개 누락 / 3개 사용 안 함 (§3) |
| CI | ❌ 없음 | `.github/` 디렉터리 부재 |

**결론:** 웹 쪽은 설치·빌드·테스트가 모두 깨끗하게 통과합니다. 정식 출시를 막는 실질적 항목은
**(1) 안드로이드 Play 앱 서명 지문 누락, (2) targetSdk 35, (3) `.env` 문서 불일치,
(4) 관리자 코드가 브라우저 번들에 노출** 네 가지입니다. 자세한 내용은 §5.

---

## 1. 기술 스택

### 1-1. 프런트엔드
| 구분 | 내용 |
|---|---|
| 프레임워크 | **React 18.3.1** + ReactDOM 18.3.1 |
| 번들러 | **Vite 5.4.21** (`@vitejs/plugin-react` 4.x) |
| 언어 | **JS/JSX 전용** — TypeScript 파일 **0개** (`src` 331개 파일) |
| 라우팅 | **react-router 미사용**. `window.location.pathname` 수동 분기 + Vercel catch-all rewrite |
| 상태관리 | 라이브러리 없음 — React state + `src/state/` 자체 모듈 |
| 스타일 | CSS-in-JS 인라인 스타일 (디자인 토큰 `C`/`S`/`R` 상수) |
| 폰트 | Pretendard (jsDelivr CDN — 외부 의존) |

빌드 시 `vite.config.js`가 `git rev-parse --short HEAD`로 `__GIT_SHA__`를 주입합니다.

### 1-2. 백엔드 / 인프라
| 구분 | 내용 |
|---|---|
| DB | **Supabase** (Postgres + Storage + RLS), `@supabase/supabase-js` ^2.105.4 |
| 마이그레이션 | `supabase/migrations/` **125개** (최신 `099_space_token_purchase.sql`) |
| 서버리스 | **Vercel Functions — 12개 (Hobby 상한 12/12 만석)** |
| 인증 | 휴대폰 **OTP + localStorage(`gonggan_user`)** — `supabase.auth`와 **독립** |
| 결제 | **TossPayments** (client key는 브라우저, secret key는 `api/confirm-payment.js` 전용) |
| SMS | **solapi** ^6.0.1 (`api/send-otp.js`) |
| 푸시 | **FCM** (`public/firebase-messaging-sw.js` + TWA DelegationService 위임) |
| 지도 | **Kakao Maps JS SDK** + 실패 시 MockMap fallback |
| 크론 | Vercel Cron 2건 — 푸시 발송(09:00), 트렌드 수집(06:00) |
| 호스팅 | Vercel (`gongganmarket.com`) |

**Vercel 함수 12개 목록**
`admin/seed-posts`, `admin/users`, `confirm-payment`, `delete-account`, `prerender`,
`push/dispatch`, `push/enqueue`, `robots`, `send-otp`, `sitemap`, `trend/check-trends`, `verify-otp`

> ⚠️ **Hobby 플랜 상한(12)에 정확히 도달**했습니다. 신규 API 라우트를 추가하려면 기존 함수를 통합/삭제하거나 Pro 플랜으로 전환해야 합니다. `.vercelignore`가 `**/*.test.js`를 제외해 테스트 파일이 함수로 오집계되는 것을 이미 막고 있습니다.

### 1-3. 안드로이드 (TWA)
| 구분 | 값 |
|---|---|
| 방식 | **Trusted Web Activity** (Bubblewrap 생성) |
| 패키지 | `com.gonggansai.gongganmarket` |
| AGP / Gradle | **8.6.1** / **8.7** |
| compileSdk / targetSdk / minSdk | **35 / 35 / 23** |
| versionCode / versionName | **15 / 1.0.15** |
| 핵심 의존성 | `androidbrowserhelper:2.5.0` (2.7.2는 compileSdk 36 요구 → 의도적 다운그레이드, 주석에 근거 기록됨) |
| 로드 URL | `https://gongganmarket.com/` |
| 권한 | `POST_NOTIFICATIONS` (+ `AD_ID`는 manifest merger에서 **명시적 제거**) |

### 1-4. 테스트
`node --test` 기반 7개 스위트 — `api/push/enqueue`, `quality`, `editorialBoard`,
`fusionPipeline`, `publishMode`, `approvalDossier`, `executiveOffice`.
**핵심 거래 로직(에스크로·입찰·결제·지역매칭)에 대한 자동 테스트는 없습니다.**

---

## 2. 의존성 설치 및 빌드 검증

### 2-1. 설치 — ✅ 통과
```
npm install  → added 78 packages, audited 79 packages in 6s   (exit 0)
npm ci       → added 46 packages in 284ms                      (exit 0)
```
`package-lock.json`(lockfileVersion 3)과 `package.json`이 정합하며 재현 설치가 동작합니다.

> ℹ️ `package.json`에 **`engines` 필드가 없습니다.** Vercel/로컬/CI가 서로 다른 Node 메이저 버전을 쓸 수 있으므로 `"engines": { "node": ">=20" }` 명시를 권장합니다.

### 2-2. 웹 빌드 — ✅ 통과
```
vite v5.4.21 building for production...
✓ 373 modules transformed.
dist/index.html                    3.62 kB │ gzip:   1.63 kB
dist/assets/index-BX77si9H.js  2,100.40 kB │ gzip: 602.38 kB │ map: 6,664.71 kB
✓ built in 11.76s
```

경고/관찰 사항:
- **단일 청크 2.1MB (gzip 602KB)** — 코드 스플리팅이 전혀 없습니다. 모바일 우선 서비스에서 초기 로딩에 직접 영향을 줍니다. `AdminScreen.jsx`(8,264줄)·`MainApp.jsx`(5,862줄) 등 대형 화면을 `React.lazy` + 동적 `import()`로 분리하면 가장 효과가 큽니다.
- **`build.sourcemap: true`** — 7.1MB 소스맵이 production에 그대로 배포됩니다. 전체 원본 소스가 공개되며, §5-4의 관리자 코드 노출 문제를 증폭시킵니다.

### 2-3. 테스트 — ✅ 통과
```
# tests 67   # pass 67   # fail 0   # skipped 0   # duration_ms 342.2
```

### 2-4. 취약점 — ⚠️ 5건 (모두 개발 의존성)
| 심각도 | 패키지 | 내용 |
|---|---|---|
| high | `vite` | `<=6.4.2` |
| high | `postcss` | sourceMappingURL 경로 순회 → 임의 `.map` 파일 노출 |
| high | `nanoid` | 비보안 생성기 무한 루프 |
| moderate | `esbuild` | vite 전이 의존성 |
| low | `@babel/core` | `<=7.29.0` |

**5건 전부 `devDependencies`(vite 툴체인) 소속으로, production 번들에 포함되지 않습니다.**
런타임 의존성(`react`, `react-dom`, `@supabase/supabase-js`, `solapi`)에는 취약점이 없습니다.
`npm audit fix`(non-breaking)로 해소 가능하며, 출시 차단 사유는 아닙니다.

---

## 3. `.env`에 필요한 항목

### 3-1. 코드에서 실제로 사용 중인 전체 목록

**클라이언트 (`VITE_` — 브라우저 번들에 인라인됨)**

| 변수 | 필수 | 용도 |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon 키 |
| `VITE_TOSS_CLIENT_KEY` | ✅ | 토스 결제창. 없으면 시뮬레이션 경로로 폴백 |
| `VITE_ADMIN_CODE` | ✅ | 코드 관리자 로그인 게이트 (⚠️ §5-4) |
| `VITE_APP_MODE` | ✅ | **`beta`(기본) / `production`** — 정식 전환 스위치 (§5-3) |
| `VITE_SAFE_MODE` | 선택 | `"true"` 시 실결제 비활성 (심사용) |
| `VITE_KAKAO_MAP_KEY` | 선택 | 비우면 MockMap fallback |
| `VITE_SHOW_BETA_UI` | 선택 | production 모드에서도 베타 안내 강제 ON |
| `VITE_CLEAN_RELEASE` | 선택 | dev/QA에서만 유효. production 빌드는 항상 clean |
| `VITE_LLM_PROVIDER` | 선택 | `openrouter` \| `anthropic` |
| `VITE_LLM_API_KEY` | 선택 | 비우면 LLM 경로 OFF(Mock) |
| `VITE_LLM_MODEL` | 선택 | OpenRouter 모델 슬러그 |
| `VITE_LLM_BASE_URL` / `VITE_LLM_TIMEOUT_MS` / `VITE_LLM_MAX_RETRIES` | 선택 | 튜닝용 |

**서버 (Vercel 함수 전용 — 브라우저 노출 금지)**

| 변수 | 필수 | 용도 |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | RLS 우회 서버 작업 |
| `SUPABASE_URL` | ✅ | `VITE_SUPABASE_URL` 폴백과 병행 사용 |
| `SUPABASE_ANON_KEY` | ✅ | `VITE_SUPABASE_ANON_KEY` 폴백과 병행 사용 |
| `ADMIN_CODE` | ✅ | `x-admin-code` 헤더 대조. **미설정 시 관리자 API가 500 반환** |
| `TOSS_SECRET_KEY` | ✅ | 결제 승인 (`api/confirm-payment.js`) |
| `SOLAPI_API_KEY` / `SOLAPI_API_SECRET` / `SOLAPI_SENDER` | ✅ | OTP 문자 발송. 셋 중 하나라도 없으면 발송 차단 |
| `SITE_URL` | ✅ | sitemap/robots/prerender canonical |
| `CRON_SECRET` | ✅ | `Authorization: Bearer` 크론 인증. **미설정 503 · 불일치 401** |
| `FIREBASE_SERVICE_ACCOUNT` | ✅ | FCM 푸시 발송 |
| `FCM_SERVER_KEY` | 선택 | FCM 레거시 경로 |
| `NODE_ENV` | 자동 | Vercel이 주입 |

### 3-2. ❌ `.env.local.example`이 실제 코드와 불일치

**예시 파일에 없는데 코드가 사용하는 변수 — 14개**

```
VITE_ADMIN_CODE          VITE_APP_MODE         VITE_SHOW_BETA_UI     VITE_CLEAN_RELEASE
SUPABASE_URL             SUPABASE_ANON_KEY     ADMIN_CODE            SITE_URL
SOLAPI_API_KEY           SOLAPI_API_SECRET     SOLAPI_SENDER
FIREBASE_SERVICE_ACCOUNT FCM_SERVER_KEY        CRON_SECRET
```

**예시 파일에는 있는데 코드 어디에서도 쓰지 않는 변수 — 3개**

```
TWILIO_ACCOUNT_SID   TWILIO_AUTH_TOKEN   TWILIO_VERIFY_SERVICE_SID
```
→ OTP 발송은 **solapi로 이미 이전**되었습니다 (`api/send-otp.js`). Twilio 항목은 잔재입니다.

이 상태에서는 신규 환경(로컬/프리뷰/신규 Vercel 프로젝트)을 예시 파일만 보고 세팅하면
**OTP 로그인·관리자 API·푸시·크론·sitemap이 전부 조용히 실패**합니다.
`.env.local.example` 갱신은 출시 전 반드시 처리해야 할 항목입니다.

---

## 4. 안드로이드 빌드 통과 여부

### 4-1. ⛔ 이 환경에서는 빌드 검증이 **불가능**합니다 (코드 문제 아님)

실제 실행 결과:
```
$ ./gradlew :app:assembleRelease
FAILURE: Build failed with an exception.
* Where: build.gradle line: 2
* What went wrong:
  Plugin [id: 'com.android.application', version: '8.6.1', apply: false] was not found
  ... could not resolve plugin artifact
      'com.android.application:com.android.application.gradle.plugin:8.6.1'
BUILD FAILED in 2s
```

원인은 빌드 스크립트가 아니라 **네트워크 이그레스 정책**입니다. 직접 확인한 도달성:

| 호스트 | 결과 |
|---|---|
| `dl.google.com` (Google Maven — AGP·androidbrowserhelper의 유일한 배포처) | **000 / CONNECT 403 거부** |
| `repo1.maven.org` (Maven Central) | 200 |
| `services.gradle.org` | 200 |

프록시 로그에도 정책 거부가 기록됩니다:
```
connect_rejected  dl.google.com:443  "gateway answered 403 to CONNECT (policy denial)"
```

추가로 이 컨테이너에는 **Android SDK가 설치되어 있지 않습니다** (`ANDROID_HOME` 미설정,
`sdkmanager`/`adb` 부재). SDK 설치 역시 `dl.google.com`에서 받아야 하므로 같은 벽에 막힙니다.

> **정리:** 안드로이드 빌드의 통과/실패를 이 리포트가 단정할 수 없습니다.
> 판정하려면 `dl.google.com` 허용된 환경(로컬 PC, 또는 Android SDK가 포함된 CI 러너)에서
> `./gradlew :app:bundleRelease`를 실행해야 합니다. 조직 정책상 우회 시도는 하지 않았습니다.

### 4-2. ✅ 네트워크 없이 검증 가능한 항목은 모두 통과

**서명 키 ↔ Digital Asset Links 지문 일치 확인 (실제 대조함)**

```
keystore(gonggan-release.keystore, alias=gonggan-market)
  SHA256: B2:F5:E5:66:60:D8:12:10:E3:BE:72:A7:66:F6:29:DA:2D:EB:E4:A0:D6:21:28:91:DC:FB:4C:91:60:E5:31:D5
  Owner : OU=Mobile, O=GongganMarket, L=Seoul, ST=Seoul, C=KR
  유효기간: 2026-05-28 ~ 2053-10-13 (SHA384withRSA)

public/.well-known/assetlinks.json
  package_name: com.gonggansai.gongganmarket          ✅ build.gradle applicationId와 일치
  sha256_cert_fingerprints[0]: B2:F5:...:31:D5        ✅ keystore 지문과 완전 일치
```

**그 외 정적 검증**
- `AndroidManifest.xml` — TWA LauncherActivity, `autoVerify="true"` intent-filter, DelegationService, asset_statements 모두 정상 선언.
- 상태바/네비게이션바 색상이 `android:value`가 아닌 **`android:resource`**로 선언됨 — 과거 실행 즉시 크래시(#508)의 원인이던 부분이 올바르게 수정되어 있습니다.
- `AD_ID` 권한 `tools:node="remove"` — Play Console 광고 ID 선언 요구를 원천 차단. 적절합니다.
- 도메인 정합성: `strings.xml`(`gongganmarket.com`) ↔ `twa-manifest.json`(`host`) ↔ `build.sh`(`VERCEL_URL`) 모두 일치.
- 아이콘 리소스 5개 밀도(mdpi~xxxhdpi) + adaptive icon 전부 존재.

### 4-3. ⚠️ 안드로이드 관련 결함 3건

**(A) `assetlinks.json`에 Play 앱 서명 키 지문이 없습니다 — 출시 차단 위험 최상**

현재 등록된 지문은 **업로드 키(`gonggan-release.keystore`)의 것 하나뿐**입니다.
AAB로 Play에 출시하면 **Play 앱 서명(Play App Signing)** 이 적용되어, 사용자 기기에 설치되는
APK는 **Google이 재서명한 다른 키**로 서명됩니다.

→ 이 상태로 정식 출시하면 Digital Asset Links 검증이 실패하고, **TWA가 전체화면이 아니라
Chrome 주소창이 보이는 커스텀탭으로 뜹니다.** (비공개 테스트에서 내부 배포 방식에 따라
이 문제가 드러나지 않았을 수 있습니다.)

*조치:* Play Console → 설정 → 앱 무결성 → **앱 서명 키 인증서의 SHA-256 지문**을 복사해
`assetlinks.json`의 `sha256_cert_fingerprints` 배열에 **추가**(업로드 키 지문은 유지, 2개 병기).
배포 후 `https://gongganmarket.com/.well-known/assetlinks.json`이 실제로 갱신되었는지 확인.

**(B) `targetSdk 35`**

Google Play는 매년 8월 말을 기준으로 신규 앱·업데이트의 최소 target API 레벨을 상향합니다.
`compileSdk`/`targetSdk`가 35에 머물러 있고, `androidbrowserhelper`도 compileSdk 36을 요구하는
2.7.2 대신 **2.5.0으로 의도적으로 고정**되어 있어(주석에 근거 기록됨) 상향 시 연쇄 작업이 필요합니다.

*조치:* **출시 직전 Play Console의 현재 target API 요구사항을 반드시 확인하십시오.**
상향이 필요하면 `compileSdk`/`targetSdk` 36 + `androidbrowserhelper` 2.7.x로 함께 올리고,
과거 크래시 이력이 있는 조합이므로 **실기기 TWA 실행 확인**을 반드시 거쳐야 합니다.
(이 리포트는 정책 원문을 조회할 수 없어 연도별 마감일을 단정하지 않습니다.)

**(C) `store-listing/listing.json`의 버전 정보가 낡았습니다**

```
listing.json    : versionCode 1,  versionName "1.0.0",  release_notes "공간마켓 첫 출시"
app/build.gradle: versionCode 15, versionName "1.0.15"
```
스토어 등록 정보 파일이 versionCode 1 시점에 멈춰 있습니다. 빌드에는 영향이 없지만
출시 노트를 이 파일에서 가져다 쓰면 잘못된 내용이 올라갑니다.
또한 `app_icon.file`이 `icon-512.svg`를 가리키는데 **Play는 512×512 PNG만 허용**합니다
(`public/icons/icon-512-v2.png` 사용 필요).

---

## 5. 비공개 테스트 → 정식 출시까지 남은 일

### 5-1. 🔴 출시 차단 (Blocker)

| # | 항목 | 조치 |
|---|---|---|
| B1 | **`assetlinks.json`에 Play 앱 서명 지문 추가** | §4-3(A). 미조치 시 정식 출시본에서 TWA가 주소창 노출 상태로 실행 |
| B2 | **target API 레벨 확인 및 필요 시 36 상향** | §4-3(B). Play Console 현재 요구사항 확인 후 판단 |
| B3 | **안드로이드 릴리스 빌드 실제 검증** | `dl.google.com` 허용 환경에서 `./gradlew :app:bundleRelease` 통과 확인 (본 환경에서 미검증) |
| B4 | **`VITE_APP_MODE=production` 설정** | 아래 §5-3 |
| B5 | **토스페이먼츠 실 결제 키 전환** | `VITE_TOSS_CLIENT_KEY`/`TOSS_SECRET_KEY`를 `test_` → `live_`로. 동시에 `VITE_SAFE_MODE=false` 확인 |
| B6 | **스토어 스크린샷 확보** | `listing.json`에 요구사항만 있고 실제 파일 없음. 폰 최소 2장 + 피처 그래픽 1024×500 필요 |

### 5-2. 🟠 보안 (출시 전 강력 권장)

| # | 항목 | 내용 |
|---|---|---|
| S1 | **`VITE_ADMIN_CODE`가 브라우저 번들에 노출** | `VITE_` 접두사 변수는 빌드 시 JS에 **평문 인라인**됩니다. 서버(`api/admin/*.js`)가 대조하는 `ADMIN_CODE`와 **같은 값**이므로, 번들에서 문자열만 추출하면 누구나 관리자 API를 호출할 수 있습니다. `build.sourcemap: true`로 소스맵까지 배포되어 위치 특정이 더 쉽습니다. → 관리자 인증을 서버 세션/Supabase Auth 기반으로 옮기거나, 최소한 관리자 진입을 별도 비공개 경로 + 서버 발급 토큰으로 분리 권장 |
| S2 | **릴리스 keystore와 비밀번호가 저장소에 평문 커밋** | `android-twa/gonggan-release.keystore` + `app/build.gradle`·`build.sh`에 `GongganMarket2026!` 하드코딩. `.gitignore`에 "private repo이므로 의도적"이라 명시되어 있으나, 저장소 접근자 = 앱 서명 권한이 됩니다. 유출 시 **키 교체가 불가능**(Play 앱 서명 미사용 시 앱을 영구히 업데이트 불가). → 최소한 `signingConfigs`를 환경변수/`local.properties`로 분리하고, keystore는 별도 비밀 저장소로 이전 권장 |
| S3 | **production 소스맵 배포** | `vite.config.js`의 `sourcemap: true` → `false` 또는 `'hidden'` 권장 (7.1MB 절감 + 소스 비공개) |
| S4 | `npm audit fix` | dev 의존성 5건. 런타임 무영향이나 정리 권장 |

### 5-3. 🟡 정식 전환 스위치 (코드 변경 불필요)

`src/constants/release.js` 설계상 **환경변수 하나로 베타 → 정식 전환**이 끝납니다:

```js
export const APP_MODE = import.meta.env.VITE_APP_MODE || "beta";  // 기본값 beta
export const SHOW_BETA_UI = APP_MODE === "beta" || import.meta.env.VITE_SHOW_BETA_UI === "true";
```

- **현재 `VITE_APP_MODE`가 설정돼 있지 않으면 프로덕션에서도 `beta`로 동작**하며, 베타 배지·배너·안내 모달이 계속 노출됩니다.
- 정식 출시 시: Vercel 환경변수에 **`VITE_APP_MODE=production`** 추가 + `VITE_SHOW_BETA_UI` 미설정(또는 제거) → 재배포.
- 영향 범위는 표시 전용입니다(`BetaUI.jsx`, `GuaranteeCard.jsx`, `RequestModalBeta.jsx`, `BidCard.jsx`, `PartnerLandingScreen.jsx`). 결제·에스크로·계약·입찰 로직과 무관합니다.
- 디버그 UI/로그는 `import.meta.env.PROD`로 이미 자동 차단되므로 별도 조치 불필요합니다.

### 5-4. 🟡 운영 준비

| # | 항목 | 내용 |
|---|---|---|
| O1 | **`.env.local.example` 갱신** | §3-2. 누락 14개 추가 + Twilio 3개 제거 |
| O2 | **Vercel 환경변수 실제 주입 확인** | 특히 `CRON_SECRET`(미설정 시 크론 503), `ADMIN_CODE`(미설정 시 관리자 API 500), `SOLAPI_*`(미설정 시 OTP 발송 차단) — 조용히 실패하는 항목들 |
| O3 | **Kakao Maps 도메인 등록** | `STATUS_HANDOFF.md` §6의 미해결 항목. Kakao Developers에 `gongganmarket.com` 등록 필요. 미등록 시 지도가 MockMap fallback으로 표시됨 |
| O4 | **`STATUS_HANDOFF.md`가 심각하게 낡음** | PR #120 / SHA `49cc5696` 기준으로 작성돼 있으나 현재는 **#657**. 기재된 "지역 매칭 tier 4 폴백" 이슈의 현재 유효성을 재확인하거나 문서를 폐기해야 합니다. 다음 작업자가 오독할 위험이 큽니다 |
| O5 | **`RELEASE_QA_CHECKLIST.md` 미소화** | 최종 갱신 2026-05-31, **전 항목 미체크(`[ ]`)**. 고객/업체/관리자 플로우 수동 QA가 기록상 완료되지 않았습니다 |
| O6 | **Vercel 함수 12/12 만석** | 신규 API 필요 시 통합·삭제 또는 Pro 전환 사전 계획 필요 |
| O7 | **CI 부재** | `.github/` 없음. `npm ci && npm run build && npm test`만 도는 워크플로 추가 시 회귀를 저비용으로 방지 가능 |

### 5-5. 🟢 이미 갖춰진 것 (재작업 불필요)

- ✅ **개인정보처리방침·이용약관·환불정책** — `/privacy`, `/terms`, `/refund` 라우트가 로그인 없이 접근 가능 (`LegalScreen.jsx`). Play 정책 요구 충족
- ✅ **계정 삭제** — 앱 내 `DeleteAccountScreen.jsx` + 서버 `api/delete-account.js`. Play의 "앱 내 계정 삭제 + 웹 경로" 요구 충족
- ✅ **통신판매업 신고번호** — 2026-성남중원-0463 (단일 소스로 반영됨, #654)
- ✅ **광고 ID 미사용** — manifest에서 `AD_ID` 권한 제거. 데이터 안전 섹션 신고 부담 감소
- ✅ **GPS 정책** — 앱 마운트 시 위치 요청 없음, 사용자 탭 시에만 `getCurrentPosition` 1회
- ✅ **PWA 기본** — manifest, 아이콘(192/512/maskable), apple-touch-icon, service worker, OG 태그 완비
- ✅ **SEO** — sitemap/robots 동적 생성, 봇 UA 대상 prerender rewrite, 네이버 사이트 소유확인
- ✅ **SAFE_MODE** — 심사용 실결제 비활성 스위치 구현 완료

---

## 6. 코드 품질 관찰 사항 (출시 비차단)

| 항목 | 수치 / 내용 |
|---|---|
| 최대 파일 | `AdminScreen.jsx` **8,264줄**, `MainApp.jsx` **5,862줄**, `supabase.js` **3,782줄** |
| `console.log` 잔존 | `src`에 46건 (production 빌드에서 `devLog`로 차단되나 직접 호출분은 확인 필요) |
| TODO/FIXME | 5건 |
| **고아 파일** | 루트 **`gonggan-market-v9-1.jsx` (187KB)** — 어디서도 import되지 않습니다. 빌드에 포함되지 않으나 혼선 요인이므로 삭제 또는 `archive/` 이동 권장 |
| 타입 안정성 | TypeScript 0% — 331개 파일 전부 JS/JSX. 대형 파일과 결합해 리팩터링 위험이 높음 |
| 테스트 커버리지 편중 | 67개 테스트가 전부 콘텐츠/에디토리얼 파이프라인 대상. **에스크로·결제·입찰·지역매칭 등 핵심 거래 로직 테스트 0건** |

---

## 7. 권장 실행 순서

1. **B4 + O1** — `VITE_APP_MODE=production` 설정, `.env.local.example` 갱신 *(코드 작업, 즉시 가능)*
2. **S1 + S3** — 관리자 코드 노출 해소, 소스맵 비공개 전환 *(코드 작업)*
3. **O2 + O3** — Vercel 환경변수 전수 확인, Kakao 도메인 등록 *(콘솔 작업)*
4. **B2** — Play Console에서 현재 target API 요구사항 확인 → 필요 시 SDK 36 상향 + 실기기 검증
5. **B1** — Play 앱 서명 지문을 `assetlinks.json`에 추가 후 배포·검증
6. **B3 + B5 + B6** — 릴리스 AAB 빌드 검증, 실 결제 키 전환, 스토어 자산 준비
7. **O5** — `RELEASE_QA_CHECKLIST.md` 전 항목 수동 소화
8. **O7 / S2** — CI 추가, keystore 비밀 분리 *(출시 후 정리 가능)*

---

### 부록: 본 점검에서 실제로 실행한 명령

```
npm install                              → exit 0
npm ci --dry-run                         → exit 0
npm run build                            → exit 0 (11.76s)
npm test                                 → 67/67 pass
npm audit --json                         → 5건 (전부 dev)
keytool -list -v -keystore gonggan-release.keystore   → 지문 대조 성공
./gradlew :app:assembleRelease           → FAILED (dl.google.com 이그레스 차단)
curl dl.google.com / repo1.maven.org / services.gradle.org → 000 / 200 / 200
```
