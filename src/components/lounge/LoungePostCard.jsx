// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { C, R, S } from '../../constants';
import { formatRelativeTime, getAnonymousAvatarByNickname } from '../../utils/anonymousNickname';
import { CATEGORY_LABEL } from '../../constants/lounge';

export default function LoungePostCard({ post, onClick }) {
  const catLabel = CATEGORY_LABEL[post.category] ?? post.category;
  const isBoosted = post.boost_until && new Date(post.boost_until) > new Date();
  const avatar = getAnonymousAvatarByNickname(post.anonymous_nickname);

  return (
    <div onClick={onClick} style={{
      background: C.surface,
      padding: `14px ${S.xl}px`,
      borderBottom: `1px solid ${C.bgWarm}`,
      cursor: 'pointer',
      position: 'relative',
    }}>
      {isBoosted && (
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: C.brand }} />
      )}

      {/* 카테고리 · 지역 · 시간 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{
          background: C.brandL, color: C.brand,
          borderRadius: R.full, padding: '2px 9px',
          fontSize: 11, fontWeight: 700,
        }}>
          {catLabel}
        </span>
        {post.region && <span style={{ fontSize: 11, color: C.text4 }}>· {post.region}</span>}
        {post.age_group && <span style={{ fontSize: 11, color: C.text4 }}>· {post.age_group}</span>}
        <span style={{ fontSize: 11, color: C.text4, marginLeft: 'auto' }}>
          {formatRelativeTime(post.created_at)}
        </span>
      </div>

      {/* 제목 */}
      {post.title && (
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, lineHeight: 1.4, marginBottom: 4 }}>
          {post.title}
        </div>
      )}

      {/* 본문 미리보기 */}
      <div style={{
        fontSize: 13, color: C.text2, lineHeight: 1.65, marginBottom: 10,
        display: '-webkit-box', WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {post.content}
      </div>

      {/* 이미지 썸네일 */}
      {post.image_urls && post.image_urls.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {post.image_urls.slice(0, 4).map((url, i) => (
            <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
              <img src={url} alt="" style={{ width: 72, height: 72, borderRadius: R.sm, objectFit: 'cover', display: 'block' }} />
              {i === 3 && post.image_urls.length > 4 && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', borderRadius: R.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 800 }}>
                  +{post.image_urls.length - 4}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 하단: 작성자 + 통계 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          background: avatar.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, flexShrink: 0,
        }}>
          {avatar.emoji}
        </div>
        <span style={{ fontSize: 12, color: C.text3, fontWeight: 600 }}>
          {post.has_badge && <span style={{ fontSize: 11, marginRight: 2 }}>🛡️</span>}
          {post.anonymous_nickname}
        </span>
        {post.gender && (
          <span style={{ fontSize: 11, color: C.text4 }}>
            · {post.gender === 'male' ? '남' : '여'}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <span style={{ fontSize: 11, color: C.text4 }}>👁 {(post.view_count ?? 0).toLocaleString()}</span>
          <span style={{ fontSize: 11, color: C.text4 }}>❤️ {post.like_count ?? 0}</span>
          <span style={{ fontSize: 11, color: C.text4 }}>💬 {post.comment_count ?? 0}</span>
        </div>
      </div>
    </div>
  );
}
