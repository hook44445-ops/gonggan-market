// 공간마켓 Service Worker — 캐시 무력화(no-cache) 버전
//
// 배경: 과거 버전의 SW가 index.html/정적자산을 cache-first 로 보관해, 새 배포
// 이후에도 기기(특히 TWA 내장 크롬)에 옛 UI가 계속 표시되는 문제가 반복됐다.
// 옛 SW가 기기에서 새 SW로 갱신되기 전까지 옛 셸을 계속 제공하는 것이 원인이다.
//
// 해결: 이 SW는 캐시를 일절 사용하지 않는다.
//   1) install: skipWaiting 으로 즉시 활성 SW가 되어 옛 SW를 대체한다.
//   2) activate: 이름과 무관하게 "모든" 캐시를 삭제(옛 precache 포함)하고
//      clients.claim() 으로 열린 페이지를 즉시 제어한다. 그러면 index.html 의
//      controllerchange 핸들러가 1회 새로고침해 네트워크에서 최신 셸을 받는다.
//   3) fetch 핸들러를 두지 않는다 = 브라우저 기본(네트워크) 처리. 어떤 응답도
//      캐시에서 제공하지 않으므로 staleness 가 구조적으로 발생하지 않는다.
//      (Vite 자산은 해시 파일명이라 HTTP 캐시를 써도 항상 최신이 로드되고,
//       index.html 은 Vercel 이 revalidate 로 서빙해 항상 신선하다.)
//
// 결과: 이 SW로 갱신되는 순간 기존 캐시가 전부 비워지고, 이후로는 SW로 인한
// 캐시 staleness 가 더 이상 발생하지 않는다.

const SW_VERSION = "gonggan-v7-nocache";

self.addEventListener("install", () => {
  // 대기 없이 즉시 활성화되어 옛 캐시-우선 SW를 대체한다.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 이름과 무관하게 모든 Cache Storage 항목 삭제 (옛 precache/셸 포함).
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      // 열린 페이지를 즉시 제어 → controllerchange 발생 → index.html이 1회 리로드.
      await self.clients.claim();
    })()
  );
});

// 의도적으로 fetch 리스너 없음:
//   SW가 어떤 요청도 가로채지/캐시하지 않게 하여 항상 네트워크 최신본을 받는다.
