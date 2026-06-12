import { useState, useEffect, useRef } from "react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const NAVY  = "#0B1D3A";
const NAVY2 = "#132848";
const NAVY3 = "#1C3A60";
const GOLD  = "#C9A84C";
const GOLDD = "#A8813A";
const GOLDB = "rgba(201,168,76,0.12)";
const WHITE = "#FFFFFF";
const OFF   = "#F4F6F9";
const TEXT2 = "#4B5E78";
const TEXT3 = "#7A8EA8";
const SANS  = "'Pretendard','Apple SD Gothic Neo',sans-serif";

// ── Scroll-triggered fade ──────────────────────────────────────────────────────
function useVisible(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

const fade = (v, delay = 0) => ({
  opacity: v ? 1 : 0,
  transform: v ? "translateY(0)" : "translateY(22px)",
  transition: `opacity 0.45s ease-out ${delay}s, transform 0.45s ease-out ${delay}s`,
});

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ children, bg = OFF, py = 56 }) {
  const [ref, vis] = useVisible();
  return (
    <div ref={ref} style={{ background: bg, padding: `${py}px 20px`, fontFamily: SANS }}>
      <div style={{ maxWidth: 520, margin: "0 auto", ...fade(vis) }}>
        {children}
      </div>
    </div>
  );
}

function SectionTitle({ label, sub }) {
  return (
    <div style={{ marginBottom: 28, textAlign: "center" }}>
      {label && (
        <div style={{
          display: "inline-block", background: GOLDB, color: GOLD,
          fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
          padding: "4px 12px", borderRadius: 99, marginBottom: 10,
        }}>
          {label}
        </div>
      )}
      {sub && (
        <div style={{ fontSize: 20, fontWeight: 900, color: NAVY, lineHeight: 1.4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Grade data ─────────────────────────────────────────────────────────────────
const GRADES = [
  { name: "베이직",      deposit: "50만 원",    limit: "500만 원까지",   color: "#8B9BAD" },
  { name: "스탠다드",    deposit: "100만 원",   limit: "1,000만 원까지", color: "#4A90D9" },
  { name: "프리미엄",    deposit: "200만 원",   limit: "2,000만 원까지", color: GOLD },
  { name: "엔터프라이즈",deposit: "500만 원",   limit: "5,000만 원까지", color: "#7B5EA7" },
  { name: "시그니처",    deposit: "1,000만 원", limit: "1억 원까지",     color: NAVY3 },
];

// ── Trust items ────────────────────────────────────────────────────────────────
const TRUST = [
  { icon: "🔐", title: "에스크로 기반 거래",      desc: "공사비가 단계 확인 전 자동 지급되지 않습니다" },
  { icon: "📋", title: "계약 내용 전자 기록",      desc: "계약 범위·대화·사진 모두 플랫폼에 저장됩니다" },
  { icon: "🛡️", title: "보증금 기반 신뢰 시스템", desc: "예치 보증금이 업체 신뢰도를 수치로 증명합니다" },
  { icon: "✅", title: "서류·보험 검증 완료 업체", desc: "사업자 서류, 보험, 시공 이력 확인 업체만 입점" },
  { icon: "👤", title: "검증된 의뢰인만 연결",     desc: "에스크로 예치를 완료한 실 발주 고객만 연결됩니다" },
  { icon: "⚖️", title: "분쟁 시 관리자 동행",      desc: "분쟁 발생 시 담당 운영자가 조율·중재합니다" },
];

// ── Onboarding steps ───────────────────────────────────────────────────────────
const ONBOARDING = [
  { num: 1, title: "파트너 상담 신청",      desc: "아래 양식으로 신청하시면 1~2 영업일 내 연락드립니다" },
  { num: 2, title: "서류 검토 및 가입 승인", desc: "사업자·보험·이력 서류 확인 후 계정이 활성화됩니다" },
  { num: 3, title: "보증금 예치 등급 설정",  desc: "예치 금액에 따라 수주 가능 금액 한도가 결정됩니다" },
  { num: 4, title: "프로필·포트폴리오 작성", desc: "시공 사례, 전문 분야, 자격 정보를 등록합니다" },
  { num: 5, title: "견적 요청 수신",         desc: "플랫폼이 검증된 의뢰인의 요청을 자동으로 전달합니다" },
  { num: 6, title: "수주 완료 및 정산",      desc: "단계별 사진 확인 후 정산 — 4.4% 수수료만 부담" },
];

// ── Partner types ──────────────────────────────────────────────────────────────
const PARTNER_TYPES = [
  "인테리어·리모델링 업체",
  "인테리어 디자인·설계 사무소",
  "가구·마루·창호 시공 업체",
  "도배·도장·전기·설비 전문 업체",
  "상업 공간 전문 시공팀",
  "건물 유지보수·소규모 공사팀",
];

// ── Consultation form ──────────────────────────────────────────────────────────
const EMPTY_FORM = { name: "", phone: "", company: "", type: "", message: "" };

function ConsultForm() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      alert("담당자명과 연락처는 필수입니다.");
      return;
    }
    console.log("[PartnerLanding] 파트너 상담 신청:", form);
    setSubmitted(true);
  };

  const inputStyle = {
    width: "100%", height: 48, borderRadius: 10,
    border: `1.5px solid #DDE3EC`,
    padding: "0 14px", fontSize: 15, fontFamily: SANS,
    background: WHITE, color: NAVY, outline: "none",
    boxSizing: "border-box",
  };

  if (submitted) {
    return (
      <div style={{
        background: GOLDB, border: `1.5px solid ${GOLD}`, borderRadius: 14,
        padding: "28px 20px", textAlign: "center",
      }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>✅</div>
        <div style={{ fontSize: 17, fontWeight: 900, color: NAVY, marginBottom: 8 }}>
          상담 신청이 접수되었습니다
        </div>
        <div style={{ fontSize: 14, color: TEXT2, lineHeight: 1.6 }}>
          영업일 기준 1~2일 내 담당자가 연락드립니다.<br />
          감사합니다!
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input style={inputStyle} placeholder="담당자명 *" value={form.name} onChange={set("name")} />
      <input style={inputStyle} placeholder="연락처 (휴대폰) *" value={form.phone} onChange={set("phone")} inputMode="tel" />
      <input style={inputStyle} placeholder="업체명" value={form.company} onChange={set("company")} />
      <input style={inputStyle} placeholder="주요 업종 (예: 인테리어, 도배, 전기)" value={form.type} onChange={set("type")} />
      <textarea
        style={{ ...inputStyle, height: 100, padding: "12px 14px", resize: "none" }}
        placeholder="문의 내용 (선택)"
        value={form.message}
        onChange={set("message")}
      />
      <button
        type="submit"
        style={{
          height: 52, borderRadius: 12, border: "none", cursor: "pointer",
          background: GOLD, color: WHITE, fontSize: 16, fontWeight: 900,
          fontFamily: SANS, letterSpacing: "-0.2px",
          boxShadow: `0 6px 20px rgba(201,168,76,0.35)`,
        }}>
        파트너 상담 신청하기
      </button>
    </form>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PartnerLandingScreen() {
  const [heroRef, heroVis] = useVisible(0.05);

  const scrollToForm = () => {
    const el = document.getElementById("partner-consult-form");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div style={{ fontFamily: SANS, background: OFF, minHeight: "100vh" }}>

      {/* ── HERO ───────────────────────────────────────────────────── */}
      <div style={{
        background: `linear-gradient(160deg, ${NAVY} 0%, ${NAVY3} 100%)`,
        padding: "64px 24px 56px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Decorative circles */}
        <div style={{
          position: "absolute", top: -60, right: -60,
          width: 220, height: 220, borderRadius: "50%",
          background: "rgba(201,168,76,0.08)", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: -40, left: -40,
          width: 160, height: 160, borderRadius: "50%",
          background: "rgba(201,168,76,0.06)", pointerEvents: "none",
        }} />

        <div ref={heroRef} style={{ maxWidth: 520, margin: "0 auto", position: "relative" }}>
          {/* Brand tag */}
          <div style={{ ...fade(heroVis, 0), marginBottom: 20 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 99, padding: "5px 14px",
            }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
                공간마켓 파트너 프로그램
              </span>
            </div>
          </div>

          {/* Headline */}
          <div style={{ ...fade(heroVis, 0.07) }}>
            <h1 style={{
              margin: "0 0 18px", fontSize: 28, fontWeight: 900,
              color: WHITE, lineHeight: 1.35, letterSpacing: "-0.5px",
            }}>
              광고비 없이<br />
              <span style={{ color: GOLD }}>수주하는 공간파트너</span>
            </h1>
            <p style={{ margin: "0 0 28px", fontSize: 15, color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>
              검증된 의뢰인이 먼저 예치하고 연결됩니다.<br />
              광고비·중개비·플랫폼 수수료 걱정 없이<br />
              시공에만 집중하세요.
            </p>
          </div>

          {/* 4무 badges */}
          <div style={{ ...fade(heroVis, 0.14), display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 32 }}>
            {["광고비 무료", "초기 비용 無", "허위 의뢰 無", "플랫폼 수수료 無"].map((t) => (
              <div key={t} style={{
                background: GOLDB, border: `1px solid ${GOLD}`,
                borderRadius: 99, padding: "5px 14px",
                fontSize: 12, fontWeight: 700, color: GOLD, letterSpacing: "0.02em",
              }}>
                {t}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ ...fade(heroVis, 0.2), display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={scrollToForm}
              style={{
                height: 54, borderRadius: 12, border: "none", cursor: "pointer",
                background: GOLD, color: WHITE, fontSize: 16, fontWeight: 900,
                fontFamily: SANS, boxShadow: `0 8px 28px rgba(201,168,76,0.45)`,
              }}>
              파트너 상담 신청하기
            </button>
            <button
              onClick={() => { window.location.href = "/"; }}
              style={{
                height: 44, borderRadius: 12, cursor: "pointer", fontFamily: SANS,
                background: "transparent", border: "1px solid rgba(255,255,255,0.25)",
                color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 600,
              }}>
              ← 공간마켓 홈으로
            </button>
          </div>
        </div>
      </div>

      {/* ── WHY: 업체의 고민 ──────────────────────────────────────── */}
      <Section bg={WHITE}>
        <SectionTitle label="업체 대표님의 고민" sub={"광고비는 쓰는데\n진짜 고객이 안 옵니다"} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { icon: "😤", text: "광고비 수백만 원 써도 허위 견적·바람맞는 경우 허다" },
            { icon: "💸", text: "플랫폼 수수료·월정액·광고비 3중 부담" },
            { icon: "📵", text: "고객 연락처 노출 없이 견적만 받고 종적 감추는 경우" },
            { icon: "⚔️", text: "공사 완료 후 억지 분쟁으로 정산 거부하는 사례" },
          ].map(({ icon, text }) => (
            <div key={text} style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              background: OFF, borderRadius: 12, padding: "14px 16px",
            }}>
              <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{icon}</span>
              <span style={{ fontSize: 14, color: TEXT2, lineHeight: 1.55, fontWeight: 500 }}>{text}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── WHY: 공간마켓 파트너의 차이 ─────────────────────────── */}
      <Section bg={OFF}>
        <SectionTitle label="공간마켓 파트너" sub="이 모든 문제를 구조로 해결합니다" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { icon: "🔒", title: "에스크로 선예치",    desc: "의뢰인이 먼저 공사비를 예치한 뒤 연결됩니다" },
            { icon: "💰", title: "단계별 정산",         desc: "착공·중간·완료 각 단계마다 안전하게 정산" },
            { icon: "📸", title: "시공 기록 보호",      desc: "사진·기록이 분쟁 시 증거가 됩니다" },
            { icon: "📣", title: "광고비 Zero",         desc: "별도 광고비·월정액 없이 수주 가능" },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{
              background: WHITE, borderRadius: 14, padding: "18px 14px",
              boxShadow: "0 2px 12px rgba(11,29,58,0.06)",
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 12, color: TEXT3, lineHeight: 1.55 }}>{desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── TRUST SYSTEM ─────────────────────────────────────────── */}
      <Section bg={WHITE}>
        <SectionTitle label="신뢰 시스템" sub="6가지로 구성된 안심 거래 구조" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {TRUST.map(({ icon, title, desc }) => (
            <div key={title} style={{
              display: "flex", alignItems: "flex-start", gap: 14,
              border: `1px solid #E4EAF3`, borderRadius: 12, padding: "16px 14px", background: OFF,
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 13, color: TEXT3, lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── DEPOSIT GRADES ───────────────────────────────────────── */}
      <Section bg={`linear-gradient(160deg, ${NAVY} 0%, ${NAVY3} 100%)`}>
        <SectionTitle
          label="공간뱃지예치보증금 등급"
          sub={<span style={{ color: WHITE }}>예치 금액이 신뢰도를 증명합니다</span>}
        />
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", textAlign: "center", marginTop: -14, marginBottom: 20, lineHeight: 1.6 }}>
          등급이 높을수록 더 큰 프로젝트를 수주할 수 있습니다.<br />
          보증금은 탈퇴 시 환불 대상입니다.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {GRADES.map(({ name, deposit, limit, color }) => (
            <div key={name} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12, padding: "14px 16px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0,
                }} />
                <span style={{ fontSize: 14, fontWeight: 800, color: WHITE }}>{name}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: GOLD }}>{deposit}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{limit} 수주 가능</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 16, background: GOLDB, border: `1px solid ${GOLD}`,
          borderRadius: 12, padding: "12px 14px", textAlign: "center",
        }}>
          <div style={{ fontSize: 12, color: GOLD, fontWeight: 700, lineHeight: 1.6 }}>
            예치 보증금은 파트너 활동 중 안전하게 보관되며<br />
            계약 완료 시 자동 지급되지 않습니다
          </div>
        </div>
      </Section>

      {/* ── FEE ─────────────────────────────────────────────────── */}
      <Section bg={OFF}>
        <SectionTitle label="수수료 안내" sub="계약 성사 시에만 단 4.4%" />
        <div style={{
          background: WHITE, borderRadius: 16, padding: "24px 20px",
          boxShadow: "0 2px 16px rgba(11,29,58,0.08)",
        }}>
          <div style={{
            textAlign: "center", marginBottom: 20,
          }}>
            <span style={{ fontSize: 42, fontWeight: 900, color: GOLD }}>4.4</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: GOLD }}>%</span>
            <div style={{ fontSize: 12, color: TEXT3, marginTop: 4 }}>VAT 포함 · 공간멤버십파트너 이용수수료</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { ok: true,  label: "계약이 성사된 프로젝트에만 부과됩니다" },
              { ok: true,  label: "광고비, 월정액, 가입비 일체 없음" },
              { ok: true,  label: "견적 요청 수신은 무료" },
              { ok: false, label: "수주 실패 / 견적 미채택 시 수수료 없음" },
            ].map(({ ok, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{ok ? "✅" : "🔸"}</span>
                <span style={{ fontSize: 14, color: ok ? NAVY : TEXT2, fontWeight: ok ? 600 : 400 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── ONBOARDING STEPS ────────────────────────────────────── */}
      <Section bg={WHITE}>
        <SectionTitle label="파트너 입점 6단계" sub="가입부터 첫 수주까지" />
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {ONBOARDING.map(({ num, title, desc }, i) => (
            <div key={num} style={{
              display: "flex", gap: 16, paddingBottom: i < ONBOARDING.length - 1 ? 24 : 0,
              position: "relative",
            }}>
              {/* Line */}
              {i < ONBOARDING.length - 1 && (
                <div style={{
                  position: "absolute", left: 17, top: 38, bottom: 0,
                  width: 2, background: "#E4EAF3",
                }} />
              )}
              {/* Step circle */}
              <div style={{
                flexShrink: 0, width: 36, height: 36, borderRadius: "50%",
                background: num === 1 ? GOLD : OFF,
                border: `2px solid ${num === 1 ? GOLD : "#DDE3EC"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 900,
                color: num === 1 ? WHITE : TEXT3,
                zIndex: 1, position: "relative",
              }}>
                {num}
              </div>
              <div style={{ paddingTop: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 13, color: TEXT3, lineHeight: 1.55 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── PARTNER TYPES ────────────────────────────────────────── */}
      <Section bg={OFF}>
        <SectionTitle label="입점 가능 업종" sub="다양한 공간 전문가를 모십니다" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PARTNER_TYPES.map((t) => (
            <div key={t} style={{
              background: WHITE, border: `1px solid #DDE3EC`,
              borderRadius: 99, padding: "8px 16px",
              fontSize: 13, fontWeight: 600, color: NAVY,
            }}>
              {t}
            </div>
          ))}
        </div>
      </Section>

      {/* ── CONSULTATION FORM ────────────────────────────────────── */}
      <Section id="partner-consult-form" bg={WHITE}>
        <div id="partner-consult-form" />
        <SectionTitle label="파트너 상담 신청" sub="지금 신청하면 1~2 영업일 내 연락드립니다" />
        <ConsultForm />
      </Section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <div style={{
        background: NAVY, padding: "32px 24px",
        fontFamily: SANS, textAlign: "center",
      }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: WHITE, marginBottom: 6 }}>
            공간마켓
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 12 }}>
            파트너 전용 문의: gongganmarket.biz@gmail.com
          </div>
          <button
            onClick={() => { window.location.href = "/"; }}
            style={{
              background: "transparent", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 99, padding: "7px 20px", cursor: "pointer",
              fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: SANS,
            }}>
            공간마켓 홈으로
          </button>
          <div style={{ marginTop: 20, fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
            © 2026 공간마켓. All rights reserved.
          </div>
        </div>
      </div>

    </div>
  );
}
