// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import { C, R, S } from '../constants';
import { SHOW_DEBUG_UI } from '../constants/release';
import { CATEGORY_LABEL } from '../constants/lounge';
import { useLoungePost } from '../hooks/useLounge';
import { getAnonymousNickname, formatRelativeTime, getAnonymousAvatarByNickname } from '../utils/anonymousNickname';
import {
  createLoungeComment,
  likeLoungePost,
  addLoungePostLike,
  checkLoungePostLiked,
  addLoungeSave,
  removeLoungeSave,
  checkLoungeSaved,
  createLoungeChat,
} from '../lib/supabase';
import LoungeCommentItem from '../components/lounge/LoungeCommentItem';
import ChatRequestModal from '../components/lounge/ChatRequestModal';
import ReportModal from '../components/lounge/ReportModal';
import { IS_SUPABASE_READY, softDeleteLoungePost, createLoungeNotification } from '../lib/supabase';
import { buildPostMeta } from '../utils/loungeSeo';

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

// 카테고리별 거래 연결 CTA — 라운지를 거래로 잇는 핵심
const LOUNGE_CTA = {
  review:      { label: "이 업체에게 견적 받기 →", target: "company_or_quote" },
  quote_worry: { label: "지금 바로 견적 요청하기 →", target: "quote" },
  recommend:   { label: "추천 업체 프로필 보기 →",   target: "company_or_map" },
  move_in:     { label: "내 지역 업체 찾기 →",       target: "map" },
  interior:    { label: "무료 견적 받기 →",          target: "quote" },
  room_deco:   { label: "무료 견적 받기 →",          target: "quote" },
};

export default function LoungePostDetailScreen({ postId, initialPost, user, tokenBalance, onBack, onSpendToken, onTokenStore, onRequireLogin, onEditPost, onDeletePost, onNavigate }) {
  const { post: foundPost, comments, loading, commentsFetchError, addComment, likeComment, refetchComments } = useLoungePost(postId, initialPost);
  const post = foundPost ?? initialPost ?? null;
  const isSeedPost = post?.is_seed === true;
  const [commentText, setCommentText]       = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [devCommentInfo, setDevCommentInfo] = useState(null);
  const [replyTo,     setReplyTo]           = useState(null);
  const [liked,       setLiked]             = useState(false);
  const [saved,       setSaved]             = useState(() => {
    try {
      const saves = JSON.parse(localStorage.getItem('lounge_saved_posts') ?? '[]');
      return saves.some(s => s.id === postId);
    } catch { return false; }
  });
  const [showChat,    setShowChat]          = useState(false);
  const [chatSending, setChatSending]       = useState(false);
  const [chatSent,    setChatSent]          = useState(false);
  const [toast,       setToast]             = useState(null);
  // 운영글(seed) 가벼운 공감 — DB 미기록(읽기 전용 매거진 콘텐츠), 로컬 피드백만
  const [seedLiked,   setSeedLiked]         = useState(false);
  const [helpful,     setHelpful]           = useState(false);
  const [reportTarget, setReportTarget]     = useState(null);
  const [showMenu,    setShowMenu]          = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting,    setDeleting]          = useState(false);
  const [deleteDevInfo, setDeleteDevInfo] = useState(null);
  const [imgViewer, setImgViewer]         = useState(null); // { urls, index }
  const inputRef = useRef(null);

  const isGuest    = user?.isGuest === true;
  const isLoggedIn = !isGuest;
  const isOwn      = isLoggedIn && post?.user_id && user?.id && post.user_id === user.id;

  // Load initial like/save state from DB (skip for seed posts — not in lounge_posts)
  useEffect(() => {
    if (!user?.id || !postId || isGuest || isSeedPost) return;
    Promise.all([
      checkLoungePostLiked(postId, user.id),
      checkLoungeSaved(postId, user.id),
    ]).then(([likeRes, saveRes]) => {
      if (likeRes.data) setLiked(true);
      if (saveRes.data) setSaved(true);
    }).catch(() => {});
  }, [postId, user?.id, isGuest, isSeedPost]);

  // ── SEO: 글 상세 진입 시 메타태그 동적 갱신 (언마운트 시 복원) ──
  useEffect(() => {
    if (!post || isSeedPost) return undefined;
    const meta = buildPostMeta(post);
    const prevTitle = document.title;
    document.title = meta.title;

    const upsert = (selector, create) => {
      let el = document.head.querySelector(selector);
      const created = !el;
      if (!el) { el = create(); document.head.appendChild(el); }
      const prev = created ? null : el.getAttribute('content');
      return { el, created, prev };
    };
    const ogImage = meta.imagePath?.startsWith('http')
      ? meta.imagePath
      : `${window.location.origin}${meta.imagePath}`;
    const targets = [
      { ...upsert('meta[name="description"]', () => { const m = document.createElement('meta'); m.setAttribute('name', 'description'); return m; }), val: meta.description },
      { ...upsert('meta[property="og:title"]', () => { const m = document.createElement('meta'); m.setAttribute('property', 'og:title'); return m; }), val: meta.title },
      { ...upsert('meta[property="og:description"]', () => { const m = document.createElement('meta'); m.setAttribute('property', 'og:description'); return m; }), val: meta.description },
      { ...upsert('meta[property="og:image"]', () => { const m = document.createElement('meta'); m.setAttribute('property', 'og:image'); return m; }), val: ogImage },
    ];
    targets.forEach(t => t.el.setAttribute('content', t.val));

    return () => {
      document.title = prevTitle;
      targets.forEach(t => {
        if (t.created) t.el.remove();
        else if (t.prev != null) t.el.setAttribute('content', t.prev);
      });
    };
  }, [post?.id, post?.title, post?.content, isSeedPost]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const handleLike = async () => {
    if (isGuest) { onRequireLogin?.(); return; }
    if (liked || isSeedPost) return;
    setLiked(true);
    showToast('❤️ 좋아요를 눌렀어요');
    await Promise.all([
      addLoungePostLike(postId, user.id),
      likeLoungePost(postId),
    ]);
    if (IS_SUPABASE_READY && post?.user_id && user?.id && post.user_id !== user.id) {
      createLoungeNotification({
        userId:      post.user_id,
        type:        'post_like',
        title:       '좋아요',
        message:     '내 글에 좋아요가 달렸어요',
        relatedId:   post.id,
        relatedType: 'lounge_post',
      });
    }
  };

  const handleSave = async () => {
    if (isGuest) { onRequireLogin?.(); return; }
    if (isSeedPost) return;
    const next = !saved;
    setSaved(next);
    if (next) {
      await addLoungeSave(postId, user.id);
    } else {
      await removeLoungeSave(postId, user.id);
    }
  };

  // 공유 — Web Share 우선, 미지원 시 링크 복사 (DB 불필요, 모든 글 공통)
  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: post?.title || '공간마켓 라운지', text: post?.title || '공간마켓 라운지', url });
        return;
      }
    } catch { return; } // 사용자가 공유 취소
    try {
      await navigator.clipboard.writeText(url);
      showToast('🔗 링크를 복사했어요');
    } catch {
      showToast('이 환경에서는 공유를 지원하지 않아요');
    }
  };

  // 운영글 가벼운 공감 — 로컬 피드백만(읽기 전용 콘텐츠)
  const handleSeedLike = () => {
    if (seedLiked) return;
    setSeedLiked(true);
    showToast('❤️ 공감해주셔서 고마워요');
  };
  const handleHelpful = () => {
    if (helpful) return;
    setHelpful(true);
    showToast('피드백 감사합니다 🙏');
  };

  const handleComment = async () => {
    if (isGuest) { onRequireLogin?.(); return; }
    if (commentSubmitting || isSeedPost) return;

    const content = commentText.trim();

    // payload 검증
    if (!post?.id) { showToast('게시글 정보를 불러오는 중이에요'); return; }
    if (!user?.id) { showToast('로그인이 필요해요'); return; }
    if (!content)  { showToast('댓글 내용을 입력해주세요'); return; }

    setCommentSubmitting(true);

    const nickname = getAnonymousNickname(user.id, postId);
    const payload  = {
      post_id:            post.id,
      user_id:            user.id,
      anonymous_nickname: nickname,
      content,
      is_expert_reply:    false,
      ...(replyTo?.id ? { parent_id: replyTo.id } : {}),
    };

    if (import.meta.env.DEV) {
      setDevCommentInfo({ payload, insertResult: null, insertError: null });
    }

    const { data, error } = await createLoungeComment(payload);

    if (import.meta.env.DEV) {
      setDevCommentInfo(prev => ({
        ...prev,
        insertResult: data ? { id: data.id, post_id: data.post_id, user_id: data.user_id } : null,
        insertError:  error?.message ?? null,
      }));
    }

    if (error) {
      showToast(`댓글 오류: ${error.message}`);
      setCommentSubmitting(false);
      return;
    }

    // 성공: 입력 초기화 후 DB 결과를 UI에 추가, 목록 리프레시
    setCommentText('');

    if (IS_SUPABASE_READY && user?.id) {
      const isExpert = user.role === 'company';
      const isReply  = !!replyTo?.id;

      // 원글 작성자에게 알림 (본인 글 제외)
      if (post?.user_id && post.user_id !== user.id) {
        const type = isExpert ? 'expert_answer' : 'post_comment';
        createLoungeNotification({
          userId:      post.user_id,
          type,
          title:       isExpert ? '전문가 답변' : '새 댓글',
          message:     isExpert ? '전문가가 내 글에 답변했어요' : '내 글에 댓글이 달렸어요',
          relatedId:   post.id,
          relatedType: 'lounge_post',
        });
      }
      // 답글 대상 댓글 작성자에게 알림 (본인 댓글 제외)
      if (isReply && replyTo.user_id && replyTo.user_id !== user.id) {
        createLoungeNotification({
          userId:      replyTo.user_id,
          type:        'comment_reply',
          title:       '답글',
          message:     '내 댓글에 답글이 달렸어요',
          relatedId:   post.id,
          relatedType: 'lounge_post',
        });
      }
    }

    setReplyTo(null);
    if (data) addComment(data);
    await refetchComments();
    setCommentSubmitting(false);
  };

  const handleChatRequest = async () => {
    if (chatSending || chatSent) return;
    setChatSending(true);
    if (user?.id) {
      await createLoungeChat({
        post_id:      postId,
        requester_id: user.id,
        post_user_id: post?.user_id ?? null,
      });
    }
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
    if (!post?.id || !user?.id) return;
    setDeleting(true);

    if (IS_SUPABASE_READY) {
      const { data, error: deleteErr } = await softDeleteLoungePost(post.id, user.id);

      if (import.meta.env.DEV) {
        setDeleteDevInfo({
          currentUserId: user?.id,
          postUserId:    post?.user_id,
          isOwner:       post?.user_id === user?.id,
          postId:        post?.id,
          delete_ok:     !deleteErr && data === true,
          delete_err:    deleteErr?.message ?? null,
          rpc_returned:  data,
        });
      }

      if (deleteErr || data !== true) {
        setDeleting(false);
        const errMsg = deleteErr?.message
          ? `삭제 실패: ${deleteErr.message}`
          : '삭제 실패: 본인 글만 삭제할 수 있어요 (migration 미실행 확인)';
        showToast(errMsg);
        return;
      }
    } else {
      try {
        const key = 'lounge_offline_posts';
        const prev = JSON.parse(localStorage.getItem(key) ?? '[]');
        localStorage.setItem(key, JSON.stringify(prev.filter(p => p.id !== post.id)));
      } catch {}
    }
    showToast('삭제됐어요');
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

  const catLabel    = CATEGORY_LABEL[post.category] ?? post.category;
  const postAvatar  = getAnonymousAvatarByNickname(post.anonymous_nickname);
  const topComments = comments.filter(c => !c.parent_id);
  const replyComs   = comments.filter(c => !!c.parent_id);
  const hasBadge    = post.has_badge === true;

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
              <img
                key={i}
                src={url}
                alt=""
                onClick={() => setImgViewer({ urls: post.image_urls, index: i })}
                style={{ width: 120, height: 120, borderRadius: R.md, objectFit: 'cover', flexShrink: 0, cursor: 'pointer' }}
              />
            ))}
          </div>
        )}

        {/* STEP3: 전문가(업체) 글 — 작성자 프로필 카드 자동 연결 */}
        {post.is_expert && (
          <div style={{ background: C.ivory, border: `1px solid ${C.bgWarm}`, borderRadius: 12, padding: '14px 16px', marginBottom: S.lg }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#8A6D2A', lineHeight: 1.8 }}>
              <span style={{ background: '#C4A96A22', border: '1px solid #C4A96A', borderRadius: R.full, padding: '2px 9px', fontSize: 13, marginRight: 6 }}>전문가</span>
              🛡️ 공간마켓 파트너
            </div>
            <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.8, marginTop: 4 }}>
              {post.expert_company_name ?? post.anonymous_nickname}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => onNavigate?.({ target: 'company', companyId: post.user_id })}
                style={{ flex: 1, padding: '11px 0', borderRadius: R.lg, border: `1px solid ${C.brandM}`, background: C.surface, color: '#1E3D2F', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                프로필 보기
              </button>
              <button onClick={() => onNavigate?.({ target: 'quote', companyId: post.user_id })}
                style={{ flex: 1, padding: '11px 0', borderRadius: R.lg, border: 'none', background: '#1E3D2F', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                견적 요청하기
              </button>
            </div>
          </div>
        )}

        {/* 카테고리별 거래 연결 CTA — 운영글(seed)에는 노출하지 않음(광고형 지양·체류 우선) */}
        {!isSeedPost && LOUNGE_CTA[post.category] && (
          <button
            onClick={() => onNavigate?.({ target: LOUNGE_CTA[post.category].target, companyId: post.is_expert ? post.user_id : null })}
            style={{ width: '100%', padding: '14px 0', marginBottom: S.lg, borderRadius: 12, border: 'none',
              background: '#1E3D2F', color: '#F5F0E8', fontSize: 15, fontWeight: 800, cursor: 'pointer', lineHeight: 1.8 }}>
            {LOUNGE_CTA[post.category].label}
          </button>
        )}

        {isSeedPost ? (
          /* 운영글 가벼운 하단 — 견적 CTA 없이 공감/공유/도움됐나요만 (매거진형) */
          <div style={{ background: C.surface2, borderRadius: R.md, padding: S.md, marginTop: S.sm }}>
            <div style={{ display: 'flex', gap: S.xl, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: C.text3 }}>👁 {(post.view_count ?? 0).toLocaleString()}</span>
              <button onClick={handleSeedLike} style={{ background: 'none', border: 'none', cursor: seedLiked ? 'default' : 'pointer', fontSize: 13, color: seedLiked ? '#E53E3E' : C.text3, fontWeight: seedLiked ? 800 : 500, padding: 0 }}>
                {seedLiked ? '❤️' : '🤍'} 공감
              </button>
              <button onClick={handleShare} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: C.text3, padding: 0 }}>
                🔗 공유
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: S.sm, marginTop: S.md, paddingTop: S.md, borderTop: `1px solid ${C.bgWarm}` }}>
              <span style={{ fontSize: 12, color: C.text3 }}>이 글이 도움이 됐나요?</span>
              <button onClick={handleHelpful} disabled={helpful}
                style={{ marginLeft: 'auto', background: helpful ? C.brandL : C.surface, border: `1px solid ${helpful ? C.brandM : C.bgWarm}`, borderRadius: R.full, padding: '5px 12px', fontSize: 12, fontWeight: 700, color: helpful ? C.brand : C.text2, cursor: helpful ? 'default' : 'pointer' }}>
                {helpful ? '👍 고마워요' : '👍 도움됐어요'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: S.xl, alignItems: 'center', paddingTop: S.md, borderTop: `1px solid ${C.bgWarm}`, background: C.surface2, borderRadius: R.md, padding: S.md, marginTop: S.sm }}>
            <span style={{ fontSize: 12, color: C.text3 }}>👁 {(post.view_count ?? 0).toLocaleString()}</span>
            <button onClick={handleLike} style={{ background: 'none', border: 'none', cursor: liked ? 'default' : 'pointer', fontSize: 13, color: liked ? '#E53E3E' : C.text3, fontWeight: liked ? 800 : 500, padding: 0 }}>
              {liked ? '❤️' : '🤍'} {(post.like_count ?? 0) + (liked ? 1 : 0)}
            </button>
            <button onClick={handleSave} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: saved ? C.gold : C.text3, padding: 0 }}>
              {saved ? '🔖' : '📄'} {saved ? '저장됨' : '저장'}
            </button>
            <button onClick={handleShare} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: C.text3, padding: 0 }}>
              🔗 공유
            </button>
            {!isOwn && (
              <button onClick={() => setReportTarget({ type: 'post', targetId: post.id })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.text4, padding: 0, marginLeft: 'auto' }}>
                신고
              </button>
            )}
          </div>
        )}
      </div>

      {/* 대화 신청 버튼 — 본인 글, seed 글에는 숨김 */}
      {!isOwn && !isSeedPost && (
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

      {/* DEV 패널 */}
      {SHOW_DEBUG_UI && (
        <div style={{ background: 'rgba(0,0,0,0.9)', color: '#0f0', margin: `0 0 ${S.sm}px`, padding: '8px 14px', fontSize: 10.5, lineHeight: 1.85, fontFamily: 'monospace' }}>
          [DEV] lounge_comments<br/>
          post.id: {post?.id?.slice(0,8) ?? 'NULL ⚠️'}<br/>
          user.id: {user?.id?.slice(0,8) ?? 'NULL ⚠️'}<br/>
          isOwner: {String(isOwn)} | post.user_id: {post?.user_id?.slice(0,8) ?? 'null'}<br/>
          comments.length: {comments.length} | fetch_err: {commentsFetchError ?? 'none'}<br/>
          ids: {comments.slice(0,3).map(c => c.id?.slice(0,6)).join(', ') || '(empty)'}<br/>
          {devCommentInfo && <>
            --- last insert ---<br/>
            payload: post_id={devCommentInfo.payload?.post_id?.slice(0,8)} uid={devCommentInfo.payload?.user_id?.slice(0,8)} content="{devCommentInfo.payload?.content?.slice(0,20)}"<br/>
            {devCommentInfo.insertError
              ? <span style={{color:'#f66'}}>insert_err: {devCommentInfo.insertError}<br/></span>
              : devCommentInfo.insertResult
                ? <span style={{color:'#0f0'}}>insert_ok: id={devCommentInfo.insertResult.id?.slice(0,8)} post_id={devCommentInfo.insertResult.post_id?.slice(0,8)}<br/></span>
                : null
            }
          </>}
          {deleteDevInfo && <>
            --- last delete ---<br/>
            currentUser.id: {deleteDevInfo.currentUserId?.slice(0,8)}<br/>
            post.user_id: {deleteDevInfo.postUserId?.slice(0,8)} | isOwner: {String(deleteDevInfo.isOwner)}<br/>
            delete_ok: <span style={{color: deleteDevInfo.delete_ok ? '#0f0' : '#f66'}}>{String(deleteDevInfo.delete_ok)}</span> | err: {deleteDevInfo.delete_err ?? 'null'}<br/>
            affected_rows: {deleteDevInfo.affected_rows}<br/>
          </>}
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
            {replyComs.filter(r => r.parent_id === comment.id).map(reply => (
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
        {isSeedPost ? (
          <div style={{ textAlign: 'center', padding: '10px 0', color: C.text4, fontSize: 13 }}>
            이 게시글에는 댓글을 달 수 없어요
          </div>
        ) : isGuest ? (
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
            <button onClick={handleComment} disabled={!commentText.trim() || commentSubmitting}
              style={{ background: (commentText.trim() && !commentSubmitting) ? C.brand : C.text4, color: '#fff', border: 'none', borderRadius: R.full, width: 44, height: 44, fontSize: 16, cursor: (commentText.trim() && !commentSubmitting) ? 'pointer' : 'not-allowed', flexShrink: 0 }}>
              {commentSubmitting ? '…' : '↑'}
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

      {imgViewer && (
        <div
          onClick={() => setImgViewer(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
        >
          {/* 닫기 */}
          <button
            onClick={() => setImgViewer(null)}
            style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 20, width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
          >✕</button>

          {/* 이미지 */}
          <img
            src={imgViewer.urls[imgViewer.index]}
            alt=""
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '92vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: R.lg }}
          />

          {/* 인디케이터 */}
          {imgViewer.urls.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
              {imgViewer.urls.map((_, i) => (
                <div
                  key={i}
                  onClick={e => { e.stopPropagation(); setImgViewer(v => ({ ...v, index: i })); }}
                  style={{ width: i === imgViewer.index ? 18 : 6, height: 6, borderRadius: 3, background: i === imgViewer.index ? '#fff' : 'rgba(255,255,255,0.35)', cursor: 'pointer', transition: 'width 0.15s' }}
                />
              ))}
            </div>
          )}

          {/* 좌우 버튼 */}
          {imgViewer.index > 0 && (
            <button
              onClick={e => { e.stopPropagation(); setImgViewer(v => ({ ...v, index: v.index - 1 })); }}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 22, width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >‹</button>
          )}
          {imgViewer.index < imgViewer.urls.length - 1 && (
            <button
              onClick={e => { e.stopPropagation(); setImgViewer(v => ({ ...v, index: v.index + 1 })); }}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 22, width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >›</button>
          )}
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: C.brand, color: '#fff', borderRadius: R.lg, padding: '12px 22px', fontSize: 12, fontWeight: 700, boxShadow: `0 8px 24px ${C.brand}44`, zIndex: 200, maxWidth: '85vw', wordBreak: 'break-all', textAlign: 'center' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
