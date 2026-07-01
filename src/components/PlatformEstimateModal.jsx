import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { createEstimate, updateEstimate, submitEstimate, uploadFile, createNotification } from "../lib/supabase";
import { formatDueRemaining } from "../constants/policy";
import EstimateCoachPanel from "./growth/EstimateCoachPanel";       // Space OS · AI 코치(라이브, Add Only)
import EstimateAnalysisResult from "./growth/EstimateAnalysisResult"; // Space OS · 성실견적 분석 결과(제출 후)
import { analyzeEstimate } from "../constants/spaceOs";

function Backdrop({ onClose, children }) {
  return (
    <div
      style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.65)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:300 }}
      onClick={onClose}
    >
      <div
        style={{ background:C.surface, borderRadius:"24px 24px 0 0", width:"100%", maxWidth:480, padding:"24px 24px 40px", maxHeight:"88vh", overflowY:"auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />
        {children}
      </div>
    </div>
  );
}

const emptyItem = () => ({ id: Date.now() + Math.random(), name: "", material: "", qty: "", unitPrice: "" });

// [정책] 현장견적 카운트다운: 72h (constants/policy.js · 2026.06)
function useDueCountdown(dueAt) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!dueAt) return;
    const tick = () => {
      const r = formatDueRemaining(dueAt, { prefix: "제출 기한" });
      setText(r ? r.text : "");
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [dueAt]);
  return text;
}

export default function PlatformEstimateModal({ job, companyId, userId, onClose, onChange }) {
  const [items, setItems] = useState(() => [emptyItem(), emptyItem(), emptyItem()]);
  const [durationDays, setDurationDays] = useState("");
  const [note, setNote] = useState("");
  const [warrantyNote, setWarrantyNote] = useState("");
  const [estimateId, setEstimateId] = useState(job.estimate?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState(null); // Space OS 성실견적 분석 결과(제출 후 표시)

  // 현장 실측 사진(최대 5장). 업로드 경로는 request_id 기준 고정.
  const MAX_PHOTOS = 5;
  const [photoUrls, setPhotoUrls] = useState(() =>
    Array.isArray(job.estimate?.final_quote_photo_urls) ? job.estimate.final_quote_photo_urls : []
  );
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const requestIdForPhotos = job.bid?.request_id ?? job.request?.id ?? null;

  // ──────────────────────────────────────────────────────────────────────
  // Space OS Base 확장(전부 선택 입력) — 자재기록 / 특이사항 / 시공참고 / 계약특약.
  //   · 프로젝트 ID(request_id) 기준으로 연결되는 '공식 기준 문서'의 확장 슬롯.
  //   · 기존 견적 제출(RPC/금액/에스크로)에는 영향 없음(payload 무변경) → Regression 방지.
  //   · DB 스키마 미변경(Migration 금지) → 현재는 request_id 기준 localStorage 에 구조적으로 보관.
  //     (향후 estimates 확장 컬럼/Project 테이블 생기면 이 구조 그대로 동기화 가능 — AI/Digital Twin 확장 대비)
  //   · 자재는 공통 강제항목(두께/규격) 없이 자유입력만(자재마다 필요한 정보가 다름 → 향후 AI 자동추천).
  const SOS_KEY = `final_quote_sos_${requestIdForPhotos ?? "unknown"}`;
  const _sos0 = (() => { try { return JSON.parse(localStorage.getItem(SOS_KEY) ?? "null"); } catch { return null; } })();
  const emptyMaterial = () => ({ id: Date.now() + Math.random(), name: "", record: "", memo: "", photos: [] });
  const [materials, setMaterials]               = useState(() => Array.isArray(_sos0?.materials) ? _sos0.materials : []);
  const [specialNote, setSpecialNote]           = useState(() => _sos0?.specialNote ?? "");
  const [constructionNote, setConstructionNote] = useState(() => _sos0?.constructionNote ?? "");
  const [contractSpecial, setContractSpecial]   = useState(() => _sos0?.contractSpecial ?? "");
  const [matUploadingId, setMatUploadingId]     = useState(null);

  // 변경 시 request_id 기준 구조적 보관(확장 가능 구조). 실패해도 무시.
  useEffect(() => {
    try {
      localStorage.setItem(SOS_KEY, JSON.stringify({
        version: 1, request_id: requestIdForPhotos,
        materials, specialNote, constructionNote, contractSpecial,
        updatedAt: new Date().toISOString(),
      }));
    } catch {}
  }, [materials, specialNote, constructionNote, contractSpecial]); // eslint-disable-line react-hooks/exhaustive-deps

  const addMaterial    = () => { if (materials.length >= 20) return; setMaterials(prev => [...prev, emptyMaterial()]); };
  const updateMaterial = (id, field, val) => setMaterials(prev => prev.map(m => m.id === id ? { ...m, [field]: val } : m));
  const removeMaterial = (id) => setMaterials(prev => prev.filter(m => m.id !== id));

  const addMaterialPhotos = async (id, fileList) => {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    if (!requestIdForPhotos) { setPhotoError("요청 정보를 찾을 수 없어 사진을 첨부할 수 없어요."); return; }
    setMatUploadingId(id);
    try {
      const target = materials.find(m => m.id === id);
      const room = Math.max(0, 5 - (target?.photos?.length ?? 0));
      const uploaded = [];
      for (let i = 0; i < Math.min(files.length, room); i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) { setPhotoError(`${file.name}: 파일이 너무 커요 (최대 10MB)`); continue; }
        const path = `final-quote/${requestIdForPhotos}/material/${Date.now()}_${i}.jpg`;
        try { const url = await uploadFile("documents", path, file); if (url) uploaded.push(url); }
        catch (err) { console.error("[MATERIAL_PHOTO_UPLOAD_FAILED]", err); setPhotoError("자재 사진 업로드 실패: " + (err?.message ?? "")); }
      }
      if (uploaded.length > 0) setMaterials(prev => prev.map(m => m.id === id ? { ...m, photos: [...(m.photos ?? []), ...uploaded].slice(0, 5) } : m));
    } finally { setMatUploadingId(null); }
  };
  const removeMaterialPhoto = (id, idx) => setMaterials(prev => prev.map(m => m.id === id ? { ...m, photos: (m.photos ?? []).filter((_, i) => i !== idx) } : m));

  const handlePhotoSelect = async (e) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // 같은 파일 재선택 허용
    if (files.length === 0) return;
    if (!requestIdForPhotos) { setPhotoError("요청 정보를 찾을 수 없어 업로드할 수 없어요."); return; }
    const room = MAX_PHOTOS - photoUrls.length;
    if (room <= 0) { setPhotoError(`사진은 최대 ${MAX_PHOTOS}장까지 첨부할 수 있어요.`); return; }
    setUploadingPhoto(true);
    setPhotoError(null);
    const ALLOWED = ["image/jpeg","image/jpg","image/png","image/webp","image/heic","image/heif"];
    const MAX_BYTES = 10 * 1024 * 1024;
    const uploaded = [];
    try {
      for (let i = 0; i < Math.min(files.length, room); i++) {
        const file = files[i];
        const typeOk = file.type ? ALLOWED.includes(file.type.toLowerCase()) : /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
        if (!typeOk) { setPhotoError(`${file.name}: 이미지 형식만 첨부할 수 있어요 (JPG, PNG, WebP)`); continue; }
        if (file.size > MAX_BYTES) { setPhotoError(`${file.name}: 파일이 너무 커요 (최대 10MB)`); continue; }
        // 업로드 경로는 request_id 기준 고정 — synthetic/contract/company 단독 id 사용 금지.
        const path = `final-quote/${requestIdForPhotos}/${Date.now()}_${i}.jpg`;
        try {
          const url = await uploadFile("documents", path, file);
          if (url) uploaded.push(url);
          else setPhotoError("사진 업로드에 실패했어요. 잠시 후 다시 시도해주세요.");
        } catch (err) {
          console.error("[FINAL_QUOTE_PHOTO_UPLOAD_FAILED]", err);
          setPhotoError("사진 업로드 실패: " + (err?.message ?? "네트워크 확인 후 다시 시도해주세요."));
        }
      }
      if (uploaded.length > 0) setPhotoUrls(prev => [...prev, ...uploaded].slice(0, MAX_PHOTOS));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = (idx) => setPhotoUrls(prev => prev.filter((_, i) => i !== idx));

  const dueAt = job.siteVisit?.estimate_due_at ?? null;
  const countdown = useDueCountdown(dueAt);
  const isOverdue = dueAt ? Date.now() > new Date(dueAt).getTime() : false;

  const totalPrice = items.reduce((sum, it) => {
    const qty = Number(it.qty) || 0;
    const up = Number(it.unitPrice) || 0;
    return sum + qty * up;
  }, 0);

  // Space OS 성실견적 분석 입력(라이브 코치용) — 기존 제출 payload 와 무관(분석 전용).
  const analysisForm = {
    items, durationDays, note, warrantyNote, photoUrls,
    materials, specialNote, constructionNote, contractSpecial,
  };

  const updateItem = (id, field, val) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: val } : it));

  const addItem = () => {
    if (items.length >= 10) return;
    setItems(prev => [...prev, emptyItem()]);
  };

  const removeItem = (id) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const buildPayload = () => ({
    bid_id: job.bid.id,
    request_id: job.bid.request_id,
    site_visit_id: job.siteVisit?.id ?? null,
    company_id: companyId,
    items: items.map(({ name, material, qty, unitPrice }) => ({
      name, material, qty: Number(qty) || 0, unit_price: Number(unitPrice) || 0,
      amount: (Number(qty) || 0) * (Number(unitPrice) || 0),
    })),
    total_price: totalPrice,
    duration_days: durationDays ? Number(durationDays) : null,
    note: note || null,
    warranty_note: warrantyNote || null,
    photo_urls: photoUrls,
  });

  const handleSave = async () => {
    setSaving(true);
    let result;
    if (estimateId) {
      result = await updateEstimate(estimateId, buildPayload(), userId);
    } else {
      result = await createEstimate(buildPayload(), userId);
    }
    setSaving(false);
    if (result.error) { alert("저장 실패: " + result.error.message); return; }
    if (!estimateId) setEstimateId(result.data.id);
    const updated = { ...job, estimate: result.data };
    onChange(updated);
    alert("임시저장되었습니다");
  };

  const handleSubmit = async () => {
    const invalid = items.some(it => !it.name || !it.qty || !it.unitPrice);
    if (invalid) { alert("공정명, 수량, 단가를 모두 입력해주세요"); return; }
    setSaving(true);
    let id = estimateId;
    if (!id) {
      const { data, error } = await createEstimate(buildPayload(), userId);
      if (error) { setSaving(false); alert("저장 실패: " + error.message); return; }
      id = data.id;
      setEstimateId(id);
    } else {
      await updateEstimate(id, buildPayload(), userId);
    }
    const { data, error } = await submitEstimate(id, job.siteVisit?.id ?? null, job.bid.request_id, userId);
    setSaving(false);
    if (error) { alert("제출 실패: " + error.message); return; }
    // 의뢰인에게 '최종견적 도착' 알림 — 결제(계약) 알림보다 먼저 발생시켜 확인→결제 흐름을 유도(Add Only).
    // 결제/계약 알림은 결제 완료 시점에 별도 발생하므로 여기서는 계약 알림을 만들지 않는다.
    const consumerId = job.request?.user_id ?? job.request?.userId ?? null;
    if (consumerId) {
      createNotification({
        userId:      consumerId,
        type:        "FINAL_QUOTE_ARRIVED",
        title:       "최종견적이 도착했습니다",
        message:     "고객님, 업체가 최종견적을 보냈어요. 확인 후 결제를 진행해주세요. 📋",
        relatedId:   job.bid.request_id,
        relatedType: "request",
        priority:    "HIGH",
      }).catch(() => {});
    }
    const updated = { ...job, estimate: data, siteVisit: job.siteVisit ? { ...job.siteVisit, status: "estimate_submitted" } : job.siteVisit };
    onChange(updated);
    // Space OS 성실견적 분석 결과 표시(제출/RPC/금액 로직은 위에서 이미 완료 — 분석은 표시 전용).
    // 결과 모달의 '확인'(onClose)으로 모달을 닫는다.
    try {
      setAnalysis(analyzeEstimate({ items, durationDays, note, warrantyNote, photoUrls, materials, specialNote, constructionNote, contractSpecial }));
    } catch { onClose(); }
  };

  return (
    <Backdrop onClose={onClose}>
      <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:S.sm }}>📋 최종 견적서 작성</div>

      {countdown && (
        <div style={{ background: isOverdue ? "#FFF0F0" : C.brandL, borderRadius:R.lg, padding:"10px 14px", marginBottom:S.lg, fontSize:12, fontWeight:700, color: isOverdue ? C.red : C.brand }}>
          {isOverdue ? "⚠️ " : "⏰ "}{countdown}
        </div>
      )}

      <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>
        {job.request?.space_type ?? ""} {job.request?.size ?? ""} · {job.request?.area ?? ""}
      </div>

      {/* ① 프로젝트 기본정보 — 프로젝트의 공식 기준(Source of Truth). request_id 로 모든 기록이 연결된다. */}
      <div style={{ background:C.bg, border:`1px solid ${C.bgWarm}`, borderRadius:R.md, padding:S.md, marginBottom:S.xl }}>
        <div style={{ fontSize:13, fontWeight:800, color:C.text1, marginBottom:S.sm }}>📁 프로젝트 기본정보</div>
        {[
          ["프로젝트명", `${job.request?.space_type ?? ""} ${job.request?.size ?? ""}`.trim() || "인테리어 프로젝트"],
          ["프로젝트 ID", requestIdForPhotos ?? "—"],
          ["고객", job.request?.area ? `의뢰인 · ${job.request.area}` : "의뢰인"],
          ["업체", "내 업체"],
          ["주소", job.request?.area ?? "결제 후 공개"],
          ["공사기간", durationDays ? `${durationDays}일` : "—"],
          ["작성일", (job.estimate?.created_at ? new Date(job.estimate.created_at) : new Date()).toLocaleDateString("ko-KR")],
        ].map(([k, v]) => (
          <div key={k} style={{ display:"flex", justifyContent:"space-between", gap:S.md, fontSize:12, padding:"3px 0" }}>
            <span style={{ color:C.text3, flexShrink:0 }}>{k}</span>
            <span style={{ color:C.text1, fontWeight:600, textAlign:"right", wordBreak:"break-all" }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ marginBottom:S.xl }}>
        <div style={{ fontSize:14, fontWeight:800, color:C.text1, marginBottom:S.md }}>공정 내역</div>
        {items.map((it, idx) => (
          <div key={it.id} style={{ background:C.bg, borderRadius:R.md, padding:S.md, marginBottom:S.sm }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.sm }}>
              <span style={{ fontSize:12, fontWeight:700, color:C.text3 }}>공정 {idx + 1}</span>
              {items.length > 1 && (
                <button onClick={() => removeItem(it.id)} style={{ background:"none", border:"none", color:C.text4, fontSize:16, cursor:"pointer", padding:0, lineHeight:1 }}>✕</button>
              )}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:S.sm, marginBottom:S.sm }}>
              <input
                value={it.name}
                onChange={e => updateItem(it.id, "name", e.target.value)}
                placeholder="공정명"
                style={{ padding:"10px 12px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.sm, fontSize:13, outline:"none", boxSizing:"border-box", color:C.text1, background:C.surface, fontFamily:"inherit" }}
              />
              <input
                value={it.material}
                onChange={e => updateItem(it.id, "material", e.target.value)}
                placeholder="자재명"
                style={{ padding:"10px 12px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.sm, fontSize:13, outline:"none", boxSizing:"border-box", color:C.text1, background:C.surface, fontFamily:"inherit" }}
              />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:S.sm, alignItems:"center" }}>
              <input
                type="number"
                value={it.qty}
                onChange={e => updateItem(it.id, "qty", e.target.value)}
                placeholder="수량"
                style={{ padding:"10px 12px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.sm, fontSize:13, outline:"none", boxSizing:"border-box", color:C.text1, background:C.surface, fontFamily:"inherit" }}
              />
              <input
                type="number"
                value={it.unitPrice}
                onChange={e => updateItem(it.id, "unitPrice", e.target.value)}
                placeholder="단가(만원)"
                style={{ padding:"10px 12px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.sm, fontSize:13, outline:"none", boxSizing:"border-box", color:C.text1, background:C.surface, fontFamily:"inherit" }}
              />
              <div style={{ fontSize:12, fontWeight:700, color:C.brand, textAlign:"right" }}>
                {Math.round((Number(it.qty) || 0) * (Number(it.unitPrice) || 0)).toLocaleString()}만
              </div>
            </div>
          </div>
        ))}
        {items.length < 10 && (
          <button onClick={addItem} style={{ width:"100%", padding:"11px", border:`2px dashed ${C.bgWarm}`, borderRadius:R.md, background:"none", color:C.text3, fontWeight:700, fontSize:13, cursor:"pointer", marginTop:S.sm }}>
            + 공정 추가
          </button>
        )}
      </div>

      <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, marginBottom:S.xl, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontSize:14, fontWeight:800, color:C.brand }}>총 견적 금액</div>
        <div style={{ fontSize:20, fontWeight:900, color:C.brand }}>{Math.round(totalPrice).toLocaleString()}만원</div>
      </div>

      <div style={{ marginBottom:S.lg }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>공사 기간 (일)</div>
        <input
          type="number"
          value={durationDays}
          onChange={e => setDurationDays(e.target.value)}
          placeholder="예) 14"
          style={{ width:"100%", padding:"13px 16px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.md, fontSize:15, outline:"none", boxSizing:"border-box", color:C.text1, background:C.surface, fontFamily:"inherit" }}
        />
      </div>

      <div style={{ marginBottom:S.lg }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>견적 메모</div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="고객에게 전달할 견적 설명"
          rows={3}
          style={{ width:"100%", padding:"13px 16px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.md, fontSize:14, outline:"none", boxSizing:"border-box", color:C.text1, background:C.surface, fontFamily:"inherit", resize:"none" }}
        />
      </div>

      <div style={{ marginBottom:S.xxl }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>하자보수 조건</div>
        <textarea
          value={warrantyNote}
          onChange={e => setWarrantyNote(e.target.value)}
          placeholder="하자보수 보증 기간 및 조건"
          rows={2}
          style={{ width:"100%", padding:"13px 16px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.md, fontSize:14, outline:"none", boxSizing:"border-box", color:C.text1, background:C.surface, fontFamily:"inherit", resize:"none" }}
        />
      </div>

      {/* 현장 실측 사진 첨부 (최대 5장) — 의뢰인이 결제 전 확인용. 기존 금액/제출 로직과 독립. */}
      <div style={{ marginBottom:S.xxl }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>
          현장 확인 사진 첨부 <span style={{ color:C.text4, fontWeight:600 }}>({photoUrls.length}/{MAX_PHOTOS})</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:S.sm }}>
          {photoUrls.map((url, i) => (
            <div key={url + i} style={{ position:"relative", paddingTop:"100%", borderRadius:R.md, overflow:"hidden", border:`1px solid ${C.bgWarm}` }}>
              <img src={url} alt={`현장사진 ${i+1}`} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
              <button onClick={() => removePhoto(i)} aria-label="사진 삭제"
                style={{ position:"absolute", top:4, right:4, width:22, height:22, borderRadius:"50%", border:"none", background:"rgba(0,0,0,0.6)", color:"#fff", fontSize:13, lineHeight:1, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
            </div>
          ))}
          {photoUrls.length < MAX_PHOTOS && (
            <label style={{ position:"relative", paddingTop:"100%", borderRadius:R.md, border:`2px dashed ${C.bgWarm}`, cursor: uploadingPhoto ? "wait" : "pointer", background:C.bg }}>
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:C.text3, fontSize:12, fontWeight:700, gap:2 }}>
                <span style={{ fontSize:20 }}>{uploadingPhoto ? "⏳" : "📷"}</span>
                {uploadingPhoto ? "업로드중" : "사진 추가"}
              </div>
              <input type="file" accept="image/*" multiple disabled={uploadingPhoto} onChange={handlePhotoSelect}
                style={{ position:"absolute", inset:0, opacity:0, width:"100%", height:"100%", cursor:"pointer" }} />
            </label>
          )}
        </div>
        {photoError && (
          <div style={{ marginTop:S.sm, fontSize:12, color:C.red, lineHeight:1.6 }}>{photoError}</div>
        )}
      </div>

      {/* ③ 자재 기록 (선택) — 자재 다중 등록. 공통 강제항목(두께/규격) 없이 자유입력만. */}
      <div style={{ marginBottom:S.xl }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.text2 }}>자재 기록 <span style={{ color:C.text4, fontWeight:600 }}>(선택)</span></div>
          <span style={{ fontSize:11, color:C.text4 }}>{materials.length}건</span>
        </div>
        <div style={{ fontSize:11, color:C.text4, lineHeight:1.6, marginBottom:S.sm }}>
          자재마다 필요한 정보가 달라요. 자유롭게 기록하세요. (향후 AI가 자재명으로 입력항목을 자동 추천)
        </div>
        {materials.map((m, idx) => (
          <div key={m.id} style={{ background:C.bg, borderRadius:R.md, padding:S.md, marginBottom:S.sm, border:`1px solid ${C.bgWarm}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.sm }}>
              <span style={{ fontSize:12, fontWeight:700, color:C.text3 }}>자재 {idx + 1}</span>
              <button onClick={() => removeMaterial(m.id)} style={{ background:"none", border:"none", color:C.text4, fontSize:16, cursor:"pointer", padding:0, lineHeight:1 }}>✕</button>
            </div>
            <input value={m.name} onChange={e => updateMaterial(m.id, "name", e.target.value)} placeholder="자재명 (예: 단열재 · 타일 · 창호 · 방수재 · 도장 · 전선 · 배관 · 마루 · 기타)"
              style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.sm, fontSize:13, outline:"none", boxSizing:"border-box", color:C.text1, background:C.surface, fontFamily:"inherit", marginBottom:S.sm }} />
            <textarea value={m.record} onChange={e => updateMaterial(m.id, "record", e.target.value)} placeholder="기록내용 (자유입력 — 자재에 맞게: 두께/규격/난연등급/색상/KS규격/모델명/유리사양 등)" rows={2}
              style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.sm, fontSize:13, outline:"none", boxSizing:"border-box", color:C.text1, background:C.surface, fontFamily:"inherit", resize:"none", marginBottom:S.sm }} />
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:6, marginBottom:S.sm }}>
              {(m.photos ?? []).map((url, i) => (
                <div key={url + i} style={{ position:"relative", paddingTop:"100%", borderRadius:R.sm, overflow:"hidden", border:`1px solid ${C.bgWarm}` }}>
                  <img src={url} alt={`자재사진 ${i+1}`} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
                  <button onClick={() => removeMaterialPhoto(m.id, i)} aria-label="사진 삭제"
                    style={{ position:"absolute", top:2, right:2, width:18, height:18, borderRadius:"50%", border:"none", background:"rgba(0,0,0,0.6)", color:"#fff", fontSize:11, lineHeight:1, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
                </div>
              ))}
              {(m.photos?.length ?? 0) < 5 && (
                <label style={{ position:"relative", paddingTop:"100%", borderRadius:R.sm, border:`2px dashed ${C.bgWarm}`, cursor: matUploadingId === m.id ? "wait" : "pointer", background:C.surface }}>
                  <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", color:C.text3, fontSize:16 }}>{matUploadingId === m.id ? "⏳" : "📷"}</div>
                  <input type="file" accept="image/*" multiple disabled={matUploadingId === m.id} onChange={e => { const fl = Array.from(e.target.files ?? []); e.target.value = ""; addMaterialPhotos(m.id, fl); }}
                    style={{ position:"absolute", inset:0, opacity:0, width:"100%", height:"100%", cursor:"pointer" }} />
                </label>
              )}
            </div>
            <input value={m.memo} onChange={e => updateMaterial(m.id, "memo", e.target.value)} placeholder="메모 (선택)"
              style={{ width:"100%", padding:"10px 12px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.sm, fontSize:13, outline:"none", boxSizing:"border-box", color:C.text1, background:C.surface, fontFamily:"inherit" }} />
          </div>
        ))}
        {materials.length < 20 && (
          <button onClick={addMaterial} style={{ width:"100%", padding:"11px", border:`2px dashed ${C.bgWarm}`, borderRadius:R.md, background:"none", color:C.text3, fontWeight:700, fontSize:13, cursor:"pointer" }}>
            + 자재 기록 추가
          </button>
        )}
      </div>

      {/* ⑤ 특이사항 (선택) */}
      <div style={{ marginBottom:S.lg }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>특이사항 <span style={{ color:C.text4, fontWeight:600 }}>(선택)</span></div>
        <textarea value={specialNote} onChange={e => setSpecialNote(e.target.value)} placeholder="현장/프로젝트 특이사항 메모" rows={2}
          style={{ width:"100%", padding:"13px 16px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.md, fontSize:14, outline:"none", boxSizing:"border-box", color:C.text1, background:C.surface, fontFamily:"inherit", resize:"none" }} />
      </div>

      {/* ⑥ 시공 참고사항 (선택) */}
      <div style={{ marginBottom:S.lg }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>시공 참고사항 <span style={{ color:C.text4, fontWeight:600 }}>(선택)</span></div>
        <textarea value={constructionNote} onChange={e => setConstructionNote(e.target.value)} placeholder="주의사항 · 고객 요청사항 등" rows={2}
          style={{ width:"100%", padding:"13px 16px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.md, fontSize:14, outline:"none", boxSizing:"border-box", color:C.text1, background:C.surface, fontFamily:"inherit", resize:"none" }} />
      </div>

      {/* ⑦ 계약 특약 (선택) */}
      <div style={{ marginBottom:S.xxl }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.text2, marginBottom:S.sm }}>계약 특약 <span style={{ color:C.text4, fontWeight:600 }}>(선택)</span></div>
        <textarea value={contractSpecial} onChange={e => setContractSpecial(e.target.value)} placeholder="계약 특약 사항" rows={2}
          style={{ width:"100%", padding:"13px 16px", border:`1.5px solid ${C.bgWarm}`, borderRadius:R.md, fontSize:14, outline:"none", boxSizing:"border-box", color:C.text1, background:C.surface, fontFamily:"inherit", resize:"none" }} />
      </div>

      {/* Space OS · AI 코치 — 작성 중 보완 제안(제안형). 분석/표시 전용. */}
      <EstimateCoachPanel form={analysisForm} />

      <div style={{ display:"flex", gap:S.sm }}>
        <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:S.xl, background:C.bg, color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer", opacity:saving?0.7:1 }}>
          임시저장
        </button>
        <button onClick={handleSubmit} disabled={saving} style={{ flex:2, padding:S.xl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer", boxShadow:`0 4px 16px ${C.brand}44`, opacity:saving?0.7:1 }}>
          {saving ? "처리중..." : "최종 견적서 전송하기"}
        </button>
      </div>

      {/* 제출 후 Space OS 분석 결과 — '확인' 시 onClose 로 모달 종료 */}
      {analysis && <EstimateAnalysisResult result={analysis} onClose={onClose} />}
    </Backdrop>
  );
}
