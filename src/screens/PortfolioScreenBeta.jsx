// PortfolioScreenBeta — UX 편의성 고도화 Beta (업체 상세 · Premium Minimal).
//   ⚠️ 표현 전용. 데이터는 기존 read 함수(getPortfolios/getReviews)만 사용, 콜백(onChat/onReview/onBack)
//      으로 동작 위임. 계약/결제/에스크로/상태관리/DB/API/Level·XP 로직 무수정.
//   고객/공개 뷰(!canManage)에서만 사용 — 업체 본인/관리자는 기존 PortfolioScreen(관리 UI) 유지.
//   원칙: 여백 중심·카드 최소·정보보다 신뢰. KPI/Lv/XP/배지는 CompanyMetrics 재사용(중복 UI 없음).
import { useState, useEffect, useRef } from "react";
import { C, R, S, GRADE } from "../constants";
import { TempBadge } from "../components/common";
import PhotoModal from "../components/PhotoModal";
import { getPortfolios, getReviews } from "../lib/supabase";
import { CompanyKpiTiles, CompanyLevelBar, CompanyMiniBadges, deriveLevel, responseValue } from "../components/company/CompanyMetrics";

const normalize = (row) => {
  const before = row.before_photos ?? [];
  const after  = row.after_photos  ?? [];
  return {
    id: row.id, type: row.space_type ?? "시공", title: row.title, area: row.area ?? "",
    tags: row.tags ?? [], beforePhotos: before, afterPhotos: after,
    before: before[0] ?? null, after: after[0] ?? before[0] ?? null,
  };
};

// 150~250ms 부드러운 Count Up (숫자 KPI 전용).
function useCountUp(target, ms = 240) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(target) || target <= 0) { setV(target || 0); return; }
    let raf; const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      setV(Math.round(target * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export default function PortfolioScreenBeta({ company, onChat, onReview, onBack }) {
  const [portfolio, setPortfolio] = useState(company?.portfolio ?? []);
  const [reviews, setReviews] = useState(company?.reviewList ?? []);
  const [photoWork, setPhotoWork] = useState(null);
  const [openReviewPhoto, setOpenReviewPhoto] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!company?.id) return;
    getPortfolios(company.id).then(({ data, error }) => {
      if (!error && data && data.length > 0) setPortfolio(data.map(normalize));
    });
    getReviews(company.id).then(({ data }) => {
      if (data && data.length > 0) setReviews(data);
    });
  }, [company?.id]);

  // Sticky Header — 스크롤 시 컴팩트 바 fade-in (Hero 자연 축소).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 150);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ⚠️ Count Up 훅은 early return 위에서 무조건 호출(Rules of Hooks).
  const completedJobs = company?.completedJobs ?? 0;
  const reviewCount = reviews.length;
  const shownJobs = useCountUp(completedJobs);
  const shownReviews = useCountUp(reviewCount);

  if (!company) return null;

  const g = GRADE(company.temp ?? 0);
  const gv = deriveLevel(company);
  const avgRating = reviewCount > 0
    ? (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviewCount).toFixed(1) : null;

  // 업체소개 — Tag 형태(기존 필드에서 도출, 추가 데이터 없음).
  const tagSet = new Set();
  portfolio.forEach(w => { if (w.type) tagSet.add(w.type); });
  if (company.region) tagSet.add(company.region);
  if (company.verified || company.bizCert || company.is_verified) tagSet.add("사업자 인증");
  if (company.insurance) tagSet.add("시공보험");
  if (company.guarantee_status === "ACTIVE" || company.guarantee_grade || company.badge) tagSet.add("공간보증");
  const tags = [...tagSet].slice(0, 8);

  // 신뢰 타임라인 — 성장 과정(도출).
  const milestone = [100, 50, 30, 10].find(m => completedJobs >= m);
  const timeline = [
    { label: "업체 등록", done: true },
    (company.guarantee_status === "ACTIVE" || company.guarantee_grade || company.badge) && { label: "공간보증 획득", done: true },
    milestone && { label: `시공 ${milestone}건 달성`, done: true },
    { label: `Lv.${gv.level} 달성`, done: true },
  ].filter(Boolean);

  const repWork = portfolio.find(w => w.after || w.before) ?? null;
  const gridWorks = portfolio.filter(w => w.after || w.before);

  const kpiTiles = [
    { icon: "🏗", value: `${shownJobs}`,            label: "시공" },
    { icon: "⭐", value: `${shownReviews}`,         label: "후기" },
    { icon: "⚡", value: responseValue(company),    label: "평균응답" },
  ];

  return (
    <div ref={scrollRef} style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif" }}>
      {/* Sticky Header — 스크롤 시 업체명/온도/상담만 */}
      <div style={{
        position: "sticky", top: 0, zIndex: 20,
        display: "flex", alignItems: "center", gap: S.md, padding: "12px 18px",
        background: scrolled ? C.surface : "transparent",
        borderBottom: scrolled ? `1px solid ${C.bgWarm}` : "1px solid transparent",
        transition: "background 220ms ease, border-color 220ms ease",
      }}>
        <button onClick={onBack} aria-label="뒤로"
          style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.text1, padding: 0, lineHeight: 1 }}>←</button>
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8,
          opacity: scrolled ? 1 : 0, transform: scrolled ? "none" : "translateY(-4px)",
          transition: "opacity 200ms ease, transform 200ms ease" }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.text1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{company.name}</span>
          <TempBadge temp={company.temp} />
        </div>
        {onChat && (
          <button onClick={() => onChat(company)} style={{
            opacity: scrolled ? 1 : 0, pointerEvents: scrolled ? "auto" : "none",
            transition: "opacity 200ms ease",
            background: C.brand, color: "#fff", border: "none", borderRadius: R.full,
            padding: "8px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer", flexShrink: 0,
          }}>상담하기</button>
        )}
      </div>

      <div style={{ padding: `${S.sm}px ${S.xl}px 110px` }}>

        {/* ── Hero ──────────────────────────────────────────── */}
        <div style={{ padding: `${S.lg}px 2px ${S.xl}px`, animation: "pf-fade 240ms ease both" }}>
          <style>{`@keyframes pf-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
          <div style={{ display: "flex", alignItems: "center", gap: S.lg }}>
            <div style={{ width: 68, height: 68, borderRadius: 20, flexShrink: 0,
              background: C.brandL, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 28, fontWeight: 900, color: C.brand }}>{(company.name ?? "?")[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: C.brand }}>Lv.{gv.level}</span>
                <TempBadge temp={company.temp} info />
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.text1, lineHeight: 1.25,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word" }}>
                {company.name}
              </div>
            </div>
          </div>

          <CompanyMiniBadges company={company} marginTop={S.md} />

          {/* 시공경험 중심 KPI (시공 먼저) — 공유 컴포넌트 재사용 */}
          <div style={{ height: 1, background: C.bgWarm, margin: `${S.xl}px 0 0` }} />
          <CompanyKpiTiles company={company} tiles={kpiTiles} marginTop={S.lg} />

          {/* Lv / XP 진행 (공유) */}
          <CompanyLevelBar company={company} marginTop={S.lg} />
        </div>

        {/* ── 업체소개 (Tag) ─────────────────────────────────── */}
        {tags.length > 0 && (
          <Section title="업체 소개">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {tags.map(t => (
                <span key={t} style={{ background: C.surface, color: C.text2, border: `1px solid ${C.bgWarm}`,
                  borderRadius: R.full, padding: "7px 14px", fontSize: 13, fontWeight: 600 }}>{t}</span>
              ))}
            </div>
          </Section>
        )}

        {/* ── 포트폴리오 (대표 → Grid → Fullscreen swipe) ─────── */}
        {gridWorks.length > 0 && (
          <Section title="시공 포트폴리오" sub={`${gridWorks.length}건`}>
            {repWork && (
              <button onClick={() => setPhotoWork(repWork)} style={{
                display: "block", width: "100%", padding: 0, border: "none", borderRadius: R.xl,
                overflow: "hidden", cursor: "pointer", marginBottom: S.sm, background: C.surface2,
                aspectRatio: "16/10",
              }}>
                <img src={repWork.after ?? repWork.before} alt={repWork.title ?? "대표 시공사례"} loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: S.sm }}>
              {gridWorks.slice(0, 6).map(w => (
                <button key={w.id} onClick={() => setPhotoWork(w)} style={{
                  position: "relative", paddingTop: "100%", border: "none", padding: 0,
                  borderRadius: R.lg, overflow: "hidden", cursor: "pointer", background: C.surface2,
                }}>
                  <img src={w.after ?? w.before} alt={w.title ?? "시공사례"} loading="lazy"
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
              ))}
            </div>
            {gridWorks.length > 6 && repWork && (
              <button onClick={() => setPhotoWork(repWork)} style={{
                width: "100%", marginTop: S.md, padding: "12px", background: C.surface,
                border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontSize: 13, fontWeight: 800,
                color: C.text2, cursor: "pointer",
              }}>전체보기 ({gridWorks.length}) →</button>
            )}
          </Section>
        )}

        {/* ── 후기 (간결) ────────────────────────────────────── */}
        {reviewCount > 0 && (
          <Section title="시공 후기" sub={avgRating ? `★ ${avgRating} · ${reviewCount}건` : `${reviewCount}건`}>
            {reviews.slice(0, 3).map(rv => {
              const stars = Math.min(5, Math.max(1, Math.round(rv.rating ?? 0)));
              const hasPhoto = (rv.image_urls?.length ?? 0) > 0;
              const open = openReviewPhoto === rv.id;
              return (
                <div key={rv.id} style={{ padding: `${S.md}px 0`, borderBottom: `1px solid ${C.bgWarm}` }}>
                  <div style={{ fontSize: 13, color: C.gold, letterSpacing: 1, marginBottom: 5 }}>
                    {"★".repeat(stars)}<span style={{ color: C.bgWarm }}>{"★".repeat(5 - stars)}</span>
                  </div>
                  <div style={{ fontSize: 14, color: C.text1, lineHeight: 1.6, marginBottom: 4 }}>{rv.content}</div>
                  <div style={{ fontSize: 12, color: C.text3 }}>
                    {rv.space_type ?? "시공"}{rv.user_name ? ` · ${rv.user_name}` : ""}
                    {hasPhoto && (
                      <button onClick={() => setOpenReviewPhoto(open ? null : rv.id)} style={{
                        marginLeft: 8, background: "none", border: "none", color: C.brand, fontWeight: 700,
                        fontSize: 12, cursor: "pointer", padding: 0,
                      }}>📷 사진 {open ? "접기" : `${rv.image_urls.length}장`}</button>
                    )}
                  </div>
                  {hasPhoto && open && (
                    <div style={{ display: "flex", gap: S.sm, marginTop: S.sm, overflowX: "auto" }}>
                      {rv.image_urls.map((u, i) => (
                        <img key={i} src={u} alt={`후기 사진 ${i + 1}`} loading="lazy"
                          style={{ width: 92, height: 92, objectFit: "cover", borderRadius: R.md, flexShrink: 0, border: `1px solid ${C.bgWarm}` }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <button onClick={onReview} style={{
              width: "100%", marginTop: S.md, padding: "12px", background: C.surface,
              border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontSize: 13, fontWeight: 800,
              color: C.text2, cursor: "pointer",
            }}>후기 전체보기 →</button>
          </Section>
        )}

        {/* ── 신뢰 타임라인 ──────────────────────────────────── */}
        <Section title="신뢰의 발자취">
          <div>
            {timeline.map((t, i) => (
              <div key={t.label} style={{ display: "flex", gap: S.md, alignItems: "stretch" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 11, height: 11, borderRadius: "50%", background: C.brand, marginTop: 4, flexShrink: 0 }} />
                  {i < timeline.length - 1 && <div style={{ width: 2, flex: 1, background: C.brandM, marginTop: 2 }} />}
                </div>
                <div style={{ paddingBottom: i < timeline.length - 1 ? S.lg : 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, lineHeight: 1.2 }}>{t.label}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── 하단 고정 CTA ──────────────────────────────────── */}
      {onChat && (
        <div style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 30,
          background: C.surface, borderTop: `1px solid ${C.bgWarm}`,
          padding: `${S.md}px ${S.xl}px calc(${S.md}px + env(safe-area-inset-bottom))`,
          display: "flex", justifyContent: "center",
        }}>
          <button onClick={() => onChat(company)} style={{
            width: "100%", maxWidth: 440, padding: "16px", background: C.brand, color: "#fff",
            border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 16, minHeight: 56, cursor: "pointer",
            boxShadow: `0 6px 20px ${C.brand}44`,
          }}>💬 상담하기</button>
        </div>
      )}

      {photoWork && <PhotoModal work={{ ...photoWork, companyName: company.name }} onClose={() => setPhotoWork(null)} />}
    </div>
  );
}

// 섹션 — 여백 중심, 선/카드 최소.
function Section({ title, sub, children }) {
  return (
    <div style={{ marginTop: S.xxl }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: S.md }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>{title}</span>
        {sub && <span style={{ fontSize: 12.5, color: C.text3, fontWeight: 600 }}>{sub}</span>}
      </div>
      {children}
    </div>
  );
}
