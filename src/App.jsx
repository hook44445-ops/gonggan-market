import { useState } from "react";
import MainApp from "./components/MainApp";
import LoginScreen from "./components/LoginScreen";

export default function App() {
  const [user, setUser] = useState(null);
  const [goOnboarding, setGoOnboarding] = useState(false);
  return user
    ? <MainApp user={user} onLogout={() => { setUser(null); setGoOnboarding(false); }} onStartOnboarding={() => { setUser(null); setGoOnboarding(true); }} />
    : <LoginScreen onLogin={u => { setUser(u); setGoOnboarding(false); }} startAtOnboarding={goOnboarding} />;
}
