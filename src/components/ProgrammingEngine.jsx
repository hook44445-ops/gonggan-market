// ════════════════════════════════════════════════════════════════════
// ProgrammingEngine — 편성국 (Daily Programming Engine V2 · Phase 34)
//
//   기본 편성(고정 🔒) + 그룹 + 편성타입 + 시간 + 설명 + 메모 + 커스텀 추가 + 주간통계 + 검증 +
//   오늘 미리보기. 고정편성은 삭제/순서변경/OFF 불가 — 추가만 가능.
//   ⚠️ 기존 Daily Editorial 무수정 · 읽기+커스텀/메모(localStorage)만(additive). Regression Zero.
// ════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { C, R, S } from "../constants";
import {
  programmingBoard, todayPreview, weeklyStats, validateProgram,
  addCustomProgram, removeCustomProgram, CUSTOM_PRESETS, setMemo, getMemos, PROGRAM_TYPE_COLOR,
} from "../lib/programmingEngine";
import { CATEGORY_ROUTES } from "../lib/workflowEngine";

export default function ProgrammingEngine({ published = [], showToast }) {
  const [tick, setTick] = useState(0);
  const [memos, setMemos] = useState(() => getMemos());
  const [customLabel, setCustomLabel] = useState("");
  const refresh = () => setTick((t) => t + 1);
  void tick;

  const board = programmingBoard();
  const preview = todayPreview({ published });
  const weekly = weeklyStats(published);
  const val = validateProgram({ published });
  const box = { background: "#fff", borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}`, marginBottom: S.xl };
  const typeBadge = (t) => <span style={{ padding: "1px 7px", borderRadius: R.full, fontSize: 9, fontWeight: 800, background: (PROGRAM_TYPE_COLOR[t] || "#6b7280") + "22", color: PROGRAM_TYPE_COLOR[t] || "#6b7280" }}>{t}</span>;

  const saveMemo = (id, text) => { setMemo(id, text); showToast?.("메모 저장됨"); };
  const addPreset = (p) => { addCustomProgram(p); refresh(); showToast?.(`"${p.label}" 편성 추가됨`); };
  const addCustom = () => { if (!customLabel.trim()) return; addCustomProgram({ label: customLabel.trim(), group: "day", time: "낮", type: "일반" }); setCustomLabel(""); refresh(); showToast?.("커스텀 편성 추가됨"); };
  const remove = (id) => { removeCustomProgram(id); refresh(); showToast?.("커스텀 편성 삭제됨"); };

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: 4 }}>🗂️ 편성국 (Daily Programming)</div>
      <div style={{ fontSize: 12, color: C.text3, marginBottom: S.lg, lineHeight: 1.6 }}>
        공간라운지의 <b>기본 편성 시스템</b>입니다. 🔒 고정편성(큐티·인도점성술·Morning Brief·긴급뉴스·공간마켓·연재·Time Trend)은
        <b> 삭제·순서변경·OFF 불가</b> — 안정적으로 깔고 갑니다. 필요한 편성만 <b>추가</b>합니다.
      </div>

      {/* Phase 57 — Category Router: 카테고리 → Fusion/Writer/Research/SEO/Image 파이프라인 */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>🧭 Category Router (카테고리별 파이프라인 연결)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Object.values(CATEGORY_ROUTES).map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11, borderBottom: `1px solid ${C.bg}`, paddingBottom: 5 }}>
              <span style={{ minWidth: 96, fontWeight: 800, color: C.text1 }}>{r.label}</span>
              <span style={{ color: C.text2 }}>
                {[r.fusion, r.writer, r.research, r.seo, r.image].filter(Boolean).map((s, i, arr) => (
                  <span key={s + i}>
                    <span style={{ background: C.bg, borderRadius: R.full, padding: "2px 8px", border: `1px solid ${C.bgWarm}` }}>{s}</span>
                    {i < arr.length - 1 && <span style={{ color: C.text4 }}> → </span>}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: C.text3, marginTop: 6 }}>주제→카테고리 판별 후 각 카테고리에 맞는 Fusion·Writer·Research·SEO·Image 엔진으로 라우팅됩니다.</div>
      </div>

      {/* 오늘 미리보기 */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>
          👀 오늘 편성 미리보기 <span style={{ fontSize: 11, color: C.text3, fontWeight: 600 }}>(발행 {preview.publishedToday} / 상한 {preview.cap} · 잔여 {preview.remaining})</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {preview.rows.map((r) => (
            <span key={r.typeId} style={{ fontSize: 10.5, background: C.bg, borderRadius: R.full, padding: "3px 9px", border: `1px solid ${C.bgWarm}`, color: C.text2 }}>
              {r.icon} {r.label} {r.done}/{r.quota}
            </span>
          ))}
        </div>
      </div>

      {/* 편성 검증 */}
      <div style={{ ...box, background: val.ok ? "#fff" : "#fffdf5" }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>🧪 편성 검증 {val.ok ? "✅ 정상" : "⚠️ 확인 필요"}</div>
        {val.issues.length === 0 ? <div style={{ fontSize: 11.5, color: C.text3 }}>중복·시간 충돌·빈 슬롯 없음.</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {val.issues.map((i, idx) => (
              <div key={idx} style={{ fontSize: 11.5, color: i.level === "mid" ? C.gold : C.text3 }}>
                {i.level === "mid" ? "⚠️" : "•"} {i.message}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 편성 그룹 */}
      {board.groups.map((g) => (
        <div key={g.id} style={box}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: 2 }}>{g.label}</div>
          <div style={{ fontSize: 10.5, color: C.text3, marginBottom: S.sm }}>{g.desc}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {g.entries.map((e) => (
              <div key={e.typeId} style={{ background: C.bg, borderRadius: R.md, padding: "9px 11px", border: `1px solid ${C.bgWarm}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, color: C.text1, fontSize: 12 }}>{e.icon} {e.label}</span>
                  <span style={{ fontSize: 10.5, color: C.text3 }}>🕐 {e.time}</span>
                  {typeBadge(e.type)}
                  {e.locked ? <span style={{ fontSize: 10, color: C.text4 }}>🔒 고정</span> : (
                    <button onClick={() => remove(e.typeId)} style={{ marginLeft: "auto", padding: "2px 8px", background: "#fff", color: C.red, border: `1px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 9.5, fontWeight: 700, cursor: "pointer" }}>삭제</button>
                  )}
                </div>
                {e.desc && <div style={{ fontSize: 10.5, color: C.text3, marginTop: 3 }}>{e.desc}</div>}
                {/* 관리자 메모 */}
                <input
                  value={memos[e.typeId] ?? e.memo ?? ""}
                  onChange={(ev) => setMemos({ ...memos, [e.typeId]: ev.target.value })}
                  onBlur={(ev) => saveMemo(e.typeId, ev.target.value)}
                  placeholder="운영 메모 (예: 신문사설 먼저 → 매세지 → SEO)"
                  style={{ width: "100%", marginTop: 6, padding: "5px 8px", borderRadius: R.sm, border: `1px solid ${C.bgWarm}`, fontSize: 10.5, boxSizing: "border-box", fontFamily: "inherit", background: "#fff" }} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 새 콘텐츠 추가 */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>➕ 새 콘텐츠 추가 (커스텀 편성)</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: S.sm }}>
          {CUSTOM_PRESETS.map((p) => (
            <button key={p.label} onClick={() => addPreset(p)} style={{ padding: "6px 12px", background: C.brandL, color: C.brandD, border: `1px solid ${C.brandM}`, borderRadius: R.full, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>+ {p.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="직접 입력 (예: 오늘 과학)" onKeyDown={(e) => e.key === "Enter" && addCustom()}
            style={{ flex: "1 1 200px", padding: "8px 10px", borderRadius: R.md, border: `1px solid ${C.bgWarm}`, fontSize: 12, boxSizing: "border-box", fontFamily: "inherit" }} />
          <button onClick={addCustom} style={{ padding: "8px 14px", background: C.brand, color: "#fff", border: "none", borderRadius: R.md, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>추가</button>
        </div>
      </div>

      {/* 주간 통계 */}
      <div style={box}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, marginBottom: S.sm }}>📊 이번주 편성 통계 (최근 7일)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {weekly.map((w) => (
            <div key={w.typeId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
              <span style={{ color: C.text2, minWidth: 130 }}>{w.label}</span>
              <div style={{ flex: 1, height: 6, background: C.bg, borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, w.count * 14)}%`, height: "100%", background: C.brand }} />
              </div>
              <span style={{ fontWeight: 800, color: C.text1, minWidth: 18, textAlign: "right" }}>{w.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
