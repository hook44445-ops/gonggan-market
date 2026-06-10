import { useState, useEffect, useRef } from "react";
import { C, R, S } from "../constants";
import { SHOW_DEBUG_UI } from "../constants/release";
import { LogoMark } from "../components/common";
import SpaceProtectionBadge from "../components/SpaceProtectionBadge";
import AppFooter from "../components/AppFooter";

// Hero 배경 — 프로젝트 내부 고정 실사 asset (자연광 우드/식물 인테리어, 외부/Unsplash 미사용)
const HERO_BG = "/images/landing-hero-interior.jpg";

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

export default function LandingScreen({ onSelectRole, onAdminTap, hasSavedAccounts = false, onResume }) {
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
      {SHOW_DEBUG_UI && (
        <div style={{ background:"#1a1a1a", color:"#00ff88", textAlign:"center", padding:"4px 0", fontSize:10, fontFamily:"monospace", letterSpacing:"0.5px" }}>
          ▶ DEPLOY 2026-05-28 sha:{typeof __GIT_SHA__ !== "undefined" ? __GIT_SHA__ : "?"} ◀
          &nbsp;|&nbsp;landing_footer_rendered:true
          &nbsp;|&nbsp;pwa_enabled:true
          &nbsp;|&nbsp;identity_v2:true
          &nbsp;|&nbsp;MODE:{import.meta.env.MODE}
        </div>
      )}

      {/* ── 다시 오셨네요 — 기기 인증 + 저장 계정이 있을 때만 (저장 계정으로 바로 시작) ── */}
      {hasSavedAccounts && (
        <button
          onClick={() => onResume?.()}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            margin: "12px 16px 0", padding: "13px 16px", borderRadius: R.full,
            background: C.brand, color: "#fff", border: "none", fontSize: 15, fontWeight: 800,
            cursor: "pointer", fontFamily: "inherit", boxShadow: `0 6px 18px ${C.brand}33`,
          }}>
          👋 다시 오셨네요 · 저장된 계정으로 시작
        </button>
      )}

      {/* ── HERO ──────────────────────────────────────────────────── */}
      {/* 자연광 인테리어 배경 사진 + 좌측 밝은 아이보리 그라데이션 오버레이 (공간사이 무드) */}
      <div style={{
        backgroundColor: C.bg,
        backgroundImage:
          `linear-gradient(100deg, rgba(245,241,234,0.86) 0%, rgba(245,241,234,0.50) 30%, rgba(245,241,234,0.10) 52%, rgba(245,241,234,0) 66%), url('${HERO_BG}')`,
        backgroundSize: "cover, cover",
        backgroundPosition: "center, center",
        backgroundRepeat: "no-repeat, no-repeat",
        paddingTop: 56,
        paddingBottom: 40,
        paddingLeft: 24,
        paddingRight: 24,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        <div ref={heroRef} style={{ maxWidth: 480, margin: "0 auto" }}>
          {/* brand — 01 공간·연결형 아이콘 + 워드마크 (여백 중심) */}
          <div style={{ ...fadeStyle(heroVisible, 0), marginBottom: 28 }}>
            <div style={{ marginBottom: 14 }}>
              <LogoMark size={48} bare tone="brand" />
            </div>
            <div style={{
              fontSize: 22, fontWeight: 900, color: C.brandD,
              letterSpacing: "-0.3px", lineHeight: 1.2, marginBottom: 4,
            }}>
              공간마켓
            </div>
            <div style={{
              fontSize: 11, fontWeight: 500, color: C.text3,
              letterSpacing: "0.04em",
            }}>
              공간이 연결되는 곳, 믿을 수 있는 거래
            </div>
            {/* 공간보호 상시 노출 */}
            <div style={{ marginTop: 12 }}>
              <SpaceProtectionBadge variant="badge" />
            </div>
          </div>

          {/* main copy */}
          <div style={{
            fontSize: 36, fontWeight: 900, color: C.text1,
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
            <div style={{ fontSize: 15, color: C.text2, lineHeight: 1.6, marginBottom: 2 }}>
              집, 상가, 리모델링까지
            </div>
            <div style={{ fontSize: 15, color: C.text2, lineHeight: 1.6, marginBottom: 10 }}>
              비교하고 확인하세요
            </div>
            <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.6 }}>
              공간마켓은 연결과 안전을 생각합니다.
            </div>
          </div>

          {/* buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, ...fadeStyle(heroVisible, 0.24) }}>
            <button
              onClick={() => onSelectRole("consumer")}
              style={{
                ...btnBase,
                background: C.brand,
                color: "#fff",
                border: "none",
                boxShadow: "0 8px 24px rgba(46,95,75,0.22)",
              }}>
              견적 시작하기
            </button>
            <button
              onClick={() => onSelectRole("company")}
              style={{
                ...btnBase,
                background: "rgba(255,255,255,0.85)",
                color: C.brand,
                border: `1.5px solid ${C.brandM}`,
              }}>
              업체로 시작
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: 왜 양쪽 모두 안심할 수 있나요? ──────────────── */}
      <div style={{ padding: "44px 20px", background: C.bg }}>
        <div ref={sec1Ref} style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 28, ...fadeStyle(sec1Visible, 0) }}>
            <div style={{
              fontSize: 18, fontWeight: 900, color: C.text1,
              lineHeight: 1.4, marginBottom: 6,
            }}>
              인테리어, 아무에게나 맡길 수 없으니까
            </div>
            <div style={{ fontSize: 13, color: C.text3, fontWeight: 500 }}>
              부담 없이 비교하고 시작하세요
            </div>
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

      {/* ── 수수료 안내 섹션 ──────────────────────────────────────── */}
      <div style={{ padding: "40px 20px", background: C.bg }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.text1, textAlign: "center", marginBottom: 6 }}>
            수수료 안내
          </div>
          <div style={{ fontSize: 13, color: C.text3, textAlign: "center", marginBottom: 20 }}>
            투명한 구조 · 숨은 비용 없음
          </div>

          {/* 고객 */}
          <div style={{ background: C.surface, borderRadius: 16, padding: 18, marginBottom: 12, border: `1px solid ${C.bgWarm}` }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.brand, marginBottom: 6 }}>
              👤 고객 · 공간안전결제 에스크로 수수료 3.7%
            </div>
            <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.7 }}>
              토스페이먼츠가 내 돈을 보호합니다.<br/>
              공사 완료 확인 후 업체에 지급됩니다. (VAT 포함 · 고정)
            </div>
          </div>

          {/* 업체 */}
          <div style={{ background: C.surface, borderRadius: 16, padding: 18, border: `1px solid ${C.bgWarm}` }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.brand, marginBottom: 10 }}>
              🤝 업체 · 공간멤버십파트너 수수료
            </div>
            {[
              ["가입 후 1개월", "0% 🎉 무료"],
              ["가입 후 2개월", "2.2%"],
              ["가입 후 3개월~", "4.4%"],
            ].map(([label, rate]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between",
                padding: "5px 0", fontSize: 13, color: C.text2 }}>
                <span>{label}</span><span style={{ fontWeight: 800 }}>{rate}</span>
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: C.text3, marginTop: 10, lineHeight: 1.6 }}>
              공사규모에 따른 보증금 별도 (공간멤버쉽파트너뱃지 제공)<br/>
              보증금은 수수료가 아니며 공사 완료 시 100% 반환됩니다.
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer: 사업자 정보 + 버전 ───────────────────────────── */}
      <div style={{
        marginTop: "auto",
        padding: "20px 20px 36px",
        background: "#e8e4dc",
        borderTop: "1px solid #d6d0c8",
        textAlign: "center",
        flexShrink: 0,
      }}>
        <AppFooter />
        <div style={{ height: 1, background: "#d6d0c8", margin: "12px auto 14px", maxWidth: 260, opacity: 0.7 }} />
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
