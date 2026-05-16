// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// 토큰 = 진짜 관심과 가벼운 접근을 구분하는 장치
// ─────────────────────────────────────────────────────

import { C, R, S } from '../../constants';
import { TOKEN_COSTS } from '../../constants/lounge';

export default function ChatRequestModal({ balance, onConfirm, onCancel }) {
  const cost    = TOKEN_COSTS.CHAT_REQUEST;
  const canSend = balance >= cost;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,42,36,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 500 }}>
      <div style={{ background: C.surface, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '24px 24px 40px' }}>
        <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: '0 auto 20px' }} />

        <div style={{ textAlign: 'center', marginBottom: S.xxl }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, marginBottom: 8 }}>대화 신청</div>
        </div>

        <div style={{ background: C.bg, borderRadius: R.lg, padding: S.xl, marginBottom: S.xl }}>
          {[
            ['현재 보유 토큰', `${balance.toLocaleString()} 토큰`],
            ['대화 신청 비용', `${cost} 토큰`],
            ['신청 후 잔액', `${Math.max(0, balance - cost).toLocaleString()} 토큰`],
          ].map(([label, val], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < 2 ? S.sm : 0 }}>
              <span style={{ fontSize: 13, color: C.text3 }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: i === 1 ? C.red : C.text1 }}>
                {i === 1 ? `-${val}` : val}
              </span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: C.text3, textAlign: 'center', marginBottom: S.xl, lineHeight: 1.6 }}>
          상대방이 수락하면 대화방이 생성됩니다.<br/>
          거절 시 토큰은 반환되지 않습니다.
        </div>

        {!canSend && (
          <div style={{ background: '#FEF0F0', borderRadius: R.lg, padding: S.md, marginBottom: S.lg, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: C.red, fontWeight: 700 }}>토큰이 부족합니다</div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>토큰 스토어에서 충전 후 이용해주세요</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: S.sm }}>
          <button onClick={onCancel} style={{ flex: 1, padding: S.xl, background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            취소
          </button>
          <button onClick={canSend ? onConfirm : undefined}
            style={{ flex: 2, padding: S.xl, background: canSend ? C.brand : C.text4, color: '#fff', border: 'none', borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: canSend ? 'pointer' : 'not-allowed', boxShadow: canSend ? `0 4px 16px ${C.brand}44` : 'none' }}>
            {canSend ? '신청하기' : '토큰 부족'}
          </button>
        </div>
      </div>
    </div>
  );
}
