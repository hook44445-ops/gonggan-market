import { useEffect, useState } from "react";
import { pendingRefCode, refCodeFromSearch, inviterName, REFERRAL_REWARD } from "../lib/referral";
import { getCurrentUserId } from "../lib/session";
import { getReferralInviter } from "../lib/supabase";

// 초대 링크(?ref=)로 들어온 사람에게 가입 선물을 먼저 알린다 — 모르면 그냥 둘러보고 나간다.
//   코드는 App 이 첫 화면에서 기기에 보관해 둔다(30일). 가입 뒤 referral_claim(148)이 +20 을 준다.
//   보관 전 첫 그림(주소에 ?ref= 가 아직 있을 때)도 잡는다. 이미 로그인한 사람에겐 안 보인다.
//   초대한 사람 첫 글자(159)가 오면 «김○○님이 초대했어요» — SQL 전이거나 실패하면 «초대 링크로 오셨네요».
function currentCode() {
  let code = pendingRefCode();
  if (!code) { try { code = refCodeFromSearch(window.location.search); } catch { code = null; } }
  return code;
}

export default function InviteWelcome({ style }) {
  const loggedIn = !!getCurrentUserId();
  const code = loggedIn ? null : currentCode();
  const [who, setWho] = useState(null);
  useEffect(() => {
    if (!code) return;
    let alive = true;
    getReferralInviter(code).then(({ data, error }) => { if (alive && !error) setWho(inviterName(data)); }).catch(() => {});
    return () => { alive = false; };
  }, [code]);
  if (!code) return null;
  return (
    <div role="note" style={{ display: "flex", alignItems: "center", gap: 10, background: "#0E2B1D", color: "#F4EFE4",
      borderRadius: 14, padding: "12px 14px", ...style }}>
      <span aria-hidden style={{ fontSize: 22 }}>🎁</span>
      <span style={{ fontSize: 13.5, lineHeight: 1.5 }}>
        <b style={{ fontWeight: 900 }}>{who ? `${who}님이 초대했어요` : "초대 링크로 오셨네요"}</b><br />
        지금 가입하면 공간토큰 <b style={{ color: "#D6A756" }}>{REFERRAL_REWARD.invitee}개</b>를 드려요
      </span>
    </div>
  );
}
