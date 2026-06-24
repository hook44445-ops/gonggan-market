// ─────────────────────────────────────────────────────
// 공통 알림 벨 — 헤더용 아이콘 + 배지(읽지 않은 알림 수) + 알림함 시트.
//
//   · 기존 notifications 테이블/알림 생성 정책/Push 구조 무변경(순수 추가 UI).
//   · 배지 = notifications.is_read = false 건수(getUnreadCount 재사용).
//   · 탭하면 기존 NotificationInbox(마이페이지 알림함 카드)를 그대로 띄운다
//     (새 알림 화면/테이블 생성 없음 — 기존 컴포넌트 재사용).
//   · 갱신: 60초 폴링 + 앱 포커스/탭 재진입 시(realtime 미사용, 추후 적용 가능).
// ─────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { C, R } from "../constants";
import { getUnreadCount } from "../lib/supabase";
import NotificationInbox from "./NotificationInbox";

const POLL_MS = 60000;

export default function NotificationBell({ user, style, onNavigate }) {
  const userId = user?.id ?? null;
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const aliveRef = useRef(true);

  const refresh = useCallback(() => {
    if (!userId || user?.isGuest) { setUnread(0); return; }
    getUnreadCount(userId).then(({ count }) => { if (aliveRef.current) setUnread(count ?? 0); }).catch(() => {});
  }, [userId, user?.isGuest]);

  useEffect(() => {
    aliveRef.current = true;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      aliveRef.current = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  if (!userId || user?.isGuest) return null;

  return (
    <>
      <button
        onClick={() => { setOpen(true); }}
        aria-label="알림"
        style={{ position: "relative", background: "none", border: "none", cursor: "pointer", fontSize: 21, lineHeight: 1, padding: 4, ...style }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -2, right: -4, minWidth: 16, height: 16, padding: "0 4px",
            borderRadius: R.full, background: C.red ?? "#E53E3E", color: "#fff",
            fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(31,42,36,0.55)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 600 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto", background: C.bg, borderRadius: "24px 24px 0 0", padding: "20px 16px 28px" }}>
            <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: "0 auto 16px" }} />
            <NotificationInbox user={user} onRead={refresh} onNavigate={onNavigate ? (n) => { setOpen(false); onNavigate(n); } : undefined} />
            <button onClick={() => setOpen(false)} style={{ width: "100%", marginTop: 4, padding: 13, background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 14, color: C.text2, cursor: "pointer" }}>
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
