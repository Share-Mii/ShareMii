-- Bug reports use a separate Discord webhook + secret from moderation/content reports.
-- Vault: discord_bug_notify_secret (same value as DISCORD_BUG_NOTIFY_SECRET on the function)
-- Deploy: supabase functions deploy discord-bug-notify --no-verify-jwt

CREATE OR REPLACE FUNCTION public._discord_notify_bug(p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
  v_url text := 'https://bejtwsdmmvgpjcolnqdx.supabase.co/functions/v1/discord-bug-notify';
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'discord_bug_notify_secret'
    LIMIT 1;
  EXCEPTION
    WHEN undefined_table OR invalid_schema_name THEN
      RETURN;
  END;

  IF v_secret IS NULL OR v_secret = '' THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-discord-bug-notify-secret', v_secret
    ),
    body := jsonb_build_object('payload', p_payload)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._discord_notify_bug(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._discord_notify_bug(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public._discord_notify_bug(jsonb) FROM authenticated;

CREATE OR REPLACE FUNCTION public._discord_notify_bug_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
BEGIN
  SELECT username INTO v_username FROM public.profiles WHERE id = NEW.reporter_id;

  PERFORM public._discord_notify_bug(
    jsonb_build_object(
      'id', NEW.id,
      'reporter_id', NEW.reporter_id,
      'reporter_username', COALESCE(v_username, 'unknown'),
      'title', NEW.title,
      'description', NEW.description,
      'page_url', NEW.page_url,
      'user_agent', NEW.user_agent,
      'status', NEW.status,
      'priority', NEW.priority,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS discord_notify_bug_report ON public.bug_reports;
CREATE TRIGGER discord_notify_bug_report
  AFTER INSERT ON public.bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION public._discord_notify_bug_report();
