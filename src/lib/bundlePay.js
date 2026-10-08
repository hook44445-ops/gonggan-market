// 공정 묶음 분할 결제(10-07 대표 결정) — 화면과 분리한 순수 로직. 서버(SQL 205 bundle_split)와 같은 규칙.
//
// 왜: 토스페이먼츠는 «1회 판매 금액 1천만 원 초과»면 입점 불가. 그래서 최종 견적서를 «공정 묶음»(판매 단위)으로
//     나눠 묶음마다 1천만 원 «미만»으로 받는다. 한 공정이 1천만 원 이상이면 «목공 1차·2차»처럼 차수로 나눈다.
//   · 묶음 하나는 여러 번에 나눠 낼 수 있다 — 결제 1회 = 주문번호 1개. 가상계좌면 결제마다 새 계좌번호.
//   · 묶음을 «모두» 채워야 계약 확정 → 공사 시작. 일부만이면 «결제 진행 중».
//   · 업체 지급은 묶음과 상관없이 «계약 전체 금액» 기준 단계(30/70 · 30/40/30 · 10/20/40/30)로 — 서버 112·120 그대로.
//   · 수수료(카드 약 3.5% · 가상계좌 건당 660원)는 우리 부담 — 수단별 추가 요금·표시 금지(여신전문금융업법 19조).
//
// 금액은 모두 «원»(정수). 최종 견적서는 «만원»으로 저장돼 있어 들어올 때 원으로 바꾼다.

export const BUNDLE_LIMIT_WON = 10_000_000;  // 묶음은 이 금액 «미만» — 토스 1회 판매 상한
export const BUNDLE_ROUND_WON = 9_000_000;   // 한 공정이 상한 이상이면 이 크기로 차수를 나눈다(2,500만 → 900/900/700)
export const PART_MIN_WON = 10_000;          // 한 번에 내는 최소 금액(마지막 남은 금액이 이보다 작으면 그 금액)
export const VA_DUE_DAYS = 7;                // 가상계좌 입금 기한(기본값 — 서버 ops_config.bundle_va_due_days 가 우선)
export const VA_REMIND_HOURS = 24;           // 기한 하루 전 알림
export const CARD_HOLD_MINUTES = 30;         // 카드 결제창을 열고 끝내지 않은 건이 남은 금액을 잡아 두는 시간

// 고객이 고르는 수단 — 가상계좌를 맨 위에(우리 비용이 훨씬 싸다 · 위에 두는 것은 괜찮다). 요금 차이는 쓰지 않는다.
export const BUNDLE_METHODS = [
  { id: "VIRTUAL_ACCOUNT", label: "가상계좌", tossMethod: "가상계좌", desc: "결제마다 새 계좌번호가 나와요" },
  { id: "CARD",            label: "신용·체크카드", tossMethod: "카드", desc: "카드 여러 장으로 나눠 내도 돼요" },
];

export const toWon = (manwon) => Math.round((Number(manwon) || 0) * 10_000);

// 받을 결제 수단(대표 10-08) — 첫 개통은 가상계좌만. «VIRTUAL_ACCOUNT,CARD,TRANSFER» 처럼 쉼표로.
//   모르는 값은 버리고, 비면 가상계좌만. 카드·계좌이체 코드는 지우지 않고 이 목록으로 숨긴다.
export const PAY_METHOD_IDS = ["VIRTUAL_ACCOUNT", "CARD", "TRANSFER"];
export function parsePayMethods(raw) {
  const list = String(raw ?? "").split(",").map((s) => s.trim().toUpperCase()).filter((s) => PAY_METHOD_IDS.includes(s));
  return list.length ? [...new Set(list)] : ["VIRTUAL_ACCOUNT"];
}

// 환불 기한 — 청약철회 시 3영업일 안에 환급(법률 검토 10-08). 접수일 다음 날부터 토·일을 빼고 센다.
//   공휴일은 빼지 않는다(달력이 없다) — 연휴 앞뒤엔 관리자가 더 일찍 처리한다.
export const REFUND_BUSINESS_DAYS = 3;
export function addBusinessDays(date, n = REFUND_BUSINESS_DAYS) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const w = d.getDay();
    if (w !== 0 && w !== 6) left--;
  }
  return d;
}

// 고객 결제 화면 한 줄(대표 10-08) — 묶음·한 번에 결제 둘 다. 카드·가상계좌 수수료는 고객 화면 어디에도 쓰지 않는다.
export const NO_EXTRA_CHARGE = "어떤 수단으로 내셔도 추가 요금은 없습니다";

// 최종 견적서 → 공정 줄([{ name, won }]). 같은 공정 이름은 한 줄로 합친다(공정 = 판매 단위라 쪼개지지 않게).
//   견적 합계와 줄 합계가 다르면: 합계가 더 크면 «기타» 줄로 맞추고, 더 작으면(할인 등) 공정을 믿지 않고 «공사 전체» 한 줄.
export function quoteLines(estimate, fallbackTotalManwon = null) {
  const items = Array.isArray(estimate?.items) ? estimate.items : [];
  const map = new Map();
  for (const it of items) {
    const name = String(it?.name ?? "").trim() || "공정";
    const won = Math.round((Number(it?.qty) || 0) * (Number(it?.unit_price ?? it?.unitPrice) || 0) * 10_000);
    if (won <= 0) continue;
    map.set(name, (map.get(name) ?? 0) + won);
  }
  const lines = [...map].map(([name, won]) => ({ name, won }));
  const sum = lines.reduce((s, l) => s + l.won, 0);
  const totalWon = toWon(estimate?.total_price ?? fallbackTotalManwon ?? 0) || sum;
  if (!lines.length || totalWon < sum) return totalWon > 0 ? [{ name: "공사 전체", won: totalWon }] : [];
  if (totalWon > sum) lines.push({ name: "기타", won: totalWon - sum });
  return lines;
}

const bundleLabel = (lines) => {
  const names = lines.map((l) => l.round ? `${l.name} ${l.round}차` : l.name);
  return names.length <= 3 ? names.join("·") : `${names.slice(0, 2).join("·")} 외 ${names.length - 2}개`;
};

// 공정 줄 → 묶음. 견적서 순서를 지킨다.
//   · 상한 이상인 공정: 앞 묶음을 닫고, 차수(round 크기)로 나눠 차수마다 묶음 하나.
//   · 나머지 공정: 앞 묶음에 더해도 상한 «미만»이면 더하고, 아니면 새 묶음.
export function splitIntoBundles(lines, { limit = BUNDLE_LIMIT_WON, round = BUNDLE_ROUND_WON } = {}) {
  if (!(round > 0 && round < limit)) throw new Error("round must be > 0 and < limit");
  const out = [];
  let cur = null;
  const close = () => { if (cur) { out.push(cur); cur = null; } };
  for (const raw of lines ?? []) {
    const won = Math.round(Number(raw?.won) || 0);
    if (won <= 0) continue;
    const name = String(raw?.name ?? "공정");
    if (won >= limit) {
      close();
      const n = Math.ceil(won / round);
      for (let i = 0; i < n; i++) {
        const part = i < n - 1 ? round : won - round * (n - 1);
        out.push({ lines: [{ name, won: part, round: i + 1, rounds: n }], amountWon: part });
      }
      continue;
    }
    if (cur && cur.amountWon + won < limit) {
      cur.lines.push({ name, won });
      cur.amountWon += won;
    } else {
      close();
      cur = { lines: [{ name, won }], amountWon: won };
    }
  }
  close();
  return out.map((b, i) => ({ seq: i + 1, label: bundleLabel(b.lines), ...b }));
}

// 결제 한 건이 «남은 금액을 잡고 있는가» — 완료는 «낸 금액», 입금 대기(기한 안)·카드 진행 중(잠깐)은 «잡힌 금액».
export function partState(part, now = Date.now()) {
  const t = (v) => (v ? new Date(v).getTime() : NaN);
  const s = part?.status;
  if (s === "DONE") return "paid";
  if (s === "WAITING_FOR_DEPOSIT") return !(t(part.due_at) <= now) ? "pending" : "expired";
  if (s === "REQUESTED") return now - t(part.created_at) < CARD_HOLD_MINUTES * 60_000 ? "pending" : "expired";
  return "closed";   // EXPIRED · CANCELED · FAILED
}

// 묶음 하나의 진행 — 낸 금액 · 잡힌 금액 · 남은 금액(새로 낼 수 있는 금액).
export function bundleProgress(bundle, parts = [], now = Date.now()) {
  let paidWon = 0, pendingWon = 0;
  for (const p of parts) {
    const st = partState(p, now);
    if (st === "paid") paidWon += Number(p.amount_won) || 0;
    else if (st === "pending") pendingWon += Number(p.amount_won) || 0;
  }
  const amountWon = Number(bundle?.amountWon ?? bundle?.amount_won) || 0;
  const remainingWon = Math.max(0, amountWon - paidWon - pendingWon);
  const status = paidWon >= amountWon && amountWon > 0 ? "PAID" : pendingWon > 0 ? "PENDING" : paidWon > 0 ? "PARTIAL" : "OPEN";
  return { amountWon, paidWon, pendingWon, remainingWon, status };
}

// 이번에 낼 금액이 괜찮은가 — 문제가 있으면 이유(코드), 없으면 null. 서버(bundle_part_start)가 같은 검사를 한 번 더 한다.
export function checkPartAmount(progress, amountWon) {
  const a = Number(amountWon);
  if (!Number.isInteger(a) || a <= 0) return "BAD_AMOUNT";
  if (progress.remainingWon <= 0) return progress.pendingWon > 0 ? "WAITING_DEPOSIT" : "BUNDLE_PAID";
  if (a > progress.remainingWon) return "OVER_REMAINING";
  if (a < Math.min(PART_MIN_WON, progress.remainingWon)) return "UNDER_MIN";
  return null;
}

// 계약 전체 — 모든 묶음이 다 채워졌을 때만 계약 확정(일부만이면 «결제 진행 중», 착공 안 열림).
//   partsByBundle: { [묶음 id(없으면 seq)]: 결제 건 목록 }
export function planSummary(bundles = [], partsByBundle = {}, now = Date.now()) {
  const rows = bundles.map((b) => ({ ...b, progress: bundleProgress(b, partsByBundle[b.id ?? b.seq] ?? b.parts ?? [], now) }));
  const totalWon = rows.reduce((s, r) => s + r.progress.amountWon, 0);
  const paidWon = rows.reduce((s, r) => s + Math.min(r.progress.paidWon, r.progress.amountWon), 0);
  const paidCount = rows.filter((r) => r.progress.status === "PAID").length;
  const contractReady = rows.length > 0 && paidCount === rows.length;
  return { rows, count: rows.length, paidCount, totalWon, paidWon, leftWon: totalWon - paidWon, contractReady };
}

export const contractReady = (bundles, partsByBundle, now) => planSummary(bundles, partsByBundle, now).contractReady;

// 「700만 원」 · 「734만 5,000원」 · 「8,000원」
export function fmtWon(won) {
  const n = Math.round(Number(won) || 0);
  const man = Math.floor(n / 10_000), rest = n % 10_000;
  if (!man) return `${rest.toLocaleString("ko-KR")}원`;
  return rest ? `${man.toLocaleString("ko-KR")}만 ${rest.toLocaleString("ko-KR")}원` : `${man.toLocaleString("ko-KR")}만 원`;
}

// 크게 보이는 한 줄 — «3개 중 2개 결제 완료 · 남은 금액 700만 원»
export function headline(summary) {
  if (!summary?.count) return "";
  if (summary.contractReady) return `${summary.count}개 묶음 모두 결제 완료 · 계약이 확정됐어요`;
  return `${summary.count}개 중 ${summary.paidCount}개 결제 완료 · 남은 금액 ${fmtWon(summary.leftWon)}`;
}

export const PART_ERRORS = {
  BAD_AMOUNT: "낼 금액을 원 단위로 적어 주세요.",
  OVER_REMAINING: "이 묶음의 남은 금액보다 많아요.",
  UNDER_MIN: `한 번에 ${fmtWon(PART_MIN_WON)} 이상 내 주세요.`,
  BUNDLE_PAID: "이 묶음은 이미 다 냈어요.",
  WAITING_DEPOSIT: "입금을 기다리는 금액이 남은 금액을 다 채우고 있어요. 입금 기한이 지나면 다시 나눠 낼 수 있어요.",
  NOT_OPEN: "결제가 열리면 이렇게 나눠 낼 수 있어요.",
  NOT_OWNER: "내 요청의 공사만 결제할 수 있어요.",
  NOT_QUOTE_PHASE: "최종 견적서를 받은 뒤에 결제할 수 있어요.",
  ALREADY_CONTRACTED: "이미 계약된 공사예요. 공사 화면에서 진행 상황을 확인해 주세요.",
  BIZ_REQUIRED: "업체의 사업자 확인이 끝나면 결제할 수 있어요.",
  PAYMENTS_PAUSED: "지금은 새 결제를 잠시 멈췄어요. 잠시 후 다시 시도해 주세요.",
  LOGIN_REQUIRED: "로그인이 풀렸어요. 다시 로그인한 뒤 결제해 주세요.",
  REFUND_REQUESTED: "환불을 요청해 두셨어요. 관리자가 처리한 뒤 다시 결제할 수 있어요.",
  NOTHING_PAID: "아직 낸 금액이 없어 환불할 게 없어요.",
  NOT_STALLED: "입금 기한이 지난 계좌가 있을 때만 환불을 요청할 수 있어요.",
  PENDING_DEPOSIT: "아직 입금을 기다리는 계좌가 있어요. 기한이 지난 뒤 다시 골라 주세요.",
  METHOD_OFF: "지금은 이 결제 수단을 받지 않아요. 가상계좌로 내 주세요.",
};
