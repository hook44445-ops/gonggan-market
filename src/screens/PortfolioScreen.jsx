import { useState, useEffect } from "react";
import { C, R, S, GRADE } from "../constants";
import { TempBadge, CertBadge } from "../components/common";
import PortfolioCard from "../components/PortfolioCard";
import PhotoModal from "../components/PhotoModal";
import { getPortfolios, createPortfolio } from "../lib/supabase";

const normalizePortfolio = (row) => ({
  id:    row.id,
  type:  row.space_type ?? "시공",
  size:  row.size ?? "",
  area:  row.area ?? "",
  after: (row.after_photos ?? [])[0] ?? null,
  tags:  row.tags ?? [],
  desc:  row.desc ?? "",
  title: row.title,
});

function PortfolioWriteModal({ companyId, onClose, onSaved }) {
  const [form, setForm] = useState({ title:"", space_type:"", area:"", size:"", desc:"" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]:v }));
  const iS = { width:"100%", padding:"12px 14px", border:`1.5px solid ${C.bgWarm}`,
    borderRadius:R.md, fontSize:14, outline:"none", boxSizing:"border-box",
    marginBottom:12, fontFamily:"inherit", color:C.text1, background:C.surface };

  const handleSave = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    const { data, error } = await createPortfolio({
      company_id:  companyId,
      title:       form.title.trim(),
      space_type:  form.space_type.trim() || null,
      area:        form.area.trim() || null,
      size:        form.size.trim() || null,
      desc:        form.desc.trim() || null,
    });
    setSaving(false);
    if (error) { console.error("[Portfolio] save failed:", error.message); return; }
    onSaved(data);
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.65)",
      display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:200 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background:C.surface, borderRadius:"24px 24px 0 0",
        width:"100%", maxWidth:480, padding:"24px 24px 40px", maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />
        <div style={{ fontSize:17, fontWeight:900, color:C.text1, marginBottom:4 }}>포트폴리오 추가</div>
        <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>완공된 시공 사례를 등록하세요</div>

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

        <div style={{ display:"flex", gap:S.sm, marginTop:S.sm }}>
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

  useEffect(() => {
    if (!company?.id) return;
    getPortfolios(company.id).then(({ data, error }) => {
      if (error) { console.error("[PortfolioScreen] load failed:", error.message); return; }
      if (data && data.length > 0) setPortfolio(data.map(normalizePortfolio));
    });
  }, [company?.id]);

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
                fontSize:26, fontWeight:900, color:C.brand }}>{company.name[0]}</div>
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

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:S.sm, marginBottom:S.lg }}>
              {[["✅","완료 건수",`${company.completedJobs}건`],
                ["🔄","재계약률",`${company.recontractRate}%`],
                ["🛠","AS 처리율",`${company.asRate}%`]].map(([icon,label,val]) => (
                <div key={label} style={{ background:C.surface2, borderRadius:R.lg,
                  padding:`${S.md}px ${S.sm}px`, textAlign:"center",
                  border:`1px solid ${C.bgWarm}` }}>
                  <div style={{ fontSize:11, color:C.text3, marginBottom:3 }}>{icon} {label}</div>
                  <div style={{ fontSize:16, fontWeight:800, color:C.text1 }}>{val}</div>
                </div>
              ))}
            </div>

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
                시공 후기 {portfolio.length > 0 ? (company.reviewList ?? []).length : (company.reviewList ?? []).length}개
              </div>
              <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>
                {(company.reviewList ?? []).length > 0
                  ? `평균 ${((company.reviewList ?? []).reduce((s,r) => s+r.rating,0)/(company.reviewList ?? []).length).toFixed(1)}점 · 탭해서 보기`
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
