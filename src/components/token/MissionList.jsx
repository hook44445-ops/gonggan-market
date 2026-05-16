// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { C, R, S } from '../../constants';
import { getMissionList } from '../../utils/tokenCalculator';

export default function MissionList({ logs = [], onComplete }) {
  const missions = getMissionList(logs);

  return (
    <div>
      {missions.map(m => (
        <div key={m.action} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${S.lg}px 0`, borderBottom: `1px solid ${C.bg}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: S.md }}>
            <div style={{ width: 36, height: 36, borderRadius: R.full, background: m.done ? C.brandL : C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
              {m.done ? '✅' : '📋'}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: m.done ? C.text3 : C.text1 }}>{m.label}</div>
              <div style={{ fontSize: 11, color: C.brand, fontWeight: 700, marginTop: 2 }}>+{m.reward} 토큰</div>
            </div>
          </div>
          {m.done ? (
            <span style={{ fontSize: 11, color: C.text4, fontWeight: 700 }}>완료</span>
          ) : (
            <button onClick={() => onComplete?.(m.action)} style={{ background: C.brand, color: '#fff', border: 'none', borderRadius: R.full, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              도전
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
