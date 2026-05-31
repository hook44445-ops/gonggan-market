import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { createEstimate, updateEstimate, submitEstimate } from "../lib/supabase";

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

function useDueCountdown(dueAt) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (!dueAt) return;
    const tick = () => {
      const ms = new Date(dueAt).getTime() - Date.now();
      if (ms <= 0) { setText("기한 초과"); return; }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setText(`제출 기한 ${h}시간 ${m}분 남음`);
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

  const dueAt = job.siteVisit?.estimate_due_at ?? null;
  const countdown = useDueCountdown(dueAt);
  const isOverdue = dueAt ? Date.now() > new Date(dueAt).getTime() : false;

  const totalPrice = items.reduce((sum, it) => {
    const qty = Number(it.qty) || 0;
    const up = Number(it.unitPrice) || 0;
    return sum + qty * up;
  }, 0);

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
  });

  const handleSave = async () => {
    setSaving(true);
    let result;
    if (estimateId) {
      result = await updateEstimate(estimateId, buildPayload());
    } else {
      result = await createEstimate(buildPayload());
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
      const { data, error } = await createEstimate(buildPayload());
      if (error) { setSaving(false); alert("저장 실패: " + error.message); return; }
      id = data.id;
      setEstimateId(id);
    } else {
      await updateEstimate(id, buildPayload());
    }
    const { data, error } = await submitEstimate(id, job.siteVisit?.id ?? null, job.bid.request_id);
    setSaving(false);
    if (error) { alert("제출 실패: " + error.message); return; }
    const updated = { ...job, estimate: data, siteVisit: job.siteVisit ? { ...job.siteVisit, status: "estimate_submitted" } : job.siteVisit };
    onChange(updated);
    onClose();
  };

  return (
    <Backdrop onClose={onClose}>
      <div style={{ fontSize:18, fontWeight:800, color:C.text1, marginBottom:S.sm }}>📋 플랫폼 견적서 작성</div>

      {countdown && (
        <div style={{ background: isOverdue ? "#FFF0F0" : C.brandL, borderRadius:R.lg, padding:"10px 14px", marginBottom:S.lg, fontSize:12, fontWeight:700, color: isOverdue ? C.red : C.brand }}>
          {isOverdue ? "⚠️ " : "⏰ "}{countdown}
        </div>
      )}

      <div style={{ fontSize:13, color:C.text3, marginBottom:S.xl }}>
        {job.request?.space_type ?? ""} {job.request?.size ?? ""} · {job.request?.area ?? ""}
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

      <div style={{ display:"flex", gap:S.sm }}>
        <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:S.xl, background:C.bg, color:C.text2, border:`1px solid ${C.bgWarm}`, borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer", opacity:saving?0.7:1 }}>
          임시저장
        </button>
        <button onClick={handleSubmit} disabled={saving} style={{ flex:2, padding:S.xl, background:C.brand, color:"#fff", border:"none", borderRadius:R.lg, fontWeight:800, fontSize:15, cursor:"pointer", boxShadow:`0 4px 16px ${C.brand}44`, opacity:saving?0.7:1 }}>
          {saving ? "처리중..." : "제출하기"}
        </button>
      </div>
    </Backdrop>
  );
}
