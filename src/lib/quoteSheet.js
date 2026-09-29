// 간단 견적서(대표 09-29 · 1인 사업자) — 지인·전화 공사 견적을 깔끔한 이미지 한 장으로.
//   이미지 아래에 공간마켓 업체 페이지 QR(+초대 코드)을 넣어, 받은 사람이 사례·후기를 보고 앱으로 들어오게 한다.
//   세금계산서·계약서가 아니다 — «현장 확인 뒤 달라질 수 있어요» 문구를 항상 넣는다.

export const QUOTE_MAX_ITEMS = 8;
export const QUOTE_NOTICE = "현장 확인 뒤 금액이 달라질 수 있어요 · 이 견적서는 계약서·세금계산서가 아니에요";

const toWon = (v) => {
  const n = Math.round(Number(String(v ?? "").replace(/[^\d]/g, "")));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const formatWon = (n) => `${(Number(n) || 0).toLocaleString("ko-KR")}원`;

// 폼 → 견적. 문제가 있으면 { error }(화면에 그대로 보여 줄 한국어)
export function buildQuote(form = {}) {
  const title = String(form.title ?? "").trim();
  if (!title) return { error: "공사 이름을 적어 주세요" };
  if (title.length > 40) return { error: "공사 이름은 40자까지예요" };
  const items = (Array.isArray(form.items) ? form.items : [])
    .map((it) => ({ name: String(it?.name ?? "").trim().slice(0, 30), amount: toWon(it?.amount) }))
    .filter((it) => it.name || it.amount);
  if (!items.length) return { error: "항목을 하나 이상 적어 주세요" };
  if (items.length > QUOTE_MAX_ITEMS) return { error: `항목은 ${QUOTE_MAX_ITEMS}개까지예요` };
  if (items.some((it) => !it.name)) return { error: "금액만 있고 이름이 없는 항목이 있어요" };
  const total = items.reduce((s, it) => s + it.amount, 0);
  if (total <= 0) return { error: "금액을 적어 주세요" };
  const vat = form.vat === "separate" ? "separate" : "included";
  return {
    quote: {
      title,
      customer: String(form.customer ?? "").trim().slice(0, 20) || null,
      period: String(form.period ?? "").trim().slice(0, 30) || null,
      memo: String(form.memo ?? "").trim().slice(0, 120) || null,
      items,
      total,
      vat,
      vatLine: vat === "separate" ? "부가세 별도" : "부가세 포함",
    },
  };
}

// 이미지 파일 이름 — 「견적서-욕실 실리콘 교체-2026-10-02.png」(파일에 못 쓰는 글자는 뺀다)
export function quoteFileName(title, day) {
  const safe = String(title ?? "견적").replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 30) || "견적";
  return `견적서-${safe}-${day}.png`;
}

// 견적서 → 작업 장부 한 줄(146 company_job_ledger). 견적은 아직 받은 돈이 아니라 «받은 금액»은 0 으로 두고,
//   견적 금액은 메모에 남긴다 — 공사 뒤 장부에서 받은 금액을 고쳐 적는다(월 순이익이 미리 부풀지 않게).
export function quoteToLedgerForm(quote, day) {
  if (!quote) return null;
  const who = quote.customer ? ` · ${quote.customer} 님` : "";
  return {
    title: quote.title,
    work_date: day,
    source: "acquaintance",
    hours: "",
    material_cost: "",
    revenue: "",
    memo: `견적 ${formatWon(quote.total)}(${quote.vatLine})${who} — 공사 뒤 받은 금액을 적어 주세요`.slice(0, 500),
  };
}
