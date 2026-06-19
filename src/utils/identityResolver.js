// ════════════════════════════════════════════════════════════════════════════
// identityResolver — 역할(Role)별 익명 아이덴티티 표시명 단일 결정 지점
//
//   의뢰인/업체가 각각 독립적인 익명 Identity 를 갖도록 표시명을 한 곳에서 결정한다.
//   향후 DB 에 아래 컬럼이 추가되더라도 이 Resolver 의 데이터 소스만 넓히면 되고,
//   UI 코드(표시 지점)는 수정하지 않는다.
//     · company.display_name   (향후) — 업체가 직접 정한 표시명
//     · company.anonymous_name (향후) — 업체 익명 활동명
//     · consumer.anonymous_name(향후) — 의뢰인 익명 활동명
//
//   ⚠️ 이번 단계는 표시(Display) 전용. 저장/스키마/마이그레이션 변경 없음.
//   현재 DB 에는 위 향후 컬럼이 없으므로 자연스럽게 기존 값으로 폴백된다.
// ════════════════════════════════════════════════════════════════════════════

export const IDENTITY_ROLE = Object.freeze({ CONSUMER: 'consumer', COMPANY: 'company' });

const COMPANY_FALLBACK  = '공간파트너';
const CONSUMER_FALLBACK = '공간이웃';

// 업체 전용 익명닉네임 풀 — 소비자(anonymousNickname.js)와 독립적으로 관리.
// 라운지에서는 업체 실명을 노출하지 않고 이 익명닉네임을 사용한다(실명은 대화 성사/견적 이후 공개).
const COMPANY_WORDS = [
  '별빛', '공감', '숲', '하늘', '노을', '햇살', '바람', '나무', '정원', '온기',
  '뜰', '물결', '달빛', '새벽', '구름', '이음', '담소', '채움', '빛터', '쉼표',
  '도담', '나래', '소담', '한울', '오름', '여울', '청아', '단아', '미르', '윤슬',
];

function _hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// 동일 업체(키)는 항상 동일 익명닉네임을 반환한다(결정론적). 예: 공간별빛24
export function getCompanyAnonNickname(key) {
  if (key == null || key === '') return COMPANY_FALLBACK;
  const h = _hash(String(key));
  const word = COMPANY_WORDS[h % COMPANY_WORDS.length];
  const num = String(h % 100).padStart(2, '0');
  return `공간${word}${num}`;
}

// 업체 표시명 우선순위(라운지 익명 정책):
//   display_name(향후) → anonymous_name(향후) → 업체 전용 익명닉네임(owner_id/id 기반) → '공간파트너'
//   ※ 업체 실명(name)은 라운지에서 노출하지 않는다.
export function resolveCompanyIdentity(company) {
  if (company?.display_name) return company.display_name;
  if (company?.anonymous_name) return company.anonymous_name;
  const key = company?.owner_id ?? company?.ownerId ?? company?.id ?? null;
  if (key != null) return getCompanyAnonNickname(key);
  return COMPANY_FALLBACK;
}

// 의뢰인 익명 코드 — 예: 익명 E421 (영문 1자 + 숫자 3자리). user_id 기준 결정론적.
// 같은 작성자는 항상 같은 코드를 반환한다(없으면 anonymous_nickname/id 를 seed 로 폴백).
export function getConsumerAnonCode(seed) {
  const h = _hash(seed == null ? '' : String(seed));
  const letter = String.fromCharCode(65 + (h % 26)); // A~Z
  const num = String(h % 1000).padStart(3, '0');      // 000~999
  return `익명 ${letter}${num}`;
}

// 의뢰인 표시명 — 라운지 익명 정책: 작성자 닉네임 대신 '익명 코드'로 표시한다.
//   seed = `${user_id}::${post_id}` (원래 익명 시스템과 동일 기준).
//   · 같은 작성자·같은 글  → 동일 코드
//   · 다른 작성자          → 다른 코드
//   · 다른 글             → 다른 코드
//   ※ 과거엔 anonymous_nickname(40개 풀)을 seed로 써서 서로 다른 작성자/글이 같은 코드로
//     충돌(예: 모두 "익명 U794")하는 문제가 있었다. user_id+post_id 직접 해싱으로 충돌 제거.
//   ※ user_id 가 없는 시드/익명 댓글만 저장된 anonymous_nickname 을 seed 로 폴백.
export function resolveConsumerIdentity(consumer) {
  if (consumer?.user_id != null) {
    const pid = consumer?.post_id ?? consumer?.id ?? '';
    return getConsumerAnonCode(`${consumer.user_id}::${pid}`);
  }
  if (consumer?.anonymous_nickname) return getConsumerAnonCode(consumer.anonymous_nickname);
  return CONSUMER_FALLBACK;
}

// 통합 진입점 — role 에 따라 적절한 익명 Identity 표시명을 반환한다.
//   role = 'company'  → source 는 업체 객체(또는 { display_name, anonymous_name, name })
//   role = 'consumer' → source 는 작성자/사용자 객체(또는 { anonymous_name, anonymous_nickname })
export function resolveDisplayIdentity(source, role) {
  return role === IDENTITY_ROLE.COMPANY
    ? resolveCompanyIdentity(source)
    : resolveConsumerIdentity(source);
}
