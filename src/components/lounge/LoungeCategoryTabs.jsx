// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { C, R, S } from '../../constants';

// 중요도 순 상위 카테고리 — 2줄 × 5개
const ROW1 = [
  { id: 'all',             label: '전체' },
  { id: 'popular',         label: '🔥 인기' },
  { id: 'interior_review', label: '인테리어후기' },
  { id: 'free',            label: '자유' },
  { id: 'worry',           label: '고민' },
];
const ROW2 = [
  { id: 'room_deco',       label: '집꾸미기' },
  { id: 'neighborhood',    label: '동네' },
  { id: 'realestate',      label: '부동산' },
  { id: 'pet',             label: '반려동물' },
  { id: 'economy',         label: '경제' },
];

function ChipRow({ cats, selected, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {cats.map(cat => {
        const active = selected === cat.id;
        return (
          <button key={cat.id} onClick={() => onChange(cat.id)} style={{
            flex: 1,
            padding: '7px 4px',
            borderRadius: R.full,
            border: active ? 'none' : `1px solid ${C.bgWarm}`,
            background: active ? C.brand : C.surface,
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
      })}
    </div>
  );
}

export default function LoungeCategoryTabs({ selected, onChange }) {
  return (
    <div style={{
      background: C.surface,
      padding: `${S.sm}px ${S.xl}px ${S.md}px`,
      borderBottom: `1px solid ${C.bgWarm}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <ChipRow cats={ROW1} selected={selected} onChange={onChange} />
      <ChipRow cats={ROW2} selected={selected} onChange={onChange} />
    </div>
  );
}
