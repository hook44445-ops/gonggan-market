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
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, marginBottom: 8 }}>대화 신청</div>
          <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.6 }}>
            신청은 무료입니다.<br/>
            상대방이 수락하면 <strong style={{ color: C.brand }}>{cost}토큰</strong>이 차감됩니다.
          </div>
        </div>

        <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.xl, marginBottom: S.xl, border: `1px solid ${C.brandM}` }}>
          {[
            ['현재 보유 토큰', `${balance.toLocaleString()} 토큰`],
            ['수락 시 차감', `${cost} 토큰`],
            ['수락 후 잔액',  `${Math.max(0, balance - cost).toLocaleString()} 토큰`],
          ].map(([label, val], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < 2 ? S.sm : 0 }}>
              <span style={{ fontSize: 13, color: C.text3 }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: i === 1 ? C.brand : C.text1 }}>
                {i === 1 ? `-${val}` : val}
              </span>
            </div>
          ))}
        </div>

        {balance < cost && (
          <div style={{ background: '#FEF0F0', borderRadius: R.lg, padding: S.md, marginBottom: S.lg, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: C.red, fontWeight: 700 }}>수락 시 토큰이 부족할 수 있어요</div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>지금 신청할 수 있지만 수락 전에 토큰을 충전해주세요</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: S.sm }}>
          <button onClick={onCancel} style={{ flex: 1, padding: S.xl, background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            취소
          </button>
          <button onClick={onConfirm}
            style={{ flex: 2, padding: S.xl, background: C.brand, color: '#fff', border: 'none', borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: `0 4px 16px ${C.brand}44` }}>
            신청하기
          </button>
        </div>
      </div>
    </div>
  );
}
