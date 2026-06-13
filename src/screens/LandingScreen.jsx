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
  { num: 5, label: "완료 후 정산", desc: "고객 확인 완료 후 업체에 정산. 분쟁 발생 시 프로젝트 기록을 확인할 수 있습니다" },
];

// ── CRO V2 데이터 ──────────────────────────────────────────────────────────────
// Hero 신뢰 배지 (CTA 아래)
const HERO_TRUST = [
  { icon: "🛡️", text: "사업자·시공이력 검증" },
  { icon: "📝", text: "계약·채팅·사진 자동 기록" },
  { icon: "💸", text: "단계별 안전정산" },
  { icon: "🔎", text: "분쟁 시 기록 확인 가능" },
];
// 기록보호 섹션 항목
const RECORD_ITEMS = [
  { icon: "📍", title: "GPS 기록",  desc: "현장 방문·진행 위치가 기록됩니다" },
  { icon: "💬", title: "채팅 기록",  desc: "업체와의 모든 대화가 저장됩니다" },
  { icon: "📷", title: "사진 기록",  desc: "착공·중간·완료 시공 사진이 남습니다" },
  { icon: "📄", title: "계약 기록",  desc: "계약 범위와 변경 내역이 보관됩니다" },
];
// 업체 검증 섹션 항목
const VERIFY_ITEMS = [
  { icon: "🏢", title: "사업자 확인",   desc: "사업자등록 정보를 확인합니다" },
  { icon: "🛡️", title: "보험 확인",     desc: "시공 보험 가입 여부를 확인합니다" },
  { icon: "🧱", title: "시공 이력 검증", desc: "실제 시공 이력과 서류를 검증합니다" },
];
// 왜 공간마켓인가 — 4카드
const WHY_GM = [
  { icon: "📊", title: "비교견적",     desc: "내 조건에 맞는 검증 업체 견적 비교" },
  { icon: "🔒", title: "공간안전결제", desc: "공사 완료 전까지 대금 보호" },
  { icon: "🗂️", title: "기록보호",     desc: "계약부터 시공까지 자동 저장" },
  { icon: "✅", title: "검증업체",     desc: "서류와 보험이 확인된 업체만 연결" },
];
// FAQ
const FAQ_ITEMS = [
  { q: "견적 요청은 무료인가요?", a: "네. 견적 요청과 업체 비교는 무료입니다." },
  { q: "공간안전결제는 무엇인가요?", a: "공사비를 바로 지급하지 않고 단계 확인 후 안전하게 정산하는 구조입니다." },
  { q: "업체는 어떻게 검증되나요?", a: "사업자 정보, 시공 이력, 서류 확인을 거친 업체만 연결됩니다." },
  { q: "분쟁이 생기면 어떻게 하나요?", a: "계약, 채팅, 사진, 진행기록이 저장되어 프로젝트 기록을 확인할 수 있습니다." },
];

// CRO V2 — FAQ 아코디언 행
function FaqRow({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, padding: "15px 16px", background: "transparent", border: "none",
          cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: C.text1, lineHeight: 1.4 }}>Q. {q}</span>
        <span style={{
          fontSize: 15, color: C.brand, flexShrink: 0,
          transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s",
        }}>⌄</span>
      </button>
      {open && (
        <div style={{ padding: "0 16px 15px", fontSize: 13, color: C.text2, lineHeight: 1.65 }}>{a}</div>
      )}
    </div>
  );
}

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
            <div style={{
              fontSize: 16, color: "rgba(44,62,50,0.75)", lineHeight: 1.6,
              letterSpacing: "-0.2px", fontWeight: 500,
            }}>
              좋은 공간은 좋은 만남에서 시작됩니다
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
              무료 비교견적 받기
            </button>
            <button
              onClick={() => { window.location.href = "/partner"; }}
              style={{
                ...btnBase,
                background: "rgba(255,255,255,0.85)",
                color: C.brand,
                border: `1.5px solid ${C.brandM}`,
              }}>
              업체로 시작
            </button>
            {/* 업체 micro badge — 낮은 시각 우선순위(고객 CTA 방해 금지) */}
            <div style={{ fontSize: 11, color: C.text3, textAlign: "center", marginTop: -4, fontWeight: 500, letterSpacing: "-0.1px" }}>
              광고비 없음 · 월 사용료 없음 · 계약 성사 시 4.4%
            </div>
          </div>

          {/* CRO V2 — Hero 신뢰 배지 (CTA 아래) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 22, ...fadeStyle(heroVisible, 0.32) }}>
            {HERO_TRUST.map((b) => (
              <div key={b.text} style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "rgba(255,255,255,0.78)", border: `1px solid ${C.bgWarm}`,
                borderRadius: R.lg, padding: "9px 11px",
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{b.icon}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: C.text2, lineHeight: 1.25 }}>{b.text}</span>
              </div>
            ))}
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

      {/* ── CRO V2: 기록보호 ───────────────────────────────────────── */}
      <div style={{ padding: "44px 20px", background: C.bg }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.text1, marginBottom: 6 }}>기록이 남는 계약</div>
            <div style={{ fontSize: 13, color: C.text3, fontWeight: 500 }}>계약·채팅·사진·진행기록이 자동 저장됩니다</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {RECORD_ITEMS.map((it) => (
              <div key={it.title} style={{ background: C.surface, borderRadius: R.xl, padding: "16px 14px", border: `1px solid ${C.bgWarm}` }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{it.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: 4 }}>{it.title}</div>
                <div style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.5 }}>{it.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 12.5, color: C.brand, fontWeight: 700 }}>
            모든 프로젝트 기록은 자동 저장됩니다.
          </div>
        </div>
      </div>

      {/* ── CRO V2: 업체 검증 ───────────────────────────────────────── */}
      <div style={{ padding: "44px 20px", background: C.surface }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.text1, marginBottom: 6 }}>검증된 업체만 연결합니다</div>
            <div style={{ fontSize: 13, color: C.text3, fontWeight: 500 }}>서류·보험·시공 이력을 확인합니다</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {VERIFY_ITEMS.map((it) => (
              <div key={it.title} style={{ display: "flex", alignItems: "flex-start", gap: 12, background: C.bg, borderRadius: R.xl, padding: "14px 14px", border: `1px solid ${C.bgWarm}` }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{it.icon}</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text1, marginBottom: 3 }}>{it.title}</div>
                  <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.5 }}>{it.desc}</div>
                </div>
              </div>
            ))}
            {/* 입점 제한 카드 */}
            <div style={{ background: C.brandD, borderRadius: R.xl, padding: "16px 14px" }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#fff", marginBottom: 5 }}>
                🚫 무면허·불법·서류 미비 업체 입점 제한
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.78)", lineHeight: 1.5 }}>
                검증 완료 업체만 활동할 수 있습니다.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CRO V2: 왜 공간마켓인가 ─────────────────────────────────── */}
      <div style={{ padding: "44px 20px", background: C.bg }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ textAlign: "center", fontSize: 18, fontWeight: 900, color: C.text1, marginBottom: 24 }}>왜 공간마켓인가</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {WHY_GM.map((it) => (
              <div key={it.title} style={{ background: C.surface, borderRadius: R.xl, padding: "16px 14px", border: `1px solid ${C.bgWarm}` }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{it.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: 4 }}>{it.title}</div>
                <div style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.5 }}>{it.desc}</div>
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
            marginBottom: 18,
            ...fadeStyle(sec3Visible, 0.08),
          }}>
            집, 상가, 리모델링까지 — 비교하고 확인하세요
          </div>

          {/* CRO V2 — 최종 CTA 강화 문구 */}
          <div style={{
            fontSize: 13.5, color: "#fff", fontWeight: 700, lineHeight: 1.5,
            marginBottom: 24, ...fadeStyle(sec3Visible, 0.12),
          }}>
            사업자·시공이력 검증 업체와 안전하게 비교하세요
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
              무료 비교견적 받기
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
              👤 고객 · 공간안전결제
            </div>
            <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.7 }}>
              토스페이먼츠 안전결제 기반<br/>
              토스페이먼츠가 공사대금을 안전하게 보호합니다.<br/>
              단계별 안전정산 후 공사 완료 시 최종 지급됩니다.<br/>
              <span style={{ fontSize: 11.5, color: C.text3 }}>🏆 가상계좌 이용 시 이용료 660원 (VAT 포함)</span>
            </div>
            <div style={{ fontSize: 11.5, color: C.brand, fontWeight: 700, marginTop: 10, lineHeight: 1.6 }}>
              공간안전결제 기반으로 공사 완료 전까지 대금이 안전하게 보호됩니다.
            </div>
          </div>

          {/* 업체 */}
          <div style={{ background: C.surface, borderRadius: 16, padding: 18, border: `1px solid ${C.bgWarm}` }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.brand, marginBottom: 10 }}>
              🤝 업체 · 공간멤버십파트너 이용수수료
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {["가입비 없음", "광고비 없음", "월 사용료 없음", "견적비 없음"].map(t => (
                <span key={t} style={{ background: C.brandL, color: C.brand, borderRadius: 999,
                  padding: "3px 9px", fontSize: 11, fontWeight: 700 }}>{t}</span>
              ))}
            </div>
            {[
              ["이용수수료", "4.4% (VAT 포함)"],
              ["발생 시점", "계약 성사 시에만"],
              ["차감 방식", "정산 시 자동 차감"],
            ].map(([label, rate]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between",
                padding: "5px 0", fontSize: 13, color: C.text2 }}>
                <span>{label}</span><span style={{ fontWeight: 800 }}>{rate}</span>
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: C.text3, marginTop: 10, lineHeight: 1.6 }}>
              지급되지 않은 금액에는 수수료가 부과되지 않습니다.<br/>
              공간뱃지예치보증금은 수수료가 아니며, 신뢰 파트너 인증을 위한 예치보증금입니다. 일정 기준 충족 시 환급 가능합니다.
            </div>
          </div>
        </div>
      </div>

      {/* ── CRO V2: FAQ ────────────────────────────────────────────── */}
      <div style={{ padding: "44px 20px", background: C.surface }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ textAlign: "center", fontSize: 18, fontWeight: 900, color: C.text1, marginBottom: 24 }}>자주 묻는 질문</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQ_ITEMS.map((f) => <FaqRow key={f.q} q={f.q} a={f.a} />)}
          </div>
          {/* 신뢰 칩 (무료 상담 · 가입 강요 없음 · 1~2 영업일 내 연락) */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 24 }}>
            {[["💬", "무료 상담"], ["🙆", "가입 강요 없음"], ["⏱️", "1~2 영업일 내 연락"]].map(([ic, t]) => (
              <span key={t} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                background: C.brandL, color: C.brand, borderRadius: R.full,
                padding: "6px 12px", fontSize: 12, fontWeight: 700,
              }}>
                <span>{ic}</span>{t}
              </span>
            ))}
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
