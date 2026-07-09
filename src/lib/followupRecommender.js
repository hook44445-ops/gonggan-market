// ════════════════════════════════════════════════════════════════════
// 공간라운지 Follow-up Content Recommendation — 후속 콘텐츠 추천 (Phase 4)
//
//   사용자 반응이 AI 의 다음 기획으로 돌아가는 지점. 반응 신호를 읽어 "다음에 무슨 글을
//   쓰면 좋은지"를 추천한다. AI Editor(생성 전 기획)가 참고할 수 있는 후속 주제 큐다.
//
//   규칙(작업지시서):
//     · 댓글 질문 많음        → Q&A/비용 정리 글 추천
//     · 저장/반응 많음(evergreen) → 심화(Deep) 글 추천
//     · 조회 많고 반응 낮음    → 제목/도입 개선 추천
//     · 특정 카테고리 반응 상승 → 관련 주제 추가 생성 추천
//     · 논쟁 댓글 많음         → 균형 잡힌 정리 글 추천(+관리자 주의)
//
//   결정론적 규칙 엔진(외부 API 없음). 추천만 한다 — 자동 생성/자동 발행 없음(베타 원칙).
// ════════════════════════════════════════════════════════════════════

import { communityScore } from "./communityScore.js";
import { analyzeComments } from "./commentInsight.js";

// 글 1건 + (선택)그 글의 댓글 분석 → 후속 콘텐츠 추천 목록.
//   반환: [{ type, topic, reason, priority }]  type ∈ qa|deep|improve|balance
export function recommendFollowupsForPost(post = {}, commentAnalysis = null, now = Date.now()) {
  const c = communityScore(post, now);
  const a = commentAnalysis || { question: 0, dispute: 0, questionRatio: 0, total: 0 };
  const title = post.title || post.ai_topic || "이 글";
  const recs = [];

  // 질문 많음 → Q&A/정리 글
  if (a.question >= 2 || a.questionRatio >= 0.3) {
    recs.push({ type: "qa", topic: `${title} — 자주 묻는 질문 정리`, reason: `질문성 댓글 ${a.question}건 → Q&A/비용 정리 글로 답한다`, priority: 3 + a.question });
  }
  // 논쟁 많음 → 균형 정리 글
  if (a.dispute >= 2) {
    recs.push({ type: "balance", topic: `${title} — 장단점 균형 정리`, reason: `논쟁성 댓글 ${a.dispute}건 → 양쪽을 정리한 후속 글 + 관리자 주의`, priority: 2 + a.dispute });
  }
  // evergreen/저장 많음 → 심화 글
  if (c.evergreen || c.saves >= 8) {
    recs.push({ type: "deep", topic: `${title} — 심층편(Deep Article)`, reason: `오래 읽히고 저장이 많은 글 → 심화 콘텐츠 후보`, priority: 4 });
  }
  // 조회 많고 반응 낮음 → 제목/도입 개선
  if (c.signals.views >= 100 && c.engagementRate < 0.05) {
    recs.push({ type: "improve", topic: `${title} — 제목/도입 개선`, reason: `조회 ${c.signals.views}인데 반응률 낮음 → 제목·도입 리라이트 권장`, priority: 3 });
  }
  return recs.sort((x, y) => y.priority - x.priority);
}

// 카테고리 반응 추세 → "관련 주제 추가 생성" 추천. categoryTrends: rising 카테고리 배열(communityTemperature).
//   반환: [{ type:'category', category, reason, priority }]
export function recommendFromCategoryTrends(risingCategories = []) {
  return risingCategories.map((r, i) => ({
    type: "category",
    category: r.category ?? r,
    reason: `${r.label ?? r.category ?? r} 반응 상승 → 관련 주제 추가 생성 추천`,
    priority: 5 - Math.min(i, 4),
  }));
}

// 전체 후속 추천 통합 — 글별 인사이트 rows + 상승 카테고리를 하나의 우선순위 큐로.
//   insightRows: commentInsightByPost() 결과, postsById: { [id]: post }
export function buildFollowupQueue({ insightRows = [], postsById = {}, risingCategories = [], now = Date.now() } = {}) {
  const out = [];
  for (const row of insightRows) {
    const post = postsById[row.postId] || { title: row.title, category: row.category };
    for (const rec of recommendFollowupsForPost(post, row.analysis, now)) {
      out.push({ ...rec, postId: row.postId, title: post.title || row.title, category: post.category || row.category });
    }
  }
  for (const rec of recommendFromCategoryTrends(risingCategories)) out.push(rec);
  return out.sort((a, b) => b.priority - a.priority);
}
