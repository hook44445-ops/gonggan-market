// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { C, R, S } from '../../constants';
import { CATEGORY_LABEL } from '../../constants/lounge';
import { formatRelativeTime, getAnonymousAvatarByNickname } from '../../utils/anonymousNickname';

export default function LoungePostCard({ post, onClick }) {
  const catLabel = CATEGORY_LABEL[post.category] ?? post.category;
  const isBoosted = post.boost_until && new Date(post.boost_until) > new Date();
  const avatar = getAnonymousAvatarByNickname(post.anonymous_nickname);

  return (
    <div onClick={onClick} style={{
      background: C.surface, borderRadius: R.xl, padding: S.xl,
      marginBottom: S.sm, border: `1px solid ${isBoosted ? C.brandM : C.bgWarm}`,
      cursor: 'pointer', position: 'relative', overflow: 'hidden',
    }}>
      {isBoosted && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: C.brand }} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginBottom: S.sm, flexWrap: 'wrap' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: avatar.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0, boxShadow: `0 2px 6px ${avatar.color}55`,
        }}>
          {avatar.emoji}
        </div>
        <span style={{ fontWeight: 800, fontSize: 13, color: C.text1 }}>{post.anonymous_nickname}</span>
        <span style={{ background: C.brandL, color: C.brand, borderRadius: R.full, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
          {catLabel}
        </span>
        {post.region && (
          <span style={{ fontSize: 11, color: C.text3 }}>📍 {post.region}</span>
        )}
        {post.gender && (
          <span style={{ fontSize: 11, color: C.text4 }}>{post.gender === 'male' ? '남' : '여'}</span>
        )}
        {post.age_group && (
          <span style={{ fontSize: 11, color: C.text4 }}>{post.age_group}</span>
        )}
        <span style={{ fontSize: 11, color: C.text4, marginLeft: 'auto' }}>{formatRelativeTime(post.created_at)}</span>
      </div>

      {post.title && (
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: S.xs, lineHeight: 1.4 }}>
          {post.title}
        </div>
      )}

      <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6, marginBottom: S.md,
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {post.content}
      </div>

      {post.image_urls && post.image_urls.length > 0 && (
        <div style={{ display: 'flex', gap: S.sm, marginBottom: S.md, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {post.image_urls.slice(0, 3).map((url, i) => (
            <img key={i} src={url} alt="" style={{ width: 80, height: 80, borderRadius: R.md, objectFit: 'cover', flexShrink: 0 }} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: S.lg, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: C.text3 }}>👁 {post.view_count.toLocaleString()}</span>
        <span style={{ fontSize: 12, color: C.text3 }}>❤️ {post.like_count}</span>
        <span style={{ fontSize: 12, color: C.text3 }}>💬 {post.comment_count}</span>
        {isBoosted && (
          <span style={{ fontSize: 11, background: C.brandL, color: C.brand, borderRadius: R.full, padding: '2px 8px', fontWeight: 700, marginLeft: 'auto' }}>
            📌 상단고정
          </span>
        )}
      </div>
    </div>
  );
}
