import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { getCompanyDocuments } from "../lib/supabase";
import { DOCUMENT_TEMPLATES, UPLOAD_DOCUMENT_TEMPLATES } from "../constants/documentTemplates";
import DocumentUploadCard from "../components/DocumentUploadCard";
import DocumentChecklistCard from "../components/DocumentChecklistCard";
import DocumentDetailModal from "../components/DocumentDetailModal";
import PartnerLadder from "../components/partner/PartnerLadder";
import { bidLimit, limitText, nextUnlock, limitStateOf, ladderKeyOf, maxedText } from "../lib/partnerTier";

const DOC_ICONS = {
  business_license:      "📋",
  insurance_certificate: "🔒",
  operation_pledge:      "📝",
  escrow_agreement:      "🛡",
  service_terms:         "📄",
  privacy_policy:        "🔐",
  location_terms:        "📍",
  bankbook_copy:         "🏦",
  qualification_license: "🏅",
  interior_license:      "🏛",
  portfolio:             "🖼",
  badge_application:     "🔰",
};

const REQUIRED_DOCS = [
  ...UPLOAD_DOCUMENT_TEMPLATES
    .filter(t => t.target === "company" && t.required)
    .map(t => ({ document_type: t.type, title: t.title, icon: DOC_ICONS[t.type] ?? "📄", type: "UPLOAD" })),
  ...DOCUMENT_TEMPLATES
    .filter(t => (t.target === "company" || t.target === "all") && t.required)
    .map(t => ({ document_type: t.type, title: t.title, icon: DOC_ICONS[t.type] ?? "📝", type: "CHECKLIST" })),
];

const OPTIONAL_DOCS = [
  ...UPLOAD_DOCUMENT_TEMPLATES
    .filter(t => t.target === "company" && !t.required)
    .map(t => ({ document_type: t.type, title: t.title, icon: DOC_ICONS[t.type] ?? "📄", type: "UPLOAD" })),
  ...DOCUMENT_TEMPLATES
    .filter(t => t.target === "company" && !t.required)
    .map(t => ({ document_type: t.type, title: t.title, icon: DOC_ICONS[t.type] ?? "📝", type: "CHECKLIST" })),
];

const STATUS_META = {
  draft:     { label: "미작성",   color: C.text4,  bg: C.bg     },
  submitted: { label: "제출완료", color: C.brand,  bg: C.brandL },
  reviewing: { label: "검토중",   color: C.gold,   bg: "#FBF5E8" },
  approved:  { label: "승인완료", color: C.green,  bg: C.greenL },
  held:      { label: "보류",     color: C.gold,   bg: "#FBF5E8" },
  rejected:  { label: "반려",     color: C.red,    bg: "#FEF0F0" },
  pending:   { label: "검토중",   color: C.gold,   bg: "#FBF5E8" },
  on_hold:   { label: "보류",     color: C.gold,   bg: "#FBF5E8" },
};

function DocCard({ docMeta, existingDoc, onClick }) {
  const status = existingDoc?.review_status ?? "draft";
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  const docData = { ...docMeta, ...(existingDoc ?? {}), title: docMeta.title, icon: docMeta.icon, document_type: docMeta.document_type };

  if (docMeta.type === "UPLOAD") return <DocumentUploadCard doc={docData} onClick={() => onClick(docData)} />;
  return <DocumentChecklistCard doc={docData} onClick={() => onClick(docData)} />;
}

// 다음 한 가지를 내는 서류 — 누르면 그 서류 칸이 바로 열린다. 보증금은 서류가 아니라 공간보증 화면에서 낸다.
const UNLOCK_DOC = { biz: "business_license", insurance: "insurance_certificate", license: "interior_license" };

// 내 한도 — 지금 공사 1건 얼마까지, 다음 한 가지를 내면 얼마까지, 전체 계단.
// 값은 관리자가 확인한 것만 본다(limitStateOf). companyRow(원본 행)가 있으면 그걸 쓴다 — 정규화된 값은 보증 정보가 빠질 수 있다.
function MyLimitCard({ row, onOpenDoc }) {
  const state = limitStateOf(row ?? {});
  const now = bidLimit(state);
  const next = nextUnlock(state);
  const docType = next ? UNLOCK_DOC[next.key] : null;
  return (
    <div style={{ marginBottom: S.xl }}>
      <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.md }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text3 }}>내 한도 · 지금 공사 1건</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: C.text1, letterSpacing: "-0.02em", marginTop: 2 }}>
          {limitText(now)}<span style={{ fontSize: 15, fontWeight: 700, color: C.text3 }}>까지</span>
        </div>
        {next ? (
          <button type="button" disabled={!docType} onClick={() => docType && onOpenDoc(docType)}
            style={{ marginTop: S.md, width: "100%", textAlign: "left", background: C.brandL, border: `1px solid ${C.brandM}`,
              borderRadius: R.lg, padding: "12px 14px", cursor: docType ? "pointer" : "default", fontFamily: "inherit",
              fontSize: 13.5, color: C.text1, lineHeight: 1.6 }}>
            <b>{next.ask}</b>{docType ? "을 내면" : "을 걸면"} <b style={{ color: C.brand }}>{limitText(next.to)}</b>까지{docType ? " ›" : ""}
            {!docType && <div style={{ fontSize: 12, color: C.text3 }}>공간보증은 마이페이지 「공간보증」에서 신청해요</div>}
          </button>
        ) : (
          <div style={{ marginTop: S.md, fontSize: 13.5, color: C.green, fontWeight: 700 }}>{maxedText(state)}</div>
        )}
      </div>
      <PartnerLadder current={ladderKeyOf(state)} />
    </div>
  );
}

export default function DocumentCenterScreen({ company, companyRow, user, onBack }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalDoc, setModalDoc] = useState(null);
  const [showOptional, setShowOptional] = useState(false);

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
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
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

  const allApproved = REQUIRED_DOCS.every(d => {
    const doc = getDoc(d.document_type);
    return doc?.review_status === "approved";
  });

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.md, marginBottom: S.xl }}>
        <button onClick={onBack}
          style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: C.text3, padding: 0, fontWeight: 700 }}>
          ←
        </button>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text1 }}>📁 서류 관리</div>
      </div>

      <MyLimitCard row={companyRow ?? company} onOpenDoc={(type) => {
        const meta = [...REQUIRED_DOCS, ...OPTIONAL_DOCS].find(d => d.document_type === type);
        if (meta) setModalDoc({ ...meta, ...(getDoc(type) ?? {}), title: meta.title, icon: meta.icon, document_type: type });
      }} />

      {/* 제출 현황 */}
      <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.xl, border: `1px solid ${C.bgWarm}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: S.sm }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text3 }}>필수 서류 제출 현황</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: allApproved ? C.green : C.brand }}>{submittedCount}</span>
            <span style={{ fontSize: 13, color: C.text3 }}>/ {REQUIRED_DOCS.length}건</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: S.sm }}>
          {REQUIRED_DOCS.map(d => {
            const doc = getDoc(d.document_type);
            const status = doc?.review_status ?? "draft";
            const color = status === "approved" ? C.green : ["submitted","reviewing"].includes(status) ? C.brand : C.bgWarm;
            return <div key={d.document_type} style={{ flex: 1, height: 4, borderRadius: R.full, background: color }} />;
          })}
        </div>
        {allApproved ? (
          <div style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>✅ 모든 필수 서류 승인 완료</div>
        ) : (
          <div style={{ fontSize: 12, color: C.text3 }}>
            미제출 서류가 있으면 업체 승인이 지연될 수 있습니다
          </div>
        )}
      </div>

      {/* 필수 서류 */}
      <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: S.md }}>
        필수 서류 <span style={{ fontSize: 12, color: C.red, fontWeight: 600 }}>*</span>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: C.text3, fontSize: 13 }}>불러오는 중...</div>
      ) : (
        REQUIRED_DOCS.map(docMeta => (
          <DocCard key={docMeta.document_type} docMeta={docMeta} existingDoc={getDoc(docMeta.document_type)} onClick={setModalDoc} />
        ))
      )}

      {/* 선택 서류 */}
      {!loading && (
        <div style={{ marginTop: S.xl }}>
          <div
            onClick={() => setShowOptional(v => !v)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              background: C.surface, borderRadius: R.xl, padding: S.xl,
              border: `1px solid ${C.bgWarm}`, cursor: "pointer", marginBottom: showOptional ? S.md : 0 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>선택 서류</div>
              <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>
                {OPTIONAL_DOCS.slice(0, 4).map(d => d.title).join(" · ")}
              </div>
            </div>
            <span style={{ fontSize: 16, color: C.text3 }}>{showOptional ? "▲" : "▼"}</span>
          </div>
          {showOptional && OPTIONAL_DOCS.map(docMeta => (
            <DocCard key={docMeta.document_type} docMeta={docMeta} existingDoc={getDoc(docMeta.document_type)} onClick={setModalDoc} />
          ))}
        </div>
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
