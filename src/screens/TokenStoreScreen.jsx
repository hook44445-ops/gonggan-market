// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// 토큰 = 진짜 관심과 가벼운 접근을 구분하는 장치
// ─────────────────────────────────────────────────────

import { useState } from 'react';
import { C, R, S } from '../constants';
import { TOKEN_PACKAGES, TOKEN_COSTS } from '../constants/lounge';
import TokenBalance from '../components/token/TokenBalance';
import TokenPackageCard from '../components/token/TokenPackageCard';
import MissionList from '../components/token/MissionList';

export default function TokenStoreScreen({ user, balance, logs, missionStats, onBack, onBuy, onEarnToken, onHistory }) {
  const [tab, setTab]   = useState('store');
  const [toast, setToast] = useState(null);
  const [buying, setBuying] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2000); };

  // 실결제 연동 — 상위(MainApp)의 onBuy 가 토스 결제창을 띄운다(성공 시 결제창으로 리다이렉트).
  // onBuy 미제공(구형 호출부) 시에만 안내 토스트로 폴백.
  const handleBuy = async (pkg) => {
    if (buying) return;
    if (typeof onBuy !== 'function') {
      showToast('결제 준비 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    setBuying(true);
    try {
      await onBuy(pkg);
    } catch {
      showToast('결제를 시작하지 못했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setBuying(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 40 }}>
      <div style={{ background: C.surface, padding: `14px ${S.xl}px`, display: 'flex', alignItems: 'center', gap: S.md, borderBottom: `1px solid ${C.bgWarm}`, position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.text1, padding: 0 }}>←</button>
        <div style={{ fontSize: 17, fontWeight: 800, color: C.text1 }}>공간토큰 스토어</div>
      </div>

      <div style={{ padding: `${S.xl}px ${S.xl}px 0` }}>
        <TokenBalance balance={balance} onStore={() => {}} onHistory={onHistory} />
      </div>

      <div style={{ display: 'flex', margin: `${S.xl}px ${S.xl}px 0`, background: C.bg, borderRadius: R.lg, padding: S.xs }}>
        {[['store','토큰 구매'],['mission','무료 미션'],['cost','사용 금액']].map(([id,label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: R.md, background: tab === id ? C.surface : 'transparent', color: tab === id ? C.brand : C.text3, fontWeight: tab === id ? 800 : 500, fontSize: 13, cursor: 'pointer', transition: 'background 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: S.xl }}>
        {tab === 'store' && (
          <>
            <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.6, marginBottom: S.xl, background: C.surface, borderRadius: R.lg, padding: S.lg, border: `1px solid ${C.bgWarm}` }}>
              ⚠️ <strong>토큰 철학:</strong> 토큰은 "아까워야" 합니다.<br/>
              진짜 관심과 가벼운 접근을 구분하는 장치입니다.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: S.md }}>
              {TOKEN_PACKAGES.map((pkg, i) => (
                <TokenPackageCard key={i} pkg={pkg} onBuy={handleBuy} />
              ))}
            </div>
            <div style={{ marginTop: S.xl, background: C.surface, borderRadius: R.lg, padding: S.lg, border: `1px solid ${C.bgWarm}` }}>
              <div style={{ fontSize: 12, color: C.text3, lineHeight: 1.8 }}>
                ✓ 결제는 토스페이먼츠로 안전하게 처리됩니다 (신용·체크카드)<br/>
                ✓ 토큰은 라운지 대화 신청, 좋아요, 글 상단 노출 등에 사용<br/>
                ✓ 구매 즉시 토큰이 계정에 지급됩니다 (디지털 상품)<br/>
                ✓ <strong style={{ color: C.text2 }}>미사용 토큰</strong>은 결제 후 <strong style={{ color: C.text2 }}>7일 이내 청약철회(환불)</strong> 가능 · 일부라도 사용 시 환불 불가
              </div>
              <a href="/refund" style={{ display: 'inline-block', marginTop: S.md, fontSize: 12, fontWeight: 700, color: C.brand, textDecoration: 'underline' }}>
                환불 정책 자세히 보기 →
              </a>
            </div>
          </>
        )}

        {tab === 'mission' && (
          <>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: S.lg }}>🎯 무료 토큰 미션</div>
            <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}` }}>
              <MissionList
                logs={logs ?? []}
                missionStats={missionStats ?? null}
                balance={balance}
                onComplete={async (action) => {
                  const earned = await onEarnToken?.(action);
                  if (earned) showToast('✅ 토큰이 적립됐어요!');
                  else showToast('이미 완료한 미션입니다');
                  return earned;
                }}
              />
            </div>
          </>
        )}

        {tab === 'cost' && (
          <div style={{ background: C.surface, borderRadius: R.xl, padding: S.xl, border: `1px solid ${C.bgWarm}` }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text1, marginBottom: S.lg }}>💰 사용 금액 안내</div>
            {[
              ['대화 신청', `${TOKEN_COSTS.CHAT_REQUEST} 토큰 고정`],
              ['관심 보내기', `${TOKEN_COSTS.INTEREST_MIN}~${TOKEN_COSTS.INTEREST_MAX} 토큰`],
              ['글 상단 노출', `${TOKEN_COSTS.POST_BOOST_MIN}~${TOKEN_COSTS.POST_BOOST_MAX} 토큰`],
              ['전문가 답변 강조', `${TOKEN_COSTS.EXPERT_HIGHLIGHT_MIN}~${TOKEN_COSTS.EXPERT_HIGHLIGHT_MAX} 토큰`],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: `${S.md}px 0`, borderBottom: `1px solid ${C.bg}` }}>
                <span style={{ fontSize: 14, color: C.text2 }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.brand }}>{val}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', background: C.brand, color: '#fff', borderRadius: R.full, padding: '12px 22px', fontSize: 13, fontWeight: 700, boxShadow: `0 8px 24px ${C.brand}44`, zIndex: 200, whiteSpace: 'nowrap', maxWidth: '80%', textAlign: 'center' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
