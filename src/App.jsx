import { useState, useEffect } from "react";
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
      <ErrorBoundary onLogout={handleLogout}>
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

  if (!pendingRole) {
    return (
      <ErrorBoundary onLogout={handleLogout}>
        <LandingScreen onSelectRole={handleRoleSelect} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary onLogout={handleLogout}>
      <LoginScreen onLogin={handleLogin} initialRole={pendingRole} />
    </ErrorBoundary>
  );
}
