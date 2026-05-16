// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState } from 'react';
import { C, R, S } from '../../constants';
import { SPACE_TEMPERATURE_BASE } from '../../constants/lounge';

// 알림 받을 수 있는 관심 카테고리
const INTEREST_CATS = [
  { id: 'interior_review', label: '인테리어후기' },
  { id: 'before_after',    label: '시공전/후' },
  { id: 'room_deco',       label: '집꾸미기' },
  { id: 'realestate',      label: '부동산' },
  { id: 'economy',         label: '경제' },
  { id: 'free',            label: '자유' },
  { id: 'worry',           label: '고민' },
  { id: 'neighborhood',    label: '동네' },
  { id: 'pet',             label: '반려동물' },
  { id: 'exercise',        label: '운동' },
];

function Row({ label, icon, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${S.lg}px 0`, borderBottom: `1px solid ${C.bg}`, cursor: onClick ? 'pointer' : 'default' }}>
      <span style={{ fontSize: 14, color: C.text2 }}>{icon} {label}</span>
      {onClick && <span style={{ fontSize: 16, color: C.text3 }}>›</span>}
    </div>
  );
}

// ── 알림 설정 컴포넌트 ──────────────────────────────────
function NotifSettings() {
  const load = (key, def) => {
    try { return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(def)); }
    catch { return def; }
  };

  const [enabled,    setEnabled]    = useState(() => load('lounge_notif_enabled', false));
  const [selected,   setSelected]   = useState(() => load('lounge_notif_cats', []));
  const [permStatus, setPermStatus] = useState(() => typeof Notification !== 'undefined' ? Notification.permission : 'default');
  const [toast,      setToast]      = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const toggleCat = (id) => {
    const next = selected.includes(id) ? selected.filter(c => c !== id) : [...selected, id];
    setSelected(next);
    localStorage.setItem('lounge_notif_cats', JSON.stringify(next));
  };

  const handleEnable = async () => {
    if (!('Notification' in window)) {
      showToast('이 브라우저는 알림을 지원하지 않아요');
      return;
    }
    if (permStatus === 'denied') {
      showToast('브라우저 설정에서 알림을 허용해주세요');
      return;
    }

    const permission = await Notification.requestPermission();
    setPermStatus(permission);

    if (permission === 'granted') {
      const next = !enabled;
      setEnabled(next);
      localStorage.setItem('lounge_notif_enabled', JSON.stringify(next));

      if (next) {
        new Notification('공간마켓 라운지 알림 켜짐 🔔', {
          body: selected.length > 0
            ? `관심 카테고리 ${selected.length}개 새 글을 알려드릴게요!`
            : '관심 카테고리를 선택하면 새 글을 알려드려요',
          icon: '/favicon.ico',
        });
        showToast('✅ 알림이 설정됐어요!');
      } else {
        showToast('알림을 껐어요');
      }
    } else {
      showToast('알림 권한이 거부됐어요. 브라우저 설정에서 허용해주세요.');
    }
  };

  const handleToggle = async () => {
    if (!enabled && permStatus !== 'granted') {
      await handleEnable();
      return;
    }
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem('lounge_notif_enabled', JSON.stringify(next));
    showToast(next ? '✅ 알림을 켰어요' : '알림을 껐어요');
  };

  return (
    <div style={{ background: C.bg, borderRadius: R.lg, padding: S.lg, marginBottom: S.lg }}>
      {/* 알림 ON/OFF 토글 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.md }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>📱 새 글 알림</div>
          <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
            {permStatus === 'denied' ? '브라우저에서 알림 차단됨' : enabled ? '선택한 카테고리 새 글 알림 중' : '알림을 켜보세요'}
          </div>
        </div>
        {/* 토글 스위치 */}
        <div
          onClick={handleToggle}
          style={{
            width: 48, height: 26, borderRadius: 13,
            background: enabled ? C.brand : C.bgWarm,
            cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
          }}>
          <div style={{
            position: 'absolute', top: 3,
            left: enabled ? 25 : 3,
            width: 20, height: 20, borderRadius: '50%',
            background: '#fff', transition: 'left 0.2s',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }} />
        </div>
      </div>

      {/* 관심 카테고리 선택 */}
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: S.sm }}>관심 카테고리 선택</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {INTEREST_CATS.map(cat => {
          const active = selected.includes(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => toggleCat(cat.id)}
              style={{
                padding: '6px 12px', borderRadius: R.full,
                border: active ? 'none' : `1px solid ${C.bgWarm}`,
                background: active ? C.brand : C.surface,
                color: active ? '#fff' : C.text3,
                fontWeight: active ? 700 : 500,
                fontSize: 12, cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              {active ? '✓ ' : ''}{cat.label}
            </button>
          );
        })}
      </div>

      {selected.length > 0 && !enabled && (
        <button
          onClick={handleEnable}
          style={{
            width: '100%', marginTop: S.md, padding: '11px',
            background: `linear-gradient(135deg, ${C.brand}, ${C.brandD})`,
            color: '#fff', border: 'none', borderRadius: R.lg,
            fontWeight: 800, fontSize: 13, cursor: 'pointer',
          }}>
          🔔 알림 허용하기
        </button>
      )}

      {/* 토스트 */}
      {toast && (
        <div style={{ marginTop: S.sm, background: C.brand, color: '#fff', borderRadius: R.lg, padding: '10px 14px', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── 메인 섹션 ──────────────────────────────────────────
export default function LoungeMyPageSection({ user, temperature, balance, onNavigate }) {
  const temp   = temperature ?? SPACE_TEMPERATURE_BASE;
  const isComp = user?.role === 'company';

  const level = temp >= 45 ? { label: '홈마스터', icon: '👑' }
    : temp >= 40 ? { label: '드림하우스', icon: '🏰' }
    : temp >= 36 ? { label: '다정한 이웃', icon: '🏡' }
    : { label: '새 이웃', icon: '🏠' };

  return (
    <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.lg }}>라운지</div>

      {/* 공간온도 */}
      <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.brandM}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.sm }}>
          <div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: 4 }}>공간온도 🌡️</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.brand }}>{temp.toFixed(1)}°C</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20 }}>{level.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.brand, marginTop: 4 }}>{level.label}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: S.md, marginTop: S.sm }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>98%</div>
            <div style={{ fontSize: 10, color: C.text3 }}>후기 신뢰도</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>92%</div>
            <div style={{ fontSize: 10, color: C.text3 }}>재계약률</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>빠름</div>
            <div style={{ fontSize: 10, color: C.text3 }}>응답속도</div>
          </div>
        </div>
      </div>

      {/* 토큰 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.bg, borderRadius: R.lg, padding: `${S.md}px ${S.lg}px`, marginBottom: S.lg }}>
        <div>
          <div style={{ fontSize: 11, color: C.text3, marginBottom: 2 }}>보유 공간토큰</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.text1 }}>{(balance ?? 0).toLocaleString()} 토큰</div>
        </div>
        <button onClick={() => onNavigate?.('token-store')} style={{ background: C.brand, color: '#fff', border: 'none', borderRadius: R.full, padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          스토어
        </button>
      </div>

      {/* 알림 설정 */}
      <div style={{ borderTop: `1px solid ${C.bg}`, paddingTop: S.md, marginBottom: S.sm }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: S.sm }}>알림 설정</div>
        <NotifSettings />
      </div>

      {/* 내 활동 */}
      <div style={{ borderTop: `1px solid ${C.bg}`, paddingTop: S.md }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: S.sm }}>내 활동</div>
        <Row label="내가 쓴 글"   icon="📝" onClick={() => onNavigate?.('my-posts')} />
        <Row label="저장한 글"    icon="🔖" onClick={() => onNavigate?.('my-saves')} />
        <Row label="내 댓글"      icon="💬" onClick={() => onNavigate?.('my-comments')} />

        <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, margin: `${S.md}px 0 ${S.sm}px` }}>공간토큰</div>
        <Row label="보유 내역"      icon="📊" onClick={() => onNavigate?.('token-history')} />
        <Row label="대화 신청 내역" icon="💬" onClick={() => onNavigate?.('chat-history')} />

        <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, margin: `${S.md}px 0 ${S.sm}px` }}>설정</div>
        <Row label="커뮤니티 미션"  icon="🎯" onClick={() => onNavigate?.('missions')} />
        <Row label="익명 보호 설정" icon="🛡" onClick={() => onNavigate?.('privacy')} />
        <Row label="차단 관리"      icon="🚫" onClick={() => onNavigate?.('blocks')} />

        {isComp && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, margin: `${S.md}px 0 ${S.sm}px` }}>업체 전용</div>
            <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.lg, border: `1px solid ${C.brandM}` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.brand }}>🏆 초기 파트너 혜택 중</div>
              <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>전문가 답변 배지 무료 사용</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
