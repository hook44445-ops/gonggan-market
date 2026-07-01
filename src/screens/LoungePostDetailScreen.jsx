// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import { C, R, S } from '../constants';
import { SHOW_DEBUG_UI } from '../constants/release';
import { CATEGORY_LABEL, TOKEN_COSTS } from '../constants/lounge';
import { useLoungePost } from '../hooks/useLounge';
import { getAnonymousNickname, formatLoungeRelativeTime, getAnonymousAvatarByNickname, getGenderEmoji } from '../utils/anonymousNickname';
import {
  createLoungeComment,
  getRelatedLoungePosts,
  likeLoungePost,
  unlikeLoungePost,
  addLoungePostLike,
  removeLoungePostLike,
  checkLoungePostLiked,
  addLoungeSave,
  removeLoungeSave,
  checkLoungeSaved,
  incrementLoungeView,
  requestCommentChat,
  sendMessage,
  getUser,
  getCompanyByOwnerId,
  getCompaniesByOwnerIds,
  getReviews,
} from '../lib/supabase';
import { loungeChatDbg } from '../utils/loungeChatDebug'; // 대화 신청 신원 진단(플래그 시에만 출력)
import { BADGES } from '../constants/badges';
import LoungeCommentItem from '../components/lounge/LoungeCommentItem';
import ChatRequestModal from '../components/lounge/ChatRequestModal';
import ReportModal from '../components/lounge/ReportModal';
import CompanyMiniPortfolioModal from '../components/lounge/CompanyMiniPortfolioModal';
import LoungeProfilePopover from '../components/lounge/LoungeProfilePopover';
import { IS_SUPABASE_READY, softDeleteLoungePost, createLoungeNotification, createNotification } from '../lib/supabase';
import { buildPostMeta, buildPostPath } from '../utils/loungeSeo';
import { RichContent } from '../utils/richText';
import { resolveCompanyIdentity, resolveConsumerIdentity } from '../utils/identityResolver';
import SpaceActivityRecord from '../components/SpaceActivityRecord'; // 일반 의뢰인 활동기록 요약(재사용 · 업체버튼 없음)

// 클릭한 닉네임/아바타 요소의 화면 위치(앵커) — 초미니 팝오버 위치 보정용
const rectOf = (e) => {
  const r = e?.currentTarget?.getBoundingClientRect?.();
  return r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null;
};

// 가입기간 라벨 — 신뢰 프로필 헤더용(가입일 기준 경과기간, 실데이터만)
const joinPeriodLabel = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 1) return '오늘 가입';
  if (days < 30) return `가입 ${days}일째`;
  const months = Math.floor(days / 30);
  if (months < 12) return `가입 ${months}개월째`;
  return `가입 ${Math.floor(days / 365)}년째`;
};

// ── 댓글 작성자 액션시트 ─────────────────────────────────
function CommentAuthorActionSheet({ comment, alreadySent, busy, isOwn, onChat, onReport, onClose, roleLabel = '댓글 작성자', profile = null }) {
  // 신뢰 프로필 — 익명 아바타 + 가입기간(헤더). 일반 의뢰인 전용(업체 정보/버튼 없음).
  const avatar = getAnonymousAvatarByNickname(comment.anonymous_nickname);
  const joinLabel = joinPeriodLabel(profile?.joinedAt);
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.surface, borderRadius: `${R.xl}px ${R.xl}px 0 0`, padding: '20px 0 calc(20px + env(safe-area-inset-bottom, 0px)) 0' }}
      >
        {/* 작성자 정보 헤더 — 신뢰 프로필(익명 아바타 · 닉네임 · 공간온도 · 가입기간) */}
        <div style={{ padding: '0 20px 16px', borderBottom: `1px solid ${C.bgWarm}`, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: avatar.color, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
              {getGenderEmoji(comment.gender)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: C.text3, marginBottom: 2 }}>
                {isOwn ? `내 ${roleLabel === '댓글 작성자' ? '댓글' : '글'}` : roleLabel}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text1 }}>
                {resolveConsumerIdentity(comment)}
              </div>
            </div>
          </div>
          {/* 공간온도 · 가입기간 · 관심카테고리 · 최근활동 (조회 실패 시 표시 생략) */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {profile?.spaceTemp != null && (
              <span style={{ background: C.brandL, color: C.brand, borderRadius: R.full, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                🌡️ 공간온도 {Number(profile.spaceTemp).toFixed(1)}°
              </span>
            )}
            {joinLabel && (
              <span style={{ background: C.bg, color: C.text3, borderRadius: R.full, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                🗓️ {joinLabel}
              </span>
            )}
            {(profile?.interests ?? []).slice(0, 3).map(it => (
              <span key={it} style={{ background: C.bg, color: C.text3, borderRadius: R.full, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
                #{it}
              </span>
            ))}
            {comment.created_at && formatLoungeRelativeTime(comment.created_at) && (
              <span style={{ fontSize: 11, color: C.text4 }}>
                🕐 최근활동 {formatLoungeRelativeTime(comment.created_at)}
              </span>
            )}
          </div>
          {comment.content && (
            <div style={{ fontSize: 12, color: C.text4, marginTop: 8, lineHeight: 1.5,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              "{comment.content}"
            </div>
          )}
        </div>

        {/* 일반 의뢰인 활동기록 요약 — 작성글/댓글/받은 좋아요/최근 활동(ownerId만 전달 → 업체용 버튼 없음) */}
        {comment.user_id && (
          <div style={{ padding: '12px 20px 0' }}>
            <SpaceActivityRecord ownerId={comment.user_id} title="활동 기록" />
          </div>
        )}

        {/* 액션 목록 */}
        {!isOwn && (
          <button
            onClick={alreadySent ? undefined : onChat}
            disabled={busy || alreadySent}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '15px 20px',
              background: 'none', border: 'none', cursor: (busy || alreadySent) ? 'default' : 'pointer',
              fontSize: 15, color: alreadySent ? C.text4 : C.text1, fontWeight: 600, textAlign: 'left',
              opacity: busy ? 0.6 : 1 }}
          >
            <span style={{ fontSize: 20 }}>{alreadySent ? '✅' : '💬'}</span>
            {alreadySent ? '이미 대화 신청을 보냈어요' : busy ? '처리 중...' : '이 작성자에게 대화 신청하기'}
          </button>
        )}

        <button
          onClick={onReport}
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '15px 20px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 15, color: C.text1, fontWeight: 600, textAlign: 'left' }}
        >
          <span style={{ fontSize: 20 }}>🚩</span>
          {roleLabel === '게시글 작성자' ? '게시글 신고하기' : '댓글 신고하기'}
        </button>

        <div style={{ height: 1, background: C.bgWarm, margin: '8px 0' }} />

        <button
          onClick={onClose}
          style={{ width: '100%', padding: '15px 20px', background: 'none', border: 'none',
            cursor: 'pointer', fontSize: 15, color: C.text3, fontWeight: 600 }}
        >
          취소
        </button>
      </div>
    </div>
  );
}

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
export default function LoungePostDetailScreen({ postId, initialPost, user, tokenBalance, onBack, onSpendToken, onTokenStore, onRequireLogin, onEditPost, onDeletePost, onNavigate, onOpenPost, onChatRequested }) {
  const { post: foundPost, comments, loading, commentsFetchError, addComment, likeComment, refetchComments } = useLoungePost(postId, initialPost);
  const post = foundPost ?? initialPost ?? null;
  // is_seed(운영글)는 매거진형(견적 CTA·대화신청만 숨김)이고 상호작용은 일반 글과 동일.
  // 단, seed_lounge_posts 합성 글(id 'seed_' 접두 · DB 미존재)은 읽기 전용.
  const isSynthSeed = typeof postId === 'string' && postId.startsWith('seed_');
  const isSeedPost  = post?.is_seed === true;
  const [commentText, setCommentText]       = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [devCommentInfo, setDevCommentInfo] = useState(null);
  const [replyTo,     setReplyTo]           = useState(null);
  const [liked,       setLiked]             = useState(false);
  const [likeCount,   setLikeCount]         = useState(post?.like_count ?? 0);
  const [viewCount,   setViewCount]         = useState(post?.view_count ?? 0);
  const [saved,       setSaved]             = useState(() => {
    try {
      const saves = JSON.parse(localStorage.getItem('lounge_saved_posts') ?? '[]');
      return saves.some(s => s.id === postId);
    } catch { return false; }
  });
  const [showChat,    setShowChat]          = useState(false);
  const [miniModal,   setMiniModal]         = useState(null); // 업체 미니 포트폴리오 { ownerId, nickname }
  const [commentSort] = useState('latest'); // 최신순 고정(전문가순·인기순 정렬 제거)
  const [chatSending, setChatSending]       = useState(false);
  const [chatSent,    setChatSent]          = useState(false);
  const [toast,       setToast]             = useState(null);
  const [reportTarget, setReportTarget]     = useState(null);
  // 댓글 작성자 클릭 → 액션시트
  const [commentAuthorSheet, setCommentAuthorSheet] = useState(null); // { comment }
  const [chatRequestBusy,    setChatRequestBusy]    = useState(false);
  // 답글 묶음(블릿 UX) — 펼친 댓글 id Set
  const [expandedReplies, setExpandedReplies] = useState(() => new Set());
  const toggleReplies = (id) => setExpandedReplies(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  // 이미 신청 보낸 댓글 userId Set (UI 표시용)
  const [sentChatTargets,    setSentChatTargets]    = useState(() => new Set());
  const [relatedPosts, setRelatedPosts]     = useState([]);
  const [showMenu,    setShowMenu]          = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting,    setDeleting]          = useState(false);
  const [deleteDevInfo, setDeleteDevInfo] = useState(null);
  const [imgViewer, setImgViewer]         = useState(null); // { urls, index }
  const inputRef = useRef(null);

  // 게스트(딥링크 등) 읽기 전용 보강 — isGuest 플래그가 누락돼도 실제 user.id 없으면 비로그인 취급.
  // → 게시글/댓글 수정·삭제·작성·좋아요·저장·메시지·신고는 모두 비활성/차단(아래 핸들러 가드와 이중화).
  const isGuest    = user?.isGuest === true || !user?.id;
  const isLoggedIn = !isGuest;
  const isOwn      = isLoggedIn && post?.user_id && user?.id && post.user_id === user.id;

  // 좋아요/조회수 카운트는 항상 DB 값 기준으로 동기화 (하드코딩 금지)
  useEffect(() => {
    setLikeCount(post?.like_count ?? 0);
    setViewCount(post?.view_count ?? 0);
  }, [post?.id, post?.like_count, post?.view_count]);

  // 작성자 바텀시트 — 공간온도/관심카테고리 조회 (실패 시 표시만 생략, 시트 동작 영향 없음)
  const [authorProfile, setAuthorProfile] = useState(null);
  useEffect(() => {
    setAuthorProfile(null);
    const uid = commentAuthorSheet?.comment?.user_id;
    if (!uid || !IS_SUPABASE_READY) return;
    let cancelled = false;
    getUser(uid).then(({ data }) => {
      if (!cancelled && data) {
        setAuthorProfile({ spaceTemp: data.space_temp ?? 36.5, interests: data.interests ?? [], joinedAt: data.created_at ?? null });
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [commentAuthorSheet]);

  // 전문가(업체) 글 — 업체 미니카드용 업체 정보/후기 수 조회 (실패 시 기존 카드 그대로)
  const [expertCompany, setExpertCompany] = useState(null);
  const [expertReviewCount, setExpertReviewCount] = useState(null);
  useEffect(() => {
    setExpertCompany(null);
    setExpertReviewCount(null);
    if (!post?.is_expert || !post?.user_id || !IS_SUPABASE_READY) return;
    let cancelled = false;
    getCompanyByOwnerId(post.user_id).then(async ({ data: co }) => {
      if (cancelled || !co) return;
      setExpertCompany(co);
      const { data: revs } = await getReviews(co.id).catch(() => ({ data: null }));
      if (!cancelled) setExpertReviewCount(revs?.length ?? null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [post?.is_expert, post?.user_id]);

  // 의뢰인/업체 익명 표시명 분리 — 업체(전문가) 작성자는 의뢰인 익명닉네임 대신 업체명으로 표시.
  // 전문가 글/댓글 작성자(user_id)들의 업체명을 한 번에 조회(읽기 전용). 매핑: { [owner_id]: 업체명 }
  const [companyNameMap, setCompanyNameMap] = useState({});
  useEffect(() => {
    if (!IS_SUPABASE_READY) return;
    const ids = new Set();
    if (post?.is_expert && post?.user_id) ids.add(post.user_id);
    (comments ?? []).forEach((c) => { if (c.is_expert_reply && c.user_id) ids.add(c.user_id); });
    const list = [...ids];
    if (list.length === 0) { setCompanyNameMap({}); return; }
    let cancelled = false;
    getCompaniesByOwnerIds(list).then(({ data }) => {
      if (cancelled || !data) return;
      const m = {};
      data.forEach((co) => { if (co.owner_id && co.name) m[co.owner_id] = co.name; });
      setCompanyNameMap(m);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [comments, post?.is_expert, post?.user_id]);

  // 업체 표시명 — 라운지 익명 정책. 실업체명 대신 owner_id 기반 결정론적 익명닉네임(공간○○NN).
  // 댓글/게시글/미니팝오버 모두 동일 키(owner_id)로 해석되어 같은 업체는 같은 익명닉네임을 유지한다.
  const companyDisplayName = (ownerId, fullCompany = null) =>
    resolveCompanyIdentity(
      (fullCompany && typeof fullCompany === 'object')
        ? fullCompany
        : { owner_id: ownerId }
    );

  // Load initial like/save state from DB (skip synthetic seed — not in lounge_posts)
  useEffect(() => {
    if (!user?.id || !postId || isGuest || isSynthSeed) return;
    Promise.all([
      checkLoungePostLiked(postId, user.id),
      checkLoungeSaved(postId, user.id),
    ]).then(([likeRes, saveRes]) => {
      if (likeRes.data) setLiked(true);
      if (saveRes.data) setSaved(true);
    }).catch(() => {});
  }, [postId, user?.id, isGuest, isSynthSeed]);

  // 상세 진입 시 조회수 +1 (합성 seed 제외) · 같은 글은 하루 1회만 (로컬 중복 방지)
  useEffect(() => {
    if (!postId || isSynthSeed || !IS_SUPABASE_READY) return;
    let cancelled = false;
    try {
      const key = `lounge_viewed_${postId}`;
      const today = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem(key) === today) return;
      localStorage.setItem(key, today);
    } catch { /* localStorage 불가 환경 — 그대로 진행 */ }
    incrementLoungeView(postId)
      .then(() => { if (!cancelled) setViewCount(v => v + 1); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [postId, isSynthSeed]);

  // ── SEO: 글 상세 진입 시 메타태그 동적 갱신 (언마운트 시 복원) ──
  useEffect(() => {
    if (!post || isSynthSeed) return undefined;
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

    // canonical — 봇 프리렌더(api/prerender.js)와 동일한 URL 규칙(id+slug)으로 정합.
    // JS 를 실행하는 크롤러(Googlebot 등)의 중복 URL(슬러그 변형) 통합에 도움.
    let canonicalEl = document.head.querySelector('link[rel="canonical"]');
    const canonicalCreated = !canonicalEl;
    const canonicalPrev = canonicalCreated ? null : canonicalEl.getAttribute('href');
    if (!canonicalEl) { canonicalEl = document.createElement('link'); canonicalEl.setAttribute('rel', 'canonical'); document.head.appendChild(canonicalEl); }
    canonicalEl.setAttribute('href', `${window.location.origin}${buildPostPath(post)}`);

    return () => {
      document.title = prevTitle;
      targets.forEach(t => {
        if (t.created) t.el.remove();
        else if (t.prev != null) t.el.setAttribute('content', t.prev);
      });
      if (canonicalCreated) canonicalEl.remove();
      else if (canonicalPrev != null) canonicalEl.setAttribute('href', canonicalPrev);
    };
  }, [post?.id, post?.title, post?.content, isSynthSeed]); // eslint-disable-line react-hooks/exhaustive-deps

  // 관련글(SEO 내부링크) — 같은 카테고리 인기글 우선. seed/일반 글 공통.
  useEffect(() => {
    if (!IS_SUPABASE_READY || !post?.id || !post?.category) { setRelatedPosts([]); return; }
    let cancelled = false;
    getRelatedLoungePosts(post.category, post.id, 4)
      .then(({ data }) => { if (!cancelled) setRelatedPosts(data ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [post?.id, post?.category]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  // 좋아요 토글 — 다시 누르면 취소(감소). lounge_post_likes + like_count 동기화.
  const handleLike = async () => {
    if (isGuest) { onRequireLogin?.(); return; }
    if (isSynthSeed) return;
    const next = !liked;
    setLiked(next);
    setLikeCount(c => Math.max(0, c + (next ? 1 : -1)));
    if (next) {
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
    } else {
      await Promise.all([
        removeLoungePostLike(postId, user.id),
        unlikeLoungePost(postId),
      ]);
    }
  };

  const handleSave = async () => {
    if (isGuest) { onRequireLogin?.(); return; }
    if (isSynthSeed) return;
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
    // 공유 URL은 정규 경로(/lounge/posts/{id}/{slug}) 사용 — 기존 OG/SEO 구조 그대로.
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = post?.id ? `${origin}${buildPostPath(post)}` : (typeof window !== 'undefined' ? window.location.href : '');
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

  const handleComment = async () => {
    if (isGuest) { onRequireLogin?.(); return; }
    if (commentSubmitting || isSynthSeed) return;

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
      // 업체(role=company) 작성 댓글은 전문가 답변으로 표시(시각 구분 + 미니 포트폴리오 연결)
      is_expert_reply:    (user?.role === 'company' || user?.activeRole === 'company'),
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

      // 푸시/앱 내 알림 문구 규칙
      //  · 제목 = 게시글 본문 첫 줄(없으면 "공간마켓 라운지", 45자 초과 시 말줄임)
      //  · 본문 = 댓글 내용(60자 초과 시 말줄임 / 사진만 있으면 안내문구 / 비어있으면 기본문구)
      const firstLine = (post?.content ?? '')
        .split('\n')
        .map((s) => s.trim())
        .find(Boolean) ?? '';
      const notifTitle = firstLine
        ? (firstLine.length > 45 ? `${firstLine.slice(0, 45)}…` : firstLine)
        : '공간마켓 라운지';
      const hasCommentImage = Array.isArray(data?.image_urls) && data.image_urls.length > 0;
      const notifBody = content
        ? (content.length > 60 ? `${content.slice(0, 60)}…` : content)
        : (hasCommentImage ? '사진 댓글을 남겼습니다.' : '댓글을 남겼습니다.');

      // 원글 작성자에게 알림 (본인 글 제외) — createNotification: 앱 내 알림 저장 + FCM 푸시 큐잉(best-effort)
      if (post?.user_id && post.user_id !== user.id) {
        const type = isExpert ? 'expert_answer' : 'post_comment';
        createNotification({
          userId:      post.user_id,
          type,
          title:       notifTitle,
          message:     notifBody,
          relatedId:   post.id,
          relatedType: 'lounge_post',
        });
      }
      // 답글 대상 댓글 작성자에게 알림 (본인 댓글 제외) — 동일하게 푸시 큐잉
      if (isReply && replyTo.user_id && replyTo.user_id !== user.id) {
        createNotification({
          userId:      replyTo.user_id,
          type:        'comment_reply',
          title:       notifTitle,
          message:     notifBody,
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

  // 대화 신청 전 토큰 확인 — 부족하면 토큰 스토어로 이동 (차감 정책 자체는 기존 유지: 수락 시 신청자 차감)
  const ensureChatTokens = () => {
    if ((tokenBalance ?? 0) >= TOKEN_COSTS.CHAT_REQUEST) return true;
    showToast(`대화를 신청하려면 ${TOKEN_COSTS.CHAT_REQUEST}토큰이 필요합니다.\n토큰 충전 후 다시 시도해주세요.`);
    setTimeout(() => onTokenStore?.(), 1200);
    return false;
  };

  // 메시지 작성 BottomSheet의 "보내기" 클릭 시에만 호출된다 — 절대 즉시 채팅방을 만들지 않는다.
  // 보내기 → 토큰 확인(부족 시 토큰 스토어 이동) → 메시지 요청 생성 → 첫 메시지 전송 순서.
  const handleChatRequest = async (messageText) => {
    // 진단: 핸들러 실행 여부 + disabled/차단 조건(무반응 원인 추적)
    console.log('[CHAT DEBUG] handleChatRequest called', {
      chatSending, chatSent, isGuest,
      currentUserId: user?.id ?? null, targetUserId: post?.user_id ?? null,
      postId, hasText: !!(messageText ?? '').trim(), tokenBalance,
    });
    if (chatSending) { console.warn('[CHAT DEBUG] blocked: chatSending(처리 중)'); return; }
    if (chatSent)    { console.warn('[CHAT DEBUG] blocked: chatSent(이미 신청)'); setShowChat(false); showToast('이미 메시지를 보냈어요. 대화 탭에서 확인하세요.'); return; }
    if (isGuest) { console.warn('[CHAT DEBUG] blocked: guest'); setShowChat(false); onRequireLogin?.(); return; }
    if (!user?.id || !post?.user_id) { console.warn('[CHAT DEBUG] blocked: missing id', { userId: user?.id, target: post?.user_id }); setShowChat(false); showToast('상대 정보를 불러오는 중이에요'); return; }
    // 게시글 본인 판정 — post.user_id === currentUser.id (directive ①: 각 경로별 작성자 id로만 self 판정)
    if (post.user_id === user.id) { console.warn('[CHAT DEBUG] blocked: self(post.user_id===me)'); setShowChat(false); showToast('본인 글에는 메시지를 보낼 수 없어요'); return; }
    const text = (messageText ?? '').trim();
    if (!text) { console.warn('[CHAT DEBUG] blocked: empty text'); showToast('메시지를 입력해주세요'); return; }
    if (!ensureChatTokens()) { console.warn('[CHAT DEBUG] blocked: insufficient tokens', { tokenBalance }); setShowChat(false); return; }

    console.log('[CHAT DEBUG] submit start', { source: 'bottom-cta/handleChatRequest' });
    console.log('[CHAT DEBUG] rpc input', {
      currentUserId: user.id,
      targetUserId:  post.user_id,
      postId,
      commentId:     null,
      tokenBalance,
    });

    setChatSending(true);
    // ⚠️ Supabase 빌더(PostgrestBuilder)는 PromiseLike(then만 존재) — .catch()가 없어 .catch 체이닝은
    //    동기 TypeError를 던진다. 과거 `requestCommentChat(...).catch(...)`가 setChatSending(false) 이전에
    //    던져져 "보내는 중..."에서 멈췄다. → try/catch/finally로 전환(반드시 loading 해제 + 실패 toast).
    try {
      // 라운지 메시지 요청 = lounge_chat_requests 생성(댓글 경로와 동일). 정확한 상대(post.user_id)에게 요청.
      const { data, error } = await requestCommentChat(user.id, post.user_id, postId, null);
      console.log('[CHAT DEBUG] rpc result', {
        data, error, code: error?.code, message: error?.message, details: error?.details,
      });
      // 진단: 신청자(나) 신원 + 저장 대상 + 반환 request_id 를 한 줄로 — 회사 받은목록 로그의
      // request_id 와 대조해 '저장된 target_id 와 회사 user.id 일치 여부'를 확인하기 위함.
      loungeChatDbg("대화신청 전송(post author)", {
        requesterId: user.id,
        activeRole:  user?.activeRole ?? user?.role,
        targetId:    post.user_id,
        postId,
        requestId:   data?.request_id ?? null,
        status:      data?.status ?? null,
        rpcError:    error?.message ?? data?.error ?? null,
      });
      if (error) { showToast('대화 신청에 실패했습니다. 다시 시도해주세요.'); return; }
      if (data?.error === 'SELF_REQUEST') { showToast('본인에게는 신청할 수 없어요'); return; }
      setChatSent(true);
      onChatRequested?.(); // 대화 탭 수락대기(Waiting Accept) 목록 즉시 갱신
      try {
        const key = 'lounge_chat_requests';
        const prev = JSON.parse(localStorage.getItem(key) ?? '[]');
        prev.unshift({ postId, postTitle: post?.title ?? post?.content?.slice(0, 30), nickname: post?.anonymous_nickname, sentAt: new Date().toISOString() });
        localStorage.setItem(key, JSON.stringify(prev.slice(0, 50)));
      } catch {}
      if (data?.status === 'already_accepted') { showToast('이미 대화 중인 상대예요 💬'); return; }
      if (data?.status === 'already_pending') { showToast('이미 메시지를 보냈어요. 대화 탭에서 확인하세요.'); return; }
      // 대화 신청 알림 — 게시글 메시지 경로에도 상대(post.user_id)에게 알림 생성(댓글 경로와 동일).
      // 신규 생성(created)일 때만 발송해 중복 알림 방지. 토큰/대화방 로직은 RPC 그대로, 알림만 추가.
      if (data?.status === 'created') {
        createNotification({
          userId:      post.user_id,
          type:        'LOUNGE_CHAT_REQUEST',
          title:       '새 대화 신청',
          message:     '회원님의 글에 누군가 대화를 신청했어요.',
          relatedId:   postId,
          relatedType: 'lounge',
        }).catch(() => {});
      }
      // 작성한 메시지를 방의 첫 메시지로 전송 (room_id = lounge_{request_id}, MainApp.openLoungeChatRoom과 동일 규칙)
      const requestId = data?.request_id;
      if (requestId) {
        const { error: msgErr } = await sendMessage(`lounge_${requestId}`, user.id, 'user', text);
        if (msgErr) console.log('[CHAT DEBUG] first message send error', msgErr);
      }
      showToast('💬 메시지를 보냈어요! 대화 탭에서 확인할 수 있어요. 수락 시 20토큰이 차감됩니다.');
    } catch (e) {
      console.log('[CHAT DEBUG] rpc result', { data: null, error: e, code: e?.code, message: e?.message, details: e?.details });
      showToast('대화 신청에 실패했습니다. 다시 시도해주세요.');
    } finally {
      console.log('[CHAT DEBUG] submit end - loading false');
      setChatSending(false);
      setShowChat(false);
    }
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

  // 신고 트리거 공통 가드 — 게스트(읽기 전용)는 로그인 유도, 로그인 사용자는 기존과 동일하게 모달 오픈.
  const openReport = (target) => {
    if (isGuest) { onRequireLogin?.(); return; }
    setReportTarget(target);
  };

  const handleReport = () => {
    setShowMenu(false);
    openReport({ type: 'post', targetId: post.id });
  };

  // 댓글 작성자 클릭 → 닉네임 옆 초미니 팝오버(앵커는 클릭 지점에서 계산되어 전달됨)
  const handleCommentAuthorClick = (comment, anchor) => {
    if (!isLoggedIn) { onRequireLogin?.(); return; }
    setMiniModal(null);
    setCommentAuthorSheet({ comment, anchor });
  };

  // 게시글 작성자 클릭 → 전문가 글은 업체 팝오버 / 그 외는 의뢰인 팝오버 (시드 글 제외)
  const handlePostAuthorClick = (e) => {
    if (!post?.user_id || isSeedPost) return;
    setCommentAuthorSheet(null);
    // 업체(전문가) 글 작성자 → 업체 미니 팝오버
    if (post.is_expert) {
      setMiniModal({ ownerId: post.user_id, nickname: companyDisplayName(post.user_id, expertCompany), anchor: rectOf(e), report: { type: 'post', targetId: post.id } });
      return;
    }
    if (!isLoggedIn) { onRequireLogin?.(); return; }
    setMiniModal(null);
    setCommentAuthorSheet({
      comment: {
        user_id:            post.user_id,
        post_id:            post.id,
        anonymous_nickname: post.anonymous_nickname,
        content:            post.title ?? post.content?.slice(0, 50),
        created_at:         post.created_at,
      },
      isPostAuthor: true,
      anchor: rectOf(e),
    });
  };

  // 댓글 신고
  const handleCommentReportFromSheet = (commentId) => {
    setCommentAuthorSheet(null);
    openReport({ type: 'comment', targetId: commentId });
  };

  // 대화 신청 (댓글 작성자에게)
  const handleCommentChatRequest = async (comment) => {
    // directive ①: 댓글/대댓글은 '댓글 작성자 user_id'(comment.user_id) 기준으로만 self 판정.
    // (post.user_id / company.owner_id / displayName 으로 판정 금지)
    const isSelf = comment?.user_id != null && comment.user_id === user?.id;
    console.log('[CHAT DEBUG] message button clicked', {
      source:        'comment-author-popover',
      currentUserId: user?.id,
      targetUserId:  comment?.user_id,
      commentUserId: comment?.user_id,   // 댓글/대댓글 작성자 user_id (대댓글도 reply.user_id가 그대로 들어옴)
      isSelf,
      isOwn:         isSelf,
      disabledReason: chatRequestBusy ? 'busy' : isSelf ? 'self(author===me)' : null,
      commentId:     comment?.id,
      role:          user?.activeRole ?? user?.role,
    });
    if (chatRequestBusy) return;
    if (!isLoggedIn || !user?.id) { onRequireLogin?.(); return; }
    // 자기 댓글만 차단(directive ①). 업체 댓글(타인)은 정상 진행되어야 한다.
    if (isSelf) { console.warn('[CHAT DEBUG] blocked: self(comment.user_id===me)'); setCommentAuthorSheet(null); showToast('본인에게는 신청할 수 없어요'); return; }
    if (!ensureChatTokens()) { setCommentAuthorSheet(null); return; }
    setCommentAuthorSheet(null);
    setChatRequestBusy(true);
    console.log('[CHAT DEBUG] submit start', { source: 'comment-author-popover' });
    try {
      console.log('[CHAT DEBUG] rpc input', {
        currentUserId: user.id, targetUserId: comment.user_id, postId, commentId: comment.id, tokenBalance,
      });
      const { data, error } = await requestCommentChat(
        user.id,
        comment.user_id,
        postId,
        comment.id,
      );
      console.log('[CHAT DEBUG] rpc result', {
        data, error, code: error?.code, message: error?.message, details: error?.details,
      });
      // 진단: 신청자(나) 신원 + 저장 대상(댓글 작성자) + 반환 request_id (회사 받은목록 로그와 대조용).
      loungeChatDbg("대화신청 전송(comment author)", {
        requesterId: user.id,
        activeRole:  user?.activeRole ?? user?.role,
        targetId:    comment.user_id,
        postId,
        commentId:   comment.id,
        requestId:   data?.request_id ?? null,
        status:      data?.status ?? null,
        rpcError:    error?.message ?? data?.error ?? null,
      });
      const status = data?.status;
      if (error) {
        showToast(`대화 신청 실패: ${error.message}`);
      } else if (status === 'already_accepted') {
        showToast('이미 대화 중인 상대예요 💬');
      } else if (status === 'already_pending') {
        showToast('이미 대화 신청을 보냈어요');
      } else if (data?.error === 'SELF_REQUEST') {
        showToast('본인에게는 신청할 수 없어요');
      } else {
        setSentChatTargets(prev => new Set([...prev, comment.user_id]));
        onChatRequested?.(); // 대화 탭 수락대기 목록 즉시 갱신
        showToast('💬 대화 신청을 보냈어요!\n상대가 수락하면 20토큰이 차감됩니다.');
        // B단계: 대화 신청 알림(인앱 + 푸시 enqueue) — 토큰/대화방 로직은 위 RPC 그대로, 알림만 추가.
        createNotification({
          userId:      comment.user_id,
          type:        'LOUNGE_CHAT_REQUEST',
          title:       '새 대화 신청',
          message:     '회원님의 댓글에 누군가 대화를 신청했어요.',
          relatedId:   postId,
          relatedType: 'lounge',
        }).catch(() => {});
      }
    } finally {
      console.log('[CHAT DEBUG] submit end - loading false', { source: 'comment-author-popover' });
      setChatRequestBusy(false);
    }
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
    if (isGuest || !isOwn || !post?.id || !user?.id) return;
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
  // 댓글 정렬(LOUNGE-ENGAGEMENT-v3.2) — 전문가순(기본)/인기순/최신순. 기존 데이터만 사용.
  const sortComments = (list) => {
    const arr = [...list];
    if (commentSort === 'latest') return arr.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (commentSort === 'popular') return arr.sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0) || new Date(b.created_at) - new Date(a.created_at));
    // expert(기본): 전문가 → 좋아요 많은 → 최신
    return arr.sort((a, b) =>
      (b.is_expert_reply ? 1 : 0) - (a.is_expert_reply ? 1 : 0)
      || (b.like_count ?? 0) - (a.like_count ?? 0)
      || new Date(b.created_at) - new Date(a.created_at));
  };
  const topComments = sortComments(comments.filter(c => !c.parent_id));
  const replyComs   = comments.filter(c => !!c.parent_id);
  const isCompanyUser = user?.role === 'company' || user?.activeRole === 'company';
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
          <span onClick={handlePostAuthorClick}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
              cursor: ((post.is_expert || !isSeedPost) && post.user_id && !isSeedPost) ? 'pointer' : 'default' }}>
            {/* 익명 사람 이모티콘 — 닉네임 글씨 크기와 동일(인라인·세로 가운데). 아이콘처럼 튀지 않게(directive ②) */}
            <span style={{ fontSize: 14, lineHeight: 1, display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>{getGenderEmoji(post.gender)}</span>
            <span style={{ fontWeight: 800, fontSize: 14, color: C.text1 }}>
              {hasBadge && <span style={{ fontSize: 13, marginRight: 3 }}>🛡️</span>}
              {post.is_expert ? companyDisplayName(post.user_id, expertCompany) : resolveConsumerIdentity(post)}
            </span>
          </span>
          <span style={{ background: C.brandL, color: C.brand, borderRadius: R.full, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{catLabel}</span>
          {post.region && <span style={{ fontSize: 11, color: C.text4 }}>· {post.region}</span>}
          {post.age_group && <span style={{ fontSize: 11, color: C.text4 }}>· {post.age_group}</span>}
          <span style={{ fontSize: 11, color: C.text4, marginLeft: 'auto' }}>{formatLoungeRelativeTime(post.created_at)}</span>
        </div>

        {post.title && (
          /* SEO: 글 제목은 의미상 H1 (스타일은 동일 유지) */
          <h1 style={{ fontSize: 18, fontWeight: 900, color: C.text1, margin: `0 0 ${S.md}px`, lineHeight: 1.4 }}>{post.title}</h1>
        )}
        <div style={{ marginBottom: S.xl }}><RichContent content={post.content} baseSize={14} /></div>

        {post.image_urls && post.image_urls.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: S.lg, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {post.image_urls.map((url, i) => (
              <img
                key={i}
                src={url}
                /* SEO: 제목 기반 alt — 이미지도 콘텐츠의 일부 */
                alt={post.title ? `${post.title}${post.image_urls.length > 1 ? ` (${i + 1})` : ''}` : '공간마켓 라운지 이미지'}
                loading="lazy"
                onClick={() => setImgViewer({ urls: post.image_urls, index: i })}
                style={{ width: 120, height: 120, borderRadius: R.md, objectFit: 'cover', flexShrink: 0, cursor: 'pointer' }}
              />
            ))}
          </div>
        )}

        {/* STEP3: 전문가(업체) 글 — 작성자 프로필 카드 자동 연결 */}
        {post.is_expert && (
          <div style={{ background: C.ivory, border: `1px solid ${C.bgWarm}`, borderRadius: 10, padding: 8, marginBottom: S.md }}>
            {/* 배지 + 닉네임 한 줄 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ background: '#C4A96A22', color: '#8A6D2A', border: '1px solid #C4A96A', borderRadius: R.full, padding: '1px 7px', fontSize: 10.5, fontWeight: 800 }}>⭐ 전문가</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: C.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {companyDisplayName(post.user_id, expertCompany ?? (post.expert_company_name ? { name: post.expert_company_name } : null))}
              </span>
            </div>
            {/* 공간보증 · 공간온도 · 지역 · 후기 — 한 줄 메타 */}
            {expertCompany && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4, fontSize: 11, color: C.text3, fontWeight: 600 }}>
                {(() => {
                  const bm = expertCompany.badge ? (BADGES[expertCompany.badge] ?? BADGES.basic) : null;
                  return bm ? <span style={{ color: bm.color }}>{bm.icon} 공간보증 {bm.label}</span> : null;
                })()}
                <span style={{ color: C.brand }}>🌡 {expertCompany.temp ?? 0}°</span>
                {expertCompany.region && <span>· 📍 {expertCompany.region}</span>}
                {expertReviewCount != null && <span>· ⭐ 후기 {expertReviewCount}</span>}
              </div>
            )}
            {/* 버튼 2개 한 줄 (28px) — 견적 CTA 제거(라운지는 대화→메시지 우선, 견적은 대화 내부에서만 유도) */}
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              <button onClick={() => onNavigate?.({ target: 'company', companyId: post.user_id, company: expertCompany })}
                style={{ flex: 1, height: 28, borderRadius: 8, border: `1px solid ${C.brandM}`, background: C.surface, color: '#1E3D2F', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                포트폴리오
              </button>
              <button onClick={() => {
                  console.log('[CHAT DEBUG] message button clicked', {
                    source: 'expert-card-cta', targetUserId: post.user_id, currentUserId: user?.id,
                    postId, commentId: null, role: user?.activeRole ?? user?.role, disabled: chatSent, isGuest,
                  });
                  if (isGuest) { onRequireLogin?.(); return; }
                  if (!chatSent) setShowChat(true);
                }}
                style={{ flex: 1, height: 28, borderRadius: 8, border: 'none', background: '#1E3D2F', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                메시지
              </button>
            </div>
          </div>
        )}

        {/* 카테고리별 견적 CTA 제거(Lounge CTA Simplification) — 라운지 상세에서 견적을 직접 노출하지 않고
            대화(메시지) → 대화 내부에서 견적 상담으로 유도한다. */}

        {isSynthSeed ? (
          /* 합성 seed(DB 미존재) — 읽기 전용: 조회수/공유만 */
          <div style={{ display: 'flex', gap: S.xl, alignItems: 'center', background: C.surface2, borderRadius: R.md, padding: S.md, marginTop: S.sm }}>
            <span style={{ fontSize: 12, color: C.text3 }}>👁 {viewCount.toLocaleString()}</span>
            <button onClick={handleShare} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: C.text3, padding: 0 }}>
              🔗 공유
            </button>
          </div>
        ) : (
          /* 일반 글·운영글(seed) 공통 상호작용 — 조회/좋아요(토글)/저장/공유/신고 */
          <div style={{ display: 'flex', gap: S.xl, alignItems: 'center', paddingTop: S.md, borderTop: `1px solid ${C.bgWarm}`, background: C.surface2, borderRadius: R.md, padding: S.md, marginTop: S.sm }}>
            <span style={{ fontSize: 12, color: C.text3 }}>👁 {viewCount.toLocaleString()}</span>
            <button onClick={handleLike} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: liked ? '#E53E3E' : C.text3, fontWeight: liked ? 800 : 500, padding: 0 }}>
              {liked ? '❤️' : '🤍'} {likeCount}
            </button>
            <button onClick={handleSave} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: saved ? C.gold : C.text3, padding: 0 }}>
              {saved ? '🔖' : '📄'} {saved ? '저장됨' : '저장'}
            </button>
            <button onClick={handleShare} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: C.text3, padding: 0 }}>
              🔗 공유
            </button>
            {!isOwn && (
              <button onClick={() => openReport({ type: 'post', targetId: post.id })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.text4, padding: 0, marginLeft: 'auto' }}>
                신고
              </button>
            )}
          </div>
        )}
      </div>

      {/* 메시지 신청 버튼 — 본인 글, seed 글, 게스트(비로그인)에는 숨김.
          게스트는 콘텐츠를 둘러본 뒤 '로그인하고 댓글 달기'로 자연 유입되도록
          하단 메시지 CTA 자체를 노출하지 않는다(메시지 신청은 로그인 후 기능). */}
      {!isOwn && !isSeedPost && !isGuest && (
        <div style={{ background: C.surface, padding: S.xl, marginBottom: S.sm, borderRadius: R.xl, margin: `0 8px ${S.sm}px` }}>
          <button
            onClick={() => {
              console.log('[CHAT DEBUG] message button clicked', {
                source: 'bottom-cta', targetUserId: post.user_id, currentUserId: user?.id,
                postId, commentId: null, role: user?.activeRole ?? user?.role, disabled: chatSent, isGuest,
              });
              if (isGuest) { onRequireLogin?.(); return; }
              if (!chatSent) setShowChat(true);
            }}
            disabled={chatSent}
            style={{ width: '100%', padding: S.xl, background: chatSent ? C.text4 : `linear-gradient(135deg, ${C.brand}, ${C.brandD})`, color: '#fff', border: 'none', borderRadius: R.xl, fontWeight: 800, fontSize: 15, cursor: chatSent ? 'default' : 'pointer', boxShadow: chatSent ? 'none' : `0 4px 16px ${C.brand}44`, transition: 'background 0.2s' }}>
            {isGuest ? '💬 메시지 신청하기 (로그인 필요)' : chatSent ? '✅ 신청 완료' : '💬 메시지 신청하기'}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: S.md, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text1 }}>댓글 {comments.length}개</div>
          {comments.length > 1 && (
            <div style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: C.text3 }}>최신순</div>
          )}
        </div>

        {topComments.map(comment => {
          const replies = replyComs.filter(r => r.parent_id === comment.id);
          const COLLAPSE = 2;
          const collapsed = replies.length > COLLAPSE && !expandedReplies.has(comment.id);
          const shownReplies = collapsed ? [] : replies;
          return (
          <div key={comment.id}>
            <LoungeCommentItem
              comment={comment}
              currentUserId={user?.id}
              postUserId={post?.user_id ?? null}
              companyName={comment.is_expert_reply ? companyDisplayName(comment.user_id) : null}
              onLike={(id) => { if (isGuest) { onRequireLogin?.(); return; } likeComment(id); }}
              onReply={(c) => { setReplyTo(c); inputRef.current?.focus(); }}
              onReport={(id) => openReport({ type: 'comment', targetId: id })}
              onAuthorClick={handleCommentAuthorClick}
              onCompanyClick={(c, anchor) => { setCommentAuthorSheet(null); setMiniModal({ ownerId: c.user_id, nickname: companyDisplayName(c.user_id), anchor, report: { type: 'comment', targetId: c.id } }); }}
            />
            {collapsed && (
              <button onClick={() => toggleReplies(comment.id)}
                style={{ marginLeft: 28, marginBottom: S.sm, background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 700, color: C.brand, padding: '4px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 16, height: 1, background: C.bgWarm, display: 'inline-block' }} />
                답글 {replies.length}개 더보기
              </button>
            )}
            {shownReplies.map(reply => (
              <LoungeCommentItem
                key={reply.id}
                comment={reply}
                isReply
                currentUserId={user?.id}
                postUserId={post?.user_id ?? null}
                companyName={reply.is_expert_reply ? companyDisplayName(reply.user_id) : null}
                onLike={(id) => { if (isGuest) { onRequireLogin?.(); return; } likeComment(id); }}
                onReport={(id) => openReport({ type: 'comment', targetId: id })}
                onAuthorClick={handleCommentAuthorClick}
                onCompanyClick={(c, anchor) => { setCommentAuthorSheet(null); setMiniModal({ ownerId: c.user_id, nickname: companyDisplayName(c.user_id), anchor, report: { type: 'comment', targetId: c.id } }); }}
              />
            ))}
            {!collapsed && replies.length > COLLAPSE && (
              <button onClick={() => toggleReplies(comment.id)}
                style={{ marginLeft: 28, marginBottom: S.sm, background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 700, color: C.text3, padding: '4px 0' }}>
                답글 접기
              </button>
            )}
          </div>
          );
        })}

        {comments.length === 0 && (
          <div style={{ textAlign: 'center', padding: '28px 0 24px' }}>
            <div style={{ color: C.text3, fontSize: 13, marginBottom: isCompanyUser ? 12 : 0 }}>
              {isCompanyUser ? '아직 답변이 없어요. 전문가로 첫 답변을 남겨보세요.' : '첫 답변을 남겨보세요 💬'}
            </div>
            {isCompanyUser && (
              <button onClick={() => { if (isGuest) { onRequireLogin?.(); return; } inputRef.current?.focus(); }}
                style={{ padding: '10px 20px', borderRadius: R.lg, border: 'none', background: C.brand, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                🏅 전문가로 답변하기
              </button>
            )}
          </div>
        )}
      </div>

      {/* 관련글 — SEO 내부링크 + 체류. seed 운영글은 광고형 CTA 대신 관련글/지역 링크. */}
      {relatedPosts.length > 0 && (
        <div style={{ background: C.surface, padding: `${S.xl}px ${S.xl}px 96px`, marginTop: S.sm }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: S.md }}>관련글</div>
          {relatedPosts.map((rp) => (
            <button
              key={rp.id}
              onClick={() => onOpenPost?.(rp)}
              style={{ display: 'flex', gap: S.md, alignItems: 'center', width: '100%', textAlign: 'left',
                background: 'none', border: 'none', cursor: 'pointer', padding: `${S.sm}px 0`, borderBottom: `1px solid ${C.bg}` }}>
              {rp.image_urls?.[0] && (
                <img src={rp.image_urls[0]} alt={rp.title || '관련글 이미지'} loading="lazy"
                  style={{ width: 52, height: 52, borderRadius: R.md, objectFit: 'cover', flexShrink: 0, border: `1px solid ${C.bgWarm}` }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, lineHeight: 1.4,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {rp.title || '제목 없음'}
                </div>
                <div style={{ fontSize: 12, color: C.text4, marginTop: 2 }}>
                  {CATEGORY_LABEL[rp.category] ?? rp.category} · 👁 {(rp.view_count ?? 0).toLocaleString()} · 💬 {rp.comment_count ?? 0}
                </div>
              </div>
            </button>
          ))}
          {/* seed 운영글: 광고형 견적 CTA 대신 소프트 지역 링크만 */}
          {isSeedPost && (
            <button
              onClick={() => onNavigate?.({ target: 'map' })}
              style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: S.md,
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.brand, padding: S.sm }}>
              📍 내 지역 업체 보기
            </button>
          )}
        </div>
      )}

      {/* 댓글 입력 바 */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: C.surface, borderTop: `1px solid ${C.bgWarm}`, padding: `${S.sm}px ${S.xl}px`, paddingBottom: 'env(safe-area-inset-bottom, 8px)', zIndex: 10 }}>
        {replyTo && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.brandL, borderRadius: R.sm, padding: `${S.xs}px ${S.sm}px`, marginBottom: S.xs }}>
            <span style={{ fontSize: 12, color: C.brand, fontWeight: 600 }}>↩ {replyTo.anonymous_nickname}에게 답글</span>
            <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: C.text3, padding: 0 }}>✕</button>
          </div>
        )}
        {isSynthSeed ? (
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
          sending={chatSending}
          onConfirm={handleChatRequest}
          onCancel={() => setShowChat(false)}
        />
      )}

      {miniModal && (
        <LoungeProfilePopover
          role="company"
          anchor={miniModal.anchor}
          ownerId={miniModal.ownerId}
          displayName={miniModal.nickname}
          currentUserId={user?.id}
          busy={chatRequestBusy}
          alreadySent={miniModal.ownerId ? sentChatTargets.has(miniModal.ownerId) : false}
          onClose={() => setMiniModal(null)}
          onViewPortfolio={(co) => { const id = miniModal.ownerId; onNavigate?.({ target: 'company', companyId: id, company: co }); }}
          onRequestChat={() => {
            // 메시지: 즉시 채팅방 생성 금지 → 메시지 요청(lounge_chat_requests) 생성. 정확한 상대에게 전송.
            if (isGuest) { onRequireLogin?.(); return; }
            if (miniModal.report?.type === 'comment' && miniModal.ownerId && miniModal.report?.targetId) {
              handleCommentChatRequest({ user_id: miniModal.ownerId, id: miniModal.report.targetId });
            } else if (!chatSent && ensureChatTokens()) {
              setShowChat(true);
            }
          }}
          onRequestQuote={(co) => { const id = miniModal.ownerId; onNavigate?.({ target: 'quote', companyId: id, company: co }); }}
          onReport={() => openReport({ type: miniModal.report?.type ?? 'comment', targetId: miniModal.report?.targetId })}
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

      {commentAuthorSheet && (
        <LoungeProfilePopover
          role="consumer"
          anchor={commentAuthorSheet.anchor}
          ownerId={commentAuthorSheet.comment.user_id}
          displayName={resolveConsumerIdentity(commentAuthorSheet.comment)}
          consumerProfile={authorProfile}
          currentUserId={user?.id}
          isOwn={commentAuthorSheet.comment.user_id === user?.id}
          alreadySent={commentAuthorSheet.isPostAuthor ? chatSent : sentChatTargets.has(commentAuthorSheet.comment.user_id)}
          busy={chatRequestBusy}
          onChat={commentAuthorSheet.isPostAuthor
            ? () => { if (!chatSent && ensureChatTokens()) setShowChat(true); }
            : () => handleCommentChatRequest(commentAuthorSheet.comment)}
          onReport={commentAuthorSheet.isPostAuthor
            ? () => openReport({ type: 'post', targetId: post.id })
            : () => handleCommentReportFromSheet(commentAuthorSheet.comment.id)}
          onClose={() => setCommentAuthorSheet(null)}
        />
      )}

      {showMenu && (
        <PostMenuSheet
          isOwn={isOwn}
          onEdit={() => { setShowMenu(false); if (!isOwn) return; onEditPost?.(post); }}
          onDelete={() => { setShowMenu(false); if (!isOwn) return; setShowDeleteConfirm(true); }}
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
