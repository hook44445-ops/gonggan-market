import { useState, useEffect } from "react";
import { SHOW_DEBUG_UI } from "./constants/release";
import MainApp from "./components/MainApp";
import LoginScreen from "./screens/LoginScreen";
import LandingScreen from "./screens/LandingScreen";
import ErrorBoundary from "./components/ErrorBoundary";

const SESSION_TS_KEY   = "gonggan_login_at";
const SESSION_USER_KEY = "gonggan_user";

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
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminId, setAdminId] = useState("");
  const [adminPw, setAdminPw] = useState("");
  const [adminLoginErr, setAdminLoginErr] = useState("");

  useEffect(() => {
    const saved = loadSavedSession();
    if (saved) setUser(saved);
    setLoading(false);
  }, []);

  const handleLogin = (u) => {
    if (!u.isGuest) saveSession(u);
    setUser(u);
    setPendingRole(null);
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setPendingRole(null);
  };

  const handleRoleSelect = (role) => {
    setPendingRole(role);
  };

  if (loading) return null;

  if (user) {
    return (
      <ErrorBoundary onLogout={handleLogout} activeRole={user.activeRole ?? user.role ?? "consumer"}>
        <MainApp
          user={user}
          onLogout={handleLogout}
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
    if (adminId === "admin" && adminPw === "44445") {
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
