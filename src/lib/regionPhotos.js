// 홈 «📸 우리 동네 최근 완공»(177) → 화면 모양. 2장 미만이면 null(카드 안 보임).
export function donePhotosView(data) {
  const items = (Array.isArray(data?.items) ? data.items : []).filter((x) => /^https?:\/\//.test(String(x?.photo ?? "")));
  if (!data?.ok || items.length < 2) return null;
  return {
    title: `📸 ${String(data.label ?? "우리 동네").trim() || "우리 동네"} 최근 완공`,
    items: items.slice(0, 6).map((x) => ({
      id: x.id, photo: x.photo,
      caption: [x.space, x.company].filter(Boolean).join(" · ").slice(0, 18),
      href: x.slug || x.company_id ? `/p/${encodeURIComponent(x.slug || x.company_id)}` : null,
    })),
  };
}
