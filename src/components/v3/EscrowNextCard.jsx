// 공사 진행(에스크로) 화면 맨 위 — 「지금 할 일」 카드 + 5단계 에스컬레이터.
//   표시 전용: stageStatus 를 읽어 말하고, 버튼은 해당 단계 칸(id="stage-N")으로 스크롤만 한다.
//   승인·지급·정산은 EscrowScreen 의 기존 로직 그대로. 그림은 힉스필드 단계 삽화(글자·사람 없음).
import { C, R, S } from "../../constants";
import { nextAction, progressSteps } from "../../lib/escrowNext";

const TONE = {
  act:  { bg: C.brandL, bd: C.brandM, fg: C.brand, tag: "지금 할 일" },
  warn: { bg: "#FFF3F0", bd: C.red33, fg: C.red, tag: "잠시 멈춤" },
  done: { bg: C.brandL, bd: C.brandM, fg: C.green, tag: "마무리" },
  wait: { bg: C.surface, bd: C.bgWarm, fg: C.text2, tag: "지금 상황" },
};

const scrollTo = (id) => {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
};

export default function EscrowNextCard({ stageStatus, isConsumer, labels = {}, settled = false, disputed = false, reviewed = false }) {
  const na = nextAction({ stageStatus, isConsumer, labels, settled, disputed, reviewed });
  const steps = progressSteps(stageStatus);
  const t = TONE[na.tone] ?? TONE.wait;
  const art = `/images/escrow/stage${na.stageId ?? 1}.webp`;

  return (
    <div style={{ padding: `${S.lg}px ${S.xl}px 0` }}>
      <div style={{ background: t.bg, border: `1px solid ${t.bd}`, borderRadius: R.xl, padding: S.lg, display: "flex", gap: S.md, alignItems: "center" }}>
        <img src={art} alt="" aria-hidden="true" width={72} height={72}
          style={{ width: 72, height: 72, borderRadius: R.lg, objectFit: "cover", flexShrink: 0, background: "#F7F1E6" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: t.fg, marginBottom: 3 }}>{t.tag}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, lineHeight: 1.35, wordBreak: "keep-all" }}>{na.title}</div>
          <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.55, marginTop: 3, wordBreak: "keep-all" }}>{na.sub}</div>
          {na.cta && (
            <button onClick={() => scrollTo(na.anchor)} style={{ marginTop: S.sm, padding: "9px 16px", background: t.fg, color: "#fff",
              border: "none", borderRadius: R.full, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{na.cta} →</button>
          )}
        </div>
      </div>

      {/* 5단계 에스컬레이터 — 지난 단계는 채움 · 지금 단계는 강조 · 남은 단계는 흐리게. 누르면 그 단계로 */}
      <div role="list" aria-label="공사 진행 단계" style={{ display: "flex", alignItems: "flex-start", gap: 4, margin: `${S.md}px 2px ${S.sm}px` }}>
        {steps.map((st) => (
          <button key={st.id} role="listitem" onClick={() => scrollTo(`stage-${st.id}`)}
            aria-current={st.state === "active" ? "step" : undefined}
            style={{ flex: 1, textAlign: "center", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <div style={{ borderRadius: R.full, marginBottom: 6, opacity: st.state === "locked" ? 0.7 : 1,
              background: st.state === "done" ? C.brandM : st.state === "active" ? C.brand : C.bgWarm,
              height: st.state === "active" ? 7 : 5, marginTop: st.state === "active" ? -1 : 0 }} />
            <div style={{ fontSize: 10.5, fontWeight: st.state === "active" ? 800 : 600, lineHeight: 1.3, wordBreak: "keep-all",
              color: st.state === "done" ? C.text3 : st.state === "active" ? C.brand : C.text4 }}>
              {st.state === "done" ? "✓ " : ""}
              {labels[st.id] ?? `${st.id}단계`}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
