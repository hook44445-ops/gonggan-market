// ════════════════════════════════════════════════════════════════════
// Space OS — A / S / C 내부 점수 엔진 (Phase 3 · v3.0)
//
//   목적: 업체의 성장·추천을 위한 '내부 운영 점수(Internal Score)'를 산출한다.
//        사용자에게는 노출하지 않는다(노출은 LV·XP·Progress·공간온도만).
//
//   3축 구조:
//     A(본질, 0~100)  — 성실·정직. 가장 중요한 절대 기준.
//     S(실력, +0~20)  — 기술·완성도 보너스. A 를 대체할 수 없다.
//     C(공동체, +0~20) — 라운지 건전 기여 보너스. A 를 대체할 수 없다.
//
//   ▶ 절대 원칙: A 가 낮으면 S·C 가 만점이어도 추천 대상이 될 수 없다.
//
//   ⚠️ 순수 함수(부수효과·DB·네트워크 없음). 기존 집계에서 읽기 전용으로 산출.
//      XP 지급·LV 계산·공간온도·견적요청 정책·추천 라이브 정렬을 변경하지 않는다(Add Only).
//      A/S/C 의 라이브 추천 알고리즘 연결은 Phase 4 에서 진행한다.
// ════════════════════════════════════════════════════════════════════
import { SPACE_OS_SCORE_MODEL, C_BONUS_EVENTS } from "../constants/spaceOs";

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const clamp01 = (n) => clamp(n, 0, 1);

// ── A Score (본질) 0~100 — 성실·정직·책임 ───────────────────────────
//   가중치 합 100. 기존 업체 집계에서 읽기 전용 파생(없는 값은 0 처리).
//   factors: { record, honesty, review, as, response, transparency, steady }
export function computeAScore(company = {}) {
  const c = company || {};
  const completed   = num(c.completedJobs);
  const reviews     = num(c.reviews ?? c.reviewCount);
  const rating      = num(c.rating);
  const disputeRate = num(c.disputeRate);                 // %
  const asRate      = num(c.asRate);                       // %
  const respH       = c.avgResponseHours != null ? num(c.avgResponseHours) : null;
  const recontract  = num(c.recontractRate);              // %
  const guarantee   = c.guarantee_status === "ACTIVE" || !!c.guarantee_grade || !!c.badge;
  const verified    = !!(c.verified || c.bizCert || c.is_verified);

  // 각 평가요소 0~1 정규화
  const fRecord       = clamp01(completed / 10);                        // 프로젝트 기록·완료(10건 만점)
  const fHonesty      = clamp01(1 - disputeRate / 10);                  // 정직(분쟁 10%↑ → 0)
  const fReview       = clamp01((reviews / 10) * clamp01(rating / 4.5)); // 리뷰량 × 평점
  const fAs           = clamp01(asRate / 100);                          // A/S 책임
  const fResponse     = respH == null ? 0.4 : clamp01(1 - respH / 24);  // 응답 성실도(24h↑ → 0)
  const fTransparency = (guarantee ? 0.6 : 0) + (verified ? 0.4 : 0);   // 투명 거래(보증+인증)
  const fSteady       = clamp01(recontract / 50);                       // 꾸준함(재계약 50% 만점)

  const weighted = [
    [fRecord, 25], [fHonesty, 15], [fReview, 15], [fAs, 10],
    [fResponse, 10], [fTransparency, 15], [fSteady, 10],
  ];
  const a = weighted.reduce((s, [f, w]) => s + clamp01(f) * w, 0);
  return Math.round(clamp(a, 0, SPACE_OS_SCORE_MODEL.A.max));
}

// ── S Bonus (실력) 0~20 — 시공 품질·포트폴리오·경험 ─────────────────
export function computeSBonus(company = {}) {
  const c = company || {};
  const rating    = num(c.rating);
  const portfolio = num(c.portfolioCount
    ?? (Array.isArray(c.portfolios) ? c.portfolios.length : 0)
    ?? (Array.isArray(c.portfolio) ? c.portfolio.length : 0));
  const completed = num(c.completedJobs);

  const fQuality   = clamp01((rating - 3) / 2);   // 3.0~5.0 → 0~1 (시공 품질·고객 만족)
  const fPortfolio = clamp01(portfolio / 6);      // 포트폴리오 6건 만점
  const fExp       = clamp01(completed / 30);     // 시공 경험 30건 만점
  const s = (fQuality * 0.5 + fPortfolio * 0.25 + fExp * 0.25) * SPACE_OS_SCORE_MODEL.S.max;
  return Math.round(clamp(s, 0, SPACE_OS_SCORE_MODEL.S.max));
}

// ── C Bonus (공동체) 0~20 — 라운지 건전 기여(이벤트 누적) ────────────
//   community 통계 미연동 시 0(대부분 업체 객체엔 미포함 — Phase 4 데이터 연동).
//   입력: { posts, likes, popularPosts, acceptedAnswers(helpfulPosts), healthy30d, hasReports }
export function computeCBonus(community = {}) {
  const cm = community || {};
  const posts     = num(cm.posts ?? cm.postCount);
  const likes     = num(cm.likes ?? cm.likesReceived);
  const popular   = num(cm.popularPosts);
  const accepted  = num(cm.acceptedAnswers ?? cm.helpfulPosts);
  const healthy30 = !!cm.healthy30d && !cm.hasReports;
  const E = C_BONUS_EVENTS;

  let c = 0;
  if (posts >= 1)    c += E.FIRST_POST;       // 첫 글
  if (accepted >= 1) c += E.HELPFUL_POST;     // 도움글(채택)
  if (likes >= 10)   c += E.WELL_LIKED_POST;  // 좋아요 많은 글
  if (popular >= 1)  c += E.POPULAR_POST;     // 인기글
  if (healthy30)     c += E.HEALTHY_30D;      // 30일 건전 활동
  return Math.round(clamp(c, 0, E.MAX));
}

// ── 종합 — A/S/C + 추천 가능 여부(A 절대 기준) ───────────────────────
//   recommendable 은 오직 A 로 결정된다. S·C 는 total 에만 더해질 뿐 자격을 만들지 못한다.
export function computeSpaceOsScore(company = {}, community = {}) {
  const a = computeAScore(company);
  const s = computeSBonus(company);
  const c = computeCBonus(community);
  const recommendable = a >= SPACE_OS_SCORE_MODEL.RECOMMEND_MIN_A; // S·C 로 대체 불가
  const premium       = a >= SPACE_OS_SCORE_MODEL.PREMIUM_MIN_A;
  const tier = !recommendable ? "성장 중" : premium ? "프리미엄 추천" : "추천";
  return { a, s, c, total: a + s + c, recommendable, premium, tier };
}

// ── 프리미엄 추천 정렬 비교자 — 1순위 A · 2순위 S · 3순위 C ──────────
//   ⚠️ 라이브 추천/정렬에 자동 연결하지 않는다(Phase 4). 운영용 제공만 함.
//   Array.sort 비교자(내림차순): 추천가능 우선 → A → S → C.
export function compareForRecommendation(x = {}, y = {}, xCommunity = {}, yCommunity = {}) {
  const X = computeSpaceOsScore(x, xCommunity);
  const Y = computeSpaceOsScore(y, yCommunity);
  if (Y.recommendable !== X.recommendable) return Number(Y.recommendable) - Number(X.recommendable);
  if (Y.a !== X.a) return Y.a - X.a;
  if (Y.s !== X.s) return Y.s - X.s;
  return Y.c - X.c;
}
