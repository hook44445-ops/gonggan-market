import { useState } from "react";
import { C, R, S } from "../../constants";

const TITLES = {
  post:    "게시글 신고",
  comment: "댓글 신고",
  story:   "스토리 신고",
  user:    "사용자 신고/차단",
};

const REASONS = [
  "욕설/비방",
  "사기 의심",
  "허위 정보",
  "성희롱/불쾌한 대화",
  "도배/광고",
  "기타",
];

export default function ReportModal({ type, targetId, onClose, onReport, onBlock }) {
  const [selected, setSelected] = useState(null);

  const title = TITLES[type] ?? "신고";

  function handleReport() {
    if (!selected) return;

    const key = "lounge_reports";
    const prev = JSON.parse(localStorage.getItem(key) ?? "[]");
    prev.push({ type, targetId, reason: selected, createdAt: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(prev));

    onReport(selected);
    onClose();
  }

  function handleBlock() {
    const key = "lounge_blocks";
    const prev = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!prev.includes(targetId)) {
      prev.push(targetId);
      localStorage.setItem(key, JSON.stringify(prev));
    }

    if (onBlock) onBlock();
    onClose();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          background: C.surface,
          borderRadius: `${R.xxl}px ${R.xxl}px 0 0`,
          padding: `${S.md}px ${S.lg}px ${S.xxl}px`,
        }}
      >
        {/* Handle bar */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: S.lg }}>
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: R.full,
              background: C.bgWarm,
            }}
          />
        </div>

        {/* Title */}
        <p
          style={{
            margin: `0 0 ${S.lg}px`,
            fontSize: 17,
            fontWeight: 700,
            color: C.text1,
            textAlign: "center",
          }}
        >
          {title}
        </p>

        {/* Reason list */}
        <div style={{ marginBottom: S.lg }}>
          {REASONS.map(reason => {
            const isSelected = selected === reason;
            return (
              <button
                key={reason}
                onClick={() => setSelected(reason)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: R.lg,
                  marginBottom: S.sm,
                  textAlign: "left",
                  fontSize: 14,
                  fontWeight: isSelected ? 600 : 400,
                  cursor: "pointer",
                  background: isSelected ? C.brandL : C.bg,
                  color: isSelected ? C.brand : C.text2,
                  border: isSelected ? "none" : `1px solid ${C.bgWarm}`,
                  outline: "none",
                }}
              >
                {reason}
              </button>
            );
          })}
        </div>

        {/* 신고하기 button */}
        <button
          onClick={handleReport}
          disabled={!selected}
          style={{
            display: "block",
            width: "100%",
            padding: "14px",
            borderRadius: R.lg,
            border: "none",
            background: selected ? C.red : C.bgWarm,
            color: "#fff",
            fontWeight: 800,
            fontSize: 15,
            cursor: selected ? "pointer" : "not-allowed",
            transition: "background 0.15s",
          }}
        >
          신고하기
        </button>

        {/* 차단하기 button — user type only */}
        {type === "user" && (
          <button
            onClick={handleBlock}
            style={{
              display: "block",
              width: "100%",
              padding: "13px",
              borderRadius: R.lg,
              border: `1px solid ${C.red}33`,
              background: "#FEF0F0",
              color: C.red,
              fontWeight: 700,
              fontSize: 14,
              marginTop: S.sm,
              cursor: "pointer",
            }}
          >
            차단하기
          </button>
        )}

        {/* 취소 */}
        <p
          onClick={onClose}
          style={{
            fontSize: 14,
            color: C.text3,
            textAlign: "center",
            cursor: "pointer",
            padding: "8px",
            margin: `${S.sm}px 0 0`,
          }}
        >
          취소
        </p>
      </div>
    </div>
  );
}
