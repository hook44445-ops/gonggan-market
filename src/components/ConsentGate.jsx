import { useState } from "react";
import { C, R, S } from "../constants";
import { DOCUMENT_TEMPLATES } from "../constants/documentTemplates";

const STORAGE_KEY = (userId) => `gonggan_consents_${userId ?? "guest"}`;

export function hasConsented(userId, requiredTypes) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY(userId)) ?? "{}");
    return requiredTypes.every(t => !!data[t]);
  } catch { return false; }
}

function saveConsents(userId, types) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY(userId)) ?? "{}");
    types.forEach(t => { data[t] = Date.now(); });
    localStorage.setItem(STORAGE_KEY(userId), JSON.stringify(data));
  } catch {}
}

export default function ConsentGate({ requiredTypes, userId, title, onComplete, onClose }) {
  const templates = requiredTypes
    .map(type => DOCUMENT_TEMPLATES.find(t => t.type === type))
    .filter(Boolean);

  const [idx, setIdx] = useState(0);
  const [checked, setChecked] = useState({});

  const tpl = templates[idx];
  if (!tpl) return null;

  const items = tpl.checklist ?? [];
  const allChecked = items.every((item, i) => checked[`${idx}_${i}`]);
  const isLast = idx === templates.length - 1;

  const handleNext = () => {
    if (isLast) {
      saveConsents(userId, requiredTypes);
      onComplete?.();
    } else {
      setIdx(i => i + 1);
      setChecked({});
    }
  };

  return (
    <div
      style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.72)",
        display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:600 }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={{
        background:C.surface, borderRadius:"24px 24px 0 0",
        width:"100%", maxWidth:480,
        padding:"24px 24px 40px", maxHeight:"88vh", overflowY:"auto",
      }}>
        <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:S.xl }}>
          <div>
            {title && <div style={{ fontSize:13, color:C.text3, marginBottom:3 }}>{title}</div>}
            <div style={{ fontSize:18, fontWeight:900, color:C.text1 }}>{tpl.title}</div>
          </div>
          <div style={{ fontSize:12, color:C.text3, background:C.bg, borderRadius:R.full,
            padding:"4px 10px", fontWeight:700 }}>
            {idx + 1} / {templates.length}
          </div>
        </div>

        <div style={{ display:"flex", gap:4, marginBottom:S.xl }}>
          {templates.map((_, i) => (
            <div key={i} style={{ flex:1, height:3, borderRadius:R.full,
              background: i < idx ? C.green : i === idx ? C.brand : C.bgWarm }} />
          ))}
        </div>

        {tpl.reason && (
          <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, marginBottom:S.xl,
            border:`1px solid ${C.brandM}`, fontSize:12, color:C.brand, lineHeight:1.7 }}>
            💡 {tpl.reason}
          </div>
        )}

        {tpl.sections?.slice(0, 1).map((sec, i) => (
          <div key={i} style={{ background:C.surface2, borderRadius:R.lg, padding:S.lg,
            marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.text3, marginBottom:S.sm }}>{sec.title}</div>
            <div style={{ fontSize:13, color:C.text2, lineHeight:1.8 }}>{sec.body}</div>
          </div>
        ))}

        <div style={{ marginBottom:S.xl }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.text1, marginBottom:S.md }}>아래 항목을 확인하고 동의해주세요</div>
          {items.map((item, i) => {
            const key = `${idx}_${i}`;
            const val = !!checked[key];
            const label = typeof item === "string" ? item : item.label ?? item;
            return (
              <div key={i}
                onClick={() => setChecked(p => ({ ...p, [key]: !p[key] }))}
                style={{ display:"flex", gap:S.md, alignItems:"flex-start",
                  padding:`${S.md}px 0`,
                  borderBottom: i < items.length - 1 ? `1px solid ${C.bg}` : "none",
                  cursor:"pointer" }}>
                <div style={{
                  width:22, height:22, borderRadius:6, flexShrink:0, marginTop:1,
                  background: val ? C.brand : C.surface,
                  border:`2px solid ${val ? C.brand : C.bgWarm}`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color:"#fff", fontSize:12, fontWeight:900,
                }}>
                  {val ? "✓" : ""}
                </div>
                <span style={{ fontSize:13, color:C.text1, lineHeight:1.7 }}>{label}</span>
              </div>
            );
          })}
        </div>

        {tpl.consentText && (
          <div style={{ background:C.surface2, borderRadius:R.lg, padding:S.lg,
            fontSize:12, color:C.text3, marginBottom:S.xl, border:`1px solid ${C.bgWarm}` }}>
            {tpl.consentText}
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:S.sm }}>
          <button
            onClick={handleNext}
            disabled={!allChecked}
            style={{
              width:"100%", padding:S.xl,
              background: allChecked ? C.brand : C.bgWarm,
              color: allChecked ? "#fff" : C.text4,
              border:"none", borderRadius:R.md,
              fontWeight:700, fontSize:14,
              cursor: allChecked ? "pointer" : "not-allowed",
              boxShadow: allChecked ? `0 4px 14px ${C.brand}44` : "none",
            }}>
            {isLast
              ? `✅ 모두 동의하고 계속 (${idx + 1}/${templates.length})`
              : `다음 (${idx + 2}/${templates.length}: ${templates[idx + 1]?.title}) →`}
          </button>
          <button onClick={onClose}
            style={{ width:"100%", padding:S.lg, background:C.bg, color:C.text3,
              border:"none", borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer" }}>
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}
