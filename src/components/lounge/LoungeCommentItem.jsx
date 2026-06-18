// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState } from 'react';
import { C, R, S } from '../../constants';
import { formatRelativeTime, getAnonymousAvatarByNickname } from '../../utils/anonymousNickname';
import { resolveConsumerIdentity } from '../../utils/identityResolver';

export default function LoungeCommentItem({ comment, isReply = false, onLike, onReport, onReply, onAuthorClick, onCompanyClick, currentUserId, companyName = null }) {
  // 표시명은 Identity Resolver 로 결정. 업체(전문가) 댓글은 상위에서 업체 표시명(companyName)을
  // 내려주고, 그 외 의뢰인 댓글은 의뢰인 Identity(anonymous_name → anonymous_nickname → 공간이웃).
  const displayName = companyName || resolveConsumerIdentity(comment);
  const avatar  = getAnonymousAvatarByNickname(comment.anonymous_nickname);
  const [liked, setLiked] = useState(false);

  const handleLike = () => {
    if (liked) return;
    setLiked(true);
    onLike?.(comment.id);
  };

  // 대화 신청 가능: user_id 있음(비시드) + 본인 아님 + 운영글 전문가 답변 아님
  const canChat = comment.user_id != null
    && comment.user_id !== currentUserId
    && !comment.is_expert_reply;
  // 업체(전문가 답변) 작성자 → 미니 포트폴리오 모달로 연결(본인 제외)
  const isCompanyAuthor = comment.is_expert_reply === true
    && comment.user_id != null
    && comment.user_id !== currentUserId;
  const clickableAuthor = canChat || isCompanyAuthor;

  const handleAuthorClick = (e) => {
    // 클릭 발생 지점에서 직접 anchor rect 계산(상위로 이벤트 전달 시 currentTarget 소실 방지)
    // + 카드/답글/좋아요/신고 등 다른 클릭과 충돌 방지.
    e.stopPropagation();
    const r = e.currentTarget?.getBoundingClientRect?.();
    const anchor = r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null;
    if (isCompanyAuthor) onCompanyClick?.(comment, anchor);
    else if (canChat) onAuthorClick?.(comment, anchor);
  };

  // 전문가(업체) 답변 강조 — 일반 댓글과 명확히 구분(배경/테두리/배지)
  const expertWrap = comment.is_expert_reply
    ? {
        background: C.brandL,
        borderRadius: R.lg,
        padding: 10,
        border: `1.5px solid ${C.brand}`,
        boxShadow: `0 2px 10px ${C.brand}22`,
        marginBottom: S.sm,
      }
    : {};

  return (
    <div style={{
      marginLeft: isReply ? 28 : 0,
      marginBottom: comment.is_expert_reply ? 0 : S.sm,
      ...expertWrap,
    }}>
    <div style={{
      padding: `${S.md}px ${S.lg}px`,
      borderLeft: !comment.is_expert_reply && isReply ? `2px solid ${C.bgWarm}` : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginBottom: S.xs }}>
        <div
          onClick={handleAuthorClick}
          style={{
            width: 30, height: 30, borderRadius: '50%',
            background: avatar.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, flexShrink: 0,
            cursor: clickableAuthor ? 'pointer' : 'default',
          }}
        >
          {avatar.emoji}
        </div>
        <span
          onClick={handleAuthorClick}
          style={{
            fontWeight: 800, fontSize: 13, color: C.text1,
            cursor: clickableAuthor ? 'pointer' : 'default',
          }}
        >{displayName}</span>
        {comment.is_expert_reply && (
          <span
            onClick={isCompanyAuthor ? handleAuthorClick : undefined}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: C.brand, color: '#fff', borderRadius: R.full, padding: '2px 9px', fontSize: 10, fontWeight: 800,
              cursor: isCompanyAuthor ? 'pointer' : 'default' }}>
            🏅 공간보증 · 전문가 답변
          </span>
        )}
        <span style={{ fontSize: 11, color: C.text4, marginLeft: 'auto' }}>
          {formatRelativeTime(comment.created_at)}
        </span>
      </div>

      <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6, marginBottom: S.sm, paddingLeft: 38 }}>
        {comment.content}
      </div>

      {comment.image_urls && comment.image_urls.length > 0 && (
        <div style={{ display: 'flex', gap: S.sm, marginBottom: S.sm, paddingLeft: 38, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {comment.image_urls.map((url, i) => (
            <img key={i} src={url} alt="" style={{ width: 72, height: 72, borderRadius: R.md, objectFit: 'cover', flexShrink: 0 }} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: S.lg, alignItems: 'center', paddingLeft: 38 }}>
        {comment.is_expert_reply ? (
          // 전문가 답변 — "도움이 되었어요"(기존 좋아요 재사용, 문구만 변경)
          <button onClick={handleLike} style={{ background: liked ? C.brand : 'none', border: `1px solid ${liked ? C.brand : C.bgWarm}`, borderRadius: R.full, cursor: liked ? 'default' : 'pointer', fontSize: 12, color: liked ? '#fff' : C.text2, fontWeight: 700, padding: '4px 12px' }}>
            👍 도움이 되었어요 {(Number(comment.like_count ?? 0) + (liked ? 1 : 0)) || ''}
          </button>
        ) : (
          <button onClick={handleLike} style={{ background: 'none', border: 'none', cursor: liked ? 'default' : 'pointer', fontSize: 12, color: liked ? '#E53E3E' : C.text3, fontWeight: liked ? 700 : 400, padding: 0 }}>
            {liked ? '❤️' : '🤍'} {(Number(comment.like_count ?? 0) + (liked ? 1 : 0)) || ''}
          </button>
        )}
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
    </div>
  );
}
