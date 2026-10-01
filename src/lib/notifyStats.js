// 관리자 «알림별 읽음률»(175) — 종류 코드 → 사람이 읽는 이름 · 읽음률(%)
export const NOTIFY_LABELS = {
  HOME_CARE_DUE: "🏠 집 관리 시기",
  REGION_REQUESTS_WEEKLY: "📍 업체 주간 동네 요청",
  BID_COMPARE_NUDGE: "⚖️ 견적 비교해 보셨나요",
  BID_VIEWED: "👀 고객이 견적 확인",
  BID_NOT_SELECTED: "📮 다른 업체 선택됨(업체)",
  LOUNGE_WEEKLY: "🔥 라운지 주간 인기 글",
  SAVED_COMPANY_NEW: "💚 찜한 업체 새 사례",
  REVIEW_5STAR: "⭐ 별 5개 후기(업체)",
  PAGE_VIEWS_WEEKLY: "📈 업체 페이지 방문 주간",
  CHECKIN_REMINDER: "✅ 출석 이어가기",
  REQUEST_NUDGE: "⏰ 견적이 아직 없어요",
  REQUEST_FIRST_BID: "🥇 첫 견적 기회(업체)",
  NEW_REQUEST: "📝 새 견적 요청(업체)",
  NEW_REQUEST_LOCKED: "🔒 한도 밖 요청(업체)",
  BID_RECEIVED: "📋 견적 도착",
  REFERRAL_JOINED: "🤝 초대 가입",
  REFERRAL_RANK: "🏆 초대왕 순위",
};

export function notifyRows(list = []) {
  return (Array.isArray(list) ? list : []).map((r) => {
    const sent = Number(r?.sent) || 0, read = Number(r?.read) || 0;
    return {
      type: r?.type ?? "",
      label: NOTIFY_LABELS[r?.type] ?? r?.type ?? "",
      sent, read, users: Number(r?.users) || 0,
      rate: sent > 0 ? Math.round((read / sent) * 100) : null,
    };
  });
}

// 푸시 받는 사람(178) — «전체 N명 중 M명(%) 폰으로 받아요 · 안드로이드 a · 광고 동의 c · 최근 7일 새로 켠 기기 d»
export function pushReachLine(r) {
  if (!r || !(Number(r.users) >= 0)) return null;
  const users = Number(r.users) || 0, reach = Number(r.reach) || 0;
  const pct = users > 0 ? Math.round((reach / users) * 100) : 0;
  return `회원 ${users.toLocaleString("ko-KR")}명 중 ${reach.toLocaleString("ko-KR")}명(${pct}%)이 폰으로 받아요 · 안드로이드 ${Number(r.android) || 0} · 광고 동의 ${Number(r.marketing) || 0} · 최근 7일 새로 켠 사람 ${Number(r.new_7d) || 0}`;
}
