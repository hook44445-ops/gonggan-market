// ─────────────────────────────────────────────────────
// 공간마켓 라운지 — 스토리바 + 풀스크린 스토리뷰어
// ─────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import { C, R, S } from '../../constants';
import { getAnonymousAvatarByNickname, getAnonymousNickname } from '../../utils/anonymousNickname';
import {
  supabase,
  getLoungeComments,
  createLoungeComment,
  createLoungeChat,
  softDeleteLoungePost,
  checkLoungePostLiked,
  addLoungePostLike,
  removeLoungePostLike,
  likeLoungePost,
  unlikeLoungePost,
} from '../../lib/supabase';

// ── 댓글 바텀시트 ─────────────────────────────────────
function CommentSheet({ storyId, user, comments, setComments, onClose }) {
  const [text,        setText]        = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState(null);
  const canInteract = !!(user?.id && !user.isGuest);

  const submit = async () => {
    const content = text.trim();
    if (!content || !storyId || !user?.id) return;
    setSubmitting(true);
    setError(null);
    const { data, error: err } = await createLoungeComment({
      post_id:            storyId,
      user_id:            user.id,
      anonymous_nickname: getAnonymousNickname(user.id, storyId),
      content,
    });
    if (err) {
      setError(err.message);
    } else if (data) {
      setComments(prev => [...prev, data]);
      setText('');
    }
    setSubmitting(false);
  };

  return (
    <div
      style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}>
      <div
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#191919', borderRadius: '20px 20px 0 0', maxHeight: '72vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        {/* 핸들 + 헤더 */}
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 2, margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>댓글 {comments.length}개</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: 20, cursor: 'pointer', padding: 4 }}>✕</button>
          </div>
        </div>

        {/* 댓글 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 4px' }}>
          {comments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>첫 댓글을 남겨보세요</div>
            </div>
          ) : comments.map(c => {
            const av = getAnonymousAvatarByNickname(c.anonymous_nickname ?? '');
            return (
              <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                  {av.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.65)', marginBottom: 3 }}>{c.anonymous_nickname ?? '익명'}</div>
                  <div style={{ fontSize: 14, color: '#fff', lineHeight: 1.55, wordBreak: 'break-all' }}>{c.content}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                    {new Date(c.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 입력창 */}
        <div style={{ padding: '10px 16px', paddingBottom: 'env(safe-area-inset-bottom, 10px)', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
          {error && <div style={{ fontSize: 11, color: '#f77', marginBottom: 6 }}>{error}</div>}
          {canInteract ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder="댓글을 남겨주세요"
                style={{ flex: 1, padding: '11px 15px', borderRadius: R.full, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              />
              <button
                onClick={submit}
                disabled={submitting || !text.trim()}
                style={{ width: 40, height: 40, borderRadius: '50%', background: C.brand, border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', flexShrink: 0, opacity: (!text.trim() || submitting) ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {submitting ? '…' : '↑'}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              로그인 후 댓글을 남길 수 있어요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 더보기 바텀시트 ───────────────────────────────────
function MoreSheet({ isOwner, onDelete, onReport, onClose }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  };

  return (
    <div
      style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}>
      <div
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#191919', borderRadius: '20px 20px 0 0' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 2, margin: '12px auto 0' }} />

        {confirmDelete ? (
          <div style={{ padding: '20px 20px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗑</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 6 }}>스토리를 삭제할까요?</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>삭제 후 복구되지 않아요</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '13px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>취소</button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '13px', background: '#E53E3E', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
            <div style={{ height: 'max(env(safe-area-inset-bottom, 0px), 16px)' }} />
          </div>
        ) : isOwner ? (
          <>
            <button onClick={() => setConfirmDelete(true)} style={{ width: '100%', padding: '18px 20px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#E53E3E', fontSize: 16, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
              🗑 삭제하기
            </button>
            <button onClick={onClose} style={{ width: '100%', padding: '18px 20px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer', textAlign: 'left' }}>
              취소
            </button>
            <div style={{ height: 'max(env(safe-area-inset-bottom, 0px), 8px)' }} />
          </>
        ) : (
          <>
            <button onClick={() => { onClose(); onReport(); }} style={{ width: '100%', padding: '18px 20px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 16, cursor: 'pointer', textAlign: 'left' }}>
              🚩 신고하기
            </button>
            <button onClick={onClose} style={{ width: '100%', padding: '18px 20px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 16, cursor: 'pointer', textAlign: 'left' }}>
              🚫 이 회원 차단하기
            </button>
            <button onClick={onClose} style={{ width: '100%', padding: '18px 20px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer', textAlign: 'left' }}>
              취소
            </button>
            <div style={{ height: 'max(env(safe-area-inset-bottom, 0px), 8px)' }} />
          </>
        )}
      </div>
    </div>
  );
}

// ── 스토리 뷰어 (풀스크린) ────────────────────────────
function StoryViewer({ stories, startIndex, onClose, onStoryDeleted, user }) {
  const [index,           setIndex]           = useState(startIndex);
  const [comments,        setComments]        = useState([]);
  const [existingChat,    setExistingChat]    = useState(null);
  const [chatLoading,     setChatLoading]     = useState(false);
  const [chatError,       setChatError]       = useState(null);
  const [isLiked,         setIsLiked]         = useState(false);
  const [likeCount,       setLikeCount]       = useState(0);
  const [likeLoading,     setLikeLoading]     = useState(false);
  const [likeError,       setLikeError]       = useState(null);
  const [deleteError,     setDeleteError]     = useState(null);
  const [showComments,    setShowComments]    = useState(false);
  const [showMore,        setShowMore]        = useState(false);
  const [devOpen,         setDevOpen]         = useState(false);
  const touchStartY = useRef(null);
  const touchStartX = useRef(null);

  const story   = stories[index];
  const avatar  = getAnonymousAvatarByNickname(story.anonymous_nickname);
  const isFirst = index === 0;
  const isLast  = index === stories.length - 1;
  const isOwner = !!(user?.id && story.user_id && user.id === story.user_id);
  const isSelf  = user?.id === story.user_id;

  // story 변경 시 데이터 로드
  useEffect(() => {
    if (!story?.id) return;
    setComments([]);
    setExistingChat(null);
    setChatError(null);
    setLikeError(null);
    setDeleteError(null);
    setIsLiked(false);
    setLikeCount(story.like_count ?? 0);

    getLoungeComments(story.id).then(({ data }) => setComments(data ?? []));

    if (user?.id) {
      checkLoungePostLiked(story.id, user.id).then(({ data }) => setIsLiked(!!data));
    }

    if (user?.id && story.user_id && !isSelf) {
      supabase
        .from('lounge_chats')
        .select('id, status')
        .eq('post_id', story.id)
        .eq('requester_id', user.id)
        .in('status', ['pending', 'accepted'])
        .maybeSingle()
        .then(({ data }) => setExistingChat(data ?? null));
    }
  }, [story?.id, user?.id]);

  const prev = () => { if (!isFirst) setIndex(i => i - 1); };
  const next = () => { if (!isLast)  setIndex(i => i + 1); else onClose(); };

  const onTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartY.current === null) return;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy > 50) next();
      else if (dy < -50) prev();
    }
    touchStartY.current = null;
    touchStartX.current = null;
  };

  const toggleLike = async () => {
    if (!user?.id || likeLoading) return;
    setLikeLoading(true);
    setLikeError(null);
    if (isLiked) {
      setIsLiked(false);
      setLikeCount(c => Math.max(0, c - 1));
      const { error } = await removeLoungePostLike(story.id, user.id);
      if (error) { setLikeError(error.message); setIsLiked(true); setLikeCount(c => c + 1); }
      else await unlikeLoungePost(story.id);
    } else {
      setIsLiked(true);
      setLikeCount(c => c + 1);
      const { error } = await addLoungePostLike(story.id, user.id);
      if (error) { setLikeError(error.message); setIsLiked(false); setLikeCount(c => Math.max(0, c - 1)); }
      else await likeLoungePost(story.id);
    }
    setLikeLoading(false);
  };

  const handleChat = async () => {
    if (!user?.id || isSelf || existingChat || chatLoading) return;
    setChatLoading(true);
    setChatError(null);
    const { data, error } = await createLoungeChat({
      requester_id:  user.id,
      post_user_id:  story.user_id,
      post_id:       story.id,
      status:        'pending',
      token_charged: false,
    });
    if (error) {
      setChatError(error.message);
    } else if (data) {
      setExistingChat(data);
    } else {
      const { data: existing } = await supabase
        .from('lounge_chats')
        .select('id, status')
        .eq('post_id', story.id)
        .eq('requester_id', user.id)
        .maybeSingle();
      setExistingChat(existing ?? null);
    }
    setChatLoading(false);
  };

  const handleDelete = async () => {
    if (!isOwner || !story?.id) return;
    const { error } = await softDeleteLoungePost(story.id, user.id);
    if (error) {
      setDeleteError(error.message);
      return Promise.reject(error);
    }
    onStoryDeleted?.(story.id);
    onClose();
  };

  const chatLabel = existingChat
    ? (existingChat.status === 'accepted' ? '✅ 대화중' : '⏳ 신청완료')
    : (chatLoading ? '...' : '💬 대화');

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 400, display: 'flex', flexDirection: 'column', userSelect: 'none' }}>

      {/* 진행바 */}
      <div style={{ display: 'flex', gap: 3, padding: '10px 12px 0', flexShrink: 0 }}>
        {stories.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < index ? '#fff' : i === index ? '#fff' : 'rgba(255,255,255,0.3)' }} />
        ))}
      </div>

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', flexShrink: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatar.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
          {avatar.emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{story.anonymous_nickname}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            {new Date(story.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            {story.story_expires_at && (
              <span style={{ marginLeft: 6 }}>· ⏰ 24시간</span>
            )}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', padding: '6px 8px', borderRadius: 10, lineHeight: 1 }}>✕</button>
      </div>

      {/* 메인 콘텐츠 — 풀스크린 이미지 */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* 이전/다음 터치 영역 */}
        <div onClick={prev} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '33%', zIndex: 1 }} />
        <div onClick={next} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '33%', zIndex: 1 }} />

        {story.image_urls?.length > 0 ? (
          <>
            <img
              src={story.image_urls[0]}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {(story.content || story.text) && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '60px 18px 18px', background: 'linear-gradient(transparent, rgba(0,0,0,0.82))' }}>
                <div style={{ fontSize: 15, color: '#fff', fontWeight: 600, lineHeight: 1.65, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                  {story.content || story.text}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(145deg, ${avatar.color}33, ${avatar.color}88)` }}>
            <div style={{ textAlign: 'center', padding: '0 32px', maxWidth: 340 }}>
              <div style={{ fontSize: 80, marginBottom: 24, lineHeight: 1 }}>{avatar.emoji}</div>
              <div style={{ fontSize: 18, color: '#fff', fontWeight: 700, lineHeight: 1.65 }}>
                {story.content || story.text || `${story.anonymous_nickname}의 스토리`}
              </div>
              {story.category && (
                <div style={{ marginTop: 18, display: 'inline-block', background: 'rgba(255,255,255,0.18)', borderRadius: R.full, padding: '5px 16px', fontSize: 13, color: '#fff', fontWeight: 700 }}>
                  {story.category}
                </div>
              )}
            </div>
          </div>
        )}

        {!isFirst && (
          <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.45)', fontSize: 11, zIndex: 2, pointerEvents: 'none' }}>▲ 이전</div>
        )}
        {!isLast && (
          <div style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.45)', fontSize: 11, zIndex: 2, pointerEvents: 'none' }}>▼ 다음</div>
        )}
      </div>

      {/* 하단 액션바 */}
      <div style={{ flexShrink: 0, padding: '10px 14px', paddingBottom: 'env(safe-area-inset-bottom, 10px)', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}>
        {(chatError || deleteError) && (
          <div style={{ fontSize: 11, color: '#f77', marginBottom: 6 }}>
            {chatError || deleteError}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* 댓글 트리거 */}
          <button
            onClick={() => setShowComments(true)}
            style={{ flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: R.full, color: 'rgba(255,255,255,0.75)', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ opacity: 0.6 }}>💬</span>
            <span>{comments.length > 0 ? `댓글 ${comments.length}개` : '댓글 달기...'}</span>
          </button>

          {/* 좋아요 */}
          <button
            onClick={toggleLike}
            disabled={!user?.id || likeLoading}
            style={{ flexShrink: 0, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: R.full, padding: '10px 14px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: user?.id ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 5, opacity: likeLoading ? 0.6 : 1 }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{isLiked ? '❤️' : '🤍'}</span>
            {likeCount > 0 && <span style={{ fontSize: 12 }}>{likeCount}</span>}
          </button>

          {/* 대화신청 (본인 제외) */}
          {!isSelf && (
            <button
              onClick={handleChat}
              disabled={chatLoading || !!existingChat}
              style={{ flexShrink: 0, background: existingChat ? 'rgba(255,255,255,0.06)' : 'rgba(46,95,75,0.7)', border: `1px solid ${existingChat ? 'rgba(255,255,255,0.12)' : C.brandM}`, borderRadius: R.full, padding: '10px 14px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: existingChat ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: chatLoading ? 0.5 : 1 }}>
              {chatLabel}
            </button>
          )}

          {/* 더보기 */}
          <button
            onClick={() => setShowMore(true)}
            style={{ flexShrink: 0, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: R.full, padding: '10px 12px', color: '#fff', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>
            ···
          </button>
        </div>
      </div>

      {/* 댓글 시트 */}
      {showComments && (
        <CommentSheet
          storyId={story.id}
          user={user}
          comments={comments}
          setComments={setComments}
          onClose={() => setShowComments(false)}
        />
      )}

      {/* 더보기 시트 */}
      {showMore && (
        <MoreSheet
          isOwner={isOwner}
          onDelete={handleDelete}
          onReport={() => {}}
          onClose={() => setShowMore(false)}
        />
      )}

      {/* DEV 패널 (접이식) */}
      {import.meta.env.DEV && (
        <div style={{ position: 'absolute', top: 56, left: 4, zIndex: 30 }}>
          <button
            onClick={() => setDevOpen(v => !v)}
            style={{ background: 'rgba(0,0,0,0.75)', color: '#0f0', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 10, cursor: 'pointer', fontFamily: 'monospace' }}>
            DEV {devOpen ? '▼' : '▶'}
          </button>
          {devOpen && (
            <div style={{ marginTop: 2, background: 'rgba(0,0,0,0.9)', color: '#0f0', borderRadius: 8, padding: '6px 9px', fontSize: 9.5, lineHeight: 1.9, fontFamily: 'monospace', maxWidth: 240, maxHeight: 200, overflowY: 'auto' }}>
              id: {story.id?.slice(0,8)}<br/>
              owner_uid: {story.user_id?.slice(0,8) ?? 'null'}<br/>
              me: {user?.id?.slice(0,8) ?? 'null'}<br/>
              isOwner: {String(isOwner)}<br/>
              imgs: {JSON.stringify(story.image_urls?.slice(0,1))}<br/>
              comments: {comments.length}<br/>
              liked: {String(isLiked)} / cnt:{likeCount}<br/>
              chat: {existingChat ? `${existingChat.id?.slice(0,8)}/${existingChat.status}` : 'none'}<br/>
              {chatError   && <span style={{color:'#f66'}}>chat_err: {chatError?.slice(0,36)}<br/></span>}
              {likeError   && <span style={{color:'#f66'}}>like_err: {likeError?.slice(0,36)}<br/></span>}
              {deleteError && <span style={{color:'#f66'}}>del_err: {deleteError?.slice(0,36)}<br/></span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 스토리 원형 미니어처 ──────────────────────────────
function StoryCircle({ story, seen, onClick }) {
  const { emoji, color } = getAnonymousAvatarByNickname(story.anonymous_nickname);
  const imageUrls = Array.isArray(story.image_urls)
    ? story.image_urls
    : Array.isArray(story.imageUrls)
      ? story.imageUrls
      : [];
  const thumb = imageUrls[0] || story.thumbnail_url || null;
  const [imgFailed, setImgFailed] = useState(false);
  const showThumb = thumb && !imgFailed;

  return (
    <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, cursor: 'pointer' }}>
      <div style={{
        width: 56, height: 56, borderRadius: R.full,
        background: seen ? C.bg : (showThumb ? '#111' : color),
        border: `2.5px solid ${seen ? C.bgWarm : color}`,
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26,
        opacity: seen ? 0.5 : 1,
        boxShadow: seen ? 'none' : `0 2px 8px ${color}55`,
        transition: 'all 0.2s',
        flexShrink: 0,
      }}>
        {showThumb ? (
          <img
            src={thumb}
            alt=""
            onError={() => setImgFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          emoji
        )}
      </div>
      <div style={{ fontSize: 10, color: seen ? C.text4 : C.text3, maxWidth: 56, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {story.anonymous_nickname}
      </div>
    </div>
  );
}

// ── 메인 스토리바 ──────────────────────────────────────
export default function LoungeStoryBar({ stories, onStoryClick, user, onStoryDeleted }) {
  const [viewerIndex,  setViewerIndex]  = useState(null);
  const [seen,         setSeen]         = useState({});
  const [localStories, setLocalStories] = useState(stories ?? []);

  useEffect(() => { setLocalStories(stories ?? []); }, [stories]);

  const handleStoryDeleted = (storyId) => {
    setLocalStories(prev => prev.filter(s => s.id !== storyId));
    setViewerIndex(null);
    onStoryDeleted?.(storyId);
  };

  if (!localStories || localStories.length === 0) return null;

  const openStory = (index) => {
    setSeen(prev => ({ ...prev, [localStories[index].id]: true }));
    setViewerIndex(index);
  };

  return (
    <>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.bgWarm}`, padding: `${S.md}px ${S.xl}px` }}>
        <div style={{ fontSize: 12, color: C.text3, fontWeight: 700, marginBottom: S.sm }}>📸 실시간 스토리</div>
        <div style={{ display: 'flex', gap: S.lg, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {localStories.map((story, i) => (
            <StoryCircle
              key={story.id}
              story={story}
              seen={!!seen[story.id]}
              onClick={() => openStory(i)}
            />
          ))}
        </div>

        {import.meta.env.DEV && (
          <div style={{ marginTop: 6, background: 'rgba(0,0,0,0.88)', color: '#0f0', borderRadius: 6, padding: '4px 8px', fontSize: 9.5, lineHeight: 1.7, fontFamily: 'monospace', maxHeight: 130, overflowY: 'auto' }}>
            [DEV] story bar | count: {localStories.length}<br/>
            {localStories.slice(0, 4).map(s => {
              const imgs = Array.isArray(s.image_urls) ? s.image_urls : Array.isArray(s.imageUrls) ? s.imageUrls : [];
              const thumb = imgs[0] || s.thumbnail_url || null;
              return (
                <span key={s.id} style={{ display: 'block' }}>
                  {s.id.slice(0,6)} imgs:{imgs.length} thumb:{thumb ? thumb.slice(0, 40) : 'none'}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {viewerIndex !== null && (
        <StoryViewer
          stories={localStories}
          startIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onStoryDeleted={handleStoryDeleted}
          user={user}
        />
      )}
    </>
  );
}
