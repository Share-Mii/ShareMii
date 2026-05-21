-- Admin foundation: roles and staff helpers

DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('user', 'moderator', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'user';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_hidden boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()),
    'user'::public.user_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() IN ('moderator', 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() = 'admin';
$$;

-- Bootstrap first admin before role guard trigger exists
UPDATE public.profiles
SET role = 'admin'
WHERE username_normalized = 'cen0b';

CREATE OR REPLACE FUNCTION public.profiles_guard_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_setting('sharemii.admin_rpc', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Cannot change role';
    END IF;
  END IF;

  IF NEW.profile_hidden IS DISTINCT FROM OLD.profile_hidden THEN
    IF current_setting('sharemii.admin_rpc', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Cannot change profile visibility';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_role ON public.profiles;
CREATE TRIGGER profiles_guard_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_role();

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

REVOKE ALL ON FUNCTION public.profiles_guard_role() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
