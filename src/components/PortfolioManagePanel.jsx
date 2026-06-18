import { useEffect, useRef, useState } from "react";
import { C, R, S } from "../constants";
import {
  getPortfolios, createPortfolio, updatePortfolio, deletePortfolio, uploadFile,
} from "../lib/supabase";

// ════════════════════════════════════════════════════════════════════════════
// PortfolioManagePanel — 업체 대시보드 "포트폴리오 관리"(시공사례)
//   · 업체 직접 등록 · 즉시 노출(관리자 사전 승인/pending 흐름 없음).
//   · 기존 portfolios 테이블/RLS + uploadFile + create/update/delete 재사용(Additive).
//   · 필드: 프로젝트명/공사종류/지역/평수/공사금액/설명/태그 + Before·After 사진(첫 After=대표).
//   · 공사기간/포트폴리오 숨김(is_hidden)은 신규 컬럼이 필요해 본 단계 범위 밖(보고).
//   · Mock 금지 — 실제 데이터만.
// ════════════════════════════════════════════════════════════════════════════

const MAX_PHOTOS = 8;
const repPhoto = (p) => (Array.isArray(p?.after_photos) && p.after_photos[0])
  || (Array.isArray(p?.before_photos) && p.before_photos[0]) || null;

export default function PortfolioManagePanel({ companyId }) {
  const [items, setItems] = useState(null); // null = 로딩
  const [editing, setEditing] = useState(null); // portfolio | { _new:true } | null

  const refetch = () => {
    if (!companyId) { setItems([]); return; }
    getPortfolios(companyId)
      .then(({ data }) => setItems(data ?? []))
      .catch(() => setItems([]));
  };
  useEffect(() => { refetch(); /* eslint-disable-next-line */ }, [companyId]);

  if (!companyId) {
    return <div style={{ padding: "30px 0", textAlign: "center", color: C.text3, fontSize: 13 }}>업체 정보를 불러오는 중...</div>;
  }

  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "6px 0 14px" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>시공사례 관리</div>
        <button onClick={() => setEditing({ _new: true })}
          style={{ padding: "8px 14px", background: C.brand, color: "#fff", border: "none",
            borderRadius: R.full, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
          + 시공사례 등록
        </button>
      </div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: 14, lineHeight: 1.6 }}>
        등록하면 즉시 고객에게 노출됩니다. 언제든 수정·삭제할 수 있어요.
      </div>

      {items == null ? (
        <div style={{ padding: "30px 0", textAlign: "center", color: C.text3, fontSize: 13 }}>불러오는 중...</div>
      ) : items.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.xl, padding: "40px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>📷</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, marginBottom: 6 }}>아직 등록된 시공사례가 없습니다.</div>
          <div style={{ fontSize: 12.5, color: C.text3, lineHeight: 1.7 }}>완공된 시공 사례를 등록하면 고객에게 노출됩니다.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((p) => {
            const photo = repPhoto(p);
            const meta = [p.space_type, p.area, p.size, p.budget ? `${p.budget}만원` : null].filter(Boolean).join(" · ");
            return (
              <div key={p.id} style={{ display: "flex", gap: 12, background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: 10 }}>
                <div style={{ width: 72, height: 72, borderRadius: R.md, flexShrink: 0, background: C.bg, overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: C.text4 }}>
                  {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🏠"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: C.text3, marginBottom: 8 }}>{meta || "정보 없음"}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setEditing(p)}
                      style={{ padding: "5px 12px", background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.full, fontSize: 12, fontWeight: 700, color: C.text2, cursor: "pointer" }}>수정</button>
                    <DeleteButton id={p.id} onDeleted={refetch} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <PortfolioEditModal
          companyId={companyId}
          initial={editing._new ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refetch(); }}
        />
      )}
    </div>
  );
}

function DeleteButton({ id, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const del = async () => {
    setBusy(true);
    const { error } = await deletePortfolio(id).catch(() => ({ error: true }));
    setBusy(false);
    if (!error) onDeleted?.();
    else setConfirming(false);
  };
  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)}
        style={{ padding: "5px 12px", background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.full, fontSize: 12, fontWeight: 700, color: C.red ?? "#E53E3E", cursor: "pointer" }}>삭제</button>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      <button onClick={del} disabled={busy}
        style={{ padding: "5px 10px", background: C.red ?? "#E53E3E", border: "none", borderRadius: R.full, fontSize: 12, fontWeight: 800, color: "#fff", cursor: "pointer" }}>{busy ? "삭제 중" : "확인"}</button>
      <button onClick={() => setConfirming(false)}
        style={{ padding: "5px 10px", background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.full, fontSize: 12, fontWeight: 700, color: C.text3, cursor: "pointer" }}>취소</button>
    </span>
  );
}

// 사진 섹션(Before / After) — 첫 After 사진 = 대표 이미지
function PhotoSection({ label, hint, photos, setPhotos, allowCover }) {
  const fileRef = useRef(null);
  const addFiles = (incoming) => {
    const slots = MAX_PHOTOS - photos.length;
    if (slots <= 0) return;
    const items = Array.from(incoming).slice(0, slots).map((file) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, file, url: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...items]);
  };
  const removePhoto = (id) => setPhotos((prev) => prev.filter((p) => p.id !== id));
  const makeCover = (id) => setPhotos((prev) => { const i = prev.findIndex((p) => p.id === id); if (i <= 0) return prev; const c = [...prev]; const [m] = c.splice(i, 1); c.unshift(m); return c; });
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: 6 }}>
        {label} {hint && <span style={{ fontWeight: 600, color: C.text4 }}>· {hint}</span>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {photos.map((p, i) => (
          <div key={p.id} style={{ position: "relative", width: 76, height: 76, borderRadius: R.md, overflow: "hidden", border: (allowCover && i === 0) ? `2px solid ${C.brand}` : `1px solid ${C.bgWarm}` }}>
            <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {allowCover && i === 0 && <span style={{ position: "absolute", left: 0, bottom: 0, background: C.brand, color: "#fff", fontSize: 9, fontWeight: 800, padding: "1px 5px" }}>대표</span>}
            {allowCover && i !== 0 && (
              <button onClick={() => makeCover(p.id)} title="대표로 설정"
                style={{ position: "absolute", left: 2, bottom: 2, background: "rgba(0,0,0,0.55)", color: "#fff", border: "none", borderRadius: R.sm, fontSize: 9, fontWeight: 700, padding: "2px 5px", cursor: "pointer" }}>대표로</button>
            )}
            <button onClick={() => removePhoto(p.id)}
              style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", fontSize: 11, cursor: "pointer", lineHeight: 1 }}>✕</button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button onClick={() => fileRef.current?.click()}
            style={{ width: 76, height: 76, borderRadius: R.md, border: `1.5px dashed ${C.bgWarm}`, background: C.bg, color: C.text3, fontSize: 22, cursor: "pointer" }}>＋</button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>
    </div>
  );
}

// 등록/수정 공용 모달
function PortfolioEditModal({ companyId, initial, onClose, onSaved }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    title: initial?.title ?? "", space_type: initial?.space_type ?? "",
    area: initial?.area ?? "", size: initial?.size ?? "",
    budget: initial?.budget != null ? String(initial.budget) : "",
    desc: initial?.desc ?? "", tags: (initial?.tags ?? []).join(", "),
  });
  const toItems = (urls) => (urls ?? []).map((url) => ({ id: url, url }));
  const [beforePhotos, setBeforePhotos] = useState(() => toItems(initial?.before_photos));
  const [afterPhotos, setAfterPhotos] = useState(() => toItems(initial?.after_photos));
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const uploadAll = async (photos, kind) => {
    const urls = [];
    for (const p of photos) {
      if (p.file) {
        setProgress(`${kind} 사진 업로드 중...`);
        urls.push(await uploadFile("photos", `portfolio/${companyId}/${kind}/${Date.now()}_${p.file.name}`, p.file));
      } else if (p.url) {
        urls.push(p.url);
      }
    }
    return urls;
  };

  const handleSave = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      const before = await uploadAll(beforePhotos, "before");
      const after = await uploadAll(afterPhotos, "after");
      setProgress("저장 중...");
      const budgetNum = parseInt(String(form.budget).replace(/[^\d]/g, ""), 10);
      const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const payload = {
        title: form.title.trim(),
        space_type: form.space_type.trim() || null,
        area: form.area.trim() || null,
        size: form.size.trim() || null,
        budget: Number.isFinite(budgetNum) ? budgetNum : null,
        desc: form.desc.trim() || null,
        tags,
        before_photos: before,
        after_photos: after,
      };
      const res = isEdit
        ? await updatePortfolio(initial.id, payload)
        : await createPortfolio({ company_id: companyId, ...payload });
      if (!res.error) { onSaved?.(); return; }
    } catch { /* graceful */ }
    setSaving(false);
    setProgress("");
  };

  const iS = {
    width: "100%", padding: "12px 14px", border: `1.5px solid ${C.bgWarm}`,
    borderRadius: R.md, fontSize: 14, outline: "none", boxSizing: "border-box",
    marginBottom: 12, fontFamily: "inherit", color: C.text1, background: C.surface,
  };
  const lbl = { fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: 6 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.65)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.surface, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 480, padding: "24px 24px 40px", maxHeight: "92vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: "0 auto 18px" }} />
        <div style={{ fontSize: 17, fontWeight: 900, color: C.text1, marginBottom: 14 }}>{isEdit ? "시공사례 수정" : "시공사례 등록"}</div>

        <div style={lbl}>프로젝트명 <span style={{ color: C.red ?? "#E53E3E" }}>*</span></div>
        <input placeholder="예: 마포구 32평 아파트 전체 인테리어" value={form.title} onChange={(e) => set("title", e.target.value)} style={iS} />

        <div style={lbl}>공사 종류</div>
        <input placeholder="예: 도배, 욕실, 주방, 전체 리모델링" value={form.space_type} onChange={(e) => set("space_type", e.target.value)} style={iS} />

        <div style={{ display: "flex", gap: S.sm }}>
          <div style={{ flex: 1 }}>
            <div style={lbl}>공사 지역</div>
            <input placeholder="예: 마포구" value={form.area} onChange={(e) => set("area", e.target.value)} style={iS} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={lbl}>평수</div>
            <input placeholder="예: 32평" value={form.size} onChange={(e) => set("size", e.target.value)} style={iS} />
          </div>
        </div>

        <div style={lbl}>공사금액 <span style={{ fontWeight: 600, color: C.text4 }}>· 만원 단위</span></div>
        <input placeholder="예: 3000" inputMode="numeric" value={form.budget}
          onChange={(e) => set("budget", e.target.value.replace(/[^\d]/g, ""))} style={iS} />

        <div style={lbl}>프로젝트 설명</div>
        <textarea placeholder="시공 범위, 자재, 공사기간 등 특이사항을 적어주세요" value={form.desc} onChange={(e) => set("desc", e.target.value)} rows={3} style={{ ...iS, resize: "none", lineHeight: 1.7 }} />

        <div style={lbl}>태그 <span style={{ fontWeight: 600, color: C.text4 }}>· 쉼표로 구분</span></div>
        <input placeholder="예: 모던, 화이트톤, 확장" value={form.tags} onChange={(e) => set("tags", e.target.value)} style={iS} />

        <div style={{ height: 1, background: C.bgWarm, margin: `${S.md}px 0 ${S.lg}px` }} />

        <PhotoSection label="시공 전(Before) 사진" hint="공사 전 상태" photos={beforePhotos} setPhotos={setBeforePhotos} allowCover={false} />
        <PhotoSection label="시공 후(After) 사진" hint="첫 번째 사진이 대표로 표시됩니다" photos={afterPhotos} setPhotos={setAfterPhotos} allowCover />

        {progress && <div style={{ fontSize: 12, color: C.brand, textAlign: "center", marginBottom: 12, fontWeight: 700 }}>{progress}</div>}

        <div style={{ display: "flex", gap: S.sm }}>
          <button onClick={onClose} style={{ flex: 1, padding: S.xl, background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>취소</button>
          <button onClick={handleSave} disabled={!form.title.trim() || saving}
            style={{ flex: 2, padding: S.xl, background: form.title.trim() ? C.brand : C.bgWarm, color: form.title.trim() ? "#fff" : C.text4,
              border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: form.title.trim() ? "pointer" : "not-allowed" }}>
            {saving ? "저장 중..." : isEdit ? "수정 완료" : "등록하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
