// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useRef } from 'react';
import { C, R, S } from '../../constants';
import { LOUNGE_CATEGORIES } from '../../constants/lounge';

export default function LoungeCategoryTabs({ selected, onChange }) {
  const scrollRef = useRef(null);

  return (
    <div ref={scrollRef} style={{
      display: 'flex', gap: S.sm, overflowX: 'auto', padding: `${S.sm}px ${S.xl}px`,
      scrollbarWidth: 'none', msOverflowStyle: 'none',
      borderBottom: `1px solid ${C.bgWarm}`, background: C.surface,
    }}>
      {LOUNGE_CATEGORIES.map(cat => {
        const active = selected === cat.id;
        return (
          <button key={cat.id} onClick={() => onChange(cat.id)} style={{
            flexShrink: 0, padding: '6px 14px', borderRadius: R.full, border: 'none',
            background: active ? C.brand : C.bg, color: active ? '#fff' : C.text3,
            fontWeight: active ? 800 : 500, fontSize: 13, cursor: 'pointer',
            whiteSpace: 'nowrap', transition: 'background 0.15s',
          }}>
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
