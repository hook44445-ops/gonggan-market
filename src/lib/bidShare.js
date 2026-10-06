// 견적 비교표 이미지(가족과 같이 고르기 · 다운로드) — 업체 이름·금액·기간·공간온도만. 주소·연락처·예산은 싣지 않는다.
//   아래 QR = 내 초대 링크(가입 선물). 계산·문구만(그리기는 components/BidShareCard).

export const SHARE_MAX_ROWS = 5;

export function bidShareRows(bids = []) {
  return (bids ?? [])
    .filter((b) => Number(b?.price) > 0)
    .sort((a, b) => Number(a.price) - Number(b.price))
    .slice(0, SHARE_MAX_ROWS)
    .map((b, i, arr) => ({
      name: String(b.company?.name ?? "업체").trim().slice(0, 12) || "업체",
      price: `${Math.round(Number(b.price)).toLocaleString("ko-KR")}만원`,
      period: Number(b.period) > 0 ? `${Number(b.period)}일` : "—",
      temp: Number(b.company?.temp) > 0 ? `${Number(b.company.temp).toFixed(1)}°` : "—",
      cheapest: i === 0 && arr.length > 1,
    }));
}

export function bidShareTitle(space) {
  const s = String(space ?? "").trim();
  return (s ? `우리 집 ${s} 견적 비교` : "우리 집 견적 비교").slice(0, 22);
}

export function bidShareText(code, inviteUrl) {
  return `견적이 왔어요! 어디가 나을지 같이 봐 줘요 🙏${code ? `\n공간랜드 — 이 링크로 가입하면 공간토큰 선물: ${inviteUrl}` : ""}`;
}

// 견적 3개 이상 온 순간 — 그 요청에서 한 번 보내기 전까지만 크게 보여 준다(보낸 뒤엔 원래 버튼)
const MOMENT_MIN = 3;
export const momentKey = (requestId) => `gg_bidshare_sent_${requestId}`;
export function showMoment(count, requestId, store) {
  if (count < MOMENT_MIN || !requestId) return false;
  try { return !store?.getItem(momentKey(requestId)); } catch { return true; }
}
