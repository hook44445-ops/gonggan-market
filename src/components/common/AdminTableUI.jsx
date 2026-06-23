import { C, R } from "../../constants";

// ── 관리자 대시보드 공용 표 UI ────────────────────────────────────────────────
// 거래관리·정산관리·프로젝트증빙관리에서 "바이트 동일"하게 반복되던 토글 칩/표 헤더·셀을
// 단일 소스로 통합. 기존 인라인 정의와 픽셀·동작 100% 동일(신규 스타일 없음).
// 주의: FinanceDashboard 의 Chip 은 padding/whiteSpace 가 달라(의도된 차이) 통합 대상이 아님 → 그대로 둔다.
export const Chip = ({ active, onClick, children }) => (
  <button onClick={onClick}
    style={{ padding: "6px 12px", borderRadius: R.full, fontSize: 12, fontWeight: 700,
      border: `1px solid ${active ? C.brand : C.bgWarm}`, cursor: "pointer", whiteSpace: "nowrap",
      background: active ? C.brand : C.surface, color: active ? "#fff" : C.text2 }}>{children}</button>
);

export const Th = ({ children }) => (
  <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 11, fontWeight: 700,
    color: C.text3, whiteSpace: "nowrap" }}>{children}</th>
);

export const Td = ({ children, mono }) => (
  <td style={{ padding: "9px 10px", fontSize: 12, color: C.text1, whiteSpace: "nowrap",
    fontFamily: mono ? "monospace" : "inherit" }}>{children}</td>
);
