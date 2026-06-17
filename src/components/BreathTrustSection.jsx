import { useEffect, useRef, useState } from "react";

// ════════════════════════════════════════════════════════════════════════════
// BreathTrustSection — "호흡과 신뢰" (Landing Page Upgrade v2.0)
//   업체 랜딩페이지에 공간마켓 브랜드 철학(라운지 기반 호흡·신뢰)을 전달하는 신규 섹션.
//   · Add Only — 기존 컴포넌트/스타일/라우팅/API/DB 미접촉.
//   · 전문가 카드/인기 콘텐츠는 Mock UI(DB·API 미연결). 향후 실제 라운지와 연결 예정.
//   · 랭킹/TOP/베스트/추천 금지 → "함께 호흡하는 공간파트너" + 활동 배지로만 표현.
//   · 디자인 토큰은 PartnerLandingScreen 과 동일 계열을 복제(독립 컴포넌트 유지).
// ════════════════════════════════════════════════════════════════════════════

// ── Design tokens (랜딩과 동일 계열) ─────────────────────────────────────────
const NAVY  = "#0B1D3A";
const NAVY3 = "#1C3A60";
const GOLD  = "#C9A84C";
const GOLDD = "#A8813A";
const GOLDB = "rgba(201,168,76,0.12)";
const WHITE = "#FFFFFF";
const OFF   = "#F4F6F9";
const TEXT2 = "#4B5E78";
const TEXT3 = "#7A8EA8";
const SANS  = "'Pretendard','Apple SD Gothic Neo',sans-serif";

// ── Mock data (UI 전용 — DB/API 미연결) ──────────────────────────────────────
// 활동 예시: 콘텐츠 작성만이 아니라 "모든 성실한 행동"이 활동이다.
const ACTIVITIES = [
  "성실한 견적", "빠른 응답", "프로젝트 완료", "좋은 리뷰", "질문 답변", "시공사례", "노하우 공유",
];

// 신뢰가 쌓이는 흐름 — 성실한 활동 → 신뢰 → 상담 → 프로젝트.
const FLOW = [
  "성실한 견적", "빠른 응답", "프로젝트 완료", "좋은 리뷰", "신뢰", "상담", "프로젝트",
];

// 함께 호흡하는 공간파트너 — 랭킹이 아닌 활동 기록(Mock). 노하우 작성은 선택 활동.
const PARTNERS = [
  { emoji: "👷", name: "김○○ 대표", field: "주거 리모델링", region: "서울 전역",
    badges: ["성실 활동", "신뢰 파트너"],
    note: "견적 응답 142 · 프로젝트 완료 78 · 좋은 리뷰 54 · 질문 답변 21 · 시공사례 9 · 노하우 4" },
  { emoji: "🎨", name: "이○○ 실장", field: "상업 인테리어", region: "경기 남부",
    badges: ["전문 파트너", "공간 멘토"],
    note: "견적 응답 96 · 프로젝트 완료 51 · 좋은 리뷰 38 · 질문 답변 73 · 시공사례 15 · 노하우 11" },
  { emoji: "🛠️", name: "박○○ 소장", field: "도장·도배 전문", region: "인천·부천",
    badges: ["성실 활동", "전문 파트너"],
    note: "견적 응답 64 · 프로젝트 완료 33 · 좋은 리뷰 27 · 질문 답변 12 · 시공사례 18 · 노하우 2" },
];

// 인기 콘텐츠 — 최근 노하우/질문/시공사례(Mock).
const CONTENTS = [
  { tag: "노하우",   color: GOLD,      title: "겨울철 결로·곰팡이 잡는 단열 시공 순서", meta: "댓글 14 · 공감 52" },
  { tag: "질문",     color: NAVY3,     title: "20평 구축 아파트 올수리, 예산 어느 정도 봐야 할까요?", meta: "답변 9 · 조회 320" },
  { tag: "시공사례", color: "#16A085", title: "협소 주방을 ㄷ자 동선으로 — 전후 사진", meta: "댓글 23 · 공감 88" },
];

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

export default function BreathTrustSection() {
  const [ref, vis] = useVisible();

  const card = {
    background: WHITE, border: `1px solid #E4EAF3`, borderRadius: 14,
    padding: "18px 16px", boxShadow: "0 2px 12px rgba(11,29,58,0.06)",
  };

  return (
    <div style={{ background: OFF, padding: "56px 20px", fontFamily: SANS }}>
      <div style={{
        maxWidth: 520, margin: "0 auto",
        opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(22px)",
        transition: "opacity 0.45s ease-out, transform 0.45s ease-out",
      }} ref={ref}>
        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            display: "inline-block", background: GOLDB, color: GOLD,
            fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
            padding: "4px 12px", borderRadius: 99, marginBottom: 12,
          }}>
            공간마켓 라운지
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: NAVY, lineHeight: 1.35, marginBottom: 8 }}>
            호흡과 신뢰
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT2, lineHeight: 1.6 }}>
            모든 성실한 활동은 신뢰가 되고, 더 많은 기회로 이어집니다.
          </div>
        </div>

        {/* ── 철학 내러티브 ── */}
        <div style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY3} 100%)`,
          borderRadius: 16, padding: "22px 20px", marginBottom: 18,
          fontSize: 14.5, color: "rgba(255,255,255,0.9)", lineHeight: 1.85, textAlign: "center",
        }}>
          성실한 견적도, 빠른 응답도, 좋은 시공도, 좋은 리뷰도 모두 활동입니다.<br />
          글을 많이 쓰지 않아도 성실하게 일한 기록은<br />
          <span style={{ color: GOLD, fontWeight: 800 }}>신뢰가 되고, 더 많은 상담과 프로젝트로 이어집니다.</span>
        </div>

        {/* ── 기능 칩 ── */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginBottom: 22 }}>
          {ACTIVITIES.map((t) => (
            <span key={t} style={{
              fontSize: 12.5, fontWeight: 700, color: GOLDD,
              background: GOLDB, border: `1px solid ${GOLD}`,
              borderRadius: 99, padding: "6px 13px",
            }}>
              {t}
            </span>
          ))}
        </div>

        {/* ── 신뢰가 쌓이는 흐름 ── */}
        <div style={{ ...card, marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 12, textAlign: "center" }}>
            신뢰가 쌓이는 흐름
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 6 }}>
            {FLOW.map((t, i) => (
              <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: i >= FLOW.length - 2 ? GOLDD : TEXT2,
                  background: i >= FLOW.length - 2 ? GOLDB : OFF,
                  border: `1px solid ${i >= FLOW.length - 2 ? GOLD : "#E4EAF3"}`,
                  borderRadius: 8, padding: "5px 10px",
                }}>
                  {t}
                </span>
                {i < FLOW.length - 1 && <span style={{ color: GOLD, fontSize: 12, fontWeight: 900 }}>›</span>}
              </span>
            ))}
          </div>
        </div>

        {/* ── 함께 호흡하는 공간파트너 (Mock · 랭킹 아님) ── */}
        <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 4 }}>
          함께 호흡하는 공간파트너
        </div>
        <div style={{ fontSize: 12, color: TEXT3, marginBottom: 12, lineHeight: 1.6 }}>
          순위가 아닌 활동 기록입니다. 견적·응답·시공·리뷰 — 모든 성실한 활동을 동일한 가치로 남기며, 노하우 공유는 선택 활동입니다.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
          {PARTNERS.map((p) => (
            <div key={p.name} style={{ ...card, display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                background: GOLDB, border: `1px solid ${GOLD}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
              }}>
                {p.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>{p.name}</span>
                  <span style={{ fontSize: 12, color: TEXT3 }}>· {p.field}</span>
                </div>
                <div style={{ fontSize: 12, color: TEXT3, marginBottom: 7 }}>📍 {p.region}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
                  {p.badges.map((b) => (
                    <span key={b} style={{
                      fontSize: 11, fontWeight: 700, color: GOLDD,
                      background: GOLDB, borderRadius: 99, padding: "3px 9px",
                    }}>
                      ✦ {b}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: TEXT2, fontWeight: 600 }}>{p.note}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── 인기 콘텐츠 (Mock) ── */}
        <div style={{ fontSize: 15, fontWeight: 800, color: NAVY, marginBottom: 12 }}>
          라운지 인기 콘텐츠
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
          {CONTENTS.map((c) => (
            <div key={c.title} style={{
              ...card, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 800, color: WHITE, background: c.color,
                borderRadius: 7, padding: "4px 9px", flexShrink: 0,
              }}>
                {c.tag}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: NAVY, lineHeight: 1.45,
                  overflow: "hidden", textOverflow: "ellipsis" }}>{c.title}</div>
                <div style={{ fontSize: 11, color: TEXT3, marginTop: 3 }}>{c.meta}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── 마무리 메시지 (CTA 버튼 제거 — 가입 전환 방해 방지) ── */}
        <div style={{ fontSize: 14, fontWeight: 800, color: GOLDD, textAlign: "center", marginTop: 4, marginBottom: 10 }}>
          오늘의 활동이 내일의 프로젝트가 됩니다.
        </div>
        <div style={{ fontSize: 12.5, color: TEXT2, textAlign: "center", lineHeight: 1.75 }}>
          공간마켓은 업체를 경쟁시키지 않습니다.<br />
          모든 성실한 활동을 가치 있는 기록으로 남깁니다.<br />
          호흡과 신뢰를 함께 쌓아가며 더 좋은 프로젝트를 만들어갑니다.
        </div>
      </div>
    </div>
  );
}
