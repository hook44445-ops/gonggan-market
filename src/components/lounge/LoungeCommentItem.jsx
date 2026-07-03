// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState } from 'react';
import { C, R, S } from '../../constants';
import { formatLoungeRelativeTime, getGenderEmoji } from '../../utils/anonymousNickname';
import { resolveConsumerIdentity } from '../../utils/identityResolver';

export default function LoungeCommentItem({ comment, isReply = false, onLike, onReport, onReply, onAuthorClick, onCompanyClick, currentUserId, postUserId = null, companyName = null }) {
  // 표시명은 Identity Resolver 로 결정. 업체(전문가) 댓글은 상위에서 업체 표시명(companyName)을
  // 내려주고, 그 외 의뢰인 댓글은 의뢰인 Identity(anonymous_name → anonymous_nickname → 공간이웃).
  const displayName = companyName || resolveConsumerIdentity(comment);
  const [liked, setLiked] = useState(false);

  // ── 작성자 배지 / 본인 판정 — 반드시 분리(directive) ─────────────────────────
  //   · isPostAuthor : '게시글 작성자 댓글'에만 작성자 배지. 기준 = comment.user_id === post.user_id
  //   · isSelf       : 메시지 차단(본인) 전용. 기준 = comment.user_id === currentUser.id
  //   둘은 절대 공유하지 않는다. (displayName/anonymousNickname/role/company 여부로 판단 금지)
  const isPostAuthor = comment.user_id != null && comment.user_id === postUserId;
  const isSelf       = comment.user_id != null && comment.user_id === currentUserId;

  const handleLike = () => {
    if (liked) return;
    setLiked(true);
    onLike?.(comment.id);
  };

  // 업체(전문가 답변) 작성자 → 업체 팝오버(본인 포함). 의뢰인/업체는 role 기준 분기(본인·타인 구분으로 막지 않음).
  const isCompanyAuthor = comment.is_expert_reply === true
    && comment.user_id != null;
  // 일반(비전문가) 작성자 → 게시글 작성자와 동일한 의뢰인 팝오버. 본인 댓글도 열림(시드/익명 user_id 없음만 비활성).
  const canOpenConsumer = !comment.is_expert_reply && comment.user_id != null;
  const clickableAuthor = isCompanyAuthor || canOpenConsumer;

  const handleAuthorClick = (e) => {
    // 클릭 발생 지점에서 직접 anchor rect 계산(상위로 이벤트 전달 시 currentTarget 소실 방지)
    // + 카드/답글/좋아요/신고 등 다른 클릭과 충돌 방지.
    e.stopPropagation();
    const r = e.currentTarget?.getBoundingClientRect?.();
    const anchor = r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null;
    if (isCompanyAuthor) onCompanyClick?.(comment, anchor);
    else if (canOpenConsumer) onAuthorClick?.(comment, anchor);
  };

  // 전문가 댓글 배경 제거 — 일반 댓글과 동일하게 흰색. 전문가 여부는 작은 배지로만 표시.
  const expertWrap = {};

  return (
    <div style={{
      marginLeft: isReply ? 22 : 0,
      marginBottom: 5,
      ...expertWrap,
    }}>
    <div style={{
      padding: `6px 11px`,
      borderLeft: isReply ? `2px solid ${C.bgWarm}` : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginBottom: 2 }}>
        {/* 익명 사람 이모티콘 — 닉네임 글씨 크기와 동일(인라인·세로 가운데). 아이콘처럼 튀지 않게(directive ②) */}
        <span
          onClick={handleAuthorClick}
          style={{
            fontSize: 13, lineHeight: 1,
            display: 'inline-flex', alignItems: 'center', flexShrink: 0,
            cursor: clickableAuthor ? 'pointer' : 'default',
          }}
        >
          {getGenderEmoji(comment.gender)}
        </span>
        <span
          onClick={handleAuthorClick}
          style={{
            fontWeight: 800, fontSize: 13, color: C.text1,
            cursor: clickableAuthor ? 'pointer' : 'default',
          }}
        >{displayName}</span>
        {isPostAuthor && (
          <span style={{ background: C.brandL, color: C.brand, borderRadius: R.full, padding: '1px 7px', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>작성자</span>
        )}
        {comment.is_expert_reply && (
          <span
            onClick={isCompanyAuthor ? handleAuthorClick : undefined}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: C.brand, color: '#fff', borderRadius: R.full, padding: '2px 9px', fontSize: 10, fontWeight: 800,
              cursor: isCompanyAuthor ? 'pointer' : 'default' }}>
            🏅 공간보증 · 전문가 답변
          </span>
        )}
        <span style={{ fontSize: 11, color: C.text4, marginLeft: 'auto' }}>
          {formatLoungeRelativeTime(comment.created_at)}
        </span>
      </div>

      <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6, marginBottom: 5, paddingLeft: 30 }}>
        {comment.content}
      </div>

      {comment.image_urls && comment.image_urls.length > 0 && (
        <div style={{ display: 'flex', gap: S.sm, marginBottom: 6, paddingLeft: 30, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {comment.image_urls.map((url, i) => (
            <img key={i} src={url} alt="" style={{ width: 72, height: 72, borderRadius: R.md, objectFit: 'cover', flexShrink: 0 }} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: S.lg, alignItems: 'center', paddingLeft: 30 }}>
        {comment.is_expert_reply ? (
          // 전문가 답변 — 좋아요(기존 like_count/onLike 재사용, 문구만 통일)
          <button onClick={handleLike} style={{ background: liked ? C.brand : 'none', border: `1px solid ${liked ? C.brand : C.bgWarm}`, borderRadius: R.full, cursor: liked ? 'default' : 'pointer', fontSize: 12, color: liked ? '#fff' : C.text2, fontWeight: 700, padding: '4px 12px' }}>
            👍 좋아요 {(Number(comment.like_count ?? 0) + (liked ? 1 : 0)) || ''}
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
