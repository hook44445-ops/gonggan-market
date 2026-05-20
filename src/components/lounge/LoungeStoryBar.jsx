// ─────────────────────────────────────────────────────
// 공간마켓 라운지 — 스토리바 + 스토리뷰어
// ─────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import { C, R, S } from '../../constants';
import { getAnonymousAvatarByNickname, getAnonymousNickname } from '../../utils/anonymousNickname';
import ReportModal from './ReportModal';
import {
  supabase,
  getLoungeComments,
  createLoungeComment,
  createLoungeChat,
  softDeleteLoungePost,
} from '../../lib/supabase';

// ── 스토리 뷰어 (전체화면) ────────────────────────────
function StoryViewer({ stories, startIndex, onClose, onStoryDeleted, user }) {
  const [index,             setIndex]             = useState(startIndex);
  const [liked,             setLiked]             = useState({});
  const [comment,           setComment]           = useState('');
  const [showInput,         setShowInput]         = useState(false);
  const [showComments,      setShowComments]      = useState(false);
  const [reportTarget,      setReportTarget]      = useState(null);
  const [comments,          setComments]          = useState([]);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError,      setCommentError]      = useState(null);
  const [existingChat,      setExistingChat]      = useState(null);
  const [chatLoading,       setChatLoading]       = useState(false);
  const [chatError,         setChatError]         = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting,          setDeleting]          = useState(false);
  const [deleteError,       setDeleteError]       = useState(null);
  const [devInfo,           setDevInfo]           = useState(null);
  const touchStartY = useRef(null);

  const story   = stories[index];
  const avatar  = getAnonymousAvatarByNickname(story.anonymous_nickname);
  const isFirst = index === 0;
  const isLast  = index === stories.length - 1;
  const isOwner = !!(user?.id && story.user_id && user.id === story.user_id);
  const isSelf  = user?.id === story.user_id;
  const canInteract = !!(user?.id && !user.isGuest);

  // story 변경 시 댓글 로드 + 기존 대화 확인
  useEffect(() => {
    if (!story?.id) return;
    setComments([]);
    setCommentError(null);
    setChatError(null);
    setDeleteError(null);
    setExistingChat(null);
    setShowInput(false);
    setShowComments(false);

    getLoungeComments(story.id).then(({ data }) => setComments(data ?? []));

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

    if (import.meta.env.DEV) {
      setDevInfo({
        story_id:        story.id,
        story_user_id:   story.user_id,
        current_user_id: user?.id ?? null,
        isOwner,
      });
    }
  }, [story?.id, user?.id]);

  const prev = () => { if (!isFirst) setIndex(i => i - 1); };
  const next = () => { if (!isLast)  setIndex(i => i + 1); else onClose(); };

  const onTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; };
  const onTouchEnd   = (e) => {
    if (touchStartY.current === null) return;
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (delta > 50) next();
    else if (delta < -50) prev();
    touchStartY.current = null;
  };

  const submitComment = async () => {
    const text = comment.trim();
    if (!text || !story?.id || !user?.id) return;
    setCommentSubmitting(true);
    setCommentError(null);
    const { data, error } = await createLoungeComment({
      post_id:            story.id,
      user_id:            user.id,
      anonymous_nickname: getAnonymousNickname(user.id, story.id),
      content:            text,
    });
    if (error) {
      setCommentError(error.message);
    } else if (data) {
      setComments(prev => [...prev, data]);
      setComment('');
      setShowInput(false);
    }
    setCommentSubmitting(false);
  };

  const handleChat = async () => {
    if (!user?.id || !story?.user_id || isSelf || existingChat || chatLoading) return;
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
      // ignoreDuplicates=true 이면 data=null — 기존 chat 재조회
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
    setDeleting(true);
    setDeleteError(null);
    const { error } = await softDeleteLoungePost(story.id, user.id);
    if (error) {
      setDeleteError(error.message);
      setDeleting(false);
      setShowDeleteConfirm(false);
    } else {
      onStoryDeleted?.(story.id);
      onClose();
    }
  };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 400, display: 'flex', flexDirection: 'column', userSelect: 'none' }}>

      {/* 진행바 */}
      <div style={{ display: 'flex', gap: 4, padding: '12px 16px 0', flexShrink: 0 }}>
        {stories.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= index ? '#fff' : 'rgba(255,255,255,0.3)' }} />
        ))}
      </div>

      {/* 상단: 닉네임 + 삭제 + 닫기 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, padding: '12px 16px', flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatar.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          {avatar.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{story.anonymous_nickname}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
            {new Date(story.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        {isOwner && !showDeleteConfirm && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '6px 12px', borderRadius: 12 }}>
            삭제
          </button>
        )}
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', padding: 4 }}>✕</button>
      </div>

      {/* 이미지 / 텍스트 카드 */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* 좌우 터치 영역 */}
        <div onClick={prev} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '35%', zIndex: 1 }} />
        <div onClick={next} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '35%', zIndex: 1 }} />

        {story.image_urls?.length > 0 ? (
          <div style={{ width: '100%', position: 'relative' }}>
            <img
              src={story.image_urls[0]}
              alt=""
              style={{ width: '100%', maxHeight: '72vh', objectFit: 'contain', display: 'block' }}
            />
            {(story.content || story.text) && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 20px 14px', fontSize: 15, color: '#fff', fontWeight: 600, textAlign: 'center', lineHeight: 1.6, background: 'linear-gradient(transparent, rgba(0,0,0,0.75))' }}>
                {story.content || story.text}
              </div>
            )}
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: 360, background: `linear-gradient(145deg, ${avatar.color}22, ${avatar.color}44)`, borderRadius: 20, overflow: 'hidden', minHeight: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px solid ${avatar.color}66`, backdropFilter: 'blur(20px)', margin: '0 16px' }}>
            <div style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 72, marginBottom: 20 }}>{avatar.emoji}</div>
              <div style={{ fontSize: 16, color: '#fff', fontWeight: 700, textAlign: 'center', lineHeight: 1.6 }}>
                {story.content || story.text || `${story.anonymous_nickname}의 스토리`}
              </div>
              {story.category && (
                <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.18)', borderRadius: R.full, padding: '4px 14px', fontSize: 12, color: '#fff', fontWeight: 600 }}>
                  {story.category}
                </div>
              )}
            </div>
          </div>
        )}

        {!isFirst && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: 12, zIndex: 2, pointerEvents: 'none' }}>▲ 이전</div>
        )}
        {!isLast && (
          <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: 12, zIndex: 2, pointerEvents: 'none' }}>▼ 다음</div>
        )}
      </div>

      {/* 댓글 리스트 */}
      {showComments && comments.length > 0 && (
        <div style={{ maxHeight: '26vh', overflowY: 'auto', background: 'rgba(0,0,0,0.82)', padding: '8px 16px 4px', flexShrink: 0 }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', flexShrink: 0, minWidth: 52, paddingTop: 2 }}>{c.anonymous_nickname ?? '익명'}</span>
              <span style={{ fontSize: 13, color: '#fff', lineHeight: 1.5, wordBreak: 'break-all' }}>{c.content}</span>
            </div>
          ))}
        </div>
      )}

      {/* 하단 액션 */}
      <div style={{ padding: '10px 16px', paddingBottom: 'env(safe-area-inset-bottom, 12px)', background: 'rgba(0,0,0,0.55)', flexShrink: 0 }}>
        {commentError && <div style={{ fontSize: 11, color: '#f77', marginBottom: 4 }}>{commentError}</div>}
        {chatError    && <div style={{ fontSize: 11, color: '#f77', marginBottom: 4 }}>{chatError}</div>}
        {deleteError  && <div style={{ fontSize: 11, color: '#f77', marginBottom: 4 }}>{deleteError}</div>}

        {showInput ? (
          <div style={{ display: 'flex', gap: S.sm, alignItems: 'center' }}>
            <input
              value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
              placeholder="댓글 입력..."
              autoFocus
              style={{ flex: 1, padding: '11px 16px', borderRadius: R.full, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
            />
            <button
              onClick={submitComment}
              disabled={commentSubmitting || !comment.trim()}
              style={{ background: avatar.color, color: '#fff', border: 'none', borderRadius: R.full, width: 42, height: 42, fontSize: 16, cursor: 'pointer', flexShrink: 0, opacity: (commentSubmitting || !comment.trim()) ? 0.5 : 1 }}>
              {commentSubmitting ? '…' : '↑'}
            </button>
            <button onClick={() => { setShowInput(false); setComment(''); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer', padding: 4 }}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: S.sm, alignItems: 'center' }}>
            <button
              onClick={() => { if (canInteract) setShowInput(true); }}
              style={{ flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: R.full, color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: canInteract ? 'pointer' : 'default', textAlign: 'left', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>댓글 달기...</span>
              {comments.length > 0 && (
                <span
                  onClick={e => { e.stopPropagation(); setShowComments(v => !v); }}
                  style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: '2px 8px', cursor: 'pointer' }}>
                  💬 {comments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setLiked(prev => ({ ...prev, [story.id]: !prev[story.id] }))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 28, lineHeight: 1, padding: 0, flexShrink: 0 }}>
              {liked[story.id] ? '❤️' : '🤍'}
            </button>
            {!isSelf && (
              <button
                onClick={handleChat}
                disabled={chatLoading || !!existingChat}
                style={{ background: existingChat ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.18)', border: 'none', borderRadius: R.full, padding: '9px 14px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: (chatLoading || existingChat) ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: chatLoading ? 0.6 : 1, flexShrink: 0 }}>
                {existingChat
                  ? (existingChat.status === 'accepted' ? '✅ 대화중' : '⏳ 신청완료')
                  : (chatLoading ? '...' : '💬 대화')}
              </button>
            )}
            {!isSelf && (
              <button
                onClick={() => setReportTarget({ type: 'story', targetId: story.id })}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 11, cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>
                신고
              </button>
            )}
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 24 }}>
          <div style={{ background: '#1c1c1c', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 320, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🗑</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 8 }}>스토리를 삭제할까요?</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 24, lineHeight: 1.5 }}>삭제된 스토리는 복구되지 않아요</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>취소</button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '12px', background: '#E53E3E', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reportTarget && (
        <ReportModal
          type={reportTarget.type}
          targetId={reportTarget.targetId}
          onClose={() => setReportTarget(null)}
          onReport={() => {}}
        />
      )}

      {import.meta.env.DEV && devInfo && (
        <div style={{ position: 'absolute', top: 64, right: 4, background: 'rgba(0,0,0,0.87)', color: '#0f0', borderRadius: 8, padding: '5px 9px', fontSize: 9.5, lineHeight: 1.8, fontFamily: 'monospace', zIndex: 30, maxWidth: 220, pointerEvents: 'none' }}>
          [DEV] story viewer<br/>
          id: {devInfo.story_id?.slice(0,8)}<br/>
          owner_uid: {devInfo.story_user_id?.slice(0,8) ?? 'null'}<br/>
          me: {devInfo.current_user_id?.slice(0,8) ?? 'null'}<br/>
          isOwner: {String(devInfo.isOwner)}<br/>
          comments: {comments.length}<br/>
          chat: {existingChat ? `${existingChat.id?.slice(0,8)} / ${existingChat.status}` : 'none'}<br/>
          {commentError && <span style={{color:'#f66'}}>cmt_err: {commentError?.slice(0,40)}<br/></span>}
          {chatError    && <span style={{color:'#f66'}}>chat_err: {chatError?.slice(0,40)}<br/></span>}
          {deleteError  && <span style={{color:'#f66'}}>del_err: {deleteError?.slice(0,40)}<br/></span>}
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
        background: seen ? C.bg : (showThumb ? '#000' : color),
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
                  {s.id.slice(0,6)} imgs:{imgs.length} thumb:{thumb ? thumb.slice(0,40) : 'none'}
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
