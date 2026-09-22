// 운영 목록에 남아 있는 테스트용 업체 — 의뢰인 화면·비로그인 첫 화면에는 보이지 않게 한다.
//   이름에 「테스트」 또는 단어 test 가 들어간 업체. (운영 DB 정리는 따로 · 인계 3-10)
export const isTestCompany = (c) => /테스트|(^|[^a-z])test([^a-z]|$)/i.test(String(c?.name ?? ""));
export const isTestCompanyName = (name) => isTestCompany({ name });
