// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
//
// 라운지는 단순 커뮤니티 게시판이 아닙니다.
// 사람이 머무는 공간 안에서 신뢰가 생기고,
// 그 신뢰가 거래로 이어지는 구조입니다.
// ─────────────────────────────────────────────────────

import { useState, useRef } from 'react';
import { C, R, S } from '../constants';
import { CATEGORY_LABEL, TOKEN_COSTS } from '../constants/lounge';
import { useLoungePost } from '../hooks/useLounge';
import { getAnonymousNickname, formatRelativeTime } from '../utils/anonymousNickname';
import LoungeCommentItem from '../components/lounge/LoungeCommentItem';
import ChatRequestModal from '../components/lounge/ChatRequestModal';

export default function LoungePostDetailScreen({ postId, user, tokenBalance, onBack, onSpendToken, onTokenStore }) {
  const { post, comments, loading, addComment, likeComment } = useLoungePost(postId);
  const [commentText, setCommentText]   = useState('');
  const [replyTo,     setReplyTo]       = useState(null);
  const [liked,       setLiked]         = useState(false);
  const [saved,       setSaved]         = useState(false);
  const [showChat,    setShowChat]      = useState(false);
  const [toast,       setToast]         = useState(null);
  const inputRef = useRef(null);

  const isLoggedIn = !!user?.id;

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleLike = () => {
    if (!isLoggedIn) { showToast('로그인 후 이용해주세요'); return; }
    const cost = TOKEN_COSTS.INTEREST_MIN;
    if (tokenBalance < cost) { showToast('토큰이 부족합니다'); return; }
    onSpendToken?.('interest_send', cost, '게시글 좋아요');
    setLiked(true);
    showToast('❤️ 좋아요를 눌렀어요');
  };

  const handleComment = () => {
    if (!isLoggedIn) { showToast('로그인 후 이용해주세요'); return; }
    if (!commentText.trim()) return;

    const nickname = getAnonymousNickname(user.id, postId);
    const newComment = {
      id:                 `c-${Date.now()}`,
      post_id:            postId,
      parent_id:          replyTo?.id ?? null,
      user_id:            user.id,
      anonymous_nickname: nickname,
      content:            commentText.trim(),
      image_urls:         [],
      is_expert_reply:    user.role === 'company',
      like_count:         0,
      created_at:         new Date().toISOString(),
    };
    addComment(newComment);
    setCommentText('');
    setReplyTo(null);
  };

  const handleChatRequest = () => {
    const cost = TOKEN_COSTS.CHAT_REQUEST;
    onSpendToken?.('chat_request', cost, '대화 신청');
    setShowChat(false);
    showToast('💬 대화 신청을 보냈어요!');
  };

  if (loading || !post) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 13, color: C.text3 }}>불러오는 중...</div>
        </div>
      </div>
    );
  }

  const catLabel = CATEGORY_LABEL[post.category] ?? post.category;
  const topComments    = comments.filter(c => !c.parent_id);
  const replyComments  = comments.filter(c => !!c.parent_id);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 80 }}>
      <div style={{ background: C.surface, padding: `14px ${S.xl}px`, display: 'flex', alignItems: 'center', gap: S.md, borderBottom: `1px solid ${C.bgWarm}`, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.text1, padding: 0 }}>←</button>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>라운지</div>
      </div>

      <div style={{ background: C.surface, padding: S.xl, marginBottom: S.sm }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginBottom: S.md, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: 14, color: C.text1 }}>{post.anonymous_nickname}</span>
          <span style={{ background: C.brandL, color: C.brand, borderRadius: R.full, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{catLabel}</span>
          {post.region && <span style={{ fontSize: 11, color: C.text3 }}>📍 {post.region}</span>}
          {post.gender && <span style={{ fontSize: 11, color: C.text4 }}>{post.gender === 'male' ? '남' : '여'}</span>}
          {post.age_group && <span style={{ fontSize: 11, color: C.text4 }}>{post.age_group}</span>}
          <span style={{ fontSize: 11, color: C.text4, marginLeft: 'auto' }}>{formatRelativeTime(post.created_at)}</span>
        </div>

        {post.title && (
          <div style={{ fontSize: 18, fontWeight: 900, color: C.text1, marginBottom: S.md, lineHeight: 1.4 }}>{post.title}</div>
        )}
        <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.8, marginBottom: S.xl, whiteSpace: 'pre-wrap' }}>{post.content}</div>

        <div style={{ display: 'flex', gap: S.xl, alignItems: 'center', paddingTop: S.md, borderTop: `1px solid ${C.bg}` }}>
          <span style={{ fontSize: 12, color: C.text3 }}>👁 {post.view_count.toLocaleString()}</span>
          <button onClick={handleLike} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: liked ? C.red : C.text3, fontWeight: liked ? 800 : 500, padding: 0 }}>
            {liked ? '❤️' : '🤍'} {post.like_count + (liked ? 1 : 0)}
          </button>
          <button onClick={() => setSaved(!saved)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: saved ? C.gold : C.text3, padding: 0 }}>
            {saved ? '🔖' : '📄'} 저장
          </button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.text4, padding: 0, marginLeft: 'auto' }}>신고</button>
        </div>
      </div>

      {isLoggedIn && (
        <div style={{ background: C.surface, padding: S.xl, marginBottom: S.sm }}>
          <button onClick={() => setShowChat(true)} style={{ width: '100%', padding: S.xl, background: `linear-gradient(135deg, ${C.brand}, ${C.brandD})`, color: '#fff', border: 'none', borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: `0 4px 16px ${C.brand}44` }}>
            💬 대화 신청 ({TOKEN_COSTS.CHAT_REQUEST} 토큰)
          </button>
        </div>
      )}

      <div style={{ background: C.surface, padding: `${S.xl}px ${S.xl}px 0` }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: S.md }}>
          댓글 {comments.length}개
        </div>

        {topComments.map(comment => (
          <div key={comment.id}>
            <LoungeCommentItem
              comment={comment}
              onLike={likeComment}
              onReply={(c) => { setReplyTo(c); inputRef.current?.focus(); }}
              onReport={() => showToast('신고가 접수됐어요')}
            />
            {replyComments.filter(r => r.parent_id === comment.id).map(reply => (
              <LoungeCommentItem key={reply.id} comment={reply} isReply onLike={likeComment} onReport={() => showToast('신고가 접수됐어요')} />
            ))}
          </div>
        ))}

        {comments.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: C.text3, fontSize: 13 }}>
            첫 댓글을 남겨보세요 💬
          </div>
        )}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.surface, borderTop: `1px solid ${C.bgWarm}`, padding: `${S.sm}px ${S.xl}px`, paddingBottom: 'env(safe-area-inset-bottom, 8px)', zIndex: 10 }}>
        {replyTo && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.brandL, borderRadius: R.sm, padding: `${S.xs}px ${S.sm}px`, marginBottom: S.xs }}>
            <span style={{ fontSize: 12, color: C.brand, fontWeight: 600 }}>↩ {replyTo.anonymous_nickname}에게 답글</span>
            <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: C.text3, padding: 0 }}>✕</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: S.sm, alignItems: 'flex-end' }}>
          <input ref={inputRef} value={commentText} onChange={e => setCommentText(e.target.value)}
            placeholder={isLoggedIn ? '댓글을 입력하세요...' : '로그인 후 댓글을 달 수 있어요'}
            disabled={!isLoggedIn}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
            style={{ flex: 1, padding: '12px 14px', border: `1.5px solid ${C.bgWarm}`, borderRadius: R.full, fontSize: 14, outline: 'none', background: C.surface, color: C.text1, fontFamily: 'inherit' }}
          />
          <button onClick={handleComment} disabled={!commentText.trim() || !isLoggedIn}
            style={{ background: commentText.trim() && isLoggedIn ? C.brand : C.text4, color: '#fff', border: 'none', borderRadius: R.full, width: 44, height: 44, fontSize: 16, cursor: commentText.trim() && isLoggedIn ? 'pointer' : 'not-allowed', flexShrink: 0 }}>
            ↑
          </button>
        </div>
      </div>

      {showChat && (
        <ChatRequestModal
          balance={tokenBalance ?? 0}
          onConfirm={handleChatRequest}
          onCancel={() => setShowChat(false)}
        />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: C.brand, color: '#fff', borderRadius: R.full, padding: '12px 22px', fontSize: 13, fontWeight: 700, boxShadow: `0 8px 24px ${C.brand}44`, zIndex: 200, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
