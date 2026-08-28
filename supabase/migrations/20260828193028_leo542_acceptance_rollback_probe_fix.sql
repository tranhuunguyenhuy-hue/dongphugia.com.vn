-- LEO-542 historical corrective migration retained for migration-history
-- continuity. The acceptance-only rollback helper was removed after runtime
-- acceptance and must not be recreated on fresh targets.

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

commit;
