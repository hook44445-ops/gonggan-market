// ─────────────────────────────────────────────────────
// 공간랜드 라운지 시스템
// 토큰 = 진짜 관심과 가벼운 접근을 구분하는 장치
// ─────────────────────────────────────────────────────

import { TOKEN_COSTS, TOKEN_EARN } from '../constants/lounge.js';

export function canAfford(balance, action) {
  const cost = TOKEN_COSTS[action] ?? 0;
  return balance >= cost;
}

export function calcChatCost() {
  return TOKEN_COSTS.CHAT_REQUEST;
}

export function formatTokenAmount(amount) {
  return `${amount.toLocaleString()} 토큰`;
}

export function getEarnDescription(action) {
  const map = {
    signup:                '첫 가입 보너스',
    profile_complete:      '프로필 완성',
    first_post:            '첫 글 작성',
    first_comment:         '첫 댓글 작성',
    first_story:           '첫 스토리 올리기',
    likes_received_20:     '오늘 좋아요 20개 받기',
    comments_written_10:   '오늘 댓글 10개 작성',
    posts_written_3:       '오늘 게시글 3개 작성',
    construction_review:   '인테리어 후기 작성',
    first_quote_request:   '첫 견적 요청',
    referral_invite:       '친구 초대 보상',
    referral_joined:       '친구 초대로 가입',
    daily_checkin:         '출석 도장',
    referral_event:        '초대왕 이벤트 상품',
  };
  return map[action] ?? action;
}

export function getSpendDescription(action) {
  const map = {
    chat_request:      '대화 신청',
    interest_send:     '관심 보내기',
    post_boost:        '글 상단 노출',
    expert_highlight:  '전문가 답변 강조',
  };
  return map[action] ?? action;
}

// 매일 반복 미션 — 한국 날짜로 하루 한 번(서버 198 과 같다). 자정(한국)이 지나면 다시 도전.
export const kstDay = (t) => new Date(new Date(t).getTime() + 9 * 3600000).toISOString().slice(0, 10);
export function earnedToday(logs, action, now = Date.now()) {
  const today = kstDay(now);
  return (logs ?? []).some(l => l.type === 'earn' && l.action === action && l.created_at && kstDay(l.created_at) === today);
}
// 매일 미션 진행도는 «오늘» 숫자(서버 token_mission_today) — 지금까지 쌓인 합계가 아니다(198).
export const DAILY_MISSIONS = Object.freeze([
  { action: 'likes_received_20',   key: 'likes_today',    threshold: 20 },
  { action: 'comments_written_10', key: 'comments_today', threshold: 10 },
  { action: 'posts_written_3',     key: 'posts_today',    threshold: 3  },
]);

export function getMissionList(logs = [], stats = null) {
  const completed = new Set(logs.filter(l => l.type === 'earn').map(l => l.action));
  const s = stats ?? {};

  return [
    {
      action: 'first_post',
      label: '첫 글 작성',
      reward: TOKEN_EARN.FIRST_POST,
      done: completed.has('first_post'),
      progress: null,
    },
    {
      action: 'first_comment',
      label: '첫 댓글 작성',
      reward: TOKEN_EARN.FIRST_COMMENT,
      done: completed.has('first_comment'),
      progress: null,
    },
    {
      action: 'first_story',
      label: '첫 스토리 올리기',
      reward: TOKEN_EARN.FIRST_STORY,
      done: completed.has('first_story'),
      progress: null,
    },
    {
      action: 'profile_complete',
      label: '프로필 완성',
      reward: TOKEN_EARN.PROFILE_COMPLETE,
      done: completed.has('profile_complete'),
      progress: null,
    },
    {
      action: 'likes_received_20',
      label: '오늘 좋아요 20개 받기',
      reward: TOKEN_EARN.LIKES_RECEIVED_20,
      done: earnedToday(logs, 'likes_received_20'),
      repeat: true,
      progress: stats ? { current: Math.min(s.likes_today ?? 0, 20), total: 20 } : null,
    },
    {
      action: 'comments_written_10',
      label: '오늘 댓글 10개 작성',
      reward: TOKEN_EARN.COMMENTS_WRITTEN_10,
      done: earnedToday(logs, 'comments_written_10'),
      repeat: true,
      progress: stats ? { current: Math.min(s.comments_today ?? 0, 10), total: 10 } : null,
    },
    {
      action: 'posts_written_3',
      label: '오늘 게시글 3개 작성',
      reward: TOKEN_EARN.POSTS_WRITTEN_3,
      done: earnedToday(logs, 'posts_written_3'),
      repeat: true,
      progress: stats ? { current: Math.min(s.posts_today ?? 0, 3), total: 3 } : null,
    },
    {
      action: 'construction_review',
      label: '인테리어 후기 작성',
      reward: TOKEN_EARN.CONSTRUCTION_REVIEW,
      done: completed.has('construction_review'),
      progress: null,
    },
    {
      action: 'first_quote_request',
      label: '첫 견적 요청',
      reward: TOKEN_EARN.FIRST_QUOTE_REQUEST,
      done: completed.has('first_quote_request'),
      progress: null,
    },
  ];
}
