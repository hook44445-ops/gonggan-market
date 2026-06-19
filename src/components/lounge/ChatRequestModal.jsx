// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState } from 'react';
import { C, R, S } from '../../constants';
import { TOKEN_COSTS } from '../../constants/lounge';

// 메시지 작성 BottomSheet — 보내기 클릭 시점까지는 채팅방을 생성하지 않는다.
// (보내기 → 토큰 확인 → 부족하면 상위에서 토큰 스토어로 이동 → 충분하면 메시지 요청 생성)
export default function ChatRequestModal({ balance, sending = false, onConfirm, onCancel }) {
  const cost = TOKEN_COSTS.CHAT_REQUEST;
  const [text, setText] = useState('');

  const handleSend = () => {
    // 버튼 클릭은 항상 로그로 확인(무반응/disabled 추적용). 조용히 return 금지.
    console.log('[CHAT DEBUG] 보내기 clicked', { sending, hasText: !!text.trim(), len: text.trim().length, balance, cost });
    if (sending) { console.warn('[CHAT DEBUG] blocked: sending(처리 중)'); return; }
    // text 비어 있어도 onConfirm 호출 → 상위 handleChatRequest가 '메시지를 입력해주세요' toast 안내(무반응 방지)
    onConfirm?.(text);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,42,36,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 500 }}>
      <div style={{ background: C.surface, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '24px 24px 40px' }}>
        <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: '0 auto 20px' }} />

        <div style={{ textAlign: 'center', marginBottom: S.lg }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, marginBottom: 8 }}>메시지 보내기</div>
          <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.6 }}>
            메시지는 익명으로 전달돼요.<br/>
            상대방이 수락하면 <strong style={{ color: C.brand }}>{cost}토큰</strong>이 차감됩니다.
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="상대방에게 보낼 메시지를 입력해주세요"
          autoFocus
          style={{ width: '100%', minHeight: 88, resize: 'none', background: C.bg, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, padding: S.md, fontSize: 14, color: C.text1, lineHeight: 1.5, boxSizing: 'border-box', marginBottom: S.lg }}
        />

        <div style={{ background: C.brandL, borderRadius: R.lg, padding: S.xl, marginBottom: S.xl, border: `1px solid ${C.brandM}` }}>
          {[
            ['현재 보유 토큰', `${balance.toLocaleString()} 토큰`],
            ['수락 시 차감', `${cost} 토큰`],
            ['수락 후 잔액',  `${Math.max(0, balance - cost).toLocaleString()} 토큰`],
          ].map(([label, val], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < 2 ? S.sm : 0 }}>
              <span style={{ fontSize: 13, color: C.text3 }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: i === 1 ? C.brand : C.text1 }}>
                {i === 1 ? `-${val}` : val}
              </span>
            </div>
          ))}
        </div>

        {balance < cost && (
          <div style={{ background: '#FEF0F0', borderRadius: R.lg, padding: S.md, marginBottom: S.lg, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: C.red, fontWeight: 700 }}>토큰이 부족해요</div>
            <div style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>보내기를 누르면 토큰 충전 화면으로 이동해요</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: S.sm }}>
          <button onClick={onCancel} style={{ flex: 1, padding: S.xl, background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            취소
          </button>
          {/* sending(처리 중)일 때만 비활성 — 빈 텍스트는 클릭 시 toast 안내(silent 무반응 방지) */}
          <button onClick={handleSend} disabled={sending}
            style={{ flex: 2, padding: S.xl, background: sending ? C.text4 : (text.trim() ? C.brand : C.brandM ?? C.brand), color: '#fff', border: 'none', borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: sending ? 'default' : 'pointer', opacity: (!sending && !text.trim()) ? 0.7 : 1, boxShadow: sending ? 'none' : `0 4px 16px ${C.brand}44` }}>
            {sending ? '보내는 중...' : '보내기'}
          </button>
        </div>
      </div>
    </div>
  );
}
