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
                <div style={{ fontSize: 13, opacity: 0.8 }}>집수리·인테리어·리모델링 업체를 찾고 있어요</div>
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

            {/* ═══ 1. HERO — 신뢰거래 플랫폼 소개 ═══ */}
            <div style={{
              position: "relative", borderRadius: R.xl, overflow: "hidden", marginBottom: 28,
              backgroundImage: `linear-gradient(135deg, rgba(29,61,47,0.94) 0%, rgba(46,95,75,0.80) 44%, rgba(46,95,75,0.34) 100%), url('/images/landing-hero-interior.jpg')`,
              backgroundSize: "cover", backgroundPosition: "center",
            }}>
              <div style={{ padding: "30px 22px 26px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#fff", opacity: 0.85, marginBottom: 10, letterSpacing: "0.02em" }}>
                  공간마켓 신뢰거래 플랫폼
                </div>
                <div style={{ fontSize: 23, fontWeight: 900, color: "#fff", lineHeight: 1.35, marginBottom: 18, letterSpacing: "-0.3px" }}>
                  공간마켓,<br/>안전한 인테리어 거래의 시작
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                  {[
                    { icon: "🏅", t: "승인 업체만 활동" },
                    { icon: "🔒", t: "에스크로 안전결제" },
                    { icon: "📍", t: "GPS 현장인증" },
                    { icon: "📋", t: "프로젝트 증빙관리" },
                  ].map(({ icon, t }) => (
                    <div key={t} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.42)",
                      borderRadius: R.lg, padding: "10px 11px",
                    }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: "#fff", letterSpacing: "-0.2px", lineHeight: 1.2 }}>{t}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.6 }}>
                  네 가지 안전장치 기반의 신뢰거래 플랫폼이에요.
                </div>
              </div>
            </div>

            {/* ═══ 2. 공간마켓이 지키는 기준 (4 카드) ═══ */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, color: C.brand, fontWeight: 700, marginBottom: 6 }}>공간마켓이 지키는 기준</div>
              <div style={{ fontSize: 19, fontWeight: 900, color: C.text1, marginBottom: 14 }}>실제 구조로 안전을 지켜요</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { icon: "🏅", title: "승인 업체만 활동",   desc: "서류·보험 검증을 통과한 업체만 활동해요" },
                  { icon: "🔒", title: "에스크로 안전보관", desc: "공사비는 단계 확인 전까지 안전하게 보관" },
                  { icon: "📍", title: "GPS 현장기록",     desc: "현장방문·시공 단계마다 위치를 인증해요" },
                  { icon: "📋", title: "프로젝트 증빙보관", desc: "사진·계약·대화 전 과정을 기록·보관해요" },
                ].map(({ icon, title, desc }) => (
                  <div key={title} style={{ background: C.surface, borderRadius: R.lg, padding: S.xl, border: `1px solid ${C.bgWarm}` }}>
                    <div style={{ width: 40, height: 40, borderRadius: R.md, background: C.brandL, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 10 }}>{icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.55 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ 3. 인테리어 진행 과정 (가장 강조) ═══ */}
            <div style={{ background: C.brandL, borderRadius: R.xl, padding: "22px 18px", marginBottom: 28, border: `1px solid ${C.brandM}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontSize: 13, color: C.brandD, fontWeight: 700 }}>인테리어 진행 과정</div>
                <div style={{ fontSize: 11, color: C.brand, fontWeight: 700, opacity: 0.85 }}>옆으로 넘겨보세요 ›</div>
              </div>
              <div style={{ fontSize: 19, fontWeight: 900, color: C.text1, marginBottom: 16 }}>견적부터 리뷰까지, 전 과정 한 흐름으로</div>
              <div style={{ display: "flex", alignItems: "stretch", gap: 6, overflowX: "auto", paddingBottom: 8, WebkitOverflowScrolling: "touch" }}>
                {[
                  { n: 1, icon: "📝", label: "견적요청" },
                  { n: 2, icon: "🚪", label: "현장방문" },
                  { n: 3, icon: "📄", label: "최종견적" },
                  { n: 4, icon: "🤝", label: "계약" },
                  { n: 5, icon: "🔒", label: "에스크로" },
                  { n: 6, icon: "🏗", label: "착공" },
                  { n: 7, icon: "🔍", label: "중간점검" },
                  { n: 8, icon: "🎉", label: "완료" },
                  { n: 9, icon: "⭐", label: "리뷰" },
                ].map(({ n, icon, label }, i, arr) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                    <div style={{ width: 72, background: C.surface, borderRadius: R.lg, border: `1px solid ${C.brandM}`, padding: "10px 6px 12px", textAlign: "center", position: "relative" }}>
                      <div style={{ position: "absolute", top: 6, left: 6, width: 16, height: 16, borderRadius: R.full, background: C.brand, color: "#fff", fontSize: 9.5, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</div>
                      <div style={{ fontSize: 22, margin: "4px 0 6px" }}>{icon}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: C.text1, lineHeight: 1.3, whiteSpace: "nowrap" }}>{label}</div>
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{ color: C.brand, fontSize: 16, fontWeight: 900, padding: "0 2px" }}>›</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ 4. 공간보증 배지 ═══ */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, color: C.brand, fontWeight: 700, marginBottom: 6 }}>공간보증 배지</div>
              <div style={{ fontSize: 19, fontWeight: 900, color: C.text1, marginBottom: 4 }}>신뢰를 증명하는 인증 배지</div>
              <div style={{ fontSize: 12.5, color: C.text3, lineHeight: 1.6, marginBottom: 14 }}>
                공간보증 예치보증금으로 신뢰를 증명하는 인증 배지예요.
              </div>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch" }}>
                {Object.entries(BADGES).map(([key, b]) => (
                  <div key={key} style={{ flexShrink: 0, width: 104, background: C.surface, borderRadius: R.lg, border: `1px solid ${C.bgWarm}`, padding: "16px 10px", textAlign: "center" }}>
                    <div style={{ width: 44, height: 44, borderRadius: R.full, background: b.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 10px" }}>{b.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: b.color, marginBottom: 4 }}>{b.label}</div>
                    <div style={{ fontSize: 10.5, color: C.text3 }}>최대 {b.maxJob}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ 5. 공간보증 인증업체 (가로 카드) ═══ */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, color: C.brand, fontWeight: 700, marginBottom: 6 }}>공간보증 인증업체</div>
              <div style={{ fontSize: 19, fontWeight: 900, color: C.text1, marginBottom: 14 }}>인증 업체를 만나보세요</div>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch" }}>
                {[
                  { photo: "🏠", name: "홍익시공",    badge: "premium",  region: "서울 마포",  spec: "아파트 전체", temp: 97 },
                  { photo: "🛋", name: "공간설계소",  badge: "standard", region: "서울 서대문", spec: "거실·주방",   temp: 91 },
                  { photo: "🚿", name: "우리집시공단", badge: "basic",    region: "경기 성남",  spec: "욕실 시공",   temp: 86 },
                  { photo: "🏢", name: "더공간",      badge: "enterprise", region: "서울 강남", spec: "상업 인테리어", temp: 95 },
                ].map(c => {
                  const b = BADGES[c.badge] ?? BADGES.basic;
                  return (
                    <div key={c.name} style={{ flexShrink: 0, width: 172, background: C.surface, borderRadius: R.xl, border: `1px solid ${C.bgWarm}`, overflow: "hidden", boxShadow: "0 2px 10px rgba(28,23,18,0.06)" }}>
                      <div style={{ height: 124, background: `linear-gradient(135deg, ${C.brandL} 0%, ${C.surface2} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, position: "relative" }}>
                        {c.photo}
                        <span style={{ position: "absolute", top: 10, left: 10, background: b.bg, color: b.color, borderRadius: R.full, padding: "3px 10px", fontSize: 10.5, fontWeight: 800, boxShadow: "0 1px 4px rgba(28,23,18,0.12)" }}>{b.label}</span>
                        <span style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.92)", color: c.temp >= 90 ? C.brand : C.gold, borderRadius: R.full, padding: "3px 9px", fontSize: 12, fontWeight: 900, boxShadow: "0 1px 4px rgba(28,23,18,0.12)" }}>{c.temp}°</span>
                      </div>
                      <div style={{ padding: "13px 13px 15px" }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 4 }}>{c.name}</div>
                        <div style={{ fontSize: 11.5, color: C.text3, marginBottom: 9 }}>📍 {c.region}</div>
                        <span style={{ display: "inline-block", background: C.surface2, color: C.text2, borderRadius: R.full, padding: "4px 11px", fontSize: 11, fontWeight: 600, border: `1px solid ${C.bgWarm}` }}>{c.spec}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ═══ 6. 실제 고객 후기 ═══ */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, color: C.brand, fontWeight: 700, marginBottom: 6 }}>실제 고객 후기</div>
              <div style={{ fontSize: 19, fontWeight: 900, color: C.text1, marginBottom: 14 }}>완료 고객의 후기를 확인하세요</div>
              {[
                { photo: "🏠", stars: 5, text: "에스크로 덕분에 걱정 없이 진행했어요. 마감도 깔끔하고 일정도 정확히 지켜줬어요.", co: "홍익시공",    type: "아파트 전체" },
                { photo: "🛋", stars: 5, text: "중간보고를 꼼꼼히 해줘서 신뢰가 갔어요. 단계별로 확인하니 안심이 됐어요.",   co: "공간설계소",  type: "거실·주방" },
                { photo: "🚿", stars: 4, text: "욕실 시공 퀄리티 정말 만족해요. 추가금 없이 견적 그대로 완료했어요!",       co: "우리집시공단", type: "욕실 시공" },
              ].map((r, i) => (
                <div key={i} style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.sm, border: `1px solid ${C.bgWarm}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: S.sm, alignItems: "center" }}>
                      <div style={{ width: 40, height: 40, borderRadius: R.md, background: C.brandL, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{r.photo}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>{r.co}</div>
                        <div style={{ fontSize: 11, color: C.text3 }}>{r.type}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: C.gold, letterSpacing: 1 }}>{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</div>
                  </div>
                  <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>"{r.text}"</div>
                </div>
              ))}
            </div>

            {/* ═══ 7. 에스크로 안전정산 (단계형) ═══ */}
            <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: 28, border: `1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize: 13, color: C.brand, fontWeight: 700, marginBottom: 6 }}>에스크로 안전정산</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: C.text1, marginBottom: 16 }}>공사비는 공간마켓이 보관해요</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {[
                  { icon: "📝", step: "계약" },
                  { icon: "🛠", step: "단계승인" },
                  { icon: "💰", step: "안전정산" },
                  { icon: "🎉", step: "공사완료" },
                ].map(({ icon, step }, i, arr) => (
                  <div key={step} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ width: 44, height: 44, borderRadius: R.full, background: C.brandL, border: `1.5px solid ${C.brandM}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, margin: "0 auto 8px" }}>{icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.text1 }}>{step}</div>
                    </div>
                    {i < arr.length - 1 && <div style={{ color: C.brandM, fontSize: 16, fontWeight: 900, flexShrink: 0 }}>›</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* ═══ 8. 공간마켓 라운지 (보조 서비스 · 축소) ═══ */}
            <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>💬</span>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>공간마켓 라운지</div>
                <span style={{ background: C.surface2, color: C.text3, borderRadius: R.full, padding: "2px 9px", fontSize: 10.5, fontWeight: 700, border: `1px solid ${C.bgWarm}` }}>보조 서비스</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["후기 공유", "질문하기", "전문가 답변", "대화 연결"].map(t => (
                  <span key={t} style={{ background: C.brandL, color: C.brandD, borderRadius: R.full, padding: "6px 13px", fontSize: 12, fontWeight: 700 }}>{t}</span>
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
