// ─────────────────────────────────────────────────────
// 라운지 대화 신청/수신 진단 로거 — 기본 무출력(프로덕션 콘솔 청결 유지).
//
//   목적: "신청은 보냈는데 받은 목록에 안 뜬다" 류 신원/조회 불일치를
//        실제 런타임 값으로 추적하기 위한 일시 진단 도구.
//
//   켜기 : 브라우저 콘솔에서  localStorage.setItem('GONGGAN_LOUNGE_DEBUG','1')  후 새로고침
//   끄기 : localStorage.removeItem('GONGGAN_LOUNGE_DEBUG')
//
//   ⚠️ 순수 진단 출력만 한다. 앱 동작/로직/State/DB/RPC/RLS 변경 없음(Add Only).
//      플래그가 없으면 어떤 출력도 하지 않으므로 일반 사용자에게는 영향이 없다.
// ─────────────────────────────────────────────────────

export const isLoungeChatDebugOn = () => {
  try {
    return typeof window !== "undefined" &&
      window.localStorage?.getItem("GONGGAN_LOUNGE_DEBUG") === "1";
  } catch { return false; }
};

export const loungeChatDbg = (tag, payload) => {
  if (!isLoungeChatDebugOn()) return;
  try {
    // 신원/조회 비교가 핵심이라 시각과 함께 한 줄로 묶어 출력한다.
    console.log(`[LOUNGE_CHAT_DBG] ${tag} @ ${new Date().toISOString()}`, payload ?? {});
  } catch {}
};
