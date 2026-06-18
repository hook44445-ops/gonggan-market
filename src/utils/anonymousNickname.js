// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
//
// 라운지는 단순 커뮤니티 게시판이 아닙니다.
// 사람이 머무는 공간 안에서 신뢰가 생기고,
// 그 신뢰가 거래로 이어지는 구조입니다.
// ─────────────────────────────────────────────────────

// 위트있는 자동 닉네임 — 공간/인테리어 테마 + 동물 조합.
// 너무 딱딱하지 않게, 커뮤니티 톤에 맞춘 익명 닉네임.
const NICKNAME_DATA = [
  // 인테리어/공간 테마 (위트)
  { name: '공사요정',      emoji: '🧚' },
  { name: '견적요정',      emoji: '🧚‍♀️' },
  { name: '벽지탐험가',    emoji: '🧭' },
  { name: '몰딩장인',      emoji: '📐' },
  { name: '타일수호자',    emoji: '🛡️' },
  { name: '공간덕후',      emoji: '🛋️' },
  { name: '수리요정',      emoji: '🔧' },
  { name: '집꾸미는하마',  emoji: '🦛' },
  { name: '페인트고양이',  emoji: '🐱' },
  { name: '도배하는펭귄',  emoji: '🐧' },
  { name: '줄눈마스터',    emoji: '🧱' },
  { name: '조명요정',      emoji: '💡' },
  { name: '셀프인테리어러', emoji: '🪛' },
  { name: '평면도덕후',    emoji: '📋' },
  { name: '가벽수집가',    emoji: '🚪' },
  { name: '바닥재현자',    emoji: '🪵' },
  { name: '단열장인',      emoji: '🧤' },
  { name: '커튼탐험가',    emoji: '🪟' },
  { name: '욕실연구가',    emoji: '🚿' },
  { name: '수납의신',      emoji: '🗄️' },
  { name: '집들이요정',    emoji: '🏡' },
  { name: '인테리어유목민', emoji: '🧳' },
  { name: '몰딩수호대',    emoji: '⚒️' },
  { name: '벽돌사랑꾼',    emoji: '🧱' },
  { name: '데스크셋업러',  emoji: '🖥️' },
  // 동물 위트 (기존 톤 유지)
  { name: '졸린판다',      emoji: '🐼' },
  { name: '배고픈수달',    emoji: '🦦' },
  { name: '새벽올빼미',    emoji: '🦉' },
  { name: '느긋한거북',    emoji: '🐢' },
  { name: '신난강아지',    emoji: '🐶' },
  { name: '웃는하마',      emoji: '🦛' },
  { name: '핑크판다',      emoji: '🐼' },
  { name: '부지런한비버',  emoji: '🦫' },
  { name: '온화한기린',    emoji: '🦒' },
  { name: '영리한여우',    emoji: '🦊' },
  { name: '귀여운펭귄',    emoji: '🐧' },
  { name: '따뜻한북극곰',  emoji: '🐻‍❄️' },
  { name: '활발한원숭이',  emoji: '🐒' },
  { name: '씩씩한호랑이',  emoji: '🐯' },
  { name: '조용한고슴도치', emoji: '🦔' },
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

// 라운지 전용 상대시간 — N분/N시간/N일 전. 5일이 지난 글은 시간을 표시하지 않는다(빈 문자열).
// (채팅/토큰 등 다른 화면의 formatRelativeTime 동작은 변경하지 않기 위해 별도 함수로 분리)
export function formatLoungeRelativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}시간 전`;
  const days = Math.floor(hrs / 24);
  if (days <= 5) return `${days}일 전`;
  return ''; // 5일이 지난 게시글은 시간 미표시
}

// 성별 기준 사람 이모티콘 — 남성 👨 / 여성 👩 / 미등록(없음) 🧑.
// 라운지 작성자·댓글 식별 이모티콘으로 사용(동물 이모티콘 대체).
export function getGenderEmoji(gender) {
  if (gender === 'male'   || gender === 'M' || gender === '남') return '👨';
  if (gender === 'female' || gender === 'F' || gender === '여') return '👩';
  return '🧑';
}
