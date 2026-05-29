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
    signup:                '첫 가입 보너스',
    profile_complete:      '프로필 완성',
    first_post:            '첫 글 작성',
    first_comment:         '첫 댓글 작성',
    first_story:           '첫 스토리 올리기',
    likes_received_20:     '좋아요/하트 20개 받기',
    comments_written_10:   '댓글 10개 작성',
    posts_written_3:       '게시글 3개 작성',
    construction_review:   '인테리어 후기 작성',
    first_quote_request:   '첫 견적 요청',
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
      label: '좋아요/하트 20개 받기',
      reward: TOKEN_EARN.LIKES_RECEIVED_20,
      done: completed.has('likes_received_20'),
      progress: stats ? { current: Math.min(s.likes_received ?? 0, 20), total: 20 } : null,
    },
    {
      action: 'comments_written_10',
      label: '댓글 10개 작성',
      reward: TOKEN_EARN.COMMENTS_WRITTEN_10,
      done: completed.has('comments_written_10'),
      progress: stats ? { current: Math.min(s.comments ?? 0, 10), total: 10 } : null,
    },
    {
      action: 'posts_written_3',
      label: '게시글 3개 작성',
      reward: TOKEN_EARN.POSTS_WRITTEN_3,
      done: completed.has('posts_written_3'),
      progress: stats ? { current: Math.min(s.posts ?? 0, 3), total: 3 } : null,
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
