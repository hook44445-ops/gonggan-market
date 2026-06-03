import { useState, useEffect, useRef } from "react";
import { C, R, S, GRADE } from "../constants";
import { TempBadge, CertBadge } from "../components/common";
import PortfolioCard from "../components/PortfolioCard";
import PhotoModal from "../components/PhotoModal";
import { getPortfolios, createPortfolio, uploadFile, getReviews } from "../lib/supabase";

const normalizePortfolio = (row) => {
  const beforePhotos = row.before_photos ?? [];
  const afterPhotos  = row.after_photos  ?? [];
  return {
    id:           row.id,
    type:         row.space_type ?? "시공",
    size:         row.size ?? "",
    area:         row.area ?? "",
    title:        row.title,
    desc:         row.desc ?? "",
    tags:         row.tags ?? [],
    beforePhotos,
    afterPhotos,
    // single-image aliases for backward compat
    before:       beforePhotos[0] ?? null,
    after:        afterPhotos[0] ?? beforePhotos[0] ?? null,
    budget:       row.budget ? `${Number(row.budget).toLocaleString()}만원` : null,
  };
};

const MAX_PHOTOS = 10;

function PhotoUploadSection({ label, hint, files, onAdd, onRemove, inputRef }) {
  return (
    <div style={{ marginBottom: S.xl }}>
      <div style={{ fontSize:14, fontWeight:800, color:C.text1, marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:12, color:C.text3, marginBottom:S.md }}>{hint}</div>

      {files.length > 0 && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:S.md }}>
          {files.map(({ id, preview }) => (
            <div key={id} style={{ position:"relative", width:76, height:76, flexShrink:0 }}>
              <img src={preview} alt=""
                style={{ width:"100%", height:"100%", objectFit:"cover",
                  borderRadius:R.md, border:`1px solid ${C.bgWarm}` }} />
              <button onClick={() => onRemove(id)}
                style={{ position:"absolute", top:-7, right:-7, width:20, height:20,
                  background:"rgba(28,23,18,0.8)", color:"#fff", border:"none",
                  borderRadius:"50%", fontSize:13, cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontWeight:900, lineHeight:1 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {files.length < MAX_PHOTOS && (
        <>
          <input ref={inputRef} type="file" accept="image/*" multiple
            style={{ display:"none" }}
            onChange={e => { onAdd(e.target.files); e.target.value = ""; }} />
          <button onClick={() => inputRef.current?.click()}
            style={{ width:"100%", padding:"11px", background:C.surface2,
              color:C.text2, border:`1.5px dashed ${C.bgWarm}`,
              borderRadius:R.md, fontWeight:700, fontSize:13, cursor:"pointer" }}>
            + {label} 추가 ({files.length} / {MAX_PHOTOS})
          </button>
        </>
      )}
    </div>
  );
}

function PortfolioWriteModal({ companyId, onClose, onSaved }) {
  const [form, setForm] = useState({ title:"", space_type:"", area:"", size:"", desc:"" });
  const [beforeFiles, setBeforeFiles] = useState([]);
  const [afterFiles,  setAfterFiles]  = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [progress,    setProgress]    = useState("");
  const beforeRef = useRef(null);
  const afterRef  = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]:v }));

  const addFiles = (incoming, setter, existing) => {
    const slots = MAX_PHOTOS - existing.length;
    if (slots <= 0) return;
    const items = Array.from(incoming).slice(0, slots).map(file => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setter(prev => [...prev, ...items]);
  };

  const removeFile = (id, setter) => setter(prev => prev.filter(f => f.id !== id));

  const handleSave = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      setProgress("시공 전 사진 업로드 중...");
      const beforeUrls = await Promise.all(
        beforeFiles.map(({ file }) =>
          uploadFile("photos", `portfolio/${companyId}/before/${Date.now()}_${file.name}`, file)
        )
      );

      setProgress("시공 후 사진 업로드 중...");
      const afterUrls = await Promise.all(
        afterFiles.map(({ file }) =>
          uploadFile("photos", `portfolio/${companyId}/after/${Date.now()}_${file.name}`, file)
        )
      );

      setProgress("저장 중...");
      const { data, error } = await createPortfolio({
        company_id:    companyId,
        title:         form.title.trim(),
        space_type:    form.space_type.trim() || null,
        area:          form.area.trim() || null,
        size:          form.size.trim() || null,
        desc:          form.desc.trim() || null,
        before_photos: beforeUrls,
        after_photos:  afterUrls,
      });
      if (!error && data) { onSaved(data); onClose(); return; }
    } catch { /* upload failed */ }
    setSaving(false);
    setProgress("");
  };

  const iS = {
    width:"100%", padding:"12px 14px", border:`1.5px solid ${C.bgWarm}`,
    borderRadius:R.md, fontSize:14, outline:"none", boxSizing:"border-box",
    marginBottom:12, fontFamily:"inherit", color:C.text1, background:C.surface,
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.65)",
      display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:200 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:C.surface, borderRadius:"24px 24px 0 0", width:"100%",
        maxWidth:480, padding:"24px 24px 40px", maxHeight:"92vh", overflowY:"auto" }}>

        <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />
        <div style={{ fontSize:17, fontWeight:900, color:C.text1, marginBottom:4 }}>포트폴리오 추가</div>
        <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>완공된 시공 사례를 등록하세요</div>

        {/* ── 기본 정보 ── */}
        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:6 }}>제목 <span style={{color:C.red}}>*</span></div>
        <input placeholder="예: 마포구 32평 아파트 전체 인테리어" value={form.title}
          onChange={e => set("title", e.target.value)} style={iS} />

        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:6 }}>공간 유형</div>
        <input placeholder="예: 아파트, 빌라, 상가" value={form.space_type}
          onChange={e => set("space_type", e.target.value)} style={iS} />

        <div style={{ display:"flex", gap:S.sm }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:6 }}>지역</div>
            <input placeholder="예: 마포구" value={form.area}
              onChange={e => set("area", e.target.value)} style={iS} />
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:6 }}>평수</div>
            <input placeholder="예: 32평" value={form.size}
              onChange={e => set("size", e.target.value)} style={iS} />
          </div>
        </div>

        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:6 }}>시공 설명</div>
        <textarea placeholder="시공 범위, 자재, 특이사항 등을 적어주세요"
          value={form.desc} onChange={e => set("desc", e.target.value)}
          rows={3} style={{ ...iS, resize:"none", lineHeight:1.7 }} />

        {/* ── 구분선 ── */}
        <div style={{ height:1, background:C.bgWarm, margin:`${S.lg}px 0` }} />

        {/* ── Before 사진 ── */}
        <PhotoUploadSection
          label="시공 전 사진"
          hint="공사 전 상태를 등록해주세요"
          files={beforeFiles}
          onAdd={f => addFiles(f, setBeforeFiles, beforeFiles)}
          onRemove={id => removeFile(id, setBeforeFiles)}
          inputRef={beforeRef}
        />

        {/* ── After 사진 ── */}
        <PhotoUploadSection
          label="시공 후 사진"
          hint="완공 후 모습을 등록해주세요"
          files={afterFiles}
          onAdd={f => addFiles(f, setAfterFiles, afterFiles)}
          onRemove={id => removeFile(id, setAfterFiles)}
          inputRef={afterRef}
        />

        {progress && (
          <div style={{ fontSize:12, color:C.brand, textAlign:"center",
            marginBottom:S.md, fontWeight:700 }}>{progress}</div>
        )}

        <div style={{ display:"flex", gap:S.sm }}>
          <button onClick={onClose}
            style={{ flex:1, padding:S.xl, background:C.bg, color:C.text2,
              border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:15, cursor:"pointer" }}>
            취소
          </button>
          <button onClick={handleSave} disabled={!form.title.trim() || saving}
            style={{ flex:2, padding:S.xl,
              background: form.title.trim() ? C.brand : C.bgWarm,
              color: form.title.trim() ? "#fff" : C.text4,
              border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15,
              cursor: form.title.trim() ? "pointer" : "not-allowed",
              boxShadow: form.title.trim() ? `0 4px 16px ${C.brand}44` : "none" }}>
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PortfolioScreen({ company, onChat, onReview, onBack, onEscrow }) {
  const g = GRADE(company?.temp ?? 0);
  const [photoWork, setPhotoWork] = useState(null);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [portfolio, setPortfolio] = useState(company?.portfolio ?? []);
  const [reviews, setReviews] = useState(company?.reviewList ?? []);

  useEffect(() => {
    if (!company?.id) return;
    getPortfolios(company.id).then(({ data, error }) => {
      if (error) return;
      if (data && data.length > 0) setPortfolio(data.map(normalizePortfolio));
    });
    getReviews(company.id).then(({ data }) => {
      if (data && data.length > 0) setReviews(data);
    });
  }, [company?.id]);

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length).toFixed(1)
    : null;
  const photoReviewCount = reviews.filter(r => (r.image_urls?.length ?? 0) > 0).length;
  // 항목별 후기 평균 (예산/일정/소통/마감)
  const itemAvg = (k) => {
    const vals = reviews.map(r => r[k]).filter(v => typeof v === "number");
    return vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : null;
  };
  const itemScores = [
    ["예산 준수", itemAvg("budget_score")],
    ["일정 준수", itemAvg("schedule_score")],
    ["소통 만족도", itemAvg("communication_score")],
    ["마감 품질", itemAvg("quality_score")],
  ].filter(([, v]) => v != null);

  const handlePortfolioSaved = (row) => {
    setPortfolio(prev => [normalizePortfolio(row), ...prev]);
  };

  if (!company) return null;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background:C.surface, padding:"14px 20px", borderBottom:`1px solid ${C.bgWarm}`,
        position:"sticky", top:0, zIndex:10, display:"flex", alignItems:"center", gap:S.md }}>
        <button onClick={onBack} style={{ background:"none", border:"none",
          fontSize:22, cursor:"pointer", color:C.text1, padding:0, lineHeight:1 }}>←</button>
        <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{company.name}</div>
        <TempBadge temp={company.temp} />
      </div>

      <div style={{ padding:`${S.xl}px ${S.xl}px 100px` }}>

        <div style={{ background:C.surface, borderRadius:R.xl, overflow:"hidden",
          marginBottom:S.lg, border:`1px solid ${C.bgWarm}`,
          boxShadow:"0 2px 12px rgba(28,23,18,0.07)" }}>
          <div style={{ height:4, background:`linear-gradient(90deg,${g.bar},${g.bar}33)` }} />
          <div style={{ padding:S.xl }}>
            <div style={{ display:"flex", gap:S.lg, alignItems:"flex-start", marginBottom:S.lg }}>
              <div style={{ width:64, height:64, borderRadius:R.lg, flexShrink:0,
                background:C.brandL,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:26, fontWeight:900, color:C.brand }}>{(company.name ?? "?")[0]}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:20, fontWeight:900, color:C.text1, marginBottom:8 }}>{company.name}</div>
                <TempBadge temp={company.temp} lg />
              </div>
            </div>

            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:S.lg }}>
              {company.platformCert && <CertBadge type="platform" />}
              {company.insurance && <CertBadge type="insurance" />}
              {company.bizCert && <CertBadge type="biz" />}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:S.sm, marginBottom:S.lg }}>
              {[["✅","완료 건수",`${company.completedJobs}건`],
                ["⭐","평균 평점", avgRating ? `${avgRating}점` : "—"],
                ["📷","포토후기", `${photoReviewCount}건`],
                ["🔄","재계약률",`${company.recontractRate}%`]].map(([icon,label,val]) => (
                <div key={label} style={{ background:C.surface2, borderRadius:R.lg,
                  padding:`${S.md}px ${S.sm}px`, textAlign:"center",
                  border:`1px solid ${C.bgWarm}` }}>
                  <div style={{ fontSize:11, color:C.text3, marginBottom:3 }}>{icon} {label}</div>
                  <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{val}</div>
                </div>
              ))}
            </div>

            {/* 항목별 후기 점수 — 구조화 후기 평균 */}
            {itemScores.length > 0 && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:S.lg }}>
                {itemScores.map(([label, val]) => (
                  <span key={label} style={{ background:C.brandL, color:C.brand, borderRadius:R.full,
                    padding:"4px 11px", fontSize:12, fontWeight:700 }}>
                    {label} {val}
                  </span>
                ))}
              </div>
            )}

            <div style={{ background:company.online?C.greenL:C.bgWarm, borderRadius:R.lg,
              padding:`${S.sm}px ${S.lg}px`, marginBottom:S.lg,
              display:"flex", alignItems:"center", gap:S.sm }}>
              <div style={{ width:8, height:8, borderRadius:"50%",
                background:company.online?C.green:C.text4,
                boxShadow:company.online?`0 0 0 3px ${C.green}33`:"none" }} />
              <span style={{ fontSize:13, fontWeight:700, color:company.online?C.green:C.text3 }}>
                {company.online?`지금 활동중 · ${company.lastActive}` : `마지막 활동: ${company.lastActive}`}
              </span>
              <span style={{ fontSize:12, color:C.text3, marginLeft:"auto" }}>{company.responseTime}</span>
            </div>

            <div style={{ background:C.navyL, borderRadius:R.lg,
              padding:`${S.md}px ${S.lg}px`, border:`1px solid ${C.trustM}`,
              display:"flex", gap:S.md, alignItems:"center" }}>
              <div style={{ fontSize:24, flexShrink:0 }}>🛡</div>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:C.navy, marginBottom:2 }}>
                  에스크로 안전 정산
                </div>
                <div style={{ fontSize:12, color:C.text3, lineHeight:1.5 }}>
                  선금 30% → 중간 점검 후 40% → 완료 확인 후 30%
                </div>
              </div>
            </div>
          </div>
        </div>

        <button onClick={onReview} style={{ width:"100%", background:C.surface,
          border:`1px solid ${C.bgWarm}`, borderRadius:R.xl, padding:S.xl,
          marginBottom:S.lg, cursor:"pointer",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          boxShadow:"0 1px 6px rgba(28,23,18,0.05)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:S.md }}>
            <div style={{ width:44, height:44, borderRadius:R.lg, background:"#FBF5E8",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>⭐</div>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontSize:15, fontWeight:700, color:C.text1 }}>
                시공 후기 {reviews.length}개
              </div>
              <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>
                {reviews.length > 0
                  ? `평균 ${avgRating}점${photoReviewCount > 0 ? ` · 포토후기 ${photoReviewCount}건` : ""} · 탭해서 보기`
                  : "첫 후기를 남겨주세요"}
              </div>
            </div>
          </div>
          <span style={{ color:C.text4, fontSize:20 }}>›</span>
        </button>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.md }}>
          <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>
            시공 포트폴리오
            <span style={{ fontSize:13, fontWeight:500, color:C.text3, marginLeft:6 }}>
              {portfolio.length}건
            </span>
          </div>
          <button onClick={() => setShowWriteModal(true)}
            style={{ background:C.brandL, color:C.brand, border:`1px solid ${C.brandM}`,
              borderRadius:R.full, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
            + 추가
          </button>
        </div>
        {portfolio.map(work => (
          <PortfolioCard key={work.id} work={work} onExpand={setPhotoWork} />
        ))}

        <button onClick={() => onChat(company)}
          style={{ width:"100%", padding:S.xl, background:C.brand, color:"#fff",
            border:"none", borderRadius:R.lg, fontWeight:800, fontSize:16,
            cursor:"pointer", marginTop:S.sm,
            boxShadow:`0 6px 20px ${C.brand}44` }}>
          💬 {company.name} 견적 문의하기
        </button>
        <button onClick={() => onEscrow && onEscrow()}
          style={{ width:"100%", padding:S.lg, background:C.navyL, color:C.navy,
            border:`1px solid ${C.trustM}`, borderRadius:R.lg, fontWeight:700, fontSize:14,
            cursor:"pointer", marginTop:S.sm }}>
          🛡 에스크로 정산 현황 보기
        </button>
      </div>

      {photoWork && <PhotoModal work={photoWork} onClose={() => setPhotoWork(null)} />}
      {showWriteModal && (
        <PortfolioWriteModal
          companyId={company.id}
          onClose={() => setShowWriteModal(false)}
          onSaved={handlePortfolioSaved}
        />
      )}
    </div>
  );
}
