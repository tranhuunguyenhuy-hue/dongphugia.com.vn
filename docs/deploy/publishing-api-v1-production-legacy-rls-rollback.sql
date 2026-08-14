-- Emergency rollback for the production-only legacy CMS RLS bridge. This
-- removes only the nine Publishing runtime policies and no data or table ACL.

\set ON_ERROR_STOP on
\if :{?runtime_role}
\else
  \echo 'Publishing legacy RLS rollback requires --set=runtime_role=<application-runtime-role>'
  SELECT 1 / 0;
\endif

BEGIN;
SET LOCAL publishing.runtime_role TO :'runtime_role';
SET LOCAL search_path = pg_catalog, public;

DO $$
DECLARE
  target_role name := current_setting('publishing.runtime_role')::name;
  exact_policy_count integer;
BEGIN
  SELECT count(*) INTO exact_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname LIKE 'publishing_runtime_prod!_%' ESCAPE '!'
    AND roles = ARRAY[target_role]::name[];
  IF exact_policy_count <> 9 THEN
    RAISE EXCEPTION 'Publishing legacy RLS rollback requires the exact nine-policy target state';
  END IF;
END
$$;

DROP POLICY publishing_runtime_prod_post_tags_delete ON public.blog_post_tags;
DROP POLICY publishing_runtime_prod_post_tags_insert ON public.blog_post_tags;
DROP POLICY publishing_runtime_prod_post_tags_select ON public.blog_post_tags;
DROP POLICY publishing_runtime_prod_posts_update ON public.blog_posts;
DROP POLICY publishing_runtime_prod_posts_insert ON public.blog_posts;
DROP POLICY publishing_runtime_prod_posts_select ON public.blog_posts;
DROP POLICY publishing_runtime_prod_tags_update_count ON public.blog_tags;
DROP POLICY publishing_runtime_prod_tags_select ON public.blog_tags;
DROP POLICY publishing_runtime_prod_categories_select ON public.blog_categories;

COMMIT;
