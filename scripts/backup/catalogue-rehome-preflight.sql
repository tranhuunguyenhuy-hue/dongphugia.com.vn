-- Read-only target gate for Issue #158. This query returns no database rows.

do $catalogue_rehome_preflight$
declare
  table_name text;
  has_rows boolean;
begin
  if current_setting('server_version_num')::integer < 170000
     or current_setting('server_version_num')::integer >= 180000 then
    raise exception 'CATALOGUE_REHOME_POSTGRES_VERSION_FAILED';
  end if;

  if not exists (
    select 1
    from dpg_control.target_contract
    where singleton
      and project_name = 'dongphugia-runtime'
      and region = 'ap-southeast-1'
      and environment = 'preview'
      and data_class = 'production-derived-reduced-runtime'
      and production_data_allowed
      and not production_credentials_allowed
      and not production_writes_allowed
      and hard_database_ceiling_bytes = 367001600
  ) then
    raise exception 'CATALOGUE_REHOME_TARGET_CONTRACT_FAILED';
  end if;

  if to_regclass('dpg_v1.products') is null
     or to_regclass('dpg_app.products') is null
     or to_regclass('dpg_control.leo538_restore_manifest') is null
     or to_regclass('dpg_control.runtime_migration_ledger') is null
     or to_regprocedure('dpg_v1_api.public_product_get(uuid)') is null
     or to_regprocedure('dpg_v1_api.catalogue_media_register(jsonb,text)') is null
     or to_regprocedure('dpg_v1_api.order_intake_create(jsonb,text)') is null then
    raise exception 'CATALOGUE_REHOME_SCHEMA_INCOMPLETE';
  end if;

  if (select count(*) from dpg_control.runtime_migration_ledger) <> 23 then
    raise exception 'CATALOGUE_REHOME_MIGRATION_LEDGER_INCOMPLETE';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('dpg_app', 'dpg_control', 'dpg_v1')
      and c.relkind in ('r', 'p')
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ) then
    raise exception 'CATALOGUE_REHOME_RLS_INCOMPLETE';
  end if;

  if exists (
    select 1
    from pg_roles
    where rolname in ('dpg_migration', 'dpg_runtime', 'dpg_readonly', 'dpg_backup')
      and (rolsuper or rolcreatedb or rolcreaterole or rolcanlogin or rolinherit
           or rolreplication or rolbypassrls)
  ) or (
    select count(*)
    from pg_roles
    where rolname in ('dpg_migration', 'dpg_runtime', 'dpg_readonly', 'dpg_backup')
  ) <> 4 then
    raise exception 'CATALOGUE_REHOME_ROLE_CONTRACT_FAILED';
  end if;

  if exists (
    select 1
    from pg_auth_members memberships
    join pg_roles granted_role on granted_role.oid = memberships.roleid
    join pg_roles member_role on member_role.oid = memberships.member
    where granted_role.rolname = 'dpg_backup' or member_role.rolname = 'dpg_backup'
  ) then
    raise exception 'CATALOGUE_REHOME_BACKUP_ROLE_MEMBERSHIP_FAILED';
  end if;

  if current_user <> 'dpg_catalogue_restore' then
    if exists (select 1 from auth.users limit 1) then
      raise exception 'CATALOGUE_REHOME_AUTH_NOT_EMPTY';
    end if;
    if exists (select 1 from storage.objects limit 1) then
      raise exception 'CATALOGUE_REHOME_STORAGE_NOT_EMPTY';
    end if;
    for table_name in
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'dpg_v1'
        and c.relkind in ('r', 'p')
        and c.relname not in ('categories', 'role_capabilities')
      order by c.relname
    loop
      execute format('select exists(select 1 from dpg_v1.%I limit 1)', table_name)
        into has_rows;
      if has_rows then
        raise exception 'CATALOGUE_REHOME_V1_DATA_NOT_EMPTY table=%', table_name;
      end if;
    end loop;
  end if;

  if exists (
    (select id, parent_id, sector, name, slug, summary, is_leaf, is_active,
            sort_order, version, updated_by
     from dpg_v1.categories
     except values
       ('10000000-0000-4000-8000-000000000001'::uuid, null::uuid, 'sanitary',
        'Thiết bị vệ sinh', 'sanitary', null::text, false, true, 0, 1, null::uuid),
       ('10000000-0000-4000-8000-000000000002'::uuid, null::uuid, 'tile',
        'Gạch ốp lát', 'tile', null::text, false, true, 1, 1, null::uuid),
       ('10000000-0000-4000-8000-000000000003'::uuid, null::uuid, 'water',
        'Thiết bị nước', 'water', null::text, false, true, 2, 1, null::uuid),
       ('10000000-0000-4000-8000-000000000004'::uuid, null::uuid, 'kitchen',
        'Thiết bị bếp', 'kitchen', null::text, false, true, 3, 1, null::uuid))
    union all
    (values
       ('10000000-0000-4000-8000-000000000001'::uuid, null::uuid, 'sanitary',
        'Thiết bị vệ sinh', 'sanitary', null::text, false, true, 0, 1, null::uuid),
       ('10000000-0000-4000-8000-000000000002'::uuid, null::uuid, 'tile',
        'Gạch ốp lát', 'tile', null::text, false, true, 1, 1, null::uuid),
       ('10000000-0000-4000-8000-000000000003'::uuid, null::uuid, 'water',
        'Thiết bị nước', 'water', null::text, false, true, 2, 1, null::uuid),
       ('10000000-0000-4000-8000-000000000004'::uuid, null::uuid, 'kitchen',
        'Thiết bị bếp', 'kitchen', null::text, false, true, 3, 1, null::uuid)
     except select id, parent_id, sector, name, slug, summary, is_leaf, is_active,
                   sort_order, version, updated_by
            from dpg_v1.categories)
  ) then
    raise exception 'CATALOGUE_REHOME_V1_CATEGORY_SEED_DRIFT';
  end if;

  if exists (
    (select role::text, capability::text from dpg_v1.role_capabilities
     except values
       ('Product', 'catalogue.read'),
       ('Product', 'catalogue.create'),
       ('Product', 'catalogue.update'),
       ('Product', 'catalogue.publish'),
       ('Product', 'catalogue.archive'),
       ('Product', 'marketing.collection.read'),
       ('Sales', 'catalogue.read'),
       ('Sales', 'marketing.collection.read'),
       ('Sales', 'sales.order.read'),
       ('Sales', 'sales.order.lifecycle.update'),
       ('Sales', 'sales.order.payment.update'),
       ('Sales', 'sales.order.archive'),
       ('Sales', 'sales.quote_request.read'),
       ('Sales', 'sales.quote.read'),
       ('Sales', 'sales.quote.create'),
       ('Sales', 'sales.quote.update'),
       ('Sales', 'sales.quote.publish'),
       ('Sales', 'sales.quote.archive'),
       ('Marketing', 'catalogue.read'),
       ('Marketing', 'marketing.content.read'),
       ('Marketing', 'marketing.content.create'),
       ('Marketing', 'marketing.content.update'),
       ('Marketing', 'marketing.content.publish'),
       ('Marketing', 'marketing.content.archive'),
       ('Marketing', 'marketing.collection.read'),
       ('Marketing', 'marketing.collection.create'),
       ('Marketing', 'marketing.collection.update'),
       ('Marketing', 'marketing.collection.publish'),
       ('Marketing', 'marketing.collection.archive'),
       ('Admin', 'catalogue.read'),
       ('Admin', 'catalogue.create'),
       ('Admin', 'catalogue.update'),
       ('Admin', 'catalogue.publish'),
       ('Admin', 'catalogue.archive'),
       ('Admin', 'sales.order.read'),
       ('Admin', 'sales.order.lifecycle.update'),
       ('Admin', 'sales.order.payment.update'),
       ('Admin', 'sales.order.archive'),
       ('Admin', 'sales.quote_request.read'),
       ('Admin', 'sales.quote.read'),
       ('Admin', 'sales.quote.create'),
       ('Admin', 'sales.quote.update'),
       ('Admin', 'sales.quote.publish'),
       ('Admin', 'sales.quote.archive'),
       ('Admin', 'marketing.content.read'),
       ('Admin', 'marketing.content.create'),
       ('Admin', 'marketing.content.update'),
       ('Admin', 'marketing.content.publish'),
       ('Admin', 'marketing.content.archive'),
       ('Admin', 'marketing.collection.read'),
       ('Admin', 'marketing.collection.create'),
       ('Admin', 'marketing.collection.update'),
       ('Admin', 'marketing.collection.publish'),
       ('Admin', 'marketing.collection.archive'),
       ('Admin', 'admin.staff.read'),
       ('Admin', 'admin.staff.create'),
       ('Admin', 'admin.staff.update'),
       ('Admin', 'admin.staff.disable'),
       ('Admin', 'admin.staff.assign_roles'),
       ('Admin', 'admin.config.read'),
       ('Admin', 'admin.config.create'),
       ('Admin', 'admin.config.update'))
    union all
    (values
       ('Product', 'catalogue.read'),
       ('Product', 'catalogue.create'),
       ('Product', 'catalogue.update'),
       ('Product', 'catalogue.publish'),
       ('Product', 'catalogue.archive'),
       ('Product', 'marketing.collection.read'),
       ('Sales', 'catalogue.read'),
       ('Sales', 'marketing.collection.read'),
       ('Sales', 'sales.order.read'),
       ('Sales', 'sales.order.lifecycle.update'),
       ('Sales', 'sales.order.payment.update'),
       ('Sales', 'sales.order.archive'),
       ('Sales', 'sales.quote_request.read'),
       ('Sales', 'sales.quote.read'),
       ('Sales', 'sales.quote.create'),
       ('Sales', 'sales.quote.update'),
       ('Sales', 'sales.quote.publish'),
       ('Sales', 'sales.quote.archive'),
       ('Marketing', 'catalogue.read'),
       ('Marketing', 'marketing.content.read'),
       ('Marketing', 'marketing.content.create'),
       ('Marketing', 'marketing.content.update'),
       ('Marketing', 'marketing.content.publish'),
       ('Marketing', 'marketing.content.archive'),
       ('Marketing', 'marketing.collection.read'),
       ('Marketing', 'marketing.collection.create'),
       ('Marketing', 'marketing.collection.update'),
       ('Marketing', 'marketing.collection.publish'),
       ('Marketing', 'marketing.collection.archive'),
       ('Admin', 'catalogue.read'),
       ('Admin', 'catalogue.create'),
       ('Admin', 'catalogue.update'),
       ('Admin', 'catalogue.publish'),
       ('Admin', 'catalogue.archive'),
       ('Admin', 'sales.order.read'),
       ('Admin', 'sales.order.lifecycle.update'),
       ('Admin', 'sales.order.payment.update'),
       ('Admin', 'sales.order.archive'),
       ('Admin', 'sales.quote_request.read'),
       ('Admin', 'sales.quote.read'),
       ('Admin', 'sales.quote.create'),
       ('Admin', 'sales.quote.update'),
       ('Admin', 'sales.quote.publish'),
       ('Admin', 'sales.quote.archive'),
       ('Admin', 'marketing.content.read'),
       ('Admin', 'marketing.content.create'),
       ('Admin', 'marketing.content.update'),
       ('Admin', 'marketing.content.publish'),
       ('Admin', 'marketing.content.archive'),
       ('Admin', 'marketing.collection.read'),
       ('Admin', 'marketing.collection.create'),
       ('Admin', 'marketing.collection.update'),
       ('Admin', 'marketing.collection.publish'),
       ('Admin', 'marketing.collection.archive'),
       ('Admin', 'admin.staff.read'),
       ('Admin', 'admin.staff.create'),
       ('Admin', 'admin.staff.update'),
       ('Admin', 'admin.staff.disable'),
       ('Admin', 'admin.staff.assign_roles'),
       ('Admin', 'admin.config.read'),
       ('Admin', 'admin.config.create'),
       ('Admin', 'admin.config.update')
     except select role::text, capability::text from dpg_v1.role_capabilities)
  ) then
    raise exception 'CATALOGUE_REHOME_V1_ROLE_CAPABILITY_SEED_DRIFT';
  end if;

  if current_user <> 'dpg_catalogue_restore' then
    if exists (
      (select family_key, label, source, confidence
       from dpg_app.product_families
       except values ('toto:ms885', 'TOTO MS885', 'toto-catalogue', 'high'))
      union all
      (values ('toto:ms885', 'TOTO MS885', 'toto-catalogue', 'high')
       except select family_key, label, source, confidence
              from dpg_app.product_families)
    ) or exists (
      (select family.family_key, configuration.group_key, configuration.label,
              configuration.sort_order, configuration.source, configuration.confidence
       from dpg_app.product_family_configuration_groups configuration
       join dpg_app.product_families family on family.id = configuration.family_id
       except values
         ('toto:ms885', 'ecowasher', 'nắp rửa cơ', 0, 'toto-catalogue', 'high'),
         ('toto:ms885', 'electronic-washlet', 'nắp điện tử', 1, 'toto-catalogue', 'high'),
         ('toto:ms885', 'soft-close', 'nắp đóng êm', 2, 'toto-catalogue', 'high'))
      union all
      (values
         ('toto:ms885', 'ecowasher', 'nắp rửa cơ', 0, 'toto-catalogue', 'high'),
         ('toto:ms885', 'electronic-washlet', 'nắp điện tử', 1, 'toto-catalogue', 'high'),
         ('toto:ms885', 'soft-close', 'nắp đóng êm', 2, 'toto-catalogue', 'high')
       except select family.family_key, configuration.group_key, configuration.label,
                     configuration.sort_order, configuration.source, configuration.confidence
              from dpg_app.product_family_configuration_groups configuration
              join dpg_app.product_families family on family.id = configuration.family_id)
    ) or exists (
      (select family.family_key, gap.member_key, gap.gap_type, gap.status,
              gap.source, gap.confidence, gap.note
       from dpg_app.product_family_catalogue_gaps gap
       join dpg_app.product_families family on family.id = gap.family_id
       except values
         ('toto:ms885', 'MS885DW4#XW', 'missing_product', 'open', 'toto-catalogue', 'high',
          'Approved canonical member; Product row is not fabricated by M2.3.'),
         ('toto:ms885', 'MS885DW18#XW', 'missing_product', 'open', 'toto-catalogue', 'high',
          'Approved canonical member; Product row is not fabricated by M2.3.'))
      union all
      (values
         ('toto:ms885', 'MS885DW4#XW', 'missing_product', 'open', 'toto-catalogue', 'high',
          'Approved canonical member; Product row is not fabricated by M2.3.'),
         ('toto:ms885', 'MS885DW18#XW', 'missing_product', 'open', 'toto-catalogue', 'high',
          'Approved canonical member; Product row is not fabricated by M2.3.')
       except select family.family_key, gap.member_key, gap.gap_type, gap.status,
                     gap.source, gap.confidence, gap.note
              from dpg_app.product_family_catalogue_gaps gap
              join dpg_app.product_families family on family.id = gap.family_id)
    ) or exists (select 1 from dpg_app.product_family_memberships) then
      raise exception 'CATALOGUE_REHOME_CHECKPOINT_SEED_DRIFT';
    end if;
  end if;

  for table_name in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'dpg_app'
      and c.relkind in ('r', 'p')
      and c.relname not in (
        'product_families', 'product_family_configuration_groups',
        'product_family_catalogue_gaps', 'product_family_memberships'
      )
      and (current_user <> 'dpg_catalogue_restore' or c.relname = any(array[
        'brands', 'catalog_taxons', 'categories', 'colors', 'external_taxonomy_mappings',
        'filter_definitions', 'materials', 'origins', 'product_attribute_values',
        'product_descriptions', 'product_documents', 'product_feature_values',
        'product_features', 'product_images', 'product_package_items',
        'product_relationships', 'product_secondary_subcategories', 'product_source_mappings',
        'product_spec_values', 'product_sub_types', 'product_taxon_assignments',
        'product_types', 'product_variant_groups', 'products', 'spec_definitions',
        'spec_options', 'subcategories'
      ]::text[]))
    order by c.relname
  loop
    execute format('select exists(select 1 from dpg_app.%I limit 1)', table_name)
      into has_rows;
    if has_rows then
      raise exception 'CATALOGUE_REHOME_TARGET_NOT_EMPTY table=%', table_name;
    end if;
  end loop;

  if exists (select 1 from dpg_control.leo538_restore_manifest limit 1) then
    raise exception 'CATALOGUE_REHOME_MANIFEST_NOT_EMPTY';
  end if;
end
$catalogue_rehome_preflight$;

do $catalogue_rehome_headroom$
begin
  if current_user = 'dpg_catalogue_restore' then
    if pg_database_size(current_database()) + 114691219 >= 367001600 then
      raise exception 'CATALOGUE_REHOME_DATABASE_HEADROOM_FAILED';
    end if;
  else
    perform dpg_control.assert_free_tier_headroom(114691219);
  end if;
end
$catalogue_rehome_headroom$;
