-- LEO-542 cleanup: remove the acceptance-only rollback helper after runtime
-- acceptance completed. This is isolated Preview-only DDL and does not alter
-- application RPCs, roles, RLS, Auth settings, or canonical data.

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

do $$
begin
  if to_regprocedure('public.leo542_acceptance_force_rollback(text, integer)') is not null then
    execute 'revoke execute on function public.leo542_acceptance_force_rollback(text, integer) from public, anon, authenticated, service_role';
    execute 'drop function public.leo542_acceptance_force_rollback(text, integer)';
  end if;
end
$$;

commit;
