import { useState, useRef } from "react";
import { C, R, S } from "../constants";
import { DOCUMENT_TEMPLATES, UPLOAD_DOCUMENT_TEMPLATES } from "../constants/documentTemplates";
import { uploadFile, upsertCompanyDocument, submitCompanyDocument } from "../lib/supabase";

const ALL_TEMPLATES = [...UPLOAD_DOCUMENT_TEMPLATES, ...DOCUMENT_TEMPLATES];
const UPLOAD_TYPES  = new Set(UPLOAD_DOCUMENT_TEMPLATES.map(t => t.type));

const STATUS_META = {
  draft:     { label: "미작성",   color: C.text4, bg: C.bg      },
  submitted: { label: "제출완료", color: C.brand, bg: C.brandL  },
  reviewing: { label: "검토중",   color: C.gold,  bg: "#FBF5E8" },
  approved:  { label: "승인완료", color: C.green, bg: C.greenL  },
  held:      { label: "보류",     color: C.gold,  bg: "#FBF5E8" },
  rejected:  { label: "반려",     color: C.red,   bg: "#FEF0F0" },
};

export default function DocumentDetailModal({ doc, companyId, userId, onClose, onChange }) {
  const template  = ALL_TEMPLATES.find(t => t.type === doc.document_type) ?? {};
  const isUpload  = UPLOAD_TYPES.has(doc.document_type);
  const status    = doc?.review_status ?? "draft";
  const meta      = STATUS_META[status] ?? STATUS_META.draft;
  const canEdit   = !["submitted", "reviewing", "approved"].includes(status);
  const icon      = doc.icon ?? template.icon ?? (isUpload ? "📄" : "📝");

  const [uploading, setUploading]   = useState(false);
  const [fileInfo, setFileInfo]     = useState({ name: doc.file_name ?? null, url: doc.file_url ?? null });
  const [checklist, setChecklist]   = useState(doc?.checklist ?? {});
  const [docId, setDocId]           = useState(doc?.id ?? null);
  const [saving, setSaving]         = useState(false);
  const [errorMsg, setErrorMsg]     = useState(null);
  const [sectionsOpen, setSectionsOpen] = useState({});
  const fileRef = useRef(null);

  const items     = template.checklist ?? [];
  const allChecked = items.length > 0 && items.every((_, i) => checklist[String(i)]);

  // 모바일 DEBUG 오버레이([GONGGAN_DEBUG] 캡처)로 실서버 실패 원인을 그대로 확인할 수 있게 로깅.
  const dlog = (...a) => { try { console.log("[GONGGAN_DEBUG]", "[doc]", doc.document_type, ...a); } catch { /* noop */ } };

  // 행 생성/갱신 후 id 를 반환. 실패 시 throw 하여 호출부에서 사용자에게 표면화한다.
  // (기존엔 upsert 실패가 조용히 무시돼 docId 가 null 로 남고 → 제출이 무효화되던 문제 보강)
  const ensureRow = async (extra) => {
    const { data, error } = await upsertCompanyDocument({
      ...(docId ? { id: docId } : {}),
      company_id: companyId, user_id: userId,
      document_type: doc.document_type,
      ...extra,
    });
    if (error) { dlog("upsert error", error.code ?? "", error.message ?? ""); throw new Error(error.message ?? "저장에 실패했습니다."); }
    if (data?.id && !docId) setDocId(data.id);
    return data;
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!companyId) { setErrorMsg("업체 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요."); e.target.value = ""; return; }
    setUploading(true);
    setErrorMsg(null);
    try {
      const path = `company-docs/${companyId}/${doc.document_type}/${Date.now()}_${file.name.replace(/\s/g, "_")}`;
      const url  = await uploadFile("documents", path, file).catch(() => URL.createObjectURL(file));
      const data = await ensureRow({
        file_name: file.name, file_url: url,
        file_size: file.size, mime_type: file.type,
        review_status: "draft",
      });
      setFileInfo({ name: file.name, url });
      onChange?.(data);
    } catch (err) {
      dlog("upload fail", err.message);
      setErrorMsg(err.message ?? "업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSubmitUpload = async () => {
    if (!fileInfo.url) return;
    if (!companyId) { setErrorMsg("업체 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요."); return; }
    setSaving(true);
    setErrorMsg(null);
    try {
      // docId 가 없으면(이전 업로드 upsert 실패 등) 현재 파일 정보로 행을 먼저 만든 뒤 제출.
      let id = docId;
      if (!id) {
        const row = await ensureRow({ file_name: fileInfo.name, file_url: fileInfo.url, review_status: "draft" });
        id = row?.id;
      }
      if (!id) throw new Error("문서 저장에 실패했습니다. 다시 시도해주세요.");
      const { data, error } = await submitCompanyDocument(id);
      if (error) { dlog("submit error", error.code ?? "", error.message ?? ""); throw new Error(error.message ?? "제출에 실패했습니다."); }
      onChange?.(data);
      onClose?.();
    } catch (err) {
      dlog("submit upload fail", err.message);
      setErrorMsg(err.message ?? "제출에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const toggleCheck = async (idx) => {
    if (!canEdit) return;
    if (!companyId) { setErrorMsg("업체 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요."); return; }
    const key  = String(idx);
    const next = { ...checklist, [key]: !checklist[key] };
    setChecklist(next);          // 낙관적 갱신 — 화면은 즉시 토글
    setErrorMsg(null);
    try {
      const data = await ensureRow({ checklist: next, review_status: "draft" });
      onChange?.(data);
    } catch (err) {
      dlog("toggle persist fail", err.message);
      setErrorMsg("동의 항목 저장에 실패했습니다. 네트워크 확인 후 다시 시도해주세요.");
    }
  };

  const handleSubmitChecklist = async () => {
    if (!allChecked) return;
    if (!companyId) { setErrorMsg("업체 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요."); return; }
    setSaving(true);
    setErrorMsg(null);
    try {
      // docId 가 없으면(토글 upsert 실패 등) 현재 체크 상태로 행을 먼저 만든 뒤 제출.
      let id = docId;
      if (!id) {
        const row = await ensureRow({ checklist, review_status: "draft" });
        id = row?.id;
      }
      if (!id) throw new Error("동의 내용 저장에 실패했습니다. 다시 시도해주세요.");
      const { data, error } = await submitCompanyDocument(id);
      if (error) { dlog("submit error", error.code ?? "", error.message ?? ""); throw new Error(error.message ?? "제출에 실패했습니다."); }
      onChange?.(data);
      onClose?.();
    } catch (err) {
      dlog("submit checklist fail", err.message);
      setErrorMsg(err.message ?? "제출에 실패했습니다.");
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

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.sm }}>
          <div style={{ display: "flex", gap: S.sm, alignItems: "center" }}>
            <span style={{ fontSize: 22 }}>{icon}</span>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.text1 }}>{doc.title ?? template.title}</div>
          </div>
          <span style={{ background: meta.bg, color: meta.color, borderRadius: R.full, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
            {meta.label}
          </span>
        </div>

        {/* Purpose */}
        {template.purpose && (
          <div style={{ fontSize: 12, color: C.text3, marginBottom: S.xl, paddingLeft: 2 }}>
            📌 {template.purpose}
          </div>
        )}

        {/* Error banner — 실패가 조용히 묻히지 않도록 표면화 */}
        {errorMsg && (
          <div style={{
            background: "#FEF0F0", borderRadius: R.lg, padding: S.lg, marginBottom: S.xl,
            border: `1px solid ${C.red}33`, fontSize: 12, color: C.red, lineHeight: 1.6,
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Reject / Hold reason */}
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

        {/* Reason box */}
        {template.reason && (
          <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.lg, marginBottom: S.xl,
            border: `1px solid ${C.brandM}`, fontSize: 12, color: C.brand, lineHeight: 1.7 }}>
            💡 {template.reason}
          </div>
        )}

        {/* Sections (accordion) */}
        {template.sections?.length > 0 && (
          <div style={{ marginBottom: S.xl }}>
            {template.sections.map((sec, i) => (
              <div key={i} style={{ marginBottom: S.sm }}>
                <div
                  onClick={() => setSectionsOpen(p => ({ ...p, [i]: !p[i] }))}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: C.surface2, borderRadius: R.md, padding: `${S.sm}px ${S.lg}px`,
                    cursor: "pointer", border: `1px solid ${C.bgWarm}`,
                    marginBottom: sectionsOpen[i] ? S.xs : 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text1 }}>{sec.title}</span>
                  <span style={{ fontSize: 14, color: C.text3 }}>{sectionsOpen[i] ? "▲" : "▼"}</span>
                </div>
                {sectionsOpen[i] && (
                  <div style={{ background: C.bg, borderRadius: R.md, padding: S.lg,
                    fontSize: 13, color: C.text2, lineHeight: 1.8, border: `1px solid ${C.bgWarm}`,
                    whiteSpace: "pre-line" }}>
                    {sec.body}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* UPLOAD type */}
        {isUpload && (
          <>
            {/* Submit items */}
            {template.submitItems?.length > 0 && (
              <div style={{ background: "#F5F1EA", borderRadius: R.lg, padding: S.lg, marginBottom: S.md }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.brand, marginBottom: S.xs }}>제출 항목</div>
                {template.submitItems.map((item, i) => (
                  <div key={i} style={{ fontSize: 13, color: C.text2, lineHeight: 1.8 }}>• {item}</div>
                ))}
              </div>
            )}

            {/* Review criteria */}
            {template.reviewCriteria?.length > 0 && (
              <div style={{ background: "#EEF4F0", borderRadius: R.lg, padding: S.lg, marginBottom: S.xl }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: S.xs }}>검토 기준</div>
                {template.reviewCriteria.map((item, i) => (
                  <div key={i} style={{ fontSize: 13, color: C.text2, lineHeight: 1.8 }}>✓ {item}</div>
                ))}
              </div>
            )}

            {/* File area */}
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

            {/* Upload / submit buttons */}
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
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic" style={{ display: "none" }} onChange={handleUpload} />
          </>
        )}

        {/* CHECKLIST type */}
        {!isUpload && items.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text1, marginBottom: S.md }}>
              아래 항목을 확인해주세요
            </div>
            <div style={{ marginBottom: S.xl }}>
              {items.map((label, i) => {
                const checked = !!checklist[String(i)];
                return (
                  <div key={i}
                    onClick={() => canEdit && toggleCheck(i)}
                    style={{
                      display: "flex", gap: S.md, alignItems: "flex-start",
                      padding: `${S.md}px 0`,
                      borderBottom: i < items.length - 1 ? `1px solid ${C.bg}` : "none",
                      cursor: canEdit ? "pointer" : "default",
                    }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                      background: checked ? C.brand : C.surface,
                      border: `2px solid ${checked ? C.brand : C.bgWarm}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 12, fontWeight: 900,
                    }}>
                      {checked ? "✓" : ""}
                    </div>
                    <span style={{ fontSize: 13, color: C.text1, lineHeight: 1.7 }}>{label}</span>
                  </div>
                );
              })}
            </div>

            {/* Consent text */}
            {template.consentText && (
              <div style={{ background: C.surface2, borderRadius: R.lg, padding: S.lg,
                fontSize: 12, color: C.text3, fontStyle: "italic", marginBottom: S.xl,
                border: `1px solid ${C.bgWarm}` }}>
                "{template.consentText}"
              </div>
            )}

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
                  : `✅ 모두 동의하고 제출 (${items.filter((_, i) => checklist[String(i)]).length}/${items.length})`}
              </button>
            )}
            {!canEdit && status === "approved" && (
              <div style={{ background: C.greenL, borderRadius: R.lg, padding: S.lg, textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.green }}>✅ 승인 완료</div>
              </div>
            )}
          </>
        )}

        {/* Consent text for upload types */}
        {isUpload && template.consentText && status !== "draft" && (
          <div style={{ background: C.surface2, borderRadius: R.lg, padding: S.lg,
            fontSize: 12, color: C.text3, fontStyle: "italic", marginTop: S.xl,
            border: `1px solid ${C.bgWarm}` }}>
            "{template.consentText}"
          </div>
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
