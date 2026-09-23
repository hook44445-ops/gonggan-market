// 관리자 — 푸시 알림 운영 현황
//
// 여기서 보려는 것은 하나다: 「알림이 지금 제때 나가고 있나」.
// Vercel Hobby 는 크론이 하루 1회라 큐가 밀리면 최대 24시간 늦게 나간다.
// 그래서 「가장 오래 기다린 건」을 제일 크게 보여 주고, 밀렸으면 지금 보낼 수 있게 한다.
//
// 조회 + 수동 발송만 한다. 알림을 새로 만들지 않는다.

import { useCallback, useEffect, useState } from "react";
import { fetchPushStats, flushPushQueue } from "../../lib/supabase";

const C = {
  surface: "#fff", line: "#e4ddd0", text1: "#3a352c", text2: "#5a5346",
  text3: "#8a8270", brand: "#2E5F4B", red: "#c0392b", amber: "#b8860b",
};

// 밀린 시간 → 사람이 읽는 말. 이 값이 이 화면에서 제일 중요하다.
function waitedFor(iso) {
  if (!iso) return null;
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return { text: `${mins}분째 대기`, mins };
  const h = Math.floor(mins / 60);
  if (h < 24) return { text: `${h}시간 ${mins % 60}분째 대기`, mins };
  return { text: `${Math.floor(h / 24)}일 ${h % 24}시간째 대기`, mins };
}

const when = (iso) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "-";

function Stat({ label, value, tone }) {
  return (
    <div style={{ flex: "1 1 96px", minWidth: 96, background: C.surface, border: `1px solid ${C.line}`,
      borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: tone || C.text1 }}>{value}</div>
    </div>
  );
}

function EnvDot({ ok, label, hint }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.text2 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: ok ? C.brand : C.red, flexShrink: 0 }} />
      <span>{label}</span>
      {!ok && hint && <span style={{ color: C.text3 }}>— {hint}</span>}
    </div>
  );
}

export default function PushHealthPanel({ adminId, showToast }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [flushing, setFlushing] = useState(false);

  const load = useCallback(async () => {
    if (!adminId) return;
    setLoading(true);
    const { data, error } = await fetchPushStats(adminId);
    setLoading(false);
    if (error) { setErr(error.message); setStats(null); return; }
    setErr(null);
    setStats(data?.stats ?? null);
  }, [adminId]);

  useEffect(() => { load(); }, [load]);

  const onFlush = async () => {
    setFlushing(true);
    const { data, error } = await flushPushQueue(adminId);
    setFlushing(false);
    if (error) { showToast?.(`발송 실패 — ${error.message}`, false); return; }
    // 디스패처를 깨우는 것까지가 이 버튼의 일이다. 결과는 현황을 다시 읽어 확인한다.
    showToast?.(data?.woke === false ? `발송기가 깨어나지 않음 — ${data?.reason ?? "unknown"}` : "발송기를 깨웠습니다");
    setTimeout(load, 1500);
  };

  if (!adminId) return null;

  const waited = waitedFor(stats?.oldestQueuedAt);
  const stuck = (waited?.mins ?? 0) >= 60;

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text1 }}>푸시 운영 현황</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} disabled={loading}
            style={{ background: "transparent", color: C.text2, border: `1px solid ${C.line}`, borderRadius: 8,
              padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer" }}>
            {loading ? "읽는 중" : "새로고침"}
          </button>
          <button onClick={onFlush} disabled={flushing || !stats}
            style={{ background: stuck ? C.red : C.brand, color: "#fff", border: "none", borderRadius: 8,
              padding: "6px 12px", fontSize: 12, fontWeight: 800, cursor: flushing ? "default" : "pointer", opacity: stats ? 1 : 0.5 }}>
            {flushing ? "보내는 중" : "지금 발송"}
          </button>
        </div>
      </div>

      {err && (
        <div style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>
          현황을 못 읽었습니다 — {err}
        </div>
      )}

      {stats && (
        <>
          {/* 제일 중요한 한 줄 — 크론이 하루 1회라 여기가 밀리면 알림이 늦는다 */}
          <div style={{ background: stuck ? "#fdf1ef" : "#f3f0ea", border: `1px solid ${stuck ? "#f0c9c2" : C.line}`,
            borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.text3, marginBottom: 4 }}>가장 오래 기다린 알림</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: stuck ? C.red : C.text1 }}>
              {stats.queued === 0 ? "대기 중인 알림 없음" : (waited?.text ?? "-")}
            </div>
            {stats.queued > 0 && (
              <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>
                {when(stats.oldestQueuedAt)}에 큐에 들어옴 · 크론은 하루 1회라 밀리면 「지금 발송」을 누른다
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <Stat label="대기 중" value={stats.queued} tone={stats.queued > 0 ? C.amber : C.text1} />
            <Stat label="발송 7일" value={stats.sent7} />
            <Stat label="실패 7일" value={stats.failed7} tone={stats.failed7 > 0 ? C.red : C.text1} />
            <Stat label="건너뜀 7일" value={stats.skipped7} />
            <Stat label="활성 기기" value={stats.tokensActive} tone={stats.tokensActive === 0 ? C.red : C.text1} />
            <Stat label="알림 켠 사람" value={stats.prefsOn} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            <EnvDot ok={stats.env?.fcmV1 || stats.env?.fcmLegacy} label="FCM 자격증명"
              hint="FIREBASE_SERVICE_ACCOUNT 또는 FCM_SERVER_KEY 가 없어 한 건도 못 나간다" />
            <EnvDot ok={!!stats.env?.dispatchUrl} label="즉시 발송 주소"
              hint="PUSH_DISPATCH_URL / VERCEL_URL 이 없어 「지금 발송」이 동작하지 않는다" />
          </div>

          {stats.recentFails?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 6 }}>
                최근 실패·건너뜀 {stats.recentFails.length}건
              </div>
              {stats.recentFails.map((f, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10,
                  fontSize: 11, color: C.text3, padding: "4px 0", borderBottom: `1px solid ${C.line}` }}>
                  <span style={{ color: C.text2, fontWeight: 700 }}>{f.type}</span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.error_message || "-"}
                  </span>
                  <span>{when(f.sent_at)}</span>
                </div>
              ))}
            </div>
          )}

          {stats.recentSent?.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text2, marginBottom: 6 }}>최근 발송</div>
              {stats.recentSent.map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10,
                  fontSize: 11, color: C.text3, padding: "4px 0" }}>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.title || s.type}
                  </span>
                  <span>{when(s.sent_at)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
