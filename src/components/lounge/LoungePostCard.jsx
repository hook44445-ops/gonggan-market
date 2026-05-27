// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { C, R, S } from '../../constants';
import { formatRelativeTime, getAnonymousAvatarByNickname } from '../../utils/anonymousNickname';
import { CATEGORY_LABEL } from '../../constants/lounge';

export default function LoungePostCard({ post, onClick }) {
  const catLabel   = CATEGORY_LABEL[post.category] ?? post.category;
  const avatar     = getAnonymousAvatarByNickname(post.anonymous_nickname);
  const hasImage   = post.image_urls?.length > 0;
  const thumbUrl   = hasImage ? post.image_urls[0] : null;
  const hasTitle   = !!post.title;

  return (
    <div onClick={onClick} style={{
      background: C.surface,
      padding: `14px ${S.xl}px`,
      borderBottom: `1px solid ${C.bgWarm}`,
      cursor: 'pointer',
    }}>

      {/* Row 1: 카테고리 · 지역 · 연령 ··· 시간 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{
          background: C.brandL, color: C.brand,
          borderRadius: R.full, padding: '2px 9px',
          fontSize: 11, fontWeight: 700,
        }}>
          {catLabel}
        </span>
        {post.is_seed && (
          <span style={{
            background: C.bgWarm, color: C.text3,
            borderRadius: R.full, padding: '2px 7px',
            fontSize: 10, fontWeight: 600,
          }}>운영</span>
        )}
        {post.region    && <span style={{ fontSize: 11, color: C.text4 }}>· {post.region}</span>}
        {post.age_group && <span style={{ fontSize: 11, color: C.text4 }}>· {post.age_group}</span>}
        <span style={{ fontSize: 11, color: C.text4, marginLeft: 'auto' }}>
          {formatRelativeTime(post.created_at)}
        </span>
      </div>

      {/* Row 2 + 3: 제목 · 본문 (왼쪽) + 썸네일 (오른쪽) */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 제목 */}
          {hasTitle && (
            <div style={{
              fontSize: 15, fontWeight: 800, color: C.text1,
              lineHeight: 1.4, letterSpacing: '-0.3px',
              marginBottom: 4,
            }}>
              {post.title}
            </div>
          )}
          {/* 본문 미리보기 */}
          <div style={{
            fontSize: 13, color: C.text2, lineHeight: 1.65,
            display: '-webkit-box',
            WebkitLineClamp: hasTitle ? 1 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {post.content}
          </div>
        </div>

        {/* 썸네일 */}
        {thumbUrl && (
          <img
            src={thumbUrl}
            alt=""
            style={{
              width: 80, height: 80,
              borderRadius: R.md,
              objectFit: 'cover',
              flexShrink: 0,
              display: 'block',
            }}
          />
        )}
      </div>

      {/* Row 4: 아바타 · 닉네임 · 성별 ··· 조회 · 좋아요 · 댓글 */}
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
          <span style={{ fontSize: 11, color: C.text3 }}>👁 {(post.view_count ?? 0).toLocaleString()}</span>
          <span style={{ fontSize: 11, color: C.text3 }}>❤️ {post.like_count ?? 0}</span>
          <span style={{ fontSize: 11, color: C.text3 }}>💬 {post.comment_count ?? 0}</span>
        </div>
      </div>
    </div>
  );
}
