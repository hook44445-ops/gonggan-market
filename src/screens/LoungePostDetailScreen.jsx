// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState, useRef } from 'react';
import { C, R, S } from '../constants';
import { CATEGORY_LABEL } from '../constants/lounge';
import { useLoungePost } from '../hooks/useLounge';
import { getAnonymousNickname, formatRelativeTime, getAnonymousAvatarByNickname } from '../utils/anonymousNickname';
import LoungeCommentItem from '../components/lounge/LoungeCommentItem';
import ChatRequestModal from '../components/lounge/ChatRequestModal';
import ReportModal from '../components/lounge/ReportModal';
import { IS_SUPABASE_READY, softDeleteLoungePost } from '../lib/supabase';

// ── 삭제 확인 다이얼로그 ───────────────────────────────
function DeleteConfirmDialog({ onConfirm, onCancel, loading }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,42,36,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: '0 24px' }}>
      <div style={{ background: C.surface, borderRadius: R.xl, padding: 24, width: '100%', maxWidth: 320 }}>
        <div style={{ fontSize: 20, textAlign: 'center', marginBottom: 12 }}>🗑️</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, textAlign: 'center', marginBottom: 8 }}>게시글을 삭제할까요?</div>
        <div style={{ fontSize: 13, color: C.text3, textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>삭제된 글은 복구할 수 없어요</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} disabled={loading}
            style={{ flex: 1, padding: '13px', background: C.bg, border: 'none', borderRadius: R.lg, fontWeight: 700, fontSize: 14, color: C.text2, cursor: 'pointer' }}>
            취소
          </button>
          <button onClick={onConfirm} disabled={loading}
            style={{ flex: 1, padding: '13px', background: C.red ?? '#E53E3E', border: 'none', borderRadius: R.lg, fontWeight: 800, fontSize: 14, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 포스트 메뉴 시트 ───────────────────────────────────
function PostMenuSheet({ isOwn, onEdit, onDelete, onReport, onBlock, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,42,36,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 400 }} onClick={onClose}>
      <div style={{ background: C.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, paddingBottom: 'env(safe-area-inset-bottom, 20px)' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: '12px auto 8px' }} />
        {isOwn ? (
          <>
            <button onClick={onEdit} style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', borderBottom: `1px solid ${C.bg}`, fontSize: 15, fontWeight: 700, color: C.brand, cursor: 'pointer', textAlign: 'left' }}>
              ✏️ 수정하기
            </button>
            <button onClick={onDelete} style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', fontSize: 15, fontWeight: 700, color: C.red ?? '#E53E3E', cursor: 'pointer', textAlign: 'left' }}>
              🗑️ 삭제하기
            </button>
          </>
        ) : (
          <>
            <button onClick={onReport} style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', borderBottom: `1px solid ${C.bg}`, fontSize: 15, fontWeight: 700, color: C.text2, cursor: 'pointer', textAlign: 'left' }}>
              🚨 신고하기
            </button>
            <button onClick={onBlock} style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', fontSize: 15, fontWeight: 700, color: C.text2, cursor: 'pointer', textAlign: 'left' }}>
              🚫 차단하기
            </button>
          </>
        )}
        <button onClick={onClose} style={{ width: '100%', padding: '14px 20px', background: 'none', border: 'none', fontSize: 14, color: C.text3, cursor: 'pointer' }}>
          취소
        </button>
      </div>
    </div>
  );
}

export default function LoungePostDetailScreen({ postId, initialPost, user, tokenBalance, onBack, onSpendToken, onTokenStore, onRequireLogin, onEditPost, onDeletePost }) {
  const { post: foundPost, comments, loading, addComment, likeComment } = useLoungePost(postId, initialPost);
  const post = foundPost ?? initialPost ?? null;
  const [commentText, setCommentText]   = useState('');
  const [replyTo,     setReplyTo]       = useState(null);
  const [liked,       setLiked]         = useState(false);
  const [saved,       setSaved]         = useState(() => {
    try {
      const saves = JSON.parse(localStorage.getItem('lounge_saved_posts') ?? '[]');
      return saves.some(s => s.id === postId);
    } catch { return false; }
  });
  const [showChat,    setShowChat]      = useState(false);
  const [chatSending, setChatSending]   = useState(false);
  const [chatSent,    setChatSent]      = useState(false);
  const [toast,       setToast]         = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [showMenu,    setShowMenu]      = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting,    setDeleting]      = useState(false);
  const inputRef = useRef(null);

  const isGuest    = user?.isGuest === true;
  const isLoggedIn = !isGuest;
  const isOwn      = isLoggedIn && post?.user_id && user?.id && post.user_id === user.id;

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const handleLike = () => {
    if (isGuest) { onRequireLogin?.(); return; }
    if (liked) return;
    setLiked(true);
    showToast('❤️ 좋아요를 눌렀어요');
  };

  const handleComment = () => {
    if (isGuest) { onRequireLogin?.(); return; }
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
    handleCommentSubmit(commentText.trim());
    setCommentText('');
    setReplyTo(null);
  };

  const handleSaveToggle = () => {
    if (!post) return;
    const next = !saved;
    setSaved(next);
    try {
      const key = 'lounge_saved_posts';
      const prev = JSON.parse(localStorage.getItem(key) ?? '[]');
      const updated = next
        ? [{ id: post.id, title: post.title, content: post.content?.slice(0, 80), category: post.category, anonymous_nickname: post.anonymous_nickname, created_at: post.created_at, has_badge: post.has_badge }, ...prev.filter(s => s.id !== post.id)]
        : prev.filter(s => s.id !== post.id);
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {}
    showToast(next ? '🔖 저장됐어요' : '저장이 취소됐어요');
  };

  const handleChatRequest = async () => {
    if (chatSending || chatSent) return;
    setChatSending(true);
    await new Promise(r => setTimeout(r, 400));
    setChatSending(false);
    setChatSent(true);
    setShowChat(false);
    try {
      const key = 'lounge_chat_requests';
      const prev = JSON.parse(localStorage.getItem(key) ?? '[]');
      prev.unshift({ postId, postTitle: post?.title ?? post?.content?.slice(0, 30), nickname: post?.anonymous_nickname, sentAt: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(prev.slice(0, 50)));
    } catch {}
    showToast('💬 대화 신청을 보냈어요! 수락 시 20토큰이 차감됩니다.');
  };

  const handleCommentSubmit = (text) => {
    if (!user?.id || !text.trim()) return;
    try {
      const key = 'lounge_my_comments';
      const prev = JSON.parse(localStorage.getItem(key) ?? '[]');
      prev.unshift({ postId, postTitle: post?.title ?? post?.content?.slice(0, 30), content: text.trim(), createdAt: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(prev.slice(0, 100)));
    } catch {}
  };

  const handleReport = () => {
    setShowMenu(false);
    setReportTarget({ type: 'post', targetId: post.id });
  };

  const handleBlock = () => {
    setShowMenu(false);
    if (!post?.user_id) return;
    try {
      const key = 'lounge_blocks';
      const prev = JSON.parse(localStorage.getItem(key) ?? '[]');
      if (!prev.find(b => b.id === post.user_id)) {
        prev.unshift({ id: post.user_id, nickname: post.anonymous_nickname, blockedAt: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(prev));
      }
    } catch {}
    showToast('🚫 차단됐어요');
  };

  const handleDelete = async () => {
    setDeleting(true);
    if (IS_SUPABASE_READY) {
      await softDeleteLoungePost(post.id, user.id);
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
    onDeletePost?.(post.id);
    onBack?.();
  };

  if (loading && !post) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 13, color: C.text3 }}>불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: C.surface, padding: `14px ${S.xl}px`, display: 'flex', alignItems: 'center', gap: S.md, borderBottom: `1px solid ${C.bgWarm}` }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.text1, padding: 0 }}>←</button>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>라운지</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text2, marginBottom: 8 }}>게시글을 찾을 수 없어요</div>
          <div style={{ fontSize: 13, color: C.text3, textAlign: 'center', lineHeight: 1.6 }}>삭제됐거나 존재하지 않는 게시글이에요</div>
          <button onClick={onBack} style={{ marginTop: 24, padding: '12px 28px', background: C.brand, color: '#fff', border: 'none', borderRadius: R.full, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            라운지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const catLabel      = CATEGORY_LABEL[post.category] ?? post.category;
  const postAvatar    = getAnonymousAvatarByNickname(post.anonymous_nickname);
  const topComments   = comments.filter(c => !c.parent_id);
  const replyComments = comments.filter(c => !!c.parent_id);
  const hasBadge      = post.has_badge === true;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 80 }}>
      {/* 헤더 */}
      <div style={{ background: C.surface, padding: `14px ${S.xl}px`, display: 'flex', alignItems: 'center', gap: S.md, borderBottom: `1px solid ${C.bgWarm}`, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.text1, padding: 0 }}>←</button>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text1, flex: 1 }}>라운지</div>
        {isLoggedIn && (
          <button onClick={() => setShowMenu(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.text2, padding: 4, lineHeight: 1 }}>⋯</button>
        )}
      </div>

      {/* 본문 */}
      <div style={{ background: C.surface, padding: S.xl, marginBottom: S.sm }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginBottom: S.md, flexWrap: 'wrap' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: postAvatar.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, boxShadow: `0 2px 8px ${postAvatar.color}55` }}>
            {postAvatar.emoji}
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, color: C.text1 }}>
            {hasBadge && <span style={{ fontSize: 13, marginRight: 3 }}>🛡️</span>}
            {post.anonymous_nickname}
          </span>
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

        {post.image_urls && post.image_urls.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: S.lg, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {post.image_urls.map((url, i) => (
              <img key={i} src={url} alt="" style={{ width: 120, height: 120, borderRadius: R.md, objectFit: 'cover', flexShrink: 0 }} />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: S.xl, alignItems: 'center', paddingTop: S.md, borderTop: `1px solid ${C.bgWarm}`, background: C.surface2, borderRadius: R.md, padding: S.md, marginTop: S.sm }}>
          <span style={{ fontSize: 12, color: C.text3 }}>👁 {(post.view_count ?? 0).toLocaleString()}</span>
          <button onClick={handleLike} style={{ background: 'none', border: 'none', cursor: liked ? 'default' : 'pointer', fontSize: 13, color: liked ? '#E53E3E' : C.text3, fontWeight: liked ? 800 : 500, padding: 0 }}>
            {liked ? '❤️' : '🤍'} {(post.like_count ?? 0) + (liked ? 1 : 0)}
          </button>
          <button onClick={handleSaveToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: saved ? C.gold : C.text3, padding: 0 }}>
            {saved ? '🔖' : '📄'} 저장
          </button>
          {!isOwn && (
            <button onClick={() => setReportTarget({ type: 'post', targetId: post.id })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.text4, padding: 0, marginLeft: 'auto' }}>
              신고
            </button>
          )}
        </div>
      </div>

      {/* 대화 신청 버튼 — 본인 글에는 숨김 */}
      {!isOwn && (
        <div style={{ background: C.surface, padding: S.xl, marginBottom: S.sm, borderRadius: R.xl, margin: `0 8px ${S.sm}px` }}>
          <button
            onClick={isGuest ? () => onRequireLogin?.() : () => { if (!chatSent) setShowChat(true); }}
            disabled={chatSent}
            style={{ width: '100%', padding: S.xl, background: chatSent ? C.text4 : `linear-gradient(135deg, ${C.brand}, ${C.brandD})`, color: '#fff', border: 'none', borderRadius: R.xl, fontWeight: 800, fontSize: 15, cursor: chatSent ? 'default' : 'pointer', boxShadow: chatSent ? 'none' : `0 4px 16px ${C.brand}44`, transition: 'background 0.2s' }}>
            {isGuest ? '💬 대화 신청하기 (로그인 필요)' : chatSent ? '✅ 신청 완료' : '💬 대화 신청하기'}
          </button>
          <div style={{ textAlign: 'center', marginTop: S.sm, fontSize: 11, color: C.text4 }}>
            {chatSent ? '상대방이 수락하면 20토큰이 차감되고 대화방이 열려요' : '신청은 무료 · 상대방 수락 시 20토큰 차감'}
          </div>
        </div>
      )}

      {/* 댓글 */}
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
              onReport={(id) => setReportTarget({ type: 'comment', targetId: id })}
            />
            {replyComments.filter(r => r.parent_id === comment.id).map(reply => (
              <LoungeCommentItem
                key={reply.id}
                comment={reply}
                isReply
                onLike={likeComment}
                onReport={(id) => setReportTarget({ type: 'comment', targetId: id })}
              />
            ))}
          </div>
        ))}

        {comments.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: C.text3, fontSize: 13 }}>
            첫 댓글을 남겨보세요 💬
          </div>
        )}
      </div>

      {/* 댓글 입력 바 */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.surface, borderTop: `1px solid ${C.bgWarm}`, padding: `${S.sm}px ${S.xl}px`, paddingBottom: 'env(safe-area-inset-bottom, 8px)', zIndex: 10 }}>
        {replyTo && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.brandL, borderRadius: R.sm, padding: `${S.xs}px ${S.sm}px`, marginBottom: S.xs }}>
            <span style={{ fontSize: 12, color: C.brand, fontWeight: 600 }}>↩ {replyTo.anonymous_nickname}에게 답글</span>
            <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: C.text3, padding: 0 }}>✕</button>
          </div>
        )}
        {isGuest ? (
          <button onClick={() => onRequireLogin?.()} style={{ width: '100%', padding: '13px', background: C.brandL, color: C.brand, border: `1.5px solid ${C.brandM}`, borderRadius: R.full, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            🔒 로그인하고 댓글 달기
          </button>
        ) : (
          <div style={{ display: 'flex', gap: S.sm, alignItems: 'flex-end' }}>
            <input ref={inputRef} value={commentText} onChange={e => setCommentText(e.target.value)}
              placeholder='댓글을 입력하세요...'
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
              style={{ flex: 1, padding: '12px 14px', border: `1.5px solid ${C.bgWarm}`, borderRadius: R.full, fontSize: 14, outline: 'none', background: C.surface, color: C.text1, fontFamily: 'inherit' }}
            />
            <button onClick={handleComment} disabled={!commentText.trim()}
              style={{ background: commentText.trim() ? C.brand : C.text4, color: '#fff', border: 'none', borderRadius: R.full, width: 44, height: 44, fontSize: 16, cursor: commentText.trim() ? 'pointer' : 'not-allowed', flexShrink: 0 }}>
              ↑
            </button>
          </div>
        )}
      </div>

      {showChat && (
        <ChatRequestModal
          balance={tokenBalance ?? 0}
          onConfirm={handleChatRequest}
          onCancel={() => setShowChat(false)}
        />
      )}

      {reportTarget && (
        <ReportModal
          type={reportTarget.type}
          targetId={reportTarget.targetId}
          onClose={() => setReportTarget(null)}
          onReport={() => showToast('신고가 접수됐어요')}
        />
      )}

      {showMenu && (
        <PostMenuSheet
          isOwn={isOwn}
          onEdit={() => { setShowMenu(false); onEditPost?.(post); }}
          onDelete={() => { setShowMenu(false); setShowDeleteConfirm(true); }}
          onReport={handleReport}
          onBlock={handleBlock}
          onClose={() => setShowMenu(false)}
        />
      )}

      {showDeleteConfirm && (
        <DeleteConfirmDialog
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
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
