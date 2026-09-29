// 우리 동네 이번 주 공사 소식(163 region_pulse) — 화면 문구만. 숫자가 없으면 null(카드를 안 보인다 — 빈 동네로 보이지 않게).
export function pulseView(data, { isCompany = false } = {}) {
  if (!data?.ok) return null;
  const req = Number(data.requests) || 0;
  if (req < 1) return null;
  const bids = Number(data.bids) || 0;
  const label = String(data.label ?? "").trim() || "우리 동네";
  const top = (Array.isArray(data.top) ? data.top : []).filter(Boolean).slice(0, 3);
  return {
    title: `📍 ${label} 이번 주`,
    stats: [`새 견적 요청 ${req}건`, `들어온 견적 ${bids}건`],
    topLine: top.length ? `많이 찾은 공사 · ${top.join(" · ")}` : null,
    cta: isCompany ? "새 요청 보러 가기" : "나도 견적 받아 보기",
  };
}
