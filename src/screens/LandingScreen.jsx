import { useState, useEffect, useRef } from "react";
import { C, R, S } from "../constants";

function useVisible(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

const fadeStyle = (visible, delay = 0) => ({
  opacity: visible ? 1 : 0,
  transform: visible ? "translateY(0)" : "translateY(20px)",
  transition: `opacity 0.4s ease-out ${delay}s, transform 0.4s ease-out ${delay}s`,
});

const WHY_CARDS = [
  {
    side: "의뢰인에게",
    items: [
      { icon: "🔒", title: "내 돈 단계별 보호",   desc: "단계 확인 후에만 정산되는 안전한 구조" },
      { icon: "📋", title: "기록이 남는 계약",     desc: "계약 범위, 사진, 대화 모두 저장됩니다" },
      { icon: "✅", title: "검증된 업체 연결",     desc: "서류·보험·시공 이력 확인 업체만 연결" },
    ],
  },
  {
    side: "업체에게",
    items: [
      { icon: "💰", title: "단계마다 안정 정산",   desc: "착공·중간·완료 단계별로 정산됩니다" },
      { icon: "📸", title: "기록이 나를 지킴",     desc: "시공 사진·기록이 분쟁 시 증거가 됩니다" },
      { icon: "👤", title: "진짜 고객만 연결",     desc: "에스크로 예치한 검증된 의뢰인만 옵니다" },
    ],
  },
];

const STEPS = [
  { num: 1, label: "견적 요청",    desc: "공사 정보를 입력하면 검증된 업체에 자동 전달됩니다" },
  { num: 2, label: "업체 비교",    desc: "견적·리뷰·포트폴리오를 비교하고 업체를 선택하세요" },
  { num: 3, label: "계약 확인",    desc: "계약 범위를 기록하고 공사비를 안전하게 예치합니다" },
  { num: 4, label: "단계별 확인",  desc: "착공→중간→완료, 사진으로 확인하고 단계마다 승인합니다" },
  { num: 5, label: "완료 후 정산", desc: "고객 확인 완료 후 업체에 정산. 분쟁 시 관리자가 함께합니다" },
];

export default function LandingScreen({ onSelectRole, onAdminTap }) {
  const [heroRef, heroVisible]     = useVisible(0.05);
  const [sec1Ref, sec1Visible]     = useVisible(0.1);
  const [sec2Ref, sec2Visible]     = useVisible(0.1);
  const [sec3Ref, sec3Visible]     = useVisible(0.1);
  const [versionTapCount, setVersionTapCount] = useState(0);

  const btnBase = {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 8, width: "100%", height: 52, borderRadius: R.full,
    fontSize: 16, fontWeight: 800, cursor: "pointer",
    fontFamily: "inherit", transition: "opacity 0.15s",
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
      background: C.bg,
      fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif",
    }}>
      {/* DEPLOY CHECK — 배포 확인용 */}
      <div style={{ background:"#1a1a1a", color:"#00ff88", textAlign:"center", padding:"4px 0", fontSize:10, fontFamily:"monospace", letterSpacing:"0.5px" }}>
        ▶ DEPLOY 2026-05-28 sha:{typeof __GIT_SHA__ !== "undefined" ? __GIT_SHA__ : "?"} ◀
        &nbsp;|&nbsp;landing_footer_rendered:true
        &nbsp;|&nbsp;pwa_enabled:true
        &nbsp;|&nbsp;identity_v2:true
        &nbsp;|&nbsp;MODE:{import.meta.env.MODE}
      </div>

      {/* ── HERO ──────────────────────────────────────────────────── */}
      <div style={{
        background: C.brand,
        paddingTop: 56,
        paddingBottom: 40,
        paddingLeft: 24,
        paddingRight: 24,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        {/* decorative circle */}
        <div style={{
          position: "absolute", top: -60, right: -60,
          width: 200, height: 200, borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: -40, left: -40,
          width: 140, height: 140, borderRadius: "50%",
          background: "rgba(255,255,255,0.04)",
          pointerEvents: "none",
        }} />

        <div ref={heroRef} style={{ maxWidth: 480, margin: "0 auto" }}>
          {/* brand */}
          <div style={{ ...fadeStyle(heroVisible, 0), marginBottom: 28 }}>
            <div style={{
              fontSize: 22, fontWeight: 900, color: "#fff",
              letterSpacing: "-0.3px", lineHeight: 1.2, marginBottom: 4,
            }}>
              공간마켓
            </div>
            <div style={{
              fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.04em",
            }}>
              사람과 공간이 연결되는 곳
            </div>
          </div>

          {/* main copy */}
          <div style={{
            fontSize: 36, fontWeight: 900, color: "#fff",
            lineHeight: 1.25, marginBottom: 16, letterSpacing: "-0.5px",
            ...fadeStyle(heroVisible, 0.08),
          }}>
            인테리어는 어디서?
          </div>

          {/* sub copy */}
          <div style={{
            marginBottom: 36,
            ...fadeStyle(heroVisible, 0.16),
          }}>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", lineHeight: 1.6, marginBottom: 2 }}>
              집, 상가, 리모델링까지
            </div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", lineHeight: 1.6, marginBottom: 10 }}>
              비교하고 확인하세요
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
              공간마켓은 연결과 안전을 생각합니다.
            </div>
          </div>

          {/* buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, ...fadeStyle(heroVisible, 0.24) }}>
            <button
              onClick={() => onSelectRole("consumer")}
              style={{
                ...btnBase,
                background: "#fff",
                color: C.brand,
                border: "none",
              }}>
              견적 시작하기
            </button>
            <button
              onClick={() => onSelectRole("company")}
              style={{
                ...btnBase,
                background: "transparent",
                color: "#fff",
                border: "1.5px solid rgba(255,255,255,0.6)",
              }}>
              업체로 시작
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: 왜 양쪽 모두 안심할 수 있나요? ──────────────── */}
      <div style={{ padding: "44px 20px", background: C.bg }}>
        <div ref={sec1Ref} style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{
            fontSize: 18, fontWeight: 900, color: C.text1,
            textAlign: "center", marginBottom: 28,
            ...fadeStyle(sec1Visible, 0),
          }}>
            기록이 당신의 공간을 지킵니다
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {WHY_CARDS.map((col, ci) => (
              <div key={col.side}>
                <div style={{
                  fontSize: 12, fontWeight: 800, color: C.brand,
                  letterSpacing: "0.04em", marginBottom: 10, textAlign: "center",
                  ...fadeStyle(sec1Visible, ci * 0.1),
                }}>
                  {col.side}
                </div>
                {col.items.map((item, ii) => (
                  <div key={item.title} style={{
                    background: C.surface,
                    borderRadius: R.xl,
                    padding: "14px 12px",
                    marginBottom: 10,
                    border: `1px solid ${C.bgWarm}`,
                    ...fadeStyle(sec1Visible, 0.1 + ci * 0.05 + ii * 0.1),
                  }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>{item.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: C.text1, marginBottom: 4, lineHeight: 1.3 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 11, color: C.text3, lineHeight: 1.5 }}>
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 2: 이렇게 진행됩니다 ─────────────────────────────── */}
      <div style={{ padding: "44px 20px", background: C.surface }}>
        <div ref={sec2Ref} style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{
            fontSize: 18, fontWeight: 900, color: C.text1,
            textAlign: "center", marginBottom: 32,
            ...fadeStyle(sec2Visible, 0),
          }}>
            이렇게 진행됩니다
          </div>

          <div style={{ position: "relative" }}>
            {/* connecting line */}
            <div style={{
              position: "absolute",
              left: 19,
              top: 24,
              bottom: 24,
              width: 2,
              background: `repeating-linear-gradient(to bottom, ${C.brand} 0, ${C.brand} 6px, transparent 6px, transparent 12px)`,
              opacity: 0.3,
            }} />

            {STEPS.map((step, i) => (
              <div key={step.num} style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 16,
                marginBottom: i < STEPS.length - 1 ? 24 : 0,
                position: "relative",
                ...fadeStyle(sec2Visible, i * 0.1),
              }}>
                {/* circle */}
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: C.brand, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 900, flexShrink: 0,
                }}>
                  {step.num}
                </div>
                {/* text */}
                <div style={{ paddingTop: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 4 }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.6 }}>
                    {step.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 3: CTA ────────────────────────────────────────── */}
      <div style={{ padding: "44px 20px 60px", background: C.brand }}>
        <div ref={sec3Ref} style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
          <div style={{
            fontSize: 22, fontWeight: 900, color: "#fff",
            lineHeight: 1.4, marginBottom: 8, whiteSpace: "pre-line",
            ...fadeStyle(sec3Visible, 0),
          }}>
            인테리어는 어디서?
          </div>

          <div style={{
            fontSize: 14, color: "rgba(255,255,255,0.65)",
            marginBottom: 32,
            ...fadeStyle(sec3Visible, 0.08),
          }}>
            집, 상가, 리모델링까지 — 비교하고 확인하세요
          </div>

          <div style={{ ...fadeStyle(sec3Visible, 0.16) }}>
            <button
              onClick={() => onSelectRole("consumer")}
              style={{
                ...btnBase,
                background: "#fff",
                color: C.brand,
                border: "none",
                fontSize: 17,
                height: 56,
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                marginBottom: 16,
              }}>
              견적 시작하기
            </button>
          </div>

          <div style={{
            fontSize: 12, color: "rgba(255,255,255,0.5)",
            ...fadeStyle(sec3Visible, 0.24),
          }}>
            가입비 없음 · 견적 무료 · 단계별 안전정산
          </div>
        </div>
      </div>

      {/* ── Footer version ───────────────────────────────────────── */}
      <div style={{
        marginTop: "auto",
        padding: "20px 20px 36px",
        background: "#e8e4dc",
        borderTop: "1px solid #d6d0c8",
        textAlign: "center",
        flexShrink: 0,
      }}>
        <div
          onClick={() => {
            const next = versionTapCount + 1;
            setVersionTapCount(next);
            if (next >= 5) {
              setVersionTapCount(0);
              if (onAdminTap) onAdminTap();
            }
          }}
          style={{
            fontSize: 12,
            color: "#7a7265",
            cursor: "default",
            userSelect: "none",
            letterSpacing: "0.03em",
            fontWeight: 500,
          }}>
          공간마켓 v1.0.0
        </div>
      </div>
    </div>
  );
}
