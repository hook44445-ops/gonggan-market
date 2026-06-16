// ─────────────────────────────────────────────────────
// 공간마켓 — 포트폴리오/시공사례 이미지 신고 모달 (LOUNGE-CONVERSION-v3.1)
// 직거래 위험요소(연락처/카톡/계좌/QR/외부링크/직거래 유도) + 부적절 이미지 신고.
// 즉시 삭제 없음(soft) — direct_deal_reports 에 저장 후 관리자 검토 대기.
// ─────────────────────────────────────────────────────
import { useState } from 'react';
import { C, R, S } from '../../constants';
import { createPortfolioReport } from '../../lib/supabase';

const REASONS = [
  '연락처가 노출되어 있어요',
  '카카오톡 ID가 보여요',
  '계좌번호가 보여요',
  'QR코드/외부 링크가 있어요',
  '직거래를 유도해요',
  '허위 시공사례 같아요',
  '부적절한 이미지예요',
  '기타',
];

export default function PortfolioReportModal({
  companyId = null, imageUrl = null, reporterId = null, postId = null, portfolioId = null,
  onClose, onSubmitted,
}) {
  const [reason, setReason] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    const { error } = await createPortfolioReport({ companyId, reporterId, imageUrl, reason, postId, portfolioId });
    setBusy(false);
    if (error) { onSubmitted?.(false, error.message); return; }
    setDone(true);
    onSubmitted?.(true);
  };

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 650, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: C.surface, borderRadius: `${R.xl}px ${R.xl}px 0 0`, padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 0px))', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: '0 auto 16px' }} />

        {done ? (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text1, marginBottom: 6 }}>신고가 접수되었습니다</div>
            <div style={{ fontSize: 12.5, color: C.text3, lineHeight: 1.6, marginBottom: 16 }}>
              관리자 검토 후 처리됩니다. 이미지는 즉시 삭제되지 않습니다.
            </div>
            <button onClick={onClose} style={{ padding: '11px 22px', borderRadius: R.lg, border: 'none', background: C.brand, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>확인</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 16, fontWeight: 900, color: C.text1, marginBottom: 4 }}>이미지 신고</div>
            <div style={{ fontSize: 12.5, color: C.text3, marginBottom: 14, lineHeight: 1.6 }}>
              직거래 유도·연락처 노출·부적절 이미지를 신고해 주세요. 즉시 삭제되지 않고 관리자가 검토합니다.
            </div>
            {imageUrl && (
              <img src={imageUrl} alt="" style={{ width: 80, height: 80, borderRadius: R.md, objectFit: 'cover', border: `1px solid ${C.bgWarm}`, marginBottom: 14 }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)}
                  style={{ textAlign: 'left', padding: '11px 13px', borderRadius: R.lg, cursor: 'pointer',
                    border: `1.5px solid ${reason === r ? C.brand : C.bgWarm}`, background: reason === r ? C.brandL : C.surface,
                    color: reason === r ? C.brand : C.text2, fontWeight: reason === r ? 800 : 500, fontSize: 13 }}>
                  {reason === r ? '◉' : '○'} {r}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: R.lg, border: `1.5px solid ${C.bgWarm}`, background: C.surface, color: C.text3, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>취소</button>
              <button onClick={submit} disabled={!reason || busy}
                style={{ flex: 2, padding: '12px', borderRadius: R.lg, border: 'none', background: C.brand, color: '#fff', fontWeight: 800, fontSize: 13, cursor: (!reason || busy) ? 'default' : 'pointer', opacity: (!reason || busy) ? 0.5 : 1 }}>
                {busy ? '접수 중...' : '신고하기'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
