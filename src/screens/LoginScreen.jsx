import { useState } from "react";
import { C, R, S, SPECIALTIES, CITY_DISTRICTS, fmtPhone } from "../constants";
import CompanyOnboarding from "./CompanyOnboarding";
import { upsertUserByPhone } from "../lib/supabase";

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

export default function LoginScreen({ onLogin, startAtOnboarding }) {
  const [step, setStep] = useState(startAtOnboarding ? 3 : 1);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Onboarding state — role chosen after phone verify
  const [role, setRole] = useState(startAtOnboarding ? "company" : null);
  const [consumerStep, setConsumerStep] = useState(0); // 0=role, 1=name, 2=region, 3=services
  const [name, setName] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);

  const iS = {
    width: "100%", padding: "14px 16px", border: `1.5px solid ${C.bgWarm}`,
    borderRadius: R.md, fontSize: 15, outline: "none", boxSizing: "border-box",
    marginBottom: 14, fontFamily: "inherit", color: C.text1, background: C.surface,
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

      if (data.user) {
        if (startAtOnboarding && data.user.role !== "company") {
          setStep(4); setMsg("");
        } else {
          onLogin(data.user);
        }
      } else {
        setStep(4); setMsg("");
      }
    } catch (err) {
      setMsg("❌ " + err.message);
    } finally {
      setLoading(false);
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

      {/* ── Step 1: Landing ── */}
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
            <button onClick={() => setStep(2)}
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
              }}>📱</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>전화번호로 시작하기</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>고객 · 업체 모두 이용 가능</div>
              </div>
              <div style={{ marginLeft: "auto", fontSize: 20, opacity: 0.8 }}>›</div>
            </button>

            <button
              onClick={() => onLogin({ name: "둘러보기", role: "company", region: "마포구", phone: "", isGuest: true })}
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
                <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: 2 }}>업체로 둘러보기</div>
                <div style={{ fontSize: 13, color: C.text3 }}>일감 먼저 확인해보세요</div>
              </div>
              <div style={{ marginLeft: "auto", color: C.brand, fontSize: 20 }}>›</div>
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Auth method ── */}
      {step === 2 && (
        <div style={{ width: "100%", maxWidth: 390 }}>
          <button onClick={() => setStep(1)}
            style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: C.text3, marginBottom: 24, fontWeight: 600 }}>
            ← 뒤로
          </button>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text1, marginBottom: 4 }}>로그인 / 회원가입</div>
          <div style={{ fontSize: 13, color: C.text3, marginBottom: S.xxl }}>원하는 방식으로 시작하세요</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={() => setStep(3)}
              style={{ background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, padding: "16px 20px", fontWeight: 800, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ fontSize: 22 }}>📱</span>
              <div style={{ textAlign: "left" }}>
                <div>전화번호로 시작</div>
                <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 500, marginTop: 1 }}>문자 인증 · 가장 빠른 방법</div>
              </div>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
              <div style={{ flex: 1, height: 1, background: C.bgWarm }} />
              <div style={{ fontSize: 12, color: C.text4 }}>소셜 계정</div>
              <div style={{ flex: 1, height: 1, background: C.bgWarm }} />
            </div>
            {[
              { bg: "#FEE500", color: "#191919", icon: "💬", t: "카카오로 시작하기" },
              { bg: "#03C75A", color: "#fff",    icon: "N",  t: "네이버로 시작하기" },
            ].map(b => (
              <button key={b.t} onClick={() => setStep(3)}
                style={{ background: b.bg, color: b.color, border: "none", borderRadius: R.lg, padding: "15px 20px", fontWeight: 800, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: b.icon === "N" ? 15 : 22, background: b.icon === "N" ? b.color : "transparent", color: b.icon === "N" ? b.bg : "inherit", borderRadius: 4, padding: b.icon === "N" ? "1px 5px" : "0", fontWeight: 900 }}>{b.icon}</span>
                {b.t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 3: Phone verification ── */}
      {step === 3 && (
        <div style={{ width: "100%", maxWidth: 390 }}>
          <button onClick={() => { setStep(2); setCodeSent(false); setCode(""); setMsg(""); }}
            style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: C.text3, marginBottom: 24, fontWeight: 600 }}>
            ← 뒤로
          </button>
          <div style={{ fontSize: 20, fontWeight: 800, color: C.text1, marginBottom: 4 }}>전화번호 인증</div>
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

      {/* ── Step 4: Onboarding (no existing profile) ── */}

      {/* 4-0: Role selection */}
      {step === 4 && !role && (
        <div style={{ width: "100%", maxWidth: 390 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: C.text1, marginBottom: 6 }}>어떻게 이용하실 건가요?</div>
            <div style={{ fontSize: 14, color: C.text3 }}>역할에 맞는 서비스를 제공해드릴게요</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button
              onClick={() => { setRole("consumer"); setConsumerStep(1); }}
              style={{
                background: C.surface, border: `2px solid ${C.bgWarm}`, borderRadius: R.xl,
                padding: "22px 20px", display: "flex", alignItems: "center", gap: 16,
                cursor: "pointer", boxShadow: "0 2px 12px rgba(28,23,18,0.08)", textAlign: "left",
              }}>
              <div style={{
                width: 56, height: 56, borderRadius: R.xl, flexShrink: 0,
                background: C.brandL, border: `2px solid ${C.brandM}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
              }}>🏡</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.text1, marginBottom: 3 }}>고객으로 시작</div>
                <div style={{ fontSize: 13, color: C.text3 }}>인테리어 · 시공 업체를 찾고 있어요</div>
              </div>
              <div style={{ color: C.brand, fontSize: 22 }}>›</div>
            </button>

            <button
              onClick={() => setRole("company")}
              style={{
                background: C.surface, border: `2px solid ${C.bgWarm}`, borderRadius: R.xl,
                padding: "22px 20px", display: "flex", alignItems: "center", gap: 16,
                cursor: "pointer", boxShadow: "0 2px 12px rgba(28,23,18,0.08)", textAlign: "left",
              }}>
              <div style={{
                width: 56, height: 56, borderRadius: R.xl, flexShrink: 0,
                background: C.surface2, border: `2px solid ${C.bgWarm}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
              }}>🔨</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.text1, marginBottom: 3 }}>업체로 시작</div>
                <div style={{ fontSize: 13, color: C.text3 }}>견적 의뢰를 받고 일감을 늘려요</div>
              </div>
              <div style={{ color: C.brand, fontSize: 22 }}>›</div>
            </button>
          </div>
        </div>
      )}

      {/* 4-1: Consumer — Name */}
      {step === 4 && role === "consumer" && consumerStep === 1 && (
        <div style={{ width: "100%", maxWidth: 390 }}>
          {progressBar(1, 3)}
          <div style={{ fontSize: 22, fontWeight: 900, color: C.text1, marginBottom: 6 }}>이름이 어떻게 되세요?</div>
          <div style={{ fontSize: 14, color: C.text3, marginBottom: S.xxl }}>견적 요청 시 업체에게 표시됩니다</div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="홍길동"
            style={{ ...iS, fontSize: 18, fontWeight: 700 }}
            autoFocus
          />
          {msg && (
            <div style={{ padding: "12px 16px", borderRadius: R.md, marginBottom: 14, background: "#FFF0F0", color: C.red, fontSize: 13, fontWeight: 600 }}>
              {msg}
            </div>
          )}
          <button
            onClick={() => { if (!name.trim()) return setMsg("이름을 입력해주세요"); setMsg(""); setConsumerStep(2); }}
            style={{ width: "100%", padding: S.xl, background: C.brand, color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 16, cursor: "pointer", boxShadow: `0 6px 20px ${C.brand}44` }}>
            다음 →
          </button>
        </div>
      )}

      {/* 4-2: Consumer — Region (city → district 2 levels) */}
      {step === 4 && role === "consumer" && consumerStep === 2 && (
        <div style={{ width: "100%", maxWidth: 390 }}>
          {progressBar(2, 3)}
          {!selectedCity ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.text1, marginBottom: 6 }}>어느 지역에 계세요?</div>
              <div style={{ fontSize: 14, color: C.text3, marginBottom: S.xxl }}>시 / 도를 선택해주세요</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: S.sm }}>
                {Object.keys(CITY_DISTRICTS).map(city => (
                  <button key={city}
                    onClick={() => setSelectedCity(city)}
                    style={{
                      padding: "16px", background: C.surface, border: `1.5px solid ${C.bgWarm}`,
                      borderRadius: R.lg, fontSize: 15, fontWeight: 700, color: C.text1,
                      cursor: "pointer", textAlign: "center",
                      boxShadow: "0 2px 8px rgba(28,23,18,0.06)",
                    }}>
                    {city}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setConsumerStep(1); setSelectedCity(""); setSelectedDistrict(""); }}
                style={{ background: "none", border: "none", fontSize: 14, color: C.text3, cursor: "pointer", marginTop: S.xl, fontWeight: 600 }}>
                ← 뒤로
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setSelectedCity(""); setSelectedDistrict(""); }}
                style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", color: C.text3, marginBottom: 12, fontWeight: 600 }}>
                ← {selectedCity}
              </button>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.text1, marginBottom: 6 }}>구 / 시를 선택해주세요</div>
              <div style={{ fontSize: 14, color: C.brand, fontWeight: 700, marginBottom: S.xl }}>📍 {selectedCity}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: S.sm, maxHeight: "55vh", overflowY: "auto" }}>
                {CITY_DISTRICTS[selectedCity].map(district => (
                  <button key={district}
                    onClick={() => { setSelectedDistrict(district); setConsumerStep(3); }}
                    style={{
                      padding: "14px", background: C.surface, border: `1.5px solid ${C.bgWarm}`,
                      borderRadius: R.lg, fontSize: 14, fontWeight: 700, color: C.text1,
                      cursor: "pointer", textAlign: "center",
                      boxShadow: "0 2px 8px rgba(28,23,18,0.06)",
                    }}>
                    {district}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 4-3: Consumer — Interest services multi-select */}
      {step === 4 && role === "consumer" && consumerStep === 3 && (
        <div style={{ width: "100%", maxWidth: 390 }}>
          {progressBar(3, 3)}
          <div style={{ fontSize: 22, fontWeight: 900, color: C.text1, marginBottom: 6 }}>관심 서비스를 선택해주세요</div>
          <div style={{ fontSize: 14, color: C.text3, marginBottom: S.xl }}>
            📍 {selectedCity} {selectedDistrict} · 복수 선택 가능
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: S.sm, marginBottom: S.xl }}>
            {SPECIALTIES.map(s => {
              const active = selectedServices.includes(s);
              return (
                <button key={s}
                  onClick={() => toggleService(s)}
                  style={{
                    padding: "14px 12px", borderRadius: R.lg, fontSize: 14, fontWeight: 700,
                    border: `2px solid ${active ? C.brand : C.bgWarm}`,
                    background: active ? C.brandL : C.surface,
                    color: active ? C.brand : C.text2,
                    cursor: "pointer", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 8,
                    boxShadow: active ? `0 0 0 1px ${C.brand}33` : "none",
                    transition: "all 0.15s",
                  }}>
                  <span style={{ fontSize: 18 }}>{SERVICE_ICONS[s] ?? "🔧"}</span>
                  <span>{s}</span>
                </button>
              );
            })}
          </div>
          {msg && (
            <div style={{ padding: "12px 16px", borderRadius: R.md, marginBottom: 14, background: "#FFF0F0", color: C.red, fontSize: 13, fontWeight: 600 }}>
              {msg}
            </div>
          )}
          <button
            onClick={saveConsumer}
            disabled={loading}
            style={{
              width: "100%", padding: S.xl, background: C.brand, color: "#fff", border: "none",
              borderRadius: R.lg, fontWeight: 800, fontSize: 16, cursor: "pointer",
              boxShadow: `0 6px 20px ${C.brand}44`, opacity: loading ? 0.7 : 1,
            }}>
            {loading ? "저장 중..." : `공간마켓 시작하기 🚀${selectedServices.length > 0 ? ` (${selectedServices.length}개 선택)` : ""}`}
          </button>
          <button
            onClick={() => { setConsumerStep(2); setSelectedDistrict(""); }}
            style={{ background: "none", border: "none", fontSize: 14, color: C.text3, cursor: "pointer", marginTop: S.md, fontWeight: 600, width: "100%" }}>
            ← 지역 다시 선택
          </button>
        </div>
      )}

      {/* 4-company: Company onboarding (existing flow) */}
      {step === 4 && role === "company" && (
        <CompanyOnboarding phone={phone} onDone={u => onLogin(u)} />
      )}
    </div>
  );
}
