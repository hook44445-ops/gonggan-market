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

### 남은 불확실성: `/` rewrite

`/` 는 빌드 산출물 `dist/index.html` 이 파일시스템에서 먼저 잡힐 수 있어,
`/` 의 봇 rewrite 가 같은 이유로 무력화될 가능성이 있다
(`/partner` 는 해당 파일이 없어 확실히 동작한다).

배포 환경에서 확인하지 못했으므로, **rewrite 가 안 먹어도 홈이 비지 않도록**
전역 구조화 데이터(Organization·WebSite)를 `index.html` 정적 head 에 직접 넣었다.
JS 를 실행하지 않는 크롤러도 운영 주체는 읽을 수 있다.

**배포 후 반드시 확인할 것:**

```bash
# 1) 홈 프리렌더가 실제로 먹는지 — <h1> 과 FAQ 가 보이면 성공
curl -s -A "Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)" \
     https://gongganmarket.com/ | grep -c "<h1>"

# 2) 파트너 (확실히 동작해야 함)
curl -s -A "Yeti" https://gongganmarket.com/partner | grep "수수료"

# 3) 동적 robots / sitemap 이 살아났는지
curl -s https://gongganmarket.com/robots.txt   | grep "GPTBot"
curl -s https://gongganmarket.com/sitemap.xml  | grep -c "<url>"   # 6 보다 커야 함
curl -s https://gongganmarket.com/llms.txt     | head -3

# 4) 일반 사용자는 SPA 그대로인지 (h1 이 0 이어야 정상)
curl -s -A "Mozilla/5.0 (iPhone)" https://gongganmarket.com/ | grep -c "<h1>"
```

1번이 `0` 이면 `/` rewrite 가 섀도잉된 것이다. 그때의 선택지:

- `vercel.json` 의 `rewrites` 를 레거시 `routes` 로 옮긴다 (단, `headers`/`redirects` 와 병용 불가)
- 또는 루트 `middleware.js` 로 봇 분기 (엣지 함수 — 함수 한도 영향 확인 필요)
- 또는 홈은 현 상태(정적 JSON-LD + 메타)로 두고 `/partner`·`/lounge` 로만 간다

---

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
