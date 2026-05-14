import { useState, useEffect } from "react";
import MainApp from "./components/MainApp";
import LoginScreen from "./screens/LoginScreen";
import ErrorBoundary from "./components/ErrorBoundary";
import { supabase, getUser } from "./lib/supabase";

export default function App() {
  const [user, setUser] = useState(null);
  const [goOnboarding, setGoOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const profile = await loadProfile(session.user.id);
        if (profile) setUser(profile);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setGoOnboarding(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (id) => {
    const { data } = await getUser(id);
    return data || null;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setGoOnboarding(false);
  };

  if (loading) return null;

  return (
    <ErrorBoundary>
      {user
        ? <MainApp user={user} onLogout={handleLogout} onStartOnboarding={() => { setUser(null); setGoOnboarding(true); }} />
        : <LoginScreen onLogin={u => { setUser(u); setGoOnboarding(false); }} startAtOnboarding={goOnboarding} />}
    </ErrorBoundary>
  );
}
