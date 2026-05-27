import { useState } from "react";
import { C, R, S } from "../constants";
import { DOCUMENT_TEMPLATES, UPLOAD_DOCUMENT_TEMPLATES } from "../constants/documentTemplates";

const ALL_TEMPLATES = [...DOCUMENT_TEMPLATES, ...UPLOAD_DOCUMENT_TEMPLATES];

export default function TermsModal({ docType, onClose }) {
  const tpl = ALL_TEMPLATES.find(t => t.type === docType);
  const [open, setOpen] = useState({});

  if (!tpl) return null;

  return (
    <div
      style={{ position:"fixed", inset:0, background:"rgba(31,42,36,0.65)",
        display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:500 }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={{
        background:C.surface, borderRadius:"24px 24px 0 0",
        width:"100%", maxWidth:480,
        padding:"24px 24px 40px", maxHeight:"88vh", overflowY:"auto",
      }}>
        <div style={{ width:36, height:4, background:C.bgWarm, borderRadius:R.full, margin:"0 auto 20px" }} />

        <div style={{ display:"flex", alignItems:"center", gap:S.sm, marginBottom:S.xl }}>
          <div style={{ fontSize:22 }}>📄</div>
          <div>
            <div style={{ fontSize:18, fontWeight:900, color:C.text1 }}>{tpl.title}</div>
            {tpl.description && (
              <div style={{ fontSize:12, color:C.text3, marginTop:2 }}>{tpl.description}</div>
            )}
          </div>
        </div>

        {tpl.reason && (
          <div style={{ background:C.brandL, borderRadius:R.lg, padding:S.lg, marginBottom:S.xl,
            border:`1px solid ${C.brandM}`, fontSize:12, color:C.brand }}>
            💡 {tpl.reason}
          </div>
        )}

        {tpl.sections?.map((sec, i) => (
          <div key={i} style={{ marginBottom:S.xl }}>
            <div
              onClick={() => setOpen(p => ({ ...p, [i]: !p[i] }))}
              style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                background:C.surface2, borderRadius:R.md, padding:`${S.sm}px ${S.lg}px`,
                cursor:"pointer", border:`1px solid ${C.bgWarm}`, marginBottom: open[i] ? S.sm : 0 }}>
              <span style={{ fontSize:13, fontWeight:700, color:C.text1 }}>{sec.title}</span>
              <span style={{ fontSize:16, color:C.text3 }}>{open[i] ? "▲" : "▼"}</span>
            </div>
            {open[i] && (
              <div style={{ background:C.bg, borderRadius:R.md, padding:S.lg,
                fontSize:13, color:C.text2, lineHeight:1.8, border:`1px solid ${C.bgWarm}` }}>
                {sec.body}
              </div>
            )}
          </div>
        ))}

        {tpl.checklist && tpl.checklist.length > 0 && (
          <div style={{ marginBottom:S.xl }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.text3, marginBottom:S.sm }}>주요 내용</div>
            {tpl.checklist.map((item, i) => (
              <div key={i} style={{ display:"flex", gap:S.sm, alignItems:"flex-start",
                padding:`${S.sm}px 0`, borderBottom: i < tpl.checklist.length - 1 ? `1px solid ${C.bg}` : "none" }}>
                <span style={{ color:C.brand, fontSize:13, flexShrink:0, marginTop:2 }}>•</span>
                <span style={{ fontSize:13, color:C.text2, lineHeight:1.7 }}>
                  {typeof item === "string" ? item : item.label ?? item}
                </span>
              </div>
            ))}
          </div>
        )}

        {tpl.consentText && (
          <div style={{ background:C.surface2, borderRadius:R.lg, padding:S.lg,
            fontSize:13, color:C.text3, fontStyle:"italic", marginBottom:S.xl,
            border:`1px solid ${C.bgWarm}` }}>
            "{tpl.consentText}"
          </div>
        )}

        <button onClick={onClose}
          style={{ width:"100%", padding:S.lg, background:C.brand, color:"#fff",
            border:"none", borderRadius:R.lg, fontWeight:700, fontSize:14, cursor:"pointer",
            boxShadow:`0 4px 14px ${C.brand}44` }}>
          확인
        </button>
      </div>
    </div>
  );
}
