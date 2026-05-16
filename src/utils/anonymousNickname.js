// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
//
// 라운지는 단순 커뮤니티 게시판이 아닙니다.
// 사람이 머무는 공간 안에서 신뢰가 생기고,
// 그 신뢰가 거래로 이어지는 구조입니다.
// ─────────────────────────────────────────────────────

const NICKNAME_DATA = [
  { name: '사자코끼리',    emoji: '🦁' },
  { name: '날쌘다람쥐',    emoji: '🐿️' },
  { name: '파파스머프',    emoji: '🐱' },
  { name: '졸린판다',      emoji: '🐼' },
  { name: '배고픈수달',    emoji: '🦦' },
  { name: '민트고양이',    emoji: '🐱' },
  { name: '새벽올빼미',    emoji: '🦉' },
  { name: '행복한코끼리',  emoji: '🐘' },
  { name: '용감한사자',    emoji: '🦁' },
  { name: '느린거북이',    emoji: '🐢' },
  { name: '빠른치타',      emoji: '🐆' },
  { name: '조용한부엉이',  emoji: '🦉' },
  { name: '달리는말',      emoji: '🐎' },
  { name: '수영하는오리',  emoji: '🦆' },
  { name: '나는독수리',    emoji: '🦅' },
  { name: '잠자는곰',      emoji: '🐻' },
  { name: '노래하는새',    emoji: '🐦' },
  { name: '뛰는토끼',      emoji: '🐰' },
  { name: '헤엄치는물고기', emoji: '🐟' },
  { name: '웃는하마',      emoji: '🦛' },
  { name: '감동한사자',    emoji: '🦁' },
  { name: '웃긴고양이',    emoji: '😸' },
  { name: '핑크판다',      emoji: '🐼' },
  { name: '졸린너구리',    emoji: '🦝' },
  { name: '신난강아지',    emoji: '🐶' },
  { name: '조용한고슴도치', emoji: '🦔' },
  { name: '빠른매',        emoji: '🦅' },
  { name: '느긋한거북',    emoji: '🐢' },
  { name: '귀여운펭귄',    emoji: '🐧' },
  { name: '진지한독수리',  emoji: '🦅' },
  { name: '활발한원숭이',  emoji: '🐒' },
  { name: '부지런한비버',  emoji: '🦫' },
  { name: '온화한기린',    emoji: '🦒' },
  { name: '씩씩한호랑이',  emoji: '🐯' },
  { name: '영리한여우',    emoji: '🦊' },
  { name: '귀여운토끼',    emoji: '🐰' },
  { name: '차분한고양이',  emoji: '🐱' },
  { name: '활기찬참새',    emoji: '🐦' },
  { name: '따뜻한북극곰',  emoji: '🐻‍❄️' },
  { name: '용감한펭귄',    emoji: '🐧' },
];

const AVATAR_COLORS = [
  '#2E5F4B', '#C8A15A', '#3A7A5C', '#E07A5F',
  '#5B8DB8', '#7B5EA7', '#4A9B6F', '#D4845A',
  '#6A5ACD', '#20B2AA', '#CD853F', '#708090',
];

const NICKNAME_MAP = new Map(
  NICKNAME_DATA.map((d, i) => [d.name, { emoji: d.emoji, color: AVATAR_COLORS[i % AVATAR_COLORS.length] }])
);

const STORAGE_KEY = 'lounge_nicknames_cache';

function getNicknameCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveNicknameCache(cache) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {}
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// userId + postId 조합으로 결정론적 닉네임 반환
// 같은 글 내 댓글은 동일 닉네임 유지
// 다른 글에서는 다른 닉네임 배정
export function getAnonymousNickname(userId, postId) {
  if (!userId || !postId) {
    return NICKNAME_DATA[Math.floor(Math.random() * NICKNAME_DATA.length)].name;
  }

  const key = `${userId}::${postId}`;
  const cache = getNicknameCache();

  if (cache[key]) return cache[key];

  const idx = hashCode(key) % NICKNAME_DATA.length;
  const nickname = NICKNAME_DATA[idx].name;

  cache[key] = nickname;
  saveNicknameCache(cache);

  return nickname;
}

// 닉네임 문자열로 아바타 { emoji, color } 반환
export function getAnonymousAvatarByNickname(nickname) {
  if (NICKNAME_MAP.has(nickname)) return NICKNAME_MAP.get(nickname);
  const idx = hashCode(nickname ?? '') % AVATAR_COLORS.length;
  return { emoji: '🐾', color: AVATAR_COLORS[idx] };
}

export function formatRelativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}일 전`;
  return new Date(isoString).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}
