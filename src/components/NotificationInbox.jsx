// ─────────────────────────────────────────────────────
// 통합 알림함 (사용자용) — 기존 notifications 테이블 조회 전용 카드.
//
// B단계 최소 보강:
//   · 기존 getUserNotifications / markNotificationRead / markAllNotificationsRead 재사용.
//   · 알림 생성/푸시/enqueue/DB 스키마는 일절 건드리지 않는다(읽기 + is_read 토글만).
//   · 마이페이지(MainApp) 안에 인라인 카드로 렌더된다.
// ─────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { NOTIF_META } from "../utils/notify";
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../lib/supabase";

// 상대 시간(간단) — 외부 의존 없이 자체 계산.
function relTime(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  try {
    return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  } catch { return ""; }
}

const PREVIEW_COUNT = 2; // 마이페이지 알림함 미리보기 2개(나머지는 '더보기'). UI 표시 전용.

export default function NotificationInbox({ user }) {
  const userId = user?.id ?? null;
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!userId || user?.isGuest) { setLoading(false); return; }
    setLoading(true);
    getUserNotifications(userId, { limit: 30 }).then(({ data }) => {
      if (!alive) return;
      setItems(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => { if (alive) { setItems([]); setLoading(false); } });
    return () => { alive = false; };
  }, [userId, user?.isGuest]);

  // 게스트/비로그인은 알림함을 노출하지 않는다.
  if (!userId || user?.isGuest) return null;

  const unread = items.filter(n => !n.is_read).length;

  const handleTap = async (n) => {
    if (n.is_read) return;
    setItems(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    try { await markNotificationRead(n.id); } catch {}
  };

  const handleAllRead = async () => {
    if (unread === 0) return;
    setItems(prev => prev.map(x => ({ ...x, is_read: true })));
    try { await markAllNotificationsRead(userId); } catch {}
  };

  const visible = expanded ? items : items.slice(0, PREVIEW_COUNT);

  return (
    <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S.md }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>🔔 알림함</span>
          {unread > 0 && (
            <span style={{ background: C.brand, color: "#fff", borderRadius: R.full, padding: "2px 9px", fontSize: 11, fontWeight: 800 }}>
              {unread}
            </span>
          )}
        </div>
        {unread > 0 && (
          <button onClick={handleAllRead}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: C.brand, fontWeight: 700, padding: 0 }}>
            전체 읽음
          </button>
        )}
      </div>

      {/* 본문 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "28px 0", fontSize: 13, color: C.text3 }}>불러오는 중…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "28px 0" }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>🔔</div>
          <div style={{ fontSize: 13, color: C.text3 }}>새 알림이 없습니다</div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {visible.map(n => {
              const icon = NOTIF_META[n.type]?.icon ?? "🔔";
              return (
                <div key={n.id} onClick={() => handleTap(n)}
                  style={{
                    display: "flex", gap: S.sm, alignItems: "center",
                    padding: `${S.sm}px ${S.md}px`, borderRadius: R.lg,
                    background: n.is_read ? C.surface2 : C.brandL,
                    border: `1px solid ${n.is_read ? C.bgWarm : C.brandM}`,
                    cursor: n.is_read ? "default" : "pointer",
                  }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                    background: n.is_read ? C.bg : C.surface,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: n.is_read ? 600 : 800, color: C.text1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {n.title || "알림"}
                      </span>
                      <span style={{ fontSize: 11, color: C.text4, flexShrink: 0 }}>{relTime(n.created_at)}</span>
                    </div>
                    {n.message && (
                      <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.4, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.message}</div>
                    )}
                  </div>
                  {!n.is_read && <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.brand, flexShrink: 0 }} />}
                </div>
              );
            })}
          </div>

          {items.length > PREVIEW_COUNT && (
            <button onClick={() => setExpanded(v => !v)}
              style={{ width: "100%", marginTop: S.sm, background: "none", border: "none", cursor: "pointer",
                fontSize: 12.5, color: C.text3, fontWeight: 700, padding: "8px 0" }}>
              {expanded ? "접기 ▲" : `더보기 (${items.length - PREVIEW_COUNT}) ▼`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
