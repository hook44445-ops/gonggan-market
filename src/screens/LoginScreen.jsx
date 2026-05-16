import { useState } from "react";
import { C, R, S, SPECIALTIES, CITY_DISTRICTS, fmtPhone } from "../constants";
import { BADGES } from "../constants/badges";
import CompanyOnboarding from "./CompanyOnboarding";
import { upsertUserByPhone, getUserByPhone } from "../lib/supabase";

// Same-device phone bypass keys (STEP F)
const PHONE_KEY = { consumer: "gonggan_ph_c", company: "gonggan_ph_co" };
const getStoredPhone = (role) => PHONE_KEY[role] ? localStorage.getItem(PHONE_KEY[role]) : null;
const setStoredPhone = (role, phone) => { if (PHONE_KEY[role]) localStorage.setItem(PHONE_KEY[role], phone); };

const toE164 = (phone) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "+82" + digits.slice(1);
  return "+" + digits;
};

const SERVICE_ICONS = {
  "아파트 전체": "🏠", "아파트 부분": "🛋", "원룸/오피스텔": "🏢",
  "카페/식당": "☕", "오피스": "💼", "상가": "🏪",
  "욕실": "🚿", "주방": "🍳", "바닥/도배": "🪵", "조명/전기": "💡",
};

export default function LoginScreen({ onLogin }) {
  const [step, setStep] = useState(1);
  const [pendingRole, setPendingRole] = useState(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Admin hidden entry — version text tap (5x) on first screen
  const [tapCount, setTapCount] = useState(0);
  const [showBrowse, setShowBrowse] = useState(false);

  // Admin hidden entry state
  const [adminCode, setAdminCode] = useState("");
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminCodeError, setAdminCodeError] = useState("");

  // Consumer onboarding state
  const [consumerStep, setConsumerStep] = useState(1);
  const [name, setName] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);

  const iS = {
    width: "100%", padding: "14px 16px", border: `1.5px solid ${C.bgWarm}`,
    borderRadius: R.md, fontSize: 15, outline: "none", boxSizing: "border-box",
    marginBottom: 14, fontFamily: "inherit", color: C.text1, background: C.surface,
  };

  const chooseRole = async (role) => {
    setPendingRole(role);
    // STEP F: Same-device bypass — if phone verified before, skip SMS
    const stored = getStoredPhone(role);
    if (stored) {
      setLoading(true);
      try {
        const { data: existingUser } = await getUserByPhone(toE164(stored));
        if (existingUser) {
          setLoading(false);
          onLogin({ ...existingUser, role: existingUser.role || role });
          return;
        }
      } catch {}
      setLoading(false);
      setPhone(stored); // Pre-fill the stored phone
    }
    setStep(2);
  };

  const sendCode = async () => {
    if (phone.replace(/-/g, "").length < 10) return setMsg("올바른 전화번호를 입력해주세요");
    setLoading(true); setMsg("");
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: toE164(phone) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "인증번호 발송에 실패했습니다");
      setCodeSent(true);
      setMsg("✅ 인증번호가 발송되었습니다");
    } catch (err) {
      setMsg("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (code.length < 4) return setMsg("인증번호를 입력해주세요");
    setLoading(true); setMsg("");
    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: toE164(phone), code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "인증에 실패했습니다");

      // STEP F: Save verified phone for same-device bypass
      setStoredPhone(pendingRole, phone);
      if (data.user) {
        // Explicit company/admin selection takes precedence over DB role
        const userRole = (pendingRole === "company" || pendingRole === "admin")
          ? pendingRole
          : (data.user.role ?? "consumer");
        onLogin({ ...data.user, role: userRole });
      } else {
        // New user: go to onboarding with pendingRole
        setStep(3);
        setMsg("");
      }
    } catch (err) {
      setMsg("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdminCode = () => {
    if (adminCode === "admin1234") {
      setShowAdminModal(false);
      setAdminCode("");
      setAdminCodeError("");
      // STEP A: Skip SMS — admin enters directly after code
      onLogin({ role: "admin", name: "관리자", id: null, phone: "", verified: true });
    } else {
      setAdminCodeError("관리자 코드가 올바르지 않습니다");
    }
  };

  const saveConsumer = async () => {
    if (!name.trim()) return setMsg("이름을 입력해주세요");
    setLoading(true);
    const region = selectedCity && selectedDistrict
      ? `${selectedCity} ${selectedDistrict}`
      : selectedCity || "서울 마포구";
    const profile = {
      name: name.trim(),
      role: "consumer",
      region,
      interests: selectedServices,
      phone: toE164(phone),
    };
    const { data, error } = await upsertUserByPhone(profile);
    setLoading(false);
    if (error) return setMsg("❌ 프로필 저장에 실패했습니다");
    onLogin(data || profile);
  };

  const toggleService = (s) =>
    setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const progressBar = (current, total) => (
    <div style={{ display: "flex", gap: 4, marginBottom: S.xxl }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          flex: 1, height: 4, borderRadius: R.full,
          background: i < current ? C.brand : C.bgWarm,
          transition: "background 0.3s",
        }} />
      ))}
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px 20px", fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif",
    }}>

      {/* ── Step 1: Role Selection ── */}
      {step === 1 && (
        <div style={{ width: "100%", maxWidth: 390 }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{
              width: 68, height: 68, borderRadius: R.xl, margin: "0 auto 14px",
              background: `linear-gradient(135deg,${C.brand},${C.brandD})`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32,
              boxShadow: `0 8px 24px ${C.brand}44`,
            }}>🏠</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.text1, letterSpacing: "-0.5px" }}>공간마켓</div>
            <div style={{ fontSize: 14, color: C.text3, marginTop: 6 }}>우리 동네 믿을 수 있는 시공 업체</div>
          </div>

          <div style={{ display: "flex", gap: S.sm, marginBottom: S.xxl }}>
            {[["🔍", "간편 견적"], ["🏆", "검증 업체"], ["🛡", "안전 정산"]].map(([icon, label]) => (
              <div key={label} style={{
                flex: 1, background: C.surface, borderRadius: R.lg,
                padding: `${S.lg}px ${S.sm}px`, textAlign: "center",
                border: `1px solid ${C.bgWarm}`,
              }}>
                <div style={{ fontSize: 22, marginBottom: 5 }}>{icon}</div>
                <div style={{ fontSize: 12, color: C.text2, fontWeight: 700 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={() => setShowBrowse(true)}
              style={{
                background: C.surface, border: `1.5px solid ${C.bgWarm}`, borderRadius: R.xl,
                padding: "15px 20px", display: "flex", alignItems: "center", gap: 14,
                cursor: "pointer", boxShadow: "0 2px 8px rgba(28,23,18,0.06)", textAlign: "left",
              }}>
              <div style={{
                width: 44, height: 44, borderRadius: R.lg, flexShrink: 0,
                background: C.brandL, border: `1.5px solid ${C.brandM}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
              }}>🔍</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 2 }}>통합 둘러보기</div>
                <div style={{ fontSize: 12, color: C.text3 }}>가입 전 플랫폼 구조 · 업체 · 후기 확인</div>
              </div>
              <div style={{ marginLeft: "auto", color: C.brand, fontSize: 20 }}>›</div>
            </button>

            <button onClick={() => chooseRole("consumer")}
              style={{
                background: `linear-gradient(135deg,${C.brand},${C.brandD})`, color: "#fff",
                border: "none", borderRadius: R.xl, padding: "18px 20px",
                display: "flex", alignItems: "center", gap: 14,
                cursor: "pointer", boxShadow: `0 6px 20px ${C.brand}44`, textAlign: "left",
              }}>
              <div style={{
                width: 48, height: 48, borderRadius: R.lg, flexShrink: 0,
                background: "rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
              }}>🏡</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>의뢰인으로 시작</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>인테리어 · 시공 업체를 찾고 있어요</div>
              </div>
              <div style={{ marginLeft: "auto", fontSize: 20, opacity: 0.8 }}>›</div>
            </button>

            <button onClick={() => chooseRole("company")}
              style={{
                background: C.surface, border: `1.5px solid ${C.bgWarm}`, borderRadius: R.xl,
                padding: "18px 20px", display: "flex", alignItems: "center", gap: 14,
                cursor: "pointer", boxShadow: "0 2px 12px rgba(28,23,18,0.08)", textAlign: "left",
              }}>
              <div style={{
                width: 48, height: 48, borderRadius: R.lg, flexShrink: 0,
                background: C.surface2, border: `1.5px solid ${C.bgWarm}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
              }}>🔨</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: 2 }}>업체로 시작</div>
                <div style={{ fontSize: 13, color: C.text3 }}>견적 의뢰를 받고 일감을 늘려요</div>
              </div>
              <div style={{ marginLeft: "auto", color: C.brand, fontSize: 20 }}>›</div>
            </button>
          </div>

          <div style={{ textAlign: "center", marginTop: 24 }}>
            <div
              onClick={() => {
                const next = tapCount + 1;
                setTapCount(next);
                if (next >= 5) { setTapCount(0); setShowAdminModal(true); }
              }}
              style={{ fontSize: 11, color: C.text4, cursor: "default", userSelect: "none" }}>
              공간마켓 v1.0.0
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Phone verification ── */}
      {step === 2 && (
        <div style={{ width: "100%", maxWidth: 390 }}>
          <button onClick={() => { setStep(1); setCodeSent(false); setCode(""); setMsg(""); }}
            style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: C.text3, marginBottom: 24, fontWeight: 600 }}>
            ← 뒤로
          </button>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text1, marginBottom: 4 }}>
            {pendingRole === "admin" ? "관리자 인증" : "전화번호 인증"}
          </div>
          <div style={{ fontSize: 13, color: C.text3, marginBottom: S.xxl }}>가입된 계정이 없으면 자동으로 가입됩니다</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: 8 }}>전화번호</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input value={phone} onChange={e => setPhone(fmtPhone(e.target.value))} placeholder="010-0000-0000" maxLength={13}
              style={{ ...iS, flex: 1, marginBottom: 0 }} />
            <button onClick={sendCode} disabled={loading}
              style={{ padding: "14px 16px", background: C.brand, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 800, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
              {codeSent ? "재발송" : "인증받기"}
            </button>
          </div>
          {codeSent && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: 8 }}>인증번호</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" maxLength={6}
                  style={{ ...iS, flex: 1, marginBottom: 0, letterSpacing: 8, fontSize: 22, fontWeight: 800, textAlign: "center" }} />
                <button onClick={verifyCode} disabled={loading}
                  style={{ padding: "14px 16px", background: C.brand, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                  확인
                </button>
              </div>
            </>
          )}
          {msg && (
            <div style={{ padding: "12px 16px", borderRadius: R.md, marginBottom: 14, background: msg.startsWith("✅") ? "#E6F7F0" : "#FFF0F0", color: msg.startsWith("✅") ? C.green : C.red, fontSize: 13, fontWeight: 600 }}>
              {msg}
            </div>
          )}
          {!codeSent && (
            <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.lg, fontSize: 13, color: C.text2, lineHeight: 1.8 }}>
              📱 입력한 번호로 인증문자가 발송됩니다<br />🔒 번호는 인증 외 목적으로 사용되지 않습니다
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Onboarding ── */}

      {/* Consumer name */}
      {step === 3 && pendingRole === "consumer" && consumerStep === 1 && (
        <div style={{ width: "100%", maxWidth: 390 }}>
          {progressBar(1, 3)}
          <div style={{ fontSize: 22, fontWeight: 900, color: C.text1, marginBottom: 6 }}>이름이 어떻게 되세요?</div>
          <div style={{ fontSize: 14, color: C.text3, marginBottom: S.xxl }}>견적 요청 시 업체에게 표시됩니다</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="홍길동"
            style={{ ...iS, fontSize: 18, fontWeight: 700 }} autoFocus />
          {msg && <div style={{ padding: "12px 16px", borderRadius: R.md, marginBottom: 14, background: "#FFF0F0", color: C.red, fontSize: 13, fontWeight: 600 }}>{msg}</div>}
          <button onClick={() => { if (!name.trim()) return setMsg("이름을 입력해주세요"); setMsg(""); setConsumerStep(2); }}
            style={{ width: "100%", padding: S.xl, background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 16, cursor: "pointer", boxShadow: `0 6px 20px ${C.brand}44` }}>
            다음 →
          </button>
        </div>
      )}

      {/* Consumer region */}
      {step === 3 && pendingRole === "consumer" && consumerStep === 2 && (
        <div style={{ width: "100%", maxWidth: 390 }}>
          {progressBar(2, 3)}
          {!selectedCity ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.text1, marginBottom: 6 }}>어느 지역에 계세요?</div>
              <div style={{ fontSize: 14, color: C.text3, marginBottom: S.xxl }}>시 / 도를 선택해주세요</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: S.sm }}>
                {Object.keys(CITY_DISTRICTS).map(city => (
                  <button key={city} onClick={() => setSelectedCity(city)}
                    style={{ padding: "16px", background: C.surface, border: `1.5px solid ${C.bgWarm}`, borderRadius: R.lg, fontSize: 15, fontWeight: 700, color: C.text1, cursor: "pointer", textAlign: "center", boxShadow: "0 2px 8px rgba(28,23,18,0.06)" }}>
                    {city}
                  </button>
                ))}
              </div>
              <button onClick={() => { setConsumerStep(1); setSelectedCity(""); setSelectedDistrict(""); }}
                style={{ background: "none", border: "none", fontSize: 14, color: C.text3, cursor: "pointer", marginTop: S.xl, fontWeight: 600 }}>
                ← 뒤로
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setSelectedCity(""); setSelectedDistrict(""); }}
                style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: C.text3, marginBottom: 12, fontWeight: 600 }}>
                ← {selectedCity}
              </button>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.text1, marginBottom: 6 }}>구 / 시를 선택해주세요</div>
              <div style={{ fontSize: 14, color: C.brand, fontWeight: 700, marginBottom: S.xl }}>📍 {selectedCity}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: S.sm, maxHeight: "55vh", overflowY: "auto" }}>
                {CITY_DISTRICTS[selectedCity].map(district => (
                  <button key={district} onClick={() => { setSelectedDistrict(district); setConsumerStep(3); }}
                    style={{ padding: "14px", background: C.surface, border: `1.5px solid ${C.bgWarm}`, borderRadius: R.lg, fontSize: 14, fontWeight: 700, color: C.text1, cursor: "pointer", textAlign: "center", boxShadow: "0 2px 8px rgba(28,23,18,0.06)" }}>
                    {district}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Consumer services */}
      {step === 3 && pendingRole === "consumer" && consumerStep === 3 && (
        <div style={{ width: "100%", maxWidth: 390 }}>
          {progressBar(3, 3)}
          <div style={{ fontSize: 22, fontWeight: 900, color: C.text1, marginBottom: 6 }}>관심 서비스를 선택해주세요</div>
          <div style={{ fontSize: 14, color: C.text3, marginBottom: S.xl }}>📍 {selectedCity} {selectedDistrict} · 복수 선택 가능</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: S.sm, marginBottom: S.xl }}>
            {SPECIALTIES.map(s => {
              const active = selectedServices.includes(s);
              return (
                <button key={s} onClick={() => toggleService(s)}
                  style={{ padding: "14px 12px", borderRadius: R.lg, fontSize: 14, fontWeight: 700, border: `2px solid ${active ? C.brand : C.bgWarm}`, background: active ? C.brandL : C.surface, color: active ? C.brand : C.text2, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8, boxShadow: active ? `0 0 0 1px ${C.brand}33` : "none", transition: "all 0.15s" }}>
                  <span style={{ fontSize: 18 }}>{SERVICE_ICONS[s] ?? "🔧"}</span>
                  <span>{s}</span>
                </button>
              );
            })}
          </div>
          {msg && <div style={{ padding: "12px 16px", borderRadius: R.md, marginBottom: 14, background: "#FFF0F0", color: C.red, fontSize: 13, fontWeight: 600 }}>{msg}</div>}
          <button onClick={saveConsumer} disabled={loading}
            style={{ width: "100%", padding: S.xl, background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 16, cursor: "pointer", boxShadow: `0 6px 20px ${C.brand}44`, opacity: loading ? 0.7 : 1 }}>
            {loading ? "저장 중..." : `공간마켓 시작하기 🚀${selectedServices.length > 0 ? ` (${selectedServices.length}개 선택)` : ""}`}
          </button>
          <button onClick={() => { setConsumerStep(2); setSelectedDistrict(""); }}
            style={{ background: "none", border: "none", fontSize: 14, color: C.text3, cursor: "pointer", marginTop: S.md, fontWeight: 600, width: "100%" }}>
            ← 지역 다시 선택
          </button>
        </div>
      )}

      {/* Company onboarding */}
      {step === 3 && pendingRole === "company" && (
        <CompanyOnboarding phone={phone} onDone={u => onLogin({ ...u, role: "company" })} />
      )}

      {/* Admin onboarding */}
      {step === 3 && pendingRole === "admin" && consumerStep === 1 && (
        <div style={{ width: "100%", maxWidth: 390 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.text1, marginBottom: 6 }}>관리자 이름</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="관리자명"
            style={{ ...iS, fontSize: 18, fontWeight: 700 }} autoFocus />
          {msg && <div style={{ padding: "12px 16px", borderRadius: R.md, marginBottom: 14, background: "#FFF0F0", color: C.red, fontSize: 13, fontWeight: 600 }}>{msg}</div>}
          <button onClick={async () => {
            if (!name.trim()) return setMsg("이름을 입력해주세요");
            setLoading(true);
            const profile = { name: name.trim(), role: "admin", phone: toE164(phone), region: "" };
            const { data, error } = await upsertUserByPhone(profile);
            setLoading(false);
            if (error) return setMsg("❌ 저장 실패");
            onLogin(data || { ...profile, role: "admin" });
          }} disabled={loading}
            style={{ width: "100%", padding: S.xl, background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
            {loading ? "저장 중..." : "관리자로 시작하기"}
          </button>
        </div>
      )}

      {/* ── 통합 둘러보기 ── */}
      {showBrowse && (
        <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 100, display: "flex", flexDirection: "column" }}>
          {/* 헤더 */}
          <div style={{ background: C.surface, borderBottom: `1px solid ${C.bgWarm}`, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: R.md, background: C.brand, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🏠</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>공간마켓 둘러보기</div>
            </div>
            <button onClick={() => setShowBrowse(false)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: C.text3, padding: "0 4px", lineHeight: 1 }}>×</button>
          </div>

          {/* 스크롤 본문 */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 120px" }}>

            {/* 1. 신뢰 지표 */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, color: C.brand, fontWeight: 700, marginBottom: 6 }}>공간마켓 신뢰 지표</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.text1, marginBottom: 14 }}>숫자로 증명하는 플랫폼</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                {[
                  { icon: "✅", value: "1,247건", label: "누적 완료 공사" },
                  { icon: "⭐", value: "4.9점",   label: "평균 만족도" },
                  { icon: "🛡", value: "89곳",    label: "공간보증 업체" },
                  { icon: "🌡", value: "91°",     label: "평균 공간온도" },
                ].map(({ icon, value, label }) => (
                  <div key={label} style={{ background: C.surface, borderRadius: R.lg, padding: S.xl, border: `1px solid ${C.bgWarm}`, textAlign: "center" }}>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: C.brand }}>{value}</div>
                    <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.lg, border: `1px solid ${C.brandM}`, textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: C.brand }}>48억원+</div>
                <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>총 안전 거래액 (에스크로 보호)</div>
              </div>
            </div>

            {/* 2. 에스크로 구조 */}
            <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: 28, border: `1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize: 13, color: C.brand, fontWeight: 700, marginBottom: 6 }}>에스크로 안전 정산</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: C.text1, marginBottom: 14 }}>공사비는 공간마켓이 보관해요</div>
              {[
                { icon: "📝", step: "계약",      desc: "고객이 총 공사비를 공간마켓에 예치" },
                { icon: "🏗",  step: "단계 승인", desc: "착공·중간점검·완료 단계별 고객 확인" },
                { icon: "💰", step: "안전 정산", desc: "고객 확인 완료 후 업체에 단계별 지급" },
                { icon: "🎉", step: "공사 완료", desc: "리뷰 작성·공간온도 반영 · AS 보장" },
              ].map(({ icon, step, desc }, i, arr) => (
                <div key={step} style={{ display: "flex", gap: S.md, marginBottom: i < arr.length - 1 ? S.lg : 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: R.full, background: C.brandL, border: `1.5px solid ${C.brandM}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{icon}</div>
                    {i < arr.length - 1 && <div style={{ width: 2, height: 20, background: C.bgWarm, marginTop: 4 }} />}
                  </div>
                  <div style={{ paddingTop: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: 2 }}>{step}</div>
                    <div style={{ fontSize: 12, color: C.text3 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 3. 공간보증 배지 */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, color: C.brand, fontWeight: 700, marginBottom: 6 }}>공간보증 배지</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: C.text1, marginBottom: 14 }}>보증금 예치로 신뢰를 증명해요</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(BADGES).map(([key, b]) => (
                  <div key={key} style={{ background: C.surface, borderRadius: R.lg, padding: `${S.md}px ${S.xl}px`, border: `1px solid ${C.bgWarm}`, display: "flex", alignItems: "center", gap: S.lg }}>
                    <div style={{ width: 40, height: 40, borderRadius: R.md, background: b.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{b.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: b.color }}>{b.label}</span>
                        <span style={{ fontSize: 12, color: C.text3, fontWeight: 600 }}>최대 {b.maxJob}</span>
                      </div>
                      <div style={{ fontSize: 11, color: C.text4, marginTop: 2 }}>보증금 {b.deposit.toLocaleString()}만원 예치</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. 완료 후기 미리보기 */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, color: C.brand, fontWeight: 700, marginBottom: 6 }}>완료 후기</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: C.text1, marginBottom: 14 }}>실제 고객 후기를 확인하세요</div>
              {[
                { photo: "🏠", stars: 5, text: "에스크로 덕분에 걱정 없이 진행했어요. 마감도 깔끔하고 일정도 정확히 지켜줬어요.", region: "서울 마포구", type: "아파트 전체", co: "홍익시공", temp: 97 },
                { photo: "🛋", stars: 5, text: "중간보고를 꼼꼼히 해줘서 신뢰가 갔어요. 공간온도 이유를 알겠더라고요.", region: "서울 연남동", type: "거실·주방", co: "공간설계소", temp: 91 },
                { photo: "🚿", stars: 4, text: "욕실 시공 퀄리티 정말 만족해요. 추가금 없이 견적 그대로 완료!", region: "경기 수원시", type: "욕실 시공", co: "우리집시공단", temp: 86 },
              ].map((r, i) => (
                <div key={i} style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.sm, border: `1px solid ${C.bgWarm}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.sm }}>
                    <div style={{ display: "flex", gap: S.sm, alignItems: "center" }}>
                      <div style={{ width: 44, height: 44, borderRadius: R.md, background: C.brandL, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{r.photo}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{r.co}</div>
                        <div style={{ fontSize: 11, color: C.text3 }}>{r.region} · {r.type}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: "#C8A15A", letterSpacing: 1 }}>{"★".repeat(r.stars)}</div>
                  </div>
                  <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>"{r.text}"</div>
                </div>
              ))}
            </div>

            {/* 5. 업체 카드 미리보기 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: C.brand, fontWeight: 700, marginBottom: 6 }}>검증 업체</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: C.text1, marginBottom: 14 }}>공간보증 인증 업체들</div>
              {[
                { name: "홍익시공",    temp: 97, badge: "premium",    jobs: 84, reviews: 4.9, region: "서울 마포", specs: ["아파트 전체","주방","욕실"] },
                { name: "공간설계소",  temp: 91, badge: "standard",   jobs: 52, reviews: 4.8, region: "서울 서대문", specs: ["인테리어","오피스","카페"] },
                { name: "우리집시공단",temp: 86, badge: "basic",      jobs: 31, reviews: 4.7, region: "경기 성남", specs: ["아파트 부분","바닥/도배"] },
              ].map(c => {
                const b = BADGES[c.badge] ?? BADGES.basic;
                return (
                  <div key={c.name} style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.sm, border: `1px solid ${C.bgWarm}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.sm }}>
                      <div style={{ display: "flex", gap: S.md, alignItems: "center" }}>
                        <div style={{ width: 44, height: 44, borderRadius: R.md, background: b.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 900, color: b.color }}>{b.icon}</div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>{c.name}</span>
                            <span style={{ background: b.bg, color: b.color, borderRadius: R.full, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>{b.label}</span>
                          </div>
                          <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>📍 {c.region}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: c.temp >= 90 ? C.brand : "#C8A15A" }}>{c.temp}°</div>
                        <div style={{ fontSize: 10, color: C.text4 }}>공간온도</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: S.sm, marginBottom: S.sm }}>
                      {c.specs.map(s => (
                        <span key={s} style={{ background: C.surface2, color: C.text3, borderRadius: R.full, padding: "3px 10px", fontSize: 11, fontWeight: 600, border: `1px solid ${C.bgWarm}` }}>{s}</span>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: S.xl, fontSize: 12, color: C.text3 }}>
                      <span>✅ 완료 {c.jobs}건</span>
                      <span>⭐ {c.reviews}점</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 하단 CTA */}
          <div style={{ background: C.surface, borderTop: `1px solid ${C.bgWarm}`, padding: "12px 20px 24px", display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={() => { setShowBrowse(false); chooseRole("consumer"); }}
              style={{ flex: 1, padding: "16px", background: `linear-gradient(135deg,${C.brand},${C.brandD})`, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: `0 4px 16px ${C.brand}44` }}>
              🏡 의뢰인으로 시작
            </button>
            <button onClick={() => { setShowBrowse(false); chooseRole("company"); }}
              style={{ flex: 1, padding: "16px", background: C.surface, color: C.brand, border: `2px solid ${C.brandM}`, borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
              🔨 업체로 시작
            </button>
          </div>
        </div>
      )}

      {/* Admin code modal */}
      {showAdminModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
          <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xxl, width: "100%", maxWidth: 340 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, marginBottom: 6 }}>관리자 코드</div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: S.xl }}>관리자 전용 코드를 입력해주세요</div>
            <input value={adminCode} onChange={e => { setAdminCode(e.target.value); setAdminCodeError(""); }}
              type="password" placeholder="코드 입력"
              style={{ ...iS, textAlign: "center", letterSpacing: 4, fontSize: 18 }} />
            {adminCodeError && <div style={{ color: C.red, fontSize: 12, fontWeight: 600, marginBottom: S.sm }}>{adminCodeError}</div>}
            <div style={{ display: "flex", gap: S.sm }}>
              <button onClick={() => { setShowAdminModal(false); setAdminCode(""); setAdminCodeError(""); }}
                style={{ flex: 1, padding: S.lg, background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                취소
              </button>
              <button onClick={handleAdminCode}
                style={{ flex: 1, padding: S.lg, background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
