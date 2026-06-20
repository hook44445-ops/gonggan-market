/* 공간마켓 FCM 서비스워커 — 백그라운드 알림 표시 + 클릭 시 딥링크 이동.
   firebase config 는 등록 시 query string 으로 전달받는다(SW 는 env 접근 불가). */
/* eslint-disable no-undef */

const FB_VER = '10.12.2';
importScripts(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app-compat.js`);
importScripts(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-messaging-compat.js`);

const params = new URLSearchParams(self.location.search);
const cfg = {
  apiKey:            params.get('apiKey') || '',
  authDomain:        params.get('authDomain') || '',
  projectId:         params.get('projectId') || '',
  messagingSenderId: params.get('messagingSenderId') || '',
  appId:             params.get('appId') || '',
};

if (cfg.apiKey && cfg.projectId) {
  firebase.initializeApp(cfg);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const n = payload.notification || {};
    const data = payload.data || {};
    self.registration.showNotification(n.title || '공간마켓', {
      body: n.body || '',
      icon: '/icons/icon-192-v2.png',
      badge: '/icons/icon-192-v2.png',
      data: { target_url: data.target_url || '/' },
    });
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.target_url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    })
  );
});
