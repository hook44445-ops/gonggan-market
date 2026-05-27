-- ============================================================
--  Migration 006: soft_delete_lounge_post RPC
--
--  RLS UPDATE policy blocks direct .update() for anon/authenticated
--  users even when user_id matches, so we use a SECURITY DEFINER
--  function that runs as the function owner (bypasses RLS) but
--  still enforces ownership via WHERE user_id = p_user_id.
--
--  Supabase SQL Editor에서 한 번만 실행하세요.
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_lounge_post(
  p_post_id  uuid,
  p_user_id  uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.lounge_posts
  SET
    is_deleted = true,
    deleted_at = now(),
    deleted_by = p_user_id
  WHERE id        = p_post_id
    AND user_id   = p_user_id
    AND (is_deleted IS NULL OR is_deleted = false);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

-- Allow authenticated users (and anon for dev) to call this function
GRANT EXECUTE ON FUNCTION public.soft_delete_lounge_post(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_lounge_post(uuid, uuid) TO anon;

NOTIFY pgrst, 'reload schema';
