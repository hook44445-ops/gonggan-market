-- ════════════════════════════════════════════════════════════════════
-- Phase 20.6 — lounge_posts 관리자 수정/삭제 RLS 수정
--
--   증상: 관리자 삭제(soft delete = update is_deleted) 시
--         "new row violates row-level security policy" 발생.
--   원인: 기존 "lounge_posts: admin update" 정책에 WITH CHECK 가 명시되지 않아
--         새 행(soft delete 결과)이 정책을 통과하지 못하는 환경이 있음.
--   수정: 관리자(users.role='admin')는 모든 lounge_posts 를 update/soft-delete 가능하도록
--         USING + WITH CHECK 를 모두 명시한다. 일반 사용자는 기존대로 자신의 글만.
--
--   범위: lounge_posts 만. 다른 테이블 RLS·기존 기능·Hard Delete 는 건드리지 않는다.
--         삭제는 기존 Soft Delete(is_deleted=true) 방식 유지 — DELETE 권한은 부여하지 않는다.
-- ════════════════════════════════════════════════════════════════════

-- 관리자 update 정책 재생성(USING + WITH CHECK 명시) — 관리자는 모든 글 수정/소프트삭제 가능.
drop policy if exists "lounge_posts: admin update" on public.lounge_posts;
create policy "lounge_posts: admin update" on public.lounge_posts
  for update to authenticated
  using      (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));

-- 일반 사용자(로그인)는 자신의 글만 수정/소프트삭제 — 기존 정책 재확인(변경 없음, 멱등 재생성).
drop policy if exists "lounge_posts: owner update" on public.lounge_posts;
create policy "lounge_posts: owner update" on public.lounge_posts
  for update to authenticated
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 스키마 캐시 리로드(PostgREST).
notify pgrst, 'reload schema';

-- ── 검증(수동) ──────────────────────────────────────────────────────
--   · 관리자 계정: 임의 글 update → 성공(수정/소프트삭제 가능)
--   · 일반 사용자: 자기 글 update → 성공 / 타인 글 update → 0 rows(정책상 차단)
--   · 삭제는 여전히 is_deleted=true(Soft Delete). Hard Delete 없음.
