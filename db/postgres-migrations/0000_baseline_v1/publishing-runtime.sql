-- PostgreSQL Baseline v1 Publishing runtime overlay.
-- The role name is intentionally fixed for isolated Staging. A future
-- Production adoption must review and map this role separately; this file is
-- never executed against Production by the runner.
DO $$
BEGIN
  IF to_regclass('public.publishing_audit_events') IS NULL THEN
    RAISE EXCEPTION 'missing baseline runtime table: publishing_audit_events';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dpg_staging_app') THEN
    RAISE EXCEPTION 'missing isolated Staging runtime role: dpg_staging_app';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION publishing_audit_events_append_only()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'publishing_audit_events are append-only';
  END IF;
  IF OLD.created_at >= now() - interval '365 days' THEN
    RAISE EXCEPTION 'publishing_audit_events must be retained for at least 365 days';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS publishing_audit_events_append_only_trigger
  ON publishing_audit_events;
CREATE TRIGGER publishing_audit_events_append_only_trigger
  BEFORE UPDATE OR DELETE ON publishing_audit_events
  FOR EACH ROW EXECUTE FUNCTION publishing_audit_events_append_only();

CREATE OR REPLACE FUNCTION publishing_touch_credential_last_used(
  p_credential_id uuid
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  UPDATE public.publishing_credentials
  SET last_used_at = clock_timestamp()
  WHERE id = p_credential_id
    AND (last_used_at IS NULL OR last_used_at < clock_timestamp() - interval '5 minutes')
$$;

REVOKE ALL ON FUNCTION publishing_touch_credential_last_used(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION publishing_touch_credential_last_used(uuid) TO dpg_staging_app;

ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS publishing_runtime_prod_categories_select ON public.blog_categories;
CREATE POLICY publishing_runtime_prod_categories_select
  ON public.blog_categories FOR SELECT TO dpg_staging_app USING (true);

DROP POLICY IF EXISTS publishing_runtime_prod_tags_select ON public.blog_tags;
CREATE POLICY publishing_runtime_prod_tags_select
  ON public.blog_tags FOR SELECT TO dpg_staging_app USING (true);

DROP POLICY IF EXISTS publishing_runtime_prod_tags_update_count ON public.blog_tags;
CREATE POLICY publishing_runtime_prod_tags_update_count
  ON public.blog_tags FOR UPDATE TO dpg_staging_app USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS publishing_runtime_prod_posts_select ON public.blog_posts;
CREATE POLICY publishing_runtime_prod_posts_select
  ON public.blog_posts FOR SELECT TO dpg_staging_app
  USING (publishing_identity_id IS NOT NULL);

DROP POLICY IF EXISTS publishing_runtime_prod_posts_insert ON public.blog_posts;
CREATE POLICY publishing_runtime_prod_posts_insert
  ON public.blog_posts FOR INSERT TO dpg_staging_app
  WITH CHECK (publishing_identity_id IS NOT NULL);

DROP POLICY IF EXISTS publishing_runtime_prod_posts_update ON public.blog_posts;
CREATE POLICY publishing_runtime_prod_posts_update
  ON public.blog_posts FOR UPDATE TO dpg_staging_app
  USING (publishing_identity_id IS NOT NULL)
  WITH CHECK (publishing_identity_id IS NOT NULL);

DROP POLICY IF EXISTS publishing_runtime_prod_post_tags_select ON public.blog_post_tags;
CREATE POLICY publishing_runtime_prod_post_tags_select
  ON public.blog_post_tags FOR SELECT TO dpg_staging_app USING (true);

DROP POLICY IF EXISTS publishing_runtime_prod_post_tags_insert ON public.blog_post_tags;
CREATE POLICY publishing_runtime_prod_post_tags_insert
  ON public.blog_post_tags FOR INSERT TO dpg_staging_app
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.blog_posts
    WHERE blog_posts.id = blog_post_tags.post_id
      AND blog_posts.publishing_identity_id IS NOT NULL
  ));

DROP POLICY IF EXISTS publishing_runtime_prod_post_tags_delete ON public.blog_post_tags;
CREATE POLICY publishing_runtime_prod_post_tags_delete
  ON public.blog_post_tags FOR DELETE TO dpg_staging_app
  USING (EXISTS (
    SELECT 1 FROM public.blog_posts
    WHERE blog_posts.id = blog_post_tags.post_id
      AND blog_posts.publishing_identity_id IS NOT NULL
  ));
