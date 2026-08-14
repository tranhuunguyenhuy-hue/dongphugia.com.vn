-- Production-only least-privilege bridge for legacy CMS tables that already
-- have row security enabled. Invoke after the dedicated runtime role and ACL
-- artifacts, and before any Publishing API production smoke.

\set ON_ERROR_STOP on
\if :{?runtime_role}
\else
  \echo 'Publishing legacy RLS requires --set=runtime_role=<application-runtime-role>'
  SELECT 1 / 0;
\endif

BEGIN;
SET LOCAL publishing.runtime_role TO :'runtime_role';
SET LOCAL search_path = pg_catalog, public;

DO $$
DECLARE
  target_role name := current_setting('publishing.runtime_role')::name;
  target_role_oid oid;
  existing_policy_count integer;
  expected_policy_count integer;
BEGIN
  SELECT oid INTO target_role_oid
  FROM pg_roles
  WHERE rolname = target_role
    AND rolcanlogin
    AND NOT rolsuper
    AND NOT rolcreatedb
    AND NOT rolcreaterole
    AND NOT rolreplication
    AND NOT rolbypassrls;
  IF target_role_oid IS NULL THEN
    RAISE EXCEPTION 'Publishing legacy RLS target must be the safe dedicated runtime login';
  END IF;

  SELECT count(*) INTO existing_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname LIKE 'publishing_runtime_prod!_%' ESCAPE '!';
  IF existing_policy_count NOT IN (0, 9) THEN
    RAISE EXCEPTION 'Publishing legacy RLS found a partial or unexpected policy state';
  END IF;

  IF existing_policy_count = 0 THEN
    EXECUTE format(
      'CREATE POLICY publishing_runtime_prod_categories_select ON public.blog_categories FOR SELECT TO %I USING (true)',
      target_role
    );
    EXECUTE format(
      'CREATE POLICY publishing_runtime_prod_tags_select ON public.blog_tags FOR SELECT TO %I USING (true)',
      target_role
    );
    EXECUTE format(
      'CREATE POLICY publishing_runtime_prod_tags_update_count ON public.blog_tags FOR UPDATE TO %I USING (true) WITH CHECK (true)',
      target_role
    );
    EXECUTE format(
      'CREATE POLICY publishing_runtime_prod_posts_select ON public.blog_posts FOR SELECT TO %I USING (publishing_identity_id IS NOT NULL)',
      target_role
    );
    EXECUTE format(
      'CREATE POLICY publishing_runtime_prod_posts_insert ON public.blog_posts FOR INSERT TO %I WITH CHECK (publishing_identity_id IS NOT NULL)',
      target_role
    );
    EXECUTE format(
      'CREATE POLICY publishing_runtime_prod_posts_update ON public.blog_posts FOR UPDATE TO %I USING (publishing_identity_id IS NOT NULL) WITH CHECK (publishing_identity_id IS NOT NULL)',
      target_role
    );
    EXECUTE format(
      'CREATE POLICY publishing_runtime_prod_post_tags_select ON public.blog_post_tags FOR SELECT TO %I USING (true)',
      target_role
    );
    EXECUTE format(
      'CREATE POLICY publishing_runtime_prod_post_tags_insert ON public.blog_post_tags FOR INSERT TO %I WITH CHECK (EXISTS (SELECT 1 FROM public.blog_posts WHERE blog_posts.id = blog_post_tags.post_id AND blog_posts.publishing_identity_id IS NOT NULL))',
      target_role
    );
    EXECUTE format(
      'CREATE POLICY publishing_runtime_prod_post_tags_delete ON public.blog_post_tags FOR DELETE TO %I USING (EXISTS (SELECT 1 FROM public.blog_posts WHERE blog_posts.id = blog_post_tags.post_id AND blog_posts.publishing_identity_id IS NOT NULL))',
      target_role
    );
  END IF;

  SELECT count(*) INTO expected_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname IN (
      'publishing_runtime_prod_categories_select',
      'publishing_runtime_prod_tags_select',
      'publishing_runtime_prod_tags_update_count',
      'publishing_runtime_prod_posts_select',
      'publishing_runtime_prod_posts_insert',
      'publishing_runtime_prod_posts_update',
      'publishing_runtime_prod_post_tags_select',
      'publishing_runtime_prod_post_tags_insert',
      'publishing_runtime_prod_post_tags_delete'
    )
    AND roles = ARRAY[target_role]::name[];
  IF expected_policy_count <> 9 THEN
    RAISE EXCEPTION 'Publishing legacy RLS postcondition failed';
  END IF;
END
$$;

COMMIT;
