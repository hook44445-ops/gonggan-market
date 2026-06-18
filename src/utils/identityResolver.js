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

// 업체 표시명 우선순위: display_name → anonymous_name → name → '공간파트너'
export function resolveCompanyIdentity(company) {
  return (
    company?.display_name
    || company?.anonymous_name
    || company?.name
    || COMPANY_FALLBACK
  );
}

// 의뢰인 표시명 우선순위: anonymous_name → anonymous_nickname → '공간이웃'
export function resolveConsumerIdentity(consumer) {
  return (
    consumer?.anonymous_name
    || consumer?.anonymous_nickname
    || CONSUMER_FALLBACK
  );
}

// 통합 진입점 — role 에 따라 적절한 익명 Identity 표시명을 반환한다.
//   role = 'company'  → source 는 업체 객체(또는 { display_name, anonymous_name, name })
//   role = 'consumer' → source 는 작성자/사용자 객체(또는 { anonymous_name, anonymous_nickname })
export function resolveDisplayIdentity(source, role) {
  return role === IDENTITY_ROLE.COMPANY
    ? resolveCompanyIdentity(source)
    : resolveConsumerIdentity(source);
}
