// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템 — 대화 신청 BottomSheet
//   두 얼굴을 가진다(09-25):
//     · 토큰이 넉넉하면  : 메시지를 쓰고 보낸다(보내기 시점까지 방은 만들지 않는다)
//     · 토큰이 모자라면  : 메시지 입력칸을 아예 보여주지 않고 «토큰이 필요해요» 화면
//       — 예전엔 다 써서 보내기를 눌러야 부족을 알고 토큰 상점으로 튕겼다(헛수고).
//   차감은 «상대가 수락할 때» 신청자에게서 일어난다(서버 accept_lounge_chat).
//   신청 자체도 서버가 잔액을 본다(SQL 133) — 화면 검사와 서버 검사가 같은 기준.
// ─────────────────────────────────────────────────────

import { useState } from 'react';
import { C, R, S } from '../../constants';
import { TOKEN_COSTS } from '../../constants/lounge';
import { PAYMENTS_LIVE } from '../../constants/release';

const Sheet = ({ children }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,42,36,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 500 }}>
    <div style={{ background: C.surface, borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, padding: '24px 24px 40px', maxHeight: '92vh', overflowY: 'auto' }}>
      <div style={{ width: 36, height: 4, background: C.bgWarm, borderRadius: R.full, margin: '0 auto 20px' }} />
      {children}
    </div>
  </div>
);

const Art = ({ src, size = 96 }) => (
  <img src={src} alt="" aria-hidden="true" width={size} height={size}
    style={{ width: size, height: size, display: 'block', margin: '0 auto 12px', borderRadius: R.lg }} />
);

export default function ChatRequestModal({ balance = 0, toName = null, sending = false, onConfirm, onCancel, onGetTokens }) {
  const cost = TOKEN_COSTS.CHAT_REQUEST;
  const [text, setText] = useState('');
  const short = (balance ?? 0) < cost;

  // ── 토큰이 모자랄 때 — 쓰기 전에 먼저 말한다 ──────────────────────
  if (short) {
    const need = cost - (balance ?? 0);
    return (
      <Sheet>
        <div style={{ textAlign: 'center', marginBottom: S.lg }}>
          <Art src="/images/empty/token.webp" />
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, marginBottom: 8 }}>토큰이 {need}개 더 필요해요</div>
          <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.7 }}>
            대화는 상대가 수락할 때 <strong style={{ color: C.brand }}>{cost}토큰</strong>이 차감돼요.<br />
            지금 가진 토큰은 <strong style={{ color: C.text1 }}>{(balance ?? 0).toLocaleString()}개</strong>예요.
          </div>
        </div>

        {/* 결제가 열리기 전엔 «충전»이라고 말하지 않는다 — 지금 실제로 가능한 길만 안내한다 */}
        <div style={{ background: C.brandL, border: `1px solid ${C.brandM}`, borderRadius: R.lg, padding: `${S.md}px ${S.lg}px`, marginBottom: S.xl }}>
          <div style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.8 }}>
            {PAYMENTS_LIVE
              ? '토큰을 충전하거나, 라운지 활동으로도 모을 수 있어요.'
              : <>토큰 충전은 정식 오픈 때 열려요. 그때까지는 라운지 활동으로 모을 수 있어요 — 프로필 채우기 · 첫 글 · 첫 댓글 · 후기 남기기.</>}
          </div>
          {!PAYMENTS_LIVE && (
            <div style={{ fontSize: 11.5, color: C.text3, lineHeight: 1.7, marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${C.brandM}` }}>
              그래도 모자라면 고객센터(070-7954-2740)로 알려 주세요 — 확인 후 넣어 드려요.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: S.sm }}>
          <button onClick={onCancel}
            style={{ flex: 1, padding: S.xl, background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            닫기
          </button>
          <button onClick={() => onGetTokens?.()}
            style={{ flex: 2, padding: S.xl, background: C.brand, color: '#fff', border: 'none', borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: `0 4px 16px ${C.brand44}` }}>
            {PAYMENTS_LIVE ? '토큰 채우러 가기' : '토큰 모으는 방법 보기'}
          </button>
        </div>
      </Sheet>
    );
  }

  // ── 토큰이 넉넉할 때 — 메시지 쓰기 ────────────────────────────────
  const handleSend = () => {
    if (sending) { return; }
    // text 비어 있어도 onConfirm 호출 → 상위 handleChatRequest가 '메시지를 입력해주세요' toast 안내(무반응 방지)
    onConfirm?.(text);
  };

  return (
    <Sheet>
      <div style={{ textAlign: 'center', marginBottom: S.lg }}>
        <Art src="/images/empty/chat-open.webp" size={88} />
        {/* 누구에게 가는지 먼저 — 글 작성자·댓글 작성자 모두 같은 시트를 쓴다(09-26 L1) */}
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text1, marginBottom: 8 }}>{toName ? `${toName} 님에게 메시지` : '메시지 보내기'}</div>
        <div style={{ fontSize: 13, color: C.text3, lineHeight: 1.6 }}>
          메시지는 익명으로 전달돼요.<br />
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
          ['지금 가진 토큰', `${(balance ?? 0).toLocaleString()} 토큰`],
          ['수락하면 차감', `${cost} 토큰`],
          ['그 뒤 남는 토큰', `${Math.max(0, (balance ?? 0) - cost).toLocaleString()} 토큰`],
        ].map(([label, val], i) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: i < 2 ? S.sm : 0 }}>
            <span style={{ fontSize: 13, color: C.text3 }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: i === 1 ? C.brand : C.text1 }}>
              {i === 1 ? `-${val}` : val}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: S.sm }}>
        <button onClick={onCancel} style={{ flex: 1, padding: S.xl, background: C.bg, color: C.text2, border: `1px solid ${C.bgWarm}`, borderRadius: R.lg, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          취소
        </button>
        {/* sending(처리 중)일 때만 비활성 — 빈 텍스트는 클릭 시 toast 안내(silent 무반응 방지) */}
        <button onClick={handleSend} disabled={sending}
          style={{ flex: 2, padding: S.xl, background: sending ? C.text4 : (text.trim() ? C.brand : C.brandM ?? C.brand), color: '#fff', border: 'none', borderRadius: R.lg, fontWeight: 800, fontSize: 15, cursor: sending ? 'default' : 'pointer', opacity: (!sending && !text.trim()) ? 0.7 : 1, boxShadow: sending ? 'none' : `0 4px 16px ${C.brand44}` }}>
          {sending ? '보내는 중...' : '보내기'}
        </button>
      </div>
    </Sheet>
  );
}
