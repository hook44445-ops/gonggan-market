// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
//
// 라운지는 단순 커뮤니티 게시판이 아닙니다.
// 사람이 머무는 공간 안에서 신뢰가 생기고,
// 그 신뢰가 거래로 이어지는 구조입니다.
// ─────────────────────────────────────────────────────

import { useState } from 'react';
import { C, R, S, REGIONS } from '../constants';
import { LOUNGE_CATEGORIES } from '../constants/lounge';
import { getAnonymousNickname } from '../utils/anonymousNickname';

const WRITABLE_CATS = LOUNGE_CATEGORIES.filter(c => c.group !== null);

export default function LoungeWriteScreen({ user, onBack, onPublish }) {
  const [category, setCategory] = useState('');
  const [title,    setTitle]    = useState('');
  const [content,  setContent]  = useState('');
  const [region,   setRegion]   = useState('');
  const [gender,   setGender]   = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async () => {
    if (!category) { setError('카테고리를 선택해주세요'); return; }
    if (!content.trim()) { setError('내용을 입력해주세요'); return; }

    setSubmitting(true);
    const postId = `post-${Date.now()}`;
    const nickname = getAnonymousNickname(user?.id ?? 'guest', postId);

    const newPost = {
      id:                 postId,
      user_id:            user?.id ?? null,
      anonymous_nickname: nickname,
      category,
      title:              title.trim() || null,
      content:            content.trim(),
      image_urls:         [],
      gender:             gender || null,
      age_group:          ageGroup || null,
      region:             region || null,
      is_story:           false,
      view_count:         0,
      like_count:         0,
      comment_count:      0,
      created_at:         new Date().toISOString(),
    };

    await new Promise(r => setTimeout(r, 300));
    setSubmitting(false);
    onPublish?.(newPost);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{ background: C.surface, padding: `14px ${S.xl}px`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.bgWarm}`, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.text1, padding: 0 }}>←</button>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>글쓰기</div>
        <button onClick={handleSubmit} disabled={submitting} style={{ background: C.brand, color: '#fff', border: 'none', borderRadius: R.full, padding: '8px 18px', fontWeight: 800, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
          {submitting ? '등록중...' : '등록'}
        </button>
      </div>

      <div style={{ padding: S.xl }}>
        <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.md, marginBottom: S.xl, border: `1px solid ${C.brandM}` }}>
          <div style={{ fontSize: 12, color: C.brand, lineHeight: 1.6 }}>
            🛡 글 작성 시 익명 아이디가 자동 배정됩니다.<br/>
            같은 글의 댓글에서는 동일 익명이 유지됩니다.<br/>
            다른 글에서는 새로운 닉네임이 배정됩니다.
          </div>
        </div>

        <div style={{ marginBottom: S.xl }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: S.sm }}>카테고리 <span style={{ color: C.red }}>*</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: S.sm }}>
            {WRITABLE_CATS.map(cat => (
              <button key={cat.id} onClick={() => setCategory(cat.id)} style={{ padding: '6px 14px', borderRadius: R.full, border: 'none', background: category === cat.id ? C.brand : C.bg, color: category === cat.id ? '#fff' : C.text3, fontWeight: category === cat.id ? 800 : 500, fontSize: 13, cursor: 'pointer' }}>
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: S.lg }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: S.sm }}>제목 (선택)</div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="제목을 입력하세요" maxLength={100}
            style={{ width: '100%', padding: '14px 16px', border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 15, outline: 'none', boxSizing: 'border-box', background: C.surface, color: C.text1, fontFamily: 'inherit' }} />
        </div>

        <div style={{ marginBottom: S.lg }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text2, marginBottom: S.sm }}>내용 <span style={{ color: C.red }}>*</span></div>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="무슨 이야기를 나눠볼까요?" rows={8}
            style={{ width: '100%', padding: '14px 16px', border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 14, outline: 'none', resize: 'vertical', boxSizing: 'border-box', background: C.surface, color: C.text1, fontFamily: 'inherit', lineHeight: 1.6 }} />
        </div>

        <div style={{ display: 'flex', gap: S.sm, marginBottom: S.lg, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: S.xs }}>지역 (선택)</div>
            <select value={region} onChange={e => setRegion(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, background: C.surface, color: region ? C.text1 : C.text3, fontFamily: 'inherit', outline: 'none' }}>
              <option value="">선택 안함</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 100 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: S.xs }}>성별 (선택)</div>
            <select value={gender} onChange={e => setGender(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, background: C.surface, color: gender ? C.text1 : C.text3, fontFamily: 'inherit', outline: 'none' }}>
              <option value="">비공개</option>
              <option value="male">남</option>
              <option value="female">여</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 100 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text3, marginBottom: S.xs }}>나이대 (선택)</div>
            <select value={ageGroup} onChange={e => setAgeGroup(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.bgWarm}`, borderRadius: R.md, fontSize: 13, background: C.surface, color: ageGroup ? C.text1 : C.text3, fontFamily: 'inherit', outline: 'none' }}>
              <option value="">비공개</option>
              {['20대','30대','40대','50대+'].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div style={{ background: '#FEF0F0', borderRadius: R.lg, padding: S.md, marginBottom: S.lg }}>
            <div style={{ fontSize: 13, color: C.red, fontWeight: 700 }}>{error}</div>
          </div>
        )}
      </div>
    </div>
  );
}
