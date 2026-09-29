// 앱 심사용 로그인(대표 09-29 · App Store 가이드라인 2.1) — 해외 심사관은 한국 번호로 문자를 받을 수 없다.
//   서버 환경변수 APP_REVIEW_PHONE(+8210…) · APP_REVIEW_CODE(6자리) 가 둘 다 있을 때만 켜진다(VITE_ 아님 — 화면 코드에 안 실린다).
//   그 번호로 인증번호를 요청하면 문자를 보내지 않고 정해 둔 번호를 저장한다 — 검증은 평소와 같은 길(verify-otp).
//   심사가 끝나면 두 값을 지우면 꺼진다. 이 번호는 관리자·대표 번호가 아니어야 한다(일반 고객 계정).

export function reviewLoginCode(phone, { reviewPhone = "", reviewCode = "" } = {}) {
  const p = String(reviewPhone ?? "").trim();
  const c = String(reviewCode ?? "").trim();
  if (!/^\+8210\d{7,8}$/.test(p) || !/^\d{6}$/.test(c)) return null;
  if (/^(\d)\1{5}$/.test(c) || c === "123456") return null;   // 너무 쉬운 번호는 받지 않는다
  return String(phone ?? "").trim() === p ? c : null;
}
