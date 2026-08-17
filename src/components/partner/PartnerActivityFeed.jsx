import { C, R, S, SHADOW } from "../../constants";
import { NOTIF_META } from "../../utils/notify";

// PartnerActivityFeed — 운영홈 '최근 활동'(알림 시간순) 표시 전용.
//   items: 기존 알림 배열([{ id, type, title, message, created_at }]) — 호출부에서
//   getNotifications 결과를 그대로 전달. 신규 DB/API/조회/계산 없음.
//   아이콘은 기존 NOTIF_META(notify.js) 재사용. 최근 max개만 시간순 노출(읽기 전용).

const relTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 604800) return `${Math.floor(s / 86400)}일 전`;
  return `${d.getMonth() + 1}.${d.getDate()}`;
};

export default function PartnerActivityFeed({ items = [], max = 5 }) {
  const list = (items ?? []).filter(Boolean).slice(0, max);
  if (list.length === 0) return null; // 활동 없으면 섹션 숨김(빈 공간 방지)

  return (
    <div style={{ background: C.surface, borderRadius: R.xl, border: `1px solid ${C.bgWarm}`,
      boxShadow: SHADOW.soft, padding: `${S.lg}px ${S.lg}px ${S.sm}px`, marginBottom: S.lg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: S.sm }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>최근 활동</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.text3 }}>최근 알림 시간순</span>
      </div>
      <div>
        {list.map((n, i) => (
          <div key={n.id ?? i} style={{ display: "flex", alignItems: "flex-start", gap: 9,
            padding: "9px 0", borderTop: i === 0 ? "none" : `1px solid ${C.bgWarm}` }}>
            <span style={{ fontSize: 15, lineHeight: 1.4, flexShrink: 0 }}>
              {NOTIF_META[n.type]?.icon ?? "🔔"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text1,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {n.title ?? "알림"}
              </div>
              {n.message && (
                <div style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.45, marginTop: 1,
                  overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>
                  {n.message}
                </div>
              )}
            </div>
            <span style={{ fontSize: 10.5, color: C.text4, flexShrink: 0, marginTop: 1 }}>
              {relTime(n.created_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
