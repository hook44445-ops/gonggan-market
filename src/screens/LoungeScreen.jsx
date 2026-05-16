// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
//
// 라운지는 단순 커뮤니티 게시판이 아닙니다.
// 사람이 머무는 공간 안에서 신뢰가 생기고,
// 그 신뢰가 거래로 이어지는 구조입니다.
//
// 흐름:
// 라운지 → 신뢰 형성 → 대화 연결 → 견적 상담 → 거래 → 후기 → 재계약
//
// 익명 = 자유로운 소통의 보호막
// 토큰 = 진짜 관심과 가벼운 접근을 구분하는 장치
// 공간온도 = 쌓인 신뢰의 증명
// ─────────────────────────────────────────────────────

import { useState } from 'react';
import { C, R, S } from '../constants';
import { useLounge } from '../hooks/useLounge';
import LoungeCategoryTabs from '../components/lounge/LoungeCategoryTabs';
import LoungeStoryBar from '../components/lounge/LoungeStoryBar';
import LoungePostCard from '../components/lounge/LoungePostCard';

export default function LoungeScreen({ user, onPostClick, onWrite, onStoryUpload }) {
  const [category, setCategory] = useState('all');
  const [showWriteOptions, setShowWriteOptions] = useState(false);
  const { posts, stories, loading } = useLounge(category);

  const isLoggedIn = !!user?.id;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 90 }}>
      <div style={{ background: C.surface, position: 'sticky', top: 0, zIndex: 10, borderBottom: `1px solid ${C.bgWarm}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `14px ${S.xl}px 0` }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.text1, letterSpacing: '-0.5px' }}>라운지</div>
          <div style={{ display: 'flex', gap: S.md }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.text2 }}>🔍</button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: C.text2 }}>🔔</button>
          </div>
        </div>
        <LoungeCategoryTabs selected={category} onChange={setCategory} />
      </div>

      <LoungeStoryBar stories={stories} onStoryClick={() => {}} />

      <div style={{ padding: `${S.md}px ${S.xl}px` }}>
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
          posts.map(post => (
            <LoungePostCard key={post.id} post={post} onClick={() => {
              if (!isLoggedIn) {
                onPostClick?.(post);
                return;
              }
              onPostClick?.(post);
            }} />
          ))
        )}
      </div>

      {isLoggedIn && (
        <button onClick={() => setShowWriteOptions(true)} style={{
          position: 'fixed', right: S.xl, bottom: 80, width: 56, height: 56,
          borderRadius: R.full, background: C.brand, color: '#fff',
          border: 'none', fontSize: 24, cursor: 'pointer',
          boxShadow: `0 4px 16px ${C.brand}66`, zIndex: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>+</button>
      )}

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
    </div>
  );
}
