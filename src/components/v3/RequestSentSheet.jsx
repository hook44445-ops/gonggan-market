// 견적 요청을 보낸 직후 — 「이제 어떻게 되나요?」에 한 장으로 답한다.
//  · 지금 어디쯤인지(여정 7단계 중 2단계) + 다음에 무슨 일이 생기는지
//  · 기다리는 동안 할 수 있는 것(시공 사례 구경 · 내 요청 보기)
//  · 결제는 베타 기간 실제 방식 그대로 안내한다(앱 안 안전결제는 정식 서비스에서).
import { C, R, S, SHADOW } from "../../constants";

const JOURNEY = [
  { t: "요청 보냄", s: "방금 완료" },
  { t: "업체 검토", s: "지역 검증 업체가 요청을 봐요" },
  { t: "견적 도착", s: "도착하면 알림으로 알려드려요" },
  { t: "비교·상담", s: "채팅으로 궁금한 것 묻기" },
  { t: "계약", s: "마음에 드는 한 곳과" },
  { t: "시공", s: "사진·기록으로 진행 확인" },
  { t: "완료·후기", s: "후기로 다음 사람을 도와요" },
];

export default function RequestSentSheet({ onClose, onBrowse, onTrack }) {
  const now = 1; // 0: 요청 보냄(완료) · 1: 업체 검토(지금)
  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.6)", zIndex: 510,
        display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: C.surface, width: "100%", maxWidth: 480, borderRadius: "24px 24px 0 0",
          maxHeight: "92vh", overflowY: "auto", paddingBottom: 28 }}>
        <div style={{ position: "relative", aspectRatio: "16 / 8", background: C.brandL, overflow: "hidden", borderRadius: "24px 24px 0 0" }}>
          <img src="/images/request-sent.webp" alt="" onError={(e) => { e.currentTarget.style.display = "none"; }}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 10, display: "flex", justifyContent: "center" }}>
            <div style={{ width: 36, height: 4, background: "rgba(255,255,255,0.8)", borderRadius: R.full }} />
          </div>
        </div>

        <div style={{ padding: `${S.lg}px ${S.xl}px 0` }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.text1, letterSpacing: "-0.5px" }}>요청을 보냈어요!</div>
          <div style={{ fontSize: 13.5, color: C.text2, marginTop: 4, lineHeight: 1.6 }}>
            이제 우리 동네 검증 업체들이 요청을 살펴봐요. 견적이 오면 바로 알려드릴게요.
          </div>

          {/* 여정 — 지금 위치를 강조 */}
          <div style={{ marginTop: S.lg, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: `${S.md}px ${S.lg}px` }}>
            {JOURNEY.map((j, i) => {
              const done = i < now, cur = i === now;
              return (
                <div key={j.t} style={{ display: "flex", gap: S.md, position: "relative", paddingBottom: i === JOURNEY.length - 1 ? 0 : 12 }}>
                  {i < JOURNEY.length - 1 && <div aria-hidden style={{ position: "absolute", left: 10, top: 22, bottom: 0, width: 2,
                    background: done ? C.brand : C.bgWarm }} />}
                  <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center",
                    fontSize: 11, fontWeight: 900, zIndex: 1,
                    background: done ? C.brand : cur ? C.surface : C.bg, color: done ? "#fff" : cur ? C.brand : C.text4,
                    border: cur ? `2px solid ${C.brand}` : done ? "none" : `1px solid ${C.bgWarm}`,
                    boxShadow: cur ? `0 0 0 4px ${C.brandL}` : "none" }}>{done ? "✓" : i + 1}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: cur ? 900 : 700, color: done || cur ? C.text1 : C.text3 }}>
                      {j.t}{cur && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: C.brand, background: C.brandL,
                        borderRadius: R.full, padding: "2px 8px" }}>지금</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.text3, marginTop: 1 }}>{j.s}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: S.md, background: C.bg, borderRadius: R.lg, padding: "10px 14px", fontSize: 12, color: C.text3, lineHeight: 1.7 }}>
            💬 채팅·📷 사진·📍 현장 기록이 남아, 문제가 생기면 기록을 기준으로 함께 확인해요.<br />
            베타 기간 결제는 업체와 협의해 진행하고, 앱 안 안전결제는 정식 서비스에서 열려요.
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: S.sm, marginTop: S.lg }}>
            <button onClick={() => { onClose?.(); onBrowse?.(); }}
              style={{ height: 52, borderRadius: R.lg, border: "none", background: C.brand, color: "#fff", fontSize: 15,
                fontWeight: 800, cursor: "pointer", boxShadow: SHADOW.brand }}>
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
