// 업체 신뢰 엠블럼 — 사업자 · 시공보험 · 보증금 + 성장 레벨(씨앗→숲).
//
// 왜 이렇게 바꿨나
//   예전 카드는 같은 사실을 세 번씩 말했다 — 칩 줄(공간보증·시공보험·사업자), 공간보증 배지 줄,
//   체크리스트 줄(✅▫️ 다섯 개). 전부 이모지라 「프리미엄 견적비교」로 보이지 않았다.
//   이제 한 줄이다: 왼쪽에 레벨 엠블럼, 오른쪽에 증빙 엠블럼 셋.
//
// 수집하고 싶게(덕질)
//   · 딴 엠블럼은 금빛으로 빛나고, 못 딴 것은 흐린 «빈 자리»로 남는다.
//     무엇을 내면 자리가 채워지는지가 눈에 보여야 모으고 싶어진다.
//   · 레벨은 원신 등급처럼 단계가 오를수록 테두리가 화려해진다(씨앗=맨 링 … 숲=별 왕관).
//
// 그림: 힉스필드(gpt_image_2_5)로 한 가족을 뽑았다 — public/images/emblem/*.webp
//   · -sm.webp: 카드용(흐린 별빛을 걷어낸 알맹이) · 128px
//   · .webp   : 상세·수집함용(별빛까지) · 384px
//   작게 쓸 땐 36px 아래로 내리지 않는다 — 28px 에선 인증서·방패·금고가 서로 구분되지 않는다.

import { stageFor } from "../lib/growthStage";
import { levelInfo, computeCompanyXp } from "../constants/growth";
import { isGuaranteeBadgeVisible, GUARANTEE_GRADE_MAP } from "../constants/guarantee";

const INK   = "#2B2A26";
const MUTED = "#9A9384";
const GOLD  = "#B08A3E";

// lockedText 는 의뢰인이 보는 말, hint 는 업체 자신에게 하는 말(내 카드 미리보기 등).
export const TRUST_EMBLEMS = [
  { key: "biz",       file: "biz",       label: "사업자",   earnedText: "사업자등록을 확인했습니다",     lockedText: "사업자등록이 아직 확인되지 않았습니다", hint: "사업자등록증을 내면 채워집니다" },
  { key: "insurance", file: "insurance", label: "시공보험", earnedText: "시공보험에 가입한 업체입니다",   lockedText: "시공보험 가입이 확인되지 않았습니다",   hint: "시공보험 증권을 내면 채워집니다" },
  { key: "deposit",   file: "deposit",   label: "보증금",   earnedText: "공간보증 보증금을 예치했습니다", lockedText: "보증금을 예치하지 않은 업체입니다",     hint: "공간보증에 참여하면 채워집니다" },
];

// 업체 데이터 → 무엇을 땄나.
// ⚠ 엠블럼은 «관리자가 확인한 것»으로만 켠다. 업체가 스스로 낸 값·올리기만 한 서류로는 켜지 않는다.
//   카드가 의뢰인에게 「확인했습니다」라고 말하기 때문이다(거짓이 되면 프리미엄 전체가 무너진다).
//   · 사업자  — companies.verified : 관리자가 업체를 승인할 때만 켜진다(adminReviewCompany).
//               biz_cert_url(올리기만 한 서류)로는 켜지 않는다.
//   · 시공보험 — companies.has_insurance : 보험 증권 승인 때 켜지도록 adminReviewDocument 가 맞춘다.
//   · 보증금  — 공간보증(068) ACTIVE + 노출 : 입금 확인·관리자 승인을 거친 서버 값.
//               옛 companies.badge 는 가입 화면에서 결제 없이 기록되던 값이라 보지 않는다.
export function trustState(company = {}) {
  const deposit = isGuaranteeBadgeVisible(company);
  const grade = deposit ? (GUARANTEE_GRADE_MAP[company.guarantee_grade]?.label ?? null) : null;
  return {
    biz:       company.verified === true,
    insurance: (company.has_insurance ?? company.insurance) === true,
    deposit,
    depositGrade: grade,
  };
}

// 업체 레벨 — 값이 있으면 그대로, 없으면 카드가 가진 집계로 추정한다(읽기 전용, DB 쓰기 없음).
export function companyLevel(company = {}) {
  const given = Number(company.level ?? company.growth_level);
  if (given >= 1) return Math.min(10, Math.floor(given));
  const xp = computeCompanyXp({
    completedCount: Number(company.completedJobs ?? company.completed_count ?? 0),
    reviewCount:    Number(company.reviews ?? company.review_count ?? 0),
    hasGuarantee:   trustState(company).deposit,
  });
  return levelInfo(xp).level;
}

// 엠블럼 한 개. earned=false 면 흐린 빈 자리.
export function Emblem({ file, earned = true, size = 36, title, large = false }) {
  return (
    <img
      src={`/images/emblem/${file}${large ? "" : "-sm"}.webp`}
      alt={title || ""}
      title={title}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={earned ? "gg-emblem gg-emblem-earned" : "gg-emblem"}
      style={{
        width: size, height: size, flexShrink: 0, display: "block",
        filter: earned ? undefined : "grayscale(1)",
        opacity: earned ? 1 : 0.45,
      }}
    />
  );
}

// 레벨이 오를수록 테두리 장식(별 문장·펜던트)이 커져서, 같은 칸에 넣으면 메달 본체가 쪼그라든다 —
// 숲이 씨앗보다 작아 보이는 역전이 생긴다. 그래서 «본체 지름»을 모든 단계에서 같게 맞추고
// 장식은 칸 밖으로 솟게 둔다. 그러면 높은 등급일수록 실제로 더 크고 화려해 보인다.
// disc: 초록 원판 지름 / 그림 폭 · cy: 원판 중심 높이 / 그림 높이 (-sm.webp 실측)
const LV_FIT = {
  seed:   { disc: 0.883, cy: 0.504 },
  root:   { disc: 0.734, cy: 0.414 },
  stem:   { disc: 0.664, cy: 0.449 },
  tree:   { disc: 0.555, cy: 0.500 },
  forest: { disc: 0.539, cy: 0.520 },
};

export function LevelEmblem({ level = 1, size = 40, large = false }) {
  const st = stageFor(level);
  const fit = LV_FIT[st.id] ?? { disc: 0.8, cy: 0.5 };
  const img = Math.round((size * 0.8) / fit.disc);          // 본체가 칸의 80% 가 되게
  const dy = Math.round((0.5 - fit.cy) * img);               // 본체 중심을 칸 중심에
  return (
    <span style={{ position: "relative", display: "inline-block", width: Math.round(size * 1.25), height: size, flexShrink: 0 }}>
      <span style={{ position: "absolute", left: "50%", top: "50%",
        transform: `translate(-50%, calc(-50% + ${dy}px))` }}>
        <Emblem file={`lv-${st.id}`} earned size={img} large={large} title={`Lv.${level} ${st.name}`} />
      </span>
    </span>
  );
}

// 업체카드 한 줄 — 레벨 + 증빙 셋. 여백을 넉넉히 둔다(세련됨은 비움에서 나온다).
export function CompanyTrustRow({ company, style, forPartner = false }) {
  if (!company) return null;
  const s = trustState(company);
  const level = companyLevel(company);
  const st = stageFor(level);
  const earnedCount = TRUST_EMBLEMS.filter(e => s[e.key]).length;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      paddingTop: 12, borderTop: "1px solid rgba(43,42,38,0.07)", ...style,
    }}>
      {/* 레벨 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <LevelEmblem level={level} size={40} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: GOLD, letterSpacing: "0.08em" }}>LV.{level}</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: INK, marginTop: 1 }}>{st.name}</div>
        </div>
      </div>

      {/* 증빙 셋 */}
      <div
        aria-label={`신뢰 증빙 ${earnedCount}개 / ${TRUST_EMBLEMS.length}개`}
        style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
      >
        {TRUST_EMBLEMS.map(e => {
          const on = s[e.key];
          const sub = e.key === "deposit" && on && s.depositGrade ? s.depositGrade : e.label;
          return (
            <div key={e.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 44 }}>
              <Emblem file={e.file} earned={on} size={36} title={on ? e.earnedText : (forPartner ? e.hint : e.lockedText)} />
              <span style={{
                marginTop: 3, fontSize: 10, fontWeight: on ? 700 : 500,
                color: on ? INK : MUTED, whiteSpace: "nowrap",
              }}>{sub}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
