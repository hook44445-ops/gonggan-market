import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { getCompanyDocuments } from "../lib/supabase";
import { DOCUMENT_TEMPLATES, UPLOAD_DOCUMENT_TEMPLATES } from "../constants/documentTemplates";
import DocumentUploadCard from "../components/DocumentUploadCard";
import DocumentChecklistCard from "../components/DocumentChecklistCard";
import DocumentDetailModal from "../components/DocumentDetailModal";

const DOC_ICONS = {
  business_license:      "📋",
  insurance_certificate: "🔒",
  operation_pledge:      "📝",
  escrow_agreement:      "🛡",
};

const REQUIRED_DOCS = [
  ...UPLOAD_DOCUMENT_TEMPLATES
    .filter(t => t.target === "company" && t.required)
    .map(t => ({ document_type: t.type, title: t.title, icon: DOC_ICONS[t.type] ?? "📄", type: "UPLOAD" })),
  ...DOCUMENT_TEMPLATES
    .filter(t => t.target === "company" && t.required)
    .map(t => ({ document_type: t.type, title: t.title, icon: DOC_ICONS[t.type] ?? "📝", type: "CHECKLIST" })),
];

export default function DocumentCenterScreen({ company, user, onBack }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalDoc, setModalDoc] = useState(null);

  useEffect(() => {
    if (!company?.id) { setLoading(false); return; }
    getCompanyDocuments(company.id).then(({ data }) => {
      setDocs(data ?? []);
      setLoading(false);
    });
  }, [company?.id]);

  const getDoc = (docType) => docs.find(d => d.document_type === docType);

  const handleDocChange = (updated) => {
    if (!updated) return;
    setDocs(prev => {
      const idx = prev.findIndex(d => d.id === updated.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });
    if (modalDoc?.document_type === updated.document_type) {
      setModalDoc(prev => ({ ...prev, ...updated }));
    }
  };

  const submittedCount = REQUIRED_DOCS.filter(d => {
    const doc = getDoc(d.document_type);
    return doc && ["submitted", "reviewing", "approved"].includes(doc.review_status);
  }).length;

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.md, marginBottom: S.xl }}>
        <button onClick={onBack}
          style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.text3, padding: 0, fontWeight: 700 }}>
          ←
        </button>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text1 }}>📁 서류 관리</div>
      </div>

      <div style={{
        background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.xl,
        border: `1px solid ${C.bgWarm}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: S.sm }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text3 }}>제출 현황</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: C.brand }}>{submittedCount}</span>
            <span style={{ fontSize: 13, color: C.text3 }}>/ {REQUIRED_DOCS.length}건</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {REQUIRED_DOCS.map(d => {
            const doc = getDoc(d.document_type);
            const done = doc && ["submitted", "reviewing", "approved"].includes(doc.review_status);
            return (
              <div key={d.document_type} style={{
                flex: 1, height: 4, borderRadius: R.full,
                background: done ? C.brand : C.bgWarm,
              }} />
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: C.text3, fontSize: 13 }}>불러오는 중...</div>
      ) : (
        REQUIRED_DOCS.map(docMeta => {
          const existingDoc = getDoc(docMeta.document_type);
          const docData = {
            ...docMeta,
            ...(existingDoc ?? {}),
            title: docMeta.title,
            icon: docMeta.icon,
            document_type: docMeta.document_type,
          };

          if (docMeta.type === "UPLOAD") {
            return (
              <DocumentUploadCard
                key={docMeta.document_type}
                doc={docData}
                onClick={() => setModalDoc(docData)}
              />
            );
          }
          return (
            <DocumentChecklistCard
              key={docMeta.document_type}
              doc={docData}
              onClick={() => setModalDoc(docData)}
            />
          );
        })
      )}

      <div style={{
        background: C.brandL, borderRadius: R.lg, padding: S.lg,
        border: `1px solid ${C.brandM}`, marginTop: S.xl,
        fontSize: 12, color: C.brand, lineHeight: 1.7,
      }}>
        🛡 제출 서류는 인증 목적으로만 사용되며 보안 서버에 안전하게 보관됩니다
      </div>

      {modalDoc && (
        <DocumentDetailModal
          doc={modalDoc}
          companyId={company?.id}
          userId={user?.id}
          onClose={() => setModalDoc(null)}
          onChange={handleDocChange}
        />
      )}
    </div>
  );
}
