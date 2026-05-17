import { useState } from "react";
import { C, R, S } from "../constants";
import { adminReviewDocument, createNotification } from "../lib/supabase";

const STATUS_META = {
  draft:     { label: "미작성",   color: C.text4,  bg: C.bg      },
  submitted: { label: "제출완료", color: C.brand,  bg: C.brandL  },
  reviewing: { label: "검토중",   color: C.gold,   bg: "#FBF5E8" },
  approved:  { label: "승인완료", color: C.green,  bg: C.greenL  },
  held:      { label: "보류",     color: C.gold,   bg: "#FBF5E8" },
  rejected:  { label: "반려",     color: C.red,    bg: "#FEF0F0" },
};

const DOC_TYPE_LABELS = {
  business_license:      "사업자등록증",
  insurance_certificate: "시공보험 증서",
  operation_pledge:      "운영 서약서",
  escrow_agreement:      "에스크로 동의서",
};

const CHECKLIST_LABELS = {
  no_fraud:        "부정 경쟁 및 뒷거래 금지 서약",
  privacy:         "고객 개인정보 보호 서약",
  as_duty:         "하자보수 AS 의무 이행 동의",
  quality:         "품질 관리 및 안전 수칙 준수 동의",
  policy:          "공간마켓 운영 정책 준수 동의",
  phase_structure: "에스크로 단계별 정산 구조 이해",
  phase_delay:     "단계 미완료 시 정산 지연 동의",
  dispute:         "분쟁 발생 시 공간마켓 중재 동의",
  final_approval:  "고객 최종 승인 후 정산 동의",
};

export default function AdminDocumentReviewModal({ docs, company, adminUser, onClose, onUpdate }) {
  const [selected, setSelected] = useState(docs?.[0] ?? null);
  const [reviewReason, setReviewReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReview = async (reviewStatus) => {
    if (!selected?.id) return;
    setLoading(true);
    try {
      const { data } = await adminReviewDocument(selected.id, adminUser?.id, reviewStatus, reviewReason || null);
      if (company?.ownerId) {
        const docLabel = DOC_TYPE_LABELS[selected.document_type] ?? selected.document_type;
        const statusLabel = STATUS_META[reviewStatus]?.label ?? reviewStatus;
        await createNotification({
          userId:      company.ownerId,
          type:        "DOCUMENT_REVIEW",
          title:       `서류 검토 결과: ${docLabel}`,
          message:     reviewStatus === "approved"
            ? `${docLabel} 서류가 승인되었습니다.`
            : `${docLabel} 서류가 ${statusLabel}되었습니다.${reviewReason ? ` 사유: ${reviewReason}` : ""}`,
          relatedId:   selected.id,
          relatedType: "company_document",
          priority:    reviewStatus === "rejected" ? "HIGH" : "NORMAL",
        });
      }
      const updated = data ?? { ...selected, review_status: reviewStatus, review_reason: reviewReason || null };
      setSelected(updated);
      onUpdate?.(updated);
      setReviewReason("");
    } finally {
      setLoading(false);
    }
  };

  if (!docs?.length) {
    return (
      <div
        style={{
          position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)",
          display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 400,
        }}
        onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
        <div style={{
          background: C.surface, borderRadius: "24px 24px 0 0",
          width: "100%", maxWidth: 480, padding: "24px 24px 40px",
        }}>
          <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: "0 auto 20px" }} />
          <div style={{ textAlign: "center", padding: "30px 0", color: C.text3, fontSize: 13 }}>제출된 서류가 없습니다</div>
          <button onClick={onClose}
            style={{ width: "100%", padding: S.lg, background: C.bg, color: C.text3, border: "none", borderRadius: R.lg, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            닫기
          </button>
        </div>
      </div>
    );
  }

  const currentStatus = selected?.review_status ?? "draft";
  const currentMeta = STATUS_META[currentStatus] ?? STATUS_META.draft;
  const checklist = selected?.checklist ?? {};

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)",
        display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 400,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={{
        background: C.surface, borderRadius: "24px 24px 0 0",
        width: "100%", maxWidth: 480,
        padding: "24px 24px 40px", maxHeight: "88vh", overflowY: "auto",
      }}>
        <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: "0 auto 20px" }} />
        <div style={{ fontSize: 17, fontWeight: 900, color: C.text1, marginBottom: 4 }}>📄 제출 서류 검토</div>
        <div style={{ fontSize: 13, color: C.text3, marginBottom: S.xl }}>{company?.name}</div>

        <div style={{ display: "flex", gap: S.xs, marginBottom: S.xl, flexWrap: "wrap" }}>
          {docs.map(doc => {
            const sm = STATUS_META[doc.review_status ?? "draft"];
            const isActive = selected?.document_type === doc.document_type;
            return (
              <button key={doc.id ?? doc.document_type}
                onClick={() => { setSelected(doc); setReviewReason(""); }}
                style={{
                  padding: "7px 12px", borderRadius: R.full,
                  border: `1.5px solid ${isActive ? C.brand : C.bgWarm}`,
                  background: isActive ? C.brandL : C.surface,
                  color: isActive ? C.brand : C.text3,
                  fontWeight: 700, fontSize: 11, cursor: "pointer",
                }}>
                {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                <span style={{ marginLeft: 4, color: sm.color }}>●</span>
              </button>
            );
          })}
        </div>

        {selected && (
          <>
            <div style={{
              background: C.surface2, borderRadius: R.lg, padding: S.lg,
              marginBottom: S.xl, border: `1px solid ${C.bgWarm}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.md }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>
                  {DOC_TYPE_LABELS[selected.document_type]}
                </div>
                <span style={{
                  background: currentMeta.bg, color: currentMeta.color,
                  borderRadius: R.full, padding: "3px 10px", fontSize: 11, fontWeight: 700,
                }}>
                  {currentMeta.label}
                </span>
              </div>

              {selected.file_url && (
                <div style={{ marginBottom: S.md }}>
                  <div style={{ fontSize: 11, color: C.text3, marginBottom: S.xs }}>첨부 파일</div>
                  <a href={selected.file_url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 13, color: C.brand, fontWeight: 700, textDecoration: "none" }}>
                    📎 {selected.file_name ?? "파일 보기"} ›
                  </a>
                </div>
              )}

              {Object.keys(checklist).length > 0 && (
                <div>
                  <div style={{ fontSize: 11, color: C.text3, marginBottom: S.sm }}>체크리스트</div>
                  {Object.entries(checklist).map(([key, val]) => (
                    <div key={key} style={{ display: "flex", gap: S.sm, alignItems: "flex-start", padding: "3px 0" }}>
                      <span style={{ color: val ? C.green : C.text4, fontSize: 13, flexShrink: 0 }}>{val ? "✓" : "✗"}</span>
                      <span style={{ fontSize: 12, color: C.text1 }}>{CHECKLIST_LABELS[key] ?? key}</span>
                    </div>
                  ))}
                </div>
              )}

              {selected.review_reason && (
                <div style={{ marginTop: S.md, padding: "6px 10px", background: "#FEF0F0", borderRadius: R.sm, fontSize: 12, color: C.text3 }}>
                  이전 사유: {selected.review_reason}
                </div>
              )}
              {selected.reviewed_at && (
                <div style={{ marginTop: S.xs, fontSize: 11, color: C.text4 }}>
                  검토일: {new Date(selected.reviewed_at).toLocaleString("ko-KR")}
                </div>
              )}
            </div>

            {["submitted", "reviewing", "held"].includes(currentStatus) && (
              <>
                <textarea
                  value={reviewReason}
                  onChange={e => setReviewReason(e.target.value)}
                  placeholder="검토 사유 / 메모 (보류·반려 시 필수)"
                  rows={3}
                  style={{
                    width: "100%", padding: "12px",
                    border: `1px solid ${C.bgWarm}`, borderRadius: R.md,
                    fontSize: 13, outline: "none",
                    boxSizing: "border-box", fontFamily: "inherit",
                    resize: "none", marginBottom: S.md, background: C.surface,
                  }}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: S.sm }}>
                  <button onClick={() => handleReview("approved")} disabled={loading}
                    style={{ padding: "12px 0", background: "#27AE60", color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    ✅ 승인
                  </button>
                  <button onClick={() => handleReview("held")} disabled={loading}
                    style={{ padding: "12px 0", background: "#FFF7E6", color: "#C07000", border: "1px solid #C07000", borderRadius: R.md, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    ⏸ 보류
                  </button>
                  <button onClick={() => handleReview("rejected")} disabled={loading}
                    style={{ padding: "12px 0", background: "#FEF0F0", color: C.red, border: `1px solid ${C.red}`, borderRadius: R.md, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    ✗ 반려
                  </button>
                </div>
              </>
            )}

            {currentStatus === "rejected" && (
              <button onClick={() => handleReview("reviewing")} disabled={loading}
                style={{
                  width: "100%", padding: S.lg,
                  background: C.brandL, color: C.brand,
                  border: `1px solid ${C.brandM}`,
                  borderRadius: R.md, fontWeight: 700, fontSize: 13, cursor: "pointer",
                  marginTop: S.sm,
                }}>
                🔄 재검토 요청
              </button>
            )}
          </>
        )}

        <button onClick={onClose}
          style={{
            width: "100%", padding: S.lg,
            background: C.bg, color: C.text3,
            border: "none", borderRadius: R.lg,
            fontWeight: 700, fontSize: 14, cursor: "pointer",
            marginTop: S.xl,
          }}>
          닫기
        </button>
      </div>
    </div>
  );
}
