import { useEffect, useMemo, useState } from "react";
import { C, R, S } from "../constants";
import { getHomeCareItems, addHomeCareItem, updateHomeCareItem, deleteHomeCareItem } from "../lib/supabase";
import { HOME_CARE_PRESETS, careStatus, careLine, sortCare, buildCareRow, QUICK_SETUP_KINDS, QUICK_WHEN, quickSetupRows } from "../lib/homeCare";
import { requestPrefillFromPost } from "../lib/loungeToRequest";
import { kstDay } from "../lib/pageViews";
import { requestReauth } from "../components/TokenNeededNote";


// 내 집 관리 수첩(165 · 대표 09-29 「1등 재방문」) — 언제 무엇을 했는지 적어 두면 다음 시기를 알려 준다.
//   본인 것만(로그인 토큰). 시기가 되면 알림함으로 한 번 · 여기서 «견적 비교해 보기»로 이어진다(작은 글씨 — 광고 버튼 아님).
const EMPTY = () => ({ kind: null, label: "", cycle_months: "", done_on: kstDay(), memo: "" });
const BADGE = { due: { t: "시기 됨", bg: "#FBE9E4", c: "#B4432F" }, soon: { t: "곧", bg: "#FFF4DC", c: "#8A6A12" }, ok: null };

export default function HomeCareScreen({ userId, onBack, onRequest }) {
  const [items, setItems] = useState([]);
  const [state, setState] = useState({ loading: true, error: null });
  const [form, setForm] = useState(null);
  const [formErr, setFormErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [quick, setQuick] = useState({});      // 30초 설정 답 { kind: recent|year|unknown|skip }
  const [quickErr, setQuickErr] = useState(null);
  const today = kstDay();

  useEffect(() => {
    let alive = true;
    getHomeCareItems(userId).then(({ data, error }) => {
      if (!alive) return;
      if (error) {
        const m = String(error.message ?? "");
        setState({ loading: false, error: /home_care_items/.test(m) ? "아직 준비 중이에요(SQL 165)" : /LOGIN_REQUIRED|JWT/.test(m) ? "로그인이 풀렸어요 — 다시 로그인해 주세요" : "불러오지 못했어요" });
        return;
      }
      setItems(data ?? []); setState({ loading: false, error: null });
    }).catch(() => alive && setState({ loading: false, error: "불러오지 못했어요" }));
    return () => { alive = false; };
  }, [userId]);

  const sorted = useMemo(() => sortCare(items, today), [items, today]);

  const save = async () => {
    const { row, error } = buildCareRow(form);
    if (error) { setFormErr(error); return; }
    setBusy(true); setFormErr(null);
    const res = form.id ? await updateHomeCareItem(userId, form.id, row) : await addHomeCareItem(userId, row);
    setBusy(false);
    if (res?.error || !res?.data) { setFormErr("저장하지 못했어요 · 잠시 뒤 다시"); return; }
    setItems((prev) => form.id ? prev.map((x) => (x.id === form.id ? res.data : x)) : [res.data, ...prev]);
    setForm(null);
  };
  // 30초 설정 — 고른 것만 한꺼번에 적는다(하나라도 실패하면 된 것만 남기고 안내)
  const saveQuick = async () => {
    const rows = quickSetupRows(quick, today);
    if (!rows.length) { setQuickErr("하나 이상 골라 주세요"); return; }
    setBusy(true); setQuickErr(null);
    const saved = [];
    for (const r of rows) {
      const res = await addHomeCareItem(userId, r).catch(() => null);
      if (res?.data) saved.push(res.data);
    }
    setBusy(false);
    if (saved.length) setItems((prev) => [...saved, ...prev]);
    if (saved.length < rows.length) setQuickErr("몇 개는 적지 못했어요 · 아래 «+ 집 관리 기록 추가»로 적을 수 있어요");
  };
  const doneToday = async (it) => {
    const res = await updateHomeCareItem(userId, it.id, { done_on: today });
    if (!res?.error && res?.data) setItems((prev) => prev.map((x) => (x.id === it.id ? res.data : x)));
  };
  const remove = async (it) => {
    if (!window.confirm(`«${it.label}» 기록을 지울까요?`)) return;
    const res = await deleteHomeCareItem(userId, it.id);
    if (!res?.error) setItems((prev) => prev.filter((x) => x.id !== it.id));
  };

  const input = { width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: R.md, border: `1px solid ${C.bgWarm}`, fontSize: 14.5, fontFamily: "inherit", color: C.text1, background: C.surface };
  const lbl = { fontSize: 12.5, fontWeight: 700, color: C.text2, margin: "12px 0 6px" };

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.md, marginBottom: S.lg }}>
        <button onClick={onBack} aria-label="뒤로가기" style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.text1, padding: 0 }}>←</button>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>내 집 관리 수첩</div>
          <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>언제 했는지 적어 두면 다음에 살펴볼 때를 알려 드려요</div>
        </div>
      </div>

      {state.loading && <div style={{ fontSize: 13, color: C.text3, padding: S.lg, textAlign: "center" }}>불러오는 중…</div>}
      {state.error && (
        <div style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: S.lg, fontSize: 13, color: C.text2 }}>
          {state.error}
          {/로그인/.test(state.error) && (
            <button onClick={requestReauth} style={{ display: "block", marginTop: 10, border: 0, borderRadius: R.md, padding: "9px 12px", background: C.brand, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>인증번호로 다시 로그인</button>
          )}
        </div>
      )}

      {!state.loading && !state.error && (
        <>
          {sorted.length === 0 && !form && (
            <div style={{ background: C.surface, border: `1.5px solid ${C.brandM}`, borderRadius: R.lg, padding: "14px 14px 16px" }}>
              <img src="/images/empty/home-care.webp" alt="" aria-hidden="true" width="720" height="480" onError={(e) => { e.currentTarget.style.display = "none"; }}
                style={{ width: "100%", maxWidth: 300, height: "auto", display: "block", margin: "0 auto 8px", borderRadius: 14 }} />
              <div style={{ fontSize: 15, fontWeight: 900, color: C.text1 }}>⏱ 30초 설정</div>
              <div style={{ fontSize: 12.5, color: C.text2, marginTop: 3, lineHeight: 1.6 }}>
                마지막으로 언제 했는지 대략 고르면, 다음에 살펴볼 때 알려 드려요. 모르면 «잘 모름» — 한 달 뒤에 알려 드려요.
              </div>
              {QUICK_SETUP_KINDS.map((kind) => {
                const p = HOME_CARE_PRESETS.find((x) => x.kind === kind);
                return (
                  <div key={kind} style={{ marginTop: S.md }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text1, marginBottom: 6 }}>{p.label}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {[...QUICK_WHEN, { key: "skip", label: "안 해요" }].map((w) => {
                        const on = quick[kind] === w.key;
                        return (
                          <button key={w.key} onClick={() => setQuick((q) => ({ ...q, [kind]: on ? undefined : w.key }))} aria-pressed={on}
                            style={{ padding: "7px 11px", borderRadius: R.full, border: `1.5px solid ${on ? C.brand : C.bgWarm}`, background: on ? C.brandL : C.surface,
                              color: on ? C.brand : C.text2, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{w.label}</button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {quickErr && <div style={{ fontSize: 12.5, color: "#B4432F", fontWeight: 700, marginTop: 10 }}>{quickErr}</div>}
              <button onClick={saveQuick} disabled={busy}
                style={{ marginTop: S.lg, width: "100%", padding: 13, borderRadius: R.md, border: "none", background: C.brand, color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: busy ? "wait" : "pointer" }}>
                {busy ? "적는 중…" : "수첩 만들기"}
              </button>
            </div>
          )}
          {sorted.map((it) => {
            const st = careStatus(it, today);
            const b = BADGE[st.state];
            const prefill = st.state !== "ok" && onRequest ? requestPrefillFromPost({ title: it.label, content: it.label }) : null;
            return (
              <div key={it.id} style={{ background: C.surface, border: `1px solid ${st.state === "due" ? "#E9B8AC" : C.bgWarm}`, borderRadius: R.lg, padding: "12px 14px", marginTop: S.sm }}>
                <div style={{ display: "flex", alignItems: "center", gap: S.sm }}>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 800, color: C.text1 }}>{it.label}</div>
                  {b && <span style={{ fontSize: 11.5, fontWeight: 800, color: b.c, background: b.bg, borderRadius: R.full, padding: "3px 8px" }}>{b.t}</span>}
                </div>
                <div style={{ fontSize: 12.5, color: C.text2, marginTop: 4 }}>
                  {it.done_on} 에 함 · {it.cycle_months}개월마다 · <b>{careLine(st)}</b>
                </div>
                {it.memo && <div style={{ fontSize: 12, color: C.text3, marginTop: 3 }}>{it.memo}</div>}
                <div style={{ display: "flex", gap: S.md, marginTop: 8, flexWrap: "wrap" }}>
                  <button onClick={() => doneToday(it)} style={{ background: "none", border: "none", padding: 0, color: C.brand, fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>오늘 했어요</button>
                  <button onClick={() => { setFormErr(null); setForm({ ...it, cycle_months: String(it.cycle_months), memo: it.memo ?? "" }); }} style={{ background: "none", border: "none", padding: 0, color: C.text2, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>고치기</button>
                  <button onClick={() => remove(it)} style={{ background: "none", border: "none", padding: 0, color: C.text3, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>지우기</button>
                  {prefill && <button onClick={() => onRequest(prefill)} style={{ background: "none", border: "none", padding: 0, color: C.text3, fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>견적 비교해 보기</button>}
                </div>
              </div>
            );
          })}

          {form ? (
            <div style={{ background: C.surface, border: `1.5px solid ${C.brand}`, borderRadius: R.lg, padding: "14px 14px 16px", marginTop: S.lg }}>
              {!form.id && (
                <>
                  <div style={{ ...lbl, marginTop: 0 }}>무엇을 했나요</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {HOME_CARE_PRESETS.map((p) => (
                      <button key={p.kind} onClick={() => setForm((f) => ({ ...f, kind: p.kind, label: p.label, cycle_months: String(p.cycle) }))}
                        style={{ padding: "6px 10px", borderRadius: R.full, border: `1.5px solid ${form.kind === p.kind ? C.brand : C.bgWarm}`, background: form.kind === p.kind ? C.brandL : C.surface, color: form.kind === p.kind ? C.brand : C.text2, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{p.label}</button>
                    ))}
                  </div>
                </>
              )}
              <div style={lbl}>이름</div>
              <input style={input} value={form.label} maxLength={30} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value, kind: f.id ? f.kind : null }))} placeholder="예: 욕실 실리콘" />
              <div style={{ display: "flex", gap: S.sm }}>
                <div style={{ flex: 1 }}>
                  <div style={lbl}>한 날짜</div>
                  <input type="date" style={input} value={form.done_on} max={today} onChange={(e) => setForm((f) => ({ ...f, done_on: e.target.value }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={lbl}>주기(개월)</div>
                  <input style={input} inputMode="numeric" value={form.cycle_months} onChange={(e) => setForm((f) => ({ ...f, cycle_months: e.target.value.replace(/\D/g, "").slice(0, 3) }))} placeholder="24" />
                </div>
              </div>
              <div style={lbl}>메모(선택)</div>
              <input style={input} value={form.memo} maxLength={200} onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))} placeholder="예: 방곰팡이 실리콘 · ○○업체" />
              <div style={{ fontSize: 11.5, color: C.text3, marginTop: 6 }}>주기는 흔히 권하는 값이에요. 집·자재에 따라 바꿔 적으세요.</div>
              {formErr && <div style={{ fontSize: 13, color: "#B4432F", fontWeight: 700, marginTop: 8 }}>{formErr}</div>}
              <div style={{ display: "flex", gap: S.sm, marginTop: S.md }}>
                <button onClick={() => setForm(null)} style={{ flex: 1, padding: 12, borderRadius: R.md, border: `1px solid ${C.bgWarm}`, background: C.surface, color: C.text2, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>닫기</button>
                <button onClick={save} disabled={busy} style={{ flex: 2, padding: 12, borderRadius: R.md, border: "none", background: C.brand, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>{busy ? "저장 중…" : "저장"}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setFormErr(null); setForm(EMPTY()); }}
              style={{ marginTop: S.lg, width: "100%", padding: 14, borderRadius: R.lg, border: `1.5px dashed ${C.brand}`, background: C.brandL, color: C.brand, fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}>
              + 집 관리 기록 추가
            </button>
          )}
        </>
      )}
    </div>
  );
}
