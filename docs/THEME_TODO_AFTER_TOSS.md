# 테마 후속 작업 — 토스 심사 완료 후 진행

> 작성: 2026-09-15 · 선행 작업: 파트너 네이비 테마 도입(커밋 `b04a812`)
>
> **왜 미뤘나**: 토스페이먼츠가 현재 `/safe-payment`, `/tokens`, `/refund` 를
> 카드사 심사용으로 검토 중이다. 심사 진행 중에 해당 페이지의 화면이 바뀌면
> 심사 혼선이 생길 수 있어, 시각 변화가 없는 리팩터링이라도 보류했다.
>
> **진행 조건**: 토스 카드사 심사 완료(승인 통보) 이후.

---

## 1. 하드코딩 그린 hex → 테마 토큰(C.*) 전환

아래 파일들은 아직 `#2E5F4B` 같은 hex 를 직접 쓰고 있어 역할별 테마
(`data-role="company"` → 네이비)를 따르지 않는다.

| 파일 | 개수 | 비고 |
|---|---|---|
| `src/screens/SafePaymentScreen.jsx` | 10 | **토스 심사 대상** — 승인 후 진행 |
| `src/screens/TokenProductScreen.jsx` | 9 | **토스 심사 대상** — 승인 후 진행 |
| `src/screens/LegalScreen.jsx` | 3 | 약관·개인정보·환불 공통 |
| `src/screens/DownloadScreen.jsx` | 2 | |
| `src/screens/DeleteAccountScreen.jsx` | 1 | |
| `src/screens/SpaceMediaScreen.jsx` | 1 | |
| `src/App.jsx` | 1 | |
| `src/components/DebugOverlay.jsx` | 2 | dev 전용 — 우선순위 낮음 |

### 치환 매핑
```
#2E5F4B → C.brand      #1D3D2F → C.brandD     #EAF2EE → C.brandL
#B5D4C5 → C.brandM     #1F2A24 → C.text1      #3A7A5C → C.brandSoft
#E8F0EC → C.brandL     #6B8E5A → C.leaf
```

### 주의
- 고객(`:root`) 기준으로는 **시각 변화가 없다**(토큰 폴백값이 동일 hex).
- 단, `/safe-payment` 등 공개 페이지는 파트너 랜딩(`/partner`)에서 들어오면
  `data-role="company"` 가 남아 있을 수 있으므로, 전환 후 색이 네이비로
  바뀌어도 괜찮은지 페이지별로 판단할 것.
  (현재 `PartnerLandingScreen` 은 unmount 시 `applyRoleTheme("consumer")` 로 복원함)

---

## 2. 관리자(admin) 테마 결정 — 미정

현재 `mode === "admin"` 은 `data-role` 을 설정하지 않아 **고객 그린**으로 보인다.
관리자 콘솔도 네이비로 통일할지 결정 필요.

- 적용 시: `src/components/MainApp.jsx` 의 `applyRoleTheme(mode)` 호출부에서
  `mode === "admin"` 도 `"company"` 로 넘기거나, `theme.css` 에
  `[data-role="admin"]` 세트를 추가하면 된다(1줄 수준).

---

## 3. 서류센터 카드 — Tailwind 클래스 의존 (별개 이슈)

`DocumentChecklistCard.jsx`(className 22곳), `DocumentUploadCard.jsx`(10곳) 가
`text-[#2E5F4B]`, `rounded-full`, `h-12` 같은 **Tailwind 유틸 클래스**로만
스타일을 잡고 있다.

**그런데 이 저장소에는 Tailwind 가 설치되어 있지 않다**
(`package.json` 의존성에 없음 · 설정 파일 없음).
→ 해당 카드들은 현재 스타일이 적용되지 않은 상태로 렌더될 가능성이 높다.

확인 후 둘 중 하나 선택:
- (a) 다른 컴포넌트와 동일하게 **인라인 스타일 + C 토큰**으로 재작성 (권장 — 일관성)
- (b) Tailwind 를 실제로 도입 (빌드 설정·번들 영향 큼)

---

## 체크리스트

- [ ] 토스 카드사 심사 완료 확인
- [ ] 위 1번 파일들 토큰 전환 + 빌드/테스트
- [ ] 2번 관리자 테마 방침 결정 및 반영
- [ ] 3번 서류센터 카드 스타일 실태 확인 후 처리
