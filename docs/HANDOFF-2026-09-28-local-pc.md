# 인계지시서 — 2026-09-28 · 로컬 PC(대표 컴퓨터)에서만 할 수 있는 것

받는 사람: 대표 김태웅 · 로컬 PC 에서 일하는 다음 Claude 세션.
앞 문서: `docs/HANDOFF-2026-09-28-solo-partner.md`(오늘 만든 기능 전체).

클라우드 세션(원격 컨테이너)은 **운영 사이트(gongganmarket.com) 접속이 네트워크 정책에 막혀 있고**,
Supabase·Vercel·Play Console·App Store Connect 에 로그인할 수 없으며, 휴대폰도 없다.
아래는 그래서 대표 PC(또는 휴대폰)에서만 할 수 있는 일이다. 코드는 전부 main 에 머지됐다(#795~#801).

---

## A. Supabase SQL Editor — 운영 SQL (순서대로)

| 순서 | 파일 | 상태 | 확인 |
|---|---|---|---|
| 1 | `supabase/migrations/146_direct_ledger_referral.sql` | ✅ 09-28 실행(true 5개) | — |
| 2 | `supabase/migrations/147_tester_signups.sql` | [ ] | true 3개 + `owner_accounts` ≥ 1 |
| 3 | `supabase/migrations/148_referral_reward.sql` | [ ] | `referral_reward_ok` true |

- ⚠ 146 을 다시 돌리면 `referral_claim` 이 보상 없는 옛 버전으로 돌아간다 → 그 뒤에 **148 을 꼭 다시**.
- `owner_accounts` 가 0 이면 010-2740-6030 으로 가입된 계정이 없다는 뜻 → 테스터 신청 푸시를 받을 사람이 없다.

## B. Vercel › 공간마켓 › Settings › Environment Variables (Production) → 넣은 뒤 Redeploy 한 번

| 이름 | 값 | 언제 | 켜지는 것 |
|---|---|---|---|
| `VITE_APP_STORE_ID` | App Store Connect › 앱 정보 › **Apple ID(숫자)** | 애플 등록 직후 | 아이폰 사파리 «받기» 스마트 배너 · 별 4~5 후기 뒤 앱스토어 별점 요청 |
| `VITE_PLAY_PUBLIC` | `1` | Play **정식 출시 뒤**(비공개 테스트 중엔 넣지 않는다) | 안드로이드 «앱으로 보기»가 Play 로 · 별점 요청 |

- 둘 다 공개 값(비밀 아님)이라 `VITE_` 로 둔다. 비밀 키는 절대 `VITE_` 로 만들지 않는다(11차 인계 0-0).

## C. App Store Connect (애플 등록 — 오늘·내일)

- [ ] 문안: `store/APPSTORE-ko.md` — 앱 이름 · 부제 · 키워드 · 프로모션 텍스트 · 새로운 기능 그대로 붙여 넣기
  - 설명은 `store/ASO-ko.md` 「자세한 설명」(`**` 만 지우고)
  - 키워드에 다른 회사 이름 금지(반려 사유)
- [ ] 스크린샷 10장 `store/apple-ko/*.png`(09-24 업로드됨 — 「저장」 눌렀는지 확인)
- [ ] 09-24 인계: 프로모션 텍스트가 «가입비 0원,» 빠진 채 편집 중이던 건 — 새 문안으로 덮어쓰기
- [ ] iOS 빌드: `gonggan-ios`(Expo) → EAS 빌드 → TestFlight → 심사 제출. APNs 키(iOS 푸시)는 대표 Apple 계정에서.
- [ ] 등록되면 Apple ID 숫자 → 위 B 의 `VITE_APP_STORE_ID`

## D. Google Play Console (급하지 않음 — 대표 09-28)

- [ ] 비공개 테스트가 **이메일 목록** 방식인지 확인
- [ ] `/testers` 에 쌓인 메일 → 「추가 대기 메일 한 번에 복사」 → 테스터 목록에 붙여 넣기 → 「추가함」
- [ ] 테스터 12명 · 14일 연속 참여 채우면 프로덕션 출시 신청(조건은 콘솔에서 확인)
- [ ] 정식 출시 때 스토어 등록정보를 `store/ASO-ko.md` 새 문안으로(제목 「공간마켓 – 인테리어·집수리 비교견적」)
- [ ] 정식 출시 뒤 B 의 `VITE_PLAY_PUBLIC=1`

## E. 안드로이드 앱 빌드(TWA) — 새 스토어 빌드가 필요할 때만

- 웹을 고치면 앱에도 바로 반영된다(TWA 는 gongganmarket.com 을 연다) → 오늘 작업은 **새 빌드 없이** 앱에 나간다.
- 새 빌드가 필요하면: `android-twa/` · Android SDK · Java 21+ · `build.sh`.
  버전 번호가 두 곳에서 어긋나 있다 — `twa-manifest.json` 1.0.17(17) vs `app/build.gradle` 1.0.19(19). 올릴 땐 **둘 다 20 이상**으로 맞춘다.
- ⚠ 보안: `android-twa/build.sh` 에 서명 키 비밀번호가, `android-twa/gonggan-release.keystore` 가 저장소에 들어 있다.
  저장소가 공개로 바뀌거나 공유되면 누구나 앱을 대표 이름으로 서명할 수 있다 → 로컬 PC 로 옮기고 저장소에서 빼는 것을 권함(Play 앱 서명을 쓰는 중이면 업로드 키 재설정 가능). 대표 결정 사항.

## F. 휴대폰으로 확인(배포 뒤)

1. [ ] 공간마켓 앱(010-2740-6030 계정) 알림 허용 + 앱 안 푸시 설정 켜기
2. [ ] 다른 폰/PC 로 `gongganmarket.com/download` → 메일 넣고 「테스터 신청 보내기」 → **대표 폰에 푸시** → 눌러서 `/testers` 목록이 뜨는지
   - «로그인한 뒤 다시 열어 주세요»가 나오면 앱에서 인증번호로 한 번 다시 로그인
3. [ ] 마이 › 친구 초대 — 코드·링크가 나오는지, 「+30 / +20 토큰」 안내
4. [ ] 새 번호로 초대 링크 가입 → 가입한 쪽 +20, 대표 쪽 +30 · «친구가 가입했어요» 알림
5. [ ] 관리자 › 업체 상세 › 대표 업체 「직영 켜기」 → 업체 카드에 «공간마켓 직영»
6. [ ] 업체 계정 › 마이 › 내 기록 › 「내 작업 장부」 — 한 건 적고 저장 · 새로고침 뒤 남는지
7. [ ] 안드로이드 폰 **크롬 브라우저**로 gongganmarket.com → 맨 위 «앱으로 보기» 띠(앱 안에서는 안 보여야 정상)
8. [ ] 견적 요청 — 예산 「50만원 이하」 · 평수 「평수 무관(작은 수리)」 · 더 보기 «수전·세면대/변기/실리콘/문 손잡이·경첩»

문제가 보이면 화면 캡처 + 어느 번호에서 막혔는지만 알려 주면 된다.

## G. 로컬 Claude 세션 규칙(11차 인계 그대로)

- 작업 폴더는 워크트리(`D:\project\gonggan-fix-…`), 메인 폴더 `D:\project\gonggan-market` 은 건드리지 않는다. 새 일은 origin/main 에서 새 브랜치.
- 보고 한국어 · SQL 은 전체 원문 + 확인 칸 수 · 운영 SQL·키·메일 발송은 대표만 · 영구 삭제 금지 · 맨 `git stash` 금지.
