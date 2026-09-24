import { useState } from "react";
import { C, R, S } from "../../constants";
import { createLoungeReport } from "../../lib/supabase";

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

export default function ReportModal({ type, targetId, reporterId = null, onClose, onReport, onBlock }) {
  const [selected, setSelected] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState(null);

  const title = TITLES[type] ?? "신고";

  // 신고는 서버(관리자 신고 목록)로 보낸다. 예전엔 신고한 사람 브라우저에만 남아 아무도 못 봤다.
  // 서버에 들어간 뒤에만 「접수됐어요」 — 실패하면 창에 남겨 다시 보내게 한다.
  async function handleReport() {
    if (!selected || sending) return;
    setSending(true);
    setSendErr(null);
    let rid = reporterId;
    if (!rid) { try { rid = JSON.parse(localStorage.getItem("gonggan_user") ?? "null")?.id ?? null; } catch { rid = null; } }
    const { error } = await createLoungeReport({ reporterId: rid, type, targetId, reason: selected });
    setSending(false);
    if (error) { setSendErr("신고를 보내지 못했어요. 잠시 뒤 다시 눌러 주세요."); return; }
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

        {sendErr && (
          <div style={{ fontSize: 12.5, color: C.red, fontWeight: 700, marginBottom: S.sm }}>{sendErr}</div>
        )}

        {/* 신고하기 button */}
        <button
          onClick={handleReport}
          disabled={!selected || sending}
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
          {sending ? "보내는 중…" : "신고하기"}
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
              border: `1px solid ${C.red33}`,
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
