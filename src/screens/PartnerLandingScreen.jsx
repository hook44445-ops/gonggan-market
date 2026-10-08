import { useState, useEffect, useRef } from "react";
import BreathTrustSection from "../components/BreathTrustSection"; // v2.0: 호흡과 신뢰(Add Only)
import AppFooter from "../components/AppFooter";
import InviteWelcome from "../components/InviteWelcome"; // 사업자정보 푸터(법적 필수 · 삭제 금지)
import CompanyCard from "../components/CompanyCard";
import { LADDER, limitText } from "../lib/partnerTier";
import { PARTNER_DEPOSIT_NOTE, PATENT_LABEL, PATENT_MESSAGE } from "../utils/siteSeo";
import { trackPartnerFunnel } from "../lib/partnerFunnel";
import { SHOW_BETA_UI, PAYMENTS_LIVE } from "../constants/release";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { useJsonLd } from "../hooks/useJsonLd";
import { partnerFaq, pageSeo, faqSchema, breadcrumbSchema } from "../utils/siteSeo";
import { applyRoleTheme } from "../utils/roleTheme";
import { RequestPings, WorryStamps, Reveal, useInView, AdVideo, ProofChips } from "../components/landing/LandingMotion";

// ── Design tokens ─────────────────────────────────────────────────────────────
const NAVY  = "#16202E";   // 파트너 = 쿨 네이비(앱 안 [data-role="company"] 와 같은 값 · 09-30 대표 「푸른 쿨톤 · 신뢰적 요소로」)
const NAVY2 = "#1D2A3D";
const NAVY3 = "#2A3A52";
const FOREST = "#16294A"; // 파트너 히어로 배경(딥 네이비)
const OK    = "#24406B";  // 타임라인 배지/점(네이비)
const GOLD  = "#C8A86A";
const GOLDD = "#A98B4E";
const GOLDB = "rgba(200,168,106,0.12)";
const WHITE = "#FFFFFF";
const OFF   = "#F3F5F8";
const TEXT2 = "#3A4657";
const TEXT3 = "#6B7686";
const SANS  = "'Pretendard','Apple SD Gothic Neo',sans-serif";

// 한도 계단 한 칸마다 엠블럼 · 금액 · 한 줄(대표 09-25 구간표 — lib/partnerTier 한도와 같은 값).
//   «보증금 · 1,500만원 미만» 처럼 보증금을 걸어도 작아 보이던 칸을 «2,000만원까지 · 면허 없으면 1,500만원 미만»으로.
const LADDER_VIEW = {
  none:      { emblem: "join",      amount: "카드 보기",    note: "500만원까지 공사가 보여요 · 입찰은 사업자등록 뒤" },
  biz:       { emblem: "biz",       amount: "500만원",      note: "입찰·계약이 열려요 · 홈택스 당일 발급" },
  insurance: { emblem: "insurance", amount: "1,000만원",    note: "시공보험 증권 · 보험이 없으면 보증금 200만원으로도" },
  premium:   { emblem: "deposit",   amount: "2,000만원~",   note: "공간보증 200만원부터 · 면허 없으면 1,500만원 미만" },
  license:   { emblem: "license",   amount: "최대 1억원",   note: "실내건축공사업 등록 · 보증금의 10배까지" },
};

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

// ── 사장님 걱정 → 도장 → 답 (대표 09-30 「업체의 니즈 · 입점하고 싶게 · 유머와 매력으로」) ──
// ⚠️ 답은 실제로 있는 것만: 요청한 고객 연결 · 요청서(공간·범위·예산) · 계약·대화·사진 기록 · 증빙 엠블럼과 한도 계단(lib/partnerTier)
//    · 후기 카드 QR(#878) · 월요일 우리 동네 새 요청(171). 결제·보관·수수료 약속은 하지 않는다.
const PARTNER_WORRIES = [
  { icon: "/images/landing/clay-bell-navy.webp", q: "광고비는 매달 꼬박꼬박 나가는데, 전화기는 조용~",
    a: <>견적을 <b>요청한 고객에게만</b> 연결돼요. 광고비 0원, 키워드 경쟁도 0.</> },
  { icon: "/images/landing/clay-clipboard.webp", q: "가 보니 «그냥 가격만 알아보려고요.» 기름값만 날렸네요.",
    a: <>요청서에 <b>공간 · 범위 · 예산</b>이 적혀 와요. 헛걸음은 줄이고, 될 현장에 집중.</> },
  { icon: "/images/notif/viewed.webp", q: "다 끝나고 나서 «이것도 해 주기로 하셨잖아요?»",
    a: <>계약 · 대화 · 현장 사진이 날짜별로 남아요. <b>기록이 사장님 편을 들어 줍니다.</b></> },
  { icon: "/images/emblem/license-sm.webp", q: "실력은 자신 있는데, 작은 업체라고 안 믿어 줘요.",
    a: <>서류를 낼 때마다 <b>엠블럼이 붙고, 맡을 수 있는 공사가 커져요.</b> 신뢰를 눈에 보이게.</> },
  { icon: "/images/notif/lounge.webp", q: "끝내주게 끝낸 현장, 자랑할 데가 없어요.",
    a: <>받은 후기를 <b>QR 들어간 홍보 카드</b>로 만들어요. 끝난 공사가 다음 고객을 데려옵니다.</> },
  { icon: "/images/notif/region.webp", q: "월요일 아침, 커피보다 먼저 이번 주 일감 걱정.",
    a: <>월요일마다 <b>우리 동네 새 견적 요청</b>을 모아 알려 드려요. 커피는 편하게 드세요.</> },
];

// 히어로 알림 — 앱에 실제로 오는 알림의 «모양» 예시(업종·금액은 예시)
const PARTNER_PINGS = [
  { icon: "/images/landing/clay-bell-navy.webp", t: "새 견적 요청 · 예시", b: "아파트 부분 · 도배, 바닥", s: "20평대 · 300~500만원 · 우리 동네" },
  { icon: "/images/notif/viewed.webp", t: "견적 확인 · 예시", b: "고객이 보낸 견적을 확인했어요", s: "대화방에서 이어서 이야기해요" },
  { icon: "/images/notif/region.webp", t: "월요일 아침 · 예시", b: "이번 주 우리 동네 새 요청이 모였어요", s: "알림함 · 폰 알림" },
  { icon: "/images/landing/clay-bell-navy.webp", t: "새 견적 요청 · 예시", b: "카페/식당 · 조명·전기, 필름", s: "1,000~3,000만원" },
];

function LadderReveal({ children }) {
  const [ref, inView] = useInView({ threshold: 0.2 });
  return <div ref={ref} className={`lm-ladder ${inView ? "is-in" : ""}`} style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>{children}</div>;
}

// ── 약속대로 시공했다면, 기록이 말해 줍니다 — 업체 관점의 단열재 예시(대표 10-08 · 특허출원 10-2026-0192050) ──
// 고객 랜딩 «마감하면 안 보이는 단열재 두께» 섹션과 같은 그림(힉스필드 · 글자·숫자 없음), 6cm/3cm는 HTML.
// ⚠️ 앱에 있는 것만: 최종 견적서 자재 기록(두께·규격 자유입력 · PlatformEstimateModal) · 단계 사진(촬영 위치·시각) ·
//    대화방 기록 · 이의 신청 시 남은 단계 보류. «지켜 드립니다·분쟁이 생기면·나란히 비교»는 쓰지 않는다 — «증거로 함께 확인 · 기록이 됩니다».
const PARTNER_PROOF = [
  { no: "01", t: "견적서에 규격까지", d: "최종 견적서의 자재 기록 칸에 «단열재 6cm»처럼 두께 · 규격을 적어 둡니다." },
  { no: "02", t: "닫기 전에 사진 한 장", d: "착공 · 중간 · 완료마다 현장 사진을 올리면 촬영 위치 · 시각이 함께 기록됩니다." },
  { no: "03", t: "승인한 단계만큼",
    d: PAYMENTS_LIVE
      ? "고객이 사진을 확인 · 승인한 단계만큼 지급되는 방식입니다. 이의가 들어오면 남은 단계만 보류됩니다."
      : "고객이 사진을 확인 · 승인한 단계만큼 금액이 확정되는 방식입니다(대금은 지금 계약서대로). 이의가 들어오면 남은 단계만 보류됩니다." },
];

function PartnerProof() {
  return (
    <section className="lm-pp" aria-labelledby="lm-pp-h">
      <div className="lm-pp-grid">
        <Reveal>
          <div className="lm-pp-ip">{PATENT_LABEL}</div>
          <h2 id="lm-pp-h" className="lm-pp-h">약속대로 시공했다면,<br /><em>기록이 말해 줍니다</em></h2>
          <p className="lm-pp-lead">
            단열재를 6cm로 견적 냈다면, 마감한 뒤에는 고객도 두께를 알 수 없습니다. 최종 견적서에 적은 자재 · 규격과
            단계마다 올린 시공 사진이 함께 남아, 견적서의 약속과 시공 중 사진과 기록을 증거로 함께 확인할 수 있습니다.
            <b> 약속대로 시공한 업체에게는 그 사실을 보여 주는 기록이 됩니다.</b>
          </p>
        </Reveal>
        <Reveal delay={0.1} className="lm-pp-scene">
          <img src="/images/landing/insulation-section.webp" srcSet="/images/landing/insulation-section-sm.webp 900w, /images/landing/insulation-section.webp 1600w"
            sizes="(min-width: 960px) 540px, 100vw" loading="lazy"
            alt="마감면은 똑같지만 옆 단면을 보면 왼쪽은 단열재가 두껍고 오른쪽은 얇은 두 벽체 시료" />
          <span className="lm-pp-mm lm-pp-mm-l">6cm</span>
          <span className="lm-pp-mm lm-pp-mm-r">3cm</span>
          <span className="lm-pp-same">마감면은 똑같아요</span>
        </Reveal>
      </div>
      <Reveal delay={0.05}>
        <ol className="lm-pp-flow">
          {PARTNER_PROOF.map((f) => (
            <li key={f.no}><span className="lm-pp-no">{f.no}</span><span><b>{f.t}</b><span>{f.d}</span></span></li>
          ))}
        </ol>
        <p className="lm-pp-msg"><b>{PATENT_LABEL}</b> · {PATENT_MESSAGE}</p>
      </Reveal>
    </section>
  );
}

// ── FAQ section(V1.5) ──────────────────────────────────────────────────────────
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: WHITE, border: `1px solid #E6EBF2`, borderRadius: 12,
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
          borderTop: `1px solid #EDF1F7`, paddingTop: 14,
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
  // 업체 가입 깔때기 1단계(10-02) — 사람만 센다(봇은 vercel rewrite 로 프리렌더를 받아 이 화면을 실행하지 않는다)
  useEffect(() => { trackPartnerFunnel("partner_landing_view"); }, []);

  const [heroRef, heroVis] = useVisible(0.05);

  const SEO = pageSeo(SHOW_BETA_UI)["/partner"];
  useDocumentMeta({ title: SEO.title, description: SEO.description, path: "/partner" });

  // 공급자(업체) 쪽 구조화 데이터 — 「가입비·수수료가 얼마냐」가 업체의 첫 질문이라
  // FAQ 를 그대로 구조화해 답변엔진이 숫자를 정확히 인용하게 한다.
  useJsonLd("partner", [
    faqSchema(FAQS, undefined, "/partner"),
    breadcrumbSchema([["공간랜드", "/"], ["파트너 입점 안내", "/partner"]]),
  ]);

  // 가입·로그인 — 입구는 하나다. 앱의 /?login=company 가 휴대폰 인증 → 새 번호면 3단계 가입
  // (업체명·지역·공종, screens/CompanyOnboarding.jsx) → 바로 기본 파트너로 이어진다.
  // 예전엔 이 페이지만의 신청서(사업자등록증 필수) → 관리자 승인 → 승인된 번호+사업자번호로만
  // 로그인 관문 통과 → 보증금 등급 → 표시용 계좌 입금 안내였다. 입구가 둘로 갈라져 있었고,
  // 관리자 승인 전엔 들어올 수 없었다(대표: 「들어오는 건 쉽게」).
  const goSignup = (source = "hero") => {
    track("partner_join_click", { source }); // V1.5 전환 이벤트(GA — 설치돼 있지 않으면 아무 데도 안 남는다)
    trackPartnerFunnel("partner_join_click", { source }); // 10-02 업체 가입 깔때기(관리자 «숫자 보기»)
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
    fontSize: 11, fontWeight: 700, background: "#EBEFF7", color: OK,
    border: "1px solid #B6C5DE", whiteSpace: "nowrap", flexShrink: 0,
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
    { b: "공사 카드 보기",   t: "가입하면 500만원까지 카드가 보여요 — 입찰은 사업자등록 확인 뒤", badge: "기본" },
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
    <div className="lm-cool" style={{ fontFamily: SANS, background: OFF, color: NAVY, minHeight: "100vh", letterSpacing: "-0.02em", WebkitFontSmoothing: "antialiased", overflowX: "hidden" }}>

      {/* ── TOPNAV (고객/파트너 · 라우팅 유지) ─────────────────────── */}
      <div className="gm-topnav" style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(243,245,248,.88)",
        backdropFilter: "blur(16px) saturate(180%)", WebkitBackdropFilter: "blur(16px) saturate(180%)",
        borderBottom: "1px solid #E2E7EF", display: "flex", justifyContent: "space-between",
        alignItems: "center", padding: "10px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <img src="/icons/gm-logo.svg" alt="" aria-hidden="true" width="30" height="30"
            style={{ width: 30, height: 30, borderRadius: 9, display: "block", flexShrink: 0 }} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: "#A98B4E", letterSpacing: "0.08em", marginBottom: 3, whiteSpace: "nowrap" }}>스마트한 프리미엄 인테리어 비교견적</span>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em" }}>공간랜드</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, background: "#E4E9F1", padding: 4, borderRadius: 999 }}>
          <button className="gm-tab" onClick={() => { window.location.href = "/"; }} style={{ padding: "8px 16px", borderRadius: 999,
            border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: SANS,
            background: "transparent", color: TEXT3 }}>고객</button>
          <button className="gm-tab" style={{ padding: "8px 16px", borderRadius: 999, border: "none", fontWeight: 700,
            fontSize: 13, cursor: "pointer", fontFamily: SANS, background: NAVY, color: "#fff" }}>파트너</button>
        </div>
      </div>

      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 20px" }}>
        <InviteWelcome style={{ marginTop: 14, maxWidth: 520 }} />
        {/* ── NAVY(웜 잉크) HERO ──────────────────────────────────── */}
        {/* 히어로 그림(힉스필드 09-25): 완성된 공간을 보는 파트너 — 얼굴·글자 없음. 왼쪽은 글자 자리라 어둡게 덮는다. */}
        <div ref={heroRef} className="gm-phero" style={{
          background: `linear-gradient(100deg, rgba(22,41,74,.97) 0%, rgba(22,41,74,.86) 48%, rgba(22,41,74,.30) 100%), url(/images/partner/hero-cool-wide.webp) 70% center/cover no-repeat, ${FOREST}`,
          color: "#F9F6F2", borderRadius: 28, padding: "32px 24px 28px", margin: "16px 0 28px",
          position: "relative", overflow: "hidden", minHeight: 320 }}>
          <h1 style={{ fontSize: "clamp(24px,6vw,36px)", fontWeight: 800, lineHeight: 1.1, margin: 0, wordBreak: "keep-all" }}>
            광고비 없이 수주하는<br /><span style={{ color: GOLD }}>공간파트너</span>
          </h1>
          <p style={{ opacity: .6, fontSize: 14, margin: "12px 0", lineHeight: 1.7 }}>
            {/* ⚠️ 2026-09-23: 예전 문구는 「당근·숨고 광고비 쓰지 마세요. 예치된 고객만 연결됩니다.」였다.
                ① 경쟁사 실명을 깎아내리는 말은 품격에도, 비교광고 규정에도 맞지 않는다.
                ② «예치된 고객»은 베타에 없는 약속이다(예치·보관 문구 금지 — 안전결제는 토스 승인 뒤에 열린다). */}
            광고비를 먼저 쓰지 않아도 됩니다. 견적을 요청한 고객에게만 연결됩니다.
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0 2px" }}>
            {["광고비 0원", "가입 1분", "PG 가입 없이", "서류는 원할 때 하나씩"].map((t) => (
              <span key={t} style={{ fontSize: 12, fontWeight: 700, color: GOLD, border: "1px solid rgba(200,168,106,.45)",
                background: "rgba(200,168,106,.10)", borderRadius: 999, padding: "5px 11px" }}>{t}</span>
            ))}
          </div>
          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => goSignup("hero")} style={{ ...btn, maxWidth: 220, background: "#fff", color: NAVY }}>
              1분 가입
            </button>
            <button onClick={goCompanyLogin} style={{ ...btn, maxWidth: 240, background: "transparent",
              border: "1px solid rgba(255,255,255,.25)", color: "#fff" }}>
              이미 파트너신가요? 로그인 →
            </button>
          </div>
          {/* 신뢰 요소 — 서류를 낸 만큼 붙는 표시(관리자가 확인한 서류에만 · lib/partnerTier 계단과 같은 넷) */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#C9D6EA", letterSpacing: ".04em" }}>관리자가 서류를 확인한 업체에만 붙어요</div>
            <ProofChips base={0.4} items={[["biz", "사업자"], ["insurance", "시공보험"], ["deposit", "보증금"], ["license", "실내건축 면허"]]} />
          </div>
          {/* 앱에서 실제로 오는 알림의 모양 — 톡톡 도착(예시) */}
          <RequestPings items={PARTNER_PINGS} />
        </div>

        {/* ── 사장님 걱정 → 도장 «쾅» → 답 ── */}
        <div style={{ padding: "6px 0 34px" }}>
          <Reveal>
            <div style={{ fontSize: 12, fontWeight: 800, color: GOLDD, letterSpacing: "0.12em", marginBottom: 8 }}>사장님들 속사정, 압니다</div>
            <h2 style={{ fontSize: "clamp(22px,4.8vw,30px)", fontWeight: 800, letterSpacing: "-0.035em", margin: "0 0 6px", lineHeight: 1.3, wordBreak: "keep-all" }}>
              현장보다 힘든 건, 현장 밖의 일이죠
            </h2>
            <p style={{ fontSize: 13.5, color: TEXT3, lineHeight: 1.7, margin: "0 0 18px" }}>카드를 누르면 도장을 한 번 더 찍어요.</p>
          </Reveal>
          <WorryStamps items={PARTNER_WORRIES} cols3 />
        </div>

        {/* ── 23초 광고 — 고객이 비교하고, 사장님은 새 요청을 받는다 ── */}
        <Reveal style={{ padding: "0 0 34px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: GOLDD, letterSpacing: "0.12em", marginBottom: 12 }}>23초로 보는 공간랜드</div>
          <AdVideo label="공간랜드 소개 영상 — 고객의 비교견적과 파트너의 새 요청" />
        </Reveal>

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
              고객을 연결해 주는 곳은 많습니다. 공간랜드는 그 뒤 — 견적·계약·현장 사진이 한곳에 남아, 다투는 자리가 줄어듭니다.
            </p>
          </div>
          <div className="gm-pjourney" style={{ display: "grid", gap: 14 }}>
            {PARTNER_JOURNEY.map((j, i) => (
              <Reveal key={j.no} delay={(i % 2) * 0.1} style={{
                background: "#fff", border: "1px solid #E2E7EF", borderRadius: 20, overflow: "hidden",
                display: "grid", gridTemplateColumns: "1fr",
              }}>
                <img src={j.img} alt="" loading="lazy" aria-hidden="true"
                  style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                <div style={{ padding: "15px 17px 17px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: GOLD, letterSpacing: "0.1em" }}>{j.no}</span>
                    <span style={{ fontSize: 11.5, color: TEXT3 }}>{j.when}</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, letterSpacing: "-0.02em", lineHeight: 1.4 }}>{j.title}</div>
                  <div style={{ fontSize: 13.5, color: "#34404F", lineHeight: 1.75, marginTop: 7, wordBreak: "keep-all" }}>{j.desc}</div>
                  <div style={{ marginTop: 11, display: "inline-flex", alignItems: "center", gap: 6,
                    background: "#EEF2F8", border: "1px solid #E2E7EF", borderRadius: 999, padding: "4px 11px",
                    fontSize: 11.5, fontWeight: 700, color: "#4E5B6E" }}>
                    앱에서 · {j.proof}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* ── 약속대로 시공했다면, 기록이 말해 줍니다 — 업체의 하루 다음에 «추가»(대표 10-08 · 기존 섹션 그대로) ── */}
        <PartnerProof />

        {/* ── TIMELINE : 신청부터 수주까지 (dot 32px 일관 · 카드별 배지 · 중앙 연결선) ── */}
        <div style={{ padding: "36px 0" }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 16px" }}>가입부터 프리미엄까지</h3>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12 }}>
            {/* 연결선: dot(32px) 중앙(15px)에 정렬 */}
            <div style={{ position: "absolute", left: 15, top: 16, bottom: 16, width: 2, background: "#E2E7EF", borderRadius: 2 }} />
            {STEPS.map((s, i) => (
              <div key={i} style={{ position: "relative", zIndex: 1, display: "grid",
                gridTemplateColumns: "32px 1fr", gap: 14, alignItems: "center" }}>
                <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: "50%",
                  background: i === 0 ? NAVY : "#EBEFF7", border: i === 0 ? "2px solid " + NAVY : "2px solid #B6C5DE",
                  color: i === 0 ? "#fff" : OK, display: "flex", alignItems: "center",
                  justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{i + 1}</div>
                <div style={{ background: "#fff", border: "1px solid #E2E7EF", borderRadius: 16,
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
              <p style={{ fontSize: 12.5, color: "#9AA6B8", lineHeight: 1.6, margin: "8px 0 0", wordBreak: "keep-all" }}>
                입찰은 사업자등록 확인 뒤에 열려요(홈택스 당일 발급). 공사 1건 기준입니다.
              </p>
            </div>
            <LadderReveal>
              {LADDER.map((r, rungIdx) => {
                const premium = r.key === "premium";
                const row = LADDER_VIEW[r.key] ?? {};
                return (
                  <div key={r.key} className="lm-rung" style={{ transitionDelay: `${rungIdx * 0.14}s`, display: "flex", alignItems: "center", gap: 12,
                    background: premium ? "rgba(200,168,106,.10)" : "rgba(255,255,255,.06)",
                    border: `1px solid ${premium ? "rgba(200,168,106,.55)" : "rgba(255,255,255,.08)"}`,
                    padding: "11px 14px", borderRadius: 14, fontSize: 13 }}>
                    {row.emblem && <img src={`/images/emblem/${row.emblem}-sm.webp`} alt="" aria-hidden="true" width="34" height="34"
                      style={{ width: 34, height: 34, objectFit: "contain", flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: premium ? 800 : 700, color: premium ? GOLD : "#F9F6F2" }}>{r.label.replace(/^\+ /, "")}</div>
                      {row.note && <div style={{ fontSize: 11.5, color: "#A7B2C3", marginTop: 2, wordBreak: "keep-all" }}>{row.note}</div>}
                    </div>
                    <b style={{ color: GOLD, whiteSpace: "nowrap" }}>{row.amount ?? limitText(r.limit)}</b>
                  </div>
                );
              })}
            </LadderReveal>
            <p style={{ textAlign: "center", fontSize: 11.5, color: "#9AA6B8", lineHeight: 1.6, margin: "12px 0 22px", wordBreak: "keep-all" }}>
              {PARTNER_DEPOSIT_NOTE} · 보증금은 선택이에요
            </p>

            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#D5DCE7", margin: "0 0 10px", display: "flex", alignItems: "center", gap: 8 }}>
              의뢰인에게는 이렇게 보여요
              <span style={{ fontSize: 10.5, fontWeight: 800, color: NAVY, background: GOLD, borderRadius: 999, padding: "2px 8px" }}>예시</span>
            </div>
            <div style={{ maxWidth: 420, margin: "0 auto" }}>
              <CompanyCard company={PREMIUM_SAMPLE} />
            </div>
          </div>
        </div>

        {/* ── 끝난 공사가 홍보물이 된다 — 후기 카드(#878 · 배경 힉스필드 09-30) · 문구는 예시 ── */}
        <div className="gm-rcard-wrap" style={{ padding: "0 0 40px", display: "grid", gap: 20, alignItems: "center" }}>
          <Reveal>
            <div style={{ fontSize: 12, fontWeight: 800, color: GOLDD, letterSpacing: "0.12em", marginBottom: 8 }}>끝난 공사가 영업을 합니다</div>
            <h2 style={{ fontSize: "clamp(22px,4.8vw,30px)", fontWeight: 800, letterSpacing: "-0.035em", margin: "0 0 8px", lineHeight: 1.3, wordBreak: "keep-all" }}>받은 후기, 홍보 카드 한 장으로</h2>
            <p style={{ fontSize: 13.5, color: TEXT2, lineHeight: 1.75, margin: 0, wordBreak: "keep-all" }}>
              고객이 남긴 후기를 카드로 만들면 아래에 우리 업체 페이지 QR이 들어가요. 단톡방·명함·가게 앞 어디든 붙이세요. 사장님 대신 카드가 말합니다.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div style={{ position: "relative", aspectRatio: "4 / 5", maxWidth: 360, margin: "0 auto", borderRadius: 22, overflow: "hidden",
              background: "#1D3D2F url('/images/cards/review-bg.webp') center/cover", color: "#F4EFE4", padding: "34px 30px", boxShadow: "0 24px 60px rgba(18,26,22,.25)", display: "flex", flexDirection: "column" }}>
              <span style={{ alignSelf: "flex-start", fontSize: 10.5, fontWeight: 800, color: NAVY, background: GOLD, borderRadius: 999, padding: "2px 8px" }}>예시</span>
              <div style={{ color: "#D6A756", fontSize: 18, letterSpacing: 3, marginTop: 26 }}>★★★★★</div>
              <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.45, marginTop: 12, letterSpacing: "-0.02em", wordBreak: "keep-all" }}>“마감이 깔끔해서 집들이 때 칭찬만 들었어요.”</div>
              <div style={{ fontSize: 12.5, opacity: .7, marginTop: 12 }}>고객 후기 · 욕실 리모델링</div>
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                <div aria-hidden="true" style={{ width: 58, height: 58, borderRadius: 10, background: "#fff", display: "grid", placeItems: "center", color: NAVY, fontSize: 11, fontWeight: 900 }}>QR</div>
                <div style={{ fontSize: 12, lineHeight: 1.5, opacity: .85 }}>예시 인테리어<br /><span style={{ opacity: .7 }}>공간랜드 파트너</span></div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* ── 가입 — 입구는 하나(앱의 휴대폰 인증 → 3단계 가입) ──────────── */}
        <div id="partner-consult-form" style={{ padding: "8px 0 36px", scrollMarginTop: 16 }}>
          <div style={{ background: "#fff", border: "1px solid #E2E7EF", borderRadius: 24, padding: "24px 20px",
            maxWidth: 520, margin: "0 auto", boxShadow: "0 4px 24px rgba(18,26,22,.04)", textAlign: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: GOLD, letterSpacing: "0.14em", marginBottom: 8 }}>PARTNER</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: NAVY, letterSpacing: "-0.02em" }}>가입은 1분이면 끝나요</div>
            <p style={{ fontSize: 13.5, color: TEXT3, lineHeight: 1.7, margin: "8px 0 18px", wordBreak: "keep-all" }}>
              휴대폰 인증 후 업체명 · 영업 지역 · 공종만 적으면<br />바로 공사 카드가 보여요. 사업자등록증을 올리면 입찰이 열려요(홈택스 당일 발급).
            </p>
            <button onClick={() => goSignup("form")} className="gg-cta" style={{ ...btn, background: NAVY, color: "#fff" }}>
              휴대폰으로 가입하기
            </button>
            <div style={{ fontSize: 12, color: TEXT3, marginTop: 12 }}>서류 · 보증금은 가입 뒤에 원할 때 내면 됩니다</div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #E6EBF2", textAlign: "center", maxWidth: 520, margin: "24px auto 0" }}>
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
      <div style={{ padding: "20px 20px 96px", background: "#E6EBF2", borderTop: "1px solid #E2E7EF", textAlign: "center" }}>
        <AppFooter />
        <button onClick={() => { window.location.href = "/"; }} style={{ marginTop: 16, background: "transparent",
          border: "1px solid #CBD3DF", borderRadius: 99, padding: "7px 20px", cursor: "pointer",
          fontSize: 13, color: TEXT3, fontFamily: SANS }}>공간랜드 홈으로</button>
      </div>

      {/* ── 모바일 하단 고정 CTA (골드 그라데이션 단일 버튼 · 검은테두리 제거 + 옅은 베이지 띠 + shimmer) ── */}
      <style>{`
        .gm-beta-dot{ animation: gmBlink 1.8s infinite }
        .lm-pp{ margin: 0 0 30px; border-radius: 26px; padding: 28px 22px; color: #F4F6FA;
          background: radial-gradient(120% 80% at 0% 0%, #24406B 0%, #1A2E4E 50%, #16202E 100%) }
        .lm-pp-grid{ display: grid; gap: 20px }
        @media (min-width: 960px){ .lm-pp{ padding: 40px 40px 32px } .lm-pp-grid{ grid-template-columns: 1fr 1.1fr; gap: 36px; align-items: center } }
        .lm-pp-ip{ display: inline-block; padding: 5px 12px; border: 1px solid rgba(200,168,106,.7); border-radius: 999px; color: #D9C49A; font-size: 12px; font-weight: 800 }
        .lm-pp-h{ font-size: clamp(23px,4.8vw,32px); font-weight: 800; letter-spacing: -0.035em; line-height: 1.3; margin: 14px 0 12px; word-break: keep-all }
        .lm-pp-h em{ font-style: normal; color: #D9C49A }
        .lm-pp-lead{ font-size: 14px; line-height: 1.75; color: rgba(244,246,250,.8); margin: 0; word-break: keep-all }
        .lm-pp-lead b{ color: #fff }
        .lm-pp-scene{ position: relative; border-radius: 20px; overflow: hidden; box-shadow: 0 22px 44px rgba(0,0,0,.3) }
        .lm-pp-scene img{ display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover }
        .lm-pp-mm{ position: absolute; top: 15%; transform: translateX(-50%); padding: 4px 10px; border-radius: 999px; font-size: clamp(12px,2.6vw,15px); font-weight: 800;
          background: #16202E; color: #D9C49A; border: 1px solid rgba(200,168,106,.8) }
        .lm-pp-mm::after{ content: ""; position: absolute; left: 50%; top: 100%; width: 1px; height: clamp(10px,3vw,22px); background: rgba(22,32,46,.7) }
        .lm-pp-mm-l{ left: 28.4% } .lm-pp-mm-r{ left: 59.8% }
        .lm-pp-same{ position: absolute; right: 12px; bottom: 12px; font-size: 11.5px; font-weight: 800; color: #16202E; background: rgba(243,245,248,.93); border-radius: 999px; padding: 4px 10px }
        @media (max-width: 600px){ .lm-pp-scene img{ aspect-ratio: 4 / 3 } .lm-pp-mm-l{ left: 21.2% } .lm-pp-mm-r{ left: 63.1% } }
        .lm-pp-flow{ list-style: none; margin: 22px 0 0; padding: 0; display: grid; gap: 10px }
        @media (min-width: 780px){ .lm-pp-flow{ grid-template-columns: repeat(3,1fr) } }
        .lm-pp-flow li{ display: flex; gap: 10px; padding: 12px; border-radius: 14px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1) }
        .lm-pp-no{ flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: rgba(200,168,106,.18); color: #D9C49A; font-size: 10.5px; font-weight: 800 }
        .lm-pp-flow b{ display: block; font-size: 13.5px; font-weight: 800; letter-spacing: -0.02em }
        .lm-pp-flow li span span{ display: block; font-size: 12px; line-height: 1.55; color: rgba(244,246,250,.72); margin-top: 3px; word-break: keep-all }
        .lm-pp-msg{ font-size: 12.5px; line-height: 1.65; color: rgba(244,246,250,.75); margin: 14px 0 0; word-break: keep-all }
        .lm-pp-msg b{ color: #D9C49A }
        @media (max-width: 380px){ .lm-pp{ padding: 24px 16px; border-radius: 20px } }
        @media (max-width: 699px){ .gm-phero{ background: linear-gradient(180deg, rgba(22,41,74,.96) 0%, rgba(22,41,74,.84) 52%, rgba(22,41,74,.5) 100%), url(/images/partner/hero-cool-tall.webp) center/cover no-repeat, #16294A !important } }
        @media (min-width: 780px){ .gm-rcard-wrap{ grid-template-columns: 1.1fr 1fr; gap: 40px !important } }
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
