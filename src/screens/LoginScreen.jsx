import { useState, useEffect, useRef } from "react";
import { C, R, S, SPECIALTIES, CITY_DISTRICTS, fmtPhone } from "../constants";
import { BADGES } from "../constants/badges";
import { LogoMark, LeafSprig } from "../components/common";
import CompanyOnboarding from "./CompanyOnboarding";
import { upsertUserByPhone, signupUserByPhone, getUserByPhone } from "../lib/supabase";
import { getKnownUsers, knownUserToSession } from "../lib/deviceAuth";
import { SHOW_DEBUG_UI } from "../constants/release";

// 기기 인증 후 OTP 없는 재로그인은 App 의 AccountPicker(기기 인증)가 담당한다.
// LoginScreen 은 전화번호 인증 화면(최초 1회 / 다른 번호로 로그인)이지만, 입력 번호가
// 이미 이 기기에서 인증된 계정이면 SMS 없이 즉시 복원한다(동일 번호 반복 인증 방지).

const toE164 = (phone) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "+82" + digits.slice(1);
  return "+" + digits;
};

// 전화번호 비교용 — 국가코드/구분자 차이를 흡수해 끝 10자리(0 제외)로 비교.
const phoneDigits = (p) => {
  let d = String(p ?? "").replace(/\D/g, "");
  if (d.startsWith("82")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d;
};
const findKnownByPhone = (p) => {
  const target = phoneDigits(toE164(p));
  if (target.length < 8) return null;
  return getKnownUsers().find(k => phoneDigits(k.phone) === target) ?? null;
};

const SERVICE_ICONS = {
  "아파트 전체": "🏠", "아파트 부분": "🛋", "원룸/오피스텔": "🏢",
  "카페/식당": "☕", "오피스": "💼", "상가": "🏪",
  "욕실": "🚿", "주방": "🍳", "바닥/도배": "🪵", "조명/전기": "💡",
};

export default function LoginScreen({ onLogin, initialRole }) {
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

  // Step 2 bypass state
  const [step2TapCount, setStep2TapCount] = useState(0);
  const [showBypassModal, setShowBypassModal] = useState(false);
  const [bypassCode, setBypassCode] = useState("");
  const [bypassCodeError, setBypassCodeError] = useState("");

  // Consumer onboarding state
  const [consumerStep, setConsumerStep] = useState(1);
  const [name, setName] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);

  const iS = {
    width: "100%", padding: "14px 16px", border: `1.5px solid ${C.bgWarm}`,
    borderRadius: R.lg, fontSize: 15, outline: "none", boxSizing: "border-box",
    marginBottom: 14, fontFamily: "inherit", color: C.text1, background: C.surface,
  };

  const initialRoleFired = useRef(false);

  const chooseRole = (role) => {
    setPendingRole(role);
    setStep(2);
  };

  // Auto-proceed when coming from LandingScreen with a pre-selected role
  useEffect(() => {
    if (initialRole && !initialRoleFired.current) {
      initialRoleFired.current = true;
      chooseRole(initialRole);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendCode = async () => {
    if (phone.replace(/-/g, "").length < 10) return setMsg("올바른 전화번호를 입력해주세요");
    // 동일 번호(이미 이 기기에서 인증된 계정) → SMS 재발송 없이 즉시 세션 복원.
    // 단, '선택한 역할(pendingRole)'을 우선한다. 같은 번호로 의뢰인/업체를 모두 쓸 수 있어야
    // 하므로, 선택 역할 계정이 이미 있으면 그걸 복원하고, 없으면 같은 번호 기준으로 역할만 바꿔
    // 즉시 세션을 구성한다(SMS 생략, 업체 계정 최초 생성도 이 경로로 처리).
    const known = findKnownByPhone(phone);
    if (known) {
      const targetRole = pendingRole || known.role;
      const target = phoneDigits(toE164(phone));
      const exact = getKnownUsers().find(k => phoneDigits(k.phone) === target && k.role === targetRole);
      if (exact) { onLogin(knownUserToSession(exact)); return; }
      onLogin({ ...knownUserToSession(known), role: targetRole, activeRole: targetRole });
      return;
    }
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

      // 인증 성공 — 기기 인증/계정 기억은 App.handleLogin(onLogin) 에서 일괄 처리한다.
      if (data.user) {
        // admin 만 DB 역할을 우선. operator 는 부가 권한(플래그)일 뿐 사용자 유형을 바꾸지 않음.
        const dbRole = data.user.role;
        const isAdmin = dbRole === "admin";
        const isOperator = data.user.is_operator === true || dbRole === "operator";
        const userRole = isAdmin ? "admin" : (pendingRole || dbRole || "consumer");
        onLogin({ ...data.user, role: userRole, activeRole: userRole, isOperator });
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
    const envCode = import.meta.env.VITE_ADMIN_CODE;
    if (!envCode) {
      setAdminCodeError("관리자 접근이 구성되지 않았습니다");
      return;
    }
    if (adminCode === envCode) {
      setShowAdminModal(false);
      setAdminCode("");
      setAdminCodeError("");
      onLogin({ role: "admin", activeRole: "admin", name: "관리자", id: null, phone: "", verified: true });
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
    // 가입은 security-definer RPC 경유(migration 048). 클라 직접 users upsert 는
    // auth.uid()=NULL + WITH CHECK(auth.uid()=id) 로 42501 거부되므로 사용하지 않는다.
    const { data, error } = await signupUserByPhone(profile);
    setLoading(false);
    if (error) {
      console.error("[GONGGAN_DEBUG][saveConsumer] signup RPC FAILED", {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
        rpc: "signup_user_by_phone",
        payload: { name: profile.name, role: profile.role, region: profile.region,
                   phone: profile.phone, interestsLen: profile.interests?.length ?? 0 },
      });
      return setMsg(`❌ 저장 실패 [${error.code ?? "?"}] ${error.message ?? ""}`
        + `${error.details ? " · " + error.details : ""}${error.hint ? " · " + error.hint : ""}`);
    }
    onLogin(data ? { ...data, activeRole: "consumer" } : { ...profile, activeRole: "consumer" });
  };

  const handleBypassLogin = async () => {
    if (!SHOW_DEBUG_UI) return; // bypass 완전 차단 (production)
    const envCode = import.meta.env.VITE_ADMIN_CODE;
    if (!envCode || bypassCode !== envCode) {
      setBypassCodeError("코드가 올바르지 않습니다");
      return;
    }
    setShowBypassModal(false);
    setBypassCode("");
    setBypassCodeError("");
    setLoading(true);
    try {
      if (phone.replace(/\D/g, "").length >= 10) {
        const { data: existing } = await getUserByPhone(toE164(phone));
        if (existing) {
          setLoading(false);
          onLogin({ ...existing, role: pendingRole, activeRole: pendingRole });
          return;
        }
        const profile = {
          name: pendingRole === "company" ? "테스트업체" : "테스트의뢰인",
          role: pendingRole,
          region: "서울",
          phone: toE164(phone),
        };
        const { data } = await upsertUserByPhone(profile);
        onLogin(data ? { ...data, role: pendingRole, activeRole: pendingRole } : { ...profile, id: null, verified: true, activeRole: pendingRole });
      } else {
        onLogin({
          role:       pendingRole,
          activeRole: pendingRole,
          name:       pendingRole === "company" ? "테스트업체" : "테스트의뢰인",
          id:         null,
          phone:      "",
          verified:   true,
        });
      }
    } catch {
      onLogin({
        role:       pendingRole,
        activeRole: pendingRole,
        name:       pendingRole === "company" ? "테스트업체" : "테스트의뢰인",
        id:         null,
        phone:      "",
        verified:   true,
      });
    } finally {
      setLoading(false);
    }
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
              width: 80, height: 80, borderRadius: 26, margin: "0 auto 14px",
              background: C.surface,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 10px 30px ${C.brand}22`, border: `1px solid ${C.bgWarm}`,
            }}><LogoMark size={52} bare /></div>
            <div style={{ fontSize: 28, fontWeight: 800, color: C.brandD, letterSpacing: "-0.5px" }}>공간사이</div>
            <div style={{ fontSize: 12, color: C.text3, marginTop: 4, letterSpacing: "1px" }}>공간마켓</div>
            <div style={{ fontSize: 13, color: C.text3, marginTop: 8 }}>사람과 공간 사이, 믿을 수 있는 연결</div>
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
          <div style={{ textAlign: "center", marginTop: 32 }}>
            <div
              onClick={() => {
                if (!SHOW_DEBUG_UI) return;
                const next = step2TapCount + 1;
                setStep2TapCount(next);
                if (next >= 5) { setStep2TapCount(0); setShowBypassModal(true); }
              }}
              style={{ fontSize: 11, color: C.text4, cursor: "default", userSelect: "none" }}>
              공간마켓 v1.0.0
            </div>
          </div>
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
        <CompanyOnboarding phone={phone} onDone={u => onLogin({ ...u, role: "company", activeRole: "company" })} />
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
              <LogoMark size={28} />
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>공간사이 둘러보기</div>
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

            {/* 6. 공간마켓 라운지 소개 */}
            <div style={{ marginTop: 36 }}>
              <div style={{ fontSize: 13, color: C.brand, fontWeight: 700, marginBottom: 6 }}>공간마켓 라운지</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.text1, marginBottom: 6 }}>놀다가 거래되는 구조</div>
              <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.7, marginBottom: 20 }}>
                익명 커뮤니티에서 자유롭게 소통하다가<br/>자연스럽게 신뢰가 쌓이고, 거래로 이어져요.
              </div>

              {/* 흐름 */}
              <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: 16, border: `1px solid ${C.bgWarm}` }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.lg }}>라운지 → 신뢰 → 거래</div>
                {[
                  { icon: "💬", step: "라운지 입장",  desc: "익명으로 이웃과 자유롭게 소통" },
                  { icon: "🤝", step: "신뢰 형성",    desc: "인테리어 후기·질문·전문가 답변" },
                  { icon: "📩", step: "대화 연결",    desc: "관심 있는 상대와 1:1 대화 신청" },
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

              {/* 카테고리 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: S.sm }}>이런 이야기들이 오가요</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {["🏠 인테리어 후기","🔨 시공 전/후","💬 견적 질문","📈 부동산","🌿 자취·집꾸미기","😊 동네 일상","🍜 맛집","🏦 주식·경제","🐾 반려동물","🚗 차·오토바이"].map(tag => (
                    <span key={tag} style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.full, padding: "5px 12px", fontSize: 12, color: C.text2, fontWeight: 600 }}>{tag}</span>
                  ))}
                </div>
              </div>

              {/* 익명·토큰 안내 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 4 }}>
                {[
                  { icon: "🛡", title: "완전 익명", desc: "닉네임은 자동 배정 · 실명·연락처 절대 비공개" },
                  { icon: "💰", title: "공간토큰", desc: "가입만 해도 20 토큰 지급 · 대화 신청에 사용" },
                  { icon: "⭐", title: "전문가 답변", desc: "인증 업체가 직접 답변 · 배지로 구분" },
                ].map(({ icon, title, desc }) => (
                  <div key={title} style={{ background: C.surface, borderRadius: R.lg, padding: `${S.md}px ${S.lg}px`, border: `1px solid ${C.bgWarm}`, display: "flex", gap: S.md, alignItems: "center" }}>
                    <div style={{ width: 36, height: 36, borderRadius: R.full, background: C.brandL, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>{title}</div>
                      <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* 하단 CTA */}
          <div style={{ background: C.surface, borderTop: `1px solid ${C.bgWarm}`, padding: "12px 20px 24px", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setShowBrowse(false); chooseRole("consumer"); }}
                style={{ flex: 1, padding: "16px", background: `linear-gradient(135deg,${C.brand},${C.brandD})`, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: "pointer", boxShadow: `0 4px 16px ${C.brand}44` }}>
                🏡 의뢰인으로 시작
              </button>
              <button onClick={() => { setShowBrowse(false); chooseRole("company"); }}
                style={{ flex: 1, padding: "16px", background: C.surface, color: C.brand, border: `2px solid ${C.brandM}`, borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                🔨 업체로 시작
              </button>
            </div>
            <button onClick={() => { setShowBrowse(false); onLogin({ id: null, role: "consumer", name: "게스트", region: "", isGuest: true, startAt: "lounge" }); }}
              style={{ width: "100%", padding: "14px", background: C.surface, color: C.text2, border: `2px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
              💬 라운지 둘러보기
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

      {/* Bypass modal (step 2) — DEV only, never shown in production */}
      {SHOW_DEBUG_UI && showBypassModal && step === 2 && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
          <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xxl, width: "100%", maxWidth: 340 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, marginBottom: 6 }}>
              {pendingRole === "company" ? "업체" : "의뢰인"} 빠른 진입
            </div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: S.xl }}>코드를 입력하면 SMS 없이 진입합니다</div>
            <input
              value={bypassCode}
              onChange={e => { setBypassCode(e.target.value); setBypassCodeError(""); }}
              type="password"
              placeholder="코드 입력"
              style={{ ...iS, textAlign: "center", letterSpacing: 4, fontSize: 18 }}
            />
            {bypassCodeError && <div style={{ color: C.red, fontSize: 12, fontWeight: 600, marginBottom: S.sm }}>{bypassCodeError}</div>}
            <div style={{ display: "flex", gap: S.sm }}>
              <button onClick={() => { setShowBypassModal(false); setBypassCode(""); setBypassCodeError(""); }}
                style={{ flex: 1, padding: S.lg, background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                취소
              </button>
              <button onClick={handleBypassLogin}
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
