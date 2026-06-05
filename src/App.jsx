import { useState, useEffect } from "react";
import { SHOW_DEBUG_UI } from "./constants/release";
import MainApp from "./components/MainApp";
import LoginScreen from "./screens/LoginScreen";
import LandingScreen from "./screens/LandingScreen";
import AccountPicker from "./screens/AccountPicker";
import ErrorBoundary from "./components/ErrorBoundary";
import { getUserByPhone } from "./lib/supabase";
import {
  isDeviceVerified, getKnownUsers, rememberUser, clearDeviceAuth,
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
  // 기기 인증된 계정이 있어도 "다른 번호로 로그인"을 누르면 랜딩/인증으로 보낸다.
  const [forceLanding, setForceLanding] = useState(false);
  const [pickBusyId, setPickBusyId] = useState(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [adminLoginErr, setAdminLoginErr] = useState("");

  useEffect(() => {
    const saved = loadSavedSession();
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
    if (!u.isGuest) {
      saveSession(u);
      // 기기 인증 유지 — 전화번호 기반 계정만 기억(게스트/번호없는 관리자 제외).
      if (u.phone) {
        rememberUser({
          userId: u.id ?? null,
          phone:  u.phone,
          role:   u.activeRole ?? u.role ?? "consumer",
          name:   u.name ?? "",
        });
      }
    }
    setUser(u);
    setPendingRole(null);
    setForceLanding(false);
  };

  // 일반 로그아웃 — 현재 세션만 종료. 기기 인증/계정 목록은 보존한다.
  // 재진입 시 전화번호 인증 화면이 아니라 계정 선택(AccountPicker)으로 진입.
  const handleLogout = () => {
    clearSession();
    setUser(null);
    setPendingRole(null);
    setForceLanding(false);
  };

  // 완전 로그아웃 / 이 기기 인증 삭제 — 기기 인증·계정 목록까지 모두 제거.
  // 이후에는 전화번호 인증 화면부터 다시 시작한다.
  const handleForgetDevice = () => {
    clearDeviceAuth();
    clearSession();
    setUser(null);
    setPendingRole(null);
    setForceLanding(true);
  };

  // 저장된 계정으로 재로그인 — OTP 없이 전화번호로 서버 조회 후 진입.
  const handlePickUser = async (ku) => {
    const key = ku.userId || `${ku.phone}-${ku.role}`;
    setPickBusyId(key);
    try {
      const { data: existing } = await getUserByPhone(toE164(ku.phone));
      if (existing) {
        const dbRole = existing.role;
        const isAdmin = dbRole === "admin";
        const isOperator = existing.is_operator === true || dbRole === "operator";
        const effRole = isAdmin ? "admin" : (ku.role || dbRole || "consumer");
        handleLogin({ ...existing, role: effRole, activeRole: effRole, isOperator });
        return;
      }
    } catch {}
    // 조회 실패/계정 없음 → 전화번호 인증 흐름으로 폴백.
    setPickBusyId(null);
    setForceLanding(true);
    setPendingRole(ku.role || "consumer");
  };

  const handleRoleSelect = (role) => {
    setPendingRole(role);
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

  if (user) {
    return (
      <ErrorBoundary onLogout={handleLogout} activeRole={user.activeRole ?? user.role ?? "consumer"}>
        <MainApp
          user={user}
          onLogout={handleLogout}
          onForgetDevice={handleForgetDevice}
          onLogin={handleLogin}
          onStartOnboarding={() => {
            clearSession();
            setUser(null);
            setPendingRole("company");
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

  // 기기 인증 + 저장된 계정이 있으면(그리고 "다른 번호로 로그인"을 누르지 않았으면)
  // 전화번호 인증 화면 대신 계정 선택 화면으로 진입한다.
  if (!pendingRole && !forceLanding && isDeviceVerified()) {
    const knownUsers = getKnownUsers();
    if (knownUsers.length > 0) {
      return (
        <ErrorBoundary onLogout={handleForgetDevice} activeRole="visitor">
          <AccountPicker
            users={knownUsers}
            busyId={pickBusyId}
            onPick={handlePickUser}
            onAddAccount={() => setForceLanding(true)}
            onForgetDevice={handleForgetDevice}
          />
        </ErrorBoundary>
      );
    }
  }

  if (!pendingRole) {
    return (
      <ErrorBoundary onLogout={handleLogout} activeRole="visitor">
        <LandingScreen
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

  return (
    <ErrorBoundary onLogout={handleLogout} activeRole={pendingRole ?? "visitor"}>
      <LoginScreen onLogin={handleLogin} initialRole={pendingRole} />
    </ErrorBoundary>
  );
}
