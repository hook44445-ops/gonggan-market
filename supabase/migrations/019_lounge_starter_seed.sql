-- ════════════════════════════════════════════════════════════════════
-- 019_lounge_starter_seed.sql
-- [라운지] 초기 운영 콘텐츠 20개 — 첫 진입 시 정상 카드(제목/본문/카테고리) 노출.
--
-- 배경:
--   · lounge_posts 에 title=NULL 인 더미/테스트 row 가 다수 존재해 피드가 비어 보임.
--   · 앱은 seed 를 별도 테이블 seed_lounge_posts(004) 에서 읽는데 해당 테이블이 비어 있음.
--   · 따라서 정상 운영 글이 화면에 노출되지 않음.
--
-- 처리:
--   · is_seed=true 운영 글 20개를 lounge_posts 에 직접 삽입.
--     (getLoungePosts 는 lounge_posts 를 읽고 is_seed 글도 "운영" 배지로 정상 렌더)
--   · 카테고리는 014 정리본 기준 활성 카테고리만 사용
--     (interior/review/quote_worry/recommend/room_deco/move_in) — 비활성(game/pet/travel/chat) 제외.
--   · is_story=false / is_visible=true / is_deleted=false / is_hidden=false 명시 → 노출 필터 통과 보장.
--   · created_at 분산 + 자연스러운 조회/좋아요/댓글 수 부여.
--
-- 멱등(idempotent): title 중복이면 재실행해도 추가 안 됨(WHERE NOT EXISTS 가드).
-- 추가 전용 · 기존 row 삭제/변경 없음.
-- Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

with seed(nick, cat, title, content, rn) as (
  select * from (values
    ('공간마켓','interior',    '평수별 인테리어 비용 가이드',   '20평·30평·40평 기준 평균 시공 비용과 항목별 단가를 정리했어요. 견적 받기 전에 대략적인 예산 감을 잡아보세요.',  1),
    ('공간마켓','interior',    '도배 전 꼭 확인할 것',          '곰팡이·결로·벽 상태 점검, 기존 벽지 제거 여부, 친환경 등급 등 도배 시공 전 체크리스트를 정리했습니다.',        2),
    ('공간마켓','interior',    '욕실 리모델링 순서',            '철거 → 방수 → 타일 → 설비 → 마감. 단계별로 무엇을 확인해야 하는지, 흔한 실수는 무엇인지 안내합니다.',         3),
    ('공간마켓','interior',    '공간마켓 사용법 (의뢰인)',      '견적 요청 → 업체 비교 → 안전결제 → 단계 확인 → 정산까지. 처음 오신 의뢰인을 위한 사용 가이드입니다.',         4),
    ('공간마켓','recommend',   '공간마켓 사용법 (업체)',        '업체 등록 → 영업지역 설정 → 입찰 → 시공 기록 → 정산. 파트너 업체를 위한 운영 가이드입니다.',                  5),
    ('공간마켓','quote_worry', '에스크로란 무엇인가요',         '공사비를 토스페이먼츠가 안전하게 보관하고, 단계 확인 후 업체에 나눠 지급하는 안전결제 구조를 쉽게 설명합니다.', 6),
    ('공간마켓','quote_worry', '견적 비교 잘하는 법',           '금액만 보지 마세요. 시공 범위·자재·기간·후기·재계약률을 함께 비교하는 방법을 알려드립니다.',                  7),
    ('공간마켓','recommend',   '시공업체 고르는 기준',          '공간온도, 완료 건수, 분쟁 이력, 응답 속도, 포트폴리오. 믿을 수 있는 업체를 고르는 핵심 기준입니다.',          8),
    ('공간마켓','quote_worry', '계약서 꼭 확인할 항목',         '공사 범위, 자재 명세, 일정, 추가비용 조건, A/S 보증. 계약 전 반드시 확인할 항목을 체크리스트로 정리했어요.',   9),
    ('공간마켓','review',      '인테리어 실패 사례 TOP5',       '소통 부족, 계약서 미작성, 선금 과다, 일정 지연, 마감 불량. 실패를 피하는 방법까지 함께 정리했습니다.',         10),
    ('공간마켓','interior',    '여름 장마 전 필수 공사',        '방수, 결로 방지, 베란다 확장부 점검 등 장마철 전에 해두면 좋은 공사를 안내합니다.',                           11),
    ('공간마켓','move_in',     '신축 입주 인테리어 순서',       '입주 청소 → 필름/도배 → 조명/콘센트 → 가구. 신축 입주 시 효율적인 인테리어 순서를 알려드립니다.',             12),
    ('공간마켓','interior',    '바닥재 종류별 장단점',          '강마루·강화마루·장판·타일의 내구성, 가격, 시공성, 관리 난이도를 비교했습니다.',                               13),
    ('공간마켓','room_deco',   '벽지 vs 페인트 비교',           '비용, 시공 기간, 분위기, 유지보수 측면에서 벽지와 페인트를 비교해 선택을 돕습니다.',                           14),
    ('공간마켓','interior',    '주방 리모델링 비용 가이드',     '상부장·하부장·상판·싱크대·후드 교체 기준 평균 비용과 절약 팁을 정리했습니다.',                                 15),
    ('공간마켓','room_deco',   '욕실 타일 셀프 교체 가능?',     '셀프 시공의 한계와 위험(방수·구배), 전문가에게 맡겨야 하는 경우를 솔직하게 안내합니다.',                       16),
    ('공간마켓','interior',    '상가 인테리어 주의사항',        '소방·전기 용량, 임대차 원상복구 조건, 영업 일정 등 상가 인테리어 시 꼭 챙길 점을 정리했어요.',                17),
    ('공간마켓','quote_worry', '공간온도란 무엇인가요',         '완료된 거래, 후기, 재계약, 응답률이 쌓일수록 올라가는 신뢰 지수 "공간온도"를 설명합니다.',                    18),
    ('공간마켓','quote_worry', '보증금이 왜 필요한가요',        '보증금은 수수료가 아니라 고객 보호장치입니다. 법인계좌 보관, 공사 완료 시 100% 반환 구조를 설명합니다.',       19),
    ('공간마켓','review',      '공간안전결제 이용 후기',        '실제 의뢰인들이 단계별 안전결제를 이용한 경험과, 분쟁 없이 마무리된 거래 사례를 모았습니다.',                  20)
  ) as v(nick, cat, title, content, rn)
)
insert into public.lounge_posts (
  user_id, anonymous_nickname, category, title, content,
  image_urls, is_seed, has_badge,
  is_story, is_visible, is_deleted, is_hidden,
  view_count, like_count, comment_count, created_at
)
select
  null, s.nick, s.cat, s.title, s.content,
  array[]::text[], true, true,
  false, true, false, false,
  ((s.rn * 137) % 1700) + 180,                 -- view_count: 180~1879 자연 분산
  ((s.rn * 17)  % 70)  + 8,                     -- like_count: 8~77
  ((s.rn * 5)   % 22)  + 1,                     -- comment_count: 1~22
  now() - ((s.rn * 6) || ' hours')::interval    -- created_at: 6h 간격 분산
from seed s
where not exists (
  select 1 from public.lounge_posts p
  where p.is_seed = true and p.title = s.title
);

-- 확인: 운영 글 카테고리별 개수
select category, count(*) as seed_posts
from public.lounge_posts
where is_seed = true and is_visible is not false and is_deleted = false and is_hidden = false
group by category
order by category;
