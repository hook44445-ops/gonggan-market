import { useState, useEffect } from "react";
import MainApp from "./components/MainApp";
import LoginScreen from "./screens/LoginScreen";
import ErrorBoundary from "./components/ErrorBoundary";
import { supabase, getUser } from "./lib/supabase";

const SESSION_TS_KEY  = "gonggan_login_at";
const THIRTY_DAYS_MS  = 30 * 24 * 60 * 60 * 1000;

async function clearExpiredSession() {
  const loginAt = localStorage.getItem(SESSION_TS_KEY);
  if (loginAt && Date.now() - parseInt(loginAt, 10) > THIRTY_DAYS_MS) {
    await supabase.auth.signOut();
    localStorage.removeItem(SESSION_TS_KEY);
    return true;
  }
  return false;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [goOnboarding, setGoOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const expired = await clearExpiredSession();
        if (!expired) {
          const profile = await loadProfile(session.user.id);
          if (profile) setUser(profile);
        }
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setGoOnboarding(false);
        localStorage.removeItem(SESSION_TS_KEY);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (id) => {
    const { data } = await getUser(id);
    return data || null;
  };

  const handleLogout = async () => {
    // Clear session data immediately — don't wait for SIGNED_OUT event,
    // which may not fire if the component tree has crashed.
    localStorage.removeItem(SESSION_TS_KEY);
    setUser(null);
    setGoOnboarding(false);
    await supabase.auth.signOut().catch(() => {});
  };

  if (loading) return null;

  return (
    <ErrorBoundary onLogout={handleLogout}>
      {user
        ? <MainApp user={user} onLogout={handleLogout} onStartOnboarding={() => { setUser(null); setGoOnboarding(true); }} />
        : <LoginScreen onLogin={u => { setUser(u); setGoOnboarding(false); }} startAtOnboarding={goOnboarding} />}
    </ErrorBoundary>
  );
}
