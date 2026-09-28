import { useRef, useState } from "react";
import { C, R, S } from "../constants";
import { uploadFile, setCompanyProfile } from "../lib/supabase";
import { companyImagePath, introProblem, profileReasonText, shrinkImage, INTRO_MAX } from "../lib/companyProfile";

// 내 업체 페이지 꾸미기(154) — 커버 사진 · 로고 · 소개글. 업체 공개 페이지(/p/…)와 앱 안 업체 상세가 같이 쓴다.
//   사진은 올리기 전에 줄이고(긴 변 1600 · 로고 512) photos/company/<업체ID>/ 에 둔다.
export default function CompanyProfileSheet({ companyId, initial = {}, onClose, onSaved }) {
  const [cover, setCover] = useState(initial.cover_url ?? null);
  const [logo, setLogo] = useState(initial.logo_url ?? null);
  const [intro, setIntro] = useState(initial.intro ?? "");
  const [busy, setBusy] = useState(null);   // "cover" | "logo" | "save"
  const [msg, setMsg] = useState(null);
  const coverRef = useRef(null);
  const logoRef = useRef(null);

  const pick = async (kind, file) => {
    if (!file) return;
    setBusy(kind); setMsg(null);
    try {
      const small = await shrinkImage(file, kind === "logo" ? 512 : 1600);
      const url = await uploadFile("photos", companyImagePath(companyId, kind), small);
      kind === "logo" ? setLogo(url) : setCover(url);
    } catch { setMsg("사진을 올리지 못했어요 — 다시 시도해 주세요"); }
    setBusy(null);
  };

  const save = async () => {
    const problem = introProblem(intro);
    if (problem) { setMsg(problem); return; }
    setBusy("save"); setMsg(null);
    const { data, error } = await setCompanyProfile(companyId, { coverUrl: cover ?? "", logoUrl: logo ?? "", intro: intro.trim() });
    setBusy(null);
    if (error || !data?.ok) {
      const m = String(error?.message ?? "");
      setMsg(/LOGIN_REQUIRED|JWT/.test(m) ? "로그인이 풀렸어요 — 인증번호로 다시 로그인해 주세요"
        : /company_set_profile/.test(m) ? "아직 준비 중이에요(SQL 154)" : profileReasonText(data?.reason));
      return;
    }
    onSaved?.({ cover_url: data.cover_url ?? null, logo_url: data.logo_url ?? null, intro: data.intro ?? "" });
  };

  const small = { fontSize: 12, color: C.text3 };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.55)", zIndex: 600, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="내 업체 페이지 꾸미기"
        style={{ width: "100%", maxWidth: 480, background: C.surface, borderRadius: "22px 22px 0 0", padding: "22px 20px 30px", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ fontSize: 17, fontWeight: 900, color: C.text1 }}>내 업체 페이지 꾸미기</div>
        <div style={{ ...small, marginTop: 4, lineHeight: 1.6 }}>고객이 링크를 열면 가장 먼저 보는 곳이에요. 실제 작업 사진을 권해요.</div>

        <div style={{ marginTop: 16, fontSize: 13, fontWeight: 800, color: C.text2 }}>커버 사진 (가로 사진)</div>
        <button onClick={() => coverRef.current?.click()} disabled={!!busy}
          style={{ marginTop: 8, width: "100%", aspectRatio: "16 / 9", borderRadius: R.lg, border: `1.5px dashed ${C.bgWarm}`, background: C.surface2,
            backgroundImage: cover ? `url(${cover})` : "none", backgroundSize: "cover", backgroundPosition: "center", cursor: "pointer", color: C.text3, fontSize: 13, fontWeight: 700 }}>
          {busy === "cover" ? "올리는 중…" : cover ? "" : "+ 커버 사진 고르기"}
        </button>
        {cover && <button onClick={() => setCover(null)} style={{ ...small, background: "none", border: "none", padding: "6px 0", cursor: "pointer" }}>커버 지우기</button>}
        <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => pick("cover", e.target.files?.[0])} />

        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: S.md }}>
          <button onClick={() => logoRef.current?.click()} disabled={!!busy} aria-label="로고 고르기"
            style={{ width: 68, height: 68, borderRadius: 20, border: `1.5px dashed ${C.bgWarm}`, background: C.surface2, flexShrink: 0,
              backgroundImage: logo ? `url(${logo})` : "none", backgroundSize: "cover", backgroundPosition: "center", cursor: "pointer", color: C.text3, fontSize: 11, fontWeight: 700 }}>
            {busy === "logo" ? "…" : logo ? "" : "+ 로고"}
          </button>
          <div style={{ ...small, lineHeight: 1.6 }}>로고가 없으면 업체 이름 첫 글자가 보여요.{logo && <><br /><button onClick={() => setLogo(null)} style={{ ...small, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}>로고 지우기</button></>}</div>
        </div>
        <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => pick("logo", e.target.files?.[0])} />

        <div style={{ marginTop: 16, fontSize: 13, fontWeight: 800, color: C.text2 }}>소개</div>
        <textarea value={intro} onChange={(e) => { setIntro(e.target.value); setMsg(null); }} maxLength={INTRO_MAX} rows={4}
          placeholder="예: 강서구에서 욕실·수전·필름 작은 수리를 직접 합니다. 사진으로 전·후를 남겨 드려요."
          style={{ marginTop: 8, width: "100%", boxSizing: "border-box", border: `1px solid ${C.bgWarm}`, borderRadius: R.md, padding: "11px 12px", fontSize: 14.5, color: C.text1, resize: "vertical", outline: "none" }} />
        <div style={{ ...small, textAlign: "right" }}>{intro.trim().length}/{INTRO_MAX}</div>

        {msg && <div role="alert" style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: C.red }}>{msg}</div>}
        <div style={{ display: "flex", gap: S.sm, marginTop: 14 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "13px 0", borderRadius: R.md, border: `1px solid ${C.bgWarm}`, background: C.surface, color: C.text2, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>닫기</button>
          <button onClick={save} disabled={!!busy} style={{ flex: 2, padding: "13px 0", borderRadius: R.md, border: "none", background: C.brand, color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>
            {busy === "save" ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
