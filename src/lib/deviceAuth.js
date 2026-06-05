// ════════════════════════════════════════════════════════════════════
// deviceAuth.js — 기기 단위 전화번호 인증 유지
//
// 정책: 한 기기에서 전화번호 OTP 인증을 1회 통과하면 "이 기기는 인증됨"으로
//   표시하고, 로그아웃을 눌러도 그 표시와 계정 목록은 보존한다.
//   → 로그아웃 후 앱 재진입 시 전화번호 인증 화면이 다시 뜨지 않고
//     계정 선택(마지막 사용자) 화면으로 진입한다.
//
// 보안:
//   · 세션 토큰/서비스 키는 저장하지 않는다. 재로그인 편의를 위한 최소
//     식별정보(userId / phone / role / name / lastLoginAt)만 보관한다.
//   · 실제 재로그인 시에는 phone 으로 서버 조회(getUserByPhone)를 거쳐
//     최신 사용자 레코드를 받아온다(로컬값을 신뢰해 권한을 부여하지 않음).
//   · "이 기기 인증 삭제 / 완전 로그아웃"(clearDeviceAuth)에서만 모든 흔적 제거.
// ════════════════════════════════════════════════════════════════════

const K = {
  verified: "gonggan_device_verified", // "true" — 이 기기에서 OTP 인증 통과
  phone:    "gonggan_verified_phone",  // 마지막 인증 전화번호(표시/프리필용)
  known:    "gonggan_known_users",     // [{ userId, phone, role, name, lastLoginAt }]
  lastUser: "gonggan_last_user_id",
  lastRole: "gonggan_last_role",
};

// 구버전 per-role 바이패스 키(완전 로그아웃 시 함께 정리)
const LEGACY_KEYS = ["gonggan_ph_c", "gonggan_ph_co"];

export function isDeviceVerified() {
  try { return localStorage.getItem(K.verified) === "true"; } catch { return false; }
}

export function getVerifiedPhone() {
  try { return localStorage.getItem(K.phone) || null; } catch { return null; }
}

export function getKnownUsers() {
  try {
    const raw = localStorage.getItem(K.known);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    // 최근 로그인 순 정렬(사본 반환)
    return arr.slice().sort((a, b) => (b?.lastLoginAt ?? 0) - (a?.lastLoginAt ?? 0));
  } catch { return []; }
}

export function getLastUser() {
  const users = getKnownUsers();
  if (users.length === 0) return null;
  let lastId = null;
  try { lastId = localStorage.getItem(K.lastUser); } catch {}
  return users.find(u => u.userId && u.userId === lastId) || users[0];
}

// 로그인 성공 시 호출 — 기기 인증 표시 + 계정 목록 멱등 upsert.
// 게스트/전화번호 없는 계정(관리자 코드 진입 등)은 기억하지 않는다.
export function rememberUser({ userId, phone, role, name } = {}) {
  try {
    if (!phone) return;
    localStorage.setItem(K.verified, "true");
    localStorage.setItem(K.phone, phone);

    const now = Date.now();
    const users = getKnownUsers();
    const idx = users.findIndex(u =>
      (userId && u.userId === userId) ||
      (!userId && u.phone === phone && u.role === role));
    const entry = {
      userId: userId ?? null,
      phone,
      role: role ?? "consumer",
      name: name ?? "",
      lastLoginAt: now,
    };
    if (idx >= 0) users[idx] = { ...users[idx], ...entry };
    else users.push(entry);

    localStorage.setItem(K.known, JSON.stringify(users));
    if (userId) localStorage.setItem(K.lastUser, userId);
    if (role)   localStorage.setItem(K.lastRole, role);
  } catch {}
}

export function setLastUser(userId, role) {
  try {
    if (userId) localStorage.setItem(K.lastUser, userId);
    if (role)   localStorage.setItem(K.lastRole, role);
  } catch {}
}

// 계정 1건만 목록에서 제거(기기 인증 자체는 유지).
export function forgetUser({ userId, phone } = {}) {
  try {
    const users = getKnownUsers().filter(u =>
      !((userId && u.userId === userId) || (!userId && phone && u.phone === phone)));
    localStorage.setItem(K.known, JSON.stringify(users));
  } catch {}
}

// 완전 로그아웃 / 이 기기 인증 삭제 — 모든 기기 인증 흔적 제거.
//   호출 후에는 앱 진입 시 전화번호 인증 화면부터 다시 시작한다.
export function clearDeviceAuth() {
  try {
    [K.verified, K.phone, K.known, K.lastUser, K.lastRole, ...LEGACY_KEYS]
      .forEach(k => localStorage.removeItem(k));
  } catch {}
}
