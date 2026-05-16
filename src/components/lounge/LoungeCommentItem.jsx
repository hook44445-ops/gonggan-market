// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { C, R, S } from '../../constants';
import { formatRelativeTime } from '../../utils/anonymousNickname';

export default function LoungeCommentItem({ comment, isReply = false, onLike, onReport, onReply }) {
  return (
    <div style={{
      marginLeft: isReply ? 28 : 0,
      padding: `${S.md}px ${S.lg}px`,
      borderLeft: isReply ? `2px solid ${C.bgWarm}` : 'none',
      marginBottom: S.sm,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginBottom: S.xs, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: C.text1 }}>{comment.anonymous_nickname}</span>
        {comment.is_expert_reply && (
          <span style={{ background: C.brand, color: '#fff', borderRadius: R.full, padding: '2px 8px', fontSize: 10, fontWeight: 800 }}>
            🏆 전문가 답변
          </span>
        )}
        <span style={{ fontSize: 11, color: C.text4, marginLeft: 'auto' }}>
          {formatRelativeTime(comment.created_at)}
        </span>
      </div>

      <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6, marginBottom: S.sm }}>
        {comment.content}
      </div>

      {comment.image_urls && comment.image_urls.length > 0 && (
        <div style={{ display: 'flex', gap: S.sm, marginBottom: S.sm, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {comment.image_urls.map((url, i) => (
            <img key={i} src={url} alt="" style={{ width: 72, height: 72, borderRadius: R.md, objectFit: 'cover', flexShrink: 0 }} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: S.lg, alignItems: 'center' }}>
        <button onClick={() => onLike?.(comment.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.text3, padding: 0 }}>
          ❤️ {comment.like_count}
        </button>
        {!isReply && (
          <button onClick={() => onReply?.(comment)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.text3, padding: 0 }}>
            답글
          </button>
        )}
        <button onClick={() => onReport?.(comment.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: C.text4, padding: 0, marginLeft: 'auto' }}>
          신고
        </button>
      </div>
    </div>
  );
}
