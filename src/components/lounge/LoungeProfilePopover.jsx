// ════════════════════════════════════════════════════════════════════════════
// LoungeProfilePopover — 라운지 작성자(닉네임) 클릭 시 닉네임 옆 초미니 팝오버
//   · 풀스크린 모달/바텀시트 금지 → 앵커(클릭 요소) 옆 작은 카드형 말풍선.
//   · X 버튼 없음. 바깥 클릭 / 스크롤 / 다른 닉네임 클릭 / 뒤로가기 / 내부 버튼 클릭 시 닫힘.
//   · 역할 분리: company(거래 중심) / consumer(신뢰 중심).
//   · 기존 데이터/identityResolver 재사용. DB/스키마/저장 로직 무변경(읽기 전용).
// ════════════════════════════════════════════════════════════════════════════
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { C, R } from '../../constants';
import { BADGES } from '../../constants/badges';
import { getCompanyByOwnerId } from '../../lib/supabase';
import { getSpaceActivityRecord } from '../../lib/spaceActivity';
import { getAnonymousAvatarByNickname } from '../../utils/anonymousNickname';
import { resolveCompanyIdentity } from '../../utils/identityResolver';

const W = 248; // 초미니 팝오버 폭

const joinPeriod = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 1) return '오늘 가입';
  if (days < 30) return `가입 ${days}일째`;
  const m = Math.floor(days / 30);
  if (m < 12) return `가입 ${m}개월째`;
  return `가입 ${Math.floor(days / 365)}년째`;
};

const daysAgo = (iso) => {
  if (!iso) return null;
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (Number.isNaN(d)) return null;
  if (d <= 0) return '오늘';
  if (d === 1) return '어제';
  if (d < 30) return `${d}일 전`;
  if (d < 365) return `${Math.floor(d / 30)}개월 전`;
  return `${Math.floor(d / 365)}년 전`;
};

const hasGuaranteeBadge = (co) => co?.guarantee_badge_visible === true && co?.guarantee_status === 'ACTIVE';

export default function LoungeProfilePopover({
  role, anchor, ownerId, displayName, currentUserId,
  consumerProfile = null,            // { spaceTemp, joinedAt }
  alreadySent = false, busy = false, isOwn = false,
  onClose,
  onViewPortfolio, onRequestChat, onRequestQuote, // company
  onChat,                                          // consumer 대화 신청
  onReport,                                         // 공통 신고
}) {
  const cardRef = useRef(null);
  const [company, setCompany] = useState(null);
  const [rec, setRec] = useState(null);
  const [pos, setPos] = useState(null);

  // 데이터 로드(읽기 전용) — company: 업체정보 + 활동집계 / consumer: 활동집계
  useEffect(() => {
    let alive = true;
    if (role === 'company') {
      getCompanyByOwnerId(ownerId).then(({ data: co }) => {
        if (!alive) return;
        setCompany(co ?? null);
        getSpaceActivityRecord({ ownerId, companyId: co?.id ?? null })
          .then((r) => { if (alive) setRec(r); }).catch(() => {});
      }).catch(() => {});
    } else {
      getSpaceActivityRecord({ ownerId })
        .then((r) => { if (alive) setRec(r); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [role, ownerId]);

  // 닫기 트리거: 바깥 클릭(오버레이) / 스크롤 / 뒤로가기
  useEffect(() => {
    window.history.pushState({ gmProfilePopover: true }, '');
    let closedByBack = false;
    const onPop = () => { closedByBack = true; onClose?.(); };
    const onScroll = (e) => {
      // 팝오버 내부 스크롤은 무시, 페이지 스크롤이면 닫기
      if (cardRef.current && e?.target && cardRef.current.contains(e.target)) return;
      onClose?.();
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('scroll', onScroll, true);
      if (!closedByBack) window.history.back(); // 뒤로가기 외 경로로 닫히면 트랩 정리
    };
  }, []);

  // 화면 밖으로 나가지 않도록 위치 자동 보정 + 말풍선 화살표
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = card.offsetWidth, h = card.offsetHeight;
    const aLeft = anchor?.left ?? (vw - w) / 2;
    const aBottom = anchor?.bottom ?? vh / 2;
    const aTop = anchor?.top ?? vh / 2;
    let left = Math.min(Math.max(8, aLeft), vw - w - 8);
    let top = aBottom + 10;
    let arrow = 'up'; // 카드가 앵커 아래 → 화살표는 위쪽
    if (top + h > vh - 8) {
      const above = aTop - h - 10;
      if (above >= 8) { top = above; arrow = 'down'; }
      else top = Math.max(8, vh - h - 8);
    }
    const arrowLeft = Math.min(Math.max(16, aLeft - left + 10), w - 28);
    setPos({ left, top, arrow, arrowLeft });
  }, [anchor, company, rec, role]);

  // 내부 버튼 클릭 시 자동 닫힘 후 동작 실행
  const act = (fn, arg) => { onClose?.(); fn?.(arg); };

  const chip = (bg, color, children, key) => (
    <span key={key} style={{ background: bg, color, borderRadius: R.full, padding: '2px 8px', fontSize: 10.5, fontWeight: 700 }}>{children}</span>
  );

  const Btn = ({ label, primary, disabled, onClick }) => (
    <button onClick={onClick} disabled={disabled}
      style={{ flex: 1, padding: '8px 6px', borderRadius: R.lg, border: primary ? 'none' : `1.5px solid ${C.bgWarm}`,
        background: primary ? C.brand : C.surface, color: primary ? '#fff' : C.text2,
        fontWeight: 800, fontSize: 12, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1, whiteSpace: 'nowrap' }}>
      {label}
    </button>
  );

  const reportLink = (
    <button onClick={() => act(onReport)}
      style={{ width: '100%', marginTop: 8, background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 11.5, color: C.text4, fontWeight: 600, padding: '2px 0' }}>
      🚩 신고
    </button>
  );

  const renderCompany = () => {
    const name = resolveCompanyIdentity(company) || displayName;
    const bm = company?.badge ? (BADGES[company.badge] ?? null) : null;
    const specialties = (rec?.specialties ?? company?.specialties ?? []).slice(0, 3);
    const summary = [];
    if (rec?.projectsCompleted) summary.push(`프로젝트 ${rec.projectsCompleted}`);
    if (rec?.reviews) summary.push(`리뷰 ${rec.reviews}`);
    if (rec?.bidResponses) summary.push(`견적응답 ${rec.bidResponses}`);
    const self = currentUserId && company?.owner_id === currentUserId;
    return (
      <>
        <div style={{ fontSize: 14.5, fontWeight: 900, color: C.text1, marginBottom: 6, lineHeight: 1.3 }}>
          {hasGuaranteeBadge(company) && <span style={{ marginRight: 3 }}>🛡️</span>}{name}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: specialties.length || summary.length ? 8 : 10 }}>
          {chip(C.brand, '#fff', '🏅 전문가', 'exp')}
          {bm && chip(bm.bg, bm.color, `${bm.icon} ${bm.label}`, 'badge')}
          {company?.temp != null && chip(C.brandL, C.brand, `🌡️ ${Number(company.temp).toFixed(1)}°`, 'temp')}
        </div>
        {specialties.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {specialties.map((s) => chip(C.bg, C.text3, `#${s}`, s))}
          </div>
        )}
        {summary.length > 0 && (
          <div style={{ fontSize: 11.5, color: C.text3, fontWeight: 600, marginBottom: 10 }}>
            <span style={{ color: C.brand, fontWeight: 800 }}>공간 활동 </span>{summary.join(' · ')}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn label="포트폴리오" onClick={() => act(onViewPortfolio, company)} />
          <Btn label="대화 신청" primary disabled={self} onClick={() => !self && act(onRequestChat, company)} />
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <Btn label="견적 요청하기" onClick={() => act(onRequestQuote, company)} />
        </div>
        {onReport && reportLink}
      </>
    );
  };

  const renderConsumer = () => {
    const avatar = getAnonymousAvatarByNickname(displayName);
    const jl = joinPeriod(consumerProfile?.joinedAt);
    const recentLabel = daysAgo(rec?.lastActivityAt);
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatar.color, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21 }}>{avatar.emoji}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
            <div style={{ display: 'flex', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
              {consumerProfile?.spaceTemp != null && chip(C.brandL, C.brand, `🌡️ ${Number(consumerProfile.spaceTemp).toFixed(1)}°`, 'temp')}
              {jl && chip(C.bg, C.text3, `🗓️ ${jl}`, 'join')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: C.text2, marginBottom: recentLabel ? 4 : 10, fontWeight: 600 }}>
          <span>게시글 <b style={{ color: C.text1 }}>{rec?.loungePosts ?? 0}</b></span>
          <span>댓글 <b style={{ color: C.text1 }}>{rec?.loungeAnswers ?? 0}</b></span>
          {(rec?.likesReceived ?? 0) > 0 && <span>좋아요 <b style={{ color: C.text1 }}>{rec.likesReceived}</b></span>}
        </div>
        {recentLabel && (
          <div style={{ fontSize: 11.5, color: C.text4, marginBottom: 10 }}>🕐 최근 활동 {recentLabel}</div>
        )}
        {!isOwn && (
          <Btn label={alreadySent ? '✅ 신청 보냄' : busy ? '처리 중...' : '💬 대화 신청'} primary
            disabled={busy || alreadySent} onClick={() => !(busy || alreadySent) && act(onChat)} />
        )}
        {onReport && reportLink}
      </>
    );
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'transparent' }}>
      <div ref={cardRef} onClick={(e) => e.stopPropagation()}
        style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: W,
          opacity: pos ? 1 : 0, transition: 'opacity 0.1s', background: C.surface, borderRadius: 16,
          boxShadow: '0 10px 30px rgba(31,42,36,0.22)', border: `1px solid ${C.bgWarm}`,
          padding: 13, maxHeight: '58vh', overflowY: 'auto' }}>
        {pos && (
          <div style={{ position: 'absolute', left: pos.arrowLeft, width: 12, height: 12,
            [pos.arrow === 'up' ? 'top' : 'bottom']: -6, background: C.surface,
            borderLeft: pos.arrow === 'up' ? `1px solid ${C.bgWarm}` : 'none',
            borderTop: pos.arrow === 'up' ? `1px solid ${C.bgWarm}` : 'none',
            borderRight: pos.arrow === 'down' ? `1px solid ${C.bgWarm}` : 'none',
            borderBottom: pos.arrow === 'down' ? `1px solid ${C.bgWarm}` : 'none',
            transform: 'rotate(45deg)' }} />
        )}
        {role === 'company' ? renderCompany() : renderConsumer()}
      </div>
    </div>
  );
}
