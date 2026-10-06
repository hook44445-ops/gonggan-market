import { useState } from "react";
import { C, R, S } from "../constants";
import { submitExternalReview } from "../lib/supabase";
import { externalReviewProblem, reviewReasonText, EXTERNAL_REVIEW_LABEL, EXTERNAL_REVIEW_NOTE } from "../lib/externalReview";

// 공간랜드 밖 공사 후기 쓰기(151) — 업체 공개 페이지에서. 평점·공간온도에는 들어가지 않는다고 미리 말한다.
export default function ExternalReviewSheet({ companyId, companyName, onClose, onDone }) {
  const [rating, setRating] = useState(0);
  const [workTitle, setWorkTitle] = useState("");
  const [content, setContent] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const problem = externalReviewProblem({ rating, content, workTitle });
    if (problem) { setMsg(problem); return; }
    setBusy(true); setMsg(null);
    const { data, error } = await submitExternalReview({ companyId, rating, content: content.trim(), workTitle: workTitle.trim() || null });
    setBusy(false);
    if (error || !data?.ok) {
      const m = String(error?.message ?? "");
      setMsg(/LOGIN_REQUIRED|JWT/.test(m) ? "로그인이 풀렸어요 — 인증번호로 다시 로그인해 주세요"
        : /external_review_submit/.test(m) ? "아직 준비 중이에요(SQL 151)" : reviewReasonText(data?.reason));
      return;
    }
    onDone?.();
  };

  const input = { width: "100%", boxSizing: "border-box", border: `1px solid ${C.bgWarm}`, borderRadius: R.md, padding: "11px 12px", fontSize: 14.5, color: C.text1, outline: "none" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.55)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={EXTERNAL_REVIEW_LABEL}
        style={{ width: "100%", maxWidth: 480, background: C.surface, borderRadius: "22px 22px 0 0", padding: "22px 20px 30px", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: C.text1 }}>{companyName ? `${companyName} 공사 후기` : "공사 후기"}</div>
        <div style={{ fontSize: 12.5, color: C.text3, marginTop: 4, lineHeight: 1.6 }}>
          «{EXTERNAL_REVIEW_LABEL}»로 따로 보여요. {EXTERNAL_REVIEW_NOTE}.
        </div>
        <div role="radiogroup" aria-label="별점" style={{ display: "flex", gap: 6, marginTop: 16 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} role="radio" aria-checked={rating === n} aria-label={`별 ${n}개`} onClick={() => { setRating(n); setMsg(null); }}
              style={{ fontSize: 32, lineHeight: 1, background: "none", border: "none", padding: 2, cursor: "pointer", color: n <= rating ? C.gold : C.bgWarm }}>★</button>
          ))}
        </div>
        <input value={workTitle} onChange={(e) => setWorkTitle(e.target.value)} maxLength={40} placeholder="어떤 공사였나요? (선택 · 예: 욕실 수전 교체)"
          aria-label="공사 이름" style={{ ...input, marginTop: 14 }} />
        <textarea value={content} onChange={(e) => { setContent(e.target.value); setMsg(null); }} maxLength={500} rows={4}
          placeholder="좋았던 점, 아쉬웠던 점을 한두 줄로" aria-label="후기" style={{ ...input, marginTop: 8, resize: "vertical" }} />
        {msg && <div role="alert" style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: C.red }}>{msg}</div>}
        <div style={{ display: "flex", gap: S.sm, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "13px 0", borderRadius: R.md, border: `1px solid ${C.bgWarm}`, background: C.surface, color: C.text2, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>닫기</button>
          <button onClick={submit} disabled={busy} style={{ flex: 2, padding: "13px 0", borderRadius: R.md, border: "none", background: C.brand, color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>
            {busy ? "남기는 중…" : "후기 남기기"}
          </button>
        </div>
      </div>
    </div>
  );
}
