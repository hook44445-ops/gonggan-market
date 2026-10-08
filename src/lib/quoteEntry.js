// 첫 화면 «무료 비교견적 받기» 단추가 어디로 가나(10-05 트래픽→전환 총점검 · 지시서 gonggan-repo-quote-before-auth 일감 1).
//
// 왜: 맨 위 단추를 누르면 내용을 쓰기도 전에 «전화번호 인증»이 떴다 — 처음 온 사람이 가장 많이 떠나는 자리.
//     원칙 «들어오긴 쉽게, 안은 단단하게»: 쓰는 건 바로, 업체에 보내는 순간만 인증.
// 어떻게: 처음 온 사람(이 기기 인증 없음) → 같은 화면 아래 «요청서 미리 골라 보기»(① 공간 ② 고칠 곳)로 내려간다.
//         이미 이 기기에서 인증한 사람(저장 계정 있음) → 지금처럼 계정 선택으로(다시 인증하지 않는다).
// 순수 JS — React·DOM 없음(node 테스트).

export const QUOTE_START_ID = "quote-start";

// "account" = 저장 계정으로 이어 가기(App.handleRoleSelect → AccountPicker) · "preview" = 아래 요청서로 내려가기
export function quoteCtaTarget({ hasSavedAccounts = false } = {}) {
  return hasSavedAccounts ? "account" : "preview";
}
