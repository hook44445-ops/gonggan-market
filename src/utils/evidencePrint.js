// ════════════════════════════════════════════════════════════════════
// 분쟁 증빙 한 장 인쇄(09-26 · 대표 「거래 한 건의 GPS·사진·채팅·단계 승인 기록을 한 장으로, 인쇄할 수 있게」)
//   관리자 › 공사 증빙 › 증빙 상세 「🖨 증빙 인쇄」가 이 HTML 을 새 창에 열고 인쇄 창을 띄운다.
//   순수 함수(데이터 → HTML 문자열). 모든 값은 이스케이프 — 채팅 글이 HTML 로 해석되지 않게.
//   ⚠️ 읽기 전용 기록물. 개인 연락처는 본문 그대로(분쟁 증빙 목적) — 외부 공유 금지 문구를 머리에 둔다.
// ════════════════════════════════════════════════════════════════════

export const escHtml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fmt = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return escHtml(iso);
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

/* 에스크로 날짜 칸 → 한국어 이름(없는 칸은 칸 이름 그대로) */
const STEP_LABEL = {
  created_at: "계약 생성", step1_deposited_at: "에스크로 결제(입금)", step2_approved_at: "착공 승인",
  step3_approved_at: "중간 점검 승인", step4_approved_at: "완료 확인", step5_completed_at: "정산 완료",
  expected_completion_at: "예상 완공일", dispute_opened_at: "이의 신청", updated_at: "마지막 변경",
};

export function escrowDateRows(esc) {
  if (!esc) return [];
  return Object.entries(esc)
    .filter(([k, v]) => /_at$/.test(k) && v)
    .map(([k, v]) => ({ key: k, label: STEP_LABEL[k] || k, at: v }))
    .sort((a, b) => new Date(a.at) - new Date(b.at));
}

/**
 * @param {object} p
 *  row: 증빙 행(area·customer·company·request_id·escrow·checkpoints·direct_deal_reports)
 *  timeline: [{label, on}] · fin: {gmv, feeTotal, companyPayout} · money: (n)=>문자열
 *  chat: {count, last, recent:[{sender_type, created_at, text}], kw:[]} | null
 *  photoUrls: { [checkpointId|index]: [url…] } — 서명 주소로 바꾼 것
 *  printedBy: 출력한 관리자 이름 · now: 출력 시각(ISO)
 */
export function buildEvidencePrintHtml({ row, timeline = [], fin = {}, money = (n) => String(n), chat = null, photoUrls = {}, printedBy = "", now = new Date().toISOString() }) {
  const esc = row?.escrow || null;
  const cps = row?.checkpoints || [];
  const tr = (k, v) => `<tr><th>${escHtml(k)}</th><td>${v}</td></tr>`;
  const e = escHtml;

  const summary = [
    tr("지역 · 공사", e(row?.area || "—")),
    tr("고객", e(row?.customer?.name || "—")),
    tr("업체", e(row?.company?.name || "미배정")),
    tr("요청 번호", e(row?.request_id || "—")),
    tr("계약 번호", e(esc?.id || "—")),
    tr("계약 금액", fin?.gmv ? e(money(fin.gmv)) : "—"),
    tr("플랫폼 수수료", fin?.gmv ? e(money(fin.feeTotal)) : "—"),
    tr("정산 예정", fin?.gmv ? e(money(fin.companyPayout)) : "—"),
    tr("거래 상태", e(esc?.transaction_status || "—")),
    tr("분쟁", e(esc?.dispute_status ? `${esc.dispute_status}${esc.dispute_reason ? ` — ${esc.dispute_reason}` : ""}` : "없음")),
  ].join("");

  const tl = timeline.map((t) => `<li class="${t.on ? "on" : ""}">${t.on ? "✓" : "○"} ${e(t.label)}</li>`).join("");

  const steps = escrowDateRows(esc);
  const stepRows = steps.length
    ? steps.map((s) => `<tr><td>${fmt(s.at)}</td><td>${e(s.label)}</td></tr>`).join("")
    : `<tr><td colspan="2" class="muted">기록 없음</td></tr>`;

  const gpsRows = cps.length
    ? cps.map((cp) => `<tr><td>${e(cp.checkpoint_type || "체크포인트")}</td><td>${fmt(cp.captured_at)}</td><td>${cp.lat != null ? `${e(cp.lat)}, ${e(cp.lng)}` : "—"}</td><td>${e(cp.road_address || cp.jibun_address || "—")}</td><td>${cp.accuracy != null ? e(cp.accuracy) + "m" : "—"}</td><td>${e(String(cp.captured_by || "").slice(0, 8) || "—")}</td></tr>`).join("")
    : `<tr><td colspan="6" class="muted">GPS 체크포인트 없음</td></tr>`;

  const photoBlocks = cps.map((cp, i) => {
    const urls = photoUrls[cp.id ?? i] || [];
    if (!urls.length) return "";
    return `<div class="ph"><div class="phh">${e(cp.checkpoint_type || "사진")} · ${fmt(cp.captured_at)} · ${urls.length}장</div>${urls.map((u) => `<img src="${e(u)}" alt="">`).join("")}</div>`;
  }).join("") || `<p class="muted">사진 증빙 없음</p>`;

  const msgs = (chat?.recent || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const chatBlock = !chat
    ? `<p class="muted">채팅을 불러오지 못함</p>`
    : `<p>메시지 ${e(chat.count ?? msgs.length)}건${(chat.count ?? 0) > msgs.length ? ` (아래는 최근 ${msgs.length}건)` : ""} · 마지막 ${fmt(chat.last)}${chat.kw?.length ? ` · <b class="warn">직거래 의심 키워드: ${e(chat.kw.join(", "))}</b>` : ""}</p>` +
      (msgs.length ? `<table class="chat">${msgs.map((m) => `<tr><td class="t">${fmt(m.created_at)}</td><td class="w">${e(m.sender_type || "—")}</td><td>${e(m.text || "—")}</td></tr>`).join("")}</table>` : `<p class="muted">메시지 없음</p>`);

  const reports = (row?.direct_deal_reports || []);
  const reportBlock = reports.length
    ? `<table>${reports.map((d) => `<tr><td>${fmt(d.detected_at)}</td><td>${e(d.trigger_type)}</td><td>${e(d.status)}</td></tr>`).join("")}</table>`
    : `<p class="muted">없음</p>`;

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>공사 증빙 기록 — ${e(String(row?.request_id || "").slice(0, 8))}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #222; font-size: 11.5px; line-height: 1.5; }
  h1 { font-size: 18px; margin: 0 0 2px; } h2 { font-size: 13px; margin: 16px 0 6px; padding-bottom: 3px; border-bottom: 1.5px solid #2f5d4a; color: #2f5d4a; }
  .meta { color: #666; font-size: 10.5px; margin-bottom: 8px; } .notice { background: #f6f1e6; padding: 6px 9px; border-radius: 6px; font-size: 10.5px; }
  table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f7f7f5; width: 26%; font-weight: 600; } .muted { color: #999; } .warn { color: #b3261e; }
  ul.tl { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 4px 12px; } ul.tl li { color: #aaa; } ul.tl li.on { color: #2f5d4a; font-weight: 700; }
  .ph { break-inside: avoid; margin-bottom: 8px; } .phh { font-weight: 600; margin-bottom: 4px; }
  .ph img { width: 31%; height: 120px; object-fit: cover; margin: 0 1% 4px 0; border: 1px solid #ddd; border-radius: 4px; }
  table.chat td.t { width: 22%; white-space: nowrap; color: #666; } table.chat td.w { width: 10%; color: #666; }
  tr { break-inside: avoid; } @media screen { body { max-width: 860px; margin: 20px auto; } }
</style></head><body>
<h1>공간마켓 공사 증빙 기록</h1>
<div class="meta">출력 ${fmt(now)}${printedBy ? ` · 출력자 ${e(printedBy)}` : ""} · 요청 ${e(row?.request_id || "—")}</div>
<div class="notice">분쟁 조정·확인용 내부 기록입니다. 개인정보가 포함되어 있으니 당사자·조정 기관 외에 공유하지 마세요. 원본 데이터는 공간마켓 서버에 보관되어 있습니다.</div>
<h2>거래 요약</h2><table>${summary}</table>
<h2>진행 단계</h2><ul class="tl">${tl}</ul>
<h2>단계 승인 · 결제 기록</h2><table><tr><th style="width:30%">시각</th><th>내용</th></tr>${stepRows}</table>
<h2>현장 GPS 기록</h2><table><tr><th>단계</th><th>시각</th><th>좌표</th><th>주소</th><th>정확도</th><th>올린 사람</th></tr>${gpsRows}</table>
<h2>사진 증빙</h2>${photoBlocks}
<h2>대화 기록</h2>${chatBlock}
<h2>직거래 의심 신고</h2>${reportBlock}
</body></html>`;
}
