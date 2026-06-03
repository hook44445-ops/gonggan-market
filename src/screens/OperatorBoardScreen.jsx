// ─────────────────────────────────────────────────────
// 운영자 게시판 관리 (operator/admin 전용 · 최소 기능)
//   · 추천글 등록/해제 (is_hot)
//   · 글 숨김/복구 (is_hidden, soft)
//   · 댓글 숨김/복구 (is_hidden, soft)
//   모든 액션은 RPC 경유 → 서버에서 권한 검증 + 로그.
// ─────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { C, R, S } from '../constants';
import {
  IS_SUPABASE_READY,
  getModeratorLoungePosts,
  getModeratorLoungeComments,
  rpcSetPostHot,
  rpcSetPostHidden,
  rpcSetCommentHidden,
} from '../lib/supabase';
import { CATEGORY_LABEL } from '../constants/lounge';

const btn = (active) => ({
  background: active ? C.brand : C.surface,
  color: active ? '#fff' : C.text2,
  border: `1px solid ${active ? C.brand : C.bgWarm}`,
  borderRadius: R.full, padding: '5px 10px', fontSize: 12, fontWeight: 700,
  cursor: 'pointer', flexShrink: 0,
});

export default function OperatorBoardScreen({ user, onBack, onOpenPost }) {
  const actorId = user?.id ?? null;
  const [posts, setPosts]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(null);
  const [toast, setToast]     = useState(null);
  const [openId, setOpenId]   = useState(null);
  const [comments, setComments] = useState({}); // postId -> [comment]

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const load = useCallback(async () => {
    if (!IS_SUPABASE_READY) { setLoading(false); return; }
    setLoading(true);
    const { data } = await getModeratorLoungePosts(60);
    setPosts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const patchPost = (id, updates) =>
    setPosts(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));

  const toggleHot = async (p) => {
    setBusy(p.id);
    const next = !p.is_hot;
    const { error } = await rpcSetPostHot(p.id, next, next ? 1 : 0, actorId);
    setBusy(null);
    if (error) { showToast('권한이 없거나 처리에 실패했어요'); return; }
    patchPost(p.id, { is_hot: next });
    showToast(next ? '🔥 추천글로 등록했어요' : '추천글에서 해제했어요');
  };

  const togglePostHidden = async (p) => {
    setBusy(p.id);
    const next = !p.is_hidden;
    const { error } = await rpcSetPostHidden(p.id, next, actorId);
    setBusy(null);
    if (error) { showToast('권한이 없거나 처리에 실패했어요'); return; }
    patchPost(p.id, { is_hidden: next });
    showToast(next ? '글을 숨겼어요' : '글을 복구했어요');
  };

  const openComments = async (p) => {
    if (openId === p.id) { setOpenId(null); return; }
    setOpenId(p.id);
    if (!comments[p.id]) {
      const { data } = await getModeratorLoungeComments(p.id);
      setComments(prev => ({ ...prev, [p.id]: data ?? [] }));
    }
  };

  const toggleCommentHidden = async (postId, c) => {
    setBusy(c.id);
    const next = !c.is_hidden;
    const { error } = await rpcSetCommentHidden(c.id, next, actorId);
    setBusy(null);
    if (error) { showToast('권한이 없거나 처리에 실패했어요'); return; }
    setComments(prev => ({
      ...prev,
      [postId]: (prev[postId] ?? []).map(x => (x.id === c.id ? { ...x, is_hidden: next } : x)),
    }));
    showToast(next ? '댓글을 숨겼어요' : '댓글을 복구했어요');
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif" }}>
      <div style={{ background: C.surface, padding: '14px 18px', borderBottom: `1px solid ${C.bgWarm}`,
        position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: S.md }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.text1, padding: 0 }}>←</button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.text1 }}>🛡️ 운영자 게시판 관리</div>
          <div style={{ fontSize: 11, color: C.text4 }}>추천글 · 글/댓글 숨김 (soft)</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: C.text3 }}>불러오는 중...</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.text3, fontSize: 13 }}>관리할 글이 없습니다</div>
      ) : (
        <div style={{ padding: `${S.md}px ${S.lg}px 100px` }}>
          {posts.map(p => (
            <div key={p.id} style={{ background: C.surface, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: S.md, marginBottom: S.sm,
              opacity: p.is_hidden ? 0.6 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{ background: C.brandL, color: C.brand, borderRadius: R.full, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
                  {CATEGORY_LABEL[p.category] ?? p.category}
                </span>
                {p.is_seed && <span style={{ background: C.bgWarm, color: C.text3, borderRadius: R.full, padding: '1px 7px', fontSize: 10, fontWeight: 600 }}>운영</span>}
                {p.is_hot && <span style={{ fontSize: 11 }}>🔥</span>}
                {p.is_hidden && <span style={{ background: C.bgWarm, color: C.text3, borderRadius: R.full, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>숨김</span>}
              </div>
              <button onClick={() => onOpenPost?.(p)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text1, lineHeight: 1.4 }}>
                  {p.title || (p.content ?? '').slice(0, 40)}
                </span>
              </button>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <button disabled={busy === p.id} onClick={() => toggleHot(p)} style={btn(p.is_hot)}>{p.is_hot ? '🔥 추천 해제' : '🔥 추천 등록'}</button>
                <button disabled={busy === p.id} onClick={() => togglePostHidden(p)} style={btn(p.is_hidden)}>{p.is_hidden ? '복구' : '숨김'}</button>
                <button onClick={() => openComments(p)} style={btn(openId === p.id)}>💬 댓글 {p.comment_count ?? 0}</button>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: C.text4 }}>👁 {(p.view_count ?? 0).toLocaleString()}</span>
              </div>

              {openId === p.id && (
                <div style={{ marginTop: S.sm, paddingTop: S.sm, borderTop: `1px solid ${C.bg}` }}>
                  {(comments[p.id] ?? []).length === 0 ? (
                    <div style={{ fontSize: 12, color: C.text4, padding: '6px 0' }}>댓글이 없습니다</div>
                  ) : (
                    (comments[p.id] ?? []).map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: S.sm, padding: '6px 0', borderBottom: `1px solid ${C.bg}`, opacity: c.is_hidden ? 0.55 : 1 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: C.text3, fontWeight: 600 }}>{c.anonymous_nickname}{c.is_hidden ? ' · 숨김' : ''}</div>
                          <div style={{ fontSize: 13, color: C.text1, lineHeight: 1.4 }}>{c.content}</div>
                        </div>
                        <button disabled={busy === c.id} onClick={() => toggleCommentHidden(p.id, c)} style={btn(c.is_hidden)}>{c.is_hidden ? '복구' : '숨김'}</button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: C.text1, color: '#fff', padding: '10px 18px', borderRadius: R.full, fontSize: 13, fontWeight: 600, zIndex: 100 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
