# SEO 개선 Backlog

Search Console 색인 점검(2026-07)에서 확인된 항목 중, 이번 메타데이터 개선 PR
범위에는 포함하지 않고 이후 별도 작업으로 남겨두는 항목을 기록한다.

## 업체 상세 페이지 전용 URL (미착수)

**현재 상태**: 업체 프로필/포트폴리오 화면은 순수 클라이언트 상태 전환으로만
진입한다(`setScreen("portfolio")` + `selCo` state). `window.history.pushState`
호출이 없어 **브라우저 주소창 URL이 바뀌지 않고**, 그 결과:

- 공유 가능한 고유 URL이 없음
- `sitemap.xml`에 포함할 수 없음
- 봇 전용 프리렌더(`api/prerender.js` 패턴)를 적용할 대상 자체가 없음
- Google이 업체명·소개·후기를 색인할 방법이 원천적으로 없음

**필요 작업(향후)**:
1. `/company/:id` 또는 `/portfolio/:id` 형태의 라우트 설계(라우팅 구조 변경 —
   이번 PR의 "라우팅 대규모 변경 금지" 범위 밖이라 별도 계획 필요)
2. 진입 시 `pushState`로 URL 갱신(라운지 게시글의 `buildPostPath` 패턴 참고)
3. `api/sitemap.js`에 업체 목록 엔트리 추가(공개 업체만, deleted/suspended 제외)
4. `api/prerender.js`에 업체 상세용 렌더 함수 추가(업체명/소개/후기 요약/시공
   사례 텍스트, canonical, OG, JSON-LD `LocalBusiness` 또는 `Organization`)
5. 개인정보/영업비밀에 해당하지 않는 공개 정보만 노출(연락처 등은 기존과 동일하게
   비공개 유지)

우선순위: 라운지 콘텐츠 색인이 안정화된 이후 진행 권장(가장 트래픽 잠재력이 큰
콘텐츠 자산이지만, 라우팅 신설이 필요해 별도 스코프로 분리).
