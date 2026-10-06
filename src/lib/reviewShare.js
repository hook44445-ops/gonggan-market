// 후기 카드(업체 · 다운로드) — 받은 좋은 후기 한 줄 + 내 업체 페이지 QR 한 장(1080×1350).
//   공간랜드 안 후기(reviews)만 · 별 4개 이상 · 고객 이름은 첫 글자만(김○○). 계산·문구만(그리기는 components/ReviewShareCard).

export function maskName(name) {
  const n = String(name ?? "").trim();
  if (!n || n === "익명") return "고객";
  return `${[...n][0]}○○`;
}

// 고를 수 있는 후기 — 별 4개 이상 · 글 5자 이상 · 별 많은 순 → 최근 순 · 최대 10개
export function shareableReviews(rows = []) {
  return (rows ?? [])
    .filter((r) => Number(r?.rating) >= 4 && String(r?.content ?? "").trim().length >= 5)
    .sort((a, b) => Number(b.rating) - Number(a.rating) || String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      rating: Math.max(1, Math.min(5, Math.round(Number(r.rating)))),
      text: String(r.content).trim().replace(/\s+/g, " "),
      who: `${maskName(r.user_name)} 고객`,
      space: String(r.space_type ?? "").trim(),
      region: String(r.region ?? "").trim().split(/\s+/).slice(-1)[0] || "",
    }));
}

// 카드에 넣을 글 — 너무 길면 자르고 «…»(글자 수 기준 · 한 줄 줄바꿈은 그릴 때)
export function clampReview(text, max = 110) {
  const t = String(text ?? "").trim();
  return [...t].length > max ? `${[...t].slice(0, max - 1).join("")}…` : t;
}

export const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);
