# 작업 현황 (Claude 핸드오프용)

브랜치: `claude/stabilize-google-play-4kcK5` → squash-merge to `main`
프로덕션: https://gonggan-market-qkdh.vercel.app

## 변하지 않는 제약 (반드시 준수)
- 기능 삭제 금지. 현재 구조 유지 + 안정화 + 실제 운영준비가 목표.
- 자동송금/자동환불 구현 금지.
- 결제/에스크로/입찰/업체 status 관련은 보수적으로만 수정.
- GPS: 앱 마운트/실행 시 위치요청 금지. "현재 위치로 보기/설정" 탭할 때만 1회 getCurrentPosition. watchPosition/background GPS 금지.
- region: 기존 `region text` 필드 제거 금지(phased migration). `activity_regions`/`service_regions` jsonb(최대 2) 병행.
- Kakao fallback(MockMap) 제거 금지. real map 성공 시에만 fallback 숨김.

## 완료된 작업
- PR #107 MEDIUM 안정화 + Kakao 진단 로그
- PR #108 Phase A 지역정책 토대 (constants/regions.js, useGPS, useMapCenter, regionMatching, migration 010)
- PR #109 Phase B 지도화면 지역선택 UI + GPS 정책
- PR #110 Phase C 업체 service_regions + tiered fallback UX
- PR #111 Kakao 온스크린 DebugBadge (env/sdk/window.kakao/kakao.maps/mode/reason)
- 프로덕션 진단 결과: env=present, sdk=**failed**, reason=**sdk-load-error**
  → 키 문제 아님. SDK script의 네트워크 fetch 자체 실패(onerror).

## 진행중 (이 브랜치)
### A. Kakao SDK load 실패 정밀 진단
- script src를 protocol-relative(`//`) → 명시적 `https://` 로 변경
- onerror 시 실제 src/navigator.onLine/타입을 DebugBadge에 표시
- real map 성공 시 fallback 확실히 숨김(기존 동작 유지)
- **유저 액션 필요**: Kakao Developers 콘솔에 production + preview 도메인 모두 등록
  - https://gonggan-market-qkdh.vercel.app
  - https://gonggan-market-qkdh-git-claude-...-projects.vercel.app

### B. 브랜드 아이콘/OG 전면 교체 → "01 공간·연결형"(원형 연결 + 집 + 잎)
- 신규 마스터 아이콘 SVG + favicon/apple-touch/PWA/OG(1200x630) 생성
- index.html meta(og:image/twitter:image/favicon/apple-touch) + manifest.json 교체
- 파일명 version 부여(캐시버스트): `-v2`
- 톤: 아이보리(#FBF7EF/#F5F1EA) + 딥그린(#2E5F4B)

## 남은 작업(우선순위)
1. [A] KakaoMap https + onerror 상세 — (이 PR)
2. [B] 아이콘/OG 교체 — (이 PR)
3. [블로킹·유저] migration 010 Supabase 적용 + Kakao 도메인 등록
4. [낮음] Phase 3 MEDIUM 나머지
