# 힉스필드 지시서 — 「비교」 화면 그림 (2026-10-01)

받는 사람: 로컬 PC 의 Claude 세션(힉스필드 연결된 곳).
앞 지시서: `docs/HANDOFF-2026-09-30-local-higgsfield.md`(공통 규칙·공유 카드 배경) · `docs/STORE-SHOTS-v2-2026-10-01.md`(스토어).

이번 것은 **#917 로 새로 생긴 화면**에만 붙는다. 스토어·공유 카드와 겹치지 않는다.

---

## 0. 작업 순서 (이대로)

```
① main 최신으로 받고 origin/main 에서 새 브랜치 (워크트리 · 메인 폴더 금지 · 맨 git stash 금지)
② 1번 넉 장 먼저 만든다 (2·3번은 있으면 좋은 정도)
③ public/images/shoot/ · public/images/compare/ 에 webp 로 저장
④ 아래 «코드 연결» 세 군데를 붙인다 (전부 onError 로 숨기는 방식)
⑤ npm test && npm run build
⑥ 폰 폭에서 요청서 3단계를 열어 넉 장이 한 세트로 보이는지
⑦ 그림 파일명을 잠깐 바꿔 보고 화면이 멀쩡한지 (fallback 확인)
⑧ 커밋 → PR. 커밋·PR 에 모델 이름 넣지 않는다
```

**1번 넉 장만 와도 값어치를 한다.** 2·3번이 늦어도 1번을 먼저 올린다.

---

## 0-1. 공통 규칙 (앞 지시서와 같다 — 어기면 다시 만들어야 한다)

- **그림에 글자를 넣지 않는다.** 글자는 코드가 브랜드 글꼴로 얹는다
- 색: 깊은 초록 `#1D3D2F` · 브랜드 초록 `#2E5F4B` · 금 `#D6A756` · 아이보리 `#F4EFE4`/`#F6F3EE` · 먹 `#1F2A24`
- 결: **점토(clay) + 종이 질감.** 기존 `public/images/emblem` · `growth` 와 같은 손맛
- 형식 **webp** · 한 장 **150KB 이하** · 파일명 소문자-하이픈
- **사람 얼굴 금지 · 실제 브랜드 금지 · 진짜 사진처럼 보이는 것 금지**
  (아래 1-1 은 특히 중요하다 — 진짜 사진처럼 보이면 고객이 「예시」가 아니라 「내 집 사진이 올라갔다」로 오해한다)

---

## 1. ★ 가장 먼저 — 「무엇을 찍어야 하나」 예시 4장

### 왜 이게 1번인가

#917 로 요청서에 **「지금 상태 사진」 칸**이 생겼다(5장까지). 그런데 **고객은 뭘 찍어야 할지 모른다.**
막연하면 거실 전경 한 장 찍고 끝낸다 — 그건 업체에게 아무 정보도 안 준다.

업체가 알아야 하는 건 **「고칠 곳을 가까이서」**다. 그 본을 그림 넉 장으로 보여 준다.
**이 넉 장이 요청서 품질을 가르고, 요청서 품질이 최종 견적 차이를 가른다**(대표 09-30).

| 파일 | 크기 | 무엇을 그리나 |
|---|---|---|
| `public/images/shoot/silicone.webp` | 160×160 | 욕실 코너 **실리콘 이음매를 가까이** — 검은 곰팡이 얼룩이 점토 질감으로 |
| `public/images/shoot/floor.webp` | 160×160 | **들뜬 장판/마루 모서리** — 한쪽이 살짝 떠서 그늘이 지는 단면 |
| `public/images/shoot/faucet.webp` | 160×160 | **수전 아래 이음부** — 물방울 한두 개가 맺힌 정도(홍수처럼 그리지 말 것) |
| `public/images/shoot/door.webp` | 160×160 | **낡은 방문 손잡이·문틀** — 필름이 살짝 들뜬 모서리 |

**넉 장이 한 세트로 보여야 한다** — 같은 시점(약간 위에서 비스듬히), 같은 거리(손 뻗은 정도),
같은 배경 톤(아이보리), 같은 광원(왼쪽 위 부드러운 빛). 한 장만 튀면 세트가 깨진다.

**「가까이서 한 곳만」이 이 그림의 전부다.** 방 전체가 보이면 실패다.

### 붙여 넣을 프롬프트 (넉 장 공통 머리 + 꼬리)

머리와 꼬리는 **넉 장 모두 똑같이** 쓴다. 가운데 한 줄만 바꾼다 — 그래야 세트가 된다.

```
Head (공통):
handmade clay diorama miniature, soft matte polymer clay texture, tiny scale model,
three-quarter view from slightly above, close macro framing of one small detail only,
ivory #F4EFE4 paper-textured background, soft diffused light from upper left,
muted palette of deep green #1D3D2F, brand green #2E5F4B, warm gold #D6A756, ink #1F2A24,
centered subject, generous empty margin, square 1:1

Body (한 줄만 바꾼다):
 silicone → bathroom tile corner joint with dark mildew stain along the silicone seam
 floor    → edge of vinyl floor sheet lifting slightly at the corner, small shadow underneath
 faucet   → underside joint of a kitchen faucet with one or two water droplets forming
 door     → corner of an old door frame where the film wrap is peeling up slightly

Tail (공통):
no text, no letters, no numbers, no logos, no watermark, no people, no hands, no faces,
not photorealistic, no full room view, no wide shot, no clutter
```

> **꼬리를 지우지 말 것.** `no text` 와 `not photorealistic` 이 이 그림의 생명이다.
> 사진처럼 나오면 고객이 「예시」가 아니라 「내 집 사진이 올라갔다」로 오해한다.

### 코드 연결 (작게)

`src/components/RequestModalBeta.jsx` 의 「지금 상태 사진」 설명 줄 아래에 넉 장을 한 줄로.

```jsx
<div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
  {["silicone", "floor", "faucet", "door"].map(k => (
    <img key={k} src={`/images/shoot/${k}.webp`} alt="" aria-hidden="true" width={44} height={44}
      loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }}
      style={{ borderRadius: 8, objectFit: "cover", opacity: .9 }} />
  ))}
</div>
```

**그림이 없으면 그냥 안 보인다**(`onError`). 지금 화면이 깨지지 않는다 — 이 규칙을 반드시 지킬 것.

---

## 2. 「먼저 누구를 부를까」 표 머리 그림

`#917` 의 비교표 머리(`src/components/BidCompareTable.jsx`)는 지금 글자만 있다.

| 파일 | 크기 | 무엇을 그리나 |
|---|---|---|
| `public/images/compare/side-by-side.webp` | 128×128 | **점토 집 세 채가 나란히**, 크기·지붕 모양이 조금씩 다르게. 가운데 집 위에 **금색 점 하나**(고른 표시). 글자·숫자·체크표 없음 |

이 표의 일은 **「금액 고르기」가 아니라 「누구를 부를지 좁히기」**다(대표 09-30).
그러니 **저울·계산기·돋보기로 그리지 말 것** — 값을 재는 그림이 아니라 **줄 세워 놓고 고르는** 그림이다.

```
handmade clay diorama, three small house models standing side by side in a row,
slightly different roof shapes and heights, soft matte polymer clay texture,
one small warm gold #D6A756 dot floating above the middle house,
ivory #F4EFE4 background, soft light from upper left,
deep green #1D3D2F and brand green #2E5F4B palette, square 1:1
no text, no numbers, no checkmarks, no scale, no magnifier, no calculator,
no people, no logos, not photorealistic
```

### 코드 연결 — `src/components/BidCompareTable.jsx` 표 머리(약 41줄, 「먼저 누구를 부를까」 줄)

```jsx
<img src="/images/compare/side-by-side.webp" alt="" aria-hidden="true" width={32} height={32}
  loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }}
  style={{ flexShrink: 0 }} />
```
머리 `div` 를 `display:flex; gap:10; align-items:center` 로 감싸고 글자 왼쪽에 둔다.

---

## 3. 「견적이 서로 벌어졌다면」 안내 그림

`src/screens/BidStatusScreen.jsx` 의 요청서 빈 곳 안내 카드. 지금 💡 이모지 자리다.

| 파일 | 크기 | 무엇을 그리나 |
|---|---|---|
| `public/images/compare/gap-hint.webp` | 120×120 | **점토 요청서 한 장**에 빈 네모 칸 두 개가 비어 있고, 그 옆에 **작은 점토 카메라** 하나. 「채우면 된다」는 느낌 — 경고·느낌표·빨강 금지 |

**고객을 나무라는 그림이 아니다.** X 표·경고 삼각형·빨간색을 쓰면 다시 만들어야 한다.

```
handmade clay diorama, a small clay request sheet lying flat with two empty blank boxes on it,
a tiny clay camera resting beside it, soft matte polymer clay texture,
ivory #F4EFE4 background, soft light from upper left, warm and calm,
deep green #1D3D2F and warm gold #D6A756 accents, square 1:1
no text, no letters, no red, no warning sign, no exclamation mark, no X mark,
no people, no logos, not photorealistic
```

### 코드 연결 — `src/screens/BidStatusScreen.jsx` 약 1186줄 「💡 견적이 서로 벌어졌다면」

`💡` 이모지를 아래로 바꾼다. 그림이 없으면 이모지로 되돌아가게 한다.

```jsx
<img src="/images/compare/gap-hint.webp" alt="" aria-hidden="true" width={24} height={24}
  loading="lazy"
  onError={(e) => { e.currentTarget.replaceWith(document.createTextNode("💡")); }}
  style={{ verticalAlign: "-5px", marginRight: 4 }} />
```

---

## 4. 만든 뒤

1. `public/images/shoot/` · `public/images/compare/` 에 넣고 커밋 → PR
2. 용량 확인: 한 장 150KB 이하 (`webp` 품질 80 부근이면 대개 맞는다)
3. 폰에서 요청서 3단계를 열어 **넉 장이 한 세트로 보이는지** — 톤이 하나라도 튀면 그 한 장만 다시
4. 그림을 **지운 채로도** 화면이 멀쩡한지 한 번 (파일명을 잠깐 바꿔 보면 된다)

---

## 5. 하지 말 것

- 글자·숫자·체크표를 그림 안에 넣기
- 1번 넉 장을 **사진처럼** 만들기 — 점토 모형이라야 「예시」로 읽힌다
- 3번에 경고·빨강 쓰기
- 스토어 스크린샷과 섞기 — 그건 `docs/STORE-SHOTS-v2-2026-10-01.md` 쪽 일이다
- 없는 기능을 그리기(안전결제 자물쇠 등 — `PAYMENTS_LIVE` 전이다)
