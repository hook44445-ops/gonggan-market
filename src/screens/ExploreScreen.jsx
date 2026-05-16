import { C, R, S, GRADE, PHOTOS } from "../constants";
import { BADGES } from "../constants/badges";
import { COMPANIES } from "../mock/mockCompanies";

const Stars = ({ n }) => (
  <span style={{ color: "#F5A623", fontSize: 12 }}>
    {"★".repeat(n)}{"☆".repeat(5 - n)}
  </span>
);

const TRUST_STATS = [
  { icon: "🏗", value: "1,247건", label: "누적 완료 공사" },
  { icon: "⭐", value: "4.85점", label: "평균 만족도" },
  { icon: "🛡", value: "38개사", label: "공간보증 업체" },
  { icon: "🌡", value: "91.2°", label: "평균 공간온도" },
];

const ESCROW_STEPS = [
  { step: "1", icon: "📋", title: "계약 체결", desc: "업체 선택 후\n공간마켓에 금액 예치" },
  { step: "2", icon: "🏗", title: "공사 진행", desc: "단계별 진행사진\n공유 및 확인" },
  { step: "3", icon: "✅", title: "단계 승인", desc: "의뢰인이 확인 후\n단계별 정산 승인" },
  { step: "4", icon: "💰", title: "안전 정산", desc: "완료 확인 후\n업체에 최종 지급" },
];

const BADGE_LIST = [
  { key: "basic",      range: "~500만원" },
  { key: "standard",  range: "~1,000만원" },
  { key: "premium",   range: "~2,000만원" },
  { key: "enterprise",range: "~5,000만원" },
  { key: "signature", range: "~1억원" },
];

const PREVIEW_REVIEWS = [
  {
    company: "홍익시공",
    user: "김민준", region: "마포구", rating: 5,
    amount: "2,650만원", type: "아파트 전체 32평",
    content: "에스크로 정산이라 처음부터 끝까지 불안하지 않았어요. 중간 점검 사진도 매번 공유해줬습니다.",
    photo: PHOTOS.apt_after1,
  },
  {
    company: "공간설계소",
    user: "최수진", region: "합정동", rating: 5,
    amount: "1,800만원", type: "오피스 30평",
    content: "미니멀 감성 완벽하게 구현. 공간 활용도가 훨씬 좋아졌고 직원들 만족도 높습니다.",
    photo: PHOTOS.office_a,
  },
  {
    company: "홍익시공",
    user: "이준호", region: "연남동", rating: 4,
    amount: "3,200만원", type: "카페 전체",
    content: "오픈 후 하자 발생 시에도 AS 빠르게 처리. 카페 오픈 2주 만에 만석이었어요.",
    photo: PHOTOS.cafe_after,
  },
];

export default function ExploreScreen({ onBack, onStart }) {
  const previewCompanies = COMPANIES.slice(0, 2);

  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif",
      paddingBottom: 100,
    }}>

      {/* Header */}
      <div style={{
        background: C.surface, padding: "14px 20px",
        borderBottom: `1px solid ${C.bgWarm}`,
        display: "flex", alignItems: "center", gap: 12,
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <button onClick={onBack}
          style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.text2, padding: "0 4px 0 0" }}>
          ←
        </button>
        <div style={{ fontSize: 17, fontWeight: 900, color: C.text1 }}>공간마켓 둘러보기</div>
      </div>

      <div style={{ padding: `${S.xl}px ${S.xl}px 0` }}>

        {/* Hero */}
        <div style={{
          background: `linear-gradient(150deg,${C.brandL} 0%,${C.bgWarm} 100%)`,
          borderRadius: R.xl, padding: S.xxl, marginBottom: S.xl,
          border: `1.5px solid ${C.brandM}`, textAlign: "center",
        }}>
          <div style={{ fontSize: 13, color: C.brand, fontWeight: 700, marginBottom: 8 }}>
            로그인 없이 둘러보세요
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: C.text1, marginBottom: 8, lineHeight: 1.4 }}>
            믿을 수 있는 시공,<br/>공간마켓이 보장합니다
          </div>
          <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.7 }}>
            에스크로 안전 정산 · 보증금 제도 · 단계별 승인
          </div>
        </div>

        {/* ── 1. 신뢰 지표 ── */}
        <div style={{ marginBottom: S.xl }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.md }}>
            📊 플랫폼 신뢰 지표
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: S.sm }}>
            {TRUST_STATS.map(({ icon, value, label }) => (
              <div key={label} style={{
                background: C.surface, borderRadius: R.xl, padding: S.xl,
                border: `1px solid ${C.bgWarm}`, textAlign: "center",
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: C.brand }}>{value}</div>
                <div style={{ fontSize: 11, color: C.text3, marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 2. 에스크로 설명 ── */}
        <div style={{ marginBottom: S.xl }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.md }}>
            🛡 에스크로 안전 정산이란?
          </div>
          <div style={{
            background: C.surface, borderRadius: R.xl, padding: S.xl,
            border: `1px solid ${C.bgWarm}`,
          }}>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: S.lg, lineHeight: 1.7 }}>
              공사 대금을 공간마켓이 보관하고, 단계 확인 후 업체에 지급합니다.<br/>
              먹튀·하자·미완성 공사로부터 의뢰인을 완전히 보호합니다.
            </div>
            {ESCROW_STEPS.map((item, i) => (
              <div key={item.step} style={{ display: "flex", gap: S.md, alignItems: "flex-start", marginBottom: i < ESCROW_STEPS.length - 1 ? S.lg : 0 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: R.full,
                    background: C.brandL, border: `1.5px solid ${C.brandM}`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                  }}>{item.icon}</div>
                  {i < ESCROW_STEPS.length - 1 && (
                    <div style={{ width: 1.5, height: 20, background: C.bgWarm, marginTop: 4 }} />
                  )}
                </div>
                <div style={{ paddingTop: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{
                      background: C.brand, color: "#fff", borderRadius: R.full,
                      width: 18, height: 18, display: "inline-flex", alignItems: "center",
                      justifyContent: "center", fontSize: 10, fontWeight: 900,
                    }}>{item.step}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>{item.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.7, whiteSpace: "pre-line" }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 3. 배지 설명 ── */}
        <div style={{ marginBottom: S.xl }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.md }}>
            🏆 공간보증 배지란?
          </div>
          <div style={{ fontSize: 13, color: C.text3, marginBottom: S.md, lineHeight: 1.7 }}>
            업체가 보증금을 예치하고 서류 심사를 통과해야만 받을 수 있는 인증입니다.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
            {BADGE_LIST.map(({ key, range }) => {
              const b = BADGES[key];
              return (
                <div key={key} style={{
                  background: b.bg, borderRadius: R.lg,
                  padding: `${S.md}px ${S.lg}px`,
                  display: "flex", alignItems: "center", gap: S.md,
                  border: `1px solid ${b.color}22`,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: R.lg,
                    background: b.grad, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 20, flexShrink: 0,
                  }}>{b.icon}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: b.color }}>{b.label}</div>
                    <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>공사 규모 {range} · 보증금 예치</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 4. 완료 후기 ── */}
        <div style={{ marginBottom: S.xl }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.md }}>
            💬 실제 완료 후기
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: S.md }}>
            {PREVIEW_REVIEWS.map((rev, i) => (
              <div key={i} style={{
                background: C.surface, borderRadius: R.xl,
                border: `1px solid ${C.bgWarm}`, overflow: "hidden",
              }}>
                <div style={{
                  height: 140, background: `url(${rev.photo}) center/cover no-repeat`,
                  position: "relative",
                }}>
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    background: "linear-gradient(transparent, rgba(0,0,0,0.55))",
                    padding: "24px 14px 10px",
                  }}>
                    <div style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>{rev.type}</div>
                  </div>
                </div>
                <div style={{ padding: S.lg }}>
                  <div style={{ display: "flex", alignItems: "center", gap: S.sm, marginBottom: 6 }}>
                    <Stars n={rev.rating} />
                    <span style={{ fontSize: 12, color: C.text3 }}>{rev.user} · {rev.region}</span>
                    <span style={{
                      marginLeft: "auto", background: C.brandL, color: C.brand,
                      borderRadius: R.full, padding: "2px 8px", fontSize: 11, fontWeight: 700,
                    }}>{rev.company}</span>
                  </div>
                  <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.65 }}>{rev.content}</div>
                  <div style={{ fontSize: 12, color: C.text4, marginTop: 6 }}>정산 금액: {rev.amount}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 5. 업체 미리보기 ── */}
        <div style={{ marginBottom: S.xl }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: 4 }}>
            🔨 업체 미리보기
          </div>
          <div style={{ fontSize: 13, color: C.text3, marginBottom: S.md }}>
            로그인 후 채팅·견적 요청이 가능합니다
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: S.md }}>
            {previewCompanies.map(co => {
              const grade = GRADE(co.temp);
              const b = co.badge ? BADGES[co.badge] : null;
              return (
                <div key={co.id} style={{
                  background: C.surface, borderRadius: R.xl,
                  padding: S.xl, border: `1px solid ${C.bgWarm}`,
                  opacity: 1,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.md }}>
                    <div style={{ display: "flex", gap: S.md, alignItems: "center" }}>
                      <div style={{
                        width: 46, height: 46, borderRadius: R.lg, flexShrink: 0,
                        background: grade.bg, display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 20,
                      }}>{grade.icon}</div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>{co.name}</div>
                        <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>
                          📍 {co.region} · 경력 {co.years}년
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        fontSize: 13, fontWeight: 900, color: grade.color,
                        background: grade.bg, borderRadius: R.full,
                        padding: "3px 10px",
                      }}>{co.temp}°</div>
                      {b && (
                        <div style={{ fontSize: 11, color: b.color, marginTop: 4, fontWeight: 700 }}>
                          {b.icon} {b.label}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.text3, marginBottom: S.sm, lineHeight: 1.6 }}>{co.desc}</div>
                  <div style={{ display: "flex", gap: S.lg }}>
                    {[
                      ["완료", `${co.completedJobs}건`],
                      ["재계약", `${co.recontractRate}%`],
                      ["AS", `${co.asRate}%`],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>{v}</div>
                        <div style={{ fontSize: 10, color: C.text4 }}>{k}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{
                    marginTop: S.md, padding: `${S.sm}px ${S.md}px`,
                    background: C.bg, borderRadius: R.md,
                    fontSize: 12, color: C.text4, textAlign: "center",
                  }}>
                    🔒 로그인 후 채팅·견적 가능
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Bottom CTA ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: C.surface, borderTop: `1px solid ${C.bgWarm}`,
        padding: `${S.lg}px ${S.xl}px ${S.xl}px`,
        display: "flex", flexDirection: "column", gap: S.sm,
      }}>
        <button onClick={() => onStart("consumer")}
          style={{
            background: `linear-gradient(135deg,${C.brand},${C.brandD})`,
            color: "#fff", border: "none", borderRadius: R.lg,
            padding: "16px", fontWeight: 800, fontSize: 15, cursor: "pointer",
            boxShadow: `0 4px 16px ${C.brand}44`,
          }}>
          🏡 의뢰인으로 시작
        </button>
        <button onClick={() => onStart("company")}
          style={{
            background: C.surface, color: C.brand,
            border: `2px solid ${C.brandM}`, borderRadius: R.lg,
            padding: "16px", fontWeight: 800, fontSize: 15, cursor: "pointer",
          }}>
          🔨 업체로 시작
        </button>
      </div>
    </div>
  );
}
