-- LEO-542 approved backup-coverage prerequisite.
-- Exact isolated Preview target only. No application-role privilege change.

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

grant select on table dpg_app.runtime_idempotency_records to dpg_backup;
grant select on table dpg_app.runtime_audit_events to dpg_backup;

create policy leo542_backup_runtime_idempotency_select
  on dpg_app.runtime_idempotency_records
  for select to dpg_backup
  using (true);

create policy leo542_backup_runtime_audit_select
  on dpg_app.runtime_audit_events
  for select to dpg_backup
  using (true);

commit;
