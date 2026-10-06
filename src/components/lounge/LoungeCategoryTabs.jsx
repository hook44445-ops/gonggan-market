// ─────────────────────────────────────────────────────
// 공간랜드 라운지 시스템 — 카테고리 탭
//   10-01(docs/LOUNGE-USP 점검 C): 첫 줄 = 전체·인기 + 공간 이야기 6칸 · 더보기 = 최근 글이 있는 생활 칸(많은 순)
//   · 최근 글이 0인 생활 칸은 «아직 조용한 칸»으로 흐리게. **아무 칸도 지우지 않는다**(순서는 lib/loungeTabs).
// ─────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { C, R, S } from '../../constants';
import { LOUNGE_CATEGORIES, LOUNGE_INACTIVE_CATEGORIES } from '../../constants/lounge';
import { orderLoungeTabs, tallyCategories } from '../../lib/loungeTabs';
import { getLoungeCategoryCounts } from '../../lib/supabase';

function CatChip({ cat, selected, onChange, quiet = false }) {
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
        color: active ? '#fff' : quiet ? C.text4 : C.text3,
        fontWeight: active ? 800 : 500,
        fontSize: 12,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background 0.15s',
        letterSpacing: '-0.2px',
        opacity: quiet && !active ? 0.75 : 1,
      }}>
      {cat.label}
    </button>
  );
}

export default function LoungeCategoryTabs({ selected, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [counts, setCounts] = useState(null);   // null = 아직 모름(예전 순서)
  useEffect(() => {
    let alive = true;
    getLoungeCategoryCounts().then(({ data }) => { if (alive && data) setCounts(tallyCategories(data)); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const { row, extra, quiet } = orderLoungeTabs(LOUNGE_CATEGORIES, { counts, selected, inactive: LOUNGE_INACTIVE_CATEGORIES });
  const pick = (id) => { onChange(id); setExpanded(false); };

  return (
    <div style={{ background: C.surface, borderBottom: `1px solid ${C.bgWarm}`, padding: `${S.sm}px ${S.xl}px ${S.md}px` }}>
      {/* 한 줄 가로 스크롤 — 전체·인기 + 공간 이야기 */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', alignItems: 'center' }}>
        {row.map(cat => (
          <CatChip key={cat.id} cat={cat} selected={selected} onChange={onChange} />
        ))}
        {(extra.length + quiet.length) > 0 && (
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
            생활 이야기 {expanded ? '▲' : '▾'}
          </button>
        )}
      </div>

      {/* 펼침 — 글 있는 생활 칸 · 그다음 조용한 칸(흐리게) */}
      {expanded && (
        <div style={{ marginTop: S.sm }}>
          {extra.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {extra.map(cat => <CatChip key={cat.id} cat={cat} selected={selected} onChange={pick} />)}
            </div>
          )}
          {quiet.length > 0 && (
            <>
              <div style={{ fontSize: 11, color: C.text4, fontWeight: 700, margin: `${S.sm}px 0 6px` }}>아직 조용한 칸 · 첫 글을 남겨 보세요</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {quiet.map(cat => <CatChip key={cat.id} cat={cat} selected={selected} onChange={pick} quiet />)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
