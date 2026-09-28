# 로컬 지시서 — 업체 공개 페이지 구조 · 템플릿 · 힉스필드 (2026-09-28)

받는 사람: 로컬 PC 의 다음 Claude 세션(힉스필드 연결된 곳). 대표 김태웅, 호칭 「대표」, 보고 한국어.
앞 문서: `docs/HANDOFF-2026-09-28-local-pc.md`(SQL 147·148·149 · 환경변수 · 스토어).
작업 폴더: 워크트리 `D:\project\gonggan-fix-…`(origin/main 에서 새 브랜치). 메인 폴더 금지 · 맨 `git stash` 금지.

---

## 0. 왜 · 목표

대표 09-28 「1등 다운로드 앱」 → 업체가 **자기 공개 페이지**(`/p/짧은이름`, #805·#806)를 블로그·인스타·명함에 걸면
그 링크로 들어온 사람이 가입(초대 +30/+20)·설치로 이어진다. 그런데 **새 업체 페이지는 비어 보인다**
(시공 사례·후기 0건, 커버 그림 없음, 업체 얼굴은 이름 첫 글자). 대표 직영 업체도 교육(10/19~) 뒤 첫 공사 전까지 같다.

목표: **사례가 0건이어도 «믿고 부를 만한 업체»로 보이는 템플릿** — 힉스필드 그림으로 빈자리를 채우되,
실제 사례처럼 보이게 속이지 않는다(«예시»·«분위기 그림»이라고 알 수 있게).

## 1. 지금 구조 (코드 그대로)

주소 → 화면
- `/p/:ref` (App.jsx 정적 라우트) → `src/screens/PublicCompanyScreen.jsx` → `getCompanyByRef`(uuid 또는 slug 149)
  → `normalizeCompany`(MainApp) → **`src/screens/PortfolioScreenBeta.jsx`** `publicView` 로 렌더
- 봇(카톡·네이버·구글) → `vercel.json` `/p/:id` → `api/prerender.js` `renderCompany`(og:image = 첫 사례 사진, 없으면 `/og-space-v2.png`)

`PortfolioScreenBeta` 위→아래
| # | 구역 | 데이터 | 비었을 때 지금 |
|---|---|---|---|
| 1 | 스티키 머리(← · 스크롤 시 업체명·온도) | name · temp | — |
| 2 | 커버 16:9 | `company.cover` | **칸 자체가 없음**(예시 업체만 cover 있음 · DB 칸 없음) |
| 3 | 히어로: 얼굴 68px · Lv · 공간온도 · 업체명 | `company.logo` · level · temp | 얼굴 = 이름 첫 글자 |
| 4 | KPI 3칸: 시공 · 후기 · 평균응답 | completed_jobs · reviews · 응답 | 0 · 0 · — |
| 5 | 신뢰 줄(`CompanyTrustRow`) + «공간마켓 직영» 알약 | verified · has_insurance · 보증금 · license · is_direct | 흐린 빈 자리 |
| 6 | 업체 소개(태그) | specialties | 비면 구역 숨김 |
| 7 | 시공 포트폴리오(대표 1 + 격자 → 전체화면) | portfolios | 구역 숨김 |
| 8 | 시공 후기 | reviews | 구역 숨김 |
| 9 | 신뢰의 발자취 | created_at 등 | — |
| 10 | 하단 고정 CTA «공간마켓에서 무료 견적 받기» | — | — |

→ 새 업체는 2·6·7·8 이 비어 **1·3·4·5·9 만 남은 짧고 휑한 페이지**가 된다.

## 2. 템플릿 (만들 것)

디자인 가족 = 「내 한도 · 서류」·「요청을 보냈어요」(`RequestSentSheet`) 와 같게:
깊은 초록 `#0E2B1D` · 아이보리 `#F4EFE4` · 금 `#D6A756`(선 `rgba(214,167,86,0.35)`) · 본문 배경 `C.bg`.

### 2-1. 공종별 기본 커버(16:9) — 커버가 없는 업체에 자동
`specialties` 첫 공종 → 그림. 없으면 «집수리 일반».

| key | 공종(specialties 값) | 장면 |
|---|---|---|
| `bath` | 욕실 · 방수/누수 · 줄눈/탄성코트 | 새 수전·깨끗한 줄눈의 욕실 한쪽, 아침 빛 |
| `kitchen` | 주방 | 정리된 상판·싱크, 부드러운 빛 |
| `film` | 인테리어 필름 · 몰딩/도어 | 필름 새로 입힌 방문·문틀, 결이 보이는 근접 |
| `finish` | 바닥/도배 · 페인트 · 타일 | 막 끝낸 바닥과 벽, 빈 방 |
| `repair` | (기본) 집수리 일반 · 조명/전기 · 철거 | 공구 가방·레이저 레벨이 놓인 현관 바닥, 정돈된 작업 |
| `space` | 아파트 전체/부분 · 원룸 · 카페/식당 · 오피스 · 상가 | 완성된 거실(사람 없음) |

파일: `public/images/company-cover/<key>.webp` (1200×675, webp q80, 60KB 안쪽)

### 2-2. 빈 상태 그림 2장(정사각 · 작게)
- `public/images/empty/portfolio-first.webp` — «첫 시공 사례를 기다리는 중» 금 테두리 액자 + 줄자
- `public/images/empty/review-first.webp` — «첫 후기» 빈 별 다섯 개가 금선으로(글자 없음)
화면 문구(코드): 사례 0 → «첫 시공 사례를 준비하고 있어요 · 공사를 마치면 전·후 사진이 여기에 쌓여요»,
후기 0 → «아직 후기가 없어요 · 공간마켓에서 계약한 공사만 후기를 남길 수 있어요».

### 2-3. 업체 얼굴 기본(로고 없을 때)
지금 = 이름 첫 글자. 유지하되 배경을 깊은 초록 + 금 글자로(그림 필요 없음 · CSS).

## 3. 힉스필드 절차 (09-25 7차 방법 그대로)

1. 참고 그림: `media_import_url` 로 운영 이미지 가져오기
   - 색·질감 기준 `https://gongganmarket.com/images/request-sent-v2.webp`
   - 엠블럼 가족(빈 상태용) `https://gongganmarket.com/images/emblem/deposit.webp`
2. `generate_image` 모델 **`gpt_image_2_5`**, 참고 그림은 `image_references`(서버가 역할 바꿔 받음)
3. 공통 조건(모든 프롬프트 끝에 붙인다):
   `no people, no faces, no hands, no text, no letters, no logos, no watermark, photorealistic editorial interior photography, soft natural light, deep green #0E2B1D and warm ivory #F4EFE4 palette with subtle gold #D6A756 accents, Korean apartment interior, 16:9`
   (빈 상태 2장은 `16:9` 대신 `1:1, flat clay illustration, centered object, plenty of empty space` · 사진풍 대신 엠블럼 가족 점토풍)
4. PNG → PIL 로 1200폭(커버) / 512폭(빈 상태) webp q80. 큰 파일 금지(커버 60KB · 빈 상태 25KB 안쪽).
5. 한 장씩 390px 폭에서 줄여 보고(글자·사람 섞였으면 다시), 대표에게 6장 모아 보여 주고 고른 뒤 넣는다.
6. **크레딧**: 11차 인계 기준 약 19 남음 — 커버 6 + 빈 상태 2 = 최소 8. 다시 뽑을 여유가 부족하면 대표에게 먼저 묻는다.

프롬프트(앞부분 · 뒤에 3의 공통 조건)
- bath: `a freshly renovated small Korean apartment bathroom corner, new chrome faucet on a white washbasin, clean grout lines, morning light`
- kitchen: `a tidy renovated kitchen counter and sink, matte cabinets, a single plant, calm morning light`
- film: `close-up of an interior door and frame newly wrapped in wood-grain interior film, crisp edges, hallway light`
- finish: `an empty room right after new flooring and wallpaper, clean baseboards, sunlight across the floor`
- repair: `a neat toolbag, laser level and folded drop cloth on an apartment entrance floor, organized professional tools`
- space: `a finished Korean apartment living room after remodeling, sofa and rug, no clutter`
- empty/portfolio-first: `a gold-framed empty picture frame with a measuring tape resting on it`
- empty/review-first: `five empty stars outlined in gold arranged in an arc`

## 4. 코드 할 일(로컬 Claude · 그림 넣은 같은 PR)

1. `src/lib/companyCover.js` (+ `companyCover.test.js`, package.json test 목록에 추가)
   - `coverKeyFor(specialties)` → 위 표 · 매핑 없으면 `repair`
   - `coverFor(company)` → `company.cover` 가 있으면 그것, 없으면 `/images/company-cover/<key>.webp`
2. `PortfolioScreenBeta` — `publicView` 이고 `company.cover` 없으면 `coverFor` 그림 + 오른쪽 아래 작은 글씨 «분위기 그림»
   (실제 시공 사진으로 오해하지 않게 · `isSample` 경고와 같은 원칙). 앱 안 고객 화면에도 같이 쓸지는 대표에게 묻는다.
3. 빈 상태 두 구역(2-2) — 지금은 구역을 숨기는 곳에 그림 + 문구. **publicView 에서만**(앱 안 화면 변화는 대표 확인 뒤).
4. 얼굴 기본(2-3) CSS.
5. `api/prerender.js renderCompany` — 사례 사진이 없으면 og:image 를 `coverFor` 그림으로(카톡 미리보기가 기본 OG 대신 공종 그림).
6. 확인: `npm test` · `vite build` · 390px 스크린샷(사례 0 업체 · 사례 있는 업체 · 예시 업체) 세 장을 대표에게.

나중(대표 결정 뒤 · SQL 필요): 업체가 직접 올리는 커버·로고·소개글 — `companies.cover_url · logo_url · intro`(SQL 150) + 마이 › 파트너 관리 «내 업체 페이지 꾸미기».

## 5. 규칙

- 그림에 사람·얼굴·글자·로고 금지. AI 그림을 **실제 시공 사례 칸에 넣지 않는다**(사례는 업체가 올린 실제 사진만).
- 없는 기능 약속 금지(안전결제는 `PAYMENTS_LIVE`). 머지·배포는 대표가 말할 때만.
- 보고: 무엇을 만들었나 · 스크린샷 · 크레딧 몇 개 썼나 · 대표가 할 일.
