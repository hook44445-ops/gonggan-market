// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
//
// 라운지는 단순 커뮤니티 게시판이 아닙니다.
// 사람이 머무는 공간 안에서 신뢰가 생기고,
// 그 신뢰가 거래로 이어지는 구조입니다.
// ─────────────────────────────────────────────────────

const NICKNAMES = [
  '사자코끼리','날쌘다람쥐','파파스머프','졸린판다',
  '배고픈수달','민트고양이','새벽올빼미','행복한코끼리',
  '용감한사자','느린거북이','빠른치타','조용한부엉이',
  '달리는말','수영하는오리','나는독수리','잠자는곰',
  '노래하는새','뛰는토끼','헤엄치는물고기','웃는하마',
  '감동한사자','웃긴고양이','핑크판다','졸린너구리',
  '신난강아지','조용한고슴도치','빠른매','느긋한거북',
  '귀여운펭귄','진지한독수리','활발한원숭이','부지런한비버',
  '온화한기린','씩씩한호랑이','영리한여우','귀여운토끼',
  '차분한고양이','활기찬참새','따뜻한북극곰','용감한펭귄',
];

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
    return NICKNAMES[Math.floor(Math.random() * NICKNAMES.length)];
  }

  const key = `${userId}::${postId}`;
  const cache = getNicknameCache();

  if (cache[key]) return cache[key];

  const idx = hashCode(key) % NICKNAMES.length;
  const nickname = NICKNAMES[idx];

  cache[key] = nickname;
  saveNicknameCache(cache);

  return nickname;
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
