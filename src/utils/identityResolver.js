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

// 의뢰인 익명 닉네임 Pool — 공간/홈/리빙/인테리어/생활 테마(100개+). 실명·코드·번호 없음.
const LOUNGE_ANONYMOUS_NAMES = [
  '공간러', '공간메이트', '공간친구', '공간연구원', '공간탐험가',
  '공간지킴이', '공간마스터', '공간애호가', '공간매니아', '공간크리에이터',
  '홈러버', '홈스타일러', '홈플래너', '홈메이커', '홈디자이너',
  '홈케어러', '홈감성러', '홈꾸미러', '홈수리러', '홈생활러',
  '리빙러', '리빙메이트', '리빙플래너', '리빙크루', '리빙스타일러',
  '리빙디자이너', '리빙연구원', '리빙매니아', '리빙친구', '리빙러버',
  '집꾸미러', '집수리러', '집사랑러', '집연구원', '집마스터',
  '집메이트', '집생활러', '집케어러', '우리집러', '우리집친구',
  '인테리어러', '인테리어메이트', '인테리어친구', '인테리어플래너', '인테리어연구원',
  '인테리어마스터', '인테리어감성러', '인테리어매니아', '인테리어크루', '인테리어러버',
  '리모델러', 'DIY러', '목공러', '타일러', '도배러',
  '페인트러', '조명러', '수납러', '정리러', '셀프인테리어러',
  '감성러', '감성메이커', '감성공간러', '감성디자이너', '감성플래너',
  '감성메이트', '감성라이프', '감성홈러', '감성빌더', '감성크루',
  '정리왕', '수납왕', '생활고수', '공간고수', '집꾸미기고수',
  '생활메이트', '생활연구원', '생활디자이너', '생활플래너', '생활러',
  '새집꿈나무', '공간꿈나무', '우리동네러', '동네메이트', '동네생활러',
  '공간서포터', '공간빌더', '공간파트너', '공간가이드', '공간브릿지',
  '따뜻한공간', '행복한공간', '포근한집', '햇살가득', '아늑한집',
  '오늘도정리', '오늘도리빙', '오늘도공간', '우리집이야기', '공간이좋아',
];

// 의뢰인 익명 닉네임 — user_id+post_id 를 seed 로 Pool 에서 선택(결정론적).
//   · 같은 글·같은 작성자 → 동일 닉네임 / 다른 글 → 다른 닉네임
export function getConsumerNickname(seed) {
  return LOUNGE_ANONYMOUS_NAMES[_hash(seed == null ? '' : String(seed)) % LOUNGE_ANONYMOUS_NAMES.length];
}

// 의뢰인 표시명 — 라운지 익명 정책: 실명/저장 닉네임 대신 Pool 랜덤 닉네임으로 표시한다.
//   seed = `${user_id}:${post_id}` (같은 글 동일 · 다른 글 상이).
//   ※ '익명 K548' 같은 코드/번호/‘익명’ 텍스트는 사용하지 않는다.
//   ※ user_id 가 없는 시드/익명 댓글만 저장된 anonymous_nickname 을 seed 로 폴백.
export function resolveConsumerIdentity(consumer) {
  if (consumer?.user_id != null) {
    const pid = consumer?.post_id ?? consumer?.id ?? '';
    return getConsumerNickname(`${consumer.user_id}:${pid}`);
  }
  if (consumer?.anonymous_nickname) return getConsumerNickname(consumer.anonymous_nickname);
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
