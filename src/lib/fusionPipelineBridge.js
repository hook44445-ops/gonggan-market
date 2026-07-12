// ════════════════════════════════════════════════════════════════════
// 공간라운지 Fusion Pipeline Bridge — 실제 Fusion 최종본 자동 저장 연결 (Phase 46)
//
//   브라우저에서 실제 Fusion(3단계 LLM)이 만든 "최종본 1건"만 DB draft 로 자동 저장한다.
//     · 중간(1·2차) 결과는 저장하지 않는다.
//     · 같은 편성 키/본문이면 새로 만들지 않는다(중복 저장 차단).
//     · 저장 성공 시 실제 draftId 를 반환한다. 실패는 성공으로 표시하지 않는다.
//   저장 이후의 승인·예약·발행은 서버 자율 사이클(Phase 43)이 담당한다.
//   ⚠️ 순수 오케스트레이션 · createDraft 주입 · Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { classifyContentType } from "./contentTypes.js";
import { editorialKey, editorialDateKST, findDuplicate } from "./editorialKey.js";
import { ensureImageUrls, pickRepresentativeImage } from "./approvalImage.js";

// fusionResult: runFusion 반환({ final:{title,body}, steps, contentType, ok, ... })
// deps: { createDraft: (rec)=>{data|error}, existing: [drafts+published] }
export async function saveFusionFinal({ fusionResult, topic = "", existing = [], createDraft } = {}) {
  const L = "[FUSION_SAVE]";
  const final = fusionResult?.final;
  const body = String(final?.body ?? "").trim();
  const title = String(final?.title ?? topic ?? "").trim();

  // ⑦ Fusion 실패 우선처리: 최소한 최종본 본문이 있어야 저장(빈 글은 Hard Fail).
  if (!body || body.replace(/\s/g, "").length < 80) {
    return { saved: false, reason: "no_final_body", duplicate: false, draftId: null };
  }
  const contentType = fusionResult?.contentType || classifyContentType(title || topic);
  const img = pickRepresentativeImage({ title, content: body, content_type: contentType }); // §11 빈 image_urls 금지
  const rec = {
    title, content: body, ai_topic: String(topic || "").trim(),
    content_type: contentType,
    editorial_date: editorialDateKST(Date.now()),
    scheduled_at: null,
    image_urls: ensureImageUrls({ title, content: body, content_type: contentType }),
    image_alt: img.alt,
  };

  // 중복 저장 차단(같은 편성 키 or 동일 본문이 활성 상태로 존재).
  const dup = findDuplicate(rec, existing);
  if (dup) {
    console.log(`${L} duplicate — skip save (기존 id=${String(dup.id).slice(0, 8)})`);
    return { saved: false, duplicate: true, draftId: dup.id ?? null, key: editorialKey(rec), reason: "duplicate" };
  }

  if (typeof createDraft !== "function") {
    return { saved: false, reason: "no_createDraft", duplicate: false, draftId: null };
  }

  console.log(`${L}_START type=${contentType} titleLen=${title.length} bodyLen=${body.length}`);
  let out;
  try { out = await createDraft(rec); } catch (e) { out = { error: e }; }
  if (out?.error) {
    console.warn(`${L}_FAIL ${out.error?.message ?? String(out.error)}`);
    return { saved: false, duplicate: false, draftId: null, reason: "db_error", error: out.error?.message ?? String(out.error) };
  }
  const draftId = out?.data?.id ?? out?.id ?? null;
  console.log(`${L}D draftId=${String(draftId).slice(0, 8)} key=${editorialKey(rec)}`);
  return {
    saved: true, duplicate: false, draftId, key: editorialKey(rec),
    contentType, title,
    // 실제 LLM 호출 근거(정직): Fusion 단계 성공 수.
    fusionCalls: (fusionResult?.steps || []).filter((s) => s.ok).length,
    fusionTotal: (fusionResult?.steps || []).length,
  };
}
