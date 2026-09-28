import { pendingRefCode, REFERRAL_REWARD } from "../lib/referral";

// 초대 링크(?ref=)로 들어온 사람에게 가입 선물을 먼저 알린다 — 모르면 그냥 둘러보고 나간다.
//   코드는 App 이 첫 화면에서 기기에 보관해 둔다(30일). 가입 뒤 referral_claim(148)이 +20 을 준다.
export default function InviteWelcome({ style }) {
  if (!pendingRefCode()) return null;
  return (
    <div role="note" style={{ display: "flex", alignItems: "center", gap: 10, background: "#0E2B1D", color: "#F4EFE4",
      borderRadius: 14, padding: "12px 14px", ...style }}>
      <span aria-hidden style={{ fontSize: 22 }}>🎁</span>
      <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>
        <b style={{ fontWeight: 900 }}>초대 링크로 오셨네요</b><br />
        지금 가입하면 공간토큰 <b style={{ color: "#D6A756" }}>{REFERRAL_REWARD.invitee}개</b>를 드려요
      </span>
    </div>
  );
}
