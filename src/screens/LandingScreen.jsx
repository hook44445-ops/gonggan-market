import { useEffect, useState } from "react";
import { SHOW_DEBUG_UI, SHOW_BETA_UI } from "../constants/release";
import { getTopReviews, getRecentPortfolios, getSeedReviews } from "../lib/supabase";
import { normalizeShowcases } from "../lib/showcases";
import { isTestCompanyName } from "../lib/testCompany";
import AppFooter from "../components/AppFooter";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

// ── HTML 시안(gonggan_FINAL_BALANCED.html) 이식 · 고객 랜딩 ────────────────────
// 디자인/레이아웃/컬러/타이포는 시안과 거의 동일. 기능·라우팅·상태는 기존 그대로
// (onSelectRole / '/partner' 이동 / onResume / onAdminTap). 맨 끝에 SEO 소개문·FAQ·
// 사업자정보 푸터·약관 링크를 자연스럽게 유지(법적 필수·삭제 금지).
// FINAL BALANCED: 히어로 서브텍스트 대비 상향(#3D3A36·w500) + A17 수직 그라데이션,
// 카드 radius 20 / 이미지 200(모바일 170), 하단 고정 CTA(sticky-cta-fix + fab-up 분리).

// 시안 컬러 토큰
const SK = {
  bg: "#F9F6F2", ink: "#121A16", forest: "#1A2E22", gold: "#C8A86A",
  line: "#E8E1D8", muted: "#8A857E", surface: "#FFFFFF",
  inkSoft: "#3D3A36", // A17 저휘도 대응 서브텍스트
};
const SANS = "'Pretendard Variable','Pretendard','Apple SD Gothic Neo',sans-serif";

// 시공사례 — 예전엔 시안 카피(«강남 2,400만원·14일 완공» 등 실제로 없던 공사)를 «검증된 업체가 시공했습니다»로
// 보였다. 이제 실제 사례를 쓴다: 고객 사진 후기 + 업체가 올린 시공 사례(업체 이름 공개). 모자라면 운영 예시를
// «예시»로 표시해 채우고, 하나도 없으면 칸을 숨긴다. 의뢰인 홈 「시공 사례」와 같은 정리(normalizeShowcases).
const CASE_COUNT = 3;

// ── 여정 네 마디 — 랜딩의 뼈대 (2026-09-23) ─────────────────────────────────
// 왜 이걸 넣나: 지금까지 랜딩 구조가 경쟁사(견적 매칭 앱)와 같았다 — 히어로 → 사례 → CTA → 설명.
//   전부 «매칭까지»만 말한다. 그런데 공간마켓이 실제로 가진 것은 매칭 «이후»다:
//   계약·채팅·현장 사진·단계가 앱에 남는다. 그래서 랜딩 자체를 공사 한 건의 흐름으로 세운다.
// ⚠️ 각 마디는 앱에 **실제로 있는 화면**만 가리킨다(없는 기능을 그리지 않는다).
const JOURNEY = [
  {
    no: "01", when: "요청한 날",
    title: "같은 조건으로 모읍니다",
    desc: "어떤 공간을 어디까지 고칠지 한 번만 적으면, 사업자등록을 확인한 업체들이 같은 조건으로 견적을 보냅니다.",
    proof: "요청서 · 업체 비교",
    img: "/images/journey/step1.webp",
  },
  {
    no: "02", when: "고르는 날",
    title: "금액만이 아니라 근거를 봅니다",
    desc: "공정·기간·보증을 나란히 놓고 비교합니다. 업체가 올린 시공 사례와 고객 후기도 같은 자리에서 확인합니다.",
    proof: "견적 비교 · 시공 사례",
    img: "/images/journey/step2.webp",
  },
  {
    no: "03", when: "공사하는 동안",
    title: "오늘 무엇을 할 차례인지 보입니다",
    desc: "착공·중간·완료 단계가 화면 맨 위에 있고, 현장 사진과 주고받은 말이 그날짜에 붙습니다.",
    proof: "진행 화면 · 현장 사진",
    img: "/images/journey/step3.webp",
  },
  {
    no: "04", when: "공사가 끝난 뒤",
    title: "끝나도 기록은 남습니다",
    desc: "계약 내용과 단계별 사진이 그대로 남아, 하자나 추가비 이야기가 나와도 말이 아니라 기록으로 확인합니다.",
    proof: "계약서 · 진행 기록",
    img: "/images/journey/step4.webp",
  },
];

// FAQ(유지 · 삭제 금지) — 문구는 지금 실제로 하는 것만(베타에서 안전결제는 아직 없다 · 보험은 선택).
const FAQ_ITEMS = [
  { q: "견적 요청은 무료인가요?", a: "네. 견적 요청과 업체 비교는 무료입니다." },
  { q: "공간안전결제는 무엇인가요?", a: SHOW_BETA_UI
      ? "공사비를 단계마다 확인한 뒤 지급하는 구조로, 토스페이먼츠 승인 뒤 열립니다. 지금은 계약서에 적은 단계대로 업체와 직접 주고받고, 계약·사진·진행 기록이 공간마켓에 남습니다."
      : "공사비를 바로 지급하지 않고 단계 확인 후 안전하게 정산하는 구조입니다." },
  { q: "업체는 어떻게 검증되나요?", a: "사업자등록증을 확인한 업체만 견적을 보낼 수 있어요. 시공보험·시공 사례·고객 후기는 업체 프로필에서 직접 확인할 수 있습니다." },
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
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, color: SK.gold, flexShrink: 0,
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
    description: SHOW_BETA_UI
      ? "믿을 수 있는 인테리어 업체 비교부터 계약, 공사 사진·진행 기록까지. 집·상가·리모델링을 한곳에서 진행하세요."
      : "믿을 수 있는 인테리어 업체 비교부터 계약, 에스크로 안전결제, 시공 기록까지. 집·상가·리모델링을 안전하게 진행하세요.",
    path: "/",
  });

  const [cases, setCases] = useState([]);
  useEffect(() => {
    let alive = true;
    const safe = (p) => Promise.resolve(p).then((r) => r?.data ?? []).catch(() => []);
    Promise.all([safe(getTopReviews({ limit: 12 })), safe(getRecentPortfolios(12)), safe(getSeedReviews({ limit: 6, activeOnly: true }))])
      .then(([topReviews, portfolios, seedReviews]) => {
        if (!alive) return;
        const items = normalizeShowcases({ topReviews, portfolios, seedReviews })
          .filter((x) => x.isSeed || !isTestCompanyName(x.company)) // 테스트 업체 사례는 첫 화면에 안 싣는다
          .slice(0, CASE_COUNT);
        setCases(items);
      });
    return () => { alive = false; };
  }, []);
  const hasReal = cases.some((c) => !c.isSeed);

  const goConsumer = () => onSelectRole("consumer");
  const goPartner  = () => { window.location.href = "/partner"; };
  const scrollTop  = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div style={{ background: SK.bg, color: SK.ink, fontFamily: SANS, minHeight: "100vh",
      letterSpacing: "-0.02em", WebkitFontSmoothing: "antialiased", overflowX: "hidden",
      paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      {SHOW_DEBUG_UI && (
        <div style={{ background: "#1a1a1a", color: "#00ff88", textAlign: "center", padding: "4px 0",
          fontSize: 10, fontFamily: "monospace" }}>
          ▶ landing(시안 이식) sha:{typeof __GIT_SHA__ !== "undefined" ? __GIT_SHA__ : "?"} · MODE:{import.meta.env.MODE}
        </div>
      )}

      {/* ── TOPNAV (sticky · 고객/파트너 탭) ─────────────────────────── */}
      <div className="gm-topnav" style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(249,246,242,.85)",
        backdropFilter: "blur(16px) saturate(180%)", WebkitBackdropFilter: "blur(16px) saturate(180%)",
        borderBottom: `1px solid ${SK.line}`, display: "flex", justifyContent: "space-between",
        alignItems: "center", padding: "10px 20px" }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em" }}>
          공간마켓<span style={{ color: SK.muted, fontWeight: 500, fontSize: 11, letterSpacing: "0.14em", marginLeft: 7 }}>BETA</span>
        </div>
        <div style={{ display: "flex", gap: 6, background: "#ECE7DF", padding: 4, borderRadius: 999 }}>
          <button className="gm-tab" style={{ padding: "8px 16px", borderRadius: 999, border: "none", fontWeight: 700,
            fontSize: 13, cursor: "pointer", fontFamily: SANS, background: SK.ink, color: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,.2)" }}>고객</button>
          <button className="gm-tab" onClick={goPartner} style={{ padding: "8px 16px", borderRadius: 999, border: "none",
            fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: SANS, background: "transparent",
            color: SK.muted }}>파트너</button>
        </div>
      </div>

      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 20px" }}>
        {/* 다시 오셨네요 — 저장 계정 */}
        {hasSavedAccounts && (
          <button onClick={() => onResume?.()} style={{ ...btnBase, marginTop: 14, background: SK.forest,
            color: "#fff", maxWidth: 520 }}>
            다시 오셨네요 · 저장된 계정으로 시작
          </button>
        )}

        {/* ── HERO ──────────────────────────────────────────────────── */}
        <div className="gm-hero" style={{ position: "relative", borderRadius: 28, overflow: "hidden",
          margin: "20px 0 36px", minHeight: 560, background: "#E8E0D1", display: "flex", alignItems: "center" }}>
          <div className="gg-drift" style={{ position: "absolute", inset: 0, backgroundImage: `url('/images/living.webp')`,
            backgroundSize: "cover", backgroundPosition: "center", filter: "saturate(.88) brightness(.94)" }} />
          <div className="gm-hero-ov" style={{ position: "absolute", inset: 0 }} />
          <div className="gm-hero-ct" style={{ position: "relative", zIndex: 2, padding: "36px 32px", maxWidth: 440 }}>
            <div style={{ display: "inline-flex", gap: 6, alignItems: "center", background: SK.forest,
              color: "#E8E1D8", padding: "6px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700,
              letterSpacing: ".02em", marginBottom: 16 }}>
              사업자등록 확인 업체만 견적
            </div>
            <h1 className="gm-hero-h1 gg-rise gg-d1" style={{ fontSize: "clamp(30px,6vw,44px)", fontWeight: 800, lineHeight: 1.08,
              letterSpacing: "-0.04em", wordBreak: "keep-all", margin: 0 }}>
              견적부터 마무리까지<br />한 자리에 남습니다
            </h1>
            <p style={{ fontSize: 15, color: SK.inkSoft, opacity: 1, fontWeight: 500,
              margin: "14px 0 22px", lineHeight: 1.65, wordBreak: "keep-all" }}>
              사업자등록을 확인한 업체의 견적을 같은 조건으로 비교하고, 계약·현장 사진·진행 단계가 그대로 기록됩니다. 가입비 0원 · 견적 무료.
            </p>
            <button onClick={goConsumer} className="gg-rise gg-d3" style={{ ...btnBase, maxWidth: 340, background: SK.ink, color: "#fff" }}>
              무료 비교견적 받기 →
            </button>
            <div style={{ display: "flex", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
              {(SHOW_BETA_UI ? ["✓ 사업자 확인 업체", "✓ 계약·공사 기록", "✓ 견적 무료"] : ["✓ 검증업체만", "✓ 기록 보호", "✓ 단계별 정산"]).map((t) => (
                <span key={t} style={{ fontSize: 11, color: "#6B6560" }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── 여정 — 이 랜딩의 뼈대. 경쟁사가 말하지 않는 «매칭 이후»를 화면에 세운다 ── */}
        <div style={{ padding: "8px 0 36px" }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: SK.gold, letterSpacing: "0.12em", marginBottom: 8 }}>
              공사 한 건이 지나가는 길
            </div>
            <h2 style={{ fontSize: "clamp(22px,4.5vw,28px)", fontWeight: 800, letterSpacing: "-0.03em", margin: 0, lineHeight: 1.35 }}>
              견적에서 끝나지 않습니다
            </h2>
            <p style={{ fontSize: 13.5, color: SK.muted, lineHeight: 1.75, margin: "10px 0 0", wordBreak: "keep-all" }}>
              업체를 연결해 주는 곳은 많습니다. 공간마켓은 그다음 — 고르고, 공사하고, 끝난 뒤까지 한 화면에 둡니다.
            </p>
          </div>

          <div className="gm-journey" style={{ display: "grid", gap: 14 }}>
            {JOURNEY.map((j, i) => (
              <div key={j.no} className="gg-rise" style={{
                background: SK.surface, border: `1px solid ${SK.line}`, borderRadius: 20, overflow: "hidden",
                display: "grid", gridTemplateColumns: "1fr", animationDelay: `${i * 0.06}s`,
              }}>
                <img src={j.img} alt="" loading="lazy" aria-hidden="true"
                  style={{ width: "100%", height: 168, objectFit: "cover", display: "block" }} />
                <div style={{ padding: "16px 18px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: SK.gold, letterSpacing: "0.1em" }}>{j.no}</span>
                    <span style={{ fontSize: 11.5, color: SK.muted }}>{j.when}</span>
                  </div>
                  <div style={{ fontSize: 16.5, fontWeight: 800, color: SK.ink, letterSpacing: "-0.02em", lineHeight: 1.4 }}>
                    {j.title}
                  </div>
                  <div style={{ fontSize: 13.5, color: "#3A4A40", lineHeight: 1.75, marginTop: 7, wordBreak: "keep-all" }}>
                    {j.desc}
                  </div>
                  <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6,
                    background: "#F4F1EB", border: `1px solid ${SK.line}`, borderRadius: 999, padding: "4px 11px",
                    fontSize: 11.5, fontWeight: 700, color: "#5A6B60" }}>
                    앱 화면 · {j.proof}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 시공사례 ──────────────────────────────────────────────── */}
        {cases.length > 0 && (
        <div style={{ padding: "36px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
            <h2 style={{ fontSize: "clamp(22px,4.5vw,26px)", fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>시공사례</h2>
            <span style={{ fontSize: 12, color: SK.muted }}>{hasReal ? "고객과 업체가 올린 실제 사례" : "예시 사례 · 실제 사례가 쌓이는 중"}</span>
          </div>
          <div className="gm-grid" style={{ display: "grid", gap: 16 }}>
            {cases.map((c) => (
              <div key={c.id} className="gm-card" onClick={goConsumer} style={{ background: SK.surface, border: `1px solid ${SK.line}`,
                borderRadius: 20, overflow: "hidden", transition: "transform .25s, box-shadow .25s", cursor: "pointer", position: "relative" }}>
                <img src={c.photo} alt={c.title} loading="lazy" style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }} />
                {c.isSeed && (
                  <span style={{ position: "absolute", top: 12, left: 12, background: "rgba(18,26,22,.72)", color: "#fff",
                    fontSize: 11, fontWeight: 800, padding: "4px 9px", borderRadius: 999 }}>예시</span>
                )}
                <div style={{ padding: "16px 18px" }}>
                  {/* 공간 유형이 없는 실제 후기는 고객이 쓴 한 줄을 제목으로 — «시공 사례»만 덩그러니 서지 않게 */}
                  <b style={{ fontSize: 14, letterSpacing: "-0.02em", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.spaceType || (c.text ? `“${c.text.length > 24 ? c.text.slice(0, 24) + "…" : c.text}”` : c.title)}
                  </b>
                  <div style={{ fontSize: 11, color: SK.muted, marginTop: 4 }}>{c.meta || (c.isPortfolio ? "업체 시공 사례" : `고객 후기${c.rating ? ` · ★${c.rating}` : ""}`)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* ── DARK CTA ──────────────────────────────────────────────── */}
        <div style={{ background: SK.forest, color: "#E8E1D8", borderRadius: 28, padding: "48px 28px",
          textAlign: "center", margin: "28px 0" }}>
          <h2 style={{ fontSize: "clamp(20px,4.5vw,24px)", fontWeight: 800, lineHeight: 1.35, margin: 0 }}>
            업체를 찾아다니는 시간을<br />공간마켓이 줄여 드립니다
          </h2>
          <p style={{ opacity: .62, fontSize: 13, marginTop: 10, lineHeight: 1.7 }}>사업자등록을 확인한 업체의 견적을 한자리에서 비교하고, 계약부터 마무리까지 기록으로 남깁니다.</p>
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
          {/* 기능을 불릿으로 늘어놓지 않는다 — 흐름 세 마디로(검색 문구는 위 소개문에 그대로 있다) */}
          <div style={{ marginTop: 26 }}>
            {[
              ["견적을 모은다", "요청 한 번으로 우리 동네 업체들의 견적을 받고, 금액·기간·기록을 나란히 비교합니다."],
              ["이야기를 나눈다", "업체와 앱 안에서 상담하고, 현장 사진과 주고받은 말이 그대로 남습니다."],
              [SHOW_BETA_UI ? "기록으로 남긴다" : "단계로 정산한다",
               SHOW_BETA_UI
                 ? "착공·중간·완료 사진과 계약 내용이 단계마다 쌓여, 나중에 다시 볼 수 있습니다."
                 : "착공·중간·완료를 확인할 때마다 단계별로 정산합니다."],
            ].map(([t, d], i) => (
              <div key={t} style={{ display: "flex", gap: 16, padding: "16px 0", borderTop: i === 0 ? "none" : `1px solid ${SK.line}` }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: SK.muted, letterSpacing: "0.08em", paddingTop: 3, flexShrink: 0 }}>
                  0{i + 1}
                </span>
                <span>
                  <span style={{ display: "block", fontSize: 15.5, fontWeight: 700, color: SK.ink, letterSpacing: "-0.02em" }}>{t}</span>
                  <span style={{ display: "block", fontSize: 13.5, color: "#3A4A40", lineHeight: 1.75, marginTop: 5, wordBreak: "keep-all" }}>{d}</span>
                </span>
              </div>
            ))}
          </div>        </div>

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

      {/* ── 하단 고정 CTA (sticky-cta-fix · 모바일) · fab-up 흰색 원형 분리 ── */}
      <div className="gm-sticky-cta" style={{ position: "fixed", left: 16, right: 16,
        bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 60,
        display: "flex", alignItems: "center", gap: 12, background: SK.ink,
        borderRadius: 999, padding: 6, boxShadow: "0 8px 24px rgba(18,26,22,.18)" }}>
        <button onClick={goConsumer} style={{ flex: 1, background: SK.forest, color: "#fff", border: "none",
          fontWeight: 800, fontSize: 15, padding: "15px 20px", borderRadius: 999, cursor: "pointer",
          fontFamily: SANS }}>무료 비교견적 받기</button>
        <div onClick={scrollTop} role="button" aria-label="맨 위로" style={{ width: 44, height: 44,
          background: "#fff", borderRadius: "50%", display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0, cursor: "pointer", fontWeight: 800,
          boxShadow: "0 2px 8px rgba(0,0,0,.15)" }}>↑</div>
      </div>

      {/* 여정 카드 — 넓은 화면에서 2열, 아주 넓으면 사진이 왼쪽으로 */}
      {/* 반응형 · 카드 hover · 히어로 오버레이(A17 수직/데스크탑 수평) · 고정 CTA 게이트 */}
      <style>{`
        .gm-hero-ov{ background: linear-gradient(180deg, rgba(249,246,242,.88) 0%, rgba(249,246,242,.92) 50%, rgba(249,246,242,.65) 100%) }
        @media (min-width: 600px){ .gm-hero-ov{ background: linear-gradient(90deg, #F9F6F2 0%, rgba(249,246,242,.92) 38%, rgba(249,246,242,.15) 72%, transparent 100%) } }
        @media (min-width: 780px){ .gm-grid{ grid-template-columns: repeat(3,1fr) } .gm-hero{ min-height: 620px } .gm-hero-ct{ max-width: 500px; padding: 48px } }
        @media (min-width: 780px){ .gm-journey{ grid-template-columns: repeat(2,1fr); gap: 18px } }
        @media (min-width: 1040px){ .gm-journey > div{ grid-template-columns: 240px 1fr; align-items: stretch } .gm-journey img{ height: 100% !important; min-height: 190px } }
        .gm-card:hover{ transform: translateY(-3px); box-shadow: 0 12px 32px rgba(18,26,22,.08) }
        button:active{ transform: scale(.985) }
        .gm-sticky-cta{ display: none }
        @media (max-width: 640px){ .gm-sticky-cta{ display: flex } }
        @media (max-width: 380px){
          .gm-hero{ min-height: 480px; border-radius: 20px; margin: 8px 0 20px }
          .gm-hero-ct{ padding: 20px 16px }
          .gm-hero-h1{ font-size: 26px !important; line-height: 1.15 }
          .gm-card img{ height: 170px }
          .gm-topnav{ padding: 8px 12px !important }
          .gm-tab{ padding: 6px 12px !important; font-size: 12px !important }
        }
      `}</style>
    </div>
  );
}
