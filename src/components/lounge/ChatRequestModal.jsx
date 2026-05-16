// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { C, R, S } from '../../constants';
import { TOKEN_COSTS } from '../../constants/lounge';

export default function ChatRequestModal({ balance, onConfirm, onCancel }) {
  const cost = TOKEN_COSTS.CHAT_REQUEST;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,42,36,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 500 }}>
      <div style={{ background: C.surface, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '24px 24px 40px' }}>
        <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: '0 auto 20px' }} />

        <div style={{ textAlign: 'center', marginBottom: S.xl }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, marginBottom: 6 }}>대화 신청</div>
          <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.6 }}>
            지금은 토큰이 차감되지 않아요<br/>상대방이 <strong style={{ color: C.brand }}>수락</strong>하면 {cost}토큰이 차감됩니다
          </div>
        </div>

        {/* 플로우 안내 */}
        <div style={{ background: C.bg, borderRadius: R.lg, padding: S.lg, marginBottom: S.xl }}>
          {[
            { icon: '📩', text: '신청 전송 (무료)' },
            { icon: '🔔', text: '상대방에게 알림 발송' },
            { icon: '✅', text: '수락 시 20토큰 차감 후 대화방 생성' },
            { icon: '❌', text: '거절 시 토큰 차감 없음' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginBottom: i < 3 ? S.sm : 0 }}>
              <span style={{ fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: 13, color: i === 2 ? C.brand : C.text2, fontWeight: i === 2 ? 700 : 500 }}>{item.text}</span>
            </div>
          ))}
        </div>

        <div style={{ background: C.brandL, borderRadius: R.lg, padding: `${S.sm}px ${S.lg}px`, marginBottom: S.xl, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: C.text3 }}>현재 보유 토큰</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: balance >= cost ? C.brand : C.red }}>{balance.toLocaleString()} 토큰</span>
        </div>

        {balance < cost && (
          <div style={{ background: '#FEF0F0', borderRadius: R.lg, padding: S.md, marginBottom: S.lg, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: C.red, fontWeight: 700 }}>수락 시 토큰이 부족할 수 있어요. 미리 충전해두세요.</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: S.sm }}>
          <button onClick={onCancel} style={{ flex: 1, padding: S.xl, background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            취소
          </button>
          <button onClick={onConfirm} style={{ flex: 2, padding: S.xl, background: C.brand, color: '#fff', border: 'none', borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: `0 4px 16px ${C.brand}44` }}>
            신청하기
          </button>
        </div>
      </div>
    </div>
  );
}
