import { useEffect, useMemo, useState } from "react";
import { C, R, S, SHADOW } from "../constants";
import { getLedgerEntries, addLedgerEntry, updateLedgerEntry, deleteLedgerEntry } from "../lib/supabase";
import {
  LEDGER_SOURCES, sourceLabel, buildLedgerRow, summarizeByMonth, profitOf, overMinorLimit,
  MINOR_WORK_LIMIT_WON, won, monthLabel,
} from "../lib/jobLedger";

// ════════════════════════════════════════════════════════════════════════════
// 내 작업 장부 — 업체가 공사마다 시간·자재비·받은 금액을 적고 월별 순이익을 본다(대표 09-28).
//   · 공간마켓 밖 공사(지인 공사 등)도 적는다 — «내가 한 시간에 얼마를 버는지»가 견적의 기준이 된다.
//   · 저장은 company_job_ledger(146) · 본인 행만. 표가 없거나(146 전) 로그인 토큰이 없으면 안내만 한다.
// ════════════════════════════════════════════════════════════════════════════

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const EMPTY = () => ({ title: "", work_date: today(), source: "acquaintance", hours: "", material_cost: "", revenue: "", memo: "" });

const errorText = (error) => {
  const m = String(error?.message ?? "");
  if (/LOGIN_REQUIRED|JWT|401/.test(m)) return "로그인이 풀렸어요 — 인증번호로 다시 로그인해 주세요";
  if (/company_job_ledger/.test(m)) return "장부 저장소가 아직 준비되지 않았어요(SQL 146)";
  return "저장하지 못했어요 — 잠시 뒤 다시 시도해 주세요";
};

const inputStyle = {
  width: "100%", boxSizing: "border-box", border: `1px solid ${C.bgWarm}`, borderRadius: R.md,
  padding: "10px 12px", fontSize: 14, color: C.text1, background: C.surface, outline: "none",
};
const labelStyle = { fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 5, display: "block" };

function Field({ label, children }) {
  return <label style={{ display: "block" }}><span style={labelStyle}>{label}</span>{children}</label>;
}

export default function JobLedgerScreen({ userId, onBack }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(null);          // null = 닫힘 · { ...값, id? }
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await getLedgerEntries(userId);
      if (!alive) return;
      if (error) setLoadError(errorText(error));
      else setEntries(data ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [userId]);

  const months = useMemo(() => summarizeByMonth(entries), [entries]);
  const set = (k) => (ev) => setForm(f => ({ ...f, [k]: ev.target.value }));

  const save = async () => {
    const { row, error } = buildLedgerRow(form);
    if (error) { setFormError(error); return; }
    setSaving(true);
    setFormError(null);
    const res = form.id ? await updateLedgerEntry(userId, form.id, row) : await addLedgerEntry(userId, row);
    setSaving(false);
    if (res.error || !res.data) { setFormError(errorText(res.error)); return; }
    setEntries(prev => {
      const rest = prev.filter(e => e.id !== res.data.id);
      return [res.data, ...rest].sort((a, b) => (a.work_date < b.work_date ? 1 : a.work_date > b.work_date ? -1 : 0));
    });
    setForm(null);
  };

  const remove = async () => {
    if (!form?.id || !window.confirm("이 기록을 지울까요?")) return;
    setSaving(true);
    const { error } = await deleteLedgerEntry(userId, form.id);
    setSaving(false);
    if (error) { setFormError(errorText(error)); return; }
    setEntries(prev => prev.filter(e => e.id !== form.id));
    setForm(null);
  };

  const preview = form ? buildLedgerRow(form).row : null;

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.md, marginBottom: S.lg }}>
        <button onClick={onBack} aria-label="뒤로가기"
          style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.text1, padding: 0 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>내 작업 장부</div>
          <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>지인 공사까지 적어 두면 내 시간당 순이익이 보여요</div>
        </div>
        {!form && !loadError && (
          <button onClick={() => { setForm(EMPTY()); setFormError(null); }}
            style={{ background: C.brand, color: "#fff", border: "none", borderRadius: R.full, padding: "9px 14px",
              fontSize: 13, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>+ 기록</button>
        )}
      </div>

      {loadError && (
        <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: S.lg, fontSize: 13, color: C.text2, lineHeight: 1.6 }}>
          {loadError}
        </div>
      )}

      {/* ── 입력 ── */}
      {form && (
        <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.xl, padding: S.lg,
          boxShadow: SHADOW.soft, display: "flex", flexDirection: "column", gap: S.md, marginBottom: S.xl }}>
          <Field label="작업 이름">
            <input value={form.title} onChange={set("title")} maxLength={80} placeholder="예: 욕실 수전 교체 · 방문 필름" style={inputStyle} />
          </Field>
          <div style={{ display: "flex", gap: S.sm }}>
            <div style={{ flex: 1 }}>
              <Field label="날짜"><input type="date" value={form.work_date} onChange={set("work_date")} style={inputStyle} /></Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="작업 시간">
                <input inputMode="decimal" value={form.hours} onChange={set("hours")} placeholder="예: 3.5" style={inputStyle} />
              </Field>
            </div>
          </div>
          <div>
            <span style={labelStyle}>어디서 받은 일</span>
            <div style={{ display: "flex", gap: 6 }}>
              {LEDGER_SOURCES.map(s => (
                <button key={s.key} type="button" onClick={() => setForm(f => ({ ...f, source: s.key }))}
                  aria-pressed={form.source === s.key}
                  style={{ flex: 1, padding: "8px 0", borderRadius: R.md, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    border: `1px solid ${form.source === s.key ? C.brand : C.bgWarm}`,
                    background: form.source === s.key ? C.brandL : C.surface, color: form.source === s.key ? C.brand : C.text2 }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: S.sm }}>
            <div style={{ flex: 1 }}>
              <Field label="받은 금액(원)">
                <input inputMode="numeric" value={form.revenue} onChange={set("revenue")} placeholder="150,000" style={inputStyle} />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="자재비(원)">
                <input inputMode="numeric" value={form.material_cost} onChange={set("material_cost")} placeholder="45,000" style={inputStyle} />
              </Field>
            </div>
          </div>
          <Field label="메모(어려웠던 점 · 다음에 챙길 것)">
            <textarea value={form.memo} onChange={set("memo")} maxLength={500} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </Field>

          {preview && (
            <div style={{ fontSize: 12.5, color: C.text2 }}>
              순이익 <b style={{ color: profitOf(preview) < 0 ? C.red : C.brand }}>{won(profitOf(preview))}</b>
              {preview.hours > 0 && <> · 시간당 {won(Math.round(profitOf(preview) / preview.hours))}</>}
            </div>
          )}
          {preview && overMinorLimit(preview) && (
            <div style={{ fontSize: 12, lineHeight: 1.55, color: "#5E4B18", background: "#FBF7EC", border: "1px solid #EADFC4", borderRadius: R.md, padding: "8px 11px" }}>
              공사 금액이 {won(MINOR_WORK_LIMIT_WON)} 이상이에요. 실내건축공사업 등록 없이 받을 수 있는 공사인지 먼저 확인해 주세요.
            </div>
          )}
          {formError && <div role="alert" style={{ fontSize: 12.5, color: C.red, fontWeight: 700 }}>{formError}</div>}

          <div style={{ display: "flex", gap: S.sm }}>
            {form.id && (
              <button onClick={remove} disabled={saving}
                style={{ padding: "11px 14px", borderRadius: R.md, border: `1px solid ${C.bgWarm}`, background: C.surface,
                  color: C.red, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>지우기</button>
            )}
            <button onClick={() => setForm(null)} disabled={saving}
              style={{ flex: 1, padding: "11px 0", borderRadius: R.md, border: `1px solid ${C.bgWarm}`, background: C.surface,
                color: C.text2, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>취소</button>
            <button onClick={save} disabled={saving}
              style={{ flex: 2, padding: "11px 0", borderRadius: R.md, border: "none", background: C.brand, color: "#fff",
                fontSize: 14, fontWeight: 800, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      )}

      {loading && <div style={{ fontSize: 13, color: C.text3, padding: S.lg, textAlign: "center" }}>불러오는 중…</div>}

      {!loading && !loadError && entries.length === 0 && !form && (
        <div style={{ background: C.surface, border: `1px dashed ${C.bgWarm}`, borderRadius: R.xl, padding: S.xl, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>첫 작업을 적어 보세요</div>
          <div style={{ fontSize: 12.5, color: C.text3, marginTop: 6, lineHeight: 1.6 }}>
            걸린 시간 · 자재비 · 받은 금액만 적으면<br />한 달 순이익과 시간당 순이익을 계산해 드려요.
          </div>
        </div>
      )}

      {/* ── 월별 ── */}
      {months.map(m => (
        <div key={m.month} style={{ marginBottom: S.xl }}>
          <div style={{ background: C.brandL, border: `1px solid ${C.brandM}`, borderRadius: R.lg, padding: S.md, marginBottom: S.sm }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>{monthLabel(m.month)} · {m.count}건</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: m.profit < 0 ? C.red : C.brand }}>{won(m.profit)}</div>
            </div>
            <div style={{ fontSize: 11.5, color: C.text2, marginTop: 4 }}>
              받은 금액 {won(m.revenue)} · 자재비 {won(m.material)}
              {m.profitPerHour != null && <> · 시간당 {won(m.profitPerHour)}</>}
            </div>
          </div>
          {entries.filter(e => String(e.work_date).startsWith(m.month)).map(e => (
            <div key={e.id} role="button" tabIndex={0}
              onClick={() => { setForm({ ...e, hours: e.hours || "", material_cost: e.material_cost || "", revenue: e.revenue || "", memo: e.memo ?? "" }); setFormError(null); window.scrollTo?.(0, 0); }}
              style={{ display: "flex", alignItems: "center", gap: S.md, padding: `${S.md}px ${S.xs}px`, borderBottom: `1px solid ${C.bgWarm}`, cursor: "pointer" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
                <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2 }}>
                  {String(e.work_date).slice(5).replace("-", ".")} · {sourceLabel(e.source)}{Number(e.hours) > 0 ? ` · ${e.hours}시간` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: profitOf(e) < 0 ? C.red : C.text1 }}>{won(profitOf(e))}</div>
                <div style={{ fontSize: 11, color: C.text3 }}>받은 {won(e.revenue)}</div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
