// ─────────────────────────────────────────────────────
// 공간마켓 라운지 — 업체 미니 포트폴리오 모달 (LOUNGE-CONVERSION-v3.1)
// 라운지 글/댓글의 "업체" 작성자 클릭 시 노출. 기존 데이터(companies/portfolios/
// reviews)만 조회한다. 전화번호/카톡/계좌/외부링크 등 직접 연락 정보는 노출 금지.
// ─────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { C, R, S } from '../../constants';
import { BADGES } from '../../constants/badges';
import { getCompanyByOwnerId, getReviews, getPortfolios, getCompanyLoungeStats } from '../../lib/supabase';
import SpaceActivityRecord from '../SpaceActivityRecord'; // v5.4.0: 공간 활동기록(Add Only)
import { resolveCompanyIdentity } from '../../utils/identityResolver';

const daysAgoLabel = (iso) => {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return '오늘';
  if (d === 1) return '어제';
  if (d < 30) return `${d}일 전`;
  if (d < 365) return `${Math.floor(d / 30)}개월 전`;
  return `${Math.floor(d / 365)}년 전`;
};

const firstPhoto = (p) => {
  const arr = p?.after_photos ?? p?.afterPhotos ?? p?.before_photos ?? p?.beforePhotos ?? p?.image_urls ?? [];
  const v = Array.isArray(arr) ? arr[0] : arr;
  return typeof v === 'string' ? v : v?.url ?? null;
};

export default function CompanyMiniPortfolioModal({
  ownerId, anonymousNickname = '업체', currentUserId,
  onClose, onRequestChat, onViewPortfolio, onRequestQuote,
}) {
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState(null);
  const [reviewCount, setReviewCount] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [stats, setStats] = useState(null); // 라운지 활동(전문가 답변/도움됐어요/작성글/댓글/최근활동)

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        getCompanyLoungeStats(ownerId).then((s) => { if (alive) setStats(s); }).catch(() => {});
        const { data: co } = await getCompanyByOwnerId(ownerId);
        if (!alive) return;
        setCompany(co ?? null);
        if (co?.id) {
          const [{ data: revs }, { data: pfs }] = await Promise.all([
            getReviews(co.id).catch(() => ({ data: null })),
            getPortfolios(co.id).catch(() => ({ data: null })),
          ]);
          if (!alive) return;
          setReviewCount(revs?.length ?? 0);
          setPhotos((pfs ?? []).map(firstPhoto).filter(Boolean).slice(0, 6));
        }
      } catch { /* graceful */ }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [ownerId]);

  const bm = company ? (BADGES[company.badge] || null) : null;
  const isSelf = currentUserId && company?.owner_id === currentUserId;

  const Btn = ({ label, primary, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled}
      style={{ flex: 1, padding: '11px', borderRadius: R.lg, border: primary ? 'none' : `1.5px solid ${C.bgWarm}`,
        background: primary ? C.brand : C.surface, color: primary ? '#fff' : C.text2,
        fontWeight: 800, fontSize: 13, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      {label}
    </button>
  );

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 600, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: C.surface, borderRadius: `${R.xl}px ${R.xl}px 0 0`, padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: '0 auto 16px' }} />

        {loading ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: C.text3, fontSize: 13 }}>불러오는 중...</div>
        ) : !company ? (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: C.text3, marginBottom: 14 }}>업체 정보가 없습니다</div>
            <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: R.lg, border: 'none', background: C.bgWarm, color: C.text2, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>닫기</button>
          </div>
        ) : (
          <>
            {/* 헤더: 익명닉네임 + 배지/온도/지역 */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: C.text1, marginBottom: 6 }}>
                {hasGuaranteeBadge(company) && <span style={{ marginRight: 4 }}>🛡️</span>}
                {/* 업체 표시명은 Identity Resolver 로 결정(display_name → anonymous_name → name → '공간파트너'). */}
                {resolveCompanyIdentity(company) || anonymousNickname}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                {bm && (
                  <span style={{ background: bm.bg, color: bm.color, borderRadius: R.full, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{bm.icon} {bm.label}</span>
                )}
                {company.temp != null && (
                  <span style={{ background: C.brandL, color: C.brand, borderRadius: R.full, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>🌡️ 공간온도 {Number(company.temp).toFixed(1)}°</span>
                )}
                {company.region && (
                  <span style={{ background: C.surface2 ?? C.bgWarm, color: C.text3, borderRadius: R.full, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>📍 {company.region}</span>
                )}
                {reviewCount != null && (
                  <span style={{ color: C.text3, fontSize: 11, fontWeight: 600 }}>후기 {reviewCount}</span>
                )}
              </div>
            </div>

            {/* 전문가 라운지 활동(count 기반) — 없는 값은 표시 생략 */}
            {stats && (stats.postCount > 0 || stats.commentCount > 0) && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {stats.postCount > 0 && (
                  <div style={{ background: C.surface2 ?? C.bgWarm, borderRadius: R.md, padding: '7px 11px' }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: C.text1 }}>{stats.postCount}</div>
                    <div style={{ fontSize: 10, color: C.text3 }}>작성글</div>
                  </div>
                )}
                {stats.commentCount > 0 && (
                  <div style={{ background: C.surface2 ?? C.bgWarm, borderRadius: R.md, padding: '7px 11px' }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: C.text1 }}>{stats.commentCount}</div>
                    <div style={{ fontSize: 10, color: C.text3 }}>댓글</div>
                  </div>
                )}
                {daysAgoLabel(stats.lastActivity) && (
                  <div style={{ background: C.surface2 ?? C.bgWarm, borderRadius: R.md, padding: '7px 11px' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: C.text1 }}>{daysAgoLabel(stats.lastActivity)}</div>
                    <div style={{ fontSize: 10, color: C.text3 }}>최근 활동</div>
                  </div>
                )}
              </div>
            )}

            {/* v5.4.0: 공간 활동기록 — 실데이터 집계(없으면 빈 상태 안내) */}
            <SpaceActivityRecord ownerId={ownerId} companyId={company.id} />

            {/* 대표 시공사례 / 최근 포트폴리오 사진 */}
            {photos.length > 0 ? (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, scrollbarWidth: 'none' }}>
                {photos.map((src, i) => (
                  <img key={i} src={src} alt="" loading="lazy"
                    style={{ width: 110, height: 110, borderRadius: R.lg, objectFit: 'cover', flexShrink: 0, border: `1px solid ${C.bgWarm}` }} />
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: C.text4, marginBottom: 16 }}>등록된 시공사례 사진이 없습니다</div>
            )}

            {/* 버튼: 포트폴리오 보기 / 메시지 신청 — 견적 CTA 제거(라운지는 메시지 우선, 견적은 대화 내부에서 유도) */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <Btn label="포트폴리오 보기" onClick={() => onViewPortfolio?.(company)} />
              <Btn label="메시지 신청" primary disabled={isSelf} onClick={() => onRequestChat?.(company)} />
            </div>
            <div style={{ fontSize: 11, color: C.text4, textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
              메시지 신청 후 업체가 수락하면 20토큰이 차감되고 대화방이 열립니다.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function hasGuaranteeBadge(co) {
  return co?.guarantee_badge_visible === true && co?.guarantee_status === 'ACTIVE';
}
