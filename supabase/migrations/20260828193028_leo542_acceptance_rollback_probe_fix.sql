-- LEO-542 Phase A corrective migration: allow the rollback probe to reach its
-- intentional exception while remaining limited to LEO-542 synthetic rows.
-- No tables, policies, grants, roles, or production data are changed.

begin;

do $$
begin
  if not exists (
    select 1 from dpg_control.target_contract
    where singleton
      and project_name = 'dongphugia-runtime'
      and region = 'ap-southeast-1'
      and environment = 'preview'
      and production_writes_allowed is false
  ) then
    raise exception 'LEO542_TARGET_CONTRACT_FAILED';
  end if;
end
$$;

create or replace function public.leo542_acceptance_force_rollback(p_resource text,p_id integer)
returns void language plpgsql volatile security definer set search_path=pg_catalog,dpg_app as $$
begin
 if not dpg_app.leo542_admin_can('audit:read') then raise exception 'FORBIDDEN'; end if;
 if not exists(select 1 from dpg_control.target_contract where singleton and environment='preview' and production_writes_allowed=false) then raise exception 'LEO542_TARGET_CONTRACT_FAILED'; end if;
 if p_resource='blog' then
  update dpg_app.blog_posts set excerpt='LEO542-ROLLBACK-PROBE',updated_at=now() where id=p_id and slug like 'leo542-%';
 elsif p_resource='product' then
  update dpg_app.products set description='LEO542-ROLLBACK-PROBE',updated_at=now() where id=p_id and source_system='leo542-synthetic';
 else raise exception 'INVALID_RESOURCE'; end if;
 if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
 raise exception 'LEO542_FORCED_ROLLBACK';
end $$;

commit;
