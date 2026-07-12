// ════════════════════════════════════════════════════════════════════
// DraftPreviewModal — 승인 전 전체 콘텐츠 미리보기 (Phase 41)
//
//   발행센터 승인대기 목록에서 [👁 미리보기] → 승인 전에 제목·대표이미지·본문·SEO·태그·
//   예약(예정)시간·발행될 URL·블로그 변환 결과를 한눈에 확인한다. 하단 [닫기][승인][반려].
//   ⚠️ 읽기 전용 · 기존 생성/발행/DB/API 로직 무수정 — 기존 헬퍼(buildBlogSeo/buildBlogPost/
//     buildPostPath)만 재사용해 표시. 승인=기존 예약 액션 위임 · 반려=목록 숨김(발행 안 함).
//   additive · Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { C, R, S } from "../constants";
import { CATEGORY_LABEL } from "../constants/lounge";
import { buildPostPath } from "../utils/loungeSeo";
import { buildBlogSeo, buildBlogPost, isBlogEligible, getBlogLog } from "../lib/blogPublisher";
import { evaluateQuality, RUBRIC_LABELS } from "../lib/qualityEvaluator";
import { reviewByBoard } from "../lib/aiEditorialBoard";
import { decidePublishMode } from "../lib/publishModeDecider";
import { classifyContentType } from "../lib/contentTypes";

export default function DraftPreviewModal({ draft, scheduleLabel, onClose, onApprove, onReject }) {
  if (!draft) return null;
  const d = draft;

  const cover = Array.isArray(d.image_urls) ? d.image_urls.find(Boolean) : null;
  const catLabel = CATEGORY_LABEL[d.category] ?? d.category ?? "—";

  // SEO/태그 — 초안에 저장된 값 우선, 없으면 기존 blog SEO 빌더로 유도(읽기 전용).
  let seo = null, tags = [];
  try { seo = d.seo && (d.seo.seoTitle || d.seo.description) ? d.seo : buildBlogSeo(d); } catch { seo = null; }
  tags = (Array.isArray(d.tags) && d.tags.length) ? d.tags
       : (Array.isArray(d.keywords) && d.keywords.length) ? d.keywords
       : (seo?.tags ?? []);

  // 발행될 URL — 기존 라운지 SEO 경로 규칙 재사용.
  let path = "";
  try { path = buildPostPath(d); } catch { path = `/lounge/posts/${d.id}`; }
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // 품질 항목별 점수(Phase 42) — 결정론적 평가(읽기 전용).
  let quality = null;
  try { quality = evaluateQuality(d); } catch { quality = null; }

  // AI 조직 4인 검토(Phase 43) — 결정론적(읽기 전용).
  let board = null;
  try { board = reviewByBoard(d, { evaluation: quality }); } catch { board = null; }
  const ROLE_KO = { writer: "작성 담당", fact_checker: "팩트체커", seo: "SEO 담당", chief_editor: "편집장" };
  const DEC_KO = { PASS: "PASS", PASS_WITH_NOTE: "PASS_WITH_NOTE", REVISE: "REVISE" };
  const boardLabel = !board ? "" :
    board.boardDecision === "AUTO_APPROVED" ? "자동 승인"
    : board.boardDecision === "AUTO_APPROVED_WITH_NOTES" ? "자동 승인(주의)"
    : board.boardDecision === "NEEDS_REVISION" ? "보정 후 승인 예정"
    : board.boardDecision === "SPLIT" ? "검토대기(2:2)"
    : "검토대기(Hard Fail)";

  // 발행 방식 자동 판단(Phase 47) — 즉시/예약/보류.
  let pubMode = null;
  try { pubMode = decidePublishMode({ title: d.title, content: d.content, content_type: classifyContentType(d.title || d.ai_topic || "") }, { board }); } catch { pubMode = null; }
  const MODE_KO = { IMMEDIATE: "즉시발행", SCHEDULED: "예약발행", HOLD: "보류(예외함)" };
  const REASON_KO = { BREAKING_NEWS: "긴급뉴스·속보", REALTIME_SURGE: "실시간 검색 급등", TODAY_ONLY: "당일 한정", ADMIN_FORCE: "관리자 즉시발행 지정", OVERDUE_RECOVERY: "도래 미발행 복구", PROGRAM_SLOT: "기본편성 슬롯", EVERGREEN_CONTENT: "상시 검색형", HARD_FAIL: "Hard Fail", BROKEN_BODY: "본문 공백", SEVERE_DUPLICATE: "심각 중복", IMAGE_MISID: "이미지 오인" };

  // 블로그 변환 결과(있는 경우) — 기존 빌더로 미리보기 + 과거 발행 이력 매칭.
  let blog = null, blogEligible = false, blogHit = null;
  try {
    blog = buildBlogPost(d);
    blogEligible = isBlogEligible(blog.contentType);
    blogHit = getBlogLog().find((e) => (e.loungeId && e.loungeId === d.id) || (e.title && e.title === d.title)) || null;
  } catch { blog = null; }

  const overlay = {
    position: "fixed", inset: 0, background: "rgba(17,24,39,0.55)", zIndex: 4000,
    display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "24px 12px", overflowY: "auto",
  };
  const card = {
    background: "#fff", width: "100%", maxWidth: 640, borderRadius: R.xl, border: `1px solid ${C.bgWarm}`,
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "92vh",
  };
  const section = { padding: `${S.md}px ${S.xl}px`, borderTop: `1px solid ${C.bg}` };
  const label = { fontSize: 11, fontWeight: 800, color: C.text3, marginBottom: 6, letterSpacing: 0.2 };
  const chip = (bg, col) => ({ display: "inline-block", padding: "2px 9px", borderRadius: R.full, fontSize: 10.5, fontWeight: 700, background: bg, color: col, marginRight: 5, marginBottom: 5 });

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div style={{ padding: `${S.lg}px ${S.xl}px`, background: C.bg, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: C.brand, marginBottom: 3 }}>👁 발행 전 미리보기</div>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: C.text1, lineHeight: 1.4, wordBreak: "break-word" }}>{d.title || "(무제)"}</div>
            <div style={{ marginTop: 6 }}>
              <span style={chip(C.brandL, C.brandD)}>{catLabel}</span>
              {scheduleLabel && <span style={chip("#efe7fb", "#7c3aed")}>🗓️ 예약 예정 · {scheduleLabel}</span>}
              {d.region && <span style={chip(C.surface2 || "#f1f1f1", C.text2)}>📍 {d.region}</span>}
            </div>
          </div>
          <button onClick={onClose} aria-label="닫기" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: R.md, border: `1px solid ${C.bgWarm}`, background: "#fff", color: C.text2, fontSize: 16, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>

        {/* 스크롤 본문 */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {/* 대표이미지 */}
          <div style={section}>
            <div style={label}>대표이미지</div>
            {cover
              ? <img src={cover} alt="대표이미지" style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: R.lg, border: `1px solid ${C.bgWarm}` }} />
              : <div style={{ fontSize: 12, color: C.text3, padding: "14px 0", textAlign: "center", background: C.bg, borderRadius: R.lg }}>대표이미지 없음</div>}
          </div>

          {/* 본문 */}
          <div style={section}>
            <div style={label}>본문</div>
            <div style={{ fontSize: 12.5, color: C.text1, lineHeight: 1.85, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 320, overflowY: "auto", background: C.bg, borderRadius: R.lg, padding: S.md }}>
              {d.content || "(본문 없음)"}
            </div>
          </div>

          {/* SEO */}
          <div style={section}>
            <div style={label}>SEO</div>
            {seo ? (
              <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.7 }}>
                <div><b style={{ color: C.text1 }}>제목</b> · {seo.seoTitle || seo.title || d.title}</div>
                <div><b style={{ color: C.text1 }}>설명</b> · {seo.description || seo.metaDescription || "—"}</div>
                {(seo.keywords?.length > 0) && <div><b style={{ color: C.text1 }}>키워드</b> · {seo.keywords.slice(0, 12).join(", ")}</div>}
              </div>
            ) : <div style={{ fontSize: 12, color: C.text3 }}>SEO 정보 없음</div>}
          </div>

          {/* 품질 항목별 점수(Phase 42) */}
          {quality && (
            <div style={section}>
              <div style={{ ...label, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>품질 항목별 점수</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: quality.passed ? "#059669" : quality.totalScore >= 80 ? C.gold : C.red }}>
                  {quality.totalScore}점 / 기준 {quality.threshold} · {quality.band}{quality.passed ? " ✅" : ""}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {Object.entries(quality.breakdown).map(([k, v]) => {
                  const low = v.score < v.max * 0.7;
                  return (
                    <span key={k} style={{ fontSize: 10.5, borderRadius: R.full, padding: "3px 9px", fontWeight: 700,
                      background: low ? "#fdeeee" : C.bg, color: low ? C.red : C.text2, border: `1px solid ${low ? "#f6d5d5" : C.bgWarm}` }}>
                      {RUBRIC_LABELS[k]} {v.score}/{v.max}
                    </span>
                  );
                })}
              </div>
              {quality.weakPoints.length > 0 && (
                <div style={{ fontSize: 10.5, color: C.text3, marginTop: 7, lineHeight: 1.6 }}>
                  <b style={{ color: C.text2 }}>주요 보완</b> · {quality.weakPoints.slice(0, 5).join(" · ")}
                  {quality.factuality < 10 && <span style={{ color: C.red }}> · ⚠ 사실성 {quality.factuality}/15(자동발행 최소 10)</span>}
                </div>
              )}
            </div>
          )}

          {/* AI 조직 4인 검토(Phase 43) */}
          {board && (
            <div style={section}>
              <div style={{ ...label, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>규칙 기반 사전검사 (휴리스틱)</span>
                <span style={{ fontSize: 11.5, fontWeight: 800, color: board.hardGatePassed ? "#059669" : C.red }}>
                  통과 {board.approvalCount}/4 · {board.grade} · 게이트 {board.hardGatePassed ? "PASS" : "FAIL"} · {boardLabel}
                </span>
              </div>
              <div style={{ fontSize: 10, color: C.text3, marginBottom: 4 }}>※ 규칙 기반 사전검사입니다. 실제 AI(LLM) 검수는 미실행(생성 시 Fusion 3콜은 별도). </div>
              {pubMode && (
                <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 6, color: pubMode.mode === "HOLD" ? C.red : pubMode.mode === "IMMEDIATE" ? "#d97706" : "#7c3aed" }}>
                  발행 방식: {MODE_KO[pubMode.mode]} {pubMode.priority !== "HOLD" && `· ${pubMode.priority}`} · 사유 {REASON_KO[pubMode.reason] || pubMode.reason}
                </div>
              )}
              <details>
                <summary style={{ fontSize: 11, color: C.text3, cursor: "pointer" }}>각 AI 직원 판단 펼치기</summary>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                  {board.reviewers.map((rv) => {
                    const col = rv.hardFail ? C.red : rv.decision === "PASS" ? "#059669" : rv.decision === "PASS_WITH_NOTE" ? C.gold : C.red;
                    return (
                      <div key={rv.role} style={{ fontSize: 11, color: C.text2, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "baseline" }}>
                        <span style={{ minWidth: 64, fontWeight: 700, color: C.text1 }}>{ROLE_KO[rv.role]}</span>
                        <span style={{ fontWeight: 800, color: col }}>{DEC_KO[rv.decision]}{rv.hardFail ? " · Hard Fail" : ""}</span>
                        <span style={{ color: C.text3 }}>{rv.score}점</span>
                        {rv.issues.length > 0 && <span style={{ color: C.text3 }}>· {rv.issues.slice(0, 2).join(", ")}</span>}
                      </div>
                    );
                  })}
                </div>
                {board.hardGate.reasons.length > 0 && <div style={{ fontSize: 10.5, color: C.red, marginTop: 6 }}>안전 게이트 실패: {board.hardGate.reasons.join(" · ")}</div>}
              </details>
            </div>
          )}

          {/* 태그 */}
          <div style={section}>
            <div style={label}>태그</div>
            {tags.length > 0
              ? <div>{tags.slice(0, 16).map((t, i) => <span key={i} style={chip(C.bg, C.text2)}>#{String(t).replace(/^#/, "")}</span>)}</div>
              : <div style={{ fontSize: 12, color: C.text3 }}>태그 없음</div>}
          </div>

          {/* 발행될 URL */}
          <div style={section}>
            <div style={label}>발행될 URL</div>
            <div style={{ fontFamily: "monospace", fontSize: 11.5, color: C.brandD, background: C.bg, borderRadius: R.md, padding: "7px 10px", wordBreak: "break-all" }}>{origin}{path}</div>
            <div style={{ fontSize: 10, color: C.text3, marginTop: 4 }}>승인·발행 시 이 주소로 게시됩니다(예상 경로).</div>
          </div>

          {/* 블로그 변환 결과(있는 경우) */}
          {blog && (
            <div style={section}>
              <div style={label}>블로그 변환 결과</div>
              <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.7 }}>
                <span style={chip(blogEligible ? "#e6f4ee" : C.bg, blogEligible ? "#059669" : C.text3)}>{blogEligible ? "블로그 발행 대상" : "블로그 발행 대상 아님"}</span>
                <span style={chip(C.bg, C.text2)}>{blog.providerLabel}</span>
                {blog.shareability != null && <span style={chip(C.bg, C.text2)}>공유지수 {blog.shareability}</span>}
                {blogHit && <span style={chip("#fdeeee", C.red)}>이미 블로그 발행 이력 있음</span>}
                {blog.seo?.seoTitle && <div style={{ marginTop: 6 }}><b style={{ color: C.text1 }}>블로그 제목</b> · {blog.seo.seoTitle}</div>}
              </div>
            </div>
          )}
        </div>

        {/* 하단 액션 — 닫기 · 승인 · 반려 */}
        <div style={{ display: "flex", gap: 8, padding: `${S.md}px ${S.xl}px`, borderTop: `1px solid ${C.bgWarm}`, background: "#fff" }}>
          <button onClick={onClose} style={{ flex: "0 0 auto", padding: "9px 16px", borderRadius: R.lg, border: `1px solid ${C.bgWarm}`, background: "#fff", color: C.text2, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>닫기</button>
          <div style={{ flex: 1 }} />
          {onReject && <button onClick={() => onReject(d)} style={{ padding: "9px 16px", borderRadius: R.lg, border: `1px solid ${C.red}`, background: "#fff", color: C.red, fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>✕ 반려</button>}
          {onApprove && <button onClick={() => onApprove(d)} style={{ padding: "9px 20px", borderRadius: R.lg, border: "none", background: C.brand, color: "#fff", fontWeight: 800, fontSize: 12.5, cursor: "pointer" }}>✓ 승인</button>}
        </div>
      </div>
    </div>
  );
}
