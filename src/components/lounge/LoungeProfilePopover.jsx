// ════════════════════════════════════════════════════════════════════════════
// LoungeProfilePopover — 라운지 작성자(닉네임) 클릭 시 닉네임 옆 초미니 팝오버
//   · 풀스크린 모달/바텀시트 금지 → 앵커(클릭 요소) 옆 작은 카드형 말풍선.
//   · X 버튼 없음. 바깥 클릭 / 스크롤 / 다른 닉네임 클릭 / 뒤로가기 / 내부 버튼 클릭 시 닫힘.
//   · 역할 분리: company(거래 중심) / consumer(신뢰 중심).
//   · 기존 데이터/identityResolver 재사용. DB/스키마/저장 로직 무변경(읽기 전용).
// ════════════════════════════════════════════════════════════════════════════
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { C, R } from '../../constants';
import { getCompanyByOwnerId } from '../../lib/supabase';
import { getSpaceActivityRecord } from '../../lib/spaceActivity';
import { getAnonymousAvatarByNickname } from '../../utils/anonymousNickname';
import { resolveCompanyIdentity } from '../../utils/identityResolver';

const W = 110; // 초미니 팝오버 폭 — 추가 ~30% 축소(155→110): 닉네임 옆 가벼운 정보 위젯 수준

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
    <span key={key} style={{ background: bg, color, borderRadius: R.full, padding: '1px 5px', fontSize: 9, fontWeight: 700 }}>{children}</span>
  );

  // 얇은 리스트형 행(메뉴) — 버튼처럼 보이지 않게. 높이 18 · 아이콘 + 라벨(초미니).
  const Row = ({ icon, label, onClick, disabled, danger }) => (
    <button onClick={onClick} disabled={disabled}
      style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', height: 18, padding: '0 3px',
        background: 'none', border: 'none', borderRadius: 6, textAlign: 'left',
        color: danger ? C.text4 : C.text2, fontWeight: 700, fontSize: 11,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1 }}>
      <span style={{ fontSize: 11, width: 13, textAlign: 'center' }}>{icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  );

  const Divider = () => <div style={{ height: 1, background: C.bgWarm, margin: '4px 0' }} />;

  // 닉네임(11.5px Bold)
  const nameStyle = { fontSize: 11.5, fontWeight: 800, color: C.text1, lineHeight: 1.3,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

  const renderCompany = () => {
    const name = resolveCompanyIdentity(company) || displayName;
    const self = currentUserId && company?.owner_id === currentUserId;
    const metaBits = [
      company?.temp != null ? `🌡 ${Number(company.temp).toFixed(1)}°` : null,
      company?.region ? `📍 ${company.region}` : null,
    ].filter(Boolean);
    return (
      <>
        <div style={{ ...nameStyle, marginBottom: 3 }}>🛠 {name}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: metaBits.length ? 2 : 0 }}>
          {chip(C.brand, '#fff', '⭐ 전문가', 'exp')}
          {hasGuaranteeBadge(company) && chip(C.brandL, C.brand, '🏅 공간보증', 'guarantee')}
        </div>
        {metaBits.length > 0 && (
          <div style={{ fontSize: 9.5, color: C.text3, fontWeight: 600 }}>{metaBits.join(' · ')}</div>
        )}
        <Divider />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Row icon="📁" label="포트폴리오" onClick={() => act(onViewPortfolio, company)} />
          <Row icon="💬" label="메시지" disabled={self} onClick={() => {
            console.log('[CHAT DEBUG] message button clicked', {
              source: 'mini-popover(company)', targetUserId: ownerId, currentUserId, isSelf: self, disabled: self,
            });
            if (!self) act(onRequestChat, company);
          }} />
          {onReport && <Row icon="🚩" label="신고" danger onClick={() => act(onReport)} />}
        </div>
      </>
    );
  };

  const renderConsumer = () => {
    // 댓글 작성자 팝오버 — 메시지(대화 신청) 버튼 비활성 원인 진단용 로그.
    console.log('[CHAT DEBUG] disabled reason', {
      source:       'comment-author-popover(render)',
      isSelf:       isOwn,
      loading:      busy,
      alreadySent,
      currentUser:  !!currentUserId,
      targetUserId: ownerId,
      hidden:       isOwn,            // isOwn 이면 메시지 행 자체가 렌더되지 않음
      disabled:     busy || alreadySent,
    });
    const avatar = getAnonymousAvatarByNickname(displayName);
    const jl = joinPeriod(consumerProfile?.joinedAt);
    const metaBits = [
      consumerProfile?.spaceTemp != null ? `🌡 ${Number(consumerProfile.spaceTemp).toFixed(1)}°` : null,
      jl ? `🗓 ${jl}` : null,
      `📝 ${rec?.loungePosts ?? 0} · 💬 ${rec?.loungeAnswers ?? 0}`,
    ].filter(Boolean);
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
          <div style={{ width: 19, height: 19, borderRadius: '50%', background: avatar.color, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{avatar.emoji}</div>
          <div style={{ ...nameStyle, minWidth: 0 }}>{displayName}</div>
        </div>
        <div style={{ fontSize: 9.5, color: C.text3, fontWeight: 600 }}>{metaBits.join(' · ')}</div>
        <Divider />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!isOwn && (
            <Row icon="💬" label={alreadySent ? '신청 보냄' : busy ? '처리 중...' : '메시지 신청'}
              disabled={busy || alreadySent} onClick={() => {
                console.log('[CHAT DEBUG] message button clicked', {
                  source: 'comment-author-popover', targetUserId: ownerId, currentUserId,
                  isSelf: isOwn, alreadySent, loading: busy, disabled: busy || alreadySent,
                });
                if (!(busy || alreadySent)) act(onChat);
              }} />
          )}
          {onReport && <Row icon="🚩" label="신고" danger onClick={() => act(onReport)} />}
        </div>
      </>
    );
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'transparent' }}>
      <div ref={cardRef} onClick={(e) => e.stopPropagation()}
        style={{ position: 'fixed', left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: W,
          opacity: pos ? 1 : 0, transition: 'opacity 0.1s', background: C.surface, borderRadius: 9,
          boxShadow: '0 1px 6px rgba(31,42,36,0.07)', border: `1px solid ${C.bgWarm}`,
          padding: 4, maxHeight: '50vh', overflowY: 'auto' }}>
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
