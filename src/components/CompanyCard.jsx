// 업체카드 — 의뢰인이 업체를 «비교»하는 자리.
//
// 세 가지 모양이 있다(lib/partnerTier.js). 증빙을 낼수록 카드가 한 단계씩 좋아진다.
//   기본        아무것도 안 냄 — 깔끔하지만 수수하다. 빈 자리 셋이 보인다.
//   확인된 업체  1~2개 — 초록 테두리.
//   프리미엄     셋 다 — 대표 시공 사진·금테·문장(紋章). 한눈에 급이 다르다.
// 업체가 이 차이를 보고 스스로 사업자·시공보험·보증금을 내고 싶어지게 하는 것이 목적이다.
// 의뢰인에게도 거짓이 없다 — 프리미엄은 세 가지를 모두 증빙했다는 뜻 그대로다.
//
// 비교가 되려면 숫자가 모든 카드에서 같은 자리·같은 순서여야 한다: 완료 · 평점 · 응답 · 분쟁.

import { C, R, S } from "../constants";
import { TempBadge } from "./common";
import { CompanyTrustRow, trustState } from "./TrustEmblems";
import { partnerTier, coverOf, compareStats } from "../lib/partnerTier";

const INK = "#1F2A24";
const MUTED = "#8C8577";
const GOLD = "#C9A55C";
const GOLD_D = "#9C7A3A";

const FRAME = {
  basic:    { border: "1px solid #ECE6DA", shadow: "0 1px 2px rgba(24,33,29,0.04)", body: "#FFFFFF" },
  verified: { border: "1px solid rgba(46,95,75,0.32)", shadow: "0 2px 8px rgba(24,33,29,0.06)", body: "#FFFFFF" },
  premium:  { border: `1px solid ${GOLD}`, shadow: "0 10px 28px rgba(156,122,58,0.18), 0 2px 6px rgba(24,33,29,0.06)", body: "#FFFDF8" },
};

function Heart({ saved, onToggle, company, onDark }) {
  if (!onToggle) return null;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(company); }}
      aria-label={saved ? "관심 업체 해제" : "관심 업체 저장"}
      style={{
        background: onDark ? "rgba(15,28,20,0.35)" : "none", border: "none", cursor: "pointer",
        width: 32, height: 32, borderRadius: 16, display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, lineHeight: 1, padding: 0,
        color: saved ? "#E0685A" : onDark ? "#FFFFFF" : C.text4,
        backdropFilter: onDark ? "blur(6px)" : undefined,
      }}>
      {saved ? "♥" : "♡"}
    </button>
  );
}

function Activity({ company, light }) {
  const on = !!company.online;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600,
      color: light ? "rgba(255,255,255,0.82)" : (on ? C.green : MUTED) }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: on ? "#5FBF8A" : (light ? "rgba(255,255,255,0.5)" : "#C9C2B4") }} />
      {on ? `활동중${company.lastActive ? ` · ${company.lastActive}` : ""}` : (company.responseTime || "응답 가능")}
    </span>
  );
}

// 비교 줄 — 숫자는 크게, 이름은 작게. 네 칸이 모든 카드에서 같은 자리에 선다.
function StatStrip({ company, premium }) {
  const stats = compareStats(company);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
      borderTop: `1px solid ${premium ? "rgba(201,165,92,0.28)" : "rgba(31,42,36,0.07)"}`,
      borderBottom: `1px solid ${premium ? "rgba(201,165,92,0.28)" : "rgba(31,42,36,0.07)"}`,
      padding: "10px 0" }}>
      {stats.map((s, i) => (
        <div key={s.key} style={{ textAlign: "center",
          borderLeft: i === 0 ? "none" : `1px solid ${premium ? "rgba(201,165,92,0.2)" : "rgba(31,42,36,0.06)"}` }}>
          <div style={{ fontSize: 16.5, fontWeight: 800, color: INK, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
            {s.value}{s.value !== "—" && s.unit ? <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 1 }}>{s.unit}</span> : null}
          </div>
          <div style={{ fontSize: 10.5, color: MUTED, marginTop: 3, fontWeight: 600 }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// 프리미엄 머리 — 업체가 끝낸 공사 사진이 카드의 얼굴이 된다. 사진이 없으면 딥그린 판에 금선.
function PremiumHead({ company, cover, saved, onToggleSave }) {
  const sub = [company.region, (company.specialties ?? []).slice(0, 2).join(" · ")].filter(Boolean).join(" · ");
  return (
    <div style={{ position: "relative", height: cover ? 156 : 104, overflow: "hidden",
      background: cover ? "#1A2E22" : "linear-gradient(135deg, #17472F 0%, #1F3B2C 100%)" }}>
      {cover ? (
        <img src={cover} alt="" loading="lazy" decoding="async"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ position: "absolute", left: 16, right: 16, top: 52, height: 1,
          background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, opacity: 0.55 }} />
      )}
      <div style={{ position: "absolute", inset: 0,
        background: "linear-gradient(180deg, rgba(12,24,17,0.28) 0%, rgba(12,24,17,0) 34%, rgba(12,24,17,0.78) 100%)" }} />

      {/* 문장 — 프리미엄 파트너 */}
      <div style={{ position: "absolute", left: 14, top: 12, display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 10px 5px 8px", borderRadius: 999, background: "rgba(12,24,17,0.52)",
        border: `1px solid rgba(201,165,92,0.55)`, backdropFilter: "blur(6px)" }}>
        <span style={{ color: GOLD, fontSize: 11, lineHeight: 1 }}>✦</span>
        <span style={{ color: "#F3E6C4", fontSize: 10.5, fontWeight: 800, letterSpacing: "0.12em" }}>PREMIUM PARTNER</span>
      </div>
      <div style={{ position: "absolute", right: 10, top: 8 }}>
        <Heart saved={saved} onToggle={onToggleSave} company={company} onDark />
      </div>

      <div style={{ position: "absolute", left: 16, right: 16, bottom: 12 }}>
        <div style={{ color: "#FFFFFF", fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em",
          textShadow: "0 1px 8px rgba(0,0,0,0.25)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {company.name}
        </div>
        {sub && <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 12, marginTop: 3,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
      </div>
    </div>
  );
}

// 기본·확인 머리 — 이름 글자 판. 확인된 업체는 이름 아래 초록 한 줄.
function PlainHead({ company, tier, saved, onToggleSave }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0,
        background: tier.key === "verified" ? "#EAF2EE" : "#F2EEE6",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, fontWeight: 800, color: tier.key === "verified" ? C.brand : "#9A9384" }}>
        {(company.name ?? "?")[0]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <span style={{ fontSize: 15.5, fontWeight: 800, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {company.name}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, marginTop: -4, marginRight: -6 }}>
            <TempBadge temp={company.temp} info />
            <Heart saved={saved} onToggle={onToggleSave} company={company} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
          {tier.key === "verified" && (
            <span style={{ fontSize: 11, fontWeight: 700, color: C.brand }}>확인된 업체 · {tier.count}/{tier.total}</span>
          )}
          <Activity company={company} />
        </div>
      </div>
    </div>
  );
}

export default function CompanyCard({ company, onClick, saved = false, onToggleSave }) {
  if (!company) return null;
  const tier = partnerTier(trustState(company));
  const frame = FRAME[tier.key];
  const premium = tier.key === "premium";
  const cover = premium ? coverOf(company) : null;
  const line = [company.distance, company.desc].filter(Boolean).join(" · ");

  return (
    <div onClick={onClick} className="gg-rise" style={{
      background: frame.body, borderRadius: 20, marginBottom: S.md, cursor: "pointer",
      border: frame.border, boxShadow: frame.shadow, overflow: "hidden",
    }}>
      {premium && <PremiumHead company={company} cover={cover} saved={saved} onToggleSave={onToggleSave} />}

      <div style={{ padding: premium ? "12px 16px 16px" : "16px 16px 16px" }}>
        {premium ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Activity company={company} />
            <TempBadge temp={company.temp} info />
          </div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <PlainHead company={company} tier={tier} saved={saved} onToggleSave={onToggleSave} />
          </div>
        )}

        <StatStrip company={company} premium={premium} />

        {line && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "#6F695D", lineHeight: 1.55,
            display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {line}
          </div>
        )}

        <CompanyTrustRow company={company} style={{ marginTop: 12 }} />
      </div>
    </div>
  );
}
