// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState } from 'react';
import { C, R, S } from '../constants';
import { formatRelativeTime } from '../utils/anonymousNickname';
import { getEarnDescription, getSpendDescription } from '../utils/tokenCalculator';

export default function TokenHistoryScreen({ balance, logs = [], onBack }) {
  const [tab, setTab] = useState('all');

  const filtered = tab === 'all' ? logs
    : tab === 'earn'    ? logs.filter(l => l.type === 'earn')
    : tab === 'spend'   ? logs.filter(l => l.type === 'spend')
    : logs.filter(l => l.action === 'purchase');

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 40 }}>
      <div style={{ background: C.surface, padding: `14px ${S.xl}px`, display: 'flex', alignItems: 'center', gap: S.md, borderBottom: `1px solid ${C.bgWarm}`, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.text1, padding: 0 }}>←</button>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>토큰 내역</div>
      </div>

      <div style={{ background: C.surface, padding: S.xl, marginBottom: S.sm, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: C.text3 }}>현재 보유 토큰</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: C.brand, marginTop: 4 }}>{(balance ?? 0).toLocaleString()} 토큰</div>
      </div>

      <div style={{ display: 'flex', margin: `0 ${S.xl}px ${S.sm}px`, background: C.surface, borderRadius: R.lg, padding: S.xs, border: `1px solid ${C.bgWarm}` }}>
        {[['all','전체'],['earn','적립'],['spend','사용'],['purchase','구매']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: '9px', border: 'none', borderRadius: R.md, background: tab === id ? C.brandL : 'transparent', color: tab === id ? C.brand : C.text3, fontWeight: tab === id ? 800 : 500, fontSize: 13, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: `0 ${S.xl}px` }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 13, color: C.text3 }}>내역이 없어요</div>
          </div>
        ) : (
          <div style={{ background: C.surface, borderRadius: R.xl, border: `1px solid ${C.bgWarm}`, overflow: 'hidden' }}>
            {filtered.map((log, i) => {
              const isEarn = log.type === 'earn';
              const desc   = isEarn ? getEarnDescription(log.action) : getSpendDescription(log.action);
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${S.lg}px ${S.xl}px`, borderBottom: i < filtered.length - 1 ? `1px solid ${C.bg}` : 'none' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>{log.description ?? desc}</div>
                    <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{formatRelativeTime(log.created_at)}</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: isEarn ? C.brand : C.red }}>
                    {isEarn ? '+' : '-'}{log.amount.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
