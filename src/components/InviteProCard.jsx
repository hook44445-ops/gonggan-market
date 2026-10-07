import { useEffect, useState } from "react";
import { trackUsp } from "../lib/uspTrack"; // USP 12 «공유» 사용 기록(187)
import { C, R } from "../constants";
import { proInviteMessage } from "../lib/referral";
import { myRefCode } from "../lib/myRefCode";
import ArtGlyph from "./common/ArtGlyph";

// 아는 사장님 초대하기(업체 초대 바퀴) — 동네에 업체가 적을 때 · 견적이 아직 없을 때 고객에게.
//   파트너 소개(/partner?ref=내코드)를 공유한다. 요청 내용(주소·예산)은 싣지 않는다.
export default function InviteProCard({ userId, compact = false }) {
  const [code, setCode] = useState(null);
  const [done, setDone] = useState(null);
  // 초대 코드를 미리 받아 둔다(버튼에서 기다리면 아이폰이 공유창을 막는다)
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    myRefCode(userId).then((c) => { if (alive) setCode(c); }).catch(() => {});
    return () => { alive = false; };
  }, [userId]);
  if (!userId) return null;

  const share = async () => {
    trackUsp(12, { meta: { kind: "pro_invite" } });
    const text = proInviteMessage(code);
    try {
      if (navigator.share) { await navigator.share({ title: "공간랜드 파트너", text }); setDone("보냈어요 · 고마워요"); return; }
      await navigator.clipboard.writeText(text); setDone("복사했어요 · 카톡에 붙여 보내세요");
    } catch { /* 공유 취소 */ }
  };

  return (
    <div style={{ marginTop: compact ? 8 : 12, padding: compact ? "10px 12px" : "12px 14px", borderRadius: R.lg,
      background: C.surface, border: `1px dashed ${C.brandM}`, textAlign: "left" }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: C.text1, display: "flex", alignItems: "center", gap: 8 }}>
        <ArtGlyph src="/images/intro/invite-pro.webp" emoji="🔧" size={34} />아는 사장님이 있나요?
      </div>
      <div style={{ fontSize: 12, color: C.text2, marginTop: 3, lineHeight: 1.5 }}>
        우리 동네 업체가 늘면 견적이 더 빨리 와요. 가입비 없이 견적을 보낼 수 있다고 알려 주세요.
      </div>
      <button onClick={share}
        style={{ marginTop: 8, padding: "8px 12px", borderRadius: R.full, border: `1px solid ${C.brand}`,
          background: C.brandL, color: C.brand, fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
        사장님께 초대 보내기
      </button>
      {done && <div style={{ fontSize: 11.5, color: C.text2, marginTop: 6 }}>{done}</div>}
    </div>
  );
}
