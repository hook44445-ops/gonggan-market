// 공사 한 건의 7단계 «지금 여기» — 요청 직후 시트(RequestSentSheet)와 결제 전 단계 화면(EscrowScreen)이 같은 말·같은 모양을 쓴다.
//  · 지금 칸 하나와 바로 다음 일 하나만 크게, 나머지 단계는 점으로
//  · 색은 「내 한도 · 서류」 가족(깊은 초록 · 아이보리 · 금 선)
//  · 결제 문구는 부르는 쪽이 PAYMENTS_LIVE 로 고른다(결제가 열리기 전엔 «계약서대로 직접»).
import { C, R, S } from "../../constants";

export const JOURNEY = ["요청 보냄", "업체 검토", "견적 도착", "비교·상담", "계약", "시공", "완료·후기"];

const INK = "#F4EFE4";
const GOLD = "#D6A756";
const DEEP = "#0E2B1D";
const GOLD_LINE = "rgba(214,167,86,0.35)";

export function JourneyNowCard({ now, title, desc, next }) {
  return (
    <div style={{ background: "#FFFDF8", border: `1px solid ${GOLD_LINE}`, borderRadius: R.lg, padding: `${S.md}px ${S.lg}px` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: GOLD, letterSpacing: "0.04em" }}>지금 여기 · {now + 1}/{JOURNEY.length}</span>
        <div aria-label={`${JOURNEY.length}단계 중 ${now + 1}단계`} style={{ display: "flex", gap: 4 }}>
          {JOURNEY.map((t, i) => (
            <span key={t} title={t} style={{ width: i === now ? 16 : 6, height: 6, borderRadius: R.full,
              background: i < now ? C.brand : i === now ? GOLD : C.bgWarm }} />
          ))}
        </div>
      </div>
      <div style={{ fontSize: 17, fontWeight: 900, color: C.text1, marginTop: 6 }}>{title ?? JOURNEY[now]}</div>
      {desc && <div style={{ fontSize: 13, color: C.text2, marginTop: 2, lineHeight: 1.6 }}>{desc}</div>}
      {next && now + 1 < JOURNEY.length && (
        <div style={{ marginTop: S.md, paddingTop: S.sm, borderTop: `1px dashed ${GOLD_LINE}`, fontSize: 12.5, color: C.text3, lineHeight: 1.6 }}>
          <b style={{ color: C.text1 }}>다음 · {JOURNEY[now + 1]}</b> — {next}
        </div>
      )}
    </div>
  );
}

// 결제 전 단계 한 화면 — 깊은 초록 머리(그림) + «지금 여기» 카드 + 알림 한 줄 + 버튼.
//   primary/secondary: { label, onClick } · note: 회색 안내 한 줄(선택)
export function StageNowPage({ header, onBack, image = "/images/stage-quote.webp", eyebrow, heading, lead,
  now, cardTitle, cardDesc, next, note, primary, secondary }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background: C.surface, padding: "14px 20px", borderBottom: `1px solid ${C.bgWarm}`, display: "flex", alignItems: "center", gap: S.md }}>
        <button onClick={onBack} aria-label="뒤로" style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.text1, padding: 0 }}>←</button>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>{header}</div>
      </div>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: `${S.lg}px ${S.lg}px 32px` }}>
        <div style={{ position: "relative", minHeight: 164, overflow: "hidden", borderRadius: 20,
          background: `${DEEP} url(${image}) right center / cover no-repeat`, color: INK }}>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${DEEP} 0%, rgba(14,43,29,0.84) 52%, rgba(14,43,29,0.12) 100%)` }} />
          <div style={{ position: "relative", padding: `${S.xl}px ${S.xl}px ${S.lg}px`, maxWidth: "70%" }}>
            <div style={{ fontSize: 12, letterSpacing: "0.08em", color: GOLD, fontWeight: 700 }}>{eyebrow}</div>
            <div style={{ fontSize: 21, fontWeight: 900, letterSpacing: "-0.5px", marginTop: 4, lineHeight: 1.3, wordBreak: "keep-all" }}>{heading}</div>
            {lead && <div style={{ fontSize: 13, lineHeight: 1.6, marginTop: 6, color: "rgba(244,239,228,0.84)", wordBreak: "keep-all" }}>{lead}</div>}
          </div>
        </div>

        <div style={{ marginTop: S.lg }}>
          <JourneyNowCard now={now} title={cardTitle} desc={cardDesc} next={next} />
        </div>

        {note && (
          <div style={{ marginTop: S.md, background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg,
            padding: "10px 14px", fontSize: 12, color: C.text3, lineHeight: 1.7 }}>
            {note}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: S.sm, marginTop: S.lg }}>
          {primary && (
            <button onClick={primary.onClick} className="gg-cta"
              style={{ height: 52, borderRadius: R.lg, border: "none", background: DEEP, color: INK, fontSize: 15,
                fontWeight: 800, cursor: "pointer", boxShadow: "0 6px 16px rgba(14,43,29,0.25)" }}>
              {primary.label}
            </button>
          )}
          {secondary && (
            <button onClick={secondary.onClick}
              style={{ height: 46, borderRadius: R.lg, border: `1px solid ${C.bgWarm}`, background: C.surface, color: C.text1,
                fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              {secondary.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
