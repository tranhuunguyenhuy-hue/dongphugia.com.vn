-- LEO-539 defense in depth for the non-exposed control schema.

alter table dpg_control.target_contract enable row level security;
alter table dpg_control.target_contract force row level security;

create policy leo539_control_read
on dpg_control.target_contract
for select
to dpg_migration, dpg_readonly
using (true);
