// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { C, R, S } from '../../constants';

export default function TokenBalance({ balance, onStore, onHistory }) {
  return (
    <div style={{ background: `linear-gradient(135deg, ${C.brand}, ${C.brandD})`, borderRadius: R.xl, padding: S.xl, color: '#fff' }}>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>보유 공간토큰</div>
      <div style={{ fontSize: 32, fontWeight: 900, marginBottom: S.lg }}>{(balance ?? 0).toLocaleString()} 토큰</div>
      <div style={{ display: 'flex', gap: S.sm }}>
        <button onClick={onStore} style={{ flex: 1, background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: R.lg, padding: '10px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          토큰 충전
        </button>
        <button onClick={onHistory} style={{ flex: 1, background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: R.lg, padding: '10px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          내역 보기
        </button>
      </div>
    </div>
  );
}
