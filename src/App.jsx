import { useState, useEffect } from "react";
import { SHOW_DEBUG_UI } from "./constants/release";
import MainApp from "./components/MainApp";
import LoginScreen from "./screens/LoginScreen";
import LandingScreen from "./screens/LandingScreen";
import AccountPicker from "./screens/AccountPicker";
import ErrorBoundary from "./components/ErrorBoundary";
import { getUserByPhone } from "./lib/supabase";
import {
  isDeviceVerified, getKnownUsers, rememberUser, clearDeviceAuth, knownUserToSession,
} from "./lib/deviceAuth";

const SESSION_TS_KEY   = "gonggan_login_at";
const SESSION_USER_KEY = "gonggan_user";

const toE164 = (phone) => {
  if (!phone) return "";
  if (String(phone).startsWith("+")) return String(phone);
  const digits = String(phone).replace(/\D/g, "");
  if (digits.startsWith("0")) return "+82" + digits.slice(1);
  return "+" + digits;
};

function loadSavedSession() {
  try {
    const raw = localStorage.getItem(SESSION_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSession(user) {
  try {
    const slim = {
      id:         user.id         ?? null,
      role:       user.role       ?? "consumer",
      activeRole: user.activeRole ?? user.role ?? "consumer",
      phone:      user.phone      ?? "",
      verified:   user.verified   ?? false,
      name:       user.name       ?? "",
      region:     user.region     ?? "",
      badge:      user.badge      ?? "basic",
      isGuest:    user.isGuest    ?? false,
      // 운영자/식별 필드 보존 — 새로고침 후에도 권한/프로필 유지
      isOperator:  user.isOperator  ?? user.is_operator ?? false,
      is_operator: user.is_operator ?? user.isOperator ?? false,
      ownerId:     user.ownerId     ?? null,
      interests:   user.interests   ?? [],
      avatar_url:  user.avatar_url  ?? null,
      created_at:  user.created_at  ?? null,
    };
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(slim));
    localStorage.setItem(SESSION_TS_KEY, Date.now().toString());
  } catch {}
}

function clearSession() {
  localStorage.removeItem(SESSION_USER_KEY);
  localStorage.removeItem(SESSION_TS_KEY);
}


export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingRole, setPendingRole] = useState(null);
  // 명시적 전화번호 인증 의도 — "다른 번호로 로그인"/"이 기기 인증 삭제 후"/업체 온보딩.
  // 이 플래그가 true 일 때만 LoginScreen(전화번호 인증)으로 진입한다. 일반 CTA/role 선택은
  // 기기 인증된 기기에서는 절대 전화번호 인증을 띄우지 않고 AccountPicker 로 보낸다.
  const [phoneAuthMode, setPhoneAuthMode] = useState(false);
  // 계정 선택(AccountPicker)은 LandingScreen 의 '다시 오셨네요' CTA 로만 진입한다(직행 금지).
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [pickBusyId, setPickBusyId] = useState(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [adminLoginErr, setAdminLoginErr] = useState("");

  useEffect(() => {
    const saved = loadSavedSession();
    try {
      console.log("[GONGGAN_DEBUG][App:restore]", {
        phone_verified_device: isDeviceVerified(),
        known_users: getKnownUsers().map(k => ({ userId: k.userId, role: k.role, phone: k.phone, ownerId: k.ownerId ?? null })),
        restored_currentUser: saved ? { id: saved.id, role: saved.role, activeRole: saved.activeRole, ownerId: saved.ownerId ?? null, isGuest: saved.isGuest } : null,
      });
    } catch {}
    if (saved) setUser(saved);
    setLoading(false);
  }, []);

  // 로그인 세션 유지 — 이 앱의 사용자 식별은 전화번호 OTP(서버 API) 기반의
  // localStorage 세션(gonggan_user)이며 supabase.auth 세션과 독립적이다.
  // 과거에는 supabase.auth 의 SIGNED_OUT(빈 세션/만료 토큰 포함)에 반응해
  // 커스텀 세션까지 지워 "로그인이 유지되지 않는" 문제가 있었으므로,
  // 명시적 로그아웃(handleLogout)에서만 세션을 제거하도록 변경한다.
  // (supabase.auth 이벤트로는 커스텀 전화번호 세션을 건드리지 않음)

  const handleLogin = (u) => {
    console.log("[GONGGAN_DEBUG][App:handleLogin]", { userId: u?.id ?? null, role: u?.role ?? null, activeRole: u?.activeRole ?? null, ownerId: u?.ownerId ?? null, isGuest: u?.isGuest ?? false });
    if (!u.isGuest) {
      saveSession(u);
      // 기기 인증 유지 — 전화번호 기반 계정만 기억(게스트/번호없는 관리자 제외).
      // 카드 클릭 복원에 필요한 스냅샷(region 등 포함)을 통째로 넘긴다.
      if (u.phone) rememberUser(u);
    }
    setUser(u);
    setPendingRole(null);
    setPhoneAuthMode(false);
    setShowAccountPicker(false);
  };

  // 일반 로그아웃 — 현재 세션만 종료. 기기 인증/계정 목록은 보존한다.
  // 재진입 시 전화번호 인증/계정선택 직행이 아니라 LandingScreen 으로 진입한다.
  const handleLogout = () => {
    clearSession();
    setUser(null);
    setPendingRole(null);
    setPhoneAuthMode(false);
    setShowAccountPicker(false);
  };

  // 완전 로그아웃 / 이 기기 인증 삭제 — 기기 인증·계정 목록까지 모두 제거.
  // 이후에는 전화번호 인증 화면부터 다시 시작한다.
  const handleForgetDevice = () => {
    clearDeviceAuth();
    clearSession();
    setUser(null);
    setPendingRole(null);
    setPhoneAuthMode(true);
    setShowAccountPicker(false);
  };

  // 저장된 계정 카드 클릭 → OTP/전화번호 인증 없이 즉시 세션 복원.
  // 1) localStorage 스냅샷으로 바로 복원(서버 의존 X). 2) 베스트-에포트 서버 조회로
  //    최신 정보 보강(실패해도 전화번호 인증으로 보내지 않는다 — 절대 OTP 재요구 X).
  const handlePickUser = async (ku) => {
    console.log("[GONGGAN_DEBUG][AccountPicker:pick]", { clickedUserId: ku?.userId ?? null, clickedRole: ku?.role ?? null, phone: ku?.phone ?? null, prevCurrentUser: user ? { id: user.id, role: user.activeRole ?? user.role } : null, pendingRole, phoneAuthMode });
    const key = ku.userId || `${ku.phone}-${ku.role}`;
    setPickBusyId(key);
    const base = knownUserToSession(ku);
    let fresh = null;
    try {
      const { data } = await getUserByPhone(toE164(ku.phone));
      // 같은 전화번호에 역할이 다른 복수 계정(의뢰인/업체)이 있을 수 있으므로, 선택한 계정과
      // 동일 userId 일 때만 서버 정보로 보강한다. 불일치 시 선택 스냅샷(base)을 그대로 사용한다.
      // → 업체 카드를 골랐는데 의뢰인 레코드로 덮어써져 역할/소유자(ownerId)가 깨지고
      //   엉뚱한 화면으로 진입하던 계정 전환 role 복원 오류 방지.
      if (data && (!ku.userId || data.id === ku.userId)) {
        const dbRole = data.role;
        const isAdmin = dbRole === "admin";
        const isOperator = data.is_operator === true || dbRole === "operator";
        // 역할은 '선택한 계정' 기준 우선(로그인 시 선택값이라 DB role 과 다를 수 있음).
        const effRole = isAdmin ? "admin" : (ku.role || dbRole || "consumer");
        fresh = {
          ...data, role: effRole, activeRole: effRole, isOperator,
          ownerId: data.owner_id ?? ku.ownerId ?? null,
        };
      }
    } catch {}
    setPickBusyId(null);
    const restored = fresh ?? base;
    console.log("[GONGGAN_DEBUG][AccountPicker:restore]", { using: fresh ? "server(fresh)" : "snapshot(base)", restoredUserId: restored?.id ?? null, restoredRole: restored?.activeRole ?? restored?.role ?? null, ownerId: restored?.ownerId ?? null });
    handleLogin(restored);
  };

  const handleRoleSelect = (role) => {
    // 인증된 기기 + 저장 계정이 있으면 전화번호 인증 대신 계정 선택(AccountPicker)으로.
    // 신규/미인증 기기에서만 전화번호 인증(LoginScreen)으로 진입.
    if (isDeviceVerified() && getKnownUsers().length > 0) {
      setShowAccountPicker(true);
      return;
    }
    setPendingRole(role);
    setPhoneAuthMode(true);
  };

  // C-4: 초기 세션 복원 중 빈 흰 화면 대신 브랜드 로딩 화면 표시
  if (loading) {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "#2E5F4B",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 18, fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif",
      }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>공간마켓</div>
        <div style={{
          width: 28, height: 28, border: "3px solid rgba(255,255,255,0.3)",
          borderTopColor: "#fff", borderRadius: "50%", animation: "ggLoadSpin 0.8s linear infinite",
        }} />
        <style>{`@keyframes ggLoadSpin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // userId 없는 게스트는 '둘러보기'(startAt) 의도일 때만 MainApp 허용. 그 외 null-id 진입 금지.
  const canEnterApp = !!user && (!!user.id || !!user.startAt);
  const hasSavedAccounts = isDeviceVerified() && getKnownUsers().length > 0;

  {
    let _path = "Landing";
    if (canEnterApp) _path = "MainApp";
    else if (phoneAuthMode) _path = "LoginScreen(phoneAuthMode)";
    else if (showAccountPicker && hasSavedAccounts) _path = "AccountPicker";
    console.log("[GONGGAN_DEBUG][App:route]", { path: _path, currentUserId: user?.id ?? null, currentRole: user?.activeRole ?? user?.role ?? null, isGuest: user?.isGuest ?? false, pendingRole, phoneAuthMode, showAccountPicker, deviceVerified: isDeviceVerified() });
  }

  if (canEnterApp) {
    return (
      <ErrorBoundary onLogout={handleLogout} activeRole={user.activeRole ?? user.role ?? "consumer"}>
        <MainApp
          user={user}
          onLogout={handleLogout}
          onForgetDevice={handleForgetDevice}
          onLogin={handleLogin}
          onStartOnboarding={() => {
            // 업체 온보딩은 새 전화번호 인증/가입이 필요한 명시적 흐름.
            clearSession();
            setUser(null);
            setPendingRole("company");
            setPhoneAuthMode(true);
          }}
        />
      </ErrorBoundary>
    );
  }

  const handleAdminLogin = () => {
    const adminCode = import.meta.env.VITE_ADMIN_CODE;
    if (!adminCode) {
      setAdminLoginErr("관리자 접근이 구성되지 않았습니다");
      return;
    }
    if (adminId === "admin" && adminPw === adminCode) {
      // 코드 관리자 = 가상 'admin' 계정. DB users 행이 아니라 VITE_ADMIN_CODE 게이트로 인증한다.
      // 어드민 RPC 는 p_admin_id 가 'admin' sentinel 이면 허용(migration 040/046 패턴) — 실제 DB
      // admin UUID 가 없어도 동작한다. (uuid 컬럼에는 RPC 내부에서 NULL 로 저장)
      console.log("[GONGGAN_DEBUG][App:adminLogin]", { userId: "admin", role: "admin", note: "virtual code admin (sentinel)" });
      localStorage.setItem("admin_authed", "true");
      setShowAdminLogin(false);
      setAdminId("");
      setAdminPw("");
      setAdminLoginErr("");
      handleLogin({ id: "admin", role: "admin", activeRole: "admin", name: "관리자", isGuest: true });
    } else {
      setAdminLoginErr("아이디 또는 비밀번호가 올바르지 않습니다");
    }
  };

  // 1) 명시적 전화번호 인증 의도("다른 번호로 로그인"/기기 인증 삭제 후/업체 온보딩)에서만
  //    LoginScreen(전화번호 인증)으로 진입한다.
  if (phoneAuthMode) {
    return (
      <ErrorBoundary onLogout={handleLogout} activeRole={pendingRole ?? "visitor"}>
        <LoginScreen onLogin={handleLogin} initialRole={pendingRole} />
      </ErrorBoundary>
    );
  }

  // 2) 계정 선택(AccountPicker)은 LandingScreen 의 '다시 오셨네요' CTA 로만 진입한다(직행 금지).
  if (showAccountPicker && hasSavedAccounts) {
    return (
      <ErrorBoundary onLogout={handleForgetDevice} activeRole="visitor">
        <AccountPicker
          users={getKnownUsers()}
          busyId={pickBusyId}
          onPick={handlePickUser}
          onAddAccount={() => { setShowAccountPicker(false); setPendingRole(null); setPhoneAuthMode(true); }}
          onForgetDevice={handleForgetDevice}
          onBack={() => setShowAccountPicker(false)}
        />
      </ErrorBoundary>
    );
  }

  // 3) 그 외 모든 진입은 항상 LandingScreen. 기기 인증+저장 계정이 있으면 '다시 오셨네요' CTA 노출.
  {
    return (
      <ErrorBoundary onLogout={handleLogout} activeRole="visitor">
        <LandingScreen
          hasSavedAccounts={hasSavedAccounts}
          onResume={() => setShowAccountPicker(true)}
          onSelectRole={handleRoleSelect}
          onAdminTap={() => {
            setAdminId("");
            setAdminPw("");
            setAdminLoginErr("");
            setShowAdminLogin(true);
          }}
        />
        {showAdminLogin && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20, fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif" }}>
            <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 340 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#1a1a1a", marginBottom: 6 }}>관리자 로그인</div>
              <div style={{ fontSize: 13, color: "#999", marginBottom: 20 }}>관리자 계정으로 로그인하세요</div>
              <input
                value={adminId}
                onChange={e => { setAdminId(e.target.value); setAdminLoginErr(""); }}
                type="text"
                placeholder="아이디"
                autoComplete="off"
                onKeyDown={e => e.key === "Enter" && handleAdminLogin()}
                style={{ width: "100%", padding: "13px 14px", border: "1.5px solid #e0e0e0", borderRadius: 10, fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 10, fontFamily: "inherit", color: "#1a1a1a" }}
              />
              <input
                value={adminPw}
                onChange={e => { setAdminPw(e.target.value); setAdminLoginErr(""); }}
                type="password"
                placeholder="비밀번호"
                autoComplete="off"
                onKeyDown={e => e.key === "Enter" && handleAdminLogin()}
                style={{ width: "100%", padding: "13px 14px", border: "1.5px solid #e0e0e0", borderRadius: 10, fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: adminLoginErr ? 8 : 20, fontFamily: "inherit", color: "#1a1a1a" }}
              />
              {adminLoginErr && <div style={{ color: "#e74c3c", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>{adminLoginErr}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => { setShowAdminLogin(false); setAdminId(""); setAdminPw(""); setAdminLoginErr(""); }}
                  style={{ flex: 1, padding: "13px", background: "#f5f5f5", color: "#666", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  취소
                </button>
                <button
                  onClick={handleAdminLogin}
                  style={{ flex: 2, padding: "13px", background: "#1B4D31", color: "#fff", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                  로그인
                </button>
              </div>
              {SHOW_DEBUG_UI && (
                <div style={{ marginTop: 16, padding: "8px 10px", background: "#111", color: "#0f0", borderRadius: 6, fontSize: 10, fontFamily: "monospace", lineHeight: 1.8 }}>
                  admin_authed: {localStorage.getItem("admin_authed") ?? "null"}<br/>
                  admin_login_err: {adminLoginErr || "—"}
                </div>
              )}
            </div>
          </div>
        )}
      </ErrorBoundary>
    );
  }
}
