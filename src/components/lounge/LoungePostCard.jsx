// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템 — 게시글 카드 (리스트형)
// ─────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import { C, R, S } from '../../constants';
import { formatRelativeTime, getAnonymousAvatarByNickname } from '../../utils/anonymousNickname';
import { CATEGORY_LABEL } from '../../constants/lounge';
import { plainExcerpt } from '../../utils/richText';
import { extractLoungeTags } from '../../utils/loungeTags';

export default function LoungePostCard({ post, onClick }) {
  const catLabel   = CATEGORY_LABEL[post.category] ?? post.category;
  const avatar     = getAnonymousAvatarByNickname(post.anonymous_nickname);
  const hasImage   = post.image_urls?.length > 0;
  const thumbUrl   = hasImage ? post.image_urls[0] : null;
  const imgCount   = hasImage ? post.image_urls.length : 0;
  const hasTitle   = !!post.title;
  // 자동 태그(표시 전용) — 제목/내용/지역/카테고리에서 실시간 도출, 저장 없음. 카드에는 최대 3개.
  // useMemo로 리렌더(썸네일 상태 변화 등) 시 불필요한 재계산 방지.
  const autoTags   = useMemo(
    () => extractLoungeTags(post, { max: 3 }),
    [post?.id, post?.title, post?.content, post?.region, post?.category],
  );

  // 썸네일 로드 실패 시 검은/빈 화면 대신 아바타 그라데이션 폴백.
  const [thumbFailed, setThumbFailed] = useState(false);
  useEffect(() => { setThumbFailed(false); }, [thumbUrl]);
  const showThumb = thumbUrl && !thumbFailed;

  return (
    <div onClick={onClick} style={{
      background: C.surface,
      padding: `11px ${S.xl}px`,
      borderBottom: `1px solid ${C.bgWarm}`,
      cursor: 'pointer',
    }}>

      {/* Row 1: 카테고리 pill · 지역 · 연령 ··· 시간 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
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
        {post.is_expert && (
          <span style={{
            background: '#C4A96A22', color: '#8A6D2A', border: '1px solid #C4A96A',
            borderRadius: R.full, padding: '2px 7px', fontSize: 10, fontWeight: 700,
          }}>전문가</span>
        )}
        {post.region    && <span style={{ fontSize: 11, color: C.text4 }}>· {post.region}</span>}
        {post.age_group && <span style={{ fontSize: 11, color: C.text4 }}>· {post.age_group}</span>}
        <span style={{ fontSize: 11, color: C.text4, marginLeft: 'auto' }}>
          {formatRelativeTime(post.created_at)}
        </span>
      </div>

      {/* Row 2 + 3: 제목 · 본문 (왼쪽) + 썸네일 (오른쪽) */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 제목 */}
          {hasTitle && (
            <div style={{
              fontSize: 15, fontWeight: 800, color: C.text1,
              lineHeight: 1.4, letterSpacing: '-0.3px',
              marginBottom: 3,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
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
            {plainExcerpt(post.content)}
          </div>
        </div>

        {/* 썸네일 — 있으면 꽉 차게, 깨지면 폴백, 여러 장이면 카운트 배지 */}
        {hasImage && (
          <div style={{
            position: 'relative', width: 84, height: 84, flexShrink: 0,
            borderRadius: R.md, overflow: 'hidden',
            border: `1px solid ${C.bgWarm}`,
          }}>
            {showThumb ? (
              <img
                src={thumbUrl}
                alt=""
                loading="lazy"
                onError={() => setThumbFailed(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                background: `linear-gradient(145deg, ${avatar.color}33, ${avatar.color}88)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
              }}>
                {avatar.emoji}
              </div>
            )}
            {imgCount > 1 && (
              <span style={{
                position: 'absolute', right: 4, bottom: 4,
                background: 'rgba(0,0,0,0.6)', color: '#fff',
                borderRadius: R.sm, padding: '1px 6px', fontSize: 10, fontWeight: 700,
              }}>
                +{imgCount - 1}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Row 3.5: 자동 태그 칩 (표시 전용) */}
      {autoTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
          {autoTags.map(t => (
            <span key={t} style={{
              fontSize: 10.5, color: C.text3, background: C.bg,
              border: `1px solid ${C.bgWarm}`, borderRadius: R.full, padding: '1px 8px', fontWeight: 600,
            }}>
              #{t}
            </span>
          ))}
        </div>
      )}

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
