-- LEO-542 approved backup prerequisite: exact sequence SELECT only.
-- Exact isolated Preview target only. USAGE is intentionally not granted.

begin;

do $$
begin
  if not exists (
    select 1
    from dpg_control.target_contract
    where singleton
      and project_name = 'dongphugia-runtime'
      and region = 'ap-southeast-1'
      and environment = 'preview'
      and production_writes_allowed is false
  ) then
    raise exception 'LEO542_BACKUP_TARGET_CONTRACT_FAILED';
  end if;
end
$$;

grant select on sequence dpg_app.runtime_audit_events_id_seq to dpg_backup;

commit;
