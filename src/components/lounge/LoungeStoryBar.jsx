// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { C, R, S } from '../../constants';
import { getAnonymousAvatarByNickname } from '../../utils/anonymousNickname';

function StoryCircle({ nickname }) {
  const { emoji, color } = getAnonymousAvatarByNickname(nickname);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <div style={{
        width: 56, height: 56, borderRadius: R.full,
        background: color,
        border: `2.5px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26,
        boxShadow: `0 2px 8px ${color}55`,
      }}>
        {emoji}
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
