// RequestModalBeta — UX 편의성 고도화 Beta (견적요청 흐름 개선).
//   ⚠️ 표현 전용. History/Popstate/Validation/onDone/onClose/State 로직은 원본과 100% 동일(그대로 복사).
//   원본(RequestModal.jsx)은 보존되며, constants/release.UX_BETA=false 로 즉시 복구.
//   개선: 진행단계+완료표시 / 필수항목 강조 / 입력순서 정리 / 버튼 확대 / 터치영역 확대.
import { useState, useEffect, useRef } from "react";
import { C, R, S, SPACE_TYPES, STYLES } from "../constants";
import { SHOW_BETA_UI } from "../constants/release"; // 베타면 결제 약속 대신 «기록이 남는다»를 말한다(정식 전환 시 원문 복귀)
import { BetaGateModal, BetaBanner, hasBetaAck } from "./beta/BetaUI"; // 베타 안내(Add Only · SHOW_BETA_UI 게이트)

// 고르기 쉬운 입력 — 사진으로 고르고, 자주 쓰는 값은 한 번에 누른다. (직접 입력도 그대로 된다)
const SPACE_IMG = {
  "아파트 전체": "/images/living.webp", "아파트 부분": "/images/kitchen.webp", "원룸/오피스텔": "/images/space-officetel.webp",
  "카페/식당": "/images/cafe.webp", "오피스": "/images/space-office.webp", "상가": "/images/space-shop.webp",
};
const STYLE_IMG = {
  "모던 미니멀": "/images/style-minimal.webp", "북유럽 감성": "/images/style-nordic.webp", "인더스트리얼": "/images/style-industrial.webp",
  "내추럴 우드": "/images/style-wood.webp", "럭셔리 클래식": "/images/style-classic.webp",
};
// 분위기 사진은 공간 유형을 따라간다 — 카페를 고쳐야 하는 사람에게 거실 사진을 보이지 않는다(힉스필드 · 2026-09-23).
//   주거(아파트 전체·부분·원룸/오피스텔)는 위 STYLE_IMG(거실) 그대로.
const STYLE_KEY = { "모던 미니멀": "minimal", "북유럽 감성": "nordic", "인더스트리얼": "industrial", "내추럴 우드": "wood", "럭셔리 클래식": "classic" };
const STYLE_GROUP = { "카페/식당": "cafe", "오피스": "office", "상가": "shop" };
export const styleImgFor = (spaceType, style) => {
  const g = STYLE_GROUP[spaceType];
  return g && STYLE_KEY[style] ? `/images/style/${g}-${STYLE_KEY[style]}.webp` : STYLE_IMG[style];
};
const SIZE_QUICK = ["10평대", "20평대", "30평대", "40평 이상"];
const BUDGET_QUICK = ["1,000만원 이하", "1,000~3,000만원", "3,000~5,000만원", "5,000만원 이상", "상담 후 결정"];
// 자주 찾는 공사는 먼저, 나머지는 「더 보기」 — 칩이 한꺼번에 스무 개 넘게 서면 요청서가 무거워진다.
// ⚠ 고름 판정이 본문 부분일치(form.desc.includes)라, 서로의 일부가 되는 이름을 넣지 않는다.
const WORK_TAGS = ["철거", "도배", "바닥", "필름", "욕실", "주방", "타일", "페인트", "조명·전기", "창호"];
const MORE_WORK_TAGS = ["중문", "도어", "몰딩", "붙박이장·가구", "방수", "누수·배관", "줄눈", "탄성코트", "발코니 확장", "단열", "블라인드·커튼"];

function PhotoPick({ label, img, active, onClick, ratio = "4 / 3" }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      style={{ position: "relative", padding: 0, borderRadius: R.lg, overflow: "hidden", cursor: "pointer", aspectRatio: ratio,
        border: `2.5px solid ${active ? C.brand : "transparent"}`, background: C.bgWarm, boxShadow: active ? `0 4px 14px ${C.brand44}` : "none" }}>
      {img && <img src={img} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.6) 100%)" }} />
      <span style={{ position: "absolute", left: 8, right: 8, bottom: 7, color: "#fff", fontSize: 12.5, fontWeight: 800, textAlign: "left", letterSpacing: "-0.2px" }}>{label}</span>
      {active && <span style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: C.brand,
        color: "#fff", fontSize: 12, fontWeight: 900, display: "grid", placeItems: "center" }}>✓</span>}
    </button>
  );
}

export default function RequestModalBeta({ onClose, onDone, initialData = null, isEdit = false }) {
  // ── 로직(원본 동일) ────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [moreTags, setMoreTags] = useState(false);
  const [betaAck, setBetaAck] = useState(() => hasBetaAck("quote")); // 최초 1회 확인 후 재노출 안 함
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
    <>
    {/* 견적요청 진입 안내 — 확인 전 작성 화면을 가린다(베타). 수정 모드는 제외. */}
    <BetaGateModal open={!betaAck && !isEdit} kind="quote" onConfirm={() => setBetaAck(true)} onClose={() => onClose?.()} />
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

        <BetaBanner text="오픈 기간 · 견적·상담·계약 기록 모두 무료예요" />

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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: S.xl }}>
            {SPACE_TYPES.map(t => (
              <PhotoPick key={t} label={t} img={SPACE_IMG[t]} active={form.type === t} onClick={() => set("type", t)} ratio="1 / 1" />
            ))}
          </div>

          <Label required>평수</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {SIZE_QUICK.map(q => (
              <button key={q} onClick={() => set("size", q)} style={chip(form.size === q)}>{q}</button>
            ))}
          </div>
          <input placeholder="정확히 알면 적어 주세요 · 예: 32평" value={SIZE_QUICK.includes(form.size) ? "" : form.size}
            onChange={e => set("size", e.target.value)} style={iS} />

          <button onClick={() => form.type && form.size && setStep(2)} style={{ ...primaryBtn(!!(form.type && form.size)), width: "100%", flex: "none", marginTop: 4 }}>
            다음 →
          </button>
        </>}

        {step === 2 && <>
          <div style={{ fontSize: 19, fontWeight: 800, color: C.text1, marginBottom: 4 }}>예산과 스타일</div>
          <div style={{ fontSize: 13, color: C.text3, marginBottom: S.xl }}>희망 범위를 알려주세요 (스타일은 선택)</div>

          <Label required>희망 예산</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {BUDGET_QUICK.map(q => (
              <button key={q} onClick={() => set("budget", q)} style={chip(form.budget === q)}>{q}</button>
            ))}
          </div>
          <input placeholder="직접 적기 · 예: 2,500~3,000만원" value={BUDGET_QUICK.includes(form.budget) ? "" : form.budget}
            onChange={e => set("budget", e.target.value)} style={iS} />

          <Label>마음에 드는 분위기</Label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: isCustomStyle ? S.md : S.xl }}>
            {STYLES.map(st => (
              <PhotoPick key={st} label={st} img={styleImgFor(form.type, st)} active={form.style === st} onClick={() => set("style", form.style === st ? "" : st)} ratio="1 / 1" />
            ))}
            <button onClick={() => set("style", "기타")} aria-pressed={isCustomStyle}
              style={{ ...chip(isCustomStyle), borderRadius: R.lg, aspectRatio: "1 / 1", minHeight: 0, display: "grid", placeItems: "center" }}>✏️ 직접 적기</button>
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

          <Label required>어떤 공사가 필요하세요?</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {[...WORK_TAGS, ...((moreTags || MORE_WORK_TAGS.some(t => form.desc.includes(t))) ? MORE_WORK_TAGS : [])].map(tag => {
              const on = form.desc.includes(tag);
              return (
                <button key={tag} onClick={() => set("desc", on
                    ? form.desc.split(/,\s*/).filter(x => x.trim() && x.trim() !== tag).join(", ")
                    : (form.desc.trim() ? `${form.desc.trim().replace(/,$/, "")}, ${tag}` : tag))}
                  style={{ ...chip(on), padding: "8px 13px", minHeight: 38, fontSize: 13 }}>{on ? "✓ " : "+ "}{tag}</button>
              );
            })}
            {!(moreTags || MORE_WORK_TAGS.some(t => form.desc.includes(t))) && (
              <button onClick={() => setMoreTags(true)}
                style={{ padding: "8px 13px", minHeight: 38, fontSize: 13, fontWeight: 700, color: C.brand,
                  background: "none", border: `1.5px dashed ${C.brandM}`, borderRadius: R.full, cursor: "pointer" }}>
                더 보기 · 중문·몰딩·방수 등
              </button>
            )}
          </div>
          <textarea placeholder="위에서 고르거나 직접 적어 주세요 · 예) 주방 확장, 욕실 2개 교체" value={form.desc}
            onChange={e => set("desc", e.target.value)} rows={4}
            style={{ ...iS, minHeight: 110, resize: "none", lineHeight: 1.7, marginBottom: S.md }} />

          {/* 보내기 전 한눈에 — 고른 내용을 카드로 */}
          <div style={{ border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: "12px 14px", marginBottom: S.sm,
            display: "flex", gap: 12, alignItems: "center" }}>
            {SPACE_IMG[form.type] && <img src={SPACE_IMG[form.type]} alt="" style={{ width: 56, height: 56, borderRadius: R.md, objectFit: "cover", flexShrink: 0 }} />}
            <div style={{ minWidth: 0, fontSize: 12.5, color: C.text2, lineHeight: 1.6 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>{form.type} · {form.size}</div>
              <div>예산 {form.budget}{form.style ? ` · ${form.style === "기타" ? "직접 적은 스타일" : form.style}` : ""}</div>
            </div>
            <button onClick={() => setStep(1)} style={{ marginLeft: "auto", background: "none", border: "none", color: C.brand, fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>고치기</button>
          </div>

          <div style={{ background: C.surface2, borderRadius: R.lg, padding: "12px 14px",
            marginBottom: S.sm, fontSize: 12, color: C.text3, lineHeight: 1.8 }}>
            {SHOW_BETA_UI ? (<>
              📋 <b style={{ color: C.brand }}>계약부터 준공까지 기록이 남아요</b><br/>
              계약서·공사 사진·GPS 진행 기록이 공간마켓에 남습니다 · 대금은 계약서 단계대로 업체와 직접 주고받아요
            </>) : (<>
              🔒 <b style={{ color: C.brand }}>공간안전결제</b> — 토스페이먼츠가 공사대금을 안전하게 보호합니다<br/>
              단계별 안전정산 후 공사 완료 시 최종 지급 · 가상계좌 이용 시 이용료 660원
            </>)}
          </div>
          <div style={{ background: C.navyL, borderRadius: R.lg, padding: "12px 14px",
            marginBottom: S.xl, fontSize: 13, color: C.navy, fontWeight: 600,
            display: "flex", gap: 8, alignItems: "center" }}>
            <span>🛡</span>
            <span>{SHOW_BETA_UI ? "인근 검증 업체에게만 공개돼요" : "인근 검증 업체에게만 공개 · 에스크로 안전 정산 적용"}</span>
          </div>

          <div style={{ display: "flex", gap: S.sm }}>
            <button onClick={() => setStep(2)} style={backBtn}>← 이전</button>
            <button onClick={() => form.desc && onDone(form)} className={form.desc ? "gg-cta" : undefined} style={primaryBtn(!!form.desc)}>{isEdit ? "✅ 수정 완료" : "🚀 견적 요청하기"}</button>
          </div>
          {!isEdit && (
            <div style={{ textAlign: "center", fontSize: 12, color: C.text3, marginTop: S.md }}>
              견적이 오면 알림으로 알려 드려요.
            </div>
          )}
        </>}
      </div>
    </div>
    </>
  );
}
