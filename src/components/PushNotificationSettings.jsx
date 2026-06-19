// ─────────────────────────────────────────────────────
// 마이페이지 · 푸시 알림 설정 (기본 전체 OFF · 동의 후 ON)
// ─────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { IS_SUPABASE_READY, getPushPreferences, upsertPushPreferences } from "../lib/supabase";
import { enablePush, disablePush, isPushSupported, isPushConfigured } from "../lib/push";

const SUB_TOGGLES = [
  { key: "push_local_news",      label: "동네 소식",        desc: "우리 동네 새 공간 이야기" },
  { key: "push_interior_news",   label: "인테리어 소식",     desc: "새 리모델링·시공 이야기" },
  { key: "push_estimate_news",   label: "견적 / 시공 후기",  desc: "견적 고민과 실제 후기" },
  { key: "push_lounge_activity", label: "라운지 새 글",      desc: "그 외 관심 카테고리 새 글" },
  { key: "push_chat",            label: "대화 알림",        desc: "대화 신청·수락" },
  { key: "push_escrow",          label: "계약 / 안전결제",   desc: "착공·중간·완료 확인" },
];

const DEFAULTS = {
  push_enabled: false,
  push_local_news: false,
  push_interior_news: false,
  push_estimate_news: false,
  push_company_recommend: false,
  push_lounge_activity: false,
  push_chat: false,
  push_escrow: false,
};

function Switch({ on, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      style={{
        width: 44, height: 26, borderRadius: R.full, border: "none", flexShrink: 0,
        background: on ? C.brand : C.bgWarm, position: "relative",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        transition: "background 0.15s",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20,
        borderRadius: R.full, background: "#fff", transition: "left 0.15s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
      }} />
    </button>
  );
}

export default function PushNotificationSettings({ user }) {
  const [prefs, setPrefs] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!IS_SUPABASE_READY || !user?.id) { setLoading(false); return; }
      const { data } = await getPushPreferences(user.id);
      if (!cancelled) {
        setPrefs({ ...DEFAULTS, ...(data ?? {}) });
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const persist = async (next) => {
    setPrefs(next);
    if (IS_SUPABASE_READY && user?.id) {
      const { push_enabled, push_local_news, push_interior_news, push_estimate_news, push_company_recommend, push_lounge_activity, push_chat, push_escrow } = next;
      // 테이블 미생성(migration 미실행) 등에서도 UI가 멈추지 않도록 방어
      try {
        await upsertPushPreferences(user.id, { push_enabled, push_local_news, push_interior_news, push_estimate_news, push_company_recommend, push_lounge_activity, push_chat, push_escrow });
      } catch {
        setNote("설정 저장에 실패했어요. 잠시 후 다시 시도해주세요.");
      }
    }
  };

  const handleMaster = async () => {
    if (busy) return;
    setNote(null);
    if (prefs.push_enabled) {
      // 끄기 — 환경설정 OFF 저장(+ 가능 시 푸시 토큰 해제 best-effort).
      setBusy(true);
      try { await disablePush(); } catch {}
      await persist({ ...DEFAULTS });
      setBusy(false);
      return;
    }
    // 켜기 — 환경설정은 항상 저장한다(알림 수신 동의). 실제 푸시 토큰 발급은
    // 지원/구성된 환경에서만 best-effort 로 시도하되, 미구성이어도 설정 저장은 막지 않는다.
    setBusy(true);
    try {
      if (isPushSupported() && isPushConfigured()) {
        const res = await enablePush(user?.id);
        if (res && !res.ok && res.reason === "permission_denied") {
          setNote("브라우저 알림 권한이 거부됐어요. 설정에서 허용하면 푸시도 함께 받을 수 있어요.");
        }
      }
    } catch {}
    // 기본적으로 동네/인테리어/견적 + 라운지 새 글(전 카테고리) ON 으로 시작.
    await persist({ ...prefs, push_enabled: true, push_local_news: true, push_interior_news: true, push_estimate_news: true, push_company_recommend: true, push_lounge_activity: true });
    setBusy(false);
  };

  const handleSub = async (key) => {
    if (!prefs.push_enabled || busy) return;
    const next = { ...prefs, [key]: !prefs[key] };
    // "견적/시공 후기" 토글은 업체추천도 함께 제어
    if (key === "push_estimate_news") next.push_company_recommend = next.push_estimate_news;
    await persist(next);
  };

  if (loading) return null;

  return (
    <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S.md }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 2 }}>필요한 소식만 받아보세요</div>
          <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.5 }}>우리 동네 공간 이야기를 알려드릴게요</div>
        </div>
        <Switch on={prefs.push_enabled} disabled={busy} onClick={handleMaster} />
      </div>

      {note && (
        <div style={{ fontSize: 12, color: C.text2, background: C.bg, borderRadius: R.lg, padding: `${S.sm}px ${S.md}px`, marginBottom: S.md, lineHeight: 1.5 }}>{note}</div>
      )}

      <div style={{ borderTop: `1px solid ${C.bg}`, paddingTop: S.sm, opacity: prefs.push_enabled ? 1 : 0.45 }}>
        {SUB_TOGGLES.map(({ key, label, desc }) => (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${S.sm}px 0` }}>
            <div style={{ flex: 1, minWidth: 0, marginRight: S.md }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text2 }}>{label}</div>
              <div style={{ fontSize: 11, color: C.text4, marginTop: 1 }}>{desc}</div>
            </div>
            <Switch on={!!prefs[key]} disabled={!prefs.push_enabled || busy} onClick={() => handleSub(key)} />
          </div>
        ))}
      </div>
    </div>
  );
}
