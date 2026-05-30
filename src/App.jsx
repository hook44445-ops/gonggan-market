import { useState, useEffect, useRef } from "react";
import { SHOW_DEBUG_UI } from "./constants/release";
import { supabase } from "./lib/supabase";
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

  // 리스너 클로저에서 최신 user를 참조하기 위한 ref (재구독 방지)
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    const saved = loadSavedSession();
    if (saved) setUser(saved);
    setLoading(false);
  }, []);

  // C-5: Supabase 세션 만료/로그아웃 감지 → RLS 403 무음 실패 방지
  // 게스트/관리자(isGuest)는 Supabase 인증 세션과 무관하므로 영향 주지 않는다.
  // SIGNED_OUT(만료 포함)일 때만 안전하게 로그인 화면으로 복구한다.
  // INITIAL_SESSION / SIGNED_IN / TOKEN_REFRESHED 는 localStorage 세션을 건드리지 않는다.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        const cur = userRef.current;
        if (cur && !cur.isGuest) {
          clearSession();
          setUser(null);
          setPendingRole(null);
        }
      }
    });
    return () => data?.subscription?.unsubscribe();
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
