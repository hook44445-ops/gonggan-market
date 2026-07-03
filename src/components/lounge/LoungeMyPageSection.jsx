// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { C, R, S } from '../../constants';
import { SHOW_DEBUG_UI } from '../../constants/release';
import { SPACE_TEMPERATURE_BASE, TOKEN_EARN, CATEGORY_LABEL, LOUNGE_CATEGORIES, LOUNGE_INACTIVE_CATEGORIES } from '../../constants/lounge';
import { formatRelativeTime } from '../../utils/anonymousNickname';
import {
  IS_SUPABASE_READY,
  getMyLoungePosts,
  softDeleteLoungePost,
  supabase,
  fetchMyChatRequests,
  fetchReceivedChatRequests,
  fetchAcceptedReceivedChatRequests,
  acceptLoungeChatRequest,
  rejectLoungeChatRequest,
  createNotification,
  getPushPreferences,
  upsertPushPreferences,
} from '../../lib/supabase';
import { enablePush, disablePush } from '../../lib/push';

// ── 로컬스토리지 헬퍼 ──────────────────────────────────
const readLS = (key, fallback = []) => {
  try { return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback)); }
  catch { return fallback; }
};

// ── 서브스크린 공통 헤더 ──────────────────────────────
function SubHeader({ title, onBack }) {
  return (
    <div style={{ background: C.surface, padding: `14px ${S.xl}px`, display: 'flex', alignItems: 'center', gap: S.md, borderBottom: `1px solid ${C.bgWarm}`, position: 'sticky', top: 0, zIndex: 10 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.text1, padding: 0 }}>←</button>
      <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>{title}</div>
    </div>
  );
}

// ── 빈 상태 ──────────────────────────────────────────
function EmptyState({ icon, title, desc, cta, onCta }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: 44, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text2, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.6, marginBottom: cta ? S.xl : 0 }}>{desc}</div>
      {cta && (
        <button onClick={onCta} style={{ padding: '12px 28px', background: C.brand, color: '#fff', border: 'none', borderRadius: R.full, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{cta}</button>
      )}
    </div>
  );
}

// ── 삭제 확인 다이얼로그 ──────────────────────────────
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
            style={{ flex: 1, padding: '13px', background: '#E53E3E', border: 'none', borderRadius: R.lg, fontWeight: 800, fontSize: 14, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DEV 패널 ──────────────────────────────────────────
function DevPanel({ info }) {
  const [open, setOpen] = useState(true);
  if (!info) return null;
  return (
    <div style={{ background: '#0d1117', borderBottom: '1px solid #30363d', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7 }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 14px', cursor: 'pointer', color: '#58a6ff' }}>
        <span>🔧 DEV — 마이페이지 내가 쓴 글</span>
        <span>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding: '0 14px 10px', color: '#e6edf3' }}>
          <div>currentUser.id : <span style={{ color: '#79c0ff' }}>{info.currentUserId ?? 'null'}</span></div>
          <div>auth.uid()     : <span style={{ color: info.uidMatch ? '#3fb950' : '#f85149' }}>{info.authUid ?? 'null (미인증)'}</span></div>
          <div>uid 일치       : <span style={{ color: info.uidMatch ? '#3fb950' : '#f85149' }}>{info.uidMatch ? '✅ 일치' : '❌ 불일치 → RLS 차단 원인'}</span></div>
          <div>posts.length   : <span style={{ color: '#79c0ff' }}>{info.postsCount}</span></div>
          <div>IS_SUPABASE    : <span style={{ color: info.isSupabase ? '#3fb950' : '#f85149' }}>{info.isSupabase ? 'true' : 'false (오프라인 모드)'}</span></div>
          {info.fetchError && <div style={{ color: '#f85149' }}>fetchError : {info.fetchError}</div>}
          {!info.uidMatch && info.authUid && (
            <div style={{ color: '#e3b341', marginTop: 4 }}>⚠ lounge_posts.user_id={info.currentUserId?.slice(0,8)}… ≠ auth.uid={info.authUid?.slice(0,8)}…</div>
          )}
          {!info.authUid && (
            <div style={{ color: '#e3b341', marginTop: 4 }}>⚠ Supabase auth 세션 없음 → RLS insert/update/select 막힘</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 내가 쓴 글 ──────────────────────────────────────
function MyPostsScreen({ posts, loading, devInfo, onBack, onEdit, onDelete }) {
  const [confirmId,  setConfirmId]  = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [toast,      setToast]      = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const handleDelete = async (postId) => {
    setDeletingId(postId);
    const result = await onDelete?.(postId);
    setDeletingId(null);
    setConfirmId(null);
    if (result?.error) showToast(`❌ 삭제 실패: ${result.error}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <SubHeader title="내가 쓴 글" onBack={onBack} />

      {SHOW_DEBUG_UI && <DevPanel info={devInfo} />}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: 13, color: C.text3 }}>불러오는 중...</div>
        </div>
      ) : posts.length === 0 ? (
        <EmptyState icon="📝" title="아직 쓴 글이 없어요" desc={'첫 글을 올리면 이곳에 모여요\n라운지에서 이야기를 시작해보세요'} />
      ) : (
        <div style={{ background: C.surface }}>
          {posts.map(post => (
            <div key={post.id} style={{ padding: `${S.lg}px ${S.xl}px`, borderBottom: `1px solid ${C.bgWarm}` }}>
              {/* 헤더 행 */}
              <div style={{ display: 'flex', gap: S.sm, alignItems: 'center', marginBottom: 6 }}>
                <span style={{ background: C.brandL, color: C.brand, borderRadius: R.full, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
                  {CATEGORY_LABEL[post.category] ?? post.category}
                </span>
                <span style={{ fontSize: 11, color: C.text4, marginLeft: 'auto' }}>{formatRelativeTime(post.created_at)}</span>
              </div>

              {/* 본문 + 썸네일 */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {post.title && (
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 4, letterSpacing: '-0.3px' }}>
                      {post.title}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {post.content}
                  </div>
                </div>
                {post.image_urls?.[0] && (
                  <img src={post.image_urls[0]} alt="" style={{ width: 64, height: 64, borderRadius: R.md, objectFit: 'cover', flexShrink: 0 }} />
                )}
              </div>

              {/* 통계 + 액션 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: S.md }}>
                <span style={{ fontSize: 11, color: C.text4 }}>❤️ {post.like_count ?? 0}</span>
                <span style={{ fontSize: 11, color: C.text4 }}>💬 {post.comment_count ?? 0}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => onEdit?.(post)}
                    style={{ padding: '5px 12px', fontSize: 11, fontWeight: 700, color: C.brand, background: C.brandL, border: 'none', borderRadius: R.full, cursor: 'pointer' }}>
                    ✏️ 수정
                  </button>
                  <button
                    onClick={() => setConfirmId(post.id)}
                    style={{ padding: '5px 12px', fontSize: 11, fontWeight: 700, color: '#E53E3E', background: '#FEF0F0', border: 'none', borderRadius: R.full, cursor: 'pointer' }}>
                    🗑️ 삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmId && (
        <DeleteConfirmDialog
          onConfirm={() => handleDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
          loading={!!deletingId}
        />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1F2A24', color: '#fff', borderRadius: R.full, padding: '10px 20px', fontSize: 13, fontWeight: 700, zIndex: 600, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── 저장한 글 ──────────────────────────────────────
function MySavesScreen({ onBack, onPost }) {
  const [saves, setSaves] = useState(() => readLS('lounge_saved_posts'));

  const removeSave = (id, e) => {
    e.stopPropagation();
    const next = saves.filter(s => s.id !== id);
    setSaves(next);
    try {
      const all = readLS('lounge_saved_posts');
      localStorage.setItem('lounge_saved_posts', JSON.stringify(all.filter(s => s.id !== id)));
    } catch {}
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <SubHeader title="저장한 글" onBack={onBack} />
      {saves.length === 0 ? (
        <EmptyState icon="🔖" title="저장한 글이 없어요" desc={'마음에 드는 글의 📄 저장 버튼을\n누르면 여기서 다시 볼 수 있어요'} />
      ) : (
        <div style={{ background: C.surface }}>
          {saves.map(post => (
            <div key={post.id} onClick={() => onPost?.(post)} style={{ padding: `${S.lg}px ${S.xl}px`, borderBottom: `1px solid ${C.bgWarm}`, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: S.sm }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: S.sm, alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ background: C.brandL, color: C.brand, borderRadius: R.full, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
                    {CATEGORY_LABEL[post.category] ?? post.category}
                  </span>
                  <span style={{ fontSize: 11, color: C.text4, marginLeft: 'auto' }}>{formatRelativeTime(post.created_at)}</span>
                </div>
                {post.title && <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 3 }}>{post.title}</div>}
                <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {post.content}
                </div>
              </div>
              <button onClick={(e) => removeSave(post.id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: C.gold, flexShrink: 0, padding: 4 }}>🔖</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 내 댓글 ──────────────────────────────────────────
function MyCommentsScreen({ onBack }) {
  const comments = readLS('lounge_my_comments');

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <SubHeader title="내 댓글" onBack={onBack} />
      {comments.length === 0 ? (
        <EmptyState icon="💬" title="작성한 댓글이 없어요" desc={'라운지 게시글에 댓글을 달면\n여기서 모아볼 수 있어요'} />
      ) : (
        <div style={{ background: C.surface }}>
          {comments.map((c, i) => (
            <div key={i} style={{ padding: `${S.lg}px ${S.xl}px`, borderBottom: `1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize: 11, color: C.text4, marginBottom: 6 }}>
                {c.postTitle && <span style={{ color: C.brand, fontWeight: 600 }}>"{c.postTitle}" </span>}
                {formatRelativeTime(c.createdAt)}
              </div>
              <div style={{ fontSize: 14, color: C.text1, lineHeight: 1.6 }}>{c.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 대화 신청 내역 (DB 기반) ──────────────────────────
function ChatHistoryScreen({ userId, onBack, onOpenChat }) {
  const [sent,     setSent]     = useState([]);
  const [received, setReceived] = useState([]);
  const [acceptedRecv, setAcceptedRecv] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState(null);
  const [busyId,   setBusyId]   = useState(null);
  const [tab,      setTab]      = useState('received'); // 'received' | 'sent'

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!userId || !IS_SUPABASE_READY) { setLoading(false); return; }
    (async () => {
      const [sentRes, recvRes, acceptedRes] = await Promise.all([
        fetchMyChatRequests(userId),
        fetchReceivedChatRequests(userId),
        fetchAcceptedReceivedChatRequests(userId),
      ]);
      setSent(sentRes.data ?? []);
      setReceived(recvRes.data ?? []);
      setAcceptedRecv(acceptedRes.data ?? []);
      setLoading(false);
    })();
  }, [userId]);

  // 라운지 채팅방 진입 — room_id = lounge_{request_id}. partnerId: 내가 수락자면 requester, 내가 신청자면 target.
  const openChat = (req, partnerId) => {
    onOpenChat?.({
      requestId: req.id,
      postId:    req.post_id,
      postTitle: req.lounge_posts?.title ?? null,
      partnerId,
    });
  };

  const handleAccept = async (req) => {
    if (busyId) return;
    setBusyId(req.id);
    const { data, error } = await acceptLoungeChatRequest(req.id, userId);
    setBusyId(null);
    if (error) {
      showToast(`수락 실패: ${error.message}`);
      return;
    }
    const status = data?.status;
    if (status === 'already_accepted') {
      showToast('이미 수락된 대화예요');
      openChat(req, req.requester_id);
    } else if (data?.error === 'INSUFFICIENT_TOKENS') {
      showToast(`토큰이 부족해요 (상대방 잔액: ${data.balance ?? 0}토큰)`);
    } else {
      showToast('✅ 대화가 시작됐어요!');
      setReceived(prev => prev.filter(r => r.id !== req.id));
      setAcceptedRecv(prev => [{ ...req, status: 'accepted' }, ...prev]);
      openChat(req, req.requester_id);
      // B단계: 대화 수락 알림(인앱 + 푸시 enqueue) — 토큰차감/대화방 RPC 그대로, 알림만 추가.
      createNotification({
        userId:      req.requester_id,
        type:        'LOUNGE_CHAT_ACCEPTED',
        title:       '대화 신청 수락',
        message:     '상대가 대화 신청을 수락했어요. 대화를 시작해 보세요!',
        relatedId:   req.post_id ?? req.id ?? null,
        relatedType: 'lounge',
      }).catch(() => {});
    }
  };

  const handleReject = async (req) => {
    if (busyId) return;
    setBusyId(req.id);
    const { data, error } = await rejectLoungeChatRequest(req.id, userId);
    setBusyId(null);
    if (error) {
      showToast(`거절 실패: ${error.message}`);
      return;
    }
    if (data?.error === 'ALREADY_ACCEPTED') {
      showToast('이미 수락된 대화는 거절할 수 없어요');
      return;
    }
    showToast('대화 신청을 거절했어요');
    setReceived(prev => prev.filter(r => r.id !== req.id));
  };

  const statusLabel = (status) => {
    if (status === 'accepted') return { label: '수락됨', color: C.brand };
    if (status === 'rejected') return { label: '거절됨', color: C.text4 };
    if (status === 'expired')  return { label: '만료됨', color: C.text4 };
    return { label: '대기중', color: C.gold };
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <SubHeader title="대화 신청 내역" onBack={onBack} />
      <div style={{ background: C.brandL, padding: `${S.sm}px ${S.xl}px`, borderBottom: `1px solid ${C.brandM}` }}>
        <div style={{ fontSize: 11, color: C.brand }}>💬 수락 시 신청자의 20토큰이 차감됩니다</div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', background: C.surface, borderBottom: `1px solid ${C.bgWarm}` }}>
        {[['received', `받은 신청 ${received.length > 0 ? `(${received.length})` : ''}`], ['sent', '보낸 신청']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: tab === key ? 800 : 500,
              color: tab === key ? C.brand : C.text3,
              borderBottom: `3px solid ${tab === key ? C.brand : 'transparent'}` }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.text4, fontSize: 13 }}>불러오는 중...</div>
      ) : tab === 'received' ? (
        <>
        {/* 수락된 대화 — 채팅방 재진입 */}
        {acceptedRecv.length > 0 && (
          <div style={{ background: C.surface, borderBottom: `8px solid ${C.bg}` }}>
            <div style={{ padding: `${S.md}px ${S.xl}px 0`, fontSize: 12, fontWeight: 800, color: C.text3 }}>💬 대화 중</div>
            {acceptedRecv.map(r => (
              <div key={r.id} style={{ padding: `${S.lg}px ${S.xl}px`, borderBottom: `1px solid ${C.bgWarm}`, display: 'flex', alignItems: 'center', gap: S.md }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.brandL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>💬</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, marginBottom: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {r.lounge_posts?.title ?? r.lounge_posts?.anonymous_nickname ?? '게시글'}
                  </div>
                  <div style={{ fontSize: 11, color: C.text3 }}>{formatRelativeTime(r.accepted_at ?? r.created_at)} 수락</div>
                </div>
                <button onClick={() => openChat(r, r.requester_id)}
                  style={{ padding: '8px 14px', background: C.brandL, color: C.brand, border: `1px solid ${C.brandM}`,
                    borderRadius: R.full, fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
                  채팅방 입장
                </button>
              </div>
            ))}
          </div>
        )}
        {received.length === 0
          ? (acceptedRecv.length === 0 ? <EmptyState icon="📭" title="받은 대화 신청이 없어요" desc="다른 사람이 내 댓글을 보고 신청하면 여기에 표시돼요" /> : null)
          : (
            <div style={{ background: C.surface }}>
              {received.map(r => (
                <div key={r.id} style={{ padding: `${S.lg}px ${S.xl}px`, borderBottom: `1px solid ${C.bgWarm}`, display: 'flex', alignItems: 'center', gap: S.md }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.brandL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>💬</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, marginBottom: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {r.lounge_posts?.title ?? r.lounge_posts?.anonymous_nickname ?? '게시글'}
                    </div>
                    <div style={{ fontSize: 11, color: C.text3 }}>
                      {r.lounge_comments?.anonymous_nickname ?? '익명'} · {formatRelativeTime(r.created_at)}
                    </div>
                    {r.lounge_comments?.content && (
                      <div style={{ fontSize: 11, color: C.text4, marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        "{r.lounge_comments.content}"
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => handleReject(r)}
                      disabled={busyId === r.id}
                      style={{ padding: '8px 12px', background: 'none', color: C.text3, border: `1px solid ${C.bgWarm}`,
                        borderRadius: R.full, fontWeight: 700, fontSize: 13, cursor: busyId === r.id ? 'not-allowed' : 'pointer',
                        opacity: busyId === r.id ? 0.6 : 1 }}
                    >
                      거절
                    </button>
                    <button
                      onClick={() => handleAccept(r)}
                      disabled={busyId === r.id}
                      style={{ padding: '8px 14px', background: C.brand, color: '#fff', border: 'none',
                        borderRadius: R.full, fontWeight: 700, fontSize: 13, cursor: busyId === r.id ? 'not-allowed' : 'pointer',
                        opacity: busyId === r.id ? 0.6 : 1 }}
                    >
                      {busyId === r.id ? '...' : '수락'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        sent.length === 0
          ? <EmptyState icon="💬" title="보낸 대화 신청이 없어요" desc={'라운지 댓글 작성자를 클릭하면\n대화를 신청할 수 있어요'} />
          : (
            <div style={{ background: C.surface }}>
              {sent.map(r => {
                const st = statusLabel(r.status);
                return (
                  <div key={r.id} style={{ padding: `${S.lg}px ${S.xl}px`, borderBottom: `1px solid ${C.bgWarm}`, display: 'flex', alignItems: 'center', gap: S.md }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.brandL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>💬</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, marginBottom: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {r.lounge_posts?.title ?? r.lounge_posts?.anonymous_nickname ?? '게시글'}
                      </div>
                      <div style={{ fontSize: 11, color: C.text3 }}>{formatRelativeTime(r.created_at)}</div>
                    </div>
                    {r.status === 'accepted' ? (
                      <button onClick={() => openChat(r, r.target_id)}
                        style={{ padding: '8px 14px', background: C.brandL, color: C.brand, border: `1px solid ${C.brandM}`,
                          borderRadius: R.full, fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
                        채팅방 입장
                      </button>
                    ) : (
                      <div style={{ fontSize: 11, fontWeight: 700, color: st.color, background: `${st.color}18`, padding: '4px 10px', borderRadius: R.full, flexShrink: 0 }}>{st.label}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.8)', color: '#fff', borderRadius: R.lg,
          padding: '10px 18px', fontSize: 13, zIndex: 100, whiteSpace: 'pre-line', textAlign: 'center' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ── 커뮤니티 미션 ────────────────────────────────────
const MISSIONS = [
  { key: 'first_post',           label: '첫 글 작성',            desc: '라운지에 첫 게시글을 올려보세요',         reward: TOKEN_EARN.FIRST_POST,            icon: '📝' },
  { key: 'first_comment',        label: '첫 댓글 작성',           desc: '다른 사람 글에 첫 댓글을 남겨보세요',      reward: TOKEN_EARN.FIRST_COMMENT,          icon: '💬' },
  { key: 'first_story',          label: '첫 스토리 올리기',        desc: '24시간 스토리를 처음 공유해보세요',        reward: TOKEN_EARN.FIRST_STORY,            icon: '📸' },
  { key: 'profile_complete',     label: '프로필 완성',            desc: '이름·지역 정보를 완성해보세요',            reward: TOKEN_EARN.PROFILE_COMPLETE,       icon: '✅' },
  { key: 'likes_received_20',    label: '좋아요/하트 20개 받기',   desc: '내 글에 좋아요를 20개 받아보세요',         reward: TOKEN_EARN.LIKES_RECEIVED_20,      icon: '❤️' },
  { key: 'comments_written_10',  label: '댓글 10개 작성',          desc: '라운지에서 댓글을 10개 작성해보세요',      reward: TOKEN_EARN.COMMENTS_WRITTEN_10,    icon: '🗨️' },
  { key: 'posts_written_3',      label: '게시글 3개 작성',         desc: '라운지에 게시글을 3개 이상 올려보세요',    reward: TOKEN_EARN.POSTS_WRITTEN_3,        icon: '📋' },
  { key: 'construction_review',  label: '인테리어 후기 작성',      desc: '완료된 공사 인테리어 후기를 남겨보세요',   reward: TOKEN_EARN.CONSTRUCTION_REVIEW,    icon: '🏗️' },
  { key: 'first_quote_request',  label: '첫 견적 요청',            desc: '인테리어 견적을 처음 요청해보세요',        reward: TOKEN_EARN.FIRST_QUOTE_REQUEST,    icon: '📩' },
];

function MissionsScreen({ tokenLogs, onBack }) {
  const completed = new Set((tokenLogs ?? []).filter(l => l.type === 'earn').map(l => l.action));

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <SubHeader title="커뮤니티 미션" onBack={onBack} />
      <div style={{ padding: S.xl }}>
        <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.md, marginBottom: S.xl, border: `1px solid ${C.brandM}` }}>
          <div style={{ fontSize: 12, color: C.brand, lineHeight: 1.6 }}>
            🎯 미션을 완료하면 공간토큰을 받을 수 있어요.<br/>
            토큰으로 대화를 신청하거나 부스트를 이용해보세요.
          </div>
        </div>
        {MISSIONS.map(m => {
          const done = completed.has(m.key);
          return (
            <div key={m.key} style={{ background: C.surface, borderRadius: R.lg, padding: S.xl, marginBottom: S.sm, border: `1px solid ${done ? C.brandM : C.bgWarm}`, display: 'flex', alignItems: 'center', gap: S.md, opacity: done ? 0.7 : 1 }}>
              <div style={{ width: 48, height: 48, borderRadius: R.lg, background: done ? C.brandL : C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                {done ? '✅' : m.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: 2 }}>{m.label}</div>
                <div style={{ fontSize: 12, color: C.text3 }}>{m.desc}</div>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: done ? C.text4 : C.brand }}>+{m.reward}</div>
                <div style={{ fontSize: 10, color: C.text4 }}>토큰</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── 익명 보호 설정 ────────────────────────────────────
function PrivacyScreen({ onBack }) {
  const [hideGender,   setHideGender]   = useState(() => readLS('anon_hide_gender',   false));
  const [hideAge,      setHideAge]      = useState(() => readLS('anon_hide_age',      false));
  const [hideRegion,   setHideRegion]   = useState(() => readLS('anon_hide_region',   false));

  const Toggle = ({ label, desc, value, onChange }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${S.lg}px 0`, borderBottom: `1px solid ${C.bg}` }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text1 }}>{label}</div>
        <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>{desc}</div>
      </div>
      <div onClick={() => { onChange(!value); try { localStorage.setItem(`anon_hide_${label}`, JSON.stringify(!value)); } catch {} }}
        style={{ width: 48, height: 26, borderRadius: 13, background: value ? C.brand : C.bgWarm, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 3, left: value ? 25 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <SubHeader title="익명 보호 설정" onBack={onBack} />
      <div style={{ padding: S.xl }}>
        <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.md, marginBottom: S.xl, border: `1px solid ${C.brandM}` }}>
          <div style={{ fontSize: 12, color: C.brand, lineHeight: 1.7 }}>
            🛡 라운지에서는 항상 익명 닉네임으로 표시됩니다.<br/>
            닉네임은 글마다 새로 배정되며, 실명·연락처는 절대 공개되지 않습니다.<br/>
            아래 설정으로 추가 정보 노출을 제어할 수 있어요.
          </div>
        </div>

        <div style={{ background: C.surface, borderRadius: R.lg, padding: `0 ${S.xl}px`, border: `1px solid ${C.bgWarm}`, marginBottom: S.lg }}>
          <Toggle label="gender" desc="성별 정보 숨기기 (남/여 표시 안함)" value={hideGender} onChange={setHideGender} />
          <Toggle label="age" desc="나이대 숨기기 (20대/30대 표시 안함)" value={hideAge} onChange={setHideAge} />
          <Toggle label="region" desc="지역 정보 숨기기 (지역 표시 안함)" value={hideRegion} onChange={setHideRegion} />
        </div>

        <div style={{ background: C.bg, borderRadius: R.lg, padding: S.xl, border: `1px solid ${C.bgWarm}` }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.text2, marginBottom: S.sm }}>익명성 보호 기준</div>
          {['글쓴이 실명 공개 없음', '댓글 작성자 실명 공개 없음', '전화번호/이메일 절대 노출 금지', '신고 처리 시에도 익명 유지', '대화방 개설 후 닉네임으로 소통'].map(t => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: C.brand }}>✓</span>
              <span style={{ fontSize: 13, color: C.text2 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 차단 관리 ────────────────────────────────────────
function BlocksScreen({ onBack }) {
  const [blocks, setBlocks] = useState(() => readLS('lounge_blocks'));

  const unblock = (id) => {
    const next = blocks.filter(b => b !== id);
    setBlocks(next);
    try { localStorage.setItem('lounge_blocks', JSON.stringify(next)); } catch {}
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <SubHeader title="차단 관리" onBack={onBack} />
      {blocks.length === 0 ? (
        <EmptyState icon="🚫" title="차단한 사용자가 없어요" desc={'불쾌한 게시글·댓글 아래\n신고 버튼 → 차단하기로 차단할 수 있어요'} />
      ) : (
        <div>
          <div style={{ padding: `${S.sm}px ${S.xl}px`, fontSize: 12, color: C.text3, background: C.surface, borderBottom: `1px solid ${C.bgWarm}` }}>
            차단한 사용자의 게시글·댓글·스토리는 숨겨집니다
          </div>
          {blocks.map((id, i) => (
            <div key={i} style={{ background: C.surface, padding: `${S.lg}px ${S.xl}px`, borderBottom: `1px solid ${C.bgWarm}`, display: 'flex', alignItems: 'center', gap: S.md }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🚫</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text2 }}>차단된 사용자</div>
                <div style={{ fontSize: 11, color: C.text4, marginTop: 2 }}>ID: {id}</div>
              </div>
              <button onClick={() => unblock(id)} style={{ padding: '7px 14px', borderRadius: R.full, border: `1px solid ${C.bgWarm}`, background: C.surface, color: C.text2, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                차단해제
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 알림 설정 ─────────────────────────────────────────
function NotifSettings({ user }) {
  const load = (key, def) => { try { return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(def)); } catch { return def; } };

  const [enabled,    setEnabled]  = useState(() => load('lounge_notif_enabled', false));
  const [selected,   setSelected] = useState(() => load('lounge_notif_cats', []));
  const [permStatus, setPermStatus] = useState(() => typeof Notification !== 'undefined' ? Notification.permission : 'default');
  const [toast,      setToast]    = useState(null);
  const [busy,       setBusy]     = useState(false);

  // 글쓰기 카테고리 — SSOT(LOUNGE_CATEGORIES)에서 all/popular 제외 + 비활성 카테고리 제외
  const CATS = LOUNGE_CATEGORIES
    .filter(c => c.id !== 'all' && c.id !== 'popular' && !LOUNGE_INACTIVE_CATEGORIES.includes(c.id))
    .map(c => ({ id: c.id, label: c.label.replace(/^[^가-힣a-zA-Z]+\s*/, '') }));

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // 라운지 관심 카테고리 → push_preferences 매핑(서버 RPC enqueue_lounge_post_push 와 동일 규칙, 전 카테고리 연결).
  //   local→push_local_news / interior·room_deco·move_in→push_interior_news / review·quote_worry→push_estimate_news
  //   그 외 모든 카테고리(결혼·연애·주식·취업·여행·맛집·생활·유머·자유 등) → push_lounge_activity
  //   (부분 upsert라 chat/escrow 등 다른 토글은 보존)
  const SPACE_CATS = ['interior', 'room_deco', 'move_in', 'review', 'quote_worry', 'local'];
  const mapPushPrefs = (on, cats) => {
    // 관심 카테고리 미선택 시 라운지 전 카테고리 수신(켜도 아무것도 안 오는 상황 방지).
    const noneSelected = !cats || cats.length === 0;
    const has = (id) => noneSelected || cats.includes(id);
    const hasOther = noneSelected || cats.some(id => !SPACE_CATS.includes(id));
    return {
      push_enabled:         on,
      push_interior_news:   on && (has('interior') || has('room_deco') || has('move_in')),
      push_estimate_news:   on && (has('review') || has('quote_worry')),
      push_local_news:      on && has('local'),
      push_lounge_activity: on && hasOther,
    };
  };

  // DB에 수신 선호 저장(다른 기기에서도 유지). 권한/브라우저와 무관하게 '선호'는 항상 저장한다.
  const persistPrefs = async (on, cats) => {
    if (!IS_SUPABASE_READY || !user?.id) return { updatePayload: null, updateResult: null, error: 'no-user-or-supabase' };
    const updatePayload = mapPushPrefs(on, cats);
    const { data, error } = await upsertPushPreferences(user.id, updatePayload);
    return { updatePayload, updateResult: data ?? null, error: error ?? null };
  };

  // 초기값 — DB 우선(다른 기기에서도 유지), 없으면 localStorage 유지.
  useEffect(() => {
    if (!IS_SUPABASE_READY || !user?.id) return;
    let alive = true;
    getPushPreferences(user.id).then(({ data }) => {
      if (!alive || !data) return;
      setEnabled(!!data.push_enabled);
      localStorage.setItem('lounge_notif_enabled', JSON.stringify(!!data.push_enabled));
    }).catch(() => {});
    return () => { alive = false; };
  }, [user?.id]);

  const toggleCat = async (id) => {
    const next = selected.includes(id) ? selected.filter(c => c !== id) : [...selected, id];
    setSelected(next);
    localStorage.setItem('lounge_notif_cats', JSON.stringify(next));
    // 알림이 켜져 있으면 카테고리 변경도 DB에 반영
    if (enabled) { await persistPrefs(true, next); }
  };

  // 인앱 브라우저(카카오/인스타/네이버 등) 감지 — 알림 API 차단 환경
  const isInApp = (() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /KAKAOTALK|Instagram|FBAN|FBAV|NAVER\(inapp|Line\/|DaumApps|everytimeApp/i.test(ua);
  })();
  const notifUnsupported = typeof window !== 'undefined' && !('Notification' in window);

  const handleToggle = async () => {
    if (busy) return;
    const next = !enabled;
    setBusy(true);

    // 1) 권한/브라우저와 무관하게 '선호'는 즉시 반영 + 저장(토글이 안 켜지던 핵심 버그 수정).
    setEnabled(next);
    localStorage.setItem('lounge_notif_enabled', JSON.stringify(next));

    // 2) DB 저장(다른 기기에서도 유지)
    await persistPrefs(next, selected);

    // 3) 켤 때만 — 기기 FCM 토큰 등록 시도(가능한 브라우저에서만). 실패해도 선호는 유지된다.
    let pushResult = null;
    if (next) {
      pushResult = await enablePush(user?.id);
      if (pushResult?.ok) setPermStatus('granted');
    } else {
      await disablePush();
    }

    setBusy(false);

    // 4) 안내
    if (!next) { showToast('알림을 껐어요'); return; }
    if (pushResult?.ok) { showToast('✅ 알림을 켰어요!'); return; }
    if (notifUnsupported || isInApp) { showToast('알림 설정을 저장했어요. 기기 푸시는 우측 상단 ⋯ → 다른 브라우저로 열면 받을 수 있어요'); return; }
    if (pushResult?.reason === 'permission_denied') { showToast('알림 설정은 저장됐어요. 기기 푸시는 주소창 자물쇠🔒 → 알림 허용으로 받을 수 있어요'); return; }
    showToast('✅ 알림 설정을 저장했어요!');
  };

  // 권한이 막힌 상태 안내 문구(인라인 배너용)
  const blockedHelp = notifUnsupported && isInApp
    ? '카카오톡·인스타 등 앱 안에서는 기기 푸시를 받을 수 없어요. 우측 상단 ⋯ 메뉴 → "다른 브라우저로 열기"로 접속하면 받을 수 있어요. (알림 설정 자체는 저장돼요)'
    : permStatus === 'denied'
    ? '브라우저에서 기기 푸시가 차단돼 있어요. 주소창의 자물쇠🔒 아이콘 → 알림 → "허용"으로 바꾸면 받을 수 있어요. (알림 설정 자체는 저장돼요)'
    : null;

  return (
    <div style={{ background: C.bg, borderRadius: R.lg, padding: S.xl, marginBottom: S.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.lg }}>
        <div style={{ flex: 1, minWidth: 0, marginRight: S.md }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>📱 새 글 알림</div>
          <div style={{ fontSize: 12, color: C.text3, marginTop: 3, lineHeight: 1.5 }}>
            {blockedHelp ? '알림이 차단돼 있어요' : enabled ? '선택한 카테고리 새 글 알림 중' : '알림을 켜보세요'}
          </div>
        </div>
        <div onClick={handleToggle} style={{ width: 48, height: 26, borderRadius: 13, background: enabled ? C.brand : C.bgWarm, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: 3, left: enabled ? 25 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
        </div>
      </div>
      {blockedHelp && (
        <div style={{ background: C.ivory ?? '#F5F0E8', border: `1px solid ${C.bgWarm}`, borderRadius: 12, padding: '12px 14px', marginBottom: S.md, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0 }}>💡</span>
          <span style={{ fontSize: 14, color: C.text2, lineHeight: 1.8 }}>{blockedHelp}</span>
        </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: S.sm }}>관심 카테고리 선택</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {CATS.map(cat => {
          const active = selected.includes(cat.id);
          return (
            <button key={cat.id} onClick={() => toggleCat(cat.id)} style={{ padding: '6px 12px', borderRadius: R.full, border: active ? 'none' : `1px solid ${C.bgWarm}`, background: active ? C.brand : C.surface, color: active ? '#fff' : C.text3, fontWeight: active ? 700 : 500, fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}>
              {active ? '✓ ' : ''}{cat.label}
            </button>
          );
        })}
      </div>
      {toast && (
        <div style={{ marginTop: S.sm, background: C.brand, color: '#fff', borderRadius: R.lg, padding: '10px 14px', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>{toast}</div>
      )}
    </div>
  );
}

// ── Row 컴포넌트 ──────────────────────────────────────
function Row({ label, icon, count, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', height: 48, borderBottom: `1px solid ${C.bg}`, cursor: onClick ? 'pointer' : 'default' }}>
      <span style={{ width: 22, fontSize: 15, flexShrink: 0, textAlign: 'center', lineHeight: 1 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.text2, marginLeft: S.sm, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {count !== undefined && <span style={{ fontSize: 12, color: C.text4, marginRight: S.sm, flexShrink: 0 }}>{count}</span>}
      {onClick && <span style={{ fontSize: 16, color: C.text3, flexShrink: 0 }}>›</span>}
    </div>
  );
}

// ── 메인 섹션 ──────────────────────────────────────────
export default function LoungeMyPageSection({
  user, temperature, balance, tokenLogs, myPosts,
  onNavigate, onEditPost, onDeletePost, onOpenLoungeChat, refreshKey = 0,
}) {
  const temp   = temperature ?? SPACE_TEMPERATURE_BASE;
  const isComp = user?.role === 'company';
  const [subScreen, setSubScreen] = useState(null);

  // ── 내가 쓴 글: Supabase fetch 또는 prop fallback ──
  const [supabasePosts, setSupabasePosts] = useState([]);
  const [postsLoading,  setPostsLoading]  = useState(false);
  const [devInfo,       setDevInfo]       = useState(null);

  // Supabase 모드: user.id / refreshKey 변경 시 refetch
  useEffect(() => {
    if (!IS_SUPABASE_READY || !user?.id) return;
    let cancelled = false;
    setPostsLoading(true);

    const fetch = async () => {
      const { data, error } = await getMyLoungePosts(user.id);
      if (cancelled) return;
      setSupabasePosts(data ?? []);
      setPostsLoading(false);

      if (import.meta.env.DEV) {
        try {
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (!cancelled) setDevInfo({
            currentUserId: user.id,
            authUid:       authUser?.id ?? null,
            uidMatch:      user.id === authUser?.id,
            postsCount:    data?.length ?? 0,
            fetchError:    error?.message ?? null,
            isSupabase:    true,
          });
        } catch {}
      }
    };

    fetch();
    return () => { cancelled = true; };
  }, [user?.id, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // DEV 정보 (오프라인 모드)
  useEffect(() => {
    if (!import.meta.env.DEV || IS_SUPABASE_READY) return;
    setDevInfo({
      currentUserId: user?.id ?? null,
      authUid:       null,
      uidMatch:      false,
      postsCount:    (myPosts ?? []).length,
      fetchError:    null,
      isSupabase:    false,
    });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayPosts   = IS_SUPABASE_READY ? supabasePosts : (myPosts ?? []);
  const displayLoading = IS_SUPABASE_READY ? postsLoading : false;

  // ── 삭제 핸들러 ──────────────────────────────────────
  const handleDeletePost = async (postId) => {
    if (IS_SUPABASE_READY && user?.id) {
      const { error } = await softDeleteLoungePost(postId, user.id);
      if (error) return { error: error.message };
      setSupabasePosts(prev => prev.filter(p => p.id !== postId));
    } else {
      try {
        const key  = 'lounge_offline_posts';
        const prev = JSON.parse(localStorage.getItem(key) ?? '[]');
        localStorage.setItem(key, JSON.stringify(prev.filter(p => p.id !== postId)));
      } catch {}
    }
    onDeletePost?.(postId);
    return {};
  };

  const level = temp >= 45 ? { label: '홈마스터', icon: '👑' }
    : temp >= 40 ? { label: '드림하우스', icon: '🏰' }
    : temp >= 36 ? { label: '다정한 이웃', icon: '🏡' }
    : { label: '새 이웃', icon: '🏠' };

  const savedCount   = readLS('lounge_saved_posts').length;
  const commentCount = readLS('lounge_my_comments').length;
  const chatCount    = 0; // DB 기반으로 ChatHistoryScreen 내부에서 로드
  const blocksCount  = readLS('lounge_blocks').length;

  // 서브스크린 처리
  if (subScreen === 'my-posts') return (
    <MyPostsScreen
      posts={displayPosts}
      loading={displayLoading}
      devInfo={devInfo}
      onBack={() => setSubScreen(null)}
      onEdit={(post) => { setSubScreen(null); onEditPost?.(post); }}
      onDelete={handleDeletePost}
    />
  );
  if (subScreen === 'my-saves')     return <MySavesScreen    onBack={() => setSubScreen(null)} onPost={null} />;
  if (subScreen === 'my-comments')  return <MyCommentsScreen onBack={() => setSubScreen(null)} />;
  if (subScreen === 'chat-history') return <ChatHistoryScreen userId={user?.id} onBack={() => setSubScreen(null)} onOpenChat={onOpenLoungeChat} />;
  if (subScreen === 'missions')     return <MissionsScreen   tokenLogs={tokenLogs} onBack={() => setSubScreen(null)} />;
  if (subScreen === 'privacy')      return <PrivacyScreen    onBack={() => setSubScreen(null)} />;
  if (subScreen === 'blocks')       return <BlocksScreen     onBack={() => setSubScreen(null)} />;

  return (
    <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.lg }}>라운지</div>

      {/* 공간온도 */}
      <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.brandM}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.md }}>
          <div>
            <div style={{ fontSize: 11, color: C.text3, marginBottom: 4, letterSpacing: '0.2px' }}>공간온도</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.brand, letterSpacing: '-0.5px' }}>{temp.toFixed(1)}°</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.brand }}>{level.label}</div>
          </div>
        </div>
        <div style={{ background: `${C.brand}20`, borderRadius: R.full, height: 4 }}>
          <div style={{
            width: `${Math.min(100, Math.max(0, (temp - 36.5) / (99 - 36.5) * 100))}%`,
            height: '100%', background: C.brand, borderRadius: R.full,
          }} />
        </div>
      </div>

      {/* 토큰 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.bg, borderRadius: R.lg, padding: `${S.md}px ${S.lg}px`, marginBottom: S.lg }}>
        <div>
          <div style={{ fontSize: 11, color: C.text3, marginBottom: 2 }}>보유 공간토큰</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: C.text1 }}>{(balance ?? 0).toLocaleString()} 토큰</div>
        </div>
        <button onClick={() => onNavigate?.('token-store')} style={{ background: C.brand, color: '#fff', border: 'none', borderRadius: R.full, padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
          스토어
        </button>
      </div>

      {/* 알림 설정 */}
      <div style={{ borderTop: `1px solid ${C.bg}`, paddingTop: S.md, marginBottom: S.sm }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: S.sm }}>알림 설정</div>
        <NotifSettings user={user} />
      </div>

      {/* 내 활동 */}
      <div style={{ borderTop: `1px solid ${C.bg}`, paddingTop: S.md }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: S.sm }}>내 활동</div>
        <Row label="내가 쓴 글"   icon="📝" count={displayPosts.length ? `${displayPosts.length}개` : undefined} onClick={() => setSubScreen('my-posts')} />
        <Row label="저장한 글"    icon="🔖" count={savedCount   ? `${savedCount}개`   : undefined} onClick={() => setSubScreen('my-saves')} />
        <Row label="내 댓글"      icon="💬" count={commentCount ? `${commentCount}개` : undefined} onClick={() => setSubScreen('my-comments')} />

        <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, margin: `${S.md}px 0 ${S.sm}px` }}>공간토큰</div>
        <Row label="보유 내역"      icon="📊" onClick={() => onNavigate?.('token-history')} />
        <Row label="대화 신청 내역" icon="💬" count={chatCount ? `${chatCount}건` : undefined} onClick={() => setSubScreen('chat-history')} />

        <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, margin: `${S.md}px 0 ${S.sm}px` }}>설정</div>
        <Row label="커뮤니티 미션"  icon="🎯" onClick={() => setSubScreen('missions')} />
        <Row label="익명 보호 설정" icon="🛡" onClick={() => setSubScreen('privacy')} />
        <Row label="차단 관리"      icon="🚫" count={blocksCount ? `${blocksCount}명` : undefined} onClick={() => setSubScreen('blocks')} />

        {isComp && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, margin: `${S.md}px 0 ${S.sm}px` }}>업체 전용</div>
            <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.lg, border: `1px solid ${C.brandM}` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.brand }}>🏆 초기 파트너 혜택 중</div>
              <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>전문가 답변 배지 무료 사용</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
