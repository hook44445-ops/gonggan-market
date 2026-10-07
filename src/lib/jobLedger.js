// 업체 작업 장부 — 공사(지인 공사 포함)마다 시간·자재비·받은 금액을 적고 월별 순이익을 본다(대표 09-28).
// 저장은 company_job_ledger(146 · 본인 행만). 여기는 화면과 테스트가 같이 쓰는 계산만 둔다(DB·React 없음).
//
// 금액은 원 단위 정수. 시간은 0.5 단위까지.
// 1,500만원 — 건설산업기본법 «경미한 건설공사»로 알려진 상한. 면허 없이 받는 공사가 이 금액에 닿으면 장부가 알려 준다.
//   (법무 확인 전 값 — docs/BUSINESS_PLAN_PSST.md 와 같은 기준)

export const MINOR_WORK_LIMIT_WON = 15_000_000;

export const LEDGER_SOURCES = [
  { key: "gonggan",      label: "공간랜드" },
  { key: "acquaintance", label: "지인" },
  { key: "other",        label: "기타" },
];
export const sourceLabel = (key) => LEDGER_SOURCES.find(s => s.key === key)?.label ?? "기타";

const toWon = (v) => {
  const n = Math.round(Number(String(v ?? "").replace(/[^\d.]/g, "")));
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const toHours = (v) => {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 2) / 2 : 0;
};
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ""));

// 입력 폼 값 → 저장할 행. 문제가 있으면 { error } — 화면에 그대로 보여 줄 한국어.
export function buildLedgerRow(form = {}) {
  const title = String(form.title ?? "").trim();
  if (!title) return { error: "작업 이름을 적어 주세요" };
  if (title.length > 80) return { error: "작업 이름은 80자까지예요" };
  const workDate = isDate(form.work_date) ? form.work_date : null;
  if (!workDate) return { error: "날짜를 골라 주세요" };
  const memo = String(form.memo ?? "").trim();
  if (memo.length > 500) return { error: "메모는 500자까지예요" };
  const hours = toHours(form.hours);
  if (hours > 999) return { error: "시간이 너무 커요" };
  return {
    row: {
      work_date: workDate,
      title,
      source: LEDGER_SOURCES.some(s => s.key === form.source) ? form.source : "gonggan",
      hours,
      material_cost: toWon(form.material_cost),
      revenue: toWon(form.revenue),
      memo: memo || null,
    },
  };
}

export const profitOf = (e) => (Number(e?.revenue) || 0) - (Number(e?.material_cost) || 0);

// 한 건이 «면허 없이 받는 공사» 상한에 닿았나(받은 금액 기준 — 자재비 포함 총액)
export const overMinorLimit = (e) => (Number(e?.revenue) || 0) >= MINOR_WORK_LIMIT_WON;

// 월별 합계 — 최근 달이 먼저. 시간당 순이익은 시간을 적은 건만으로 계산한다(안 적은 건이 평균을 부풀리지 않게).
export function summarizeByMonth(entries = []) {
  const byMonth = new Map();
  for (const e of entries) {
    if (!isDate(e?.work_date)) continue;
    const month = e.work_date.slice(0, 7);
    const m = byMonth.get(month) ?? { month, count: 0, revenue: 0, material: 0, profit: 0, hours: 0, timedProfit: 0 };
    const hours = Number(e.hours) || 0;
    m.count += 1;
    m.revenue += Number(e.revenue) || 0;
    m.material += Number(e.material_cost) || 0;
    m.profit += profitOf(e);
    if (hours > 0) { m.hours += hours; m.timedProfit += profitOf(e); }
    byMonth.set(month, m);
  }
  return [...byMonth.values()]
    .sort((a, b) => (a.month < b.month ? 1 : -1))
    .map(({ timedProfit, ...m }) => ({ ...m, profitPerHour: m.hours > 0 ? Math.round(timedProfit / m.hours) : null }));
}

export const won = (n) => `${(Number(n) || 0).toLocaleString("ko-KR")}원`;
export const monthLabel = (ym) => {
  const [y, m] = String(ym).split("-");
  return `${y}년 ${Number(m)}월`;
};
