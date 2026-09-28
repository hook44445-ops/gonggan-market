// 업체 페이지 꾸미기(154) — 커버 사진 · 로고 · 소개글. 규칙은 서버 company_set_profile 과 같다.
//   사진은 photos 버킷 company/<업체ID>/… 에만(서버가 그 주소만 받는다) · 소개 300자.

export const INTRO_MAX = 300;
export const PROFILE_IMAGE_PREFIX = "/storage/v1/object/public/photos/company/";

export function companyImagePath(companyId, kind, now = Date.now()) {
  return `company/${companyId}/${kind === "logo" ? "logo" : "cover"}_${now}.jpg`;
}

export function introProblem(text) {
  return String(text ?? "").trim().length > INTRO_MAX ? `소개는 ${INTRO_MAX}자까지 쓸 수 있어요` : null;
}

export function profileReasonText(reason) {
  return ({
    BAD_IMAGE: "사진을 다시 올려 주세요",
    INTRO_TOO_LONG: `소개는 ${INTRO_MAX}자까지 쓸 수 있어요`,
    COMPANY_NOT_FOUND: "업체를 찾을 수 없어요",
  })[reason] ?? "저장하지 못했어요 — 잠시 뒤 다시 시도해 주세요";
}

// 휴대폰 사진(수 MB)을 올리기 전에 줄인다 — 긴 변 maxSide, JPEG. 브라우저에서만.
export async function shrinkImage(file, maxSide = 1600, quality = 0.82) {
  if (!file || typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}
