import { C, R, S } from "../constants";

const STATUS_META = {
  draft:     { label: "미작성",   color: C.text4,  bg: C.bg      },
  submitted: { label: "제출완료", color: C.brand,  bg: C.brandL  },
  reviewing: { label: "검토중",   color: C.gold,   bg: "#FBF5E8" },
  approved:  { label: "승인완료", color: C.green,  bg: C.greenL  },
  held:      { label: "보류",     color: C.gold,   bg: "#FBF5E8" },
  rejected:  { label: "반려",     color: C.red,    bg: "#FEF0F0" },
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
    { key: "phase_structure", label: "에스크로 단계별 정산 구조 이해" },
    { key: "phase_delay",     label: "단계 미완료 시 정산 지연 동의" },
    { key: "dispute",         label: "분쟁 발생 시 공간마켓 중재 동의" },
    { key: "final_approval",  label: "고객 최종 승인 후 정산 동의" },
  ],
};

export default function DocumentChecklistCard({ doc, onClick }) {
  const status = doc?.review_status ?? "draft";
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  const items = CHECKLIST_ITEMS[doc.document_type] ?? [];
  const checklist = doc?.checklist ?? {};
  const checkedCount = items.filter(i => checklist[i.key]).length;

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
