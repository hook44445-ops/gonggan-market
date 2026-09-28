// 업체 페이지(/p/…)에서 «견적 받기»를 누른 고객 — 그 업체를 기억해 두었다가, 요청을 올리면 그 업체에 먼저 알린다.
//   명함 QR·지인 추천 링크로 온 손님이 일반 요청 속에 묻히지 않게(대표 09-29 · 1인 사업자).
//   입찰·계약 규칙은 그대로다 — 다른 업체도 똑같이 견적을 낼 수 있고, 이 업체에만 «먼저 알림»이 간다.
const KEY = "gonggan_pref_company";
const KEEP_MS = 3 * 24 * 60 * 60 * 1000;

export function rememberPreferredCompany(co, now = Date.now()) {
  if (!co?.id) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ id: co.id, name: co.name ?? null, ownerId: co.ownerId ?? null, at: now, opened: false }));
  } catch { /* noop */ }
}

export function peekPreferredCompany(now = Date.now()) {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!v?.id || !(now - Number(v.at) < KEEP_MS)) return null;
    return v;
  } catch { return null; }
}

// 요청서를 한 번 열었다고 표시 — 앱을 다시 켤 때마다 요청서가 튀어나오지 않게
export function markPreferredOpened() {
  const v = peekPreferredCompany();
  if (!v) return;
  try { localStorage.setItem(KEY, JSON.stringify({ ...v, opened: true })); } catch { /* noop */ }
}

export function clearPreferredCompany() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

// 요청이 저장된 뒤 알릴 사람 — 업체 주인이 있고, 요청한 본인이 아닐 때만
export function preferredNotifyTarget(pref, userId) {
  if (!pref?.ownerId || !userId || pref.ownerId === userId) return null;
  return pref.ownerId;
}
