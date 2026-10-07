import { test } from "node:test";
import assert from "node:assert/strict";
import { installOfferAfterRequest, isInApp, androidInstallUrl, shouldShowAndroidBanner, smartBannerContent } from "./appInstall.js";

const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S918N) Chrome/129";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)";

test("앱 안 판정 — TWA referrer · 설치된 PWA · 한 번 기억된 기기", () => {
  assert.equal(isInApp({ referrer: "android-app://com.gonggansai.gongganmarket/" }), true);
  assert.equal(isInApp({ standalone: true }), true);
  assert.equal(isInApp({ remembered: true }), true);
  assert.equal(isInApp({ referrer: "https://www.google.com/" }), false);
});

test("안드로이드 브라우저에만 · 앱 안·닫은 뒤 14일·다운로드 페이지에선 안 보인다", () => {
  const now = Date.UTC(2026, 9, 1);
  assert.equal(shouldShowAndroidBanner({ ua: ANDROID, now, path: "/lounge/posts/1" }), true);
  assert.equal(shouldShowAndroidBanner({ ua: IPHONE, now }), false);
  assert.equal(shouldShowAndroidBanner({ ua: ANDROID, inApp: true, now }), false);
  assert.equal(shouldShowAndroidBanner({ ua: ANDROID, closedAt: now - 3 * 86400000, now }), false);
  assert.equal(shouldShowAndroidBanner({ ua: ANDROID, closedAt: now - 15 * 86400000, now }), true);
  assert.equal(shouldShowAndroidBanner({ ua: ANDROID, now, path: "/download" }), false);
});

test("설치 주소 — 비공개 테스트 중엔 참여 안내, 정식 출시 뒤엔 Play", () => {
  assert.equal(androidInstallUrl(false), "/download");
  assert.equal(androidInstallUrl(true), "https://play.google.com/store/apps/details?id=com.gonggansai.gongganmarket");
});

test("아이폰 스마트 앱 배너 — 번호가 있을 때만", () => {
  assert.equal(smartBannerContent(""), null);
  assert.equal(smartBannerContent("6739012345"), "app-id=6739012345");
  assert.equal(smartBannerContent("6739012345", "https://gongganland.com/lounge/posts/1"),
    "app-id=6739012345, app-argument=https://gongganland.com/lounge/posts/1");
});

test("견적 요청 직후 앱 설치 제안 — 앱 안·PC·번호 없는 아이폰은 없음", () => {
  assert.equal(installOfferAfterRequest({ ua: ANDROID, inApp: true }), null);
  assert.equal(installOfferAfterRequest({ ua: "Mozilla/5.0 (Windows NT 10.0)" }), null);
  assert.equal(installOfferAfterRequest({ ua: IPHONE, appStoreId: "" }), null);
  assert.deepEqual(installOfferAfterRequest({ ua: IPHONE, appStoreId: "6739012345" }), { url: "https://apps.apple.com/app/id6739012345", store: "App Store" });
  assert.deepEqual(installOfferAfterRequest({ ua: ANDROID }), { url: "/download", store: "테스트 앱" });
  assert.equal(installOfferAfterRequest({ ua: ANDROID, playPublic: true }).store, "Google Play");
});

test("다운로드 화면 — 폰 종류별 버튼", async () => {
  const { downloadPlan } = await import("./appInstall.js");
  // 아이폰 · 번호 전: 스토어 버튼 없음 → 웹 안내
  assert.deepEqual(downloadPlan({ platform: "ios" }), { buttons: [], showTester: false, iosWaiting: true });
  // 아이폰 · 번호 뒤
  const ios = downloadPlan({ platform: "ios", appStoreId: "6700000001" });
  assert.equal(ios.buttons[0].url, "https://apps.apple.com/app/id6700000001");
  assert.equal(ios.showTester, false);
  // 안드로이드 · 비공개 테스트 중 / 정식 뒤
  assert.match(downloadPlan({ platform: "android" }).buttons[0].url, /apps\/testing/);
  assert.equal(downloadPlan({ platform: "android" }).showTester, true);
  const pub = downloadPlan({ platform: "android", playPublic: true });
  assert.match(pub.buttons[0].url, /store\/apps\/details/);
  assert.equal(pub.showTester, false);
  // 컴퓨터 — 둘 다
  assert.equal(downloadPlan({ appStoreId: "1", playPublic: true }).buttons.length, 2);
});
