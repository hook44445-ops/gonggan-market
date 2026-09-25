// 견적 요청을 보낸 직후 — 「이제 어떻게 되나요?」에 한 장으로 답한다.
//  · «지금 여기» 한 칸(7단계 중 2단계 · 업체 검토)과 바로 다음 일 하나만 크게 — 나머지 단계는 점으로
//  · 그림·색은 「내 한도 · 서류」 가족(깊은 초록 · 아이보리 · 금 선) — /images/request-sent-v2.webp
//  · 결제는 베타 기간 실제 방식 그대로 안내한다(앱 안 안전결제는 정식 서비스에서).
import { C, R, S } from "../../constants";

const INK = "#F4EFE4";
const GOLD = "#D6A756";
const DEEP = "#0E2B1D";
const GOLD_LINE = "rgba(214,167,86,0.35)";

const JOURNEY = ["요청 보냄", "업체 검토", "견적 도착", "비교·상담", "계약", "시공", "완료·후기"];
const NOW = 1; // 0: 요청 보냄(완료) · 1: 업체 검토(지금)

export default function RequestSentSheet({ onClose, onBrowse, onTrack }) {
  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.6)", zIndex: 510,
        display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: C.surface, width: "100%", maxWidth: 480, borderRadius: "24px 24px 0 0",
          maxHeight: "92vh", overflowY: "auto", paddingBottom: 28 }}>
        {/* 머리 — 깊은 초록 그림 위에 제목 */}
        <div style={{ position: "relative", minHeight: 176, overflow: "hidden", borderRadius: "24px 24px 0 0",
          background: `${DEEP} url(/images/request-sent-v2.webp) right center / cover no-repeat`, color: INK }}>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${DEEP} 0%, rgba(14,43,29,0.82) 50%, rgba(14,43,29,0.1) 100%)` }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 10, display: "flex", justifyContent: "center" }}>
            <div style={{ width: 36, height: 4, background: "rgba(244,239,228,0.55)", borderRadius: R.full }} />
          </div>
          <div style={{ position: "relative", padding: `${S.xl + 8}px ${S.xl}px ${S.lg}px`, maxWidth: "68%" }}>
            <div style={{ fontSize: 12, letterSpacing: "0.08em", color: GOLD, fontWeight: 700 }}>견적 요청 완료</div>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px", marginTop: 4 }}>요청을 보냈어요!</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, marginTop: 6, color: "rgba(244,239,228,0.82)" }}>
              견적이 오면 바로 알려드릴게요.
            </div>
          </div>
        </div>

        <div style={{ padding: `${S.lg}px ${S.xl}px 0` }}>
          {/* «지금 여기» 한 칸 */}
          <div style={{ background: "#FFFDF8", border: `1px solid ${GOLD_LINE}`, borderRadius: R.lg, padding: `${S.md}px ${S.lg}px` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: S.sm }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: GOLD, letterSpacing: "0.04em" }}>지금 여기 · {NOW + 1}/{JOURNEY.length}</span>
              <div aria-label={`${JOURNEY.length}단계 중 ${NOW + 1}단계`} style={{ display: "flex", gap: 4 }}>
                {JOURNEY.map((t, i) => (
                  <span key={t} title={t} style={{ width: i === NOW ? 16 : 6, height: 6, borderRadius: R.full,
                    background: i < NOW ? C.brand : i === NOW ? GOLD : C.bgWarm }} />
                ))}
              </div>
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: C.text1, marginTop: 6 }}>{JOURNEY[NOW]}</div>
            <div style={{ fontSize: 13, color: C.text2, marginTop: 2, lineHeight: 1.6 }}>우리 동네 검증 업체들이 요청을 살펴보고 있어요.</div>
            <div style={{ marginTop: S.md, paddingTop: S.sm, borderTop: `1px dashed ${GOLD_LINE}`, fontSize: 12.5, color: C.text3, lineHeight: 1.6 }}>
              <b style={{ color: C.text1 }}>다음 · {JOURNEY[NOW + 1]}</b> — 도착하면 알림으로 알려드려요. 금액·기록을 나란히 비교해 한 곳을 고르면 돼요.
            </div>
          </div>

          <div style={{ marginTop: S.md, background: C.bg, borderRadius: R.lg, padding: "10px 14px", fontSize: 12, color: C.text3, lineHeight: 1.7 }}>
            채팅·사진·현장 기록이 남아, 문제가 생기면 기록을 기준으로 함께 확인해요.<br />
            대금은 계약서에 적은 단계대로 업체와 직접 주고받아요 · 앱 안 안전결제는 정식 오픈 때 열려요.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: S.sm, marginTop: S.lg }}>
            <button onClick={() => { onClose?.(); onBrowse?.(); }} className="gg-cta"
              style={{ height: 52, borderRadius: R.lg, border: "none", background: DEEP, color: INK, fontSize: 15,
                fontWeight: 800, cursor: "pointer", boxShadow: "0 6px 16px rgba(14,43,29,0.25)" }}>
              기다리는 동안 시공 사례 구경하기
            </button>
            <button onClick={() => { onClose?.(); onTrack?.(); }}
              style={{ height: 46, borderRadius: R.lg, border: `1px solid ${C.bgWarm}`, background: C.surface, color: C.text1,
                fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              내 요청 진행 보기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
