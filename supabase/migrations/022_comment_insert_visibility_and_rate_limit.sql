-- Comment INSERT commonly failed with HTTP 403 because the INSERT policy used
--   EXISTS (SELECT 1 FROM public.miis WHERE id = mii_id)
-- which is filtered by Miis SELECT RLS inside the EXISTS subquery. That can deny
-- even when commenting should be allowed. Use an explicit SECURITY DEFINER probe
-- that mirrors the Miis SELECT policy intent.
--
-- Also run the hourly comment rate-limit COUNT outside comment SELECT RLS so the
-- BEFORE trigger can't fail spuriously for invokers affected by moderation rows.

CREATE OR REPLACE FUNCTION public.comment_target_mii_allows_feedback(p_mii_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.miis m
    WHERE m.id = p_mii_id
      AND (
        m.visibility = 'public'
        OR (auth.uid() IS NOT NULL AND m.user_id = auth.uid())
        OR public.is_staff()
      )
  );
$$;

REVOKE ALL ON FUNCTION public.comment_target_mii_allows_feedback(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comment_target_mii_allows_feedback(uuid) TO authenticated;

DROP POLICY IF EXISTS "comments_insert" ON public.comments;
CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.comment_target_mii_allows_feedback(mii_id)
    AND char_length(trim(body)) >= 1
    AND char_length(body) <= 500
    AND char_length(trim(author_name)) >= 1
    AND char_length(author_name) <= 64
  );

CREATE OR REPLACE FUNCTION public.comments_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
  uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::int INTO recent_count
  FROM public.comments
  WHERE user_id = uid
    AND created_at > now() - interval '1 hour';

  IF recent_count >= 30 THEN
    RAISE EXCEPTION 'Comment rate limit exceeded';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.comments_rate_limit() FROM PUBLIC, anon, authenticated;
