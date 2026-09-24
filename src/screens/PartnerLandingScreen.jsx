import { useState, useEffect, useRef } from "react";
import BreathTrustSection from "../components/BreathTrustSection"; // v2.0: 호흡과 신뢰(Add Only)
import AppFooter from "../components/AppFooter"; // 사업자정보 푸터(법적 필수 · 삭제 금지)
import CompanyCard from "../components/CompanyCard";
import { LADDER, limitText } from "../lib/partnerTier";
import { PARTNER_DEPOSIT_NOTE } from "../utils/siteSeo";
import { SHOW_BETA_UI } from "../constants/release";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { useJsonLd } from "../hooks/useJsonLd";
import { partnerFaq, pageSeo, faqSchema, breadcrumbSchema } from "../utils/siteSeo";
import { applyRoleTheme } from "../utils/roleTheme";

// ── Design tokens ─────────────────────────────────────────────────────────────
const NAVY  = "#121A16";
const NAVY2 = "#1E2A22";
const NAVY3 = "#2C3A30";
const FOREST = "#1A2E22"; // 파트너 히어로 배경(웜 포레스트)
const OK    = "#2D5A27";  // 타임라인 배지/초록 점
const GOLD  = "#C8A86A";
const GOLDD = "#A98B4E";
const GOLDB = "rgba(200,168,106,0.12)";
const WHITE = "#FFFFFF";
const OFF   = "#F9F6F2";
const TEXT2 = "#4A554C";
const TEXT3 = "#8A857E";
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

// ── GA4 전환 이벤트 (V1.5) ──────────────────────────────────────────────────────
// gtag 가 로드된 환경에서만 발화하고, 없으면 무해하게 무시한다(분석 미설정 시 영향 0).
// partner_join_click / partner_join_submit / partner_login_click
function track(event, params = {}) {
  try {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", event, params);
    }
  } catch { /* analytics 실패는 전환 흐름에 영향 주지 않음 */ }
}

// ── FAQ (V1.5) — 문구는 utils/siteSeo.js 단일 소스 ───────────────────────────────
// 봇 프리렌더(api/prerender.js)가 같은 배열을 써서 화면과 색인 내용이 갈라지지 않는다.
const FAQS = partnerFaq();

// ── FAQ section(V1.5) ──────────────────────────────────────────────────────────
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: WHITE, border: `1px solid #EFEAE0`, borderRadius: 12,
      overflow: "hidden",
    }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, padding: "16px 16px", background: "transparent", border: "none",
          cursor: "pointer", fontFamily: SANS, textAlign: "left",
        }}>
        <span style={{ fontSize: 14.5, fontWeight: 800, color: NAVY, lineHeight: 1.45 }}>Q. {q}</span>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, color: GOLD, flexShrink: 0,
          transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease",
        }}>⌄</span>
      </button>
      {open && (
        <div style={{
          padding: "0 16px 16px", fontSize: 13.5, color: TEXT2, lineHeight: 1.65,
          borderTop: `1px solid #F4EFE6`, paddingTop: 14,
        }}>
          {a}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PartnerLandingScreen() {
  // 파트너 전용 페이지 — 네이비 테마 적용
  useEffect(() => { applyRoleTheme("company"); return () => applyRoleTheme("consumer"); }, []);

  const [heroRef, heroVis] = useVisible(0.05);

  const SEO = pageSeo(SHOW_BETA_UI)["/partner"];
  useDocumentMeta({ title: SEO.title, description: SEO.description, path: "/partner" });

  // 공급자(업체) 쪽 구조화 데이터 — 「가입비·수수료가 얼마냐」가 업체의 첫 질문이라
  // FAQ 를 그대로 구조화해 답변엔진이 숫자를 정확히 인용하게 한다.
  useJsonLd("partner", [
    faqSchema(FAQS, undefined, "/partner"),
    breadcrumbSchema([["공간마켓", "/"], ["파트너 입점 안내", "/partner"]]),
  ]);

  // 가입·로그인 — 입구는 하나다. 앱의 /?login=company 가 휴대폰 인증 → 새 번호면 3단계 가입
  // (업체명·지역·공종, screens/CompanyOnboarding.jsx) → 바로 기본 파트너로 이어진다.
  // 예전엔 이 페이지만의 신청서(사업자등록증 필수) → 관리자 승인 → 승인된 번호+사업자번호로만
  // 로그인 관문 통과 → 보증금 등급 → 표시용 계좌 입금 안내였다. 입구가 둘로 갈라져 있었고,
  // 관리자 승인 전엔 들어올 수 없었다(대표: 「들어오는 건 쉽게」).
  const goSignup = (source = "hero") => {
    track("partner_join_click", { source }); // V1.5 전환 이벤트
    window.location.href = "/?login=company";
  };
  const goCompanyLogin = () => {
    track("partner_login_click"); // V1.5 전환 이벤트
    window.location.href = "/?login=company";
  };

  const btn = {
    padding: "15px 26px", borderRadius: 999, border: "none", fontWeight: 800, fontSize: 14,
    cursor: "pointer", fontFamily: SANS, width: "100%", display: "inline-flex",
    justifyContent: "center", alignItems: "center", gap: 8, transition: "transform .08s",
  };
  const okBadge = {
    display: "inline-flex", alignItems: "center", padding: "4px 10px", borderRadius: 999,
    fontSize: 11, fontWeight: 700, background: "#E7F0E6", color: OK,
    border: "1px solid #C8D8C5", whiteSpace: "nowrap", flexShrink: 0,
  };
  /* ── 업체의 하루 — 2026-09-23 ─────────────────────────────────────────────
     왜: 이 페이지는 「가입 절차 안내서」였다(30초·확인·승인·검증 배지 나열). 사진은 한 장도 없고,
         차별점이 수수료(4.4%·오픈 무료)에만 걸려 있었다. 가격은 따라잡히면 끝이다.
     업체가 실제로 겪는 하루로 다시 세운다 — 견적이 오고, 현장을 보고, 계약하고, 남는다.
     마지막 마디가 우리만 할 수 있는 말이다: 끝난 공사가 다음 고객을 데려온다. */
  const PARTNER_JOURNEY = [
    { no: "01", when: "아침",       title: "광고비를 먼저 쓰지 않습니다",
      desc: "견적을 요청한 고객에게만 연결됩니다. 요청서에 공간·범위·예산이 적혀 오니 헛걸음이 줄어듭니다.",
      proof: "견적 수신 · 요청서", img: "/images/partner/p1.webp" },
    { no: "02", when: "현장에서",   title: "같은 조건으로 견적을 냅니다",
      desc: "공정·기간·보증을 항목으로 적어 보내면, 고객이 금액만이 아니라 근거를 보고 고릅니다.",
      proof: "견적서 작성 3단계", img: "/images/partner/p2.webp" },
    { no: "03", when: "계약할 때",  title: "말이 아니라 기록으로 남깁니다",
      desc: "계약 내용과 주고받은 말, 현장 사진이 그날짜에 붙습니다. 추가비·하자 이야기가 나와도 확인할 것이 있습니다.",
      proof: "계약 · 진행 화면", img: "/images/partner/p3.webp" },
    { no: "04", when: "끝난 뒤",    title: "끝난 공사가 다음 고객을 데려옵니다",
      desc: "완료한 현장을 시공 사례로 올리면 업체 프로필과 라운지에 남아, 다음 고객이 그것을 보고 찾아옵니다.",
      proof: "시공 사례 · 후기", img: "/images/partner/p4.webp" },
  ];

  // 가입부터 프리미엄까지 — 금액은 lib/partnerTier.js 계단에서 뽑는다(숫자를 두 번 적지 않는다).
  const L = Object.fromEntries(LADDER.map((r) => [r.key, limitText(r.limit)]));
  const STEPS = [
    { b: "간편 가입",        t: "업체명 · 연락처 · 지역 · 공종",                    badge: "1분" },
    { b: "바로 입찰",        t: `공사 1건 ${L.none}까지 — 승인 기다림 없이`,          badge: "기본" },
    { b: "서류를 낼수록",    t: `사업자등록증 ${L.biz} · 시공보험 ${L.insurance}`,    badge: "성장" },
    { b: "프리미엄 파트너",  t: "보증금까지 — 금테 카드와 대표 사진",                  badge: "프리미엄" },
  ];
  // 의뢰인 화면에서 프리미엄 파트너가 어떻게 보이는지 — 실제 카드 컴포넌트를 그대로 쓴다. 「예시」 표시 필수.
  const PREMIUM_SAMPLE = {
    id: "sample-premium", isSample: true, name: "예시 인테리어", region: "우리 동네",
    specialties: ["아파트 전체", "욕실"], desc: "업체가 끝낸 공사 사진이 카드의 얼굴이 됩니다",
    verified: true, has_insurance: true, guarantee_status: "ACTIVE", guarantee_badge_visible: true,
    guarantee_grade: "PREMIUM", level: 6, online: true, lastActive: "방금", temp: 38.4,
    completedJobs: 42, rating: 4.9, avgResponseHours: 1, disputeRate: 0,
    cover: "/images/sample/living-after.webp",
  };

  return (
    <div style={{ fontFamily: SANS, background: OFF, color: NAVY, minHeight: "100vh", letterSpacing: "-0.02em", WebkitFontSmoothing: "antialiased", overflowX: "hidden" }}>

      {/* ── TOPNAV (고객/파트너 · 라우팅 유지) ─────────────────────── */}
      <div className="gm-topnav" style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(249,246,242,.85)",
        backdropFilter: "blur(16px) saturate(180%)", WebkitBackdropFilter: "blur(16px) saturate(180%)",
        borderBottom: "1px solid #E8E1D8", display: "flex", justifyContent: "space-between",
        alignItems: "center", padding: "10px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <img src="/icons/gm-logo.svg" alt="" aria-hidden="true" width="30" height="30"
            style={{ width: 30, height: 30, borderRadius: 9, display: "block", flexShrink: 0 }} />
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em" }}>
            공간마켓
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, background: "#ECE7DF", padding: 4, borderRadius: 999 }}>
          <button className="gm-tab" onClick={() => { window.location.href = "/"; }} style={{ padding: "8px 16px", borderRadius: 999,
            border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: SANS,
            background: "transparent", color: TEXT3 }}>고객</button>
          <button className="gm-tab" style={{ padding: "8px 16px", borderRadius: 999, border: "none", fontWeight: 700,
            fontSize: 13, cursor: "pointer", fontFamily: SANS, background: NAVY, color: "#fff" }}>파트너</button>
        </div>
      </div>

      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 20px" }}>
        {/* ── NAVY(웜 잉크) HERO ──────────────────────────────────── */}
        <div ref={heroRef} style={{ background: FOREST,
          color: "#F9F6F2", borderRadius: 28, padding: "28px 24px", margin: "16px 0 28px",
          position: "relative", overflow: "hidden" }}>
          <h1 style={{ fontSize: "clamp(24px,6vw,36px)", fontWeight: 800, lineHeight: 1.1, margin: 0, wordBreak: "keep-all" }}>
            광고비 없이 수주하는<br /><span style={{ color: GOLD }}>공간파트너</span>
          </h1>
          <p style={{ opacity: .6, fontSize: 14, margin: "12px 0", lineHeight: 1.7 }}>
            {/* ⚠️ 2026-09-23: 예전 문구는 「당근·숨고 광고비 쓰지 마세요. 예치된 고객만 연결됩니다.」였다.
                ① 경쟁사 실명을 깎아내리는 말은 품격에도, 비교광고 규정에도 맞지 않는다.
                ② «예치된 고객»은 베타에 없는 약속이다(예치·보관 문구 금지 — 안전결제는 토스 승인 뒤에 열린다). */}
            광고비를 먼저 쓰지 않아도 됩니다. 견적을 요청한 고객에게만 연결됩니다.
          </p>
          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => goSignup("hero")} style={{ ...btn, maxWidth: 220, background: "#fff", color: NAVY }}>
              1분 가입
            </button>
            <button onClick={goCompanyLogin} style={{ ...btn, maxWidth: 240, background: "transparent",
              border: "1px solid rgba(255,255,255,.25)", color: "#fff" }}>
              이미 파트너신가요? 로그인 →
            </button>
          </div>
        </div>

        {/* ── 업체의 하루 (여정) — 수수료가 아니라 «현장이 어떻게 달라지는가»를 먼저 말한다 ── */}
        <div style={{ padding: "4px 0 30px" }}>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, letterSpacing: "0.12em", marginBottom: 8 }}>
              공간파트너의 하루
            </div>
            <h2 style={{ fontSize: "clamp(21px,4.5vw,26px)", fontWeight: 800, letterSpacing: "-0.03em", margin: 0, lineHeight: 1.35 }}>
              수주보다 먼저, 현장이 편해집니다
            </h2>
            <p style={{ fontSize: 13.5, color: TEXT3, lineHeight: 1.75, margin: "10px 0 0", wordBreak: "keep-all" }}>
              고객을 연결해 주는 곳은 많습니다. 공간마켓은 그 뒤 — 견적·계약·현장 사진이 한곳에 남아, 다투는 자리가 줄어듭니다.
            </p>
          </div>
          <div className="gm-pjourney" style={{ display: "grid", gap: 14 }}>
            {PARTNER_JOURNEY.map((j, i) => (
              <div key={j.no} className="gg-rise" style={{
                background: "#fff", border: "1px solid #E8E1D8", borderRadius: 20, overflow: "hidden",
                display: "grid", gridTemplateColumns: "1fr", animationDelay: `${i * 0.06}s`,
              }}>
                <img src={j.img} alt="" loading="lazy" aria-hidden="true"
                  style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                <div style={{ padding: "15px 17px 17px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: GOLD, letterSpacing: "0.1em" }}>{j.no}</span>
                    <span style={{ fontSize: 11.5, color: TEXT3 }}>{j.when}</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, letterSpacing: "-0.02em", lineHeight: 1.4 }}>{j.title}</div>
                  <div style={{ fontSize: 13.5, color: "#3A4A40", lineHeight: 1.75, marginTop: 7, wordBreak: "keep-all" }}>{j.desc}</div>
                  <div style={{ marginTop: 11, display: "inline-flex", alignItems: "center", gap: 6,
                    background: "#F4F1EB", border: "1px solid #E8E1D8", borderRadius: 999, padding: "4px 11px",
                    fontSize: 11.5, fontWeight: 700, color: "#5A6B60" }}>
                    앱 화면 · {j.proof}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── TIMELINE : 신청부터 수주까지 (dot 32px 일관 · 카드별 배지 · 중앙 연결선) ── */}
        <div style={{ padding: "36px 0" }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 16px" }}>가입부터 프리미엄까지</h3>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12 }}>
            {/* 연결선: dot(32px) 중앙(15px)에 정렬 */}
            <div style={{ position: "absolute", left: 15, top: 16, bottom: 16, width: 2, background: "#E8E1D8", borderRadius: 2 }} />
            {STEPS.map((s, i) => (
              <div key={i} style={{ position: "relative", zIndex: 1, display: "grid",
                gridTemplateColumns: "32px 1fr", gap: 14, alignItems: "center" }}>
                <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: "50%",
                  background: i === 0 ? NAVY : "#E7F0E6", border: i === 0 ? "2px solid " + NAVY : "2px solid #C8D8C5",
                  color: i === 0 ? "#fff" : OK, display: "flex", alignItems: "center",
                  justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ background: "#fff", border: "1px solid #E8E1D8", borderRadius: 16,
                  padding: "14px 16px", minHeight: 56, display: "flex", justifyContent: "space-between",
                  alignItems: "center", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 14, letterSpacing: "-0.02em" }}>{s.b}</b>
                    <div style={{ fontSize: 12, color: TEXT3, marginTop: 2, lineHeight: 1.4 }}>{s.t}</div>
                  </div>
                  <span style={okBadge}>{s.badge}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 프리미엄 파트너 — 증빙을 낼수록 더 큰 공사 · 의뢰인에게 보이는 카드 ──
             예전 이 자리는 「오픈 파트너 100곳까지는 1천만원·1억 공사도 0원, 등급 제한 없음」이었다.
             서버 한도(마이그레이션 101)와 정면으로 어긋나는 약속이라 걷어냈다. */}
        <div style={{ padding: "0 0 36px" }}>
          <div style={{ background: NAVY, color: "#F9F6F2", borderRadius: 28, padding: "28px 20px" }}>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: GOLD, letterSpacing: "0.14em", marginBottom: 8 }}>PREMIUM PARTNER</div>
              <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.4, wordBreak: "keep-all" }}>증빙을 낼수록, 더 큰 공사를</div>
              <p style={{ fontSize: 12.5, color: "#9A958E", lineHeight: 1.6, margin: "8px 0 0", wordBreak: "keep-all" }}>
                가입만으로 시작하고, 서류는 원할 때 하나씩. 공사 1건 기준입니다.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
              {LADDER.map((r) => {
                const premium = r.key === "premium";
                return (
                  <div key={r.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                    background: premium ? "rgba(200,168,106,.10)" : "rgba(255,255,255,.06)",
                    border: `1px solid ${premium ? "rgba(200,168,106,.55)" : "rgba(255,255,255,.08)"}`,
                    padding: "13px 16px", borderRadius: 14, fontSize: 13 }}>
                    <span style={{ fontWeight: premium ? 800 : 600, color: premium ? GOLD : "#F9F6F2" }}>{r.label.replace(/^\+ /, "")}</span>
                    <b style={{ color: GOLD, whiteSpace: "nowrap" }}>{r.key === "license" ? `최대 ${limitText(r.limit)}` : limitText(r.limit)}</b>
                  </div>
                );
              })}
            </div>
            <p style={{ textAlign: "center", fontSize: 11.5, color: "#9A958E", lineHeight: 1.6, margin: "12px 0 22px", wordBreak: "keep-all" }}>
              {PARTNER_DEPOSIT_NOTE} · 보증금은 선택이에요
            </p>

            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#D9D2C4", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 8 }}>
              의뢰인에게는 이렇게 보여요
              <span style={{ fontSize: 10.5, fontWeight: 800, color: NAVY, background: GOLD, borderRadius: 999, padding: "2px 8px" }}>예시</span>
            </div>
            <div style={{ maxWidth: 420, margin: "0 auto" }}>
              <CompanyCard company={PREMIUM_SAMPLE} />
            </div>
          </div>
        </div>

        {/* ── 가입 — 입구는 하나(앱의 휴대폰 인증 → 3단계 가입) ──────────── */}
        <div id="partner-consult-form" style={{ padding: "8px 0 36px", scrollMarginTop: 16 }}>
          <div style={{ background: "#fff", border: "1px solid #E8E1D8", borderRadius: 24, padding: "24px 20px",
            maxWidth: 520, margin: "0 auto", boxShadow: "0 4px 24px rgba(18,26,22,.04)", textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: GOLD, letterSpacing: "0.14em", marginBottom: 8 }}>PARTNER</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: NAVY, letterSpacing: "-0.02em" }}>가입은 1분이면 끝나요</div>
            <p style={{ fontSize: 13.5, color: TEXT3, lineHeight: 1.7, margin: "8px 0 18px", wordBreak: "keep-all" }}>
              휴대폰 인증 후 업체명 · 영업 지역 · 공종만 적으면<br />바로 견적 요청을 보고 입찰할 수 있어요.
            </p>
            <button onClick={() => goSignup("form")} className="gg-cta" style={{ ...btn, background: NAVY, color: "#fff" }}>
              휴대폰으로 가입하기
            </button>
            <div style={{ fontSize: 12, color: TEXT3, marginTop: 12 }}>서류 · 보증금은 가입 뒤에 원할 때 내면 됩니다</div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #EFEAE0", textAlign: "center", maxWidth: 520, margin: "24px auto 0" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 4 }}>이미 가입하셨나요?</div>
            <div style={{ fontSize: 12, color: TEXT3, marginBottom: 14, lineHeight: 1.6 }}>가입한 휴대폰 번호로 로그인하세요.</div>
            <button onClick={goCompanyLogin} style={{ ...btn, background: "transparent", color: NAVY, border: `1px solid ${NAVY}` }}>업체 로그인</button>
          </div>
        </div>

        {/* ══ 이하 유지(삭제 금지) : FAQ ══ */}
        <div style={{ padding: "36px 0" }}>
          <div style={{ textAlign: "center", fontSize: "clamp(22px,4.5vw,26px)", fontWeight: 900, color: NAVY, marginBottom: 20 }}>자주 묻는 질문</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 620, margin: "0 auto" }}>
            {FAQS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
      </div>

      {/* ── 사업자정보 푸터 + 개인정보/이용약관 (법적 필수 · 삭제 금지) ── */}
      <div style={{ padding: "20px 20px 96px", background: "#EFEAE0", borderTop: "1px solid #E8E1D8", textAlign: "center" }}>
        <AppFooter />
        <button onClick={() => { window.location.href = "/"; }} style={{ marginTop: 16, background: "transparent",
          border: "1px solid #D6D0C8", borderRadius: 99, padding: "7px 20px", cursor: "pointer",
          fontSize: 13, color: TEXT3, fontFamily: SANS }}>공간마켓 홈으로</button>
      </div>

      {/* ── 모바일 하단 고정 CTA (골드 그라데이션 단일 버튼 · 검은테두리 제거 + 옅은 베이지 띠 + shimmer) ── */}
      <style>{`
        .gm-beta-dot{ animation: gmBlink 1.8s infinite }
        /* 업체의 하루 — 넓은 화면에서는 2열, 더 넓으면 사진이 옆으로(고객 랜딩과 같은 규칙) */
        @media (min-width: 780px){ .gm-pjourney{ grid-template-columns: repeat(2,1fr); gap: 18px } }
        @media (min-width: 1040px){ .gm-pjourney > div{ grid-template-columns: 240px 1fr; align-items: stretch }
          .gm-pjourney img{ height: 100% !important; min-height: 190px } }
        @keyframes gmBlink{ 0%,100%{ opacity:1 } 50%{ opacity:.4 } }
        .gm-partner-sticky-cta{ display:none }
        @media (max-width: 640px){ .gm-partner-sticky-cta{ display:flex } }
        @media (min-width: 700px){ .gm-grade-list{ grid-template-columns: 1fr 1fr !important } }
        @media (max-width: 380px){
          .gm-topnav{ padding: 8px 12px !important }
          .gm-tab{ padding: 6px 12px !important; font-size: 12px !important }
        }
        .gm-sticky-gold::after{ content:''; position:absolute; top:0; left:-100%; width:100%; height:100%;
          background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent); transition:.6s }
        .gm-sticky-gold:hover::after{ left:100% }
        .gm-sticky-gold:hover{ transform:translateY(-2px);
          box-shadow:0 12px 32px rgba(200,168,106,.42), 0 0 0 1px rgba(232,220,192,.9) inset }
        .gm-sticky-gold:active{ transform:translateY(0) }
        .gm-pinput:focus{ border-color:#C8A86A !important; background:#fff !important }
        .gm-upload:hover{ border-color:#C8A86A }
        .gm-grade-opt:hover{ border-color:#C8A86A !important; transform:translateY(-1px);
          box-shadow:0 4px 16px rgba(200,168,106,.15) }
        button:active{ transform: scale(.985) }
      `}</style>
      <div className="gm-partner-sticky-cta" style={{ position: "fixed", left: 16, right: 16,
        bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 900,
        justifyContent: "center", pointerEvents: "none" }}>
        <button className="gm-sticky-gold gg-cta gg-cta-gold" onClick={() => goSignup("floating")} style={{
          pointerEvents: "auto", height: 52, maxWidth: 420, flex: 1, borderRadius: 999,
          border: "1px solid #E9DDC0", background: "linear-gradient(180deg,#D9C49A 0%,#C8A86A 100%)",
          color: NAVY, fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em", cursor: "pointer",
          fontFamily: SANS, position: "relative", overflow: "hidden",
          transition: "transform .25s cubic-bezier(.4,0,.2,1), box-shadow .25s",
          boxShadow: "0 8px 24px rgba(200,168,106,.28), 0 0 0 1px rgba(232,220,192,.8) inset, 0 1px 2px rgba(255,255,255,.6) inset" }}>
          1분 가입하기
        </button>
      </div>
    </div>
  );
}
