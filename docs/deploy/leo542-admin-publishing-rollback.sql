-- LEO-542 Phase A rollback. Run only after disabling the seven LEO-542 Edge
-- Functions and the Preview adapter. This rollback never deletes canonical rows.
begin;

do $$
begin
  if not exists (
    select 1 from dpg_control.target_contract
    where singleton
      and project_name='dongphugia-runtime'
      and region='ap-southeast-1'
      and environment='preview'
      and production_writes_allowed is false
  ) then
    raise exception 'LEO542_TARGET_CONTRACT_FAILED';
  end if;
end
$$;

revoke execute on function public.leo542_admin_commerce_list(text,integer,integer), public.leo542_admin_commerce_get(text,integer), public.leo542_admin_commerce_patch(text,integer,jsonb,text,uuid),
 public.leo542_admin_content_snapshot(), public.leo542_admin_content_patch(text,integer,jsonb,text,uuid), public.leo542_admin_blog_list(integer,integer,text), public.leo542_admin_blog_get(integer), public.leo542_admin_blog_put(integer,integer,jsonb,text,uuid),
 public.leo542_admin_product_list(integer,integer,text), public.leo542_admin_product_get(integer), public.leo542_admin_product_put(integer,integer,jsonb,text,uuid), public.leo542_admin_audit_list(integer,integer),
 public.leo542_publishing_post_list(integer,integer,text), public.leo542_publishing_post_get(integer,text), public.leo542_publishing_post_put(integer,integer,jsonb,text,uuid),
 public.leo542_publishing_media_list(integer,integer), public.leo542_publishing_media_reference(integer,uuid,text,text,uuid), public.leo542_acceptance_force_rollback(text,integer)
 from authenticated;

do $$ declare r record; begin
  -- The backup prerequisite is a separate approved change and must remain
  -- untouched by the Phase A rollback.
  for r in select schemaname,tablename,policyname
    from pg_policies
    where schemaname='dpg_app'
      and policyname like 'leo542_%'
      and policyname not in ('leo542_backup_runtime_idempotency_select', 'leo542_backup_runtime_audit_select')
  loop execute format('drop policy %I on %I.%I',r.policyname,r.schemaname,r.tablename); end loop;
end $$;

drop function if exists public.leo542_admin_commerce_list(text,integer,integer);
drop function if exists public.leo542_admin_commerce_get(text,integer);
drop function if exists public.leo542_admin_commerce_patch(text,integer,jsonb,text,uuid);
drop function if exists public.leo542_admin_content_snapshot();
drop function if exists public.leo542_admin_content_patch(text,integer,jsonb,text,uuid);
drop function if exists public.leo542_admin_blog_list(integer,integer,text);
drop function if exists public.leo542_admin_blog_get(integer);
drop function if exists public.leo542_admin_blog_put(integer,integer,jsonb,text,uuid);
drop function if exists public.leo542_admin_product_list(integer,integer,text);
drop function if exists public.leo542_admin_product_get(integer);
drop function if exists public.leo542_admin_product_put(integer,integer,jsonb,text,uuid);
drop function if exists public.leo542_admin_audit_list(integer,integer);
drop function if exists public.leo542_publishing_post_list(integer,integer,text);
drop function if exists public.leo542_publishing_post_get(integer,text);
drop function if exists public.leo542_publishing_post_put(integer,integer,jsonb,text,uuid);
drop function if exists public.leo542_publishing_media_list(integer,integer);
drop function if exists public.leo542_publishing_media_reference(integer,uuid,text,text,uuid);
drop function if exists public.leo542_acceptance_force_rollback(text,integer);
drop function if exists dpg_app.leo542_machine_can(text);
drop function if exists dpg_app.leo542_admin_can(text);
drop function if exists dpg_app.leo542_actor_context();

drop index if exists dpg_app.uq_admin_users_supabase_auth_user;
drop index if exists dpg_app.uq_publishing_identities_supabase_auth_user;

-- Nullable compatibility columns and products.version are intentionally
-- retained if Phase A wrote evidence. Dropping them requires a separate data
-- dependency review. RLS remains enabled on the four approved tables because
-- disabling it would weaken the post-migration security boundary.

grant execute on function public.runtime_order_create(jsonb,text,uuid),
 public.runtime_order_get(integer), public.runtime_order_list(integer,integer),
 public.runtime_order_update(integer,jsonb,text,uuid), public.runtime_order_delete(integer,text,uuid),
 public.runtime_quote_create(jsonb,text,uuid), public.runtime_quote_get(integer),
 public.runtime_quote_list(integer,integer), public.runtime_quote_update(integer,jsonb,text,uuid),
 public.runtime_quote_delete(integer,text,uuid) to authenticated;

commit;
