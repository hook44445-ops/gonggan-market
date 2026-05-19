// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState, useRef } from 'react';
import { C, R, S } from '../../constants';
import { getAnonymousAvatarByNickname } from '../../utils/anonymousNickname';
import ReportModal from './ReportModal';

// ── 스토리 뷰어 (전체화면, 위아래 스와이프) ───────────
function StoryViewer({ stories, startIndex, onClose }) {
  const [index,        setIndex]        = useState(startIndex);
  const [liked,        setLiked]        = useState({});
  const [comment,      setComment]      = useState('');
  const [showInput,    setShowInput]    = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const touchStartY = useRef(null);

  const story   = stories[index];
  const avatar  = getAnonymousAvatarByNickname(story.anonymous_nickname);
  const isFirst = index === 0;
  const isLast  = index === stories.length - 1;

  const prev = () => { if (!isFirst) setIndex(i => i - 1); };
  const next = () => { if (!isLast) setIndex(i => i + 1); else onClose(); };

  const onTouchStart = (e) => { touchStartY.current = e.touches[0].clientY; };
  const onTouchEnd   = (e) => {
    if (touchStartY.current === null) return;
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (delta > 50) next();       // 위로 스와이프 → 다음
    else if (delta < -50) prev(); // 아래로 스와이프 → 이전
    touchStartY.current = null;
  };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 400, display: 'flex', flexDirection: 'column', userSelect: 'none' }}>

      {/* 진행바 */}
      <div style={{ display: 'flex', gap: 4, padding: '12px 16px 0' }}>
        {stories.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= index ? '#fff' : 'rgba(255,255,255,0.3)' }} />
        ))}
      </div>

      {/* 상단: 닉네임 + 닫기 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, padding: '12px 16px' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatar.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          {avatar.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{story.anonymous_nickname}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
            {new Date(story.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', padding: 4 }}>✕</button>
      </div>

      {/* 스토리 카드 */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', position: 'relative' }}>
        {/* 이전/다음 영역 (좌우 터치) */}
        <div onClick={prev} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '35%', zIndex: 1 }} />
        <div onClick={next} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '35%', zIndex: 1 }} />

        <div style={{ width: '100%', maxWidth: 360, background: `linear-gradient(145deg, ${avatar.color}22, ${avatar.color}44)`, borderRadius: 20, padding: 32, minHeight: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `2px solid ${avatar.color}66`, backdropFilter: 'blur(20px)' }}>
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

        {/* 위아래 안내 */}
        {!isFirst && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>▲ 이전</div>
        )}
        {!isLast && (
          <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>▼ 다음</div>
        )}
      </div>

      {/* 하단 액션 */}
      <div style={{ padding: '12px 16px', paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
        {showInput ? (
          <div style={{ display: 'flex', gap: S.sm, alignItems: 'center' }}>
            <input
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="댓글 입력..."
              autoFocus
              style={{ flex: 1, padding: '12px 16px', borderRadius: R.full, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
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
              style={{ flex: 1, padding: '11px 16px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: R.full, color: 'rgba(255,255,255,0.7)', fontSize: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              댓글 달기...
            </button>
            {/* 하트 */}
            <button
              onClick={() => setLiked(prev => ({ ...prev, [story.id]: !prev[story.id] }))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 28, lineHeight: 1 }}>
              {liked[story.id] ? '❤️' : '🤍'}
            </button>
            {/* 대화 신청 */}
            <button
              onClick={() => {}}
              style={{ background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: R.full, padding: '10px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              💬 대화
            </button>
            {/* 신고 */}
            <button
              onClick={() => setReportTarget({ type: 'story', targetId: story.id })}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 11, cursor: 'pointer', padding: '0 4px' }}>
              신고
            </button>
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
    </div>
  );
}

// ── 스토리 원형 미니어처 ──────────────────────────────
function StoryCircle({ story, seen, onClick }) {
  const { emoji, color } = getAnonymousAvatarByNickname(story.anonymous_nickname);

  return (
    <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, cursor: 'pointer' }}>
      <div style={{
        width: 56, height: 56, borderRadius: R.full,
        background: seen ? C.bg : color,
        border: seen ? `2.5px solid ${C.bgWarm}` : `2.5px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26,
        opacity: seen ? 0.5 : 1,
        boxShadow: seen ? 'none' : `0 2px 8px ${color}55`,
        transition: 'all 0.2s',
      }}>
        {emoji}
      </div>
      <div style={{ fontSize: 10, color: seen ? C.text4 : C.text3, maxWidth: 56, textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {story.anonymous_nickname}
      </div>
    </div>
  );
}

// ── 메인 스토리바 ──────────────────────────────────────
export default function LoungeStoryBar({ stories, onStoryClick }) {
  const [viewerIndex, setViewerIndex] = useState(null);
  const [seen,        setSeen]        = useState({});

  if (!stories || stories.length === 0) return null;

  const openStory = (index) => {
    setSeen(prev => ({ ...prev, [stories[index].id]: true }));
    setViewerIndex(index);
  };

  return (
    <>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.bgWarm}`, padding: `${S.md}px ${S.xl}px` }}>
        <div style={{ fontSize: 12, color: C.text3, fontWeight: 700, marginBottom: S.sm }}>📸 실시간 스토리</div>
        <div style={{ display: 'flex', gap: S.lg, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {stories.map((story, i) => (
            <StoryCircle
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
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  );
}
