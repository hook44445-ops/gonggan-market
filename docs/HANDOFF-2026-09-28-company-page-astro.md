# 로컬 지시서 — 업체 공개 페이지 Astro 전환 · 구조 · 템플릿 · 힉스필드 (2026-09-28)

받는 사람: 로컬 PC 의 다음 Claude 세션(힉스필드 연결된 곳). 대표 김태웅, 호칭 「대표」, 보고 한국어.
앞 문서: `docs/HANDOFF-2026-09-28-local-pc.md`(SQL 147·148·149) · `docs/HANDOFF-2026-09-28-company-page-higgsfield.md`(그림 템플릿 — 이 문서가 대신한다).
작업 폴더: 워크트리 `D:\project\gonggan-fix-…`(origin/main 에서 새 브랜치). 메인 폴더 금지 · 맨 `git stash` 금지.

---

## 0. 왜 Astro 인가

업체 공개 페이지(`/p/짧은이름`, #805·#806)는 **링크로 퍼지는 입구**다(블로그·인스타·명함·카톡 → 가입·설치).
지금은 React SPA(1MB 넘는 번들)를 받아 JS 로 그리고, 봇에게만 `api/prerender.js` 가 따로 HTML 을 준다.
- 첫 화면이 늦다(휴대폰 3G·인앱 브라우저) → 링크를 누른 사람이 이탈
- 사람이 보는 화면과 봇이 보는 HTML 이 두 벌 → 갈라질 위험
Astro 로 **서버에서 완성된 HTML**(JS 거의 0)을 모두에게 같은 걸 준다 → 빠르고, 검색·미리보기 한 벌.

범위: **`/p/*` 만** Astro. 앱(견적·계약·라운지)은 지금 React 그대로.

## 1. 구조 — 저장소 안 새 폴더, Vercel 프로젝트는 따로

```
gonggan-market/
  pages-astro/                ← 새 Astro 프로젝트(자기 package.json)
    astro.config.mjs          output: 'server', adapter: @astrojs/vercel
    src/
      lib/supabase.ts         anon 키로 읽기만(REST fetch 또는 supabase-js)
      lib/company.ts          getCompanyByRef(uuid|slug) · works · reviews · coverFor
      layouts/Base.astro      <head>: title·description·canonical·og·JSON-LD · 글꼴 · 색 토큰
      components/
        Hero.astro            커버(16:9) · 얼굴 · 업체명 · Lv · 공간온도 · 직영 알약
        TrustRow.astro        사업자·시공보험·보증금·실내건축 엠블럼(/images/emblem/*-sm.webp)
        Kpi.astro             시공 · 후기 · (평균응답)
        Works.astro           대표 1 + 격자(사진 누르면 <dialog> 크게 — JS 몇 줄)
        Reviews.astro         평균·별·최근 5개(길면 <details> 접기)
        Empty.astro           빈 상태(그림+문구)
        Cta.astro             하단 고정 «공간마켓에서 무료 견적 받기» → https://gongganmarket.com/
        RefStash.astro        ?ref 보관 인라인 스크립트(아래 3-3)
      pages/p/[ref].astro     한 페이지 = 위 컴포넌트 조립 · 404 처리
    public/images/company-cover/*.webp · public/images/empty/*.webp (힉스필드 · 4장)
```

배포
- Vercel **새 프로젝트** `gonggan-pages`(Root Directory = `pages-astro`) · 환경변수 `SUPABASE_URL` · `SUPABASE_ANON_KEY`(공개 값) · `SITE_URL=https://gongganmarket.com`
- 기존 프로젝트 `vercel.json` rewrites **맨 앞**에 `{ "source": "/p/:ref*", "destination": "https://<gonggan-pages 도메인>/p/:ref*" }`
  → 주소는 그대로 `gongganmarket.com/p/…`(같은 도메인 = localStorage 공유, 초대 코드가 앱까지 이어짐)
  → 이 규칙이 생기면 **지금의 `/p/:id` 봇 rewrite 와 App.jsx `/p/` 라우트는 안 탄다** — 지우지 말고 한 달 뒤 정리(되돌리기용)
- 캐시: 응답 헤더 `Cache-Control: s-maxage=600, stale-while-revalidate=86400`(업체가 사례를 올리면 10분 안에 보임)
- 기존 프로젝트 서버리스 12개 한도와 무관(다른 프로젝트)

## 2. 한 페이지 구조(위 → 아래) · 데이터

지금 React 화면(`PortfolioScreenBeta` publicView)과 **같은 순서·같은 말**로 옮긴다. 새로 넣는 건 ★.

| # | 구역 | 데이터(anon REST) | 비었을 때 |
|---|---|---|---|
| 1 | 머리: 공간마켓 로고(← 홈) | — | — |
| 2 | ★커버 16:9 | `coverFor(company)` = 업체가 올린 커버 `companies.cover_url`(154) → 없으면 공종별 기본 그림 | 기본 그림 + 오른쪽 아래 «분위기 그림» |
| 3 | 얼굴 · 업체명 · Lv · 공간온도 · «공간마켓 직영» | companies: name, temp, level/completed_jobs, is_direct, slug, **logo_url(154)** | 얼굴 = 이름 첫 글자(깊은 초록 원 · 금 글자) |
| 4 | 신뢰 줄 엠블럼 | verified · has_insurance · guarantee_status+guarantee_badge_visible · license_verified | 흐린 빈 자리(앱과 같은 규칙 — `src/components/TrustEmblems.jsx trustState` 그대로 옮김) |
| 5 | KPI: 시공 · 후기 | completed_jobs · reviews 수 | 0 |
| 6 | 업체 소개글 · 영업지역 · 공종 태그 | **intro(154)** · region · service_regions · specialties | 숨김 |
| 7 | 시공 사례 | `portfolios?company_id=…&order=created_at.desc&limit=12` (after_photos/before_photos) | ★빈 상태: 그림 + «첫 시공 사례를 준비하고 있어요 · 공사를 마치면 전·후 사진이 여기에 쌓여요» |
| 8 | 후기 | `reviews?company_id=…&status=eq.published` | ★빈 상태: 그림 + «아직 후기가 없어요 · 공간마켓에서 계약한 공사만 후기를 남길 수 있어요» |
| 9 | 하단 고정 CTA | — | «공간마켓에서 무료 견적 받기» |
| 10 | 푸터 사업자 정보(법적 필수) | `src/utils/siteSeo.js BIZ_ROWS` 값 복사 | — |

- 업체 찾기: `ref` 가 uuid 면 `id=eq.`, 아니면 `slug=eq.<소문자>`(149). 없거나 **이름에 «테스트»/test** → 404 페이지(noindex) + «공간마켓에서 다른 업체 보기».
- 149 전(slug 칸 없음)에도 uuid 주소는 되게 — slug 를 select 에 넣은 조회가 실패하면 slug 빼고 한 번 더(`api/prerender.js renderCompany` 와 같은 처리).
- 테스트 업체 판정·엠블럼 규칙·BIZ 값은 **복사해 오되 출처 주석**을 단다(갈라지면 앱이 기준).

## 3. 머리(SEO) · 미리보기 · 초대 코드

### 3-1. `<head>`(Base.astro) — 지금 `api/prerender.js renderCompany` 와 같은 값
- title `{업체명} — {지역} 인테리어·집수리 | 공간마켓` · description(사례 N건·평점·공종)
- canonical `https://gongganmarket.com/p/{slug || id}` · robots index,follow(404 는 noindex)
- og:image = 첫 사례 사진 → 없으면 공종 커버 → 없으면 `/og-space-v2.png` · og:type website · twitter:card summary_large_image
- JSON-LD: `HomeAndConstructionBusiness`(name·url·areaServed·image·aggregateRating) + `BreadcrumbList`
### 3-2. 사이트맵
Astro 쪽 `/p/sitemap.xml`(slug 있는 업체 · 테스트 제외) → 기존 `api/sitemap.js` 에 이 주소를 `<sitemapindex>` 로 연결하거나 항목 추가(대표 확인 뒤).
### 3-3. 초대 코드(`?ref`) — **반드시** 앱과 같은 모양으로
앱(`src/lib/referral.js`)은 `localStorage["gonggan_pending_ref"] = JSON.stringify({ code, at })`, 코드 = `/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/`, 30일.
RefStash.astro 인라인 스크립트가 **같은 키·같은 모양**으로 저장하고 주소에서 `ref` 를 지운다(history.replaceState).
CTA 링크에도 `?ref` 를 다시 붙일 필요 없음(같은 도메인이라 앱이 기기에서 읽는다).
### 3-4. 앱 설치 배너
안드로이드 «앱으로 보기» 띠(`src/lib/appInstall.js` 규칙)와 아이폰 스마트 앱 배너 메타(`VITE_APP_STORE_ID` → Astro 환경변수 `APP_STORE_ID`)를 같게. JS 는 띠 닫기 정도만.

## 4. 템플릿 그림 — 힉스필드

디자인 가족 = 「내 한도 · 서류」·「요청을 보냈어요」: 깊은 초록 `#0E2B1D` · 아이보리 `#F4EFE4` · 금 `#D6A756`(선 `rgba(214,167,86,0.35)`) · 배경 `#F5F1EA`.

### 4-1. 공종별 기본 커버(16:9, 1200×675 webp q80, 60KB 안쪽) → `pages-astro/public/images/company-cover/<key>.webp`
| key | specialties(첫 공종) | 장면 |
|---|---|---|
| bath | 욕실 · 방수/누수 · 줄눈/탄성코트 | 새 수전·깨끗한 줄눈의 욕실 한쪽 |
| kitchen | 주방 | 정리된 상판·싱크 |
| film | 인테리어 필름 · 몰딩/도어 | 필름 새로 입힌 방문·문틀 근접 |
| finish | 바닥/도배 · 페인트 · 타일 | 막 끝낸 바닥과 벽, 빈 방 |
| repair | (기본) 조명/전기 · 철거 · 없음 | 공구 가방·레이저 레벨, 정돈된 현관 |
| space | 아파트 전체/부분 · 원룸 · 카페/식당 · 오피스 · 상가 | 완성된 거실(사람 없음) |
### 4-2. 빈 상태 2장(1:1, 512 webp, 25KB 안쪽) → `…/images/empty/portfolio-first.webp` · `review-first.webp`

### 4-3. 절차(09-25 7차 방법)
1. 참고 그림 `media_import_url`: 색 `https://gongganmarket.com/images/request-sent-v2.webp` · 점토 엠블럼 `https://gongganmarket.com/images/emblem/deposit.webp`
2. `generate_image` 모델 **`gpt_image_2_5`**, 참고는 `image_references`
3. 공통 꼬리: `no people, no faces, no hands, no text, no letters, no logos, no watermark, photorealistic editorial interior photography, soft natural light, deep green #0E2B1D and warm ivory #F4EFE4 palette with subtle gold #D6A756 accents, Korean apartment interior, 16:9`
   (빈 상태는 `1:1, flat clay illustration, centered object, plenty of empty space`)
4. 앞부분
   - bath `a freshly renovated small Korean apartment bathroom corner, new chrome faucet on a white washbasin, clean grout lines, morning light`
   - kitchen `a tidy renovated kitchen counter and sink, matte cabinets, a single plant, calm morning light`
   - film `close-up of an interior door and frame newly wrapped in wood-grain interior film, crisp edges, hallway light`
   - finish `an empty room right after new flooring and wallpaper, clean baseboards, sunlight across the floor`
   - repair `a neat toolbag, laser level and folded drop cloth on an apartment entrance floor, organized professional tools`
   - space `a finished Korean apartment living room after remodeling, sofa and rug, no clutter`
   - empty/portfolio-first `a gold-framed empty picture frame with a measuring tape resting on it`
   - empty/review-first `five empty stars outlined in gold arranged in an arc`
5. PIL 로 줄여 webp. 390px 폭에서 보고 글자·사람이 섞였으면 다시. **대표에게 모아 보여 주고 고른 뒤** 넣는다.
6. 크레딧: 11차 인계 기준 약 19 — 최소 8장. 모자라면 대표에게 먼저.
7. 규칙: AI 그림은 **커버·빈 상태에만**. 시공 사례 칸에는 업체가 올린 실제 사진만.

## 5. 순서 · 확인

1. `pages-astro` 뼈대 + `[ref].astro` + Supabase 읽기 → 로컬 `npm run dev` 로 실제 업체 1곳(uuid)·예시 없는 업체·없는 주소 3가지 확인
2. 컴포넌트 10구역 + 빈 상태 · 힉스필드 그림 넣기
3. 머리(SEO)·JSON-LD·RefStash·설치 배너
4. Lighthouse(모바일) 성능 90+ · JS 전송 20KB 안쪽 · 390px 스크린샷 3장(사례 0 · 사례 있음 · 404)
5. Vercel `gonggan-pages` 프로젝트 만들기(대표 계정 · 환경변수 대표) → 미리보기 주소로 확인
6. 기존 `vercel.json` 에 `/p/:ref*` 외부 rewrite 추가 PR → **머지는 대표 말 뒤**
7. 운영 확인: 카톡 미리보기(업체 이름·사진) · `?ref=` 로 들어와 가입 → 초대 수 +1 · 안드로이드 크롬 «앱으로 보기»

되돌리기: `vercel.json` 의 외부 rewrite 한 줄만 지우면 지금 React 공개 페이지(#805·#806)로 돌아간다.

## 6. 규칙

- 보고 한국어 · 대표가 할 일(Vercel 프로젝트·환경변수·머지)은 따로 칸으로.
- 키·환경변수 입력은 대표 · anon 키 말고 서비스 키를 Astro 에 넣지 않는다(읽기만).
- 없는 기능 약속 금지(안전결제는 정식 오픈 뒤) · 앱 쪽 코드(`src/`)는 이 작업에서 고치지 않는다(필요하면 따로 PR).

## 추가(09-29) — 방문 수(156)

- 앱의 업체 페이지는 사람이 열 때 `rpc/company_page_view` (`{ p_company_id }`, anon 키로 호출 가능)를 **같은 기기 하루 한 번** 부른다(기기 기록 `gonggan_pv:<업체ID>` = 한국 날짜 YYYY-MM-DD). 업체 주인이 자기 페이지를 연 건 세지 않는다.
- Astro 페이지로 운영을 옮길 때도 같은 규칙으로 작은 스크립트에서 부른다(서버 렌더에서 부르면 로봇·캐시까지 세진다 — 브라우저에서만).
- 보기는 `rpc/company_page_stats`(주인 토큰) — 앱 마이페이지 «내 업체 페이지 공유» 줄에 «이번 주 방문 N명 · 누적 M명».
