// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState } from 'react';
import { C, R, S } from '../constants';

export default function LoungeStoryUploadScreen({ user, onBack, onPublish }) {
  const [text,       setText]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const newStory = {
      id:                 `story-${Date.now()}`,
      user_id:            user?.id ?? null,
      anonymous_nickname: '날쌘다람쥐',
      content:            text.trim(),
      image_urls:         [],
      is_story:           true,
      story_expires_at:   expiresAt.toISOString(),
      created_at:         now.toISOString(),
      category:           'daily',
      view_count:         0,
      like_count:         0,
      comment_count:      0,
    };

    await new Promise(r => setTimeout(r, 300));
    setSubmitting(false);
    onPublish?.(newStory);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.text1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `14px ${S.xl}px`, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#fff', padding: 0 }}>✕</button>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>스토리</div>
        <button onClick={handleSubmit} disabled={submitting || !text.trim()} style={{ background: C.brand, color: '#fff', border: 'none', borderRadius: R.full, padding: '8px 18px', fontWeight: 800, fontSize: 14, cursor: submitting || !text.trim() ? 'not-allowed' : 'pointer', opacity: submitting || !text.trim() ? 0.6 : 1 }}>
          {submitting ? '올리는중...' : '공유'}
        </button>
      </div>

      <div style={{ padding: S.xl, display: 'flex', flexDirection: 'column', gap: S.xl, minHeight: '60vh' }}>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: R.xl, padding: 40, minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(255,255,255,0.2)', cursor: 'pointer' }}>
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>사진 추가</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>탭하여 사진을 선택하세요</div>
          </div>
        </div>

        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="스토리에 텍스트를 추가하세요 (선택)" rows={4}
          style={{ padding: '14px 16px', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: R.lg, fontSize: 15, outline: 'none', resize: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', fontFamily: 'inherit', lineHeight: 1.6 }} />

        <div style={{ background: 'rgba(46,95,75,0.3)', borderRadius: R.lg, padding: S.md, border: `1px solid ${C.brandM}66` }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
            ⏰ 스토리는 <strong style={{ color: '#fff' }}>24시간</strong> 후 자동으로 사라집니다.<br/>
            🛡 익명으로 게시되며, 실명/연락처는 표시되지 않습니다.
          </div>
        </div>
      </div>
    </div>
  );
}
