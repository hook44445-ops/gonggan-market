// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// 토큰 = 진짜 관심과 가벼운 접근을 구분하는 장치
// ─────────────────────────────────────────────────────

import { TOKEN_COSTS, TOKEN_EARN } from '../constants/lounge';

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
    signup:               '첫 가입 보너스',
    profile_complete:     '프로필 완성',
    first_post:           '첫 글 작성',
    first_comment:        '첫 댓글 작성',
    weekly_activity:      '7일 연속 활동',
    construction_review:  '공사 후기 작성',
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

export function getMissionList(logs = []) {
  const completed = new Set(logs.filter(l => l.type === 'earn').map(l => l.action));

  return [
    { action: 'signup',              label: '첫 가입',           reward: TOKEN_EARN.SIGNUP,              done: completed.has('signup') },
    { action: 'profile_complete',    label: '프로필 완성',       reward: TOKEN_EARN.PROFILE_COMPLETE,    done: completed.has('profile_complete') },
    { action: 'first_post',          label: '첫 글 작성',        reward: TOKEN_EARN.FIRST_POST,          done: completed.has('first_post') },
    { action: 'first_comment',       label: '첫 댓글 작성',      reward: TOKEN_EARN.FIRST_COMMENT,       done: completed.has('first_comment') },
    { action: 'weekly_activity',     label: '7일 연속 활동',     reward: TOKEN_EARN.WEEKLY_ACTIVITY,     done: completed.has('weekly_activity') },
    { action: 'construction_review', label: '공사 후기 작성',    reward: TOKEN_EARN.CONSTRUCTION_REVIEW, done: completed.has('construction_review') },
  ];
}
