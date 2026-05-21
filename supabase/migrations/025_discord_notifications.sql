-- Discord notifications: DB triggers → Edge Function (discord-notify) via pg_net.
-- Configure vault secrets (Dashboard → Project Settings → Vault) with the same
-- DISCORD_NOTIFY_SECRET you set via: supabase secrets set DISCORD_NOTIFY_SECRET=...

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public._discord_notify(p_event text, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
  v_url text := 'https://bejtwsdmmvgpjcolnqdx.supabase.co/functions/v1/discord-notify';
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'discord_notify_secret'
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
      'x-discord-notify-secret', v_secret
    ),
    body := jsonb_build_object('event', p_event, 'payload', p_payload)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._discord_notify(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._discord_notify(text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public._discord_notify(text, jsonb) FROM authenticated;

CREATE OR REPLACE FUNCTION public._discord_notify_content_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
BEGIN
  SELECT username INTO v_username FROM public.profiles WHERE id = NEW.reporter_id;

  PERFORM public._discord_notify(
    'content_report',
    jsonb_build_object(
      'id', NEW.id,
      'reporter_id', NEW.reporter_id,
      'reporter_username', COALESCE(v_username, 'unknown'),
      'target_type', NEW.target_type,
      'target_id', NEW.target_id,
      'reason', NEW.reason,
      'priority', NEW.priority,
      'details', NEW.details,
      'status', NEW.status,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._discord_notify_auto_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._discord_notify(
    'auto_flag',
    jsonb_build_object(
      'id', NEW.id,
      'kind', NEW.kind,
      'comment_id', NEW.comment_id,
      'user_id', NEW.user_id,
      'mii_id', NEW.mii_id,
      'body_excerpt', NEW.body_excerpt,
      'detail', NEW.detail,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._discord_notify_moderation_action()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
BEGIN
  SELECT username INTO v_username FROM public.profiles WHERE id = NEW.actor_id;

  PERFORM public._discord_notify(
    'moderation_action',
    jsonb_build_object(
      'id', NEW.id,
      'actor_id', NEW.actor_id,
      'actor_username', COALESCE(v_username, 'staff'),
      'action', NEW.action,
      'target_type', NEW.target_type,
      'target_id', NEW.target_id,
      'metadata', NEW.metadata,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS discord_notify_content_report ON public.content_reports;
CREATE TRIGGER discord_notify_content_report
  AFTER INSERT ON public.content_reports
  FOR EACH ROW
  EXECUTE FUNCTION public._discord_notify_content_report();

DROP TRIGGER IF EXISTS discord_notify_auto_flag ON public.moderation_auto_flags;
CREATE TRIGGER discord_notify_auto_flag
  AFTER INSERT ON public.moderation_auto_flags
  FOR EACH ROW
  EXECUTE FUNCTION public._discord_notify_auto_flag();

DROP TRIGGER IF EXISTS discord_notify_moderation_action ON public.moderation_actions;
CREATE TRIGGER discord_notify_moderation_action
  AFTER INSERT ON public.moderation_actions
  FOR EACH ROW
  EXECUTE FUNCTION public._discord_notify_moderation_action();
