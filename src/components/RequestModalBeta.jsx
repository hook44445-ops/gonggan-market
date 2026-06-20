// RequestModalBeta — UX 편의성 고도화 Beta (견적요청 흐름 개선).
//   ⚠️ 표현 전용. History/Popstate/Validation/onDone/onClose/State 로직은 원본과 100% 동일(그대로 복사).
//   원본(RequestModal.jsx)은 보존되며, constants/release.UX_BETA=false 로 즉시 복구.
//   개선: 진행단계+완료표시 / 필수항목 강조 / 입력순서 정리 / 버튼 확대 / 터치영역 확대.
import { useState, useEffect, useRef } from "react";
import { C, R, S, SPACE_TYPES, STYLES } from "../constants";

export default function RequestModalBeta({ onClose, onDone, initialData = null, isEdit = false }) {
  // ── 로직(원본 동일) ────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);
  const closedByBackRef = useRef(false);

  useEffect(() => {
    window.history.pushState({ gmRequestModal: true }, "");
    const onPop = () => {
      if (stepRef.current > 1) {
        setStep((s) => Math.max(1, s - 1));
        window.history.pushState({ gmRequestModal: true }, "");
      } else {
        closedByBackRef.current = true;
        onClose?.();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!closedByBackRef.current) window.history.back();
    };
  }, []);

  const [form, setForm] = useState({
    type:   initialData?.type   ?? "",
    size:   initialData?.size   ?? "",
    budget: initialData?.budget ?? "",
    style:  initialData?.style  ?? "",
    desc:   initialData?.desc   ?? "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // ── 표현(Beta) ─────────────────────────────────────────────────────
  const iS = { width: "100%", padding: "15px 16px", border: `1.5px solid ${C.bgWarm}`,
    borderRadius: R.lg, fontSize: 15, outline: "none", boxSizing: "border-box",
    marginBottom: 14, fontFamily: "inherit", color: C.text1, background: C.surface, minHeight: 52 };

  const isCustomStyle = form.style === "기타" || (!STYLES.includes(form.style) && !!form.style);

  // 단계 메타 + 완료 표시(검증 조건은 원본과 동일)
  const steps = [
    { n: 1, label: "공간",       done: !!(form.type && form.size) },
    { n: 2, label: "예산·스타일", done: !!form.budget },
    { n: 3, label: "요청 내용",   done: !!form.desc },
  ];

  // 필수 라벨
  const Label = ({ children, required }) => (
    <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
      {children}
      {required && <span style={{ color: C.red, fontSize: 12, fontWeight: 800 }}>필수</span>}
    </div>
  );

  // 버튼 — 확대된 터치 영역
  const primaryBtn = (enabled) => ({
    flex: 1, padding: "17px", background: enabled ? C.brand : "#E8E4DC",
    color: "#fff", border: "none", borderRadius: R.lg, fontWeight: 800, fontSize: 16,
    minHeight: 56, cursor: enabled ? "pointer" : "not-allowed", transition: "background 0.2s",
  });
  const backBtn = {
    flex: "0 0 88px", padding: "17px", background: C.bg, color: C.text2,
    border: `1.5px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 15,
    minHeight: 56, cursor: "pointer",
  };
  const chip = (active) => ({
    padding: "11px 16px", borderRadius: R.full, fontSize: 14, fontWeight: 600, minHeight: 44,
    border: `1.5px solid ${active ? C.brand : C.bgWarm}`,
    background: active ? C.brandL : C.surface,
    color: active ? C.brand : C.text2, cursor: "pointer",
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.6)",
      display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}>
      <div style={{ position: "relative", background: C.surface, borderRadius: "24px 24px 0 0",
        width: "100%", maxWidth: 480, padding: "18px 24px 36px", maxHeight: "92vh", overflowY: "auto" }}>

        {/* 닫기(X) — 원본 동작 동일 */}
        <button onClick={() => onClose?.()} aria-label="닫기"
          style={{ position: "absolute", top: 14, right: 16, width: 36, height: 36, borderRadius: R.full,
            border: "none", background: C.bg, color: C.text2, fontSize: 18, lineHeight: 1, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 0, zIndex: 1 }}>✕</button>

        <div style={{ width: 36, height: 4, borderRadius: R.full, background: C.bgWarm, margin: "2px auto 18px" }} />

        {/* 진행단계 — 번호/완료체크 + 라벨 + 바 (스크롤 최소화 위해 컴팩트) */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {steps.map((s) => {
            const active = step >= s.n;
            const isCurrent = step === s.n;
            return (
              <div key={s.n} style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800,
                    background: s.done ? C.brand : active ? C.brandL : C.bgWarm,
                    color: s.done ? "#fff" : active ? C.brand : C.text3,
                  }}>{s.done && !isCurrent ? "✓" : s.n}</span>
                  <span style={{ fontSize: 11.5, fontWeight: isCurrent ? 800 : 600,
                    color: isCurrent ? C.text1 : C.text3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
                </div>
                <div style={{ height: 4, borderRadius: R.full, background: active ? C.brand : C.bgWarm, transition: "background 0.3s" }} />
              </div>
            );
          })}
        </div>

        {step === 1 && <>
          <div style={{ fontSize: 19, fontWeight: 800, color: C.text1, marginBottom: 4 }}>{isEdit ? "견적 요청 수정" : "어떤 공간인가요?"}</div>
          <div style={{ fontSize: 13, color: C.text3, marginBottom: S.xl }}>시공할 공간과 평수를 알려주세요</div>

          <Label required>공간 유형</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: S.xl }}>
            {SPACE_TYPES.map(t => (
              <button key={t} onClick={() => set("type", t)} style={chip(form.type === t)}>{t}</button>
            ))}
          </div>

          <Label required>평수</Label>
          <input placeholder="예: 32평" value={form.size} onChange={e => set("size", e.target.value)} style={iS} />

          <button onClick={() => form.type && form.size && setStep(2)} style={{ ...primaryBtn(!!(form.type && form.size)), width: "100%", flex: "none", marginTop: 4 }}>
            다음 →
          </button>
        </>}

        {step === 2 && <>
          <div style={{ fontSize: 19, fontWeight: 800, color: C.text1, marginBottom: 4 }}>예산과 스타일</div>
          <div style={{ fontSize: 13, color: C.text3, marginBottom: S.xl }}>희망 범위를 알려주세요 (스타일은 선택)</div>

          <Label required>희망 예산</Label>
          <input placeholder="예: 2,500~3,000만원" value={form.budget} onChange={e => set("budget", e.target.value)} style={iS} />

          <Label>선호 스타일</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: isCustomStyle ? S.md : S.xl }}>
            {STYLES.map(s => (
              <button key={s} onClick={() => set("style", s)} style={chip(form.style === s)}>{s}</button>
            ))}
            <button onClick={() => set("style", "기타")} style={chip(isCustomStyle)}>✏️ 기타</button>
          </div>
          {isCustomStyle && (
            <input
              placeholder="예: 빈티지, 한옥 모던, 컬러풀 팝아트..."
              value={form.style === "기타" ? "" : form.style}
              onChange={e => set("style", e.target.value)}
              autoFocus
              style={{ ...iS, marginBottom: S.xl }}
            />
          )}

          <div style={{ display: "flex", gap: S.sm }}>
            <button onClick={() => setStep(1)} style={backBtn}>← 이전</button>
            <button onClick={() => form.budget && setStep(3)} style={primaryBtn(!!form.budget)}>다음 →</button>
          </div>
        </>}

        {step === 3 && <>
          <div style={{ fontSize: 19, fontWeight: 800, color: C.text1, marginBottom: 4 }}>요청 내용</div>
          <div style={{ fontSize: 13, color: C.text3, marginBottom: S.xl }}>업체에게 전달할 내용을 입력해주세요</div>

          <Label required>요청 사항</Label>
          <textarea placeholder="예) 주방 확장, 욕실 2개 교체, 바닥재 전체 교체 원합니다." value={form.desc}
            onChange={e => set("desc", e.target.value)} rows={4}
            style={{ ...iS, minHeight: 110, resize: "none", lineHeight: 1.7, marginBottom: S.md }} />

          <div style={{ background: C.surface2, borderRadius: R.lg, padding: "12px 14px",
            marginBottom: S.sm, fontSize: 12, color: C.text3, lineHeight: 1.8 }}>
            🔒 <b style={{ color: C.brand }}>공간안전결제</b> — 토스페이먼츠가 공사대금을 안전하게 보호합니다<br/>
            단계별 안전정산 후 공사 완료 시 최종 지급 · 가상계좌 이용 시 이용료 660원
          </div>
          <div style={{ background: C.navyL, borderRadius: R.lg, padding: "12px 14px",
            marginBottom: S.xl, fontSize: 13, color: C.navy, fontWeight: 600,
            display: "flex", gap: 8, alignItems: "center" }}>
            <span>🛡</span>
            <span>인근 검증 업체에게만 공개 · 에스크로 안전 정산 적용</span>
          </div>

          <div style={{ display: "flex", gap: S.sm }}>
            <button onClick={() => setStep(2)} style={backBtn}>← 이전</button>
            <button onClick={() => form.desc && onDone(form)} style={primaryBtn(!!form.desc)}>{isEdit ? "✅ 수정 완료" : "🚀 견적 요청하기"}</button>
          </div>
          {!isEdit && (
            <div style={{ textAlign: "center", fontSize: 12, color: C.text3, marginTop: S.md }}>
              보통 2~4시간 내 연락드립니다.
            </div>
          )}
        </>}
      </div>
    </div>
  );
}
