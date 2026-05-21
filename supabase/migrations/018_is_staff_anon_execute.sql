-- RLS policies on comments, miis, profiles call public.is_staff(). Anonymous clients must be
-- able to execute the function when Postgres evaluates OR clauses; otherwise SELECT fails with 403.

GRANT EXECUTE ON FUNCTION public.is_staff() TO anon;
