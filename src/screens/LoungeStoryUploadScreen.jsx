// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState, useRef } from 'react';
import { C, R, S } from '../constants';
import { getAnonymousNickname } from '../utils/anonymousNickname';
import { IS_SUPABASE_READY, createLoungeStory, uploadLoungeImage } from '../lib/supabase';

const MAX_SIZE_MB = 5;

export default function LoungeStoryUploadScreen({ user, onBack, onPublish }) {
  const [photos,     setPhotos]     = useState([]);   // { file: File, url: string }[]
  const [text,       setText]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  const canSubmit = photos.length > 0 || text.trim().length > 0;

  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files);
    const valid = [];
    for (const f of files) {
      if (!f.type.startsWith('image/')) {
        setUploadError('이미지 파일만 업로드할 수 있어요');
        continue;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        setUploadError(`파일 크기는 ${MAX_SIZE_MB}MB 이하로 올려주세요`);
        continue;
      }
      valid.push({ file: f, url: URL.createObjectURL(f) });
    }
    setPhotos(prev => [...prev, ...valid].slice(0, 5));
    if (valid.length) setUploadError('');
    e.target.value = '';
  };

  const removePhoto = (idx) => {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    const useSupabase = IS_SUPABASE_READY && !user?.isGuest && !!user?.id;

    const now     = new Date();
    // UUID 생성 — Supabase lounge_posts.id 는 uuid 타입
    const storyId = crypto.randomUUID();
    const nickname = getAnonymousNickname(user?.id ?? 'guest', storyId);

    // 이미지 처리: Supabase → Storage public URL, 오프라인 → blob URL
    let imageUrls;
    if (useSupabase && photos.length > 0) {
      const results = await Promise.all(photos.map(async (p) => {
        const { data: up, error: upErr } = await uploadLoungeImage(p.file, user.id);
        if (upErr) return p.url; // Storage 실패 시 blob URL fallback
        return up.publicUrl;
      }));
      imageUrls = results;
    } else {
      imageUrls = photos.map(p => p.url); // blob URL (세션 내 유효)
    }

    const newStory = {
      id:                 storyId,
      user_id:            user?.id ?? null,
      anonymous_nickname: nickname,
      content:            text.trim(),
      image_urls:         imageUrls,
      is_story:           true,
      story_expires_at:   new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      created_at:         now.toISOString(),
      category:           'daily',
      view_count:         0,
      like_count:         0,
      comment_count:      0,
    };

    if (useSupabase) {
      const { data, error: err } = await createLoungeStory(newStory);
      setSubmitting(false);
      if (err) { setUploadError('업로드 중 오류가 발생했어요. 다시 시도해주세요.'); return; }
      onPublish?.(data ?? newStory);
    } else {
      try {
        const key = 'lounge_offline_stories';
        const prev = JSON.parse(localStorage.getItem(key) ?? '[]');
        localStorage.setItem(key, JSON.stringify([newStory, ...prev.filter(s => s.id !== newStory.id)]));
      } catch {}
      await new Promise(r => setTimeout(r, 300));
      setSubmitting(false);
      onPublish?.(newStory);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `14px ${S.xl}px`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#fff', padding: 0 }}>✕</button>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>스토리</div>
        <button
          onClick={handleSubmit}
          disabled={submitting || !canSubmit}
          style={{
            background: canSubmit ? C.brand : 'rgba(255,255,255,0.2)',
            color: '#fff', border: 'none', borderRadius: R.full,
            padding: '8px 20px', fontWeight: 800, fontSize: 14,
            cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
            opacity: submitting ? 0.7 : 1, transition: 'background 0.2s',
          }}>
          {submitting ? '올리는 중...' : '공유'}
        </button>
      </div>

      {/* 사진 영역 */}
      <div style={{ flex: 1, padding: `0 ${S.xl}px`, display: 'flex', flexDirection: 'column', gap: S.md }}>

        {/* 사진 없을 때: 업로드 버튼 */}
        {photos.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'rgba(255,255,255,0.06)',
              borderRadius: R.xl,
              minHeight: 280,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px dashed rgba(255,255,255,0.2)',
              cursor: 'pointer',
              flexDirection: 'column', gap: 12,
            }}>
            <div style={{ fontSize: 48 }}>📷</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: 700 }}>사진 추가</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>탭하여 갤러리에서 선택 (최대 5장)</div>
          </div>
        ) : (
          /* 사진 미리보기 그리드 */
          <div>
            {/* 메인 사진 (첫 번째) */}
            <div style={{ position: 'relative', borderRadius: R.xl, overflow: 'hidden', marginBottom: 6 }}>
              <img
                src={photos[0].url}
                alt=""
                style={{ width: '100%', maxHeight: 340, objectFit: 'cover', display: 'block' }}
              />
              <button onClick={() => removePhoto(0)} style={{
                position: 'absolute', top: 8, right: 8,
                background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                width: 28, height: 28, color: '#fff', fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>

            {/* 추가 사진 썸네일 행 */}
            {photos.length > 1 && (
              <div style={{ display: 'flex', gap: 6 }}>
                {photos.slice(1).map((p, i) => (
                  <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={p.url} alt="" style={{ width: 72, height: 72, borderRadius: R.md, objectFit: 'cover', display: 'block' }} />
                    <button onClick={() => removePhoto(i + 1)} style={{
                      position: 'absolute', top: 2, right: 2,
                      background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                      width: 20, height: 20, color: '#fff', fontSize: 10, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>✕</button>
                  </div>
                ))}
                {/* 사진 추가 버튼 (5장 미만일 때) */}
                {photos.length < 5 && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: 72, height: 72, borderRadius: R.md,
                      border: '2px dashed rgba(255,255,255,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', flexShrink: 0,
                    }}>
                    +
                  </div>
                )}
              </div>
            )}

            {/* 사진 1장일 때 추가 버튼 */}
            {photos.length === 1 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: 72, height: 72, borderRadius: R.md,
                    border: '2px dashed rgba(255,255,255,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                  }}>
                  +
                </div>
              </div>
            )}
          </div>
        )}

        {/* 텍스트 입력 */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="스토리에 글을 추가하세요 (선택)"
          rows={3}
          style={{
            padding: '14px 16px',
            border: '1.5px solid rgba(255,255,255,0.15)',
            borderRadius: R.lg, fontSize: 14, outline: 'none', resize: 'none',
            background: 'rgba(255,255,255,0.07)', color: '#fff',
            fontFamily: 'inherit', lineHeight: 1.6,
          }}
        />

        {/* 업로드 오류 */}
        {uploadError && (
          <div style={{ background: 'rgba(229,62,62,0.15)', borderRadius: R.lg, padding: S.md, border: '1px solid rgba(229,62,62,0.3)' }}>
            <div style={{ fontSize: 12, color: '#ff6b6b', fontWeight: 700 }}>{uploadError}</div>
          </div>
        )}

        {/* 안내 */}
        <div style={{ background: 'rgba(46,95,75,0.3)', borderRadius: R.lg, padding: S.md, border: `1px solid ${C.brandM}55` }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
            ⏰ 스토리는 <strong style={{ color: '#fff' }}>24시간</strong> 후 자동으로 사라집니다.<br />
            🛡 익명으로 게시되며, 실명/연락처는 표시되지 않습니다.
          </div>
        </div>
      </div>

      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handlePhotoSelect}
        style={{ display: 'none' }}
      />

      <div style={{ height: 32 }} />
    </div>
  );
}
