// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState } from 'react';
import { C, R, S } from '../../constants';
import { LOUNGE_CATEGORIES } from '../../constants/lounge';

const ALL_CATS = LOUNGE_CATEGORIES;
// 기본 한 줄에 보여줄 카테고리 (all, popular 포함 처음 8개)
const PREVIEW_CATS = ALL_CATS.slice(0, 8);
const EXTRA_CATS   = ALL_CATS.slice(8);

function CatChip({ cat, selected, onChange }) {
  const active = selected === cat.id;
  return (
    <button
      onClick={() => onChange(cat.id)}
      style={{
        flexShrink: 0,
        padding: '6px 14px',
        borderRadius: R.full,
        border: active ? 'none' : `1px solid ${C.bgWarm}`,
        background: active ? C.brand : C.bg,
        color: active ? '#fff' : C.text3,
        fontWeight: active ? 800 : 500,
        fontSize: 12,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 0.15s',
        letterSpacing: '-0.2px',
      }}>
      {cat.label}
    </button>
  );
}

export default function LoungeCategoryTabs({ selected, onChange }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ background: C.surface, borderBottom: `1px solid ${C.bgWarm}`, padding: `${S.sm}px ${S.xl}px ${S.md}px` }}>
      {/* 한 줄 가로 스크롤 */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', alignItems: 'center' }}>
        {PREVIEW_CATS.map(cat => (
          <CatChip key={cat.id} cat={cat} selected={selected} onChange={onChange} />
        ))}
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            flexShrink: 0,
            padding: '6px 12px',
            borderRadius: R.full,
            border: `1px solid ${C.bgWarm}`,
            background: expanded ? C.brandL : C.bg,
            color: expanded ? C.brand : C.text3,
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
          }}>
          더보기 {expanded ? '▲' : '▾'}
        </button>
      </div>

      {/* 펼침: 2줄 그리드 */}
      {expanded && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: S.sm }}>
          {EXTRA_CATS.map(cat => (
            <CatChip key={cat.id} cat={cat} selected={selected} onChange={(id) => { onChange(id); setExpanded(false); }} />
          ))}
        </div>
      )}
    </div>
  );
}
