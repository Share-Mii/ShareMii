-- Explicit EXECUTE grants for staff moderation helpers added alongside roadmap migrations.

REVOKE ALL ON FUNCTION public.staff_set_trusted_creator(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_set_trusted_creator(uuid, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.staff_bulk_dismiss_reports(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_bulk_dismiss_reports(uuid[]) TO authenticated;
