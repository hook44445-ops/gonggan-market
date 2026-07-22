import { useState } from "react";
import { SHOW_DEBUG_UI } from "../constants/release";
import AppFooter from "../components/AppFooter";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

// ── HTML 시안(gonggan_final_ALL.html) 이식 · 고객 랜딩 ─────────────────────────
// 디자인/레이아웃/컬러/타이포는 시안과 거의 동일. 기능·라우팅·상태는 기존 그대로
// (onSelectRole / '/partner' 이동 / onResume / onAdminTap). 맨 끝에 SEO 소개문·FAQ·
// 사업자정보 푸터·약관 링크를 자연스럽게 유지(법적 필수·삭제 금지).

// 시안 컬러 토큰
const SK = {
  bg: "#F9F6F2", ink: "#121A16", forest: "#1A2E22", gold: "#C8A86A",
  line: "#E8E1D8", muted: "#8A857E", surface: "#FFFFFF",
};
const SANS = "'Pretendard','Apple SD Gothic Neo',sans-serif";

// 시공사례(시안 동일 카피 · 프로젝트 asset 이미지)
const CASES = [
  { img: "/images/gonggan-case1.webp", title: "32평 아파트 거실 리모델링", meta: "서울 강남구 · 2,400만원 · 14일 완공" },
  { img: "/images/gonggan-case2.webp", title: "24평 주방·아일랜드 교체",   meta: "성남시 · 1,100만원 · 7일 완공" },
  { img: "/images/gonggan-case3.webp", title: "마포구 상가 카페 인테리어", meta: "마포구 · 3,200만원 · 21일 완공" },
];

// FAQ(유지 · 삭제 금지)
const FAQ_ITEMS = [
  { q: "견적 요청은 무료인가요?", a: "네. 견적 요청과 업체 비교는 무료입니다." },
  { q: "공간안전결제는 무엇인가요?", a: "공사비를 바로 지급하지 않고 단계 확인 후 안전하게 정산하는 구조입니다." },
  { q: "업체는 어떻게 검증되나요?", a: "사업자 정보, 시공 이력, 서류 확인을 거친 업체만 연결됩니다." },
  { q: "분쟁이 생기면 어떻게 하나요?", a: "계약, 채팅, 사진, 진행기록이 저장되어 프로젝트 기록을 확인할 수 있습니다." },
];

function FaqRow({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: SK.surface, border: `1px solid ${SK.line}`, borderRadius: 14, overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, padding: "15px 16px", background: "transparent", border: "none",
          cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: SK.ink, lineHeight: 1.4 }}>Q. {q}</span>
        <span style={{ fontSize: 15, color: SK.gold, flexShrink: 0,
          transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>⌄</span>
      </button>
      {open && <div style={{ padding: "0 16px 15px", fontSize: 13, color: SK.muted, lineHeight: 1.65 }}>{a}</div>}
    </div>
  );
}

const btnBase = {
  padding: "15px 26px", borderRadius: 999, border: "none", fontWeight: 800, fontSize: 15,
  cursor: "pointer", transition: "transform .08s, opacity .15s", display: "inline-flex",
  justifyContent: "center", alignItems: "center", gap: 8, width: "100%", fontFamily: SANS,
};

export default function LandingScreen({ onSelectRole, onAdminTap, hasSavedAccounts = false, onResume }) {
  const [versionTapCount, setVersionTapCount] = useState(0);

  useDocumentMeta({
    title: "공간마켓 — 좋은 공간과 좋은 이야기가 모이는 곳",
    description: "믿을 수 있는 인테리어 업체 비교부터 계약, 에스크로 안전결제, 시공 기록까지. 집·상가·리모델링을 안전하게 진행하세요.",
    path: "/",
  });

  const goConsumer = () => onSelectRole("consumer");
  const goPartner  = () => { window.location.href = "/partner"; };

  return (
    <div style={{ background: SK.bg, color: SK.ink, fontFamily: SANS, minHeight: "100vh",
      letterSpacing: "-0.02em", WebkitFontSmoothing: "antialiased" }}>
      {SHOW_DEBUG_UI && (
        <div style={{ background: "#1a1a1a", color: "#00ff88", textAlign: "center", padding: "4px 0",
          fontSize: 10, fontFamily: "monospace" }}>
          ▶ landing(시안 이식) sha:{typeof __GIT_SHA__ !== "undefined" ? __GIT_SHA__ : "?"} · MODE:{import.meta.env.MODE}
        </div>
      )}

      {/* ── TOPNAV (sticky · 고객/파트너 탭) ─────────────────────────── */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(249,246,242,.85)",
        backdropFilter: "blur(16px) saturate(180%)", WebkitBackdropFilter: "blur(16px) saturate(180%)",
        borderBottom: `1px solid ${SK.line}`, display: "flex", justifyContent: "space-between",
        alignItems: "center", padding: "10px 20px" }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em" }}>
          공간마켓<span style={{ color: SK.gold, fontWeight: 400 }}> BETA</span>
        </div>
        <div style={{ display: "flex", gap: 6, background: "#ECE7DF", padding: 4, borderRadius: 999 }}>
          <button style={{ padding: "8px 16px", borderRadius: 999, border: "none", fontWeight: 700,
            fontSize: 13, cursor: "pointer", fontFamily: SANS, background: SK.ink, color: "#fff" }}>고객</button>
          <button onClick={goPartner} style={{ padding: "8px 16px", borderRadius: 999, border: "none",
            fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: SANS, background: "transparent",
            color: SK.muted }}>파트너</button>
        </div>
      </div>

      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 20px" }}>
        {/* 다시 오셨네요 — 저장 계정 */}
        {hasSavedAccounts && (
          <button onClick={() => onResume?.()} style={{ ...btnBase, marginTop: 14, background: SK.forest,
            color: "#fff", maxWidth: 520 }}>
            👋 다시 오셨네요 · 저장된 계정으로 시작
          </button>
        )}

        {/* ── HERO ──────────────────────────────────────────────────── */}
        <div style={{ position: "relative", borderRadius: 32, overflow: "hidden",
          margin: "20px 0 36px", minHeight: 560, background: "#E8E0D1", display: "flex", alignItems: "center" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: `url('/images/gonggan-hero.webp')`,
            backgroundSize: "cover", backgroundPosition: "center", filter: "saturate(.9) brightness(1.05)" }} />
          <div style={{ position: "absolute", inset: 0, background:
            "linear-gradient(90deg, #F9F6F2 0%, rgba(249,246,242,.92) 38%, rgba(249,246,242,.15) 72%, rgba(249,246,242,0) 100%)" }} />
          <div style={{ position: "relative", zIndex: 2, padding: "36px 32px", maxWidth: 440 }}>
            <div style={{ display: "inline-flex", gap: 6, alignItems: "center", background: SK.forest,
              color: "#E8E1D8", padding: "6px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700,
              letterSpacing: ".02em", marginBottom: 16 }}>
              사업자·보험·시공이력 검증 완료
            </div>
            <h1 style={{ fontSize: "clamp(30px,6vw,44px)", fontWeight: 800, lineHeight: 1.08,
              letterSpacing: "-0.04em", wordBreak: "keep-all", margin: 0 }}>
              인테리어, 아무에게나<br />맡길 수 없으니까
            </h1>
            <p style={{ fontSize: 15, color: SK.muted, margin: "14px 0 22px", lineHeight: 1.6, wordBreak: "keep-all" }}>
              집수리부터 상가 리모델링까지. 검증된 업체 3곳 견적을 1분만에 비교하세요. 가입비 0원 · 견적 무료.
            </p>
            <button onClick={goConsumer} style={{ ...btnBase, maxWidth: 340, background: SK.ink, color: "#fff" }}>
              무료 비교견적 받기 →
            </button>
            <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
              {["✓ 검증업체만", "✓ 기록 보호", "✓ 단계별 정산"].map((t) => (
                <span key={t} style={{ fontSize: 11, color: SK.muted }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── 시공사례 ──────────────────────────────────────────────── */}
        <div style={{ padding: "36px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
            <h2 style={{ fontSize: "clamp(22px,4.5vw,26px)", fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>시공사례</h2>
            <span style={{ fontSize: 12, color: SK.muted }}>검증된 업체가 시공했습니다</span>
          </div>
          <div className="gm-grid" style={{ display: "grid", gap: 16 }}>
            {CASES.map((c) => (
              <div key={c.title} className="gm-card" style={{ background: SK.surface, border: `1px solid ${SK.line}`,
                borderRadius: 24, overflow: "hidden", transition: "transform .25s, box-shadow .25s" }}>
                <img src={c.img} alt={c.title} loading="lazy" style={{ width: "100%", height: 220, objectFit: "cover", display: "block" }} />
                <div style={{ padding: "16px 18px" }}>
                  <b style={{ fontSize: 15 }}>{c.title}</b>
                  <div style={{ fontSize: 11, color: SK.muted, marginTop: 4 }}>{c.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── DARK CTA ──────────────────────────────────────────────── */}
        <div style={{ background: SK.forest, color: "#E8E1D8", borderRadius: 32, padding: "48px 28px",
          textAlign: "center", margin: "28px 0" }}>
          <h2 style={{ fontSize: "clamp(20px,4.5vw,24px)", fontWeight: 800, lineHeight: 1.35, margin: 0 }}>
            아직도 발품 파세요?<br />공간마켓이 검증까지 끝냈습니다
          </h2>
          <p style={{ opacity: .6, fontSize: 13, marginTop: 8 }}>사업자·시공이력 검증 업체와 안전하게 비교하세요</p>
          <button onClick={goConsumer} style={{ ...btnBase, maxWidth: 340, background: "#fff",
            color: SK.forest, margin: "20px auto 0" }}>
            무료 비교견적 받기
          </button>
        </div>

        {/* ══ 이하 유지(삭제 금지) : SEO 소개문 · FAQ · 사업자정보 푸터 · 약관 ══ */}

        {/* ── SEO 소개문 ────────────────────────────────────────────── */}
        <div style={{ padding: "36px 0 8px" }}>
          <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 900, color: SK.forest, marginBottom: 16 }}>공간마켓</h2>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "#3A4A40", margin: "0 0 12px" }}>
            공간마켓은 우리 동네 집수리·인테리어·리모델링 업체를 쉽고 편하게 비교하고 상담할 수 있는 플랫폼입니다.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "#3A4A40", margin: "0 0 20px" }}>
            집수리, 도배, 장판, 욕실, 주방, 리모델링, 상업공간, 부분시공 등 견적이 필요한 다양한 시공에 맞는 업체를 찾아 견적을 비교하고 상담할 수 있습니다.
          </p>
          <div style={{ fontSize: 15, fontWeight: 800, color: SK.ink, marginBottom: 12 }}>주요 기능</div>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 4px", display: "flex", flexDirection: "column", gap: 9 }}>
            {["무료 견적 요청", "여러 업체 비교", "실시간 채팅 상담", "프로젝트 진행 관리",
              "시공 사진 및 진행 과정 확인", "업체 리뷰 및 평점 확인", "안전한 결제 시스템"].map((f) => (
              <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 14, lineHeight: 1.6, color: "#3A4A40" }}>
                <span style={{ color: SK.gold, fontWeight: 900, flexShrink: 0 }}>•</span><span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ── FAQ ───────────────────────────────────────────────────── */}
        <div style={{ padding: "36px 0" }}>
          <div style={{ textAlign: "center", fontSize: "clamp(22px,4.5vw,26px)", fontWeight: 900, color: SK.ink, marginBottom: 20 }}>자주 묻는 질문</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 620, margin: "0 auto" }}>
            {FAQ_ITEMS.map((f) => <FaqRow key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>
      </div>

      {/* ── 사업자정보 푸터 (법적 필수 · 삭제 금지) ───────────────────── */}
      <div style={{ padding: "20px 20px 36px", background: "#EFEAE0", borderTop: `1px solid ${SK.line}`, textAlign: "center" }}>
        <AppFooter />
        <div style={{ height: 1, background: SK.line, margin: "12px auto 14px", maxWidth: 260, opacity: 0.7 }} />
        <div onClick={() => {
            const next = versionTapCount + 1;
            setVersionTapCount(next);
            if (next >= 5) { setVersionTapCount(0); onAdminTap && onAdminTap(); }
          }}
          style={{ fontSize: 12, color: SK.muted, cursor: "default", userSelect: "none", letterSpacing: "0.03em", fontWeight: 500 }}>
          공간마켓 v1.0.0
        </div>
      </div>

      {/* 반응형 · 카드 hover (시안 규칙) */}
      <style>{`
        @media (min-width: 780px){ .gm-grid{ grid-template-columns: repeat(3,1fr) } }
        .gm-card:hover{ transform: translateY(-3px); box-shadow: 0 12px 32px rgba(18,26,22,.08) }
        button:active{ transform: scale(.985) }
      `}</style>
    </div>
  );
}
