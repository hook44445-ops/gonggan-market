import { useState, useEffect } from "react";
import MainApp from "./components/MainApp";
import LoginScreen from "./screens/LoginScreen";
import ErrorBoundary from "./components/ErrorBoundary";

const SESSION_TS_KEY   = "gonggan_login_at";
const SESSION_USER_KEY = "gonggan_user";
const THIRTY_DAYS_MS   = 30 * 24 * 60 * 60 * 1000;

function loadSavedSession() {
  try {
    const loginAt = localStorage.getItem(SESSION_TS_KEY);
    const raw     = localStorage.getItem(SESSION_USER_KEY);
    if (!loginAt || !raw) return null;
    if (Date.now() - parseInt(loginAt, 10) > THIRTY_DAYS_MS) {
      localStorage.removeItem(SESSION_TS_KEY);
      localStorage.removeItem(SESSION_USER_KEY);
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSession(user) {
  try {
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    localStorage.setItem(SESSION_TS_KEY, Date.now().toString());
  } catch {}
}

function clearSession() {
  localStorage.removeItem(SESSION_USER_KEY);
  localStorage.removeItem(SESSION_TS_KEY);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [goOnboarding, setGoOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = loadSavedSession();
    if (saved) setUser(saved);
    setLoading(false);
  }, []);

  const handleLogin = (u) => {
    saveSession(u);
    setUser(u);
    setGoOnboarding(false);
  };

  const handleLogout = () => {
    clearSession();
    setUser(null);
    setGoOnboarding(false);
  };

  if (loading) return null;

  return (
    <ErrorBoundary onLogout={handleLogout}>
      {user
        ? <MainApp user={user} onLogout={handleLogout} onStartOnboarding={() => { clearSession(); setUser(null); setGoOnboarding(true); }} />
        : <LoginScreen onLogin={handleLogin} startAtOnboarding={goOnboarding} />}
    </ErrorBoundary>
  );
}
