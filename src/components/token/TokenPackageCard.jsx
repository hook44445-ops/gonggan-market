// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { C, R, S } from '../../constants';

export default function TokenPackageCard({ pkg, onBuy }) {
  const isPopular = pkg.badge === '인기';
  return (
    <div onClick={() => onBuy?.(pkg)} style={{
      background: isPopular ? `linear-gradient(135deg, ${C.brand}, ${C.brandD})` : C.surface,
      borderRadius: R.lg, padding: S.xl,
      border: isPopular ? 'none' : `1px solid ${C.bgWarm}`,
      cursor: 'pointer', position: 'relative', overflow: 'hidden',
    }}>
      {pkg.badge && (
        <div style={{ position: 'absolute', top: S.sm, right: S.sm, background: isPopular ? 'rgba(255,255,255,0.25)' : C.gold, color: '#fff', borderRadius: R.full, padding: '2px 8px', fontSize: 10, fontWeight: 800 }}>
          {pkg.badge}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: isPopular ? '#fff' : C.text1 }}>
            {pkg.tokens.toLocaleString()} 토큰
            {pkg.bonus > 0 && (
              <span style={{ fontSize: 13, fontWeight: 700, color: isPopular ? 'rgba(255,255,255,0.8)' : C.gold, marginLeft: 6 }}>
                +{pkg.bonus} 보너스
              </span>
            )}
          </div>
          {pkg.bonus > 0 && (
            <div style={{ fontSize: 13, color: isPopular ? 'rgba(255,255,255,0.7)' : C.text3, marginTop: 2 }}>
              총 {(pkg.tokens + pkg.bonus).toLocaleString()} 토큰
            </div>
          )}
          {pkg.perk && (
            <div style={{ display: 'inline-block', marginTop: 6, background: isPopular ? 'rgba(255,255,255,0.22)' : C.brandL, color: isPopular ? '#fff' : C.brand, borderRadius: R.full, padding: '3px 10px', fontSize: 11, fontWeight: 800 }}>
              {pkg.perk}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: isPopular ? '#fff' : C.brand }}>
            {pkg.price.toLocaleString()}원
          </div>
          <div style={{ fontSize: 10, color: isPopular ? 'rgba(255,255,255,0.6)' : C.text4, marginTop: 2 }}>
            토큰당 {Math.round(pkg.price / (pkg.tokens + pkg.bonus))}원
          </div>
        </div>
      </div>
    </div>
  );
}
