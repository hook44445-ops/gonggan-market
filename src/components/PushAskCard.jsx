import { useEffect, useState } from "react";
import { C, R, S } from "../constants";
import { shouldAskPush, lastPushAsk, markPushAsk, PUSH_ON_PREFS, pushFailText } from "../lib/pushAsk";
import { enablePush, isPushSupported, isPushConfigured, hasNativePush, pushPermission } from "../lib/push";
import { upsertPushPreferences } from "../lib/supabase";
import { isIosAppShell } from "../constants/release";
import ArtGlyph from "./common/ArtGlyph";

// «🔔 알림 켜기» 한 장 — 이 기기에서 켤 수 있고 아직 안 물었을 때만(14일에 한 번 · lib/pushAsk). 내 소식만 켠다(광고 X).
export default function PushAskCard({ userId, title, sub }) {
  const [st, setSt] = useState(null);   // null=안 보임 · "ask" · "busy" · "done" · 실패 문구
  useEffect(() => {
    try {
      if (userId && shouldAskPush({ supported: isPushSupported(), configured: isPushConfigured(),
        permission: pushPermission(),
        iosShell: isIosAppShell() && !hasNativePush(), lastAskedAt: lastPushAsk() })) { setSt("ask"); markPushAsk(); }
    } catch { /* 안 보임 */ }
  }, [userId]);
  if (!st) return null;
  const on = async () => {
    if (st === "busy" || st === "done") return;
    setSt("busy");
    const res = await enablePush(userId).catch(() => ({ ok: false }));
    if (res?.ok) { try { await upsertPushPreferences(userId, PUSH_ON_PREFS); } catch { /* 토큰은 저장됨 */ } setSt("done"); }
    else setSt(pushFailText(res?.reason));
  };
  const failed = st !== "ask" && st !== "busy" && st !== "done";
  return (
    <div style={{ background: C.brandL, border: `1px solid ${C.brandM}`, borderRadius: R.lg, padding: "12px 14px", marginBottom: S.md }}>
      <div style={{ display: "flex", alignItems: "center", gap: S.md }}>
        <ArtGlyph src="/images/intro/push-bell.webp" emoji="🔔" size={34} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: C.text1 }}>{st === "done" ? "알림을 켰어요" : title}</span>
          <span style={{ display: "block", fontSize: 12, color: C.text2, marginTop: 2 }}>{st === "done" ? "새 소식을 바로 알려 드려요(광고 아님)" : sub}</span>
        </span>
        {(st === "ask" || st === "busy") && (
          <button onClick={on} disabled={st === "busy"}
            style={{ flexShrink: 0, border: 0, borderRadius: R.full, padding: "8px 12px", background: C.brand, color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>
            {st === "busy" ? "…" : "알림 켜기"}
          </button>
        )}
      </div>
      {failed && <div style={{ fontSize: 12, color: "#B4432F", marginTop: 6 }}>{st}</div>}
    </div>
  );
}
