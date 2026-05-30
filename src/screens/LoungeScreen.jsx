// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import { C, R, S } from '../constants';
import { SHOW_DEBUG_UI } from '../constants/release';
import { useLounge } from '../hooks/useLounge';
import { IS_SUPABASE_READY, getNotifications, markAllNotifsRead, createLoungeNotification } from '../lib/supabase';
import LoungeCategoryTabs from '../components/lounge/LoungeCategoryTabs';
import LoungeStoryBar from '../components/lounge/LoungeStoryBar';
import LoungePostCard from '../components/lounge/LoungePostCard';

// ── 알림 유틸 ──────────────────────────────────────────
const NOTIF_META = {
  post_like:             { icon: '❤️' },
  post_comment:          { icon: '💬' },
  comment_reply:         { icon: '↩️' },
  expert_answer:         { icon: '🏆' },
  popular_post:          { icon: '🔥' },
  bid_submitted:         { icon: '📝' },
  company_selected:      { icon: '🏠' },
  step_approval_request: { icon: '✅' },
  settled:               { icon: '💰' },
  dispute_filed:         { icon: '⚠️' },
  admin_action:          { icon: '🛡️' },
};

function relTime(isoStr) {
  const m = Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000);
  if (m < 1)   return '방금';
  if (m < 60)  return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

// ── 검색 오버레이 ──────────────────────────────────────
function SearchOverlay({ onClose, onPostClick, allPosts = [] }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = query.trim().length >= 1
    ? allPosts.filter(p =>
        p.title?.includes(query) ||
        p.content?.includes(query) ||
        p.anonymous_nickname?.includes(query)
      )
    : [];

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 200, display: 'flex', flexDirection: 'column' }}>
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
function NotifPanel({ notifs, loading, onClose, onGoSettings }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,42,36,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
      <div style={{ background: C.surface, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, maxHeight: '75vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${C.bgWarm}` }}>
          <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: '0 auto 16px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>🔔 알림</div>
            <button onClick={onGoSettings} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.text4, fontWeight: 700, padding: 0 }}>
              알림 설정 (준비중)
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
              <div style={{ fontSize: 13, color: C.text3 }}>불러오는 중...</div>
            </div>
          ) : notifs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text2, marginBottom: 6 }}>새 알림이 없습니다</div>
              <div style={{ fontSize: 12, color: C.text4, lineHeight: 1.6 }}>좋아요·댓글·전문가 답변 알림이 여기에 표시됩니다</div>
            </div>
          ) : (
            notifs.map(n => {
              const icon = NOTIF_META[n.type]?.icon ?? '🔔';
              return (
                <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: S.md, padding: `${S.lg}px ${S.xl}px`, borderBottom: `1px solid ${C.bg}`, background: !n.is_read ? `${C.brandL}88` : C.surface }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: !n.is_read ? C.brandL : C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: C.text1, fontWeight: !n.is_read ? 700 : 500, lineHeight: 1.4 }}>{n.message}</div>
                    <div style={{ fontSize: 11, color: C.text4, marginTop: 3 }}>{relTime(n.created_at)}</div>
                  </div>
                  {!n.is_read && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.brand, flexShrink: 0 }} />
                  )}
                </div>
              );
            })
          )}
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

// ── 알림 DEV 패널 ─────────────────────────────────────
function NotifsDevPanel({ notifs, notifsLoading, notifsError, userId }) {
  const [open,       setOpen]       = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok, err }
  const [testing,    setTesting]    = useState(false);

  const tableNotFound = !!(notifsError?.code === '42P01' || notifsError?.message?.includes('does not exist'));
  const tableExists   = IS_SUPABASE_READY && !notifsError ? 'unknown (loading...)' : IS_SUPABASE_READY ? (tableNotFound ? 'false ❌' : 'true ✓') : 'N/A (Supabase off)';

  const runInsertTest = async () => {
    if (!userId || !IS_SUPABASE_READY) return;
    setTesting(true);
    setTestResult(null);
    const { error } = await createLoungeNotification({
      userId,
      type:        '__dev_test__',
      title:       'DEV 테스트',
      message:     'NotifsDevPanel insert 검증',
      relatedId:   null,
      relatedType: null,
    });
    setTestResult({ ok: !error, err: error ? { message: error.message, code: error.code } : null });
    setTesting(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ display: 'block', width: '100%', background: '#1a1a2e', color: '#ffcc44', border: 'none', padding: '6px 16px', fontSize: 11, fontWeight: 700, textAlign: 'left', cursor: 'pointer', letterSpacing: 0.5 }}>
        [DEV] 알림 패널 열기 ▼
      </button>
    );
  }
  const rowStyle = { display: 'flex', gap: 8, padding: '3px 0', borderBottom: '1px solid #2a2a4a', flexWrap: 'wrap' };
  const keyStyle = { color: '#ffcc44', fontSize: 10, fontWeight: 700, minWidth: 130, flexShrink: 0 };
  const valStyle = { color: '#e0e0e0', fontSize: 10, wordBreak: 'break-all', flex: 1 };
  const errStyle = { color: '#ff6b6b', fontSize: 10, wordBreak: 'break-all', flex: 1 };
  const okStyle  = { color: '#44ff88', fontSize: 10, wordBreak: 'break-all', flex: 1 };

  return (
    <div style={{ background: '#0d0d1a', border: '1px solid #2a2a4a', margin: '0 0 2px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid #2a2a4a' }}>
        <span style={{ color: '#ffcc44', fontSize: 11, fontWeight: 900 }}>[DEV] 알림 (notifications)</span>
        <button onClick={() => setOpen(false)} style={{ background: 'none', color: '#666', border: 'none', fontSize: 13, cursor: 'pointer', lineHeight: 1 }}>✕</button>
      </div>
      <div style={{ padding: '8px 12px' }}>
        <div style={rowStyle}><span style={keyStyle}>IS_SUPABASE_READY</span><span style={valStyle}>{String(IS_SUPABASE_READY)}</span></div>
        <div style={rowStyle}><span style={keyStyle}>table_exists</span><span style={tableNotFound ? errStyle : valStyle}>{tableExists}</span></div>
        <div style={rowStyle}><span style={keyStyle}>loading</span><span style={valStyle}>{String(notifsLoading)}</span></div>
        <div style={rowStyle}><span style={keyStyle}>db_rows</span><span style={valStyle}>{notifs.length}</span></div>
        <div style={rowStyle}><span style={keyStyle}>unread_count</span><span style={valStyle}>{notifs.filter(n => !n.is_read).length}</span></div>
        <div style={rowStyle}><span style={keyStyle}>fetch_err</span><span style={notifsError ? errStyle : valStyle}>{notifsError ? JSON.stringify({ message: notifsError.message, code: notifsError.code }) : 'null'}</span></div>

        {/* Insert 테스트 */}
        <div style={{ margin: '8px 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={runInsertTest}
            disabled={testing || !IS_SUPABASE_READY || !userId}
            style={{ background: '#1a2a3a', color: '#ffcc44', border: '1px solid #ffcc4466', borderRadius: 3, padding: '3px 10px', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>
            {testing ? '테스트 중...' : 'Insert 테스트 실행'}
          </button>
          {!userId && <span style={{ color: '#ff6b6b', fontSize: 10 }}>userId 없음 (로그인 필요)</span>}
        </div>
        {testResult && (
          <>
            <div style={rowStyle}><span style={keyStyle}>insert_ok</span><span style={testResult.ok ? okStyle : errStyle}>{String(testResult.ok)}</span></div>
            <div style={rowStyle}><span style={keyStyle}>insert_err</span><span style={testResult.err ? errStyle : valStyle}>{testResult.err ? JSON.stringify(testResult.err) : 'null'}</span></div>
          </>
        )}

        {/* 최근 rows 미리보기 */}
        {notifs.length > 0 && (
          <div style={{ marginTop: 4, color: '#aaa', fontSize: 10, fontWeight: 700 }}>최근 rows (최대 3)</div>
        )}
        {notifs.slice(0, 3).map((n, i) => (
          <div key={n.id} style={rowStyle}>
            <span style={keyStyle}>rows[{i}]</span>
            <span style={valStyle}>type={n.type} read={String(n.is_read)} {relTime(n.created_at)}</span>
          </div>
        ))}
      </div>

      {/* 확인 SQL */}
      <div style={{ padding: '6px 12px 10px', borderTop: '1px solid #2a2a4a' }}>
        <div style={{ color: '#888', fontSize: 9, fontWeight: 700, marginBottom: 3 }}>SQL 확인 쿼리 (Supabase SQL Editor)</div>
        <div style={{ background: '#111', borderRadius: 3, padding: '5px 8px', fontSize: 9, color: '#7fdbff', fontFamily: 'monospace', lineHeight: 1.6, userSelect: 'all' }}>
          {'select * from notifications order by created_at desc limit 20;'}
        </div>
      </div>
    </div>
  );
}

// ── 스토리 DEV 패널 ────────────────────────────────────
function StoryDevPanel({ stories, storiesError }) {
  const [devData, setDevData] = useState(null);
  const [open, setOpen]       = useState(false);

  const refresh = () => {
    try {
      const raw = localStorage.getItem('lounge_dev_story_upload');
      setDevData(raw ? JSON.parse(raw) : null);
    } catch { setDevData(null); }
    setOpen(true);
  };

  if (!open) {
    return (
      <button onClick={refresh} style={{ display: 'block', width: '100%', background: '#1a1a2e', color: '#7fdbff', border: 'none', padding: '6px 16px', fontSize: 11, fontWeight: 700, textAlign: 'left', cursor: 'pointer', letterSpacing: 0.5 }}>
        [DEV] 스토리 파이프라인 패널 열기 ▼
      </button>
    );
  }

  const rowStyle = { display: 'flex', gap: 8, padding: '3px 0', borderBottom: '1px solid #2a2a4a', flexWrap: 'wrap' };
  const keyStyle = { color: '#7fdbff', fontSize: 10, fontWeight: 700, minWidth: 130, flexShrink: 0 };
  const valStyle = { color: '#e0e0e0', fontSize: 10, wordBreak: 'break-all', flex: 1 };
  const errStyle = { color: '#ff6b6b', fontSize: 10, wordBreak: 'break-all', flex: 1 };

  return (
    <div style={{ background: '#0d0d1a', border: '1px solid #2a2a4a', margin: '0 0 2px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid #2a2a4a' }}>
        <span style={{ color: '#7fdbff', fontSize: 11, fontWeight: 900 }}>[DEV] 스토리 파이프라인</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refresh} style={{ background: '#1a2a3a', color: '#7fdbff', border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}>새로고침</button>
          <button onClick={() => setOpen(false)} style={{ background: 'none', color: '#666', border: 'none', fontSize: 13, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>
      </div>

      <div style={{ padding: '8px 12px' }}>
        <div style={{ color: '#aaa', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>■ 스토리바 현재 상태</div>
        <div style={rowStyle}><span style={keyStyle}>stories.length</span><span style={valStyle}>{stories.length}</span></div>
        <div style={rowStyle}><span style={keyStyle}>storiesError</span><span style={storiesError ? errStyle : valStyle}>{storiesError ? JSON.stringify({ message: storiesError.message, code: storiesError.code }) : 'null'}</span></div>
        {stories.slice(0, 3).map((s, i) => (
          <div key={s.id} style={rowStyle}>
            <span style={keyStyle}>stories[{i}].id</span>
            <span style={valStyle}>{s.id?.slice(0, 16)}… is_story={String(s.is_story)} expires={s.story_expires_at?.slice(0, 19) ?? 'null'} imgs={s.image_urls?.length ?? 0}</span>
          </div>
        ))}
      </div>

      {devData ? (
        <div style={{ padding: '8px 12px', borderTop: '1px solid #2a2a4a' }}>
          <div style={{ color: '#aaa', fontSize: 10, fontWeight: 700, marginBottom: 4 }}>■ 마지막 업로드 ({devData.ts?.slice(0, 19)})</div>
          <div style={rowStyle}><span style={keyStyle}>useSupabase</span><span style={valStyle}>{String(devData.useSupabase)}</span></div>
          {devData.payload && <>
            <div style={rowStyle}><span style={keyStyle}>payload.id</span><span style={valStyle}>{devData.payload.id}</span></div>
            <div style={rowStyle}><span style={keyStyle}>payload.is_story</span><span style={valStyle}>{String(devData.payload.is_story)}</span></div>
            <div style={rowStyle}><span style={keyStyle}>payload.story_expires_at</span><span style={valStyle}>{devData.payload.story_expires_at ?? 'null'}</span></div>
            <div style={rowStyle}><span style={keyStyle}>payload.image_urls_count</span><span style={valStyle}>{devData.payload.image_urls_count}</span></div>
            <div style={rowStyle}><span style={keyStyle}>payload.image_urls_sample</span><span style={valStyle}>{devData.payload.image_urls_sample ?? '(없음)'}</span></div>
          </>}
          {devData.result ? <>
            <div style={{ color: '#aaa', fontSize: 10, fontWeight: 700, margin: '6px 0 4px' }}>insert 결과</div>
            <div style={rowStyle}><span style={keyStyle}>result.id</span><span style={valStyle}>{devData.result.id}</span></div>
            <div style={rowStyle}><span style={keyStyle}>result.is_story</span><span style={valStyle}>{String(devData.result.is_story)}</span></div>
            <div style={rowStyle}><span style={keyStyle}>result.story_expires_at</span><span style={valStyle}>{devData.result.story_expires_at ?? 'null'}</span></div>
            <div style={rowStyle}><span style={keyStyle}>result.image_urls_count</span><span style={valStyle}>{devData.result.image_urls_count}</span></div>
          </> : devData.useSupabase && <div style={rowStyle}><span style={keyStyle}>result</span><span style={errStyle}>null (insert 실패 또는 미수행)</span></div>}
          {devData.error && <>
            <div style={{ color: '#ff6b6b', fontSize: 10, fontWeight: 700, margin: '6px 0 4px' }}>오류</div>
            <div style={rowStyle}><span style={keyStyle}>error.message</span><span style={errStyle}>{devData.error.message}</span></div>
            <div style={rowStyle}><span style={keyStyle}>error.code</span><span style={errStyle}>{devData.error.code ?? 'null'}</span></div>
            {devData.error.details && <div style={rowStyle}><span style={keyStyle}>error.details</span><span style={errStyle}>{devData.error.details}</span></div>}
          </>}
        </div>
      ) : (
        <div style={{ padding: '8px 12px', borderTop: '1px solid #2a2a4a', color: '#666', fontSize: 10 }}>
          아직 업로드 기록 없음 (lounge_dev_story_upload 키 없음)
        </div>
      )}
    </div>
  );
}

// ── 메인 스크린 ────────────────────────────────────────
export default function LoungeScreen({ user, extraPosts = [], extraStories = [], onPostClick, onWrite, onStoryUpload, onRequireLogin, onGoMyPage, onDeleteStory, refreshKey = 0 }) {
  const [category,        setCategory]        = useState('all');
  const [showWriteOptions, setShowWriteOptions] = useState(false);
  const [searchOpen,      setSearchOpen]       = useState(false);
  const [notifOpen,       setNotifOpen]        = useState(false);
  const [notifs,          setNotifs]           = useState([]);
  const [notifsLoading,   setNotifsLoading]    = useState(false);
  const [notifsError,     setNotifsError]      = useState(null);
  const [notifCount,      setNotifCount]       = useState(0);

  const { posts, stories, loading, storiesError, devInfo, refetch } = useLounge(category);

  useEffect(() => {
    if (refreshKey > 0) refetch();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const isGuest    = user?.isGuest === true;
  const isLoggedIn = !isGuest;
  const isPopular  = category === 'popular';

  // 알림 로드
  useEffect(() => {
    if (isGuest || !user?.id || !IS_SUPABASE_READY) return;
    setNotifsLoading(true);
    getNotifications(user.id).then(({ data, error }) => {
      setNotifsLoading(false);
      if (error) { setNotifsError(error); return; }
      const rows = data ?? [];
      setNotifs(rows);
      setNotifCount(rows.filter(n => !n.is_read).length);
    });
  }, [user?.id, isGuest]);

  const handleOpenNotif = () => {
    setNotifOpen(true);
    if (IS_SUPABASE_READY && !isGuest && user?.id && notifCount > 0) {
      markAllNotifsRead(user.id);
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
      setNotifCount(0);
    }
  };

  // extraPosts를 카테고리별로 필터 후 hook 데이터와 병합
  const filteredExtra = (() => {
    if (category === 'all')     return extraPosts;
    if (category === 'popular') return [...extraPosts].sort((a, b) =>
      (b.view_count ?? 0) !== (a.view_count ?? 0)
        ? (b.view_count ?? 0) - (a.view_count ?? 0)
        : (b.like_count ?? 0) - (a.like_count ?? 0)
    );
    return extraPosts.filter(p => p.category === category);
  })();
  const allPosts = [...filteredExtra, ...posts]
    .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
    .filter(p => p.is_deleted !== true && p.is_hidden !== true);

  const handleWriteClick = () => {
    if (isGuest) { onRequireLogin?.(); return; }
    setShowWriteOptions(true);
  };

  const mergedStories = [...extraStories, ...stories].filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i);
  const mergedPosts   = [...extraPosts,   ...posts  ]
    .filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i)
    .filter(p => p.is_deleted !== true && p.is_hidden !== true);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 90 }}>
      {/* 헤더 */}
      <div style={{ background: C.surface, position: 'sticky', top: 0, zIndex: 10, borderBottom: `1px solid ${C.bgWarm}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: `14px ${S.xl}px 0` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <LogoMark size={30} />
            <div>
              <div style={{ fontSize: 11, color: C.text3, marginBottom: 2, letterSpacing: '0.3px' }}>공간사이</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: C.text1, letterSpacing: '-0.5px' }}>라운지</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: S.md }}>
            <button
              onClick={() => setSearchOpen(true)}
              style={{ background: 'none', border: `1px solid ${C.bgWarm}`, borderRadius: R.full, cursor: 'pointer', color: C.text2, padding: '4px 10px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, lineHeight: 1 }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>○</span>─
            </button>
            <button
              onClick={() => isGuest ? onRequireLogin?.() : handleOpenNotif()}
              style={{ background: 'none', border: `1px solid ${C.bgWarm}`, borderRadius: R.full, cursor: 'pointer', fontSize: 13, color: C.text2, padding: '4px 10px', fontWeight: 600, position: 'relative', lineHeight: 1 }}>
              알림
              {isLoggedIn && notifCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
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
        {/* 커뮤니티 서브 배너 */}
        <div style={{ background: `linear-gradient(150deg, ${C.brandL}, ${C.bgWarm})`, padding: `10px ${S.xl}px`, marginTop: 10 }}>
          <span style={{ fontSize: 12, color: C.brand, fontWeight: 600, letterSpacing: '-0.2px' }}>잠깐 쉬어가는 공간 · 편하게 말 걸어보세요</span>
        </div>
        <LoungeCategoryTabs selected={category} onChange={setCategory} />
      </div>

      {SHOW_DEBUG_UI && (
        <>
          <NotifsDevPanel notifs={notifs} notifsLoading={notifsLoading} notifsError={notifsError} userId={user?.id} />
          <StoryDevPanel
            stories={[...extraStories, ...stories].filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i)}
            storiesError={storiesError}
          />
        </>
      )}
      <LoungeStoryBar
        stories={[...extraStories, ...stories].filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i)}
        user={user}
        onStoryClick={() => {}}
        onDeleteStory={onDeleteStory}
      />

      {isPopular && (
        <div style={{ background: C.brandL, borderLeft: `3px solid ${C.brandM}`, padding: `${S.sm}px ${S.xl}px`, display: 'flex', alignItems: 'center', gap: S.sm }}>
          <span style={{ fontSize: 13 }}>🌿</span>
          <span style={{ fontSize: 12, color: C.brand, fontWeight: 600 }}>많이 읽힌 이야기 모음 — 읽기·댓글·관심만 가능해요</span>
        </div>
      )}

      {loading && allPosts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 13, color: C.text3 }}>불러오는 중...</div>
        </div>
      ) : allPosts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text2, marginBottom: 8 }}>아직 게시글이 없어요</div>
          <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.6, marginBottom: S.xl }}>
            이 카테고리에 첫 이야기를 시작해보세요
          </div>
          {isLoggedIn && !isPopular && (
            <button onClick={() => onWrite?.('post')} style={{ padding: '12px 28px', background: C.brand, color: '#fff', border: 'none', borderRadius: R.full, fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: `0 4px 14px ${C.brand}44` }}>
              첫 글 작성하기
            </button>
          )}
        </div>
      ) : (
        <div style={{ background: C.surface }}>
          {allPosts.map(post => (
            <LoungePostCard key={post.id} post={post} onClick={() => onPostClick?.(post)} />
          ))}
        </div>
      )}

      {!isPopular && <button onClick={handleWriteClick} style={{
        position: 'fixed', right: S.xl, bottom: 80, width: 56, height: 56,
        borderRadius: R.full, background: C.brand, color: '#fff',
        border: 'none', fontSize: 24, cursor: 'pointer',
        boxShadow: `0 4px 16px ${C.brand}66`, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>+</button>}

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

      {searchOpen && (
        <SearchOverlay
          onClose={() => setSearchOpen(false)}
          onPostClick={onPostClick}
          allPosts={mergedPosts}
        />
      )}

      {notifOpen && (
        <NotifPanel
          notifs={notifs}
          loading={notifsLoading}
          onClose={() => setNotifOpen(false)}
          onGoSettings={() => { setNotifOpen(false); }}
        />
      )}

      {SHOW_DEBUG_UI && (
        <div style={{ margin: '12px 16px 90px', background: 'rgba(0,0,0,0.92)', color: '#0f0', borderRadius: 8, padding: '10px 12px', fontSize: 11, lineHeight: 2, fontFamily: 'monospace', maxHeight: 460, overflowY: 'auto' }}>
          [DEV] lounge feed — {new Date().toLocaleTimeString('ko-KR')}<br/>
          user: {user?.id?.slice(0, 8) ?? 'null'} | category: {category} | refreshKey: {refreshKey}<br/>
          posts: db={posts.length} extra={extraPosts.length} merged={mergedPosts.length}<br/>
          stories: db={stories.length} extra={extraStories.length} merged={mergedStories.length}<br/>
          <span style={{ color: '#ff0' }}>── 조회 진단 ──</span><br/>
          raw_posts_count: {devInfo?.raw_posts_count ?? '…'} | seeds_count: {devInfo?.seeds_count ?? '…'}<br/>
          visible_posts_count: {devInfo?.visible_posts_count ?? '…'}<br/>
          fetch_err: <span style={{ color: devInfo?.fetch_err ? '#f66' : '#0f0' }}>{devInfo?.fetch_err ?? 'none'}</span><br/>
          {devInfo?.first_id && <>
            first: id={devInfo.first_id} uid={devInfo.first_user_id ?? 'null'}<br/>
            content="{devInfo.first_content}"<br/>
            is_deleted={String(devInfo.first_is_deleted)} is_hidden={String(devInfo.first_is_hidden)}<br/>
          </>}
          <span style={{ color: '#ff0' }}>── DB actual (lounge_posts 최신 5개) ──</span><br/>
          seeds_count: {devInfo?.seeds_count ?? devInfo?.seeds_total ?? '…'}<br/>
          <span style={{ color: '#ff0' }}>── 피드 렌더 (merged) ──</span><br/>
          {mergedPosts.slice(0, 3).map(p => (
            <span key={p.id} style={{ display: 'block' }}>
              post:{p.id.slice(0, 8)} imgs:{(p.image_urls ?? []).length}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
