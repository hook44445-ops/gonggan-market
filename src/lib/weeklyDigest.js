// 월요일 주간 숫자 한 장(docs/PLAN-2026-09-30-no1-download-revisit.md 5절 · docs/WEEKLY-YYYY-MM-DD.md 로 붙인다).
//   관리자 화면 숫자(성장 150 · 푸시 도달 178 · 알림 읽음률 175 · USP 187/188)를 모아 마크다운 한 장으로.
//   지키는 것: **없는 숫자를 쓰지 않는다**(못 받은 칸은 «—»). «약한 숫자» 후보는 PLAN 5절 규칙을 숫자로만 적용한다 —
//   고르는 건 대표(«고른 것: ____»).
// 순수 JS — React·DB 없음.
import { notifyRows, pushReachLine } from "./notifyStats.js";
import { uspRows } from "./uspBoard.js";

const n = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const f = (v) => (n(v) == null ? "—" : n(v).toLocaleString("ko-KR"));

// 한국 날짜 «2026-10-05 (월)»
export function kstDateLabel(now = Date.now()) {
  const d = new Date(now + 9 * 3600000);
  const day = "일월화수목금토"[d.getUTCDay()];
  return `${d.toISOString().slice(0, 10)} (${day})`;
}
export const weeklyFileName = (now = Date.now()) => `docs/WEEKLY-${new Date(now + 9 * 3600000).toISOString().slice(0, 10)}.md`;

// PLAN 5절 규칙 → 약한 숫자 후보(숫자가 있을 때만 · 근거 숫자를 같이 적는다)
export function weakCandidates({ growth = null, pushReach = null, notify = [], usp = [] } = {}) {
  const out = [];
  const users = n(pushReach?.users), reach = n(pushReach?.reach);
  if (users && reach != null) {
    const pct = Math.round((reach / users) * 100);
    if (pct < 30) out.push(`푸시 받는 사람 ${pct}% (30% 미만) → 알림 켜기 입구 늘리기 · 아이폰 앱(G1)`);
  }
  for (const r of notifyRows(notify)) {
    if (r.sent >= 10 && r.rate != null && r.rate < 20) out.push(`«${r.label}» 알림 읽음 ${r.rate}% (보냄 ${r.sent}) → 문구·시각 바꾸기, 안 읽히면 끄기`);
  }
  const u7 = n(growth?.users_7d), ref7 = n(growth?.referred_7d);
  if (u7 && ref7 != null && ref7 / u7 < 0.1) out.push(`초대로 가입 ${ref7}/${u7} (10% 미만) → 공유 카드·공유 순간 늘리기`);
  const u2 = (Array.isArray(usp) ? usp : []).find((r) => r.id === 2);
  if (u2 && (u2.used ?? 0) >= 5 && u2.rate != null && u2.rate < 50) out.push(`요청 중 입찰 받은 비율 ${u2.rate}% (사진 붙은 요청 기준) → 업체 영업 · 업체 초대`);
  // USP 중 «안 쓴 쪽보다 나을 게 없는» 것(표본 5 이상) — 그 USP 를 손볼 차례
  const flat = (usp ?? []).filter((r) => r.who !== "라운지" && r.lift != null && (r.used ?? 0) >= 5 && (r.baseUsed ?? 0) >= 5 && r.lift <= 0);
  for (const r of flat) out.push(`USP ${r.id} «${r.label}» — 쓴 쪽 ${r.rate}% · 안 쓴 쪽 ${r.baseRate}% (차이 ${r.lift}%p) → 이 기능이 힘을 못 쓴다`);
  return out;
}

export function buildWeeklyMarkdown({ now = Date.now(), growth = null, pushReach = null, notify = [], uspData = null, days = 7 } = {}) {
  const usp = uspRows(uspData?.rows ?? uspData);
  const lines = [];
  lines.push(`# 주간 숫자 — ${kstDateLabel(now)}`, "");
  lines.push("> 관리자 화면에서 그대로 옮김(없는 숫자는 «—»). 고르는 건 대표 — 맨 아래 «고른 것».", "");

  lines.push("## 1. 성장 (7일)");
  lines.push(`- 새 가입 ${f(growth?.users_7d)} · 30일 ${f(growth?.users_30d)} · 전체 ${f(growth?.users_total)}`);
  lines.push(`- 방문자 ${f(growth?.visitors_7d)} · 오늘 ${f(growth?.visitors_today)} · 30일 ${f(growth?.visitors_30d)}`);
  lines.push(`- 견적 요청 ${f(growth?.requests_7d)} · 30일 ${f(growth?.requests_30d)}`);
  lines.push(`- 초대로 가입 ${f(growth?.referred_7d)} · 전체 ${f(growth?.referred_total)}`);
  lines.push(`- 새 업체 ${f(growth?.companies_7d)} · 전체 ${f(growth?.companies_total)}`, "");

  lines.push("## 2. 푸시");
  lines.push(`- ${pushReachLine(pushReach) ?? "—"}`, "");

  lines.push("## 3. 알림 읽음률 (보낸 10건 이상)");
  const nr = notifyRows(notify).filter((r) => r.sent >= 10).sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));
  if (!nr.length) lines.push("- —");
  for (const r of nr) lines.push(`- ${r.label}: 읽음 ${r.rate == null ? "—" : `${r.rate}%`} (보냄 ${f(r.sent)} · 읽음 ${f(r.read)})`);
  lines.push("");

  lines.push(`## 4. USP 사용 → 전환 (${days}일)`);
  for (const r of usp) {
    const base = r.baseLabel ? ` · 비교(${r.baseLabel}) ${r.baseRate == null ? "—" : `${r.baseRate}%`}${r.lift != null ? ` (${r.lift > 0 ? "+" : ""}${r.lift}%p)` : ""}` : "";
    lines.push(`- ${r.id} ${r.label}: ${r.usedLabel} ${f(r.used)} → ${r.convLabel} ${f(r.converted)} (${r.rate == null ? "—" : `${r.rate}%`})${base}`);
  }
  lines.push("");

  lines.push("## 5. 약한 숫자 후보 → 이번 주 하나");
  const cand = weakCandidates({ growth, pushReach, notify, usp });
  if (!cand.length) lines.push("- (규칙에 걸린 숫자 없음 — 표본이 적으면 다음 주에 다시)");
  for (const c of cand) lines.push(`- ${c}`);
  lines.push("", "**고른 것:** ____", "", "**다음 주 확인할 숫자:** ____", "");
  return lines.join("\n");
}
