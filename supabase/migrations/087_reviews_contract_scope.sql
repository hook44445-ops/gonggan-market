-- ════════════════════════════════════════════════════════════════════
-- 087_reviews_contract_scope.sql
-- 리뷰 중복 기준을 '업체(company_id)' 가 아니라 '계약/프로젝트(contract_id)' 로 —
-- 같은 의뢰인이 같은 업체에게 '다른 시공'을 다시 맡겼을 때 새 후기/Before·After 가
-- 정상 등록되도록 한다. (같은 계약엔 후기 1개, 다른 계약이면 같은 고객/업체라도 새 후기 허용)
--
-- 배경(근본원인):
--   · reviews 에 contract_id / customer_id 컬럼이 실제로 없었다(schema/마이그레이션 부재).
--   · createReview() 는 contract_id·customer_id 를 INSERT 하는데, 폴백은 Part2 확장컬럼만
--     제거 → 컬럼 없음 오류가 복구되지 않아 '새 후기 저장 자체가 실패'했다.
--   · 컬럼을 추가하면 (1) 후기 저장이 정상화되고 (2) 계약 단위 중복판정이 가능해진다.
--
-- 원칙:
--   · 추가 전용(additive) — 컬럼/인덱스만 추가. 기존 컬럼·정책·데이터 무변경, 삭제 없음.
--   · FK 는 걸지 않는다(contract_id 는 escrow_payments.id 로 쓰이는 등 소스가 유동적 —
--     기존 getReviewByContract(.eq contract_id) 조회와 동일하게 '값' 만 저장/비교).
--   · 기존 후기 데이터는 그대로 보존(백필/삭제 없음). contract_id 는 신규 후기부터 채워진다.
--
-- Supabase SQL Editor 에서 1회 실행(086 이후). notify 포함.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- 계약/프로젝트 식별자 + 작성 고객 식별자(추가 전용).
alter table public.reviews
  add column if not exists contract_id uuid,
  add column if not exists customer_id uuid;

comment on column public.reviews.contract_id is '후기가 속한 계약/프로젝트 식별자 — 중복판정 기준(같은 계약당 1개). 다른 계약이면 같은 고객/업체라도 새 후기 허용.';
comment on column public.reviews.customer_id is '후기 작성 고객 식별자(user_id 와 동일 값이 들어올 수 있음).';

-- 계약 단위 조회(getReviewByContract)·중복판정 성능용.
create index if not exists idx_reviews_contract on public.reviews (contract_id);

notify pgrst, 'reload schema';
