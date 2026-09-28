// QR코드 — 명함·현장 전단·차량에 붙일 업체 페이지 주소(대표 09-28 · 1인 사업자 활동).
//   qrcode-generator(MIT, 의존성 없음)로 칸만 만들고, 그림(SVG·PNG)은 화면이 그린다.
import qrcode from "qrcode-generator";

// 칸 배열 — true 가 검은 칸. 오류 정정 M(인쇄물이 조금 긁혀도 읽힌다)
export function qrMatrix(text, level = "M") {
  const qr = qrcode(0, level);
  qr.addData(String(text ?? ""), "Byte");
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

// SVG path 하나로 — 칸마다 사각형을 두면 수백 개라 무겁다. margin 은 둘레 빈칸 수(표준 4)
export function qrSvgPath(matrix, margin = 4) {
  let d = "";
  matrix.forEach((row, r) => row.forEach((on, c) => { if (on) d += `M${c + margin} ${r + margin}h1v1h-1z`; }));
  return { d, size: matrix.length + margin * 2 };
}
