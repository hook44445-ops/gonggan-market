// ─────────────────────────────────────────────────────
// 공간마켓 라운지 — 스토리바 + 풀스크린 스토리뷰어
// ─────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import { C, R, S } from '../../constants';
import { getAnonymousAvatarByNickname, getAnonymousNickname } from '../../utils/anonymousNickname';
import {
  getLoungeComments,
  createLoungeComment,
  softDeleteLoungePost,
  checkLoungePostLiked,
  addLoungePostLike,
  removeLoungePostLike,
  likeLoungePost,
  unlikeLoungePost,
} from '../../lib/supabase';

// ── 댓글 바텀시트 (화이트) ────────────────────────────
function CommentSheet({ storyId, user, comments, setComments, onClose }) {
  const [text,       setText]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);
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
      is_expert_reply:    false,
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
      style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}>
      <div
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '20px 20px 0 0', maxHeight: '72vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        {/* 핸들 + 헤더 */}
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: '#ddd', borderRadius: 2, margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111' }}>댓글 {comments.length}</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#bbb', fontSize: 20, cursor: 'pointer', padding: 4, lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {/* 댓글 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 4px' }}>
          {comments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
              <div style={{ fontSize: 13, color: '#bbb' }}>첫 댓글을 남겨보세요</div>
            </div>
          ) : comments.map(c => {
            const av = getAnonymousAvatarByNickname(c.anonymous_nickname ?? '');
            return (
              <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {av.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>{c.anonymous_nickname ?? '익명'}</span>
                      <span style={{ fontSize: 11, color: '#bbb', marginLeft: 6 }}>
                        {new Date(c.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 14, color: '#222', lineHeight: 1.55, marginTop: 3, wordBreak: 'break-all' }}>{c.content}</div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: '#bbb', cursor: 'pointer' }}>좋아요</span>
                    <span style={{ fontSize: 11, color: '#bbb', cursor: 'pointer' }}>답글</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 입력창 */}
        <div style={{ padding: '10px 16px', paddingBottom: 'env(safe-area-inset-bottom, 10px)', borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
          {error && <div style={{ fontSize: 11, color: '#e55', marginBottom: 6 }}>{error}</div>}
          {canInteract ? (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder="댓글을 남겨주세요"
                style={{ flex: 1, padding: '11px 15px', borderRadius: R.full, border: 'none', background: '#f2f2f2', color: '#111', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              />
              <button
                onClick={submit}
                disabled={submitting || !text.trim()}
                style={{ width: 40, height: 40, borderRadius: '50%', background: C.brand, border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer', flexShrink: 0, opacity: (!text.trim() || submitting) ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {submitting ? '…' : '↑'}
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 13, color: '#bbb' }}>
              로그인 후 댓글을 남길 수 있어요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 더보기 바텀시트 (화이트, 블릿 스타일) ─────────────
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
      style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}>
      <div
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '16px 16px 0 0' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, background: '#ddd', borderRadius: 2, margin: '12px auto 0' }} />

        {confirmDelete ? (
          <div style={{ padding: '24px 20px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🗑</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#111', marginBottom: 6 }}>스토리를 삭제할까요?</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>삭제 후 복구되지 않아요</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: '14px', background: '#f2f2f2', border: 'none', borderRadius: 12, color: '#333', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>취소</button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '14px', background: '#E53E3E', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
            <div style={{ height: 'max(env(safe-area-inset-bottom, 0px), 20px)' }} />
          </div>
        ) : isOwner ? (
          <>
            <button onClick={() => setConfirmDelete(true)} style={{ width: '100%', padding: '20px 24px', background: 'none', border: 'none', borderBottom: '1px solid #f2f2f2', color: '#E53E3E', fontSize: 17, cursor: 'pointer', textAlign: 'left' }}>
              삭제하기
            </button>
            <button onClick={onClose} style={{ width: '100%', padding: '20px 24px', background: 'none', border: 'none', color: '#888', fontSize: 17, cursor: 'pointer', textAlign: 'center' }}>
              취소
            </button>
            <div style={{ height: 'max(env(safe-area-inset-bottom, 0px), 8px)' }} />
          </>
        ) : (
          <>
            <button onClick={() => { onReport(); onClose(); }} style={{ width: '100%', padding: '20px 24px', background: 'none', border: 'none', borderBottom: '1px solid #f2f2f2', color: '#111', fontSize: 17, cursor: 'pointer', textAlign: 'left' }}>
              신고하기
            </button>
            <button onClick={onClose} style={{ width: '100%', padding: '20px 24px', background: 'none', border: 'none', borderBottom: '1px solid #f2f2f2', color: '#111', fontSize: 17, cursor: 'pointer', textAlign: 'left' }}>
              이 회원 차단하기
            </button>
            <button onClick={onClose} style={{ width: '100%', padding: '20px 24px', background: 'none', border: 'none', color: '#888', fontSize: 17, cursor: 'pointer', textAlign: 'center' }}>
              취소
            </button>
            <div style={{ height: 'max(env(safe-area-inset-bottom, 0px), 8px)' }} />
          </>
        )}
      </div>
    </div>
  );
}

// ── 스토리 뷰어 (풀스크린, 블릿 레이아웃) ────────────
function StoryViewer({ stories, startIndex, onClose, onStoryDeleted, user }) {
  const [index,        setIndex]        = useState(startIndex);
  const [comments,     setComments]     = useState([]);
  const [isLiked,      setIsLiked]      = useState(false);
  const [likeCount,    setLikeCount]    = useState(0);
  const [likeLoading,  setLikeLoading]  = useState(false);
  const [deleteError,  setDeleteError]  = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [showMore,     setShowMore]     = useState(false);
  const [bannerClosed, setBannerClosed] = useState(false);
  const [devOpen,      setDevOpen]      = useState(false);
  const [bgImgFailed,  setBgImgFailed]  = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const story   = stories[index];
  const avatar  = getAnonymousAvatarByNickname(story.anonymous_nickname);
  const isFirst = index === 0;
  const isLast  = index === stories.length - 1;
  const isOwner = !!(user?.id && story.user_id && user.id === story.user_id);

  useEffect(() => {
    setBgImgFailed(false);
  }, [story?.id]);

  useEffect(() => {
    if (!story?.id) return;
    setComments([]);
    setDeleteError(null);
    setIsLiked(false);
    setLikeCount(story.like_count ?? 0);

    getLoungeComments(story.id).then(({ data }) => setComments(data ?? []));

    if (user?.id) {
      checkLoungePostLiked(story.id, user.id).then(({ data }) => setIsLiked(!!data));
    }
  }, [story?.id, user?.id]);

  const prev = () => { if (!isFirst) setIndex(i => i - 1); };
  const next = () => { if (!isLast) setIndex(i => i + 1); else onClose(); };

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx > 0) next(); else prev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const toggleLike = async () => {
    if (!user?.id || likeLoading) return;
    setLikeLoading(true);
    if (isLiked) {
      setIsLiked(false);
      setLikeCount(c => Math.max(0, c - 1));
      const { error } = await removeLoungePostLike(story.id, user.id);
      if (error) { setIsLiked(true); setLikeCount(c => c + 1); }
      else await unlikeLoungePost(story.id);
    } else {
      setIsLiked(true);
      setLikeCount(c => c + 1);
      const { error } = await addLoungePostLike(story.id, user.id);
      if (error) { setIsLiked(false); setLikeCount(c => Math.max(0, c - 1)); }
      else await likeLoungePost(story.id);
    }
    setLikeLoading(false);
  };

  const handleDelete = async () => {
    if (!isOwner || !story?.id) return;
    const { error } = await softDeleteLoungePost(story.id, user.id);
    if (error) { setDeleteError(error.message); return Promise.reject(error); }
    onStoryDeleted?.(story.id);
    onClose();
  };

  const imageUrls = Array.isArray(story.image_urls) ? story.image_urls : [];
  const hasImage  = imageUrls.length > 0;

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 400, userSelect: 'none', overflow: 'hidden' }}>

      {/* ── 배경 이미지 (풀스크린) ── */}
      {hasImage && !bgImgFailed ? (
        <img
          src={imageUrls[0]}
          alt=""
          onError={() => setBgImgFailed(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(145deg, ${avatar.color}55, ${avatar.color}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', padding: '0 32px', maxWidth: 340 }}>
            <div style={{ fontSize: 80, marginBottom: 24, lineHeight: 1 }}>{avatar.emoji}</div>
            <div style={{ fontSize: 19, color: '#fff', fontWeight: 700, lineHeight: 1.65 }}>
              {story.content || story.text || `${story.anonymous_nickname}의 스토리`}
            </div>
          </div>
        </div>
      )}

      {/* ── 진행바 (이미지 위 최상단) ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', gap: 3, padding: 'env(safe-area-inset-top, 10px) 12px 0', paddingTop: 'max(env(safe-area-inset-top, 0px), 10px)', zIndex: 10 }}>
        {stories.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < index ? '#fff' : i === index ? '#fff' : 'rgba(255,255,255,0.35)' }} />
        ))}
      </div>

      {/* ── 상단 헤더 (뒤로 / 스토리 / X) ── */}
      <div style={{ position: 'absolute', top: 'max(env(safe-area-inset-top, 0px), 10px)', left: 0, right: 0, marginTop: 14, display: 'flex', alignItems: 'center', padding: '0 14px', zIndex: 10 }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', padding: '4px 8px 4px 0', lineHeight: 1 }}>
          ←
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>스토리</div>
        <div style={{ width: 40 }} />
      </div>

      {/* ── 24시간 배너 ── */}
      {story.story_expires_at && !bannerClosed && (
        <div style={{ position: 'absolute', top: 'max(env(safe-area-inset-top, 0px), 10px)', left: 0, right: 0, marginTop: 60, display: 'flex', justifyContent: 'center', zIndex: 10, padding: '0 12px' }}>
          <div style={{ background: 'rgba(0,0,0,0.55)', borderRadius: R.full, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 8, backdropFilter: 'blur(4px)' }}>
            <span style={{ fontSize: 13, color: '#fff' }}>⚡ 스토리는 24시간 뒤에 사라져요!</span>
            <button
              onClick={() => setBannerClosed(true)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 14, cursor: 'pointer', padding: 0, lineHeight: 1 }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── 좌하단 터치 영역 (이전) ── */}
      <div onClick={prev} style={{ position: 'absolute', left: 0, top: 80, bottom: 120, width: '33%', zIndex: 5 }} />
      {/* ── 우하단 터치 영역 (다음) ── */}
      <div onClick={next} style={{ position: 'absolute', right: 0, top: 80, bottom: 120, width: '33%', zIndex: 5 }} />

      {/* ── 하단 그라데이션 오버레이 ── */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 220, background: 'linear-gradient(transparent, rgba(0,0,0,0.75))', zIndex: 6, pointerEvents: 'none' }} />

      {/* ── 좌하단: 유저정보 + 내용 ── */}
      <div style={{ position: 'absolute', bottom: 24, left: 16, right: 70, zIndex: 8, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatar.color, border: '2px solid rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
            {avatar.emoji}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{story.anonymous_nickname}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
              {new Date(story.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
        {hasImage && (story.content || story.text) && (
          <div style={{ fontSize: 14, color: '#fff', fontWeight: 500, lineHeight: 1.6, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
            {story.content || story.text}
          </div>
        )}
        {deleteError && (
          <div style={{ fontSize: 11, color: '#fca', marginTop: 4 }}>{deleteError}</div>
        )}
      </div>

      {/* ── 우측 세로 액션바 (블릿 스타일) ── */}
      <div style={{
        position: 'absolute', bottom: 24, right: 14, zIndex: 8,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {/* 좋아요 */}
        <button
          onClick={toggleLike}
          disabled={!user?.id || likeLoading}
          style={{ background: 'none', border: 'none', cursor: user?.id ? 'pointer' : 'default', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: likeLoading ? 0.6 : 1 }}>
          <span style={{ fontSize: 28, lineHeight: 1, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>{isLiked ? '❤️' : '🤍'}</span>
          {likeCount > 0 && <span style={{ fontSize: 12, color: '#fff', fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{likeCount}</span>}
        </button>

        {/* 댓글 */}
        <button
          onClick={() => setShowComments(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 26, lineHeight: 1, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>💬</span>
          {comments.length > 0 && <span style={{ fontSize: 12, color: '#fff', fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{comments.length}</span>}
        </button>

        {/* 더보기 */}
        <button
          onClick={() => setShowMore(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <span style={{ fontSize: 22, color: '#fff', fontWeight: 900, lineHeight: 1, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>···</span>
        </button>
      </div>

      {/* ── 댓글 시트 ── */}
      {showComments && (
        <CommentSheet
          storyId={story.id}
          user={user}
          comments={comments}
          setComments={setComments}
          onClose={() => setShowComments(false)}
        />
      )}

      {/* ── 더보기 시트 ── */}
      {showMore && (
        <MoreSheet
          isOwner={isOwner}
          onDelete={handleDelete}
          onReport={() => {}}
          onClose={() => setShowMore(false)}
        />
      )}

      {/* ── DEV 패널 (접이식) ── */}
      {import.meta.env.DEV && (
        <div style={{ position: 'absolute', top: 56, left: 4, zIndex: 20 }}>
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
              imgs: {imageUrls.length}장<br/>
              comments: {comments.length}<br/>
              liked: {String(isLiked)} / cnt:{likeCount}<br/>
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
