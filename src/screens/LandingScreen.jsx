import { useEffect, useState } from "react";
import { SHOW_DEBUG_UI, SHOW_BETA_UI, isStoreAppShell } from "../constants/release";
import { getTopReviews, getRecentPortfolios, getSeedReviews } from "../lib/supabase";
import { normalizeShowcases } from "../lib/showcases";
import { isTestCompanyName } from "../lib/testCompany";
import AppFooter from "../components/AppFooter";
import InviteWelcome from "../components/InviteWelcome";
import { useDocumentMeta } from "../hooks/useDocumentMeta";
import { useJsonLd } from "../hooks/useJsonLd";
import { consumerFaq, pageSeo, serviceSchema, faqSchema } from "../utils/siteSeo";
import { HeroScenes, ProofChips, WorryStamps, BeforeAfter, WorkMarquee, Reveal, CountUp, useInView, AdVideo } from "../components/landing/LandingMotion";
import { saveLandingPick, LANDING_WORK_TAGS } from "../lib/landingPick";

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

// 견적 비교 예시 — 화면에 «예시»로만 쓴다(실제 업체·실제 견적 아님). 같은 요청(아파트 부분 · 도배+바닥 · 20평대) 기준.
const COMPARE_SAMPLE = [
  { name: "예시 업체 A", price: 460, days: "4일", warranty: "1년", note: "자재 등급 표시", proofs: ["biz", "insurance"] },
  { name: "예시 업체 B", price: 430, days: "5일", warranty: "6개월", note: "자재 미정", proofs: ["biz"] },
  { name: "예시 업체 C", price: 520, days: "3일", warranty: "2년", note: "현장 실측 포함", proofs: ["biz", "insurance", "deposit"] },
];

// ── 걱정 → 도장 → 답 (대표 09-30 「고객의 니즈 · 걱정과 해결을 유머와 매력으로」) ──────────────
// ⚠️ 답은 앱에 실제로 있는 것만: 같은 조건 비교 · 관리자 확인 증빙 · 계약·대화 기록 · 단계 사진 · 하자보수 끝나기 전 알림(#867).
//    안전결제(보관·예치)는 PAYMENTS_LIVE 전이라 말하지 않는다.
const WORRIES = [
  { icon: "/images/notif/compare.webp", q: "견적서 세 장. 숫자는 다른데, 뭐가 다른지는 아무도 안 알려 줘요.",
    a: <>같은 요청서로 받으니 <b>다른 건 업체뿐</b>이에요. 기간 · 하자보수 · 증빙까지 한 줄에 나란히 놓고 봅니다.</> },
  { icon: "/images/emblem/biz-sm.webp", q: "이 업체, 진짜 사업자 맞나? 검색하면 블로그 후기만 잔뜩.",
    a: <>사업자등록 · 시공보험 · 보증금 표시는 <b>관리자가 서류를 확인한 업체에만</b> 붙어요. 사업자 확인 전에는 입찰도 못 해요.</> },
  { icon: "/images/notif/viewed.webp", q: "공사 중간에 들려오는 그 말. «사모님, 이건 추가예요.»",
    a: <>처음 약속한 내용이 앱에 적혀 있어요. <b>기억력 대결 말고, 기록 확인.</b></> },
  { icon: "/images/landing/clay-house.webp", q: "오늘 현장에서 뭘 했는지 궁금한데… 매번 전화하긴 눈치 보여요.",
    a: <>착공 · 중간 · 완료, 단계마다 <b>현장 사진으로 확인</b>하고 넘어가요. 전화는 줄이고, 눈치는 0.</> },
  { icon: "/images/emblem/warranty-sm.webp", q: "6개월 뒤 들뜬 벽지. 그때 그 업체 번호가… 어디 있더라?",
    a: <>계약 · 사진 · 대화가 그대로 남고, <b>하자보수 기간이 끝나기 전에 알려 드려요.</b></> },
  { icon: "/images/landing/clay-clipboard.webp", q: "인테리어 알아보다 주말이 통째로 사라졌어요.",
    a: <>요청서는 <b>한 번만</b>. 업체 찾아다니는 대신 앉아서 견적을 받아 보고, 마음에 안 들면 그만둬도 괜찮아요.</> },
];

// «30초 요청서 미리 해 보기» — 고른 것은 로그인 뒤 요청서에 그대로 채워진다(lib/landingPick · MainApp).
const PICK_SPACES = [
  ["아파트 전체", "/images/living.webp"], ["아파트 부분", "/images/kitchen.webp"], ["원룸/오피스텔", "/images/space-officetel.webp"],
  ["카페/식당", "/images/cafe.webp"], ["오피스", "/images/space-office.webp"], ["상가", "/images/space-shop.webp"],
];

const WORK_ROWS = [
  ["★작은 수리도 괜찮아요", "도배", "바닥", "욕실", "주방", "필름", "타일", "페인트", "조명·전기", "창호", "철거"],
  ["수전·세면대", "실리콘", "문 손잡이·경첩", "중문", "누수·배관", "줄눈", "탄성코트", "발코니 확장", "★카페·상가·오피스도", "붙박이장·가구"],
];

function RequestPreview({ onStart }) {
  const [type, setType] = useState("");
  const [tags, setTags] = useState([]);
  const toggle = (t) => setTags((xs) => (xs.includes(t) ? xs.filter((x) => x !== t) : xs.length >= 5 ? xs : [...xs, t]));
  const summary = !type && !tags.length
    ? <>공간 하나, 공사 하나만 골라 보세요. <b>요청서가 반쯤 채워진 채로</b> 열려요.</>
    : !tags.length
      ? <><b>{type}</b> 좋아요. 어떤 공사인지만 하나 더!</>
      : <>{type && <><b>{type}</b> · </>}<b>{tags.join(", ")}</b> — {tags.length >= 4 ? "거의 새집 수준이네요. 그 욕심, 좋습니다. " : ""}이 조건 그대로 업체들이 같은 조건으로 견적을 보내요.</>;
  return (
    <div className="lm-pick">
      <div style={{ fontSize: 13, fontWeight: 800, color: "#1A2E22", marginBottom: 10 }}>① 어떤 공간인가요?</div>
      <div className="lm-spaces">
        {PICK_SPACES.map(([label, img]) => (
          <button key={label} type="button" className={`lm-space ${type === label ? "is-on" : ""}`} aria-pressed={type === label}
            onClick={() => setType((v) => (v === label ? "" : label))}>
            <img src={img} alt="" loading="lazy" /><span>{label}</span>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: "#1A2E22", margin: "18px 0 10px" }}>② 어디를 고칠까요? <span style={{ fontWeight: 600, color: "#8A857E" }}>(여러 개)</span></div>
      <div className="lm-chips">
        {LANDING_WORK_TAGS.map((t) => (
          <button key={t} type="button" className={`lm-chip ${tags.includes(t) ? "is-on" : ""}`} aria-pressed={tags.includes(t)} onClick={() => toggle(t)}>{t}</button>
        ))}
      </div>
      <div className="lm-sum" aria-live="polite">{summary}</div>
      <button type="button" className="gg-cta" onClick={() => { saveLandingPick({ type, tags }); onStart(); }}
        style={{ ...btnBase, marginTop: 14, background: "#121A16", color: "#fff" }}>
        {type || tags.length ? "이 조건으로 무료 견적 받기 →" : "무료 비교견적 받기 →"}
      </button>
      <div style={{ fontSize: 11.5, color: "#8A857E", textAlign: "center", marginTop: 8 }}>휴대폰 인증 뒤 요청서에 그대로 채워져요 · 보내기 전까지는 아무것도 나가지 않아요</div>
    </div>
  );
}

function CompareDemo() {
  const [ref, inView] = useInView({ threshold: 0.3 });
  return (
    <div ref={ref} className={`lm-bids ${inView ? "is-in" : ""}`} style={{ display: "grid", gap: 10 }}>
      {COMPARE_SAMPLE.map((b, i) => (
        <div key={b.name} className="lm-bid" style={{ transitionDelay: `${i * 0.18}s`, background: "#fff", border: "1px solid #E8E1D8", borderRadius: 18, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <b style={{ fontSize: 15, letterSpacing: "-0.02em" }}>{b.name}</b>
            <b style={{ fontSize: 19, color: "#1A2E22", fontVariantNumeric: "tabular-nums" }}><CountUp to={b.price} start={inView} duration={900 + i * 250} />만원</b>
          </div>
          <div style={{ fontSize: 12.5, color: "#3A4A40", marginTop: 4 }}>공사 {b.days} · 하자보수 {b.warranty} · {b.note}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            {[["biz", "사업자"], ["insurance", "시공보험"], ["deposit", "보증금"]].map(([k, label], n) => {
              const on = b.proofs.includes(k);
              const lit = on && inView;
              return (
                <span key={k} className="lm-bid-proof" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700,
                  color: lit ? "#1A2E22" : "#B3ADA4", transitionDelay: `${0.6 + i * 0.18 + n * 0.2}s` }}>
                  <img src={`/images/emblem/${k}-sm.webp`} alt="" aria-hidden="true" width="22" height="22" className="lm-bid-proof"
                    style={{ width: 22, height: 22, objectFit: "contain", filter: lit ? "none" : "grayscale(1)", opacity: lit ? 1 : .35, transitionDelay: `${0.6 + i * 0.18 + n * 0.2}s` }} />
                  {label}{on ? " ✓" : ""}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 여정 네 마디 — 랜딩의 뼈대 (2026-09-23) ─────────────────────────────────
// 왜 이걸 넣나: 지금까지 랜딩 구조가 경쟁사(견적 매칭 앱)와 같았다 — 히어로 → 사례 → CTA → 설명.
//   전부 «매칭까지»만 말한다. 그런데 공간랜드가 실제로 가진 것은 매칭 «이후»다:
//   계약·채팅·현장 사진·단계가 앱에 남는다. 그래서 랜딩 자체를 공사 한 건의 흐름으로 세운다.
// ⚠️ 각 마디는 앱에 **실제로 있는 화면**만 가리킨다(없는 기능을 그리지 않는다).
const JOURNEY = [
  {
    no: "01", when: "요청한 날",
    title: "같은 조건으로 모읍니다",
    desc: "어떤 공간을 어디까지 고칠지 한 번만 적으면, 업체들이 같은 조건을 보고 견적을 보냅니다.",
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

// FAQ(유지 · 삭제 금지) — 문구는 utils/siteSeo.js 단일 소스.
// 봇 프리렌더(api/prerender.js)가 같은 배열을 써서 화면과 색인 내용이 갈라지지 않는다.
const FAQ_ITEMS = consumerFaq(SHOW_BETA_UI);

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

  const SEO = pageSeo(SHOW_BETA_UI)["/"];
  useDocumentMeta({ title: SEO.title, description: SEO.description, path: "/" });

  // 페이지별 구조화 데이터만 덧붙인다 — Organization/WebSite 는 index.html 이
  // 전역으로 내보내므로 여기서 또 내면 같은 개체가 중복된다.
  useJsonLd("landing", [
    serviceSchema(SHOW_BETA_UI),
    faqSchema(FAQ_ITEMS, undefined, "/"),
  ]);

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
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <img src="/icons/gm-logo.svg" alt="" aria-hidden="true" width="30" height="30"
            style={{ width: 30, height: 30, borderRadius: 9, display: "block", flexShrink: 0 }} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
            {/* 대표 09-30 «로고 위에 작게» · 스마트/실속/내실 중 «스마트한»(비교와 붙고 프리미엄과 안 부딪힌다) — 순위(1등)가 아니라 본질을 말한다. 순위 문구는 근거가 생길 때만(표시광고법 · 지시서 §6) */}
            <span style={{ fontSize: 9.5, fontWeight: 800, color: "#A98B4E", letterSpacing: "0.08em", marginBottom: 3, whiteSpace: "nowrap" }}>스마트한 프리미엄 인테리어 비교견적</span>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em" }}>
            공간랜드{/* 스토어 앱(아이폰·Play) 안에서는 «BETA» 를 빼다 — App Store 2.2(베타·체험판 금지) 오해 방지 */}
            {!isStoreAppShell() && <span style={{ color: SK.muted, fontWeight: 500, fontSize: 11, letterSpacing: "0.14em", marginLeft: 7 }}>BETA</span>}
          </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, background: "#ECE7DF", padding: 4, borderRadius: 999 }}>
          <button className="gm-tab" style={{ padding: "8px 16px", borderRadius: 999, border: "none", fontWeight: 700,
            fontSize: 13, cursor: "pointer", fontFamily: SANS, background: SK.ink, color: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,.2)" }}>고객</button>
          {/* 버튼이 아니라 진짜 <a href> 여야 한다 — 구글은 onClick 을 따라가지 않는다.
              서치콘솔에서 /partner 가 「참조 페이지: 감지된 페이지 없음」이었던 이유.
              덤으로 새 탭 열기·링크 복사도 된다. 모양은 그대로. */}
          <a className="gm-tab" href="/partner" style={{ padding: "8px 16px", borderRadius: 999, border: "none",
            fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: SANS, background: "transparent",
            color: SK.muted, textDecoration: "none", display: "inline-flex", alignItems: "center",
            lineHeight: 1 }}>파트너</a>
        </div>
      </div>

      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "0 20px" }}>
        {/* 초대 링크로 온 새 사람 — 가입 선물 안내 */}
        {!hasSavedAccounts && <InviteWelcome style={{ marginTop: 14, maxWidth: 520 }} />}
        {/* 다시 오셨네요 — 저장 계정 */}
        {hasSavedAccounts && (
          <button onClick={() => onResume?.()} style={{ ...btnBase, marginTop: 14, background: SK.forest,
            color: "#fff", maxWidth: 520 }}>
            다시 오셨네요 · 저장된 계정으로 시작
          </button>
        )}

        {/* ── HERO — 두 장면(거실→주방)이 천천히 바뀌고 점토 소품이 숨 쉰다(힉스필드 09-30 · 사람·글자 없음) ── */}
        <HeroScenes>
          <div className="lm-eyebrow gg-rise">견적부터 마무리까지, 한 자리에</div>
          <h1 className="lm-h1 gm-hero-h1 gg-rise gg-d1">
            인테리어, 비교는 <em>쉽게</em><br />공사는 <em>품격 있게</em>
          </h1>
          <p className="lm-hero-sub gg-rise gg-d2">
            확인된 업체들이 같은 조건으로 견적을 보내요. 계약 · 현장 사진 · 진행 단계가 한 자리에 남아 끝까지 안심. 가입비 0원 · 견적 무료.
          </p>
          <button onClick={goConsumer} className="gg-rise gg-d3 gg-cta" style={{ ...btnBase, maxWidth: 340, background: SK.ink, color: "#fff" }}>
            무료 비교견적 받기 →
          </button>
          <ProofChips />
        </HeroScenes>

        {/* ── 23초 광고(힉스필드 클레이 · 09-30 대표 «수요자는 비교견적 하고 싶게 · 파트너는 입점하고 싶게») ── */}
        <Reveal style={{ padding: "4px 0 34px" }}>
          <div className="lm-eyebrow" style={{ marginBottom: 12 }}>23초로 보는 공간랜드</div>
          <AdVideo />
        </Reveal>

        {/* ── 걱정 → 도장 «쾅» → 답 — 처음 온 고객의 속마음부터(대표 09-30) ── */}
        <div style={{ padding: "18px 0 38px" }}>
          <Reveal>
            <div className="lm-eyebrow">인테리어, 이런 걱정 해 보셨죠</div>
            <h2 style={{ fontSize: "clamp(22px,4.8vw,30px)", fontWeight: 800, letterSpacing: "-0.035em", margin: "10px 0 6px", lineHeight: 1.3, wordBreak: "keep-all" }}>
              걱정은 저희가 먼저 해 봤습니다
            </h2>
            <p style={{ fontSize: 13.5, color: SK.muted, lineHeight: 1.7, margin: "0 0 18px", wordBreak: "keep-all" }}>카드를 누르면 도장을 한 번 더 찍어요.</p>
          </Reveal>
          <WorryStamps items={WORRIES} cols3 />
        </div>

        {/* ── 30초 요청서 미리 해 보기 — 고른 것이 로그인 뒤 요청서에 그대로 채워진다 ── */}
        <div style={{ padding: "0 0 40px" }}>
          <Reveal>
            <div className="lm-eyebrow">30초면 충분해요</div>
            <h2 style={{ fontSize: "clamp(22px,4.8vw,30px)", fontWeight: 800, letterSpacing: "-0.035em", margin: "10px 0 16px", lineHeight: 1.3, wordBreak: "keep-all" }}>
              요청서, 여기서 미리 골라 보세요
            </h2>
          </Reveal>
          <Reveal delay={0.08}><RequestPreview onStart={goConsumer} /></Reveal>
        </div>

        {/* ── 견적 비교 예시 — «같은 조건으로 비교»를 말로만 하지 않고 보여 준다(대표 09-25 「맡기고 싶어지는지」).
             예시임을 분명히(가짜 업체·가짜 숫자를 실제처럼 쓰지 않는다). 엠블럼은 앱 입찰 비교 카드와 같은 그림. ── */}
        <div style={{ padding: "0 0 36px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: SK.gold, letterSpacing: "0.12em" }}>이렇게 비교해요</div>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: SK.forest, borderRadius: 999, padding: "2px 8px" }}>예시</span>
          </div>
          <h2 style={{ fontSize: "clamp(20px,4.5vw,26px)", fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 6px", lineHeight: 1.35 }}>
            같은 요청, 업체마다 다른 견적을 나란히
          </h2>
          <p style={{ fontSize: 13, color: SK.muted, lineHeight: 1.7, margin: "0 0 14px", wordBreak: "keep-all" }}>
            금액만이 아니라 기간 · 하자보수 · 업체가 낸 증빙을 한 줄로 봅니다. (아래는 모양을 보여 드리는 예시예요)
          </p>
          <CompareDemo />
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
              업체를 연결해 주는 곳은 많습니다. 공간랜드는 그다음 — 고르고, 공사하고, 끝난 뒤까지 한 화면에 둡니다.
            </p>
          </div>

          <div className="gm-journey" style={{ display: "grid", gap: 14 }}>
            {JOURNEY.map((j, i) => (
              <Reveal key={j.no} delay={(i % 2) * 0.1} style={{
                background: SK.surface, border: `1px solid ${SK.line}`, borderRadius: 20, overflow: "hidden",
                display: "grid", gridTemplateColumns: "1fr",
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
                    앱에서 · {j.proof}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* ── 전·후 밀어 보기 — 끝나면 자랑할 차례(고객 전·후 사진 카드 #868 · 사진은 예시) ── */}
        <div className="gm-ba-wrap" style={{ padding: "12px 0 36px", display: "grid", gap: 18, alignItems: "center" }}>
          <Reveal>
            <div className="lm-eyebrow">끝나면 자랑할 차례</div>
            <h2 style={{ fontSize: "clamp(22px,4.8vw,30px)", fontWeight: 800, letterSpacing: "-0.035em", margin: "10px 0 8px", lineHeight: 1.3 }}>전 · 후, 밀어서 보세요</h2>
            <p style={{ fontSize: 13.5, color: "#3A4A40", lineHeight: 1.75, margin: 0, wordBreak: "keep-all" }}>
              공사가 끝나면 전 · 후 사진을 한 장짜리 카드로 만들어요. 가족 단톡방 반응은… 장담은 못 하지만 꽤 좋을 거예요.
            </p>
          </Reveal>
          <Reveal delay={0.1}><BeforeAfter before="/images/sample/living-before.webp" after="/images/sample/living-after.webp" /></Reveal>
        </div>

        {/* ── 공사 이름이 흐른다 — 도배 한 칸부터 ── */}
        <div style={{ padding: "4px 0 30px" }}>
          <div style={{ textAlign: "center", fontSize: 13, fontWeight: 800, color: SK.muted, marginBottom: 12 }}>도배 한 칸부터 전체 리모델링까지</div>
          <WorkMarquee rows={WORK_ROWS} />
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

        {/* ── 저녁 CTA — 불 켜진 집(힉스필드 09-30) ── */}
        <div className="lm-dusk">
          <div className="lm-dusk-bg" style={{ backgroundImage: "url('/images/landing/cta-dusk.webp')" }} />
          <div className="lm-eyebrow" style={{ color: "#D6A756" }}>오늘 밤 고민은 여기까지</div>
          <h2 style={{ fontSize: "clamp(22px,5vw,32px)", fontWeight: 800, lineHeight: 1.3, margin: "12px 0 0", letterSpacing: "-0.035em", wordBreak: "keep-all" }}>
            업체는 찾아다니지 마세요.<br />견적이 찾아옵니다
          </h2>
          <p style={{ opacity: .72, fontSize: 13.5, marginTop: 12, lineHeight: 1.7, wordBreak: "keep-all" }}>요청서 한 장이면, 확인된 업체들이 같은 조건으로 견적을 보내요. 가입비 0원 · 견적 무료.</p>
          <button onClick={goConsumer} className="gg-cta gg-cta-gold" style={{ ...btnBase, maxWidth: 340, background: "linear-gradient(180deg,#E2CB98 0%,#C8A86A 100%)",
            color: "#121A16", margin: "22px auto 0" }}>
            무료 비교견적 받기
          </button>
        </div>

        {/* ── 업체 입구 — 고객 랜딩에서도 «입점하고 싶게» 한 줄 ── */}
        <a href="/partner" className="gm-partner-teaser" style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 14, textDecoration: "none",
          color: "#F4EFE4", borderRadius: 22, overflow: "hidden", margin: "0 0 20px", padding: "20px 20px",
          background: "linear-gradient(100deg, rgba(22,41,74,.96) 0%, rgba(22,41,74,.84) 55%, rgba(22,41,74,.40) 100%), url('/images/partner/hero-cool-wide.webp') 70% center/cover" }}>
          <span>
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 800, color: "#D6A756", letterSpacing: ".1em" }}>인테리어 사장님이신가요?</span>
            <span style={{ display: "block", fontSize: 17, fontWeight: 800, marginTop: 6, letterSpacing: "-0.02em", wordBreak: "keep-all" }}>광고비 0원 · 요청한 고객에게만 · 가입 1분</span>
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, background: "#F4EFE4", color: "#121A16", borderRadius: 999, padding: "10px 14px", whiteSpace: "nowrap" }}>입점 안내 →</span>
        </a>

        {/* ══ 이하 유지(삭제 금지) : SEO 소개문 · FAQ · 사업자정보 푸터 · 약관 ══ */}

        {/* ── SEO 소개문 ────────────────────────────────────────────── */}
        <div style={{ padding: "36px 0 8px" }}>
          <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 900, color: SK.forest, marginBottom: 16 }}>공간랜드</h2>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "#3A4A40", margin: "0 0 12px" }}>
            공간랜드는 우리 동네 집수리·인테리어·리모델링 업체를 쉽고 편하게 비교하고 상담할 수 있는 플랫폼입니다.
          </p>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: "#3A4A40", margin: "0 0 20px" }}>
            집수리, 도배, 장판, 욕실, 주방, 리모델링, 상업공간, 부분시공 등 견적이 필요한 다양한 시공에 맞는 업체를 찾아 견적을 비교하고 상담할 수 있습니다.
          </p>
          {/* 기능을 불릿으로 늘어놓지 않는다 — 흐름 세 마디로(검색 문구는 위 소개문에 그대로 있다) */}
          <div style={{ marginTop: 26 }}>
            {/* 위 «공사 한 건이 지나가는 길»과 겹치던 세 마디 대신, 처음 온 고객의 걱정 세 가지에 답한다(대표 09-25). */}
            {[
              ["견적만 받아 보고 결정해도 돼요", "받은 견적은 비교만 해도 괜찮아요. 업체를 고르기 전에는 언제든 요청을 그만둘 수 있어요."],
              ["증빙은 관리자가 확인한 것만", "사업자등록 · 시공보험 · 보증금 표시는 서류를 관리자가 확인한 업체에만 붙어요. 사업자 확인 전 업체는 입찰할 수 없어요."],
              ["단계마다 사진으로 확인", "착공 · 중간 · 완료 사진을 보고 확인하면 다음 단계로 넘어가요. 48시간 안에 확인이 없으면 자동으로 넘어가니 알림을 켜 두세요."],
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
          공간랜드 v1.0.0
        </div>
      </div>

      {/* ── 하단 고정 CTA (sticky-cta-fix · 모바일) · fab-up 흰색 원형 분리 ── */}
      <div className="gm-sticky-cta" style={{ position: "fixed", left: 16, right: 16,
        bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 60,
        display: "flex", alignItems: "center", gap: 12, background: SK.ink,
        borderRadius: 999, padding: 6, boxShadow: "0 8px 24px rgba(18,26,22,.18)" }}>
        <button onClick={goConsumer} className="gg-cta" style={{ flex: 1, background: SK.forest, color: "#fff", border: "none",
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
        @media (min-width: 780px){ .gm-grid{ grid-template-columns: repeat(3,1fr) }  }
        @media (min-width: 780px){ .gm-journey{ grid-template-columns: repeat(2,1fr); gap: 18px } .gm-ba-wrap{ grid-template-columns: 1fr 1.25fr; gap: 36px !important } }
        @media (min-width: 1040px){ .gm-journey > div{ grid-template-columns: 240px 1fr; align-items: stretch } .gm-journey img{ height: 100% !important; min-height: 190px } }
        .gm-card:hover{ transform: translateY(-3px); box-shadow: 0 12px 32px rgba(18,26,22,.08) }
        button:active{ transform: scale(.985) }
        .gm-sticky-cta{ display: none }
        @media (max-width: 640px){ .gm-sticky-cta{ display: flex } }
        @media (max-width: 380px){
          .gm-hero{ min-height: 560px; border-radius: 20px; margin: 8px 0 20px }
          .gm-hero-ct{ padding: 24px 16px }
          .gm-hero-h1{ font-size: 26px !important; line-height: 1.15 }
          .gm-card img{ height: 170px }
          .gm-topnav{ padding: 8px 12px !important }
          .gm-tab{ padding: 6px 12px !important; font-size: 12px !important }
        }
      `}</style>
    </div>
  );
}
