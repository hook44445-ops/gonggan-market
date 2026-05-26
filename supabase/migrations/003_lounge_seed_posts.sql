-- ============================================================
--  003 — lounge_seed_posts (관리자 관리 seed 콘텐츠)
--  Supabase SQL Editor에서 실행하세요.
-- ============================================================

create table if not exists public.lounge_seed_posts (
  id              uuid        primary key default gen_random_uuid(),
  category        text        not null default 'daily',
  title           text,
  content         text        not null,
  image_urls      text[]      not null default '{}',
  nickname        text        not null default '공간러',
  is_active       boolean     not null default true,
  show_on_lounge  boolean     not null default true,
  sort_order      integer     not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create or replace trigger lounge_seed_posts_updated_at
  before update on public.lounge_seed_posts
  for each row execute procedure public.set_updated_at();

create index if not exists lounge_seed_posts_active_idx
  on public.lounge_seed_posts (is_active, show_on_lounge, sort_order asc);

alter table public.lounge_seed_posts enable row level security;

-- 활성화된 seed만 공개 조회
create policy "lounge_seed_posts: public read active" on public.lounge_seed_posts
  for select using (is_active = true and show_on_lounge = true);

-- 관리자 전체 접근
create policy "lounge_seed_posts: admin all" on public.lounge_seed_posts
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- ── 초기 seed 게시글 12개 ────────────────────────────────────
insert into public.lounge_seed_posts (category, title, content, nickname, sort_order) values

  ('interior', '견적 받을 때 꼭 물어봐야 할 질문 모음',
   '인테리어 업체에 견적 요청할 때 이것만 확인하면 낭패를 피할 수 있어요.

1. 자재 브랜드/등급을 명시해달라고 하세요
2. 공사 전·후 사진 제공 여부 확인
3. AS 기간과 범위 서면으로 받기
4. 철거 폐기물 처리 포함 여부
5. 일정 지연 시 페널티 조항

특히 1번이 제일 중요해요. "합리적인 자재"는 업체마다 기준이 달라요.',
   '공간마켓', 0),

  ('interior', '욕실 리모델링 전 꼭 체크할 것',
   '욕실 공사는 순서가 틀리면 전부 뜯어내야 해요.

방수 → 타일 → 설비 순으로 진행되는지 확인하세요.
환기팬 위치를 미리 정하지 않으면 나중에 추가 공사 비용이 발생합니다.

누수 테스트는 공사 완료 후 48시간 이후에 확인하는 게 안전해요.',
   '공간마켓', 1),

  ('interior', '주방 교체 후 후회하는 포인트 TOP5',
   '실제 시공 후기를 모아보니 이런 점을 후회하는 분들이 많더라고요.

1. 수납공간 계획을 덜 한 것
2. 콘센트 위치를 안 바꾼 것
3. 싱크대 높이 조정을 못 한 것
4. 환기 후드 크기를 줄인 것
5. 상부장 끝까지 안 올린 것

리모델링 전 기존 불편함 목록을 꼼꼼히 적어두세요.',
   '공간마켓', 2),

  ('interior', '24평 아파트 전체 도배 비용 기준',
   '2024년 기준 서울/수도권 24평 기준 도배 비용이에요.

실크 도배지 기준: 약 70~100만원
합지 도배지: 약 40~60만원

천장 포함 여부, 걸레받이 처리, 문틀 도배 추가 여부에 따라 가격차가 커요.

견적서에 "포함 항목"을 명시해달라고 요청하는 게 분쟁 예방의 핵심이에요.',
   '공간마켓', 3),

  ('room_deco', '작은 거실 넓어 보이게 하는 인테리어 팁',
   '10평대 거실도 이렇게 하면 훨씬 넓어 보여요.

- 소파를 벽에 붙이지 않기 (10~15cm 띄우기)
- 낮은 가구 위주로 배치
- 커튼은 천장 높이까지 올리기
- 러그로 공간 영역 나누기
- 조명은 포인트 조명 하나 추가

가구 색은 바닥과 비슷한 계열로 맞추면 공간이 퍼져 보여요.',
   '공간마켓', 4),

  ('room_deco', '조명 바꾸고 집 분위기 달라진 후기',
   '거실 천장 형광등 → 간접조명 + 펜던트로 바꿨더니 완전히 다른 공간이 됐어요.

비용은 전구 포함 15만원 정도 들었고 직접 설치했어요.
(전기 공사 자격증 없이 교체 가능한 조명 타입으로 선택)

침실은 따뜻한 색 온도(2700K), 주방은 밝은 흰색(5000K)으로 구분하니 생활이 달라졌어요.',
   '공간마켓', 5),

  ('worry', '인테리어 업체 견적 차이 많이 날 때 비교 방법',
   '같은 공사인데 견적이 2배 차이나는 경우 이렇게 비교하세요.

1. 자재 등급 비교 (브랜드명 명시 요청)
2. 공사 범위 항목별 분리 확인
3. 인건비/자재비 구분 요청
4. 비슷한 공사 시공 사례 포트폴리오 확인
5. 업체 리뷰/공간온도 확인

가장 싼 견적이 아닌, 항목이 제일 명확한 견적을 선택하는 게 낫습니다.',
   '공간마켓', 6),

  ('worry', '공사 일정 밀릴 때 대응 방법',
   '계약서에 일정 지연 관련 조항이 없으면 분쟁이 생겼을 때 대응이 어려워요.

계약 전 확인할 것:
- 착공일/완공일 명시
- 지연 시 배상 조항
- 중간 점검 일정

공사 중 지연이 발생하면 카카오톡/문자로 기록을 남기고, 구두 약속은 텍스트로 재확인하세요.',
   '공간마켓', 7),

  ('startup', '카페 인테리어 예산 잡는 실전 가이드',
   '10평 기준 카페 인테리어 예산 구성이에요.

기본 인테리어(도장/타일/조명): 500~800만원
간판/외부 사인: 100~200만원
가구/집기: 200~400만원
주방설비: 별도

총 10평 기준 1,200~1,800만원 정도를 기본으로 잡으세요.
임대인 시설 지원금(핏아웃)이 있는 경우 협의하면 절반 이하로도 가능합니다.',
   '공간마켓', 8),

  ('startup', '상가 공사 전 반드시 확인할 것',
   '상가 인테리어는 주거와 달리 추가 확인 사항이 있어요.

1. 건물 용도 (근생/업무/판매 등) - 업종 가능 여부
2. 소방 설비 기준 (스프링클러, 비상구)
3. 전기 용량 (카페/음식점은 추가 증설 필요할 수 있음)
4. 임대인 동의 필요 공사 범위
5. 원상복구 조항

특히 전기 용량은 사전에 한전에 문의하세요.',
   '공간마켓', 9),

  ('chat', '인테리어 처음 할 때 제일 걱정되는 부분은?',
   '저는 처음 인테리어할 때 업체 선택이 제일 막막했어요.

아는 사람 소개로 했다가 AS가 안 되는 경우도 있고, 온라인 후기만 보고 했다가 실제 시공과 다른 경우도 있었거든요.

여러분은 처음 할 때 뭐가 제일 걱정됐나요? 아니면 지금 고민 중인 분들, 어떤 점이 제일 불안하세요?',
   '공간러', 10),

  ('chat', '집 분위기, 어떤 스타일 좋아하세요?',
   '요즘 제 취향이 계속 바뀌더라고요. 작년엔 북유럽 감성이 좋았는데, 요즘은 웜톤 내추럴 스타일이 끌려요.

여러분은 어떤 인테리어 스타일 좋아하세요?
- 미니멀 (화이트/그레이 위주)
- 내추럴 (우드/린넨 소재)
- 빈티지 (앤틱/레트로)
- 모던 (블랙/메탈)

댓글로 알려주세요 :)',
   '공간러', 11)

on conflict do nothing;
