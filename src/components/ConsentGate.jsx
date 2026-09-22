import { useState } from "react";
import { C, R, S } from "../constants";
import { DOCUMENT_TEMPLATES } from "../constants/documentTemplates";
import { SHOW_BETA_UI } from "../constants/release";
import { GATE_CONTENT, GateBody, hasBetaAck, markBetaAck } from "./beta/BetaUI";

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

function Check({ on, size = 22 }) {
  return (
    <span aria-hidden style={{
      width: size, height: size, borderRadius: size > 24 ? 9 : 6, flexShrink: 0,
      background: on ? C.brand : C.surface, border: `2px solid ${on ? C.brand : C.bgWarm}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontSize: size > 24 ? 15 : 12, fontWeight: 900, transition: "background .15s",
    }}>{on ? "✓" : ""}</span>
  );
}

// 약관 동의 — 한 장에서 끝낸다.
//  · 맨 위 「전체 동의」 한 번이면 모든 문서·모든 확인 항목이 체크된다.
//  · 문서마다 한 줄로 접혀 있고, 「보기」로 펼치면 요점·확인 항목을 하나씩 볼 수 있다.
//  · 모두 필수 — 하나라도 빠지면 계속 버튼이 잠긴다(기존 저장 방식 그대로).
export default function ConsentGate({ requiredTypes, userId, title, onComplete, onClose, betaKind = null }) {
  // 베타 안내(앱 안 안전결제 미제공 등)도 같은 장에서 한 번에 확인한다 — 따로 뜨던 확인 창을 합침.
  const needBeta = !!betaKind && SHOW_BETA_UI && !hasBetaAck(betaKind);
  const beta = needBeta ? GATE_CONTENT[betaKind] ?? GATE_CONTENT.quote : null;
  const templates = [
    ...requiredTypes.map(type => DOCUMENT_TEMPLATES.find(t => t.type === type)).filter(Boolean),
    ...(beta ? [{ type: `beta_${betaKind}`, title: "베타 서비스 이용 안내", beta }] : []),
  ];

  const allKeys = templates.flatMap((tpl, ti) => {
    const items = tpl.checklist ?? [];
    return items.length ? items.map((_, i) => `${ti}_${i}`) : [`${ti}_doc`];
  });
  const [checked, setChecked] = useState({});
  const [openIdx, setOpenIdx] = useState(null);

  if (!templates.length) return null;

  const keysOf = (ti) => {
    const items = templates[ti].checklist ?? [];
    return items.length ? items.map((_, i) => `${ti}_${i}`) : [`${ti}_doc`];
  };
  const docDone = (ti) => keysOf(ti).every(k => checked[k]);
  const allChecked = allKeys.every(k => checked[k]);
  const setMany = (keys, v) => setChecked(p => { const n = { ...p }; keys.forEach(k => { n[k] = v; }); return n; });

  const handleDone = () => {
    if (!allChecked) return;
    saveConsents(userId, requiredTypes);
    if (needBeta) markBetaAck(betaKind);
    onComplete?.();
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.72)",
        display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 600 }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={{
        background: C.surface, borderRadius: "24px 24px 0 0",
        width: "100%", maxWidth: 480,
        padding: "20px 20px 28px", maxHeight: "88vh", overflowY: "auto",
      }}>
        <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: "0 auto 18px" }} />

        {title && <div style={{ fontSize: 13, color: C.text3, marginBottom: 3 }}>{title}</div>}
        <div style={{ fontSize: 19, fontWeight: 900, color: C.text1, letterSpacing: "-0.4px" }}>
          시작하기 전에, 약속 {templates.length}가지만 확인해 주세요
        </div>
        <div style={{ fontSize: 12.5, color: C.text3, marginTop: 4, lineHeight: 1.6 }}>
          안전한 견적·계약을 위해 꼭 필요한 내용만 담았어요.
        </div>

        {/* 전체 동의 */}
        <button onClick={() => setMany(allKeys, !allChecked)}
          style={{ marginTop: S.lg, width: "100%", display: "flex", alignItems: "center", gap: S.md,
            padding: `${S.lg}px`, borderRadius: R.lg, cursor: "pointer", textAlign: "left",
            background: allChecked ? C.brandL : C.bg, border: `1.5px solid ${allChecked ? C.brand : C.bgWarm}` }}>
          <Check on={allChecked} size={28} />
          <div>
            <div style={{ fontSize: 15.5, fontWeight: 900, color: C.text1 }}>네, 모두 동의해요</div>
            <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>아래 필수 항목에 한 번에 동의합니다</div>
          </div>
        </button>

        {/* 문서별 — 한 줄씩 접힘 */}
        <div style={{ marginTop: S.md, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, overflow: "hidden" }}>
          {templates.map((tpl, ti) => {
            const open = openIdx === ti;
            const done = docDone(ti);
            const items = tpl.checklist ?? [];
            return (
              <div key={tpl.type} style={{ borderTop: ti ? `1px solid ${C.bgWarm}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: S.md, padding: `${S.md}px ${S.md}px` }}>
                  <button onClick={() => setMany(keysOf(ti), !done)} aria-label={`${tpl.title} 동의`}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" }}>
                    <Check on={done} />
                  </button>
                  <button onClick={() => setMany(keysOf(ti), !done)}
                    style={{ flex: 1, background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer",
                      fontSize: 13.5, fontWeight: 700, color: C.text1 }}>
                    <span style={{ color: C.brand, fontWeight: 800, marginRight: 4 }}>[필수]</span>{tpl.title}
                  </button>
                  <button onClick={() => setOpenIdx(open ? null : ti)} aria-expanded={open}
                    style={{ background: "none", border: "none", padding: "4px 2px", cursor: "pointer",
                      fontSize: 12, fontWeight: 700, color: C.text3, whiteSpace: "nowrap" }}>
                    {open ? "접기 ▲" : "보기 ▼"}
                  </button>
                </div>
                {open && tpl.beta && (
                  <div style={{ padding: `0 ${S.md}px ${S.md}px ${S.md}px` }}>
                    <div style={{ fontSize: 12.5, color: C.text3, marginBottom: S.sm, lineHeight: 1.6 }}>{tpl.beta.intro}</div>
                    <GateBody c={tpl.beta} />
                  </div>
                )}
                {open && !tpl.beta && (
                  <div style={{ padding: `0 ${S.md}px ${S.md}px ${S.md + 34}px` }}>
                    {tpl.reason && (
                      <div style={{ fontSize: 12, color: C.brand, background: C.brandL, borderRadius: R.md,
                        padding: `${S.sm}px ${S.md}px`, lineHeight: 1.65, marginBottom: S.sm }}>💡 {tpl.reason}</div>
                    )}
                    {tpl.sections?.slice(0, 1).map((sec, i) => (
                      <div key={i} style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.75, marginBottom: S.sm }}>
                        <b style={{ color: C.text1 }}>{sec.title}</b><br />{sec.body}
                      </div>
                    ))}
                    {items.map((item, i) => {
                      const key = `${ti}_${i}`;
                      const label = typeof item === "string" ? item : item.label ?? item;
                      return (
                        <button key={key} onClick={() => setChecked(p => ({ ...p, [key]: !p[key] }))}
                          style={{ display: "flex", gap: S.sm, alignItems: "flex-start", width: "100%", background: "none",
                            border: "none", padding: `${S.xs + 2}px 0`, cursor: "pointer", textAlign: "left" }}>
                          <Check on={!!checked[key]} size={18} />
                          <span style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.6 }}>{label}</span>
                        </button>
                      );
                    })}
                    {tpl.consentText && <div style={{ fontSize: 11.5, color: C.text4, marginTop: S.xs, lineHeight: 1.6 }}>{tpl.consentText}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: S.sm, marginTop: S.lg }}>
          <button
            onClick={handleDone}
            disabled={!allChecked}
            style={{
              width: "100%", height: 54, background: allChecked ? C.brand : C.bgWarm,
              color: allChecked ? "#fff" : C.text4, border: "none", borderRadius: R.lg,
              fontWeight: 800, fontSize: 15.5, cursor: allChecked ? "pointer" : "not-allowed",
              boxShadow: allChecked ? `0 4px 14px ${C.brand44}` : "none", transition: "background .15s",
            }}>
            {allChecked ? "동의하고 계속하기" : "필수 항목에 동의해 주세요"}
          </button>
          <button onClick={onClose}
            style={{ width: "100%", padding: S.md, background: "none", color: C.text3,
              border: "none", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
            나중에
          </button>
        </div>
      </div>
    </div>
  );
}
