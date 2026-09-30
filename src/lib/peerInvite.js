// 업체 «동료 초대» 순위(183) — 화면 문구 계산. 순위·숫자는 서버(peer_invite_board)가 정한다.
//   보상은 없다(대표 결정 전) — 상·토큰·혜택을 약속하는 말을 쓰지 않는다.

// 한국 시간 «9월» — 서버가 준 이번 달 시작 시각(since)으로
export function peerMonthLabel(since, now = Date.now()) {
  const t = Date.parse(since ?? "");
  const base = Number.isFinite(t) ? t : now;
  return `${new Date(base + 9 * 3600000).getUTCMonth() + 1}월`;
}

// 순위판을 보일까 — 183 전(함수 없음)·실패면 숨긴다
export const hasPeerBoard = (data) => !!data?.ok && Array.isArray(data.top);

// 내 줄 — «9월 2곳 · 1등» / «9월 아직 없어요»
export function peerMeLine(data, now = Date.now()) {
  const month = peerMonthLabel(data?.since, now);
  const me = data?.me ?? {};
  const n = Number(me.count) || 0;
  if (!n || !me.rank) return `${month} 아직 없어요`;
  return `${month} ${n}곳 · ${me.rank}등`;
}

// 아래 작은 줄 — 누적 · 업체 등록 전(가입만 한 사람)
export function peerMeSub(data) {
  const me = data?.me ?? {};
  const total = Number(me.total) || 0, waiting = Number(me.waiting) || 0;
  const parts = [];
  if (total) parts.push(`지금까지 ${total}곳`);
  if (waiting) parts.push(`가입만 하고 업체 등록 전 ${waiting}명`);
  return parts.join(" · ");
}
