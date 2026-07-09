// ════════════════════════════════════════════════════════════════════
// 공간라운지 Comment Insight Engine — 댓글 인사이트 (Phase 4)
//
//   댓글을 단순히 "수"로 보지 않고, 콘텐츠 개선 신호로 읽는다. 댓글에 "이거 비용 얼마예요?"가
//   많으면 AI 가 "비용 정리 글"을 후속 콘텐츠로 추천한다 — 사람의 반응이 AI 의 다음 기획으로 돌아간다.
//
//   댓글 종류:
//     · question(질문성)  — 후속 Q&A/정리 글 신호
//     · review(후기성)    — 경험 공유가 쌓이는 신호(신뢰)
//     · dispute(논쟁성)   — 관리자 주의 + 균형 잡힌 후속 글 신호
//     · general(일반)
//
//   결정론적 키워드 휴리스틱(외부 API 없음). Phase 5 에서 LLM 분류로 내부만 교체(반환 형태 유지).
// ════════════════════════════════════════════════════════════════════

const QUESTION_HINTS = ["?", "？", "얼마", "가격", "비용", "어떻게", "어디", "언제", "인가요", "나요", "될까", "될까요", "궁금", "문의", "추천해", "뭐가", "무엇", "가능한가"];
const REVIEW_HINTS   = ["후기", "해봤", "해봄", "완성", "만족", "실제로", "직접", "경험", "썼는데", "살아보니", "겪어", "비포", "애프터"];
const DISPUTE_HINTS  = ["아니", "틀렸", "글쎄", "논란", "사기", "별로", "최악", "실망", "환불", "거짓", "과장", "낚시", "반대", "동의 안"];

const norm = (t) => String(t ?? "").toLowerCase();
const hit = (t, hints) => hints.some((h) => t.includes(h));

// 댓글 1건 분류. dispute > question > review > general 우선순위(주의 신호를 먼저 잡는다).
export function classifyComment(text) {
  const t = norm(text);
  if (!t) return "general";
  if (hit(t, DISPUTE_HINTS)) return "dispute";
  if (t.includes("?") || t.includes("？") || hit(t, QUESTION_HINTS)) return "question";
  if (hit(t, REVIEW_HINTS)) return "review";
  return "general";
}

// 댓글 묶음 분석. comments: [{ content, post_id?, created_at? }]
//   반환: { total, question, review, dispute, general, questionRatio, disputeRatio, needsAttention, samples:{question:[], dispute:[]} }
export function analyzeComments(comments = []) {
  const counts = { total: 0, question: 0, review: 0, dispute: 0, general: 0 };
  const samples = { question: [], dispute: [] };
  for (const c of comments) {
    const text = c?.content ?? "";
    if (!String(text).trim()) continue;
    const kind = classifyComment(text);
    counts.total += 1;
    counts[kind] += 1;
    if (kind === "question" && samples.question.length < 5) samples.question.push(String(text).slice(0, 60));
    if (kind === "dispute" && samples.dispute.length < 5) samples.dispute.push(String(text).slice(0, 60));
  }
  const questionRatio = counts.total ? counts.question / counts.total : 0;
  const disputeRatio  = counts.total ? counts.dispute / counts.total : 0;
  return {
    ...counts,
    questionRatio: Math.round(questionRatio * 100) / 100,
    disputeRatio: Math.round(disputeRatio * 100) / 100,
    needsAttention: counts.dispute >= 2 || disputeRatio >= 0.25,
    samples,
  };
}

// 글별 댓글 인사이트 집계. comments 를 post_id 로 묶어 각 글의 분석 + 원 글(byId)을 붙인다.
//   반환: [{ postId, title, category, analysis }]  (질문 많은 순 → 논쟁 많은 순)
export function commentInsightByPost(comments = [], postsById = {}) {
  const grouped = new Map();
  for (const c of comments) {
    const pid = c?.post_id;
    if (pid == null) continue;
    if (!grouped.has(pid)) grouped.set(pid, []);
    grouped.get(pid).push(c);
  }
  const rows = [];
  for (const [postId, list] of grouped.entries()) {
    const analysis = analyzeComments(list);
    if (analysis.total === 0) continue;
    const post = postsById[postId] || {};
    rows.push({ postId, title: post.title || "(제목 없음)", category: post.category || null, analysis });
  }
  return rows.sort((a, b) => (b.analysis.question - a.analysis.question) || (b.analysis.dispute - a.analysis.dispute));
}
