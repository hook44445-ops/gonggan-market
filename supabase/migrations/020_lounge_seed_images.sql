-- ════════════════════════════════════════════════════════════════════
-- 020_lounge_seed_images.sql
-- [라운지] 운영 seed 글 20개에 대표 이미지(실사) 부여 — 카드/상세에서 정상 노출.
--
-- 배경:
--   019 가 텍스트 운영 글 20개를 삽입했으나 image_urls 가 비어 있어
--   카드 썸네일이 안 보임. 본 마이그레이션이 각 글에 주제별 실사 이미지를 매핑한다.
--
-- 이미지 출처:
--   · 앱이 이미 production 에서 사용 중인 Unsplash 실내/인테리어 사진 세트
--     (src/constants/index.js PHOTOS) 를 재사용 → 렌더 검증된 안정 URL.
--   · 실사 중심(인테리어 현장/거실/주방/방/상가), 랜덤 스톡·AI 이미지 아님.
--   · 제목·본문 주제에 맞춰 매핑(거실/벽/주방/상가/오피스 등).
--
-- 동작(자기완결 · 멱등):
--   1) UPDATE — 이미 존재하는 is_seed 글(019)에서 image_urls 가 비어 있으면 매핑 이미지 채움.
--   2) INSERT — 019 미실행 등으로 글이 없으면 텍스트+이미지 포함해 새로 삽입.
--   → 019 실행 여부와 무관하게 "이미지 포함 운영 글 20개" 가 보장됨.
--   → 재실행해도 중복 없음(제목 가드) · 기존 이미지 덮어쓰지 않음(빈 경우만 채움).
-- 추가/보강 전용 · 기존 row 삭제 없음.
-- Supabase SQL Editor 에서 1회 실행.
-- ════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

with seed(title, cat, content, img, rn) as (
  select * from (values
    ('평수별 인테리어 비용 가이드',  'interior',    '20평·30평·40평 기준 평균 시공 비용과 항목별 단가를 정리했어요. 견적 받기 전에 대략적인 예산 감을 잡아보세요.',  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80',  1),
    ('도배 전 꼭 확인할 것',         'interior',    '곰팡이·결로·벽 상태 점검, 기존 벽지 제거 여부, 친환경 등급 등 도배 시공 전 체크리스트를 정리했습니다.',        'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&q=80',  2),
    ('욕실 리모델링 순서',           'interior',    '철거 → 방수 → 타일 → 설비 → 마감. 단계별로 무엇을 확인해야 하는지, 흔한 실수는 무엇인지 안내합니다.',         'https://images.unsplash.com/photo-1615529182904-14819c35db37?w=800&q=80',  3),
    ('공간마켓 사용법 (의뢰인)',     'interior',    '견적 요청 → 업체 비교 → 안전결제 → 단계 확인 → 정산까지. 처음 오신 의뢰인을 위한 사용 가이드입니다.',         'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80',  4),
    ('공간마켓 사용법 (업체)',       'recommend',   '업체 등록 → 영업지역 설정 → 입찰 → 시공 기록 → 정산. 파트너 업체를 위한 운영 가이드입니다.',                  'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=800&q=80',  5),
    ('에스크로란 무엇인가요',        'quote_worry', '공사비를 토스페이먼츠가 안전하게 보관하고, 단계 확인 후 업체에 나눠 지급하는 안전결제 구조를 쉽게 설명합니다.', 'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=800&q=80',  6),
    ('견적 비교 잘하는 법',          'quote_worry', '금액만 보지 마세요. 시공 범위·자재·기간·후기·재계약률을 함께 비교하는 방법을 알려드립니다.',                  'https://images.unsplash.com/photo-1556020685-ae41abfc9365?w=800&q=80',  7),
    ('시공업체 고르는 기준',         'recommend',   '공간온도, 완료 건수, 분쟁 이력, 응답 속도, 포트폴리오. 믿을 수 있는 업체를 고르는 핵심 기준입니다.',          'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80',  8),
    ('계약서 꼭 확인할 항목',        'quote_worry', '공사 범위, 자재 명세, 일정, 추가비용 조건, A/S 보증. 계약 전 반드시 확인할 항목을 체크리스트로 정리했어요.',   'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80',  9),
    ('인테리어 실패 사례 TOP5',      'review',      '소통 부족, 계약서 미작성, 선금 과다, 일정 지연, 마감 불량. 실패를 피하는 방법까지 함께 정리했습니다.',         'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&q=80', 10),
    ('여름 장마 전 필수 공사',       'interior',    '방수, 결로 방지, 베란다 확장부 점검 등 장마철 전에 해두면 좋은 공사를 안내합니다.',                           'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80', 11),
    ('신축 입주 인테리어 순서',      'move_in',     '입주 청소 → 필름/도배 → 조명/콘센트 → 가구. 신축 입주 시 효율적인 인테리어 순서를 알려드립니다.',             'https://images.unsplash.com/photo-1615529182904-14819c35db37?w=800&q=80', 12),
    ('바닥재 종류별 장단점',         'interior',    '강마루·강화마루·장판·타일의 내구성, 가격, 시공성, 관리 난이도를 비교했습니다.',                               'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80', 13),
    ('벽지 vs 페인트 비교',          'room_deco',   '비용, 시공 기간, 분위기, 유지보수 측면에서 벽지와 페인트를 비교해 선택을 돕습니다.',                           'https://images.unsplash.com/photo-1556020685-ae41abfc9365?w=800&q=80', 14),
    ('주방 리모델링 비용 가이드',    'interior',    '상부장·하부장·상판·싱크대·후드 교체 기준 평균 비용과 절약 팁을 정리했습니다.',                                 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80', 15),
    ('욕실 타일 셀프 교체 가능?',    'room_deco',   '셀프 시공의 한계와 위험(방수·구배), 전문가에게 맡겨야 하는 경우를 솔직하게 안내합니다.',                       'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=800&q=80', 16),
    ('상가 인테리어 주의사항',       'interior',    '소방·전기 용량, 임대차 원상복구 조건, 영업 일정 등 상가 인테리어 시 꼭 챙길 점을 정리했어요.',                'https://images.unsplash.com/photo-1559329007-40df8a9345d8?w=800&q=80', 17),
    ('공간온도란 무엇인가요',        'quote_worry', '완료된 거래, 후기, 재계약, 응답률이 쌓일수록 올라가는 신뢰 지수 "공간온도"를 설명합니다.',                    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80', 18),
    ('보증금이 왜 필요한가요',       'quote_worry', '보증금은 수수료가 아니라 고객 보호장치입니다. 법인계좌 보관, 공사 완료 시 100% 반환 구조를 설명합니다.',       'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=800&q=80', 19),
    ('공간안전결제 이용 후기',       'review',      '실제 의뢰인들이 단계별 안전결제를 이용한 경험과, 분쟁 없이 마무리된 거래 사례를 모았습니다.',                  'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80', 20)
  ) as v(title, cat, content, img, rn)
)

-- 1) 기존 운영 글(019)에 이미지가 비어 있으면 매핑 이미지 채움
, upd as (
  update public.lounge_posts p
  set image_urls = array[s.img]::text[],
      updated_at = now()
  from seed s
  where p.is_seed = true
    and p.title = s.title
    and (p.image_urls is null or cardinality(p.image_urls) = 0)
  returning p.id
)

-- 2) 글이 아예 없으면 텍스트+이미지 포함해 새로 삽입
insert into public.lounge_posts (
  user_id, anonymous_nickname, category, title, content,
  image_urls, is_seed, has_badge,
  is_story, is_visible, is_deleted, is_hidden,
  view_count, like_count, comment_count, created_at
)
select
  null, '공간마켓', s.cat, s.title, s.content,
  array[s.img]::text[], true, true,
  false, true, false, false,
  ((s.rn * 137) % 1700) + 180,
  ((s.rn * 17)  % 70)  + 8,
  ((s.rn * 5)   % 22)  + 1,
  now() - ((s.rn * 6) || ' hours')::interval
from seed s
where not exists (
  select 1 from public.lounge_posts p
  where p.is_seed = true and p.title = s.title
);

-- 확인: 이미지가 채워진 운영 글 수 (정상 시 20)
select count(*) as seed_with_image
from public.lounge_posts
where is_seed = true
  and is_deleted = false and is_hidden = false and is_visible is not false
  and image_urls is not null and cardinality(image_urls) > 0;
