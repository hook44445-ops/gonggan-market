// ─────────────────────────────────────────────────────
// 마이페이지 · 푸시 알림 설정 (기본 전체 OFF · 동의 후 ON)
// ─────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { C, R, S } from "../constants";
import { IS_SUPABASE_READY, getPushPreferences, upsertPushPreferences, setMarketingConsent } from "../lib/supabase";
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
  push_marketing: false,
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
      // 광고 동의(157)는 전체 알림과 따로 남는다 — 화면도 서버 값 그대로 보여 준다(끈 줄 알았는데 다시 켜면 광고가 오는 일 방지)
      await persist({ ...DEFAULTS, push_marketing: prefs.push_marketing });
      if (prefs.push_marketing) setNote("푸시 알림을 껐어요. 이벤트·혜택 알림(광고) 동의는 그대로예요 — 받지 않으려면 아래 스위치도 꺼 주세요.");
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

  // 이벤트·혜택 알림(광고 · 157) — 따로 동의받는다. 전체 알림을 꺼도 동의 여부는 그대로 남는다(보내는 건 둘 다 켜졌을 때만).
  const handleMarketing = async () => {
    if (busy) return;
    const on = !prefs.push_marketing;
    setBusy(true); setNote(null);
    try {
      const { data, error } = await setMarketingConsent(on);
      if (error || !data?.ok) throw error ?? new Error("FAIL");
      setPrefs((p) => ({ ...p, push_marketing: on }));
      setNote(on
        ? `${data.day} 이벤트·혜택 알림(광고) 수신에 동의하셨어요. 언제든 여기서 끌 수 있어요.`
        : `${data.day} 이벤트·혜택 알림(광고) 수신을 철회하셨어요.`);
    } catch {
      setNote("지금은 바꿀 수 없어요. 잠시 후 다시 시도해 주세요.");
    }
    setBusy(false);
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

      <div style={{ borderTop: `1px solid ${C.bgWarm}`, marginTop: S.sm, paddingTop: S.md, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0, marginRight: S.md }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>이벤트·혜택 알림 (광고)</div>
          <div style={{ fontSize: 11.5, color: C.text3, marginTop: 2, lineHeight: 1.55 }}>
            초대 이벤트·토큰 혜택 소식을 푸시로 받아요(선택). 한국 시간 낮 9시~저녁 8시에만, 제목에 「(광고)」를 붙여 보내요.
            위 알림이 켜져 있어야 받을 수 있어요.
          </div>
        </div>
        <Switch on={!!prefs.push_marketing} disabled={busy} onClick={handleMarketing} />
      </div>
    </div>
  );
}
