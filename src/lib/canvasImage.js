// 카드 캔버스가 같이 쓰는 그림 불러오기(전·후 카드 · 견적 비교표 · 후기 카드).
//   배경 그림(힉스필드 09-30 · public/images/cards)은 «있으면 깔고, 못 오면 지금 단색 그대로» — 오프라인·느린 망에서도 카드는 나온다.
//   ⚠️ 공유 버튼 안에서 그림을 기다리면 아이폰이 공유창을 막는다(사용자 동작이 끊긴다) → 화면이 열릴 때 미리 받아 둔다(preload).
export const CARD_BG = {
  beforeAfter: "/images/cards/before-after-bg.webp",
  bidCompare: "/images/cards/bid-compare-bg.webp",
  review: "/images/cards/review-bg.webp",
};

export function loadImage(src) {
  return new Promise((ok, fail) => {
    const img = new Image();
    if (!String(src).startsWith("blob:") && !String(src).startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error("IMG"));
    img.src = src;
  });
}

const cache = new Map();
// 실패하면 null(던지지 않는다) · 한 번 받은 것은 다시 받지 않는다
export function loadCardBg(src) {
  if (typeof Image === "undefined") return Promise.resolve(null);
  if (!cache.has(src)) cache.set(src, loadImage(src).catch(() => null));
  return cache.get(src);
}

// 배경을 폭에 맞춰 위에서부터 깐다(세로가 모자라면 아래는 이미 칠한 단색이 보인다)
export function paintCardBg(ctx, bg, W) {
  if (!bg) return false;
  const w = bg.naturalWidth || bg.width, h = bg.naturalHeight || bg.height;
  if (!w || !h) return false;
  ctx.drawImage(bg, 0, 0, W, Math.round((W * h) / w));
  return true;
}
