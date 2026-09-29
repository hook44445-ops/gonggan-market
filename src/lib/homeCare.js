// 내 집 관리 수첩(165) — 한 날짜 + 주기 → 다음 시기. 화면·테스트가 같이 쓰는 계산만(DB·React 없음).
//   주기는 흔히 권하는 값(집·자재마다 다르다 — 사용자가 고칠 수 있다). 수치 약속이 아니라 «살펴볼 때»로 말한다.

export const HOME_CARE_PRESETS = [
  { kind: "bath_silicone",   label: "욕실 실리콘",       cycle: 24 },
  { kind: "grout",           label: "욕실 줄눈",         cycle: 36 },
  { kind: "window_silicone", label: "창틀 실리콘",       cycle: 36 },
  { kind: "boiler",          label: "보일러 점검",       cycle: 12 },
  { kind: "aircon",          label: "에어컨 청소",       cycle: 12 },
  { kind: "fan",             label: "욕실 환풍기 청소",  cycle: 6 },
  { kind: "faucet",          label: "수전 점검",         cycle: 60 },
  { kind: "screen",          label: "방충망",            cycle: 60 },
  { kind: "wallpaper",       label: "도배",              cycle: 84 },
  { kind: "floor",           label: "바닥(장판·마루)",   cycle: 120 },
];

const DAY = 86400000;
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s ?? ""));

// 다음 시기(YYYY-MM-DD) — 월 단위로 더한다(1/31 + 1개월 = 2/28 처럼 달 끝에 맞춘다)
export function nextDue(doneOn, cycleMonths) {
  if (!isDate(doneOn)) return null;
  const [y, m, d] = doneOn.split("-").map(Number);
  const total = (m - 1) + Number(cycleMonths || 0);
  const ny = y + Math.floor(total / 12), nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

// 상태 — due(시기 됨) · soon(60일 안) · ok · 남은 날
export function careStatus(item, today) {
  const due = nextDue(item?.done_on, item?.cycle_months);
  if (!due || !isDate(today)) return { state: "ok", days: null, due };
  const days = Math.round((Date.parse(due) - Date.parse(today)) / DAY);
  return { state: days <= 0 ? "due" : days <= 60 ? "soon" : "ok", days, due };
}

export function careLine(st) {
  if (!st?.due) return "";
  if (st.state === "due") return "살펴볼 시기가 됐어요";
  if (st.days < 31) return `${st.days}일 뒤 살펴볼 시기`;
  const months = Math.round(st.days / 30);
  return months >= 12 ? `약 ${Math.floor(months / 12)}년${months % 12 ? ` ${months % 12}개월` : ""} 뒤` : `약 ${months}개월 뒤`;
}

// 시기 된 것 → 곧 → 나머지, 같으면 남은 날 짧은 순
export function sortCare(items, today) {
  const rank = { due: 0, soon: 1, ok: 2 };
  return [...(items ?? [])].map((it) => ({ it, st: careStatus(it, today) }))
    .sort((a, b) => rank[a.st.state] - rank[b.st.state] || (a.st.days ?? 1e9) - (b.st.days ?? 1e9))
    .map(({ it }) => it);
}

// 폼 → 저장할 행(에러는 한국어)
export function buildCareRow(form = {}) {
  const label = String(form.label ?? "").trim();
  if (!label) return { error: "무엇을 했는지 적어 주세요" };
  if (label.length > 30) return { error: "이름은 30자까지예요" };
  const cycle = Math.round(Number(form.cycle_months));
  if (!(cycle >= 1 && cycle <= 240)) return { error: "주기는 1~240개월로 적어 주세요" };
  if (!isDate(form.done_on)) return { error: "한 날짜를 골라 주세요" };
  const memo = String(form.memo ?? "").trim();
  if (memo.length > 200) return { error: "메모는 200자까지예요" };
  return { row: { kind: form.kind ?? null, label, cycle_months: cycle, done_on: form.done_on, memo: memo || null } };
}

// 공사 글(후기·요청 설명·업체 공종)에서 수첩 기본 항목 고르기 — 최대 3개 · 없으면 빈 배열(카드를 안 보인다)
const SUGGEST_RULES = [
  ["bath_silicone",   ["실리콘", "욕실", "화장실", "욕조", "세면대"]],
  ["grout",           ["줄눈", "타일"]],
  ["window_silicone", ["창틀", "샷시", "새시", "창호", "창문"]],
  ["boiler",          ["보일러", "난방"]],
  ["aircon",          ["에어컨"]],
  ["faucet",          ["수전", "수도꼭지", "싱크"]],
  ["screen",          ["방충망"]],
  ["wallpaper",       ["도배", "벽지"]],
  ["floor",           ["장판", "마루", "바닥"]],
];
export function suggestCarePresets(text) {
  const hay = String(text ?? "");
  const out = [];
  for (const [kind, words] of SUGGEST_RULES) {
    if (words.some((w) => hay.includes(w))) out.push(HOME_CARE_PRESETS.find((p) => p.kind === kind));
    if (out.length >= 3) break;
  }
  return out.filter(Boolean);
}

// 하자보수 기간(견적서 «하자보수 조건» 글) → 개월. 「1년」「2년」「6개월」「무상 1년 · 방수 2년」 → 가장 긴 것. 없으면 null
export function warrantyMonths(text) {
  const s = String(text ?? "");
  let best = 0;
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*(년|개월|달)/g)) {
    const n = Number(m[1]);
    const months = m[2] === "년" ? Math.round(n * 12) : Math.round(n);
    if (months > best) best = months;
  }
  return best >= 1 && best <= 120 ? best : null;
}

// 하자보수 끝나기 한 달 전에 «살펴볼 시기» 가 되게 — 수첩 한 줄(buildCareRow 모양). 기간이 없으면 null
export function warrantyCareItem({ warrantyNote, companyName, doneOn } = {}) {
  const months = warrantyMonths(warrantyNote);
  if (!months || !isDate(doneOn)) return null;
  const until = nextDue(doneOn, months);
  const who = String(companyName ?? "").trim() || "업체";
  return {
    kind: "warranty",
    label: "하자보수 끝나기 전 점검",
    cycle_months: Math.max(1, months - 1),
    done_on: doneOn,
    memo: `${who} 하자보수 ${months % 12 === 0 ? `${months / 12}년` : `${months}개월`} · ${until}까지 — 끝나기 전에 집을 둘러보고 업체에 말해 두세요`.slice(0, 200),
    months, until,
  };
}
