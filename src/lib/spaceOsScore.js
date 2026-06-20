// ════════════════════════════════════════════════════════════════════
// Space OS — A·S·C 내부 점수 데이터 어댑터 (Phase 3 · v3.0)
//
//   evaluateSpaceOsScore(constants/spaceOs.js)에 넣을 입력을 만든다.
//   여기서 하는 일은 "이미 있는 read 함수를 모아 숫자로 정리"뿐이다.
//   · 새 테이블/컬럼 없음 (DB 구조 변경 금지 준수)
//   · GPS·리뷰·관리자 모듈에 쓰기/수정 없음 — 기존 공개 read 함수만 호출
//   · 결과는 내부 운영 점수로만 쓴다(사용자 화면에 노출하지 않는다)
// ════════════════════════════════════════════════════════════════════

import {
  getCompany,
  getCompanyReviewScores,
  getReviews,
  getPortfolios,
  getCompanyLoungeStats,
  getMyLoungePosts,
} from "./supabase";
import { evaluateSpaceOsScore } from "../constants/spaceOs";

const POPULAR_LIKE_THRESHOLD = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const avg = (nums) => (nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : 0);

// 리뷰에서 평균 별점 + 사진 증빙 비율을 뽑아낸다(읽기 전용 — 리뷰 로직 변경 없음).
function summarizeReviews(reviews = []) {
  const ratings = reviews.map(r => r.rating).filter(v => typeof v === "number");
  const withPhotos = reviews.filter(r => Array.isArray(r.review_photos) && r.review_photos.length > 0).length;
  return {
    avgRating: avg(ratings),
    photoEvidenceRatio: reviews.length ? withPhotos / reviews.length : 0,
  };
}

// 라운지 글 목록에서 인기글/HOT/숨김 신호를 뽑아낸다(읽기 전용 — 라운지 로직 변경 없음).
function summarizeLoungePosts(posts = []) {
  const popularPostCount = posts.filter(p => (p.like_count ?? 0) >= POPULAR_LIKE_THRESHOLD).length;
  const hotPostCount = posts.filter(p => !!p.is_hot).length;
  const hiddenPostCount = posts.filter(p => !!p.is_hidden).length;
  return { popularPostCount, hotPostCount, hiddenPostCount };
}

// companyId 기준으로 A/S/C 계산에 필요한 입력을 모은다.
export async function getCompanySpaceOsScoreInput(companyId) {
  const [{ data: company }, reviewScores, { data: reviews }, { data: portfolios }] = await Promise.all([
    getCompany(companyId),
    getCompanyReviewScores(companyId),
    getReviews(companyId),
    getPortfolios(companyId),
  ]);
  if (!company) return null;

  const { avgRating, photoEvidenceRatio } = summarizeReviews(reviews ?? []);

  let loungeSignal = { postCount: 0, commentCount: 0, popularPostCount: 0, hotPostCount: 0, hiddenPostCount: 0, activeWithin30d: false };
  if (company.owner_id) {
    const [loungeStats, { data: myPosts }] = await Promise.all([
      getCompanyLoungeStats(company.owner_id),
      getMyLoungePosts(company.owner_id),
    ]);
    const { popularPostCount, hotPostCount, hiddenPostCount } = summarizeLoungePosts(myPosts ?? []);
    const activeWithin30d = !!loungeStats.lastActivity && (Date.now() - new Date(loungeStats.lastActivity).getTime()) <= 30 * DAY_MS;
    loungeSignal = {
      postCount: loungeStats.postCount,
      commentCount: loungeStats.commentCount,
      popularPostCount, hotPostCount, hiddenPostCount, activeWithin30d,
    };
  }

  return {
    completionRate: company.completion_rate ?? 0,
    disputeRate: company.dispute_rate ?? 0,
    responseRate: company.response_rate ?? 0,
    asRate: company.as_rate ?? 0,
    avgRating,
    photoEvidenceRatio,
    qualityScore: reviewScores?.quality ?? 0,
    recontractRate: reviewScores?.recontractRate ?? 0,
    portfolioCount: (portfolios ?? []).length,
    completedJobs: company.completed_jobs ?? 0,
    ...loungeSignal,
  };
}

// 단일 진입점 — companyId → { A, S, C, bonus, total, tier, isPremiumEligible }.
// 실패 시 null(점수 미산출) — 호출부는 항상 내부용으로만 사용해야 한다.
export async function getCompanySpaceOsScore(companyId) {
  if (!companyId) return null;
  try {
    const input = await getCompanySpaceOsScoreInput(companyId);
    return input ? evaluateSpaceOsScore(input) : null;
  } catch {
    return null;
  }
}
