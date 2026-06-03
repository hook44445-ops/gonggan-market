-- ════════════════════════════════════════════════════════════════════
-- 018_site_visit_estimate_72h.sql
-- [정책] 현장견적 카운트다운: 24h/48h → 72h 통일 (2026.06)
--   이유: 공간마켓은 즉시예약형이 아니라 현장견적·시공 일정 조율형 플랫폼.
--   전화/채팅/현장방문/가족 의사결정/이동시간이 필요 → 72h(3일) 기준.
--
-- 처리: 진행 중(견적서 미제출 + 아직 유효)인 건만 completed_at + 72h 로 재계산.
--       이미 만료된 건은 그대로 유지(소급 부활 금지).
-- 멱등: 재실행해도 유효 건만 갱신.
-- ════════════════════════════════════════════════════════════════════

update public.site_visits sv
set estimate_due_at = sv.completed_at + interval '72 hours',
    updated_at      = now()
where sv.status = 'completed'
  and sv.completed_at is not null
  and sv.estimate_due_at is not null
  and sv.estimate_due_at > now()                         -- 아직 유효(미만료)
  and sv.estimate_due_at < sv.completed_at + interval '72 hours'  -- 기존 24/48h → 연장만
  and not exists (                                       -- 견적서 미제출
    select 1 from public.estimates e where e.site_visit_id = sv.id
  );
