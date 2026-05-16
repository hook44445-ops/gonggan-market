// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { C, R, S } from '../../constants';

function StoryCircle({ nickname, color }) {
  const colors = ['#2E5F4B','#C8A15A','#3A7A5C','#1D3D2F','#B08040'];
  const bg = color ?? colors[nickname.charCodeAt(0) % colors.length];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <div style={{
        width: 56, height: 56, borderRadius: R.full,
        background: `linear-gradient(135deg, ${bg}, ${bg}88)`,
        border: `2.5px solid ${bg}`, padding: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, color: '#fff', fontWeight: 900,
        boxShadow: `0 2px 8px ${bg}44`,
      }}>
        {nickname[0]}
      </div>
      <div style={{ fontSize: 10, color: C.text3, maxWidth: 56, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {nickname}
      </div>
    </div>
  );
}

export default function LoungeStoryBar({ stories, onStoryClick }) {
  if (!stories || stories.length === 0) return null;

  return (
    <div style={{ background: C.surface, borderBottom: `1px solid ${C.bgWarm}`, padding: `${S.md}px ${S.xl}px` }}>
      <div style={{ fontSize: 12, color: C.text3, fontWeight: 700, marginBottom: S.sm }}>📸 실시간 스토리</div>
      <div style={{ display: 'flex', gap: S.lg, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {stories.map(story => (
          <div key={story.id} onClick={() => onStoryClick?.(story)} style={{ cursor: 'pointer' }}>
            <StoryCircle nickname={story.anonymous_nickname} />
          </div>
        ))}
      </div>
    </div>
  );
}
