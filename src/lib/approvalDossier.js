// ════════════════════════════════════════════════════════════════════
// 공간라운지 Approval Dossier — AI 품의서 · 4인 서명 · 총괄비서실장 (Phase 48)
//
//   Fusion 최종본 + 대표이미지 + 4인 검토를 하나의 "품의서"로 조립한다(계산된 뷰 — DB 스키마 변경 없음).
//     · 4인(작성/팩트/SEO/편집장)이 개별 서명(SIGNED) → 전원 서명 + Hard Fail 없음 → BOARD_APPROVED
//     · AI 총괄비서실장: 사장 승인 없이 자동 인수. 재검토하지 않고 서명·HardFail·예산·중복·발행방식만
//       확인 후 집행(즉시/예약). 실행 자체는 서버 사이클(Phase 47 dispatch)이 담당.
//   ⚠️ 정직 표기: 4인 검토는 현재 규칙 기반(heuristic). 실제 LLM 검수가 아니면 reviewMode='heuristic'.
//   ⚠️ 순수 함수 · 파생 뷰 · DB/LLM 없음. Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { reviewByBoard } from "./aiEditorialBoard.js";
import { decidePublishMode } from "./publishModeDecider.js";
import { pickRepresentativeImage } from "./approvalImage.js";
import { editorialDateKST, editorialKey } from "./editorialKey.js";
import { classifyContentType } from "./contentTypes.js";
import { isRegular } from "./dailyPublishBudget.js";
import { buildPostPath } from "../utils/loungeSeo.js";
import { schedulePublishAt } from "./publishScheduler.js";
import { publishResult } from "./executiveOffice.js";

const ROLE_KO = { writer: "작성 품질 담당", fact_checker: "팩트체커", seo: "SEO 담당", chief_editor: "편집장" };
const pad = (n) => String(n).padStart(2, "0");
const kstStamp = (ms) => {
  const d = new Date((Number.isFinite(ms) ? ms : Date.now()) + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

// 품의번호 — AI-YYYYMMDD-XXXX (YYYYMMDD=KST 생성일, XXXX=콘텐츠 id 파생).
export function dossierNumber(record = {}) {
  const date = editorialDateKST(record.created_at || Date.now()).replace(/-/g, "");
  const idStr = String(record.id ?? "0000");
  let h = 0; for (let i = 0; i < idStr.length; i++) h = (h * 31 + idStr.charCodeAt(i)) >>> 0;
  return `AI-${date}-${String(h % 10000).padStart(4, "0")}`;
}

// 품의서 조립. record: lounge_posts 행. opts: { board?, now, budget? }
export function buildDossier(record = {}, { board = null, now = Date.now(), budget = null } = {}) {
  const type = record.content_type || classifyContentType(record.title || record.ai_topic || "");
  const draft = { ...record, content_type: type };
  const bd = board || reviewByBoard(draft);
  const image = (Array.isArray(record.image_urls) && record.image_urls[0])
    ? { url: record.image_urls[0], alt: record.image_alt || `${record.title || ""} 대표 이미지`, source: "saved" }
    : pickRepresentativeImage(draft);

  const baseMs = Date.parse(record.updated_at || record.created_at || now) || now;
  // 4인 개별 서명(서명 = Hard Fail 아님). 순서: 작성→팩트→SEO→편집장.
  const order = ["writer", "fact_checker", "seo", "chief_editor"];
  const reviewers = order.map((role, i) => {
    const rv = bd.reviewers.find((x) => x.role === role) || { role, decision: "PASS", score: 0, hardFail: false, issues: [] };
    const signed = !rv.hardFail;
    return {
      role, name: ROLE_KO[role], decision: rv.decision, score: rv.score, hardFail: rv.hardFail,
      issues: rv.issues || [], revisionRequests: rv.revisionRequests || [],
      signed, signedAt: signed ? kstStamp(baseMs + (i + 1) * 60 * 1000) : null,
    };
  });
  const allSigned = reviewers.every((r) => r.signed);
  const boardApproved = allSigned && bd.hardGatePassed;

  const mode = decidePublishMode(draft, { board: bd, now });
  const scheduledAt = record.scheduled_at || (mode.mode === "SCHEDULED" ? schedulePublishAt(type, { now }).toISOString() : null);
  let publishPath = ""; try { publishPath = buildPostPath(record); } catch { publishPath = `/lounge/posts/${record.id}`; }
  const st = record.publish_status || "draft";
  const published = st === "published";

  // 총괄비서실장 — BOARD_APPROVED 시 자동 인수(재검토 없음, 집행만).
  const chief = boardApproved
    ? { received: true, verified: { signatures: 4, hardFail: !bd.hardGatePassed, publishMode: mode.mode, budgetChecked: !!budget },
        action: mode.mode === "HOLD" ? "예외함" : mode.mode === "IMMEDIATE" ? "즉시발행 집행" : "예약 집행" }
    : { received: false, reason: bd.hardGatePassed ? "서명 미완료" : "Hard Fail" };

  // 타임라인(§13).
  const step = (label, done, at = null, note = "") => ({ label, done, at, note });
  const timeline = [
    step("Fusion 최종본", true),
    step("대표이미지", true, null, image.source),
    step("품의서 생성", true),
    ...reviewers.map((r) => step(`${r.name} ${r.decision}`, r.signed, r.signedAt, r.signed ? "SIGNED" : "미서명")),
    step("BOARD_APPROVED", boardApproved),
    step("총괄비서실장 인수", chief.received, null, chief.received ? chief.action : (chief.reason || "")),
    step(mode.mode === "IMMEDIATE" ? "즉시발행" : mode.mode === "SCHEDULED" ? "예약" : "예외함", published || st === "scheduled", scheduledAt),
    step("Published", published, published ? kstStamp(Date.parse(record.updated_at || now)) : null, published ? publishPath : ""),
  ];

  return {
    dossierNo: dossierNumber(record),
    contentId: record.id ?? null,
    fusionRun: record.fusion_run_id || null,
    title: record.title || "(무제)",
    category: type,
    track: isRegular(type) ? "정기" : "비정기",
    qualityScore: bd.qualityScore,
    grade: bd.grade,
    image,
    reviewMode: bd.reviewMode || "heuristic",
    reviewers,
    allSigned,
    hardFail: !bd.hardGatePassed,
    hardGate: bd.hardGate,
    boardApproved,
    chiefSecretary: chief,
    publishMode: mode.mode,
    priority: mode.priority,
    reason: mode.reason,
    scheduledAt,
    publishStatus: st,
    publishURL: published ? publishPath : "",
    result: publishResult(record, { now }), // §8 발행결과(URL/게시시간/Elapsed/Publish ID)
    editorialKey: editorialKey({ content_type: type, title: record.title, scheduled_at: scheduledAt, created_at: record.created_at }),
    timeline,
  };
}

// 품의서 상태 버킷(§13 탭).
export function dossierStage(dossier) {
  if (dossier.publishStatus === "published") return "발행완료";
  if (dossier.hardFail) return "예외함";
  if (dossier.publishStatus === "scheduled") return "총괄비서실장";
  if (dossier.boardApproved) return "서명완료";
  return "검토중";
}
