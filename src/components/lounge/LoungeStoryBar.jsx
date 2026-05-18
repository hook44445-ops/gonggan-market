// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState, useRef } from 'react';
import { C, R, S } from '../../constants';
import { getAnonymousAvatarByNickname } from '../../utils/anonymousNickname';
import ReportModal from './ReportModal';
import { IS_SUPABASE_READY, softDeleteLoungeStory } from '../../lib/supabase';

// ── 스토리 뷰어 (전체화면, 위아래 스와이프) ───────────
function StoryViewer({ stories, startIndex, user, onClose, onDeleteStory }) {
  const [index,        setIndex]        = useState(startIndex);
  const [liked,        setLiked]        = useState({});
  const [comment,      setComment]      = useState('');
  const [showInput,    setShowInput]    = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting,     setDeleting]    = useState(false);
  const touchStartY = useRef(null);

  const story   = stories[index];
  const avatar  = getAnonymousAvatarByNickname(story.anonymous_nickname);
  const isFirst = index === 0;
  const isLast  = index === stories.length - 1;
  const isOwn   = user && story.user_id && user.id && story.user_id === user.id;

  const prev = () => { if (!isFirst) setIndex(i => i - 1); };
  const next = () => { if (!isLast) setIndex(i => i + 1); else onClose(); };

  const onTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; };
  const onTouchEnd   = (e) => {
    if (touchStartY.current === null) return;
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (delta > 50) next();
    else if (delta < -50) prev();
    touchStartY.current = null;
  };

  const handleDelete = async () => {
    setDeleting(true);
    if (IS_SUPABASE_READY) {
      await softDeleteLoungeStory(story.id, user.id);
    }
    setDeleting(false);
    onDeleteStory?.(story.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  const hasImage = story.image_urls && story.image_urls.length > 0;

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 400, display: 'flex', flexDirection: 'column', userSelect: 'none' }}>

      {/* 배경 이미지 */}
      {hasImage && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <img src={story.image_urls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.75)' }} />
        </div>
      )}

      {/* 진행바 */}
      <div style={{ display: 'flex', gap: 4, padding: '12px 16px 0', position: 'relative', zIndex: 1 }}>
        {stories.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= index ? '#fff' : 'rgba(255,255,255,0.35)' }} />
        ))}
      </div>

      {/* 상단: 닉네임 + 닫기 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, padding: '12px 16px', position: 'relative', zIndex: 1 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatar.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, border: '2px solid rgba(255,255,255,0.7)' }}>
          {avatar.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{story.anonymous_nickname}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
            {new Date(story.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        {isOwn && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{ background: 'rgba(229,62,62,0.25)', border: '1px solid rgba(229,62,62,0.6)', borderRadius: R.full, padding: '6px 12px', color: '#ff6b6b', fontSize: 12, fontWeight: 700, cursor: 'pointer', marginRight: 4 }}>
            삭제
          </button>
        )}
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', padding: 4, position: 'relative', zIndex: 1 }}>✕</button>
      </div>

      {/* 스토리 본문 */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', position: 'relative', zIndex: 1 }}>
        <div onClick={prev} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '35%', zIndex: 1 }} />
        <div onClick={next} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '35%', zIndex: 1 }} />

        {!hasImage && (
          <div style={{ width: '100%', maxWidth: 360, background: `linear-gradient(145deg, ${avatar.color}44, ${avatar.color}88)`, borderRadius: 20, padding: 32, minHeight: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px solid ${avatar.color}77`, backdropFilter: 'blur(20px)' }}>
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
        )}

        {hasImage && (story.content || story.text) && (
          <div style={{ position: 'absolute', bottom: 80, left: 20, right: 20, background: 'rgba(0,0,0,0.5)', borderRadius: R.lg, padding: '12px 16px', backdropFilter: 'blur(4px)' }}>
            <div style={{ fontSize: 15, color: '#fff', fontWeight: 600, lineHeight: 1.5 }}>
              {story.content || story.text}
            </div>
          </div>
        )}

        {!isFirst && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>▲ 이전</div>
        )}
        {!isLast && (
          <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>▼ 다음</div>
        )}
      </div>

      {/* 하단 액션 */}
      <div style={{ padding: '12px 16px', paddingBottom: 'env(safe-area-inset-bottom, 16px)', position: 'relative', zIndex: 1 }}>
        {showInput ? (
          <div style={{ display: 'flex', gap: S.sm, alignItems: 'center' }}>
            <input
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="댓글 입력..."
              autoFocus
              style={{ flex: 1, padding: '12px 16px', borderRadius: R.full, border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
            />
            <button
              onClick={() => { setComment(''); setShowInput(false); }}
              style={{ background: avatar.color, color: '#fff', border: 'none', borderRadius: R.full, width: 44, height: 44, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>
              ↑
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: S.md, alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={() => setShowInput(true)}
              style={{ flex: 1, padding: '11px 16px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: R.full, color: 'rgba(255,255,255,0.8)', fontSize: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', backdropFilter: 'blur(4px)' }}>
              댓글 달기...
            </button>
            <button
              onClick={() => setLiked(prev => ({ ...prev, [story.id]: !prev[story.id] }))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 28, lineHeight: 1 }}>
              {liked[story.id] ? '❤️' : '🤍'}
            </button>
            {!isOwn && (
              <button
                onClick={() => {}}
                style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: R.full, padding: '10px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', backdropFilter: 'blur(4px)' }}>
                💬 대화
              </button>
            )}
            {!isOwn && (
              <button
                onClick={() => setReportTarget({ type: 'story', targetId: story.id })}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 11, cursor: 'pointer', padding: '0 4px' }}>
                신고
              </button>
            )}
          </div>
        )}
      </div>

      {reportTarget && (
        <ReportModal
          type={reportTarget.type}
          targetId={reportTarget.targetId}
          onClose={() => setReportTarget(null)}
          onReport={() => {}}
        />
      )}

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: '0 24px' }}>
          <div style={{ background: C.surface, borderRadius: R.xl, padding: 24, width: '100%', maxWidth: 300 }}>
            <div style={{ fontSize: 20, textAlign: 'center', marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, textAlign: 'center', marginBottom: 8 }}>스토리를 삭제할까요?</div>
            <div style={{ fontSize: 13, color: C.text3, textAlign: 'center', lineHeight: 1.6, marginBottom: 20 }}>삭제된 스토리는 복구할 수 없어요</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                style={{ flex: 1, padding: '12px', background: C.bg, border: 'none', borderRadius: R.lg, fontWeight: 700, fontSize: 14, color: C.text2, cursor: 'pointer' }}>
                취소
              </button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ flex: 1, padding: '12px', background: '#E53E3E', border: 'none', borderRadius: R.lg, fontWeight: 800, fontSize: 14, color: '#fff', cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 스토리 카드 (위치 블릿 스타일) ──────────────────────
function StoryCard({ story, seen, onClick }) {
  const { emoji, color } = getAnonymousAvatarByNickname(story.anonymous_nickname);
  const hasImage = story.image_urls && story.image_urls.length > 0;

  return (
    <div
      onClick={onClick}
      style={{
        width: 108,
        height: 148,
        borderRadius: 14,
        flexShrink: 0,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        background: hasImage ? '#222' : color,
        border: seen ? '2px solid transparent' : `2px solid ${color}`,
        opacity: seen ? 0.72 : 1,
        transition: 'opacity 0.2s',
      }}>

      {/* 배경 이미지 */}
      {hasImage ? (
        <img
          src={story.image_urls[0]}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
          {emoji}
        </div>
      )}

      {/* 이미지 있을 때 다크 그라데이션 오버레이 */}
      {hasImage && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.68) 100%)' }} />
      )}

      {/* 하단: 아바타 + 닉네임 */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '8px 8px 10px',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3,
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: color,
          border: '1.5px solid rgba(255,255,255,0.9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13,
          flexShrink: 0,
        }}>
          {emoji}
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700,
          color: hasImage ? '#fff' : (seen ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.95)'),
          textShadow: hasImage ? '0 1px 3px rgba(0,0,0,0.7)' : 'none',
          maxWidth: '100%',
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        }}>
          {story.anonymous_nickname}
        </div>
      </div>

      {/* 미열람 표시 — 우상단 도트 */}
      {!seen && (
        <div style={{ position: 'absolute', top: 7, right: 7, width: 8, height: 8, borderRadius: '50%', background: C.brand, border: '1.5px solid #fff' }} />
      )}
    </div>
  );
}

// ── 메인 스토리바 ──────────────────────────────────────
export default function LoungeStoryBar({ stories, user, onStoryClick, onDeleteStory }) {
  const [viewerIndex, setViewerIndex] = useState(null);
  const [seen,        setSeen]        = useState({});

  if (!stories || stories.length === 0) return null;

  const openStory = (index) => {
    setSeen(prev => ({ ...prev, [stories[index].id]: true }));
    setViewerIndex(index);
  };

  return (
    <>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.bgWarm}`, padding: `${S.md}px 0 ${S.md}px ${S.xl}px` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: S.xl, marginBottom: S.sm }}>
          <div style={{ fontSize: 13, color: C.text2, fontWeight: 800 }}>📸 스토리</div>
          <div style={{ fontSize: 12, color: C.text3, fontWeight: 600 }}>{stories.length}개</div>
        </div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', paddingRight: S.xl, paddingBottom: 2 }}>
          {stories.map((story, i) => (
            <StoryCard
              key={story.id}
              story={story}
              seen={!!seen[story.id]}
              onClick={() => openStory(i)}
            />
          ))}
        </div>
      </div>

      {viewerIndex !== null && (
        <StoryViewer
          stories={stories}
          startIndex={viewerIndex}
          user={user}
          onClose={() => setViewerIndex(null)}
          onDeleteStory={(id) => {
            onDeleteStory?.(id);
            setViewerIndex(null);
          }}
        />
      )}
    </>
  );
}
