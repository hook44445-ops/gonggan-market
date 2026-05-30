// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState } from 'react';
import { C, R, S } from '../../constants';
import { SHOW_DEBUG_UI } from '../../constants/release';
import { getMissionList } from '../../utils/tokenCalculator';

function ProgressBar({ current, total }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: C.text4 }}>{current} / {total}</span>
        <span style={{ fontSize: 10, color: C.brand, fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: C.bg, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: C.brand, borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

function DevMissionPanel({ missions, balance }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: '#0d1117', borderRadius: R.md, border: '1px solid #30363d', marginTop: 12, fontFamily: 'monospace', fontSize: 11 }}>
      <div onClick={() => setOpen(v => !v)} style={{ padding: '6px 12px', cursor: 'pointer', color: '#58a6ff', display: 'flex', justifyContent: 'space-between' }}>
        <span>🔧 DEV — Mission State</span>
        <span>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding: '0 12px 10px', color: '#e6edf3', lineHeight: 1.8 }}>
          <div style={{ color: '#79c0ff', marginBottom: 4 }}>wallet: {balance}</div>
          {missions.map(m => (
            <div key={m.action} style={{ borderTop: '1px solid #21262d', paddingTop: 4, marginTop: 4 }}>
              <div>mission_id  : <span style={{ color: '#79c0ff' }}>{m.action}</span></div>
              <div>earned      : <span style={{ color: m.done ? '#3fb950' : '#f85149' }}>{m.done ? 'true' : 'false'}</span></div>
              <div>token_delta : <span style={{ color: '#e3b341' }}>+{m.reward}</span></div>
              {m.progress && <div>progress    : <span style={{ color: '#79c0ff' }}>{m.progress.current}/{m.progress.total}</span></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MissionList({ logs = [], missionStats = null, balance = 0, onComplete }) {
  const missions = getMissionList(logs, missionStats);
  const [grantLog, setGrantLog] = useState({});

  const handleComplete = async (action, reward) => {
    const walletBefore = balance;
    const granted = await onComplete?.(action);
    const walletAfter = walletBefore + (granted ? reward : 0);
    setGrantLog(prev => ({ ...prev, [action]: { reward_granted: !!granted, token_delta: reward, wallet_before: walletBefore, wallet_after: walletAfter } }));
    if (import.meta.env.DEV) {
      console.log('[MissionList]', { mission_id: action, earned: true, reward_granted: !!granted, token_delta: reward, wallet_before: walletBefore, wallet_after: walletAfter });
    }
  };

  return (
    <div>
      {missions.map(m => (
        <div key={m.action} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${S.lg}px 0`, borderBottom: `1px solid ${C.bg}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: S.md, flex: 1, minWidth: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: R.full, background: m.done ? C.brandL : C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, marginTop: 2 }}>
              {m.done ? '✅' : '📋'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: m.done ? C.text3 : C.text1 }}>{m.label}</div>
              <div style={{ fontSize: 11, color: C.brand, fontWeight: 700, marginTop: 2 }}>+{m.reward} 토큰</div>
              {m.progress && !m.done && <ProgressBar current={m.progress.current} total={m.progress.total} />}
            </div>
          </div>
          <div style={{ flexShrink: 0, marginLeft: S.sm }}>
            {m.done ? (
              <span style={{ fontSize: 11, color: C.text4, fontWeight: 700 }}>획득완료</span>
            ) : (
              <button
                onClick={() => handleComplete(m.action, m.reward)}
                style={{ background: C.brand, color: '#fff', border: 'none', borderRadius: R.full, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                도전
              </button>
            )}
          </div>
        </div>
      ))}

      {SHOW_DEBUG_UI && <DevMissionPanel missions={missions} balance={balance} />}
    </div>
  );
}
