// ── CSV 다운로드 유틸(라이브러리 無, UTF-8 BOM → Excel 바로 열림) ───────────────
// columns: [{ label, key?, get?(row) }]. get 우선, 없으면 row[key].
function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(rows, columns) {
  const header = columns.map((c) => csvCell(c.label)).join(",");
  const body = (rows || []).map((r) =>
    columns.map((c) => csvCell(c.get ? c.get(r) : r[c.key])).join(",")
  );
  return [header, ...body].join("\r\n");
}

export function downloadCsv(filename, rows, columns) {
  const csv = buildCsv(rows, columns);
  // UTF-8 BOM 으로 한글 깨짐 방지(Excel)
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 파일명용 날짜 스탬프(YYYYMMDD_HHmm)
export function csvStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
