// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { C, R, S } from '../../constants';
import { SPACE_TEMPERATURE_BASE, TOKEN_EARN, CATEGORY_LABEL } from '../../constants/lounge';
import { formatRelativeTime } from '../../utils/anonymousNickname';
import {
  IS_SUPABASE_READY,
  getMyLoungePosts,
  softDeleteLoungePost,
  supabase,
} from '../../lib/supabase';

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

      {import.meta.env.DEV && <DevPanel info={devInfo} />}

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

// ── 대화 신청 내역 ─────────────────────────────────
function ChatHistoryScreen({ onBack }) {
  const requests = readLS('lounge_chat_requests');

  const statusLabel = (req) => {
    const ms = Date.now() - new Date(req.sentAt).getTime();
    if (ms < 5 * 60 * 1000) return { label: '대기중', color: C.gold };
    if (ms < 24 * 60 * 60 * 1000 && Math.random() > 0.5) return { label: '수락됨', color: C.brand };
    return { label: '대기중', color: C.gold };
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <SubHeader title="대화 신청 내역" onBack={onBack} />
      <div style={{ background: C.brandL, padding: `${S.sm}px ${S.xl}px`, borderBottom: `1px solid ${C.brandM}` }}>
        <div style={{ fontSize: 11, color: C.brand }}>💬 상대방 수락 시 20토큰이 차감됩니다</div>
      </div>
      {requests.length === 0 ? (
        <EmptyState icon="💬" title="보낸 대화 신청이 없어요" desc={'라운지 게시글에서 대화를 신청하면\n여기서 진행 상황을 확인할 수 있어요'} />
      ) : (
        <div style={{ background: C.surface }}>
          {requests.map((r, i) => {
            const st = statusLabel(r);
            return (
              <div key={i} style={{ padding: `${S.lg}px ${S.xl}px`, borderBottom: `1px solid ${C.bgWarm}`, display: 'flex', alignItems: 'center', gap: S.md }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.brandL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>💬</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, marginBottom: 2 }}>
                    {r.postTitle ?? '게시글'}
                  </div>
                  <div style={{ fontSize: 11, color: C.text3 }}>{formatRelativeTime(r.sentAt)} · {r.nickname ?? '익명'}</div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: st.color, background: `${st.color}18`, padding: '4px 10px', borderRadius: R.full }}>{st.label}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 커뮤니티 미션 ────────────────────────────────────
const MISSIONS = [
  { key: 'FIRST_POST',           label: '첫 글 작성',         desc: '라운지에 첫 게시글을 올려보세요',    reward: TOKEN_EARN.FIRST_POST,           icon: '📝', once: true },
  { key: 'FIRST_COMMENT',        label: '첫 댓글 작성',        desc: '다른 사람 글에 첫 댓글을 남겨보세요', reward: TOKEN_EARN.FIRST_COMMENT,         icon: '💬', once: true },
  { key: 'PROFILE_COMPLETE',     label: '프로필 완성',         desc: '이름·지역 정보를 완성해보세요',       reward: TOKEN_EARN.PROFILE_COMPLETE,      icon: '✅', once: true },
  { key: 'WEEKLY_ACTIVITY',      label: '이번 주 활동 미션',   desc: '이번 주 라운지에 3번 이상 활동하기', reward: TOKEN_EARN.WEEKLY_ACTIVITY,       icon: '🔥', once: false },
  { key: 'CONSTRUCTION_REVIEW',  label: '공사 후기 작성',      desc: '완료된 공사 후기를 남겨보세요',       reward: TOKEN_EARN.CONSTRUCTION_REVIEW,   icon: '🏗', once: true },
];

function MissionsScreen({ tokenLogs, onBack }) {
  const completed = new Set((tokenLogs ?? []).map(l => l.action?.toUpperCase()));

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
          const done = m.once && completed.has(m.key);
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
                {!m.once && <div style={{ fontSize: 9, color: C.gold, fontWeight: 700 }}>매주</div>}
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
function NotifSettings() {
  const load = (key, def) => { try { return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(def)); } catch { return def; } };

  const [enabled,    setEnabled]  = useState(() => load('lounge_notif_enabled', false));
  const [selected,   setSelected] = useState(() => load('lounge_notif_cats', []));
  const [permStatus, setPermStatus] = useState(() => typeof Notification !== 'undefined' ? Notification.permission : 'default');
  const [toast,      setToast]    = useState(null);

  const CATS = [
    { id: 'interior', label: '인테리어' }, { id: 'room_deco', label: '집꾸미기' },
    { id: 'worry', label: '고민' },        { id: 'daily', label: '생활' },
    { id: 'chat', label: '대화해요' },      { id: 'realestate', label: '부동산' },
    { id: 'stock', label: '주식' },        { id: 'humor', label: '유머' },
    { id: 'pet', label: '반려동물' },       { id: 'exercise', label: '운동' },
    { id: 'startup', label: '창업' },      { id: 'travel', label: '여행' },
    { id: 'game', label: '게임' },         { id: 'local', label: '동네' },
    { id: 'food', label: '맛집' },
  ];

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const toggleCat = (id) => {
    const next = selected.includes(id) ? selected.filter(c => c !== id) : [...selected, id];
    setSelected(next);
    localStorage.setItem('lounge_notif_cats', JSON.stringify(next));
  };

  const handleToggle = async () => {
    if (!enabled && permStatus !== 'granted') {
      if (!('Notification' in window)) { showToast('이 브라우저는 알림을 지원하지 않아요'); return; }
      if (permStatus === 'denied') { showToast('브라우저 설정에서 알림을 허용해주세요'); return; }
      const perm = await Notification.requestPermission();
      setPermStatus(perm);
      if (perm !== 'granted') { showToast('알림 권한이 거부됐어요'); return; }
    }
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem('lounge_notif_enabled', JSON.stringify(next));
    showToast(next ? '✅ 알림을 켰어요!' : '알림을 껐어요');
  };

  return (
    <div style={{ background: C.bg, borderRadius: R.lg, padding: S.lg, marginBottom: S.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: S.md }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>📱 새 글 알림</div>
          <div style={{ fontSize: 11, color: C.text3, marginTop: 2 }}>
            {permStatus === 'denied' ? '브라우저에서 알림 차단됨' : enabled ? '선택한 카테고리 새 글 알림 중' : '알림을 켜보세요'}
          </div>
        </div>
        <div onClick={handleToggle} style={{ width: 48, height: 26, borderRadius: 13, background: enabled ? C.brand : C.bgWarm, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: 3, left: enabled ? 25 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
        </div>
      </div>
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
    <div onClick={onClick} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${S.lg}px 0`, borderBottom: `1px solid ${C.bg}`, cursor: onClick ? 'pointer' : 'default' }}>
      <span style={{ fontSize: 14, color: C.text2 }}>{icon} {label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: S.sm }}>
        {count !== undefined && <span style={{ fontSize: 12, color: C.text4 }}>{count}</span>}
        {onClick && <span style={{ fontSize: 16, color: C.text3 }}>›</span>}
      </div>
    </div>
  );
}

// ── 메인 섹션 ──────────────────────────────────────────
export default function LoungeMyPageSection({
  user, temperature, balance, tokenLogs, myPosts,
  onNavigate, onEditPost, onDeletePost, refreshKey = 0,
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
  const chatCount    = readLS('lounge_chat_requests').length;
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
  if (subScreen === 'chat-history') return <ChatHistoryScreen onBack={() => setSubScreen(null)} />;
  if (subScreen === 'missions')     return <MissionsScreen   tokenLogs={tokenLogs} onBack={() => setSubScreen(null)} />;
  if (subScreen === 'privacy')      return <PrivacyScreen    onBack={() => setSubScreen(null)} />;
  if (subScreen === 'blocks')       return <BlocksScreen     onBack={() => setSubScreen(null)} />;

  return (
    <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.bgWarm}` }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text1, marginBottom: S.lg }}>라운지</div>

      {/* 공간온도 */}
      <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.xl, marginBottom: S.lg, border: `1px solid ${C.brandM}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: S.sm }}>
          <div>
            <div style={{ fontSize: 13, color: C.text3, marginBottom: 4 }}>공간온도 🌡️</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.brand }}>{temp.toFixed(1)}°C</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20 }}>{level.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.brand, marginTop: 4 }}>{level.label}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: S.md, marginTop: S.sm }}>
          {[['98%','후기 신뢰도'], ['92%','재계약률'], ['빠름','응답속도']].map(([v, l]) => (
            <div key={l} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>{v}</div>
              <div style={{ fontSize: 10, color: C.text3 }}>{l}</div>
            </div>
          ))}
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
        <NotifSettings />
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
