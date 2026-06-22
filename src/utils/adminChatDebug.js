// ─────────────────────────────────────────────────────
// 관리자 증빙관리 채팅 조회 진단 — 기본 무출력(프로덕션 콘솔 청결).
//
//   목적: "채팅이 있는데 관리자 증빙관리에서 0건/빈 상세로 보이는" 류의
//        room_id 조회 누락을 실제 값으로 추적하기 위한 상시 진단 도구.
//
//   켜기 : 브라우저 콘솔에서  localStorage.setItem('GONGGAN_EVIDENCE_DEBUG','1')  후 새로고침
//   끄기 : localStorage.removeItem('GONGGAN_EVIDENCE_DEBUG')
//
//   ⚠️ 순수 진단 출력만 — 앱 동작/조회/DB/RPC/RLS 변경 없음. 플래그가 없으면 무출력.
// ─────────────────────────────────────────────────────

export const evidenceChatDbg = (tag, payload) => {
  try {
    if (typeof window !== "undefined" &&
        window.localStorage?.getItem("GONGGAN_EVIDENCE_DEBUG") === "1") {
      console.log(`[EVIDENCE_CHAT_DBG] ${tag}`, payload ?? {});
    }
  } catch {}
};
