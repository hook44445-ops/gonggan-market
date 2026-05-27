import { C, R, S } from "../constants";
import { DOCUMENT_TEMPLATES } from "../constants/documentTemplates";

const STATUS_META = {
  draft:     { label: "미작성",   color: C.text4,  bg: C.bg      },
  submitted: { label: "제출완료", color: C.brand,  bg: C.brandL  },
  reviewing: { label: "검토중",   color: C.gold,   bg: "#FBF5E8" },
  approved:  { label: "승인완료", color: C.green,  bg: C.greenL  },
  held:      { label: "보류",     color: C.gold,   bg: "#FBF5E8" },
  rejected:  { label: "반려",     color: C.red,    bg: "#FEF0F0" },
  pending:   { label: "검토중",   color: C.gold,   bg: "#FBF5E8" },
  on_hold:   { label: "보류",     color: C.gold,   bg: "#FBF5E8" },
};

export default function DocumentChecklistCard({ doc, onClick }) {
  const status = doc?.review_status ?? "draft";
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  const template = DOCUMENT_TEMPLATES.find(t => t.type === doc.document_type);
  const items = template?.checklist ?? [];
  const checklist = doc?.checklist ?? {};
  const checkedCount = items.filter((_, i) => checklist[String(i)]).length;

  return (
    <div onClick={onClick}
      style={{
        background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.sm,
        border: `1.5px solid ${status === "approved" ? C.green : status === "rejected" ? C.red : C.bgWarm}`,
        cursor: "pointer", display: "flex", alignItems: "center", gap: S.md,
      }}>
      <div style={{
        width: 44, height: 44, borderRadius: R.lg, background: meta.bg,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0,
      }}>
        {doc.icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>{doc.title}</div>
          <span style={{
            background: meta.bg, color: meta.color,
            borderRadius: R.full, padding: "2px 10px", fontSize: 11, fontWeight: 700,
          }}>{meta.label}</span>
        </div>
        <div style={{ fontSize: 12, color: C.text3 }}>
          {items.length > 0 ? `${checkedCount}/${items.length}개 항목 동의` : "체크리스트"}
        </div>
        {(status === "rejected" || status === "held") && doc.review_reason && (
          <div style={{ fontSize: 11, color: status === "rejected" ? C.red : C.gold, marginTop: 3 }}>
            사유: {doc.review_reason}
          </div>
        )}
      </div>
      <span style={{ color: C.text4, fontSize: 18 }}>›</span>
    </div>
  );
}
