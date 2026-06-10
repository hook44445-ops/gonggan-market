import { useState } from "react";
import { C, R, S } from "../constants";
import { BADGES, requiredDeposit, depositRatePct } from "../constants/badges";

export default function CompanyDepositCard({ badge = "standard", hasInsurance = false, onUpgrade }) {
  const BADGE_LEVELS = [
    { key:"basic",      ...BADGES.basic,      maxJob:500,   desc:"소규모 부분 공사",       insurance:false },
    { key:"standard",   ...BADGES.standard,   maxJob:1000,  desc:"중형 아파트 시공",        insurance:false },
    { key:"premium",    ...BADGES.premium,    maxJob:2000,  desc:"대형·상업 공간 전문",     insurance:true  },
    { key:"enterprise", ...BADGES.enterprise, maxJob:5000,  desc:"대규모·상업 공간",        insurance:true  },
    { key:"signature",  ...BADGES.signature,  maxJob:99999, desc:"최상위 VIP 파트너십",     insurance:true  },
  ];
  const [showUpgradeSheet, setShowUpgradeSheet] = useState(false);

  // 보증예치금 = 수주한도 × 비율(보험 10% / 미가입 20%) — 단일 소스(badges.js).
  const depositOf = (key) => requiredDeposit(key, hasInsurance);
  const ratePct = depositRatePct(hasInsurance);

  const current = BADGE_LEVELS.find(b => b.key === badge) || BADGE_LEVELS[1];
  const currentIdx = BADGE_LEVELS.findIndex(b => b.key === badge);
  const next = BADGE_LEVELS[currentIdx + 1] || null;
  const currentDeposit = depositOf(current.key);
  const nextDeposit = next ? depositOf(next.key) : 0;
  const additionalNeeded = next ? nextDeposit - currentDeposit : 0;

  const badgeColor = { grad: (BADGES[badge] ?? BADGES.standard).grad };

  return (
    <>
      {/* Main card */}
      <div style={{ background:C.surface, borderRadius:R.xl, overflow:"hidden",
        marginBottom:S.lg, border:`1px solid ${C.bgWarm}` }}>

        {/* Top gradient section */}
        <div style={{ background:badgeColor.grad, padding:S.xxl, color:"#fff" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:S.xl }}>
            <div>
              <div style={{ fontSize:12, opacity:0.75, marginBottom:4 }}>보증예치금</div>
              <div style={{ fontSize:34, fontWeight:900, marginBottom:8 }}>
                {currentDeposit.toLocaleString()}만원
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                <span style={{ background:"rgba(255,255,255,0.18)", borderRadius:R.full,
                  padding:"3px 11px", fontSize:12, fontWeight:700 }}>
                  {current.icon} {current.label}
                </span>
                <span style={{ background:"rgba(255,255,255,0.18)", borderRadius:R.full,
                  padding:"3px 11px", fontSize:12, fontWeight:700 }}>
                  수주 한도 {current.maxJob === 99999 ? "무제한" : `${current.maxJob.toLocaleString()}만원`}
                </span>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:32, marginBottom:4 }}>{current.icon}</div>
              <div style={{ fontSize:11, opacity:0.7 }}>{current.desc}</div>
            </div>
          </div>

          {/* Badge level progress */}
          <div style={{ marginBottom:S.md }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11,
              opacity:0.75, marginBottom:6 }}>
              <span>등급 현황</span>
              <span>{currentIdx + 1} / {BADGE_LEVELS.length} 단계</span>
            </div>
            <div style={{ display:"flex", gap:4 }}>
              {BADGE_LEVELS.map((b, i) => (
                <div key={b.key} style={{ flex:1, height:4, borderRadius:R.full,
                  background: i <= currentIdx ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.25)",
                  transition:"background 0.3s" }} />
              ))}
            </div>
          </div>

          {/* Insurance badge */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:6,
            background: hasInsurance ? "rgba(0,153,92,0.25)" : "rgba(255,255,255,0.12)",
            borderRadius:R.full, padding:"5px 12px",
            border:`1px solid ${hasInsurance ? "rgba(0,153,92,0.4)" : "rgba(255,255,255,0.2)"}` }}>
            <span style={{ fontSize:14 }}>{hasInsurance ? "🛡" : "⚠️"}</span>
            <span style={{ fontSize:12, fontWeight:700, opacity: hasInsurance ? 1 : 0.8 }}>
              {hasInsurance ? "시공보험 가입 완료" : "시공보험 미가입"}
            </span>
          </div>
        </div>

        {/* Details rows */}
        <div style={{ padding:S.xl }}>
          {[
            ["보관 방식",  "공간마켓 법인 신탁 계좌"],
            ["수주 한도",  current.maxJob === 99999 ? "무제한" : `${current.maxJob.toLocaleString()}만원`],
            ["보증예치 비율",`${ratePct}%${hasInsurance ? " (시공보험 가입)" : " (시공보험 미가입)"}`],
            ["환급 조건",  "분쟁 없을 시 정해진 조건에 따라 반환"],
            ["현재 상태",  "✅ 정상 관리 중"],
          ].map(([k, v], i, arr) => (
            <div key={k} style={{ display:"flex", justifyContent:"space-between",
              alignItems:"center", padding:`${S.sm}px 0`,
              borderBottom: i < arr.length - 1 ? `1px solid ${C.bgWarm}` : "none" }}>
              <span style={{ fontSize:13, color:C.text3 }}>{k}</span>
              <span style={{ fontSize:13, fontWeight:700, color:C.text1 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade CTA */}
      {next && (
        <div style={{ background:C.brandL, borderRadius:R.xl, padding:S.xl,
          marginBottom:S.lg, border:`1px solid ${C.brandM}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:S.sm }}>
            <div style={{ fontSize:15, fontWeight:800, color:C.brand }}>
              {next.icon} {next.label}으로 업그레이드
            </div>
            <span style={{ background:C.brand, color:"#fff", borderRadius:R.full,
              padding:"2px 9px", fontSize:11, fontWeight:700 }}>+{additionalNeeded}만원</span>
          </div>
          <div style={{ fontSize:13, color:C.text2, lineHeight:1.7, marginBottom:S.md }}>
            보증예치금 추가 등록 시<br/>
            상위 등급(수주 한도 <b style={{color:C.brand}}>{next.maxJob === 99999 ? "무제한" : `${next.maxJob.toLocaleString()}만원`}</b>)으로 승급할 수 있습니다.
            {!hasInsurance && next.insurance && (
              <><br/><span style={{color:C.green, fontWeight:700}}>🛡 시공보험 가입 시 예치 비율 10% 적용</span></>
            )}
          </div>
          <button onClick={() => setShowUpgradeSheet(true)}
            style={{ width:"100%", padding:"12px", background:C.brand, color:"#fff",
              border:"none", borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer",
              boxShadow:`0 3px 12px ${C.brand}44` }}>
            업그레이드 신청하기 →
          </button>
        </div>
      )}

      {/* Safety info */}
      <div style={{ background:C.surface, borderRadius:R.xl, padding:S.xl,
        border:`1px solid ${C.bgWarm}`, marginBottom:S.lg }}>
        <div style={{ fontSize:14, fontWeight:800, color:C.text1, marginBottom:S.md }}>
          🛡️ 보증예치금 보호 정책
        </div>
        {[
          "보증예치금은 회사 운영비와 분리 보관됩니다.",
          "분쟁이 없을 경우 전액 반환됩니다.",
          "시공보험 가입 업체는 10%, 미가입 업체는 20% 예치가 적용됩니다.",
          "고객 보호와 신뢰 거래를 위한 제도입니다.",
        ].map(t => (
          <div key={t} style={{ display:"flex", gap:S.sm, alignItems:"center",
            padding:`${S.xs}px 0`, borderBottom:`1px solid ${C.bgWarm}` }}>
            <span style={{ color:C.green, fontWeight:900, fontSize:14 }}>✓</span>
            <span style={{ fontSize:13, color:C.text2 }}>{t}</span>
          </div>
        ))}
      </div>

      {/* Upgrade bottom sheet */}
      {showUpgradeSheet && next && (
        <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.65)",
          display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:300 }}
          onClick={e => { if (e.target === e.currentTarget) setShowUpgradeSheet(false); }}>
          <div style={{ background:C.surface, borderRadius:"24px 24px 0 0", width:"100%",
            maxWidth:480, padding:"24px 24px 40px" }}>
            <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />

            <div style={{ textAlign:"center", marginBottom:S.xxl }}>
              <div style={{ fontSize:48, marginBottom:10 }}>{next.icon}</div>
              <div style={{ fontSize:19, fontWeight:900, color:C.text1, marginBottom:6 }}>
                {next.label} 업그레이드
              </div>
              <div style={{ fontSize:13, color:C.text3, lineHeight:1.7 }}>
                보증예치금 <b style={{color:C.brand}}>{additionalNeeded}만원</b>을 추가 등록하면<br/>
                {next.label} 등급으로 승급됩니다
              </div>
            </div>

            <div style={{ background:C.surface2, borderRadius:R.lg, padding:S.lg, marginBottom:S.xl }}>
              {[
                [`현재 ${current.label}`, `${currentDeposit.toLocaleString()}만원`],
                [`추가 등록`, `+${additionalNeeded.toLocaleString()}만원`],
                [`${next.label} 총 보증예치금`, `${nextDeposit.toLocaleString()}만원`],
              ].map(([k, v], i, arr) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between",
                  padding:`${S.sm}px 0`,
                  borderBottom: i < arr.length - 1 ? `1px solid ${C.bgWarm}` : "none",
                  fontWeight: i === arr.length - 1 ? 800 : 600,
                  color: i === arr.length - 1 ? C.brand : C.text2 }}>
                  <span style={{ fontSize:13 }}>{k}</span>
                  <span style={{ fontSize:13 }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ display:"flex", gap:S.sm }}>
              <button onClick={() => setShowUpgradeSheet(false)}
                style={{ flex:1, padding:S.xl, background:C.bg, color:C.text2,
                  border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>
                나중에
              </button>
              <button onClick={() => { setShowUpgradeSheet(false); onUpgrade && onUpgrade(next); }}
                style={{ flex:2, padding:S.xl, background:C.brand, color:"#fff",
                  border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer",
                  boxShadow:`0 4px 16px ${C.brand}44` }}>
                신청하기 →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
