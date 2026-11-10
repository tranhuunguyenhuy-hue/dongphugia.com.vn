-- Preview-only target transition for Issue #290.
-- Never copy this file into supabase/migrations or run it on dongphugia-runtime.

do $synthetic_preview_preflight$
declare
  target dpg_control.target_contract%rowtype;
  current_size bigint := pg_database_size(current_database());
begin
  select * into strict target from dpg_control.target_contract where singleton;

  if current_size > 367001600
     or target.region <> 'ap-southeast-1'
     or target.hard_database_ceiling_bytes <> 367001600
     or target.production_credentials_allowed
     or target.production_writes_allowed then
    raise exception 'DPG_SYNTHETIC_PREVIEW_BASELINE_FAILED';
  end if;

  if target.project_name = 'dongphugia-phase2-preview-290'
     and target.environment = 'preview_synthetic'
     and target.data_class = 'synthetic-with-approved-public-fixtures'
     and not target.production_data_allowed then
    return;
  end if;

  if target.project_name <> 'dongphugia-runtime'
     or target.environment <> 'preview'
     or target.data_class <> 'production-derived-reduced-runtime'
     or not target.production_data_allowed then
    raise exception 'DPG_SYNTHETIC_PREVIEW_SOURCE_CONTRACT_FAILED';
  end if;

  -- The new project may contain only the approved public MS885 metadata fixture
  -- before conversion. It must have no Auth users, staff, products, orders, or
  -- customer records copied from another target.
  if exists (select 1 from auth.users)
     or exists (select 1 from dpg_app.orders)
     or exists (select 1 from dpg_app.customers)
     or exists (select 1 from dpg_app.admin_users)
     or exists (select 1 from dpg_app.products)
     or exists (select 1 from dpg_v1.products)
     or exists (select 1 from dpg_v1.staff_users)
     or exists (select 1 from dpg_v1.staff_user_roles)
     or exists (select 1 from dpg_app.admin_sessions)
     or (select count(*) from dpg_app.product_families) <> 1
     or not exists (
       select 1 from dpg_app.product_families
       where family_key = 'toto:ms885'
         and label = 'TOTO MS885'
         and source = 'toto-catalogue'
         and confidence = 'high'
     )
     or (select count(*) from dpg_app.product_family_configuration_groups) <> 3
     or (select count(*) from dpg_app.product_family_catalogue_gaps) <> 2 then
    raise exception 'DPG_SYNTHETIC_PREVIEW_DATA_BOUNDARY_FAILED';
  end if;
end
$synthetic_preview_preflight$;

alter table dpg_control.target_contract
  drop constraint if exists target_contract_project_name_check,
  drop constraint if exists target_contract_environment_check,
  drop constraint if exists target_contract_data_class_check,
  drop constraint if exists target_contract_production_data_allowed_check,
  drop constraint if exists target_contract_synthetic_preview_identity_check;

update dpg_control.target_contract
set project_name = 'dongphugia-phase2-preview-290',
    environment = 'preview_synthetic',
    data_class = 'synthetic-with-approved-public-fixtures',
    production_data_allowed = false
where singleton
  and project_name = 'dongphugia-runtime'
  and environment = 'preview'
  and data_class = 'production-derived-reduced-runtime'
  and production_data_allowed;

alter table dpg_control.target_contract
  add constraint target_contract_synthetic_preview_identity_check
    check (
      project_name = 'dongphugia-phase2-preview-290'
      and environment = 'preview_synthetic'
      and region = 'ap-southeast-1'
      and data_class = 'synthetic-with-approved-public-fixtures'
      and not production_data_allowed
      and not production_credentials_allowed
      and not production_writes_allowed
      and hard_database_ceiling_bytes = 367001600
    );

create table if not exists dpg_control.synthetic_preview_migration_ledger (
  source_version text primary key check (source_version ~ '^[0-9]{14}$'),
  source_name text not null,
  source_sha256 char(64) not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  target_project_ref text not null check (target_project_ref = 'uybumsnyqpwcidjxmfsv'),
  applied_at timestamptz not null default now()
);

alter table dpg_control.synthetic_preview_migration_ledger owner to dpg_migration;
alter table dpg_control.synthetic_preview_migration_ledger enable row level security;
alter table dpg_control.synthetic_preview_migration_ledger force row level security;
revoke all on table dpg_control.synthetic_preview_migration_ledger
  from public, anon, authenticated, service_role, dpg_runtime, dpg_readonly;
grant select, insert on table dpg_control.synthetic_preview_migration_ledger to dpg_migration;
drop policy if exists synthetic_preview_migration_ledger_migration_access
  on dpg_control.synthetic_preview_migration_ledger;
create policy synthetic_preview_migration_ledger_migration_access
  on dpg_control.synthetic_preview_migration_ledger
  for all to dpg_migration using (true) with check (true);

do $synthetic_preview_postflight$
begin
  if not exists (
    select 1 from dpg_control.target_contract
    where singleton
      and project_name = 'dongphugia-phase2-preview-290'
      and environment = 'preview_synthetic'
      and region = 'ap-southeast-1'
      and data_class = 'synthetic-with-approved-public-fixtures'
      and not production_data_allowed
      and not production_credentials_allowed
      and not production_writes_allowed
      and hard_database_ceiling_bytes = 367001600
      and pg_database_size(current_database()) <= hard_database_ceiling_bytes
  ) then
    raise exception 'DPG_SYNTHETIC_PREVIEW_POSTFLIGHT_FAILED';
  end if;
end
$synthetic_preview_postflight$;
