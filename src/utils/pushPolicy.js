// ─────────────────────────────────────────────────────
// 공간마켓 푸시알림 정책 (순수 ESM · 의존성 0)
// 클라이언트(target_url/문구)와 서버리스 dispatch(시간창/캡) 양쪽에서 import.
// ─────────────────────────────────────────────────────

// 알림 타입
export const PUSH_TYPE = {
  LOCAL_NEWS:    'local_news',     // 동네 소식
  INTERIOR_NEWS: 'interior_news',  // 인테리어 소식
  REVIEW_NEWS:   'review_news',    // 시공후기
  ESTIMATE_NEWS: 'estimate_news',  // 견적 고민
  COMPANY_NEWS:  'company_news',   // 업체추천
  LOUNGE_ACTIVITY: 'lounge_activity', // 내 글 댓글/하트
  CHAT:          'chat',           // 대화
  ESCROW:        'escrow',         // 계약/안전결제
};

// 즉시 발송(시간 제한 없음) 타입 — 대화/계약/에스크로
export function isImmediateType(type) {
  return type === PUSH_TYPE.CHAT || type === PUSH_TYPE.ESCROW || type === PUSH_TYPE.LOUNGE_ACTIVITY;
}

// 영구 보존 타입 (30일 자동삭제 제외) — 계약/에스크로
export function isPermanentType(type) {
  return type === PUSH_TYPE.ESCROW;
}

// KST(UTC+9) 시/분 추출
function kstHM(date = new Date()) {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 3600000);
  return { h: kst.getHours(), m: kst.getMinutes(), minutes: kst.getHours() * 60 + kst.getMinutes() };
}

// 동네/인테리어 등 소식성 발송 허용 시간: 오전 10시 ~ 오후 9시
export function isWithinNewsWindow(date = new Date()) {
  const { minutes } = kstHM(date);
  return minutes >= 10 * 60 && minutes <= 21 * 60;
}

// 추천(우선) 시간대: 11:30~13:30, 18:30~21:00
export function isPreferredWindow(date = new Date()) {
  const { minutes } = kstHM(date);
  return (minutes >= 11 * 60 + 30 && minutes <= 13 * 60 + 30)
      || (minutes >= 18 * 60 + 30 && minutes <= 21 * 60);
}

// 소식성 하루 최대 발송 횟수
export const NEWS_DAILY_CAP = 3;

// 소식성 타입 여부 (시간창/일일캡 적용 대상)
export function isNewsType(type) {
  return [
    PUSH_TYPE.LOCAL_NEWS,
    PUSH_TYPE.INTERIOR_NEWS,
    PUSH_TYPE.REVIEW_NEWS,
    PUSH_TYPE.ESTIMATE_NEWS,
    PUSH_TYPE.COMPANY_NEWS,
  ].includes(type);
}

// 라운지 카테고리 id → 푸시 타입
export function categoryToPushType(category) {
  switch (category) {
    case 'local':       return PUSH_TYPE.LOCAL_NEWS;
    case 'interior':    return PUSH_TYPE.INTERIOR_NEWS;
    case 'review':      return PUSH_TYPE.REVIEW_NEWS;
    case 'quote_worry': return PUSH_TYPE.ESTIMATE_NEWS;
    case 'recommend':   return PUSH_TYPE.COMPANY_NEWS;
    default:            return null;
  }
}

// 푸시 타입 → push_preferences 컬럼명
export function pushTypeToPrefColumn(type) {
  switch (type) {
    case PUSH_TYPE.LOCAL_NEWS:      return 'push_local_news';
    case PUSH_TYPE.INTERIOR_NEWS:   return 'push_interior_news';
    case PUSH_TYPE.REVIEW_NEWS:     return 'push_estimate_news';   // "견적/시공 후기" 토글로 묶음
    case PUSH_TYPE.ESTIMATE_NEWS:   return 'push_estimate_news';
    case PUSH_TYPE.COMPANY_NEWS:    return 'push_company_recommend';
    case PUSH_TYPE.LOUNGE_ACTIVITY: return 'push_lounge_activity';
    case PUSH_TYPE.CHAT:            return 'push_chat';
    case PUSH_TYPE.ESCROW:          return 'push_escrow';
    default:                        return null;
  }
}

// 클릭 시 이동 target_url
export function buildTargetUrl(type, relatedId, extra = {}) {
  switch (type) {
    case PUSH_TYPE.LOCAL_NEWS:
    case PUSH_TYPE.INTERIOR_NEWS:
    case PUSH_TYPE.REVIEW_NEWS:
    case PUSH_TYPE.ESTIMATE_NEWS:
    case PUSH_TYPE.COMPANY_NEWS:
    case PUSH_TYPE.LOUNGE_ACTIVITY:
      return relatedId ? `/lounge/posts/${relatedId}` : '/lounge';
    case PUSH_TYPE.CHAT:   return relatedId ? `/chat/${relatedId}` : '/lounge';
    case PUSH_TYPE.ESCROW: return relatedId ? `/contracts/${relatedId}` : '/';
    default:
      if (extra.requestId) return `/requests/${extra.requestId}`;
      return '/';
  }
}

// 기본 알림 문구
export function buildPushCopy(type, ctx = {}) {
  const region = ctx.region ? String(ctx.region).trim() : '';
  switch (type) {
    case PUSH_TYPE.LOCAL_NEWS:
      return { title: '우리 동네 새 공간 이야기 🏠', body: region ? `${region} 새 이야기가 올라왔어요` : '동네 새 이야기가 올라왔어요' };
    case PUSH_TYPE.INTERIOR_NEWS:
      return { title: '새로운 리모델링 고민이 도착했어요', body: '요즘 많이 보는 시공 이야기를 확인해보세요' };
    case PUSH_TYPE.REVIEW_NEWS:
      return { title: '새 시공후기가 올라왔어요 🛠️', body: '실제 공간 변화 이야기를 확인해보세요' };
    case PUSH_TYPE.ESTIMATE_NEWS:
      return { title: '새로운 견적 고민이 올라왔어요', body: '비슷한 고민과 견적 이야기를 확인해보세요' };
    case PUSH_TYPE.COMPANY_NEWS:
      return { title: '믿을 수 있는 업체 이야기가 올라왔어요', body: '업체 추천과 경험담을 확인해보세요' };
    case PUSH_TYPE.LOUNGE_ACTIVITY:
      return { title: '내 글에 새 소식이 있어요', body: ctx.body || '내 이야기에 반응이 도착했어요' };
    case PUSH_TYPE.CHAT:
      return { title: '새 대화 신청이 도착했어요', body: ctx.body || '대화 신청을 확인해보세요' };
    case PUSH_TYPE.ESCROW:
      return { title: ctx.title || '안전결제 확인이 필요해요', body: ctx.body || '진행 상황을 확인해주세요' };
    default:
      return { title: ctx.title || '공간마켓 알림', body: ctx.body || '' };
  }
}
