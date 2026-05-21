-- Allow Mii owners to update appearance data (mii_data / mii_data_download) via Mii Maker.

CREATE OR REPLACE FUNCTION public.miis_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  stat_delta int;
  is_owner boolean;
BEGIN
  is_owner := auth.uid() IS NOT NULL AND OLD.user_id = auth.uid();

  IF is_owner THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.creator_name IS DISTINCT FROM OLD.creator_name
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Cannot change ownership or creator';
    END IF;

    IF NEW.views < OLD.views OR NEW.downloads < OLD.downloads OR NEW.favorites < OLD.favorites THEN
      RAISE EXCEPTION 'Stats cannot decrease';
    END IF;

    stat_delta :=
      (NEW.views - OLD.views)
      + (NEW.downloads - OLD.downloads)
      + (NEW.favorites - OLD.favorites);

    IF stat_delta > 1 THEN
      RAISE EXCEPTION 'Stats may only increment by one at a time';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.name IS DISTINCT FROM OLD.name
    OR NEW.creator_name IS DISTINCT FROM OLD.creator_name
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.platform IS DISTINCT FROM OLD.platform
    OR NEW.mii_data IS DISTINCT FROM OLD.mii_data
    OR NEW.mii_data_download IS DISTINCT FROM OLD.mii_data_download
    OR NEW.gender IS DISTINCT FROM OLD.gender
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only view/download/yeah counters can be updated';
  END IF;

  IF NEW.views < OLD.views OR NEW.downloads < OLD.downloads OR NEW.favorites < OLD.favorites THEN
    RAISE EXCEPTION 'Stats cannot decrease';
  END IF;

  stat_delta :=
    (NEW.views - OLD.views)
    + (NEW.downloads - OLD.downloads)
    + (NEW.favorites - OLD.favorites);

  IF stat_delta <> 1 THEN
    RAISE EXCEPTION 'Stats may only increment by one at a time';
  END IF;

  RETURN NEW;
END;
$$;
