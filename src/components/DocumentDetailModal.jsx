import { useState, useRef } from "react";
import { C, R, S } from "../constants";
import { uploadFile, upsertCompanyDocument, submitCompanyDocument } from "../lib/supabase";

const STATUS_META = {
  draft:     { label: "미작성",   color: C.text4,  bg: C.bg      },
  submitted: { label: "제출완료", color: C.brand,  bg: C.brandL  },
  reviewing: { label: "검토중",   color: C.gold,   bg: "#FBF5E8" },
  approved:  { label: "승인완료", color: C.green,  bg: C.greenL  },
  held:      { label: "보류",     color: C.gold,   bg: "#FBF5E8" },
  rejected:  { label: "반려",     color: C.red,    bg: "#FEF0F0" },
};

const DOC_CONFIGS = {
  business_license:      { type: "UPLOAD",    icon: "📋" },
  insurance_certificate: { type: "UPLOAD",    icon: "🔒" },
  operation_pledge:      { type: "CHECKLIST", icon: "📝" },
  escrow_agreement:      { type: "CHECKLIST", icon: "🛡" },
};

const CHECKLIST_ITEMS = {
  operation_pledge: [
    { key: "no_fraud", label: "부정 경쟁 및 뒷거래 금지 서약" },
    { key: "privacy",  label: "고객 개인정보 보호 서약" },
    { key: "as_duty",  label: "하자보수 AS 의무 이행 동의" },
    { key: "quality",  label: "품질 관리 및 안전 수칙 준수 동의" },
    { key: "policy",   label: "공간마켓 운영 정책 준수 동의" },
  ],
  escrow_agreement: [
    { key: "phase_structure", label: "에스크로 단계별 정산 구조 이해 (계약 10% → 착공 20% → 중간점검 40% → 완료 30%)" },
    { key: "phase_delay",     label: "단계 미완료 시 정산 지연 동의" },
    { key: "dispute",         label: "분쟁 발생 시 공간마켓 중재 동의" },
    { key: "final_approval",  label: "고객 최종 승인 후 정산 동의" },
  ],
};

export default function DocumentDetailModal({ doc, companyId, userId, onClose, onChange }) {
  const cfg = DOC_CONFIGS[doc.document_type] ?? { type: "UPLOAD", icon: "📄" };
  const status = doc?.review_status ?? "draft";
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  const canEdit = !["submitted", "reviewing", "approved"].includes(status);

  const [uploading, setUploading] = useState(false);
  const [fileInfo, setFileInfo] = useState({ name: doc.file_name ?? null, url: doc.file_url ?? null });
  const fileRef = useRef(null);

  const items = CHECKLIST_ITEMS[doc.document_type] ?? [];
  const [checklist, setChecklist] = useState(doc?.checklist ?? {});
  const [docId, setDocId] = useState(doc?.id ?? null);
  const [saving, setSaving] = useState(false);
  const allChecked = items.every(i => checklist[i.key]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `company-docs/${companyId}/${doc.document_type}/${Date.now()}_${file.name.replace(/\s/g, "_")}`;
      const url = await uploadFile("documents", path, file).catch(() => URL.createObjectURL(file));
      const { data } = await upsertCompanyDocument({
        ...(docId ? { id: docId } : {}),
        company_id: companyId, user_id: userId,
        document_type: doc.document_type,
        file_name: file.name, file_url: url,
        file_size: file.size, mime_type: file.type,
        review_status: "draft",
      });
      if (data?.id && !docId) setDocId(data.id);
      setFileInfo({ name: file.name, url });
      onChange?.(data);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmitUpload = async () => {
    if (!docId || !fileInfo.url) return;
    setSaving(true);
    try {
      const { data } = await submitCompanyDocument(docId);
      onChange?.(data);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  const toggleCheck = async (key) => {
    if (!canEdit) return;
    const next = { ...checklist, [key]: !checklist[key] };
    setChecklist(next);
    const { data } = await upsertCompanyDocument({
      ...(docId ? { id: docId } : {}),
      company_id: companyId, user_id: userId,
      document_type: doc.document_type,
      checklist: next, review_status: "draft",
    });
    if (data?.id && !docId) setDocId(data.id);
    onChange?.(data);
  };

  const handleSubmitChecklist = async () => {
    if (!docId || !allChecked) return;
    setSaving(true);
    try {
      const { data } = await submitCompanyDocument(docId);
      onChange?.(data);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)",
        display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={{
        background: C.surface, borderRadius: "24px 24px 0 0",
        width: "100%", maxWidth: 480,
        padding: "24px 24px 40px", maxHeight: "88vh", overflowY: "auto",
      }}>
        <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: "0 auto 20px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.xl }}>
          <div style={{ display: "flex", gap: S.sm, alignItems: "center" }}>
            <span style={{ fontSize: 22 }}>{cfg.icon}</span>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.text1 }}>{doc.title}</div>
          </div>
          <span style={{ background: meta.bg, color: meta.color, borderRadius: R.full, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
            {meta.label}
          </span>
        </div>

        {(status === "rejected" || status === "held") && doc.review_reason && (
          <div style={{
            background: status === "rejected" ? "#FEF0F0" : "#FFF7E6",
            borderRadius: R.lg, padding: S.lg, marginBottom: S.xl,
            border: `1px solid ${(status === "rejected" ? C.red : C.gold)}33`,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: status === "rejected" ? C.red : C.gold, marginBottom: 4 }}>
              {status === "rejected" ? "반려 사유" : "보류 사유"}
            </div>
            <div style={{ fontSize: 13, color: C.text1 }}>{doc.review_reason}</div>
          </div>
        )}

        {cfg.type === "UPLOAD" && (
          <>
            {fileInfo.url ? (
              <div style={{ background: C.greenL, borderRadius: R.lg, padding: S.lg, marginBottom: S.xl, border: `1px solid ${C.brandM}` }}>
                <div style={{ fontSize: 12, color: C.text3, marginBottom: 4 }}>첨부 파일</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.brand }}>✅ {fileInfo.name}</div>
                {fileInfo.url.startsWith("http") && (
                  <a href={fileInfo.url} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: C.brand, display: "block", marginTop: 4 }}>
                    파일 보기 ›
                  </a>
                )}
              </div>
            ) : (
              <div style={{ background: C.surface2, borderRadius: R.lg, padding: S.xl, marginBottom: S.xl, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
                <div style={{ fontSize: 13, color: C.text3 }}>PDF 또는 이미지 파일을 업로드해주세요</div>
              </div>
            )}
            {canEdit && (
              <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  style={{
                    width: "100%", padding: S.lg,
                    background: uploading ? C.surface2 : C.brandL,
                    color: uploading ? C.text4 : C.brand,
                    border: `1.5px dashed ${C.brandM}`,
                    borderRadius: R.md, fontWeight: 700, fontSize: 13,
                    cursor: uploading ? "not-allowed" : "pointer",
                  }}>
                  {uploading ? "⏳ 업로드 중..." : fileInfo.url ? "📂 재업로드" : "📂 파일 선택하기"}
                </button>
                {fileInfo.url && !uploading && (
                  <button onClick={handleSubmitUpload} disabled={saving}
                    style={{
                      width: "100%", padding: S.lg,
                      background: C.brand, color: "#fff", border: "none",
                      borderRadius: R.md, fontWeight: 700, fontSize: 13, cursor: "pointer",
                      boxShadow: `0 4px 14px ${C.brand}44`,
                    }}>
                    {saving ? "제출 중..." : "✅ 제출하기"}
                  </button>
                )}
              </div>
            )}
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={handleUpload} />
          </>
        )}

        {cfg.type === "CHECKLIST" && (
          <>
            <div style={{ marginBottom: S.xl }}>
              {items.map((item, i) => (
                <div key={item.key}
                  onClick={() => canEdit && toggleCheck(item.key)}
                  style={{
                    display: "flex", gap: S.md, alignItems: "flex-start",
                    padding: `${S.md}px 0`,
                    borderBottom: i < items.length - 1 ? `1px solid ${C.bg}` : "none",
                    cursor: canEdit ? "pointer" : "default",
                  }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                    background: checklist[item.key] ? C.brand : C.surface,
                    border: `2px solid ${checklist[item.key] ? C.brand : C.bgWarm}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 12, fontWeight: 900,
                  }}>
                    {checklist[item.key] ? "✓" : ""}
                  </div>
                  <span style={{ fontSize: 13, color: C.text1, lineHeight: 1.7 }}>{item.label}</span>
                </div>
              ))}
            </div>
            {canEdit && (
              <button onClick={handleSubmitChecklist} disabled={!allChecked || saving}
                style={{
                  width: "100%", padding: S.xl,
                  background: allChecked ? C.brand : C.bgWarm,
                  color: allChecked ? "#fff" : C.text4,
                  border: "none", borderRadius: R.md,
                  fontWeight: 700, fontSize: 14,
                  cursor: allChecked ? "pointer" : "not-allowed",
                  boxShadow: allChecked ? `0 4px 14px ${C.brand}44` : "none",
                }}>
                {saving
                  ? "제출 중..."
                  : `✅ 모두 동의하고 제출 (${items.filter(i => checklist[i.key]).length}/${items.length})`}
              </button>
            )}
            {!canEdit && status === "approved" && (
              <div style={{ background: C.greenL, borderRadius: R.lg, padding: S.lg, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>✅ 승인 완료</div>
              </div>
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
