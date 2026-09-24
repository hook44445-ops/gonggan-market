# 공간마켓 SEO / AEO / GEO 구조

수요(의뢰인)·공급(시공 업체) 양쪽 진입점을 검색엔진(구글·네이버)과
생성형 답변엔진에 노출하기 위한 구조. 2026-09 정리.

---

## 1. 단일 소스 — `src/utils/siteSeo.js`

사업자 정보 · FAQ · 수수료 · 보증금 등급 · 페이지 메타 · JSON-LD 빌더가 전부 여기 있다.

**왜 한 곳인가.** 화면(React)과 봇 프리렌더(`api/prerender.js`)가 서로 다른 문장을 내보내면
**클로킹(cloaking)** 이 된다 — 봇에게만 다른 내용을 보여주는 것으로 간주되어 색인에서 불이익을 받는다.
같은 배열을 양쪽이 import 하게 만들어 구조적으로 갈라질 수 없게 했다.

`siteSeo.test.js` 가 이 결합을 지킨다. 프리렌더 HTML에 화면과 같은 FAQ·사업자번호가
들어있지 않으면 테스트가 깨진다.

> ⚠️ 이 파일은 **순수 JS** 여야 한다. React / `import.meta` / DOM 을 쓰면
> Vercel 서버리스(`api/*`)에서 import 가 깨진다. 베타 여부는 인자로 받는다.

### 베타 게이팅

`APP_MODE` 기본값이 `beta` 라 **에스크로(공간안전결제)는 아직 운영 중이 아니다.**
그래서 베타에서는:

- `pageSeo()` 설명에서 «에스크로» 문구를 뺀다
- `serviceSchema()` 제공 목록에 에스크로를 넣지 않는다
- `llms.txt` 에 «토스페이먼츠 승인 후 제공 예정» 이라고 명시한다

답변엔진이 사실이 아닌 문장을 인용하게 두면 안 된다.
정식 전환은 `VITE_APP_MODE=production` 환경변수 하나로 끝난다 — 문구는 자동으로 바뀐다.

---

## 2. 봇 프리렌더 — 네이버 대응의 핵심

네이버 Yeti 는 자바스크립트를 사실상 실행하지 않는다. SPA 인 공간마켓은
홈·파트너 페이지가 네이버에 **본문 없는 빈 문서**로 보였다.

`vercel.json` 의 user-agent 기반 rewrite 로 **크롤러만** `api/prerender.js` 에 보낸다.
실제 사용자는 그대로 `index.html`(SPA)을 받는다.

| 경로 | 대상 | 내용 |
|---|---|---|
| `/` | 수요(의뢰인) | h1 · 서비스 소개 · 이용 흐름 · FAQ · 사업자정보 |
| `/partner` | 공급(업체) | h1 · 신청 대상 · 수수료 · 보증금 등급 · 온보딩 · FAQ |
| `/lounge/*` | 콘텐츠 | 글 · 카테고리 · 지역 (기존) |
| `/llms.txt` | 답변엔진 | 양면 요약 (아래 GEO 항목) |

> **소유확인 주의.** 봇이 `/` 를 요청하면 `index.html` 대신 프리렌더가 나간다.
> 그래서 프리렌더 HTML 에도 `naver-site-verification` 메타가 들어있어야 한다.
> 빠지면 서치어드바이저 소유확인이 조용히 풀린다. 테스트가 두 값의 일치를 검사한다.

---

## 3. ⚠️ Vercel rewrite 섀도잉 함정

**Vercel 은 `rewrites` 를 «파일시스템 확인 뒤» 에 적용한다.**
같은 경로에 정적 파일이 있으면 rewrite 는 영원히 실행되지 않는다.

실제로 이 사고가 나 있었다:

- `public/robots.txt` 가 있어서 → `/api/robots` 가 한 번도 호출되지 않음
- `public/sitemap.xml` 이 있어서 → 라운지 글이 전부 들어간 동적 사이트맵이 **서빙되지 않음**.
  대신 6개짜리 정적 사이트맵이 나갔고, 그중 `/request` `/company` `/login` `/mypage`
  **4개는 라우트 자체가 없어** catch-all 로 랜딩이 뜨는 soft 404 였다.

→ 두 정적 파일을 제거해 동적 버전을 살렸다.
**`public/` 에 `robots.txt` / `sitemap.xml` / `llms.txt` 를 다시 만들면 안 된다.**

### ✅ 해결됨 — `/` rewrite 는 동작한다 (2026-09-24 확인)

배포 전에는 `/` 가 `dist/index.html` 에 섀도잉될까 걱정했는데, **네이버 서치어드바이저
「사이트 간단 체크」가 증거를 줬다.** 네이버가 수집한 설명은

> 믿을 수 있는 인테리어 업체 비교부터 계약, **공사 사진·진행 기록까지**…

**베타 문구**였다. 이 문장은 당시 정적 `index.html` 에 없었고 `pageSeo(beta)` 에만 있었다.
즉 네이버 봇이 받은 문서는 `index.html` 이 아니라 **프리렌더 응답**이다.

같은 확인에서 색인 항목도 전부 녹색이었다 — 수집 허용 예 · 수집 완료 예 · 응답 OK(200) ·
색인 허용 예 · 색인 완료 예.

### 그 확인이 드러낸 버그 (같은 날 수정)

`index.html` 의 정적 제목·설명이 **에스크로를 운영 중인 기능처럼** 적고 있었다.
프리렌더를 타는 크롤러는 베타 문구를 받았지만, UA 에 `bot`/`crawl` 이 없는 수집기
(`ChatGPT-User` 등)는 이 정적 값을 그대로 가져갔다 — 사실과 다른 문장이 색인될 자리였다.

→ `index.html` 의 title·description·OG·Twitter 를 `pageSeo()` 단일 소스와 맞추고,
`siteSeo.test.js` 가 둘의 일치와 「베타에 에스크로 문구 금지」를 검사한다.

## 4. AEO — 답변엔진 최적화

FAQ 를 `FAQPage` 구조화 데이터로 내보내고, 답변은 **첫 문장에서 결론부터** 말한다.

> **솔직한 기대치.** 구글은 2023-08 이후 FAQ 리치결과를 정부·보건 등
> 일부 사이트에만 보여준다. 즉 **구글 검색결과에 FAQ 아코디언이 뜨지는 않는다.**
> 그래도 넣는 이유는 답변엔진(ChatGPT·Perplexity·Gemini)과 네이버가
> 질문·답변 쌍을 파싱해 인용하기 좋기 때문이다.

스키마 배치:

| 위치 | 스키마 |
|---|---|
| `index.html` (정적, 전역) | Organization, WebSite |
| 홈 화면 (`useJsonLd`) | Service, FAQPage |
| 파트너 화면 (`useJsonLd`) | FAQPage, BreadcrumbList |
| 프리렌더 (봇) | 위 전부 (index.html 을 대체하므로 자체 완결) |

전역/페이지별을 나눠 같은 개체가 중복되지 않게 했다.

---

## 5. GEO — 생성형 답변엔진

**`/llms.txt`** — 수요·공급 양면 요약 + 정확한 숫자(수수료 4.4%, 보증금 등급, 환급 조건) +
인용 시 유의사항(통신판매중개자 고지, 베타 상태).

> **솔직한 기대치.** `llms.txt` 는 제안된 관례일 뿐 표준이 아니고,
> 이를 공식적으로 읽는다고 밝힌 주요 AI 크롤러는 아직 없다.
> 비용이 거의 없고 «정확한 사실 한 장» 을 남겨두는 값이 있어서 넣었다.
> 실질적인 GEO 효과는 아래 두 가지에서 나온다:
>
> 1. `robots.txt` 에서 답변엔진 크롤러를 **막지 않는 것** (인용되려면 먼저 읽혀야 한다)
> 2. 프리렌더로 **본문을 실제 텍스트로 제공하는 것**

정적 파일이 아니라 `api/prerender.js` 가 생성한다 — 수수료가 바뀌어도 갈라지지 않는다.

### robots.txt 방침

- 공개 경로 전부 허용
- 앱 전용/개인 화면 차단 (`/mypage` `/login` `/chat` `/admin` `/delete-account`, `?app=1` `?login=` 중복 URL)
- 네이버 `Yeti`, 다음 `Daum` 명시
- 답변엔진 크롤러 명시 허용: `GPTBot` `OAI-SearchBot` `ChatGPT-User` `ClaudeBot`
  `Claude-User` `Claude-SearchBot` `PerplexityBot` `Perplexity-User`
  `Google-Extended` `Applebot-Extended`

---

## 6. 아직 안 한 것

- **지역 랜딩** (`/인테리어/성남` 같은 수요 롱테일) — 라운지 지역 랜딩은 이미 있지만,
  견적 수요 키워드를 겨냥한 지역 페이지는 없다. 실제 시공 사례가 쌓인 뒤가 맞다.
- **업체 프로필 공개 페이지** — 공급 쪽 롱테일. 업체 동의·개인정보 검토 필요.
- **구글 서치콘솔 소유확인 메타** — 네이버만 있다.
- **`/safe-payment` `/tokens` 프리렌더** — 토스 심사 중이라 해당 페이지 표면은 건드리지 않았다.
  사이트맵 등록만 했다.


---

## 7. ASO — 스토어와 웹의 검색어를 맞춘다 (2026-09-24)

문안은 `store/ASO-ko.md`. 기준은 **어트랙션(매력) → 라포(공감) → 시덕션(끌림)**.

가장 큰 구멍은 **제목에 검색어가 하나도 없었다는 것**이다.

| 자리 | 예전 | 지금 |
|---|---|---|
| 웹 `<title>` | 공간마켓 — 좋은 공간과 좋은 이야기가 모이는 곳 | 인테리어 비교견적 — 공간마켓 · 집수리 리모델링 견적 |
| 웹 `/partner` | 공간마켓 파트너(업체) 입점 안내 | 인테리어 업체 입점 — 공간마켓 공간파트너 |
| Play 앱 이름 | 공간마켓 | 공간마켓 – 인테리어 비교견적 |

브랜드 인지도가 아직 없는 단계에서 제목을 브랜드 슬로건으로 쓰면 아무에게도 안 걸린다.
**제목은 검색어를 담고, 끌림은 설명이 맡는다.**

`siteSeo.test.js` 가 제목에 「인테리어」·「견적」이 들어있는지, 35자를 넘지 않는지,
그리고 ASO 문서가 코드의 사실(입찰 한도·보증금·연락처)과 갈라지지 않는지 검사한다.

## 8. ⚠️ 미결 — 문의 이메일이 두 가지

| 위치 | 값 |
|---|---|
| 앱 문의하기 · 법적고지(`LegalScreen`) · 계정삭제 · `store/ASO-ko.md` | `biz@gonggansai.com` |
| 사업자정보 푸터(`siteSeo.BIZ`) · 홈 JSON-LD · `llms.txt` | `gongganmarket.biz@gmail.com` |

사업자정보는 전자상거래법상 공개 의무 항목이라 **임의로 바꾸지 않았다.**
통신판매업 신고에 적은 값을 확인한 뒤 한쪽으로 통일하고, `LegalScreen` 의 하드코딩
사업자정보 블록을 `siteSeo.BIZ_ROWS` 로 합치면 다시 갈라지지 않는다.


---

## 9. 구글 (2026-09-24)

### 고친 것 — 서치콘솔 URL 검사가 다른 문서를 보고 있었다

봇 rewrite 정규식은 이름에 `bot`/`crawl`/`spider` 가 든 UA 만 잡았다. 그래서

| 수집기 | 예전 | 지금 |
|---|---|---|
| `Googlebot` (실제 색인) | 프리렌더 | 프리렌더 |
| `Google-InspectionTool` (서치콘솔 URL 검사) | **SPA** | 프리렌더 |
| `ChatGPT-User` · `Claude-User` · `Perplexity-User` | **SPA** | 프리렌더 |
| `meta-externalagent` | **SPA** | 프리렌더 |
| 사람(iPhone·Android·데스크톱) | SPA | SPA |

URL 검사가 Googlebot 과 다른 문서를 보면 클로킹으로 오해받는다.
`-User` 계열 페처는 자바스크립트를 실행하지 않아서 SPA 를 받으면 빈 문서를 가져갔다(GEO 손해).

`siteSeo.test.js` 가 ① 세 rewrite 규칙의 UA 정규식이 갈라지지 않는지
② 위 수집기들이 프리렌더를, 사람이 SPA 를 받는지 검사한다.

### 소유확인 — 단일 소스로 합침

`siteSeo.js` 의 `verificationMetas()` 가 `index.html` 과 프리렌더 양쪽에 같은 값을 낸다.
테스트가 양쪽 일치와 «한쪽에만 몰래 추가된 값이 없는지»를 검사한다.

- 네이버: 메타 태그 + HTML 파일(`public/naver*.html`) 둘 다 설정됨
- **구글: 아직 미설정** — `GOOGLE_SITE_VERIFICATION` 이 빈 문자열이라 태그를 내지 않는다

### 구글 서치콘솔 설정 절차 (대표)

1. https://search.google.com/search-console → 속성 추가 → **URL 접두어** `https://gongganmarket.com`
2. 소유확인 방법 **「HTML 태그」** 선택 → `content="..."` 값 복사
3. 그 값을 `src/utils/siteSeo.js` 의 `GOOGLE_SITE_VERIFICATION` 에 넣고 배포
   (`index.html` 에도 같은 줄이 필요하다 — 테스트가 빠뜨림을 잡는다)
4. 배포 후 서치콘솔에서 **확인** 누르기
5. **Sitemaps** → `sitemap.xml` 제출
6. **URL 검사** → `/` 와 `/partner` → 「색인 생성 요청」

> DNS 방식(TXT 레코드)을 쓰면 코드 변경 없이 도메인 전체를 한 번에 확인할 수 있다.
> 이 경우 2~3 단계는 건너뛴다.

### 구글에 대한 솔직한 기대치

- **FAQ 리치결과는 안 뜬다.** 구글은 2023-08 이후 정부·보건 등 일부 사이트에만 보여준다.
  FAQPage 구조화 데이터는 답변엔진·네이버를 위해 유지하는 것이다.
- **번들이 무겁다** — `index-*.js` 약 2.3MB(gzip 660KB). 구글은 페이지 경험을 순위 신호로 쓴다.
  Googlebot 은 프리렌더를 받으므로 색인 자체는 영향이 적지만, 실제 사용자 지표(CWV)에는 반영된다.
  코드 분할은 별도 과제.


---

## 10. www ↔ apex 중복 색인 (2026-09-24 서치콘솔에서 발견)

### 증상

사이트맵은 **성공 · 328페이지 발견**인데 홈이 색인되지 않았다.

> 페이지 색인이 생성되지 않음: **중복 페이지, Google에서 사용자와 다른 표준을 선택함**
> 참조 페이지: `https://www.gongganmarket.com/`

### 원인

canonical 을 «요청 호스트»로 만들고 있었다.

- 서버: `getSiteUrl(req)` → `x-forwarded-host`
- 브라우저: `useDocumentMeta` → `window.location.origin`

그래서 `www` 로 들어온 크롤러는 `<link rel="canonical" href="https://www.gongganmarket.com/">` 를,
apex 로 들어온 크롤러는 apex 를 받았다. **두 호스트가 각자 자기를 정식이라 선언**한 셈이라
구글은 둘 중 하나를 스스로 골랐다(www).

게다가 JSON-LD 는 `SITE_URL`(apex)로 고정돼 있어 같은 문서 안에서 신호가 엇갈렸고,
사이트맵도 요청 호스트를 따라가 www 로 가져가면 328개 URL 이 전부 www 가 될 수 있었다.

### 고친 것

`siteSeo.canonicalSite(host, proto)` 하나로 모았다.

- 운영 도메인(`gongganmarket.com`, `www.gongganmarket.com`) → **언제나 apex**
- preview(`*.vercel.app`) · localhost → 요청 호스트 그대로 (미리보기 링크가 운영으로 새면 안 된다)

적용: `api/prerender.js` · `api/robots.js` · `api/sitemap.js` · `src/hooks/useDocumentMeta.js`.
테스트가 www 요청에서 canonical·og:url·사이트맵·robots 가 모두 apex 인지 검사한다.

### ⚠️ 코드만으로는 절반이다 — Vercel 설정 필요

canonical 태그는 «권고»다. 두 호스트가 모두 200 을 주는 한 구글은 여전히 둘 다 크롤링한다.
**한쪽이 다른 쪽으로 301 해야** 중복이 끝난다.

Vercel → 프로젝트 → **Settings → Domains** 에서 `gongganmarket.com` 을 **Primary** 로 두면
`www` 가 자동으로 301 된다.

> ⚠️ 이 리다이렉트를 `vercel.json` 에 직접 쓰지 말 것. Vercel 도메인 설정이 반대 방향
> (apex → www)으로 잡혀 있으면 **무한 리다이렉트 루프**가 난다. 도메인 설정 한 곳에서만 정한다.

현재 Vercel 의 Primary 가 어느 쪽인지 확인하지 못했다(이 세션은 egress 차단).
**apex 가 Primary 가 아니면** canonical(apex)이 리다이렉트를 가리키게 되므로, 그때는
`SITE_URL` 과 `SITE_HOSTS` 를 www 기준으로 바꾸는 편이 맞다.

### 확인 방법

```bash
curl -sI https://www.gongganmarket.com/ | head -3   # 301 + Location: apex 여야 정상
curl -s -A "Googlebot" https://gongganmarket.com/ | grep -o 'rel="canonical"[^>]*'
```

서치콘솔에서는 URL 검사 → 「색인 생성 요청」을 다시 하면 된다.
중복 판정이 풀리는 데는 보통 며칠 걸린다.
