// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { C, R, S } from '../../constants';
import { SPACE_TEMPERATURE_BASE } from '../../constants/lounge';

function Row({ label, icon, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${S.lg}px 0`, borderBottom: `1px solid ${C.bg}`, cursor: onClick ? 'pointer' : 'default' }}>
      <span style={{ fontSize: 14, color: C.text2 }}>{icon} {label}</span>
      {onClick && <span style={{ fontSize: 16, color: C.text3 }}>›</span>}
    </div>
  );
}

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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.bg, borderRadius: R.lg, padding: `${S.md}px ${S.lg}px`, marginBottom: S.lg }}>
        <div>
          <div style={{ fontSize: 11, color: C.text3, marginBottom: 2 }}>보유 공간토큰</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.text1 }}>{(balance ?? 0).toLocaleString()} 토큰</div>
        </div>
        <button onClick={() => onNavigate?.('token-store')} style={{ background: C.brand, color: '#fff', border: 'none', borderRadius: R.full, padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          스토어
        </button>
      </div>

      <div style={{ borderTop: `1px solid ${C.bg}`, paddingTop: S.md }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: S.sm }}>내 활동</div>
        <Row label="내가 쓴 글"   icon="📝" onClick={() => onNavigate?.('my-posts')} />
        <Row label="받은 좋아요"  icon="❤️" onClick={() => onNavigate?.('my-likes')} />
        <Row label="저장한 글"    icon="🔖" onClick={() => onNavigate?.('my-saves')} />
        <Row label="내 댓글"      icon="💬" onClick={() => onNavigate?.('my-comments')} />

        <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, margin: `${S.md}px 0 ${S.sm}px` }}>공간토큰</div>
        <Row label="보유 내역"      icon="📊" onClick={() => onNavigate?.('token-history')} />
        <Row label="대화 신청 내역" icon="💬" onClick={() => onNavigate?.('chat-history')} />

        <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, margin: `${S.md}px 0 ${S.sm}px` }}>설정</div>
        <Row label="커뮤니티 미션"  icon="🎯" onClick={() => onNavigate?.('missions')} />
        <Row label="관심 카테고리"  icon="🗂" onClick={() => onNavigate?.('interests')} />
        <Row label="익명 보호 설정" icon="🛡" onClick={() => onNavigate?.('privacy')} />
        <Row label="차단 관리"      icon="🚫" onClick={() => onNavigate?.('blocks')} />
        <Row label="신고 내역"      icon="⚠️" onClick={() => onNavigate?.('reports')} />

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
