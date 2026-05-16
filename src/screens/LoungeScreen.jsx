// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import { C, R, S } from '../constants';
import { useLounge } from '../hooks/useLounge';
import { MOCK_LOUNGE_POSTS } from '../constants/lounge';
import LoungeCategoryTabs from '../components/lounge/LoungeCategoryTabs';
import LoungeStoryBar from '../components/lounge/LoungeStoryBar';
import LoungePostCard from '../components/lounge/LoungePostCard';

// ── 검색 오버레이 ──────────────────────────────────────
function SearchOverlay({ onClose, onPostClick }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = query.trim().length >= 1
    ? MOCK_LOUNGE_POSTS.filter(p =>
        p.title?.includes(query) ||
        p.content?.includes(query) ||
        p.anonymous_nickname?.includes(query)
      )
    : [];

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      {/* 검색 헤더 */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.bgWarm}`, padding: `12px ${S.xl}px`, display: 'flex', gap: S.sm, alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: C.bg, borderRadius: R.full, padding: '0 14px', gap: S.sm, height: 42 }}>
          <span style={{ fontSize: 16, color: C.text3 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="글 제목, 내용, 닉네임 검색..."
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: C.text1, fontFamily: 'inherit' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: C.text3, padding: 0, lineHeight: 1 }}>✕</button>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: C.brand, fontWeight: 700, padding: '0 4px', whiteSpace: 'nowrap' }}>
          취소
        </button>
      </div>

      {/* 결과 */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {query.trim().length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 14, color: C.text3 }}>검색어를 입력하세요</div>
            <div style={{ fontSize: 12, color: C.text4, marginTop: 6 }}>제목, 내용, 닉네임으로 검색할 수 있어요</div>
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 14, color: C.text3 }}>
              <span style={{ color: C.brand, fontWeight: 700 }}>"{query}"</span> 검색 결과가 없어요
            </div>
          </div>
        ) : (
          <div style={{ background: C.surface }}>
            <div style={{ padding: `${S.sm}px ${S.xl}px`, fontSize: 12, color: C.text3, borderBottom: `1px solid ${C.bgWarm}` }}>
              검색 결과 {results.length}건
            </div>
            {results.map(post => (
              <LoungePostCard
                key={post.id}
                post={post}
                onClick={() => { onClose(); onPostClick?.(post); }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 알림 패널 ──────────────────────────────────────────
function NotifPanel({ onClose, onGoSettings }) {
  const MOCK_NOTIFS = [
    { id: 1, icon: '❤️', text: '내 글에 좋아요가 달렸어요', time: '5분 전', unread: true },
    { id: 2, icon: '💬', text: '내 댓글에 답글이 달렸어요', time: '23분 전', unread: true },
    { id: 3, icon: '🏆', text: '전문가가 내 질문에 답했어요', time: '1시간 전', unread: false },
    { id: 4, icon: '🔥', text: '관심 카테고리에 인기 글이 올라왔어요', time: '2시간 전', unread: false },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,42,36,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
      <div style={{ background: C.surface, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, maxHeight: '75vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* 핸들 + 헤더 */}
        <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${C.bgWarm}` }}>
          <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: '0 auto 16px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>🔔 알림</div>
            <button onClick={onGoSettings} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.brand, fontWeight: 700, padding: 0 }}>
              알림 설정
            </button>
          </div>
        </div>

        {/* 알림 목록 */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {MOCK_NOTIFS.map(n => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: S.md, padding: `${S.lg}px ${S.xl}px`, borderBottom: `1px solid ${C.bg}`, background: n.unread ? `${C.brandL}88` : C.surface }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: n.unread ? C.brandL : C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {n.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: C.text1, fontWeight: n.unread ? 700 : 500, lineHeight: 1.4 }}>{n.text}</div>
                <div style={{ fontSize: 11, color: C.text4, marginTop: 3 }}>{n.time}</div>
              </div>
              {n.unread && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.brand, flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>

        <div style={{ padding: `${S.md}px ${S.xl}px ${S.xl}px` }}>
          <button onClick={onClose} style={{ width: '100%', padding: '13px', background: C.bg, border: 'none', borderRadius: R.lg, fontWeight: 700, fontSize: 14, color: C.text2, cursor: 'pointer' }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 메인 스크린 ────────────────────────────────────────
export default function LoungeScreen({ user, onPostClick, onWrite, onStoryUpload, onRequireLogin, onGoMyPage }) {
  const [category,        setCategory]        = useState('all');
  const [showWriteOptions, setShowWriteOptions] = useState(false);
  const [searchOpen,      setSearchOpen]       = useState(false);
  const [notifOpen,       setNotifOpen]        = useState(false);
  const [notifCount]                           = useState(2); // 읽지 않은 알림 수

  const { posts, stories, loading } = useLounge(category);

  const isGuest    = !user?.id || user?.isGuest;
  const isLoggedIn = !isGuest;
  const isPopular  = category === 'popular'; // 인기 탭은 읽기 전용

  const handleWriteClick = () => {
    if (isGuest) { onRequireLogin?.(); return; }
    setShowWriteOptions(true);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 90 }}>
      {/* 헤더 */}
      <div style={{ background: C.surface, position: 'sticky', top: 0, zIndex: 10, borderBottom: `1px solid ${C.bgWarm}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `14px ${S.xl}px 0` }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.text1, letterSpacing: '-0.5px' }}>라운지</div>
          <div style={{ display: 'flex', gap: S.md }}>
            {/* 돋보기 */}
            <button
              onClick={() => setSearchOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.text2, padding: 4 }}>
              🔍
            </button>
            {/* 종 */}
            <button
              onClick={() => isGuest ? onRequireLogin?.() : setNotifOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.text2, padding: 4, position: 'relative' }}>
              🔔
              {isLoggedIn && notifCount > 0 && (
                <span style={{
                  position: 'absolute', top: 0, right: 0,
                  background: '#E53E3E', color: '#fff',
                  borderRadius: '50%', width: 16, height: 16,
                  fontSize: 10, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}>
                  {notifCount}
                </span>
              )}
            </button>
          </div>
        </div>
        <LoungeCategoryTabs selected={category} onChange={setCategory} />
      </div>

      <LoungeStoryBar stories={stories} onStoryClick={() => {}} />

      {/* 인기 탭 안내 배너 */}
      {isPopular && (
        <div style={{ background: C.brandL, borderLeft: `3px solid ${C.brand}`, padding: `${S.sm}px ${S.xl}px`, display: 'flex', alignItems: 'center', gap: S.sm }}>
          <span style={{ fontSize: 14 }}>🔥</span>
          <span style={{ fontSize: 12, color: C.brand, fontWeight: 600 }}>조회수·관심 순 인기 글 모음 — 읽기·댓글·관심만 가능해요</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 13, color: C.text3 }}>불러오는 중...</div>
        </div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 14, color: C.text3 }}>아직 게시글이 없어요</div>
          {isLoggedIn && (
            <button onClick={() => onWrite?.('post')} style={{ marginTop: S.xl, padding: '12px 24px', background: C.brand, color: '#fff', border: 'none', borderRadius: R.full, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              첫 글 작성하기
            </button>
          )}
        </div>
      ) : (
        <div style={{ background: C.surface }}>
          {posts.map(post => (
            <LoungePostCard key={post.id} post={post} onClick={() => onPostClick?.(post)} />
          ))}
        </div>
      )}

      {/* FAB — 인기 탭에서는 숨김 */}
      {!isPopular && <button onClick={handleWriteClick} style={{
        position: 'fixed', right: S.xl, bottom: 80, width: 56, height: 56,
        borderRadius: R.full, background: C.brand, color: '#fff',
        border: 'none', fontSize: 24, cursor: 'pointer',
        boxShadow: `0 4px 16px ${C.brand}66`, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>+</button>}

      {/* 글쓰기 선택 */}
      {showWriteOptions && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,42,36,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300 }} onClick={() => setShowWriteOptions(false)}>
          <div style={{ background: C.surface, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '24px 24px 40px' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: '0 auto 20px' }} />
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.xl, textAlign: 'center' }}>무엇을 올리시겠어요?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: S.sm }}>
              <button onClick={() => { setShowWriteOptions(false); onWrite?.('post'); }}
                style={{ padding: S.xl, background: C.brandL, color: C.brand, border: `1px solid ${C.brandM}`, borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: 'pointer', textAlign: 'left' }}>
                📝 게시물
              </button>
              <button onClick={() => { setShowWriteOptions(false); onStoryUpload?.(); }}
                style={{ padding: S.xl, background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: 'pointer', textAlign: 'left' }}>
                📸 스토리 (24시간)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 검색 오버레이 */}
      {searchOpen && (
        <SearchOverlay onClose={() => setSearchOpen(false)} onPostClick={onPostClick} />
      )}

      {/* 알림 패널 */}
      {notifOpen && (
        <NotifPanel
          onClose={() => setNotifOpen(false)}
          onGoSettings={() => { setNotifOpen(false); onGoMyPage?.(); }}
        />
      )}
    </div>
  );
}
