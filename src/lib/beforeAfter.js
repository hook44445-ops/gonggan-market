// 전·후 사진 카드(다운로드 · 09-29) — 공사 전·후 두 장 + 아래 QR 한 장짜리 이미지(1080×1350, 인스타·카톡 세로 비율).
//   고객: QR = 내 초대 링크(가입하면 공간토큰 선물) · 업체: QR = 내 업체 페이지(시공 사례·후기)
//   계산·문구만(캔버스 그리기는 components/BeforeAfterCard).

export const CARD_W = 1080, CARD_H = 1350;

// 사진을 칸에 꽉 채우기(가운데 잘라내기) — drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) 의 앞 네 값
export function coverCrop(srcW, srcH, dstW, dstH) {
  if (!(srcW > 0 && srcH > 0 && dstW > 0 && dstH > 0)) return null;
  const s = Math.max(dstW / srcW, dstH / srcH);
  const sw = dstW / s, sh = dstH / s;
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh };
}

// 제목 — 적은 것 우선, 없으면 공간 이름으로(「우리 집 욕실 공사 전·후」), 24자까지
export function cardTitle(title, space) {
  const t = String(title ?? "").trim();
  if (t) return t.slice(0, 24);
  const sp = String(space ?? "").trim();
  return (sp ? `우리 집 ${sp} 공사 전·후` : "우리 집 공사 전·후").slice(0, 24);
}

// 아래 띠 문구 — 없는 약속은 쓰지 않는다(선물은 초대 링크 가입일 때만)
export function cardFooter({ isCompany = false, companyName = "", reward = 20 } = {}) {
  if (isCompany) {
    return {
      head: `${String(companyName || "우리 업체").slice(0, 16)} 시공 사례`,
      sub: "QR을 찍으면 후기·사례를 볼 수 있어요",
    };
  }
  return {
    head: "공간랜드에서 견적 비교하고 고쳤어요",
    sub: `QR로 가입하면 공간토큰 ${reward}개를 드려요`,
  };
}

export function cardFileName(day) {
  return `공간랜드_전후_${String(day ?? "").replace(/-/g, "")}.png`;
}
