import { readFile } from 'node:fs/promises'

export const CATALOGUE_RESTORE_CONTRACT = 'dongphugia:catalogue-filtered-restore:v1'

export const CATALOGUE_TABLES = [
  'brands',
  'catalog_taxons',
  'categories',
  'colors',
  'external_taxonomy_mappings',
  'filter_definitions',
  'materials',
  'origins',
  'product_attribute_values',
  'product_descriptions',
  'product_documents',
  'product_feature_values',
  'product_features',
  'product_images',
  'product_package_items',
  'product_relationships',
  'product_secondary_subcategories',
  'product_source_mappings',
  'product_spec_values',
  'product_sub_types',
  'product_taxon_assignments',
  'product_types',
  'product_variant_groups',
  'products',
  'spec_definitions',
  'spec_options',
  'subcategories',
]

export const CATALOGUE_RESTORE_ORDER = [
  'brands',
  'catalog_taxons',
  'categories',
  'colors',
  'materials',
  'origins',
  'product_variant_groups',
  'subcategories',
  'product_types',
  'product_sub_types',
  'spec_definitions',
  'spec_options',
  'products',
  'external_taxonomy_mappings',
  'filter_definitions',
  'product_attribute_values',
  'product_descriptions',
  'product_documents',
  'product_features',
  'product_feature_values',
  'product_images',
  'product_package_items',
  'product_relationships',
  'product_secondary_subcategories',
  'product_source_mappings',
  'product_spec_values',
  'product_taxon_assignments',
]

export const MIGRATION_SEED_TABLES = [
  'product_families',
  'product_family_configuration_groups',
  'product_family_catalogue_gaps',
  'product_family_memberships',
]

const EXPECTED_TARGET = {
  projectName: 'dongphugia-runtime',
  region: 'ap-southeast-1',
  environment: 'preview',
  dataClass: 'production-derived-reduced-runtime',
  productionDataAllowed: true,
  productionCredentialsAllowed: false,
  productionWritesAllowed: false,
  hardDatabaseCeilingBytes: 367001600,
}

const SAFE_TABLE = /^[a-z][a-z0-9_]*$/
const SAFE_HASH = /^[a-f0-9]{64}$/
const SAFE_SHA = /^[a-f0-9]{40}$/

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  }
  return value
}

function same(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))
}

function validDataEntry(entry) {
  return entry
    && typeof entry.tableName === 'string'
    && /^(?:dpg_v1\.)?[a-z][a-z0-9_]*$/.test(entry.tableName)
    && Number.isInteger(entry.rowCount)
    && entry.rowCount >= 0
    && SAFE_HASH.test(entry.sha256)
    && typeof entry.sourceAuthority === 'string'
}

export function catalogueTableArguments() {
  return CATALOGUE_RESTORE_ORDER.flatMap((table) => ['--table', table])
}

export function buildRehearsalTargetCheckSql() {
  const allowed = CATALOGUE_TABLES.map((table) => `'${table}'`).join(', ')
  return `do $catalogue_rehearsal_target$
declare
  item record;
  has_rows boolean;
begin
  for item in
    select n.nspname as schema_name, c.relname as object_name, c.relkind as object_kind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname <> 'information_schema'
      and n.nspname !~ '^pg_'
      and c.relkind in ('r', 'p', 'm', 'f')
      and not (n.nspname = 'dpg_app' and c.relname = any(array[${allowed}]::text[]))
    order by n.nspname, c.relname
  loop
    execute format('select exists(select 1 from %I.%I limit 1)', item.schema_name, item.object_name)
      into has_rows;
    if has_rows then
      raise exception 'CATALOGUE_REHEARSAL_EXCLUDED_ROWS table=%.%', item.schema_name, item.object_name;
    end if;
  end loop;

  if exists(select 1 from pg_largeobject_metadata) then
    raise exception 'CATALOGUE_REHEARSAL_LARGE_OBJECTS_PRESENT';
  end if;

  for item in
    select n.nspname as schema_name, c.relname as object_name, s.seqstart as start_value
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_sequence s on s.seqrelid = c.oid
    where n.nspname <> 'information_schema'
      and n.nspname !~ '^pg_'
      and c.relkind = 'S'
      and not exists (
        select 1 from pg_depend d
        join pg_class owner_table on owner_table.oid = d.refobjid
        join pg_namespace owner_schema on owner_schema.oid = owner_table.relnamespace
        where d.objid = c.oid and d.deptype in ('a', 'i')
          and owner_schema.nspname = 'dpg_app'
          and owner_table.relname = any(array[${allowed}]::text[])
      )
    order by n.nspname, c.relname
  loop
    execute format('select is_called or last_value <> $1 from %I.%I', item.schema_name, item.object_name)
      into has_rows using item.start_value;
    if has_rows then
      raise exception 'CATALOGUE_REHEARSAL_EXCLUDED_SEQUENCE sequence=%.%', item.schema_name, item.object_name;
    end if;
  end loop;
end
$catalogue_rehearsal_target$;\n`
}

function tableHashSelect(table) {
  return `select count(*)::bigint,
       encode(sha256(convert_to(
         coalesce(string_agg(to_jsonb(item)::text, E'\\n' order by to_jsonb(item)::text COLLATE "C"), ''),
         'UTF8'
       )), 'hex')
from dpg_app.${table} item`
}

function excludedTableLoop(body) {
  const nonImportedSeedTables = [...CATALOGUE_TABLES, ...MIGRATION_SEED_TABLES]
    .map((table) => `'${table}'`).join(', ')
  return `for excluded_table in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'dpg_app'
      and c.relkind in ('r', 'p')
      and c.relname <> all(array[${nonImportedSeedTables}]::text[])
    order by c.relname
  loop
    execute format('select exists(select 1 from dpg_app.%I limit 1)', excluded_table)
      into excluded_has_rows;
    if excluded_has_rows then
      ${body}
    end if;
  end loop;`
}

export function buildCatalogueValidationSql(manifest) {
  const violations = validateCatalogueManifest(manifest)
  if (violations.length > 0) throw new Error('catalogue_manifest_invalid')
  const expected = new Map(manifest.tables.map((entry) => [entry.tableName, entry]))
  const checks = CATALOGUE_TABLES.map((table) => {
    const entry = expected.get(table)
    return `${tableHashSelect(table)} into actual_count, actual_hash;
  if actual_count <> ${entry.rowCount} or actual_hash <> '${entry.sha256}' then
    raise exception 'CATALOGUE_MANIFEST_MISMATCH table=${table}';
  end if;`
  }).join('\n\n  ')

  return `set local timezone = 'UTC';
do $catalogue_restore_validation$
declare
  actual_count bigint;
  actual_hash text;
  excluded_table text;
  excluded_has_rows boolean;
begin
  ${excludedTableLoop("raise exception 'CATALOGUE_EXCLUDED_ROWS table=%', excluded_table;")}

  ${checks}
end
$catalogue_restore_validation$;
-- excludedRows are validated dynamically and never populated with row data.
`
}

export function buildCatalogueSnapshotSql() {
  const inserts = CATALOGUE_TABLES.map((table) => `insert into catalogue_manifest_entries
select '${table}', row_count, sha256 from (${tableHashSelect(table)}) as snapshot(row_count, sha256);`).join('\n')

  return `create temp table catalogue_manifest_entries (
  table_name text primary key,
  row_count bigint not null,
  sha256 char(64) not null
);
create temp table catalogue_excluded_rows (
  table_name text primary key
);
begin transaction isolation level repeatable read read only;
set local timezone = 'UTC';

${inserts}

do $catalogue_excluded_snapshot$
declare
  excluded_table text;
  excluded_has_rows boolean;
begin
  ${excludedTableLoop('insert into catalogue_excluded_rows values (excluded_table);')}
end
$catalogue_excluded_snapshot$;

select jsonb_build_object(
  'contract', '${CATALOGUE_RESTORE_CONTRACT}',
  'tables', coalesce((
    select jsonb_agg(jsonb_build_object(
      'tableName', table_name,
      'rowCount', row_count,
      'sha256', sha256
    ) order by table_name)
    from catalogue_manifest_entries
  ), '[]'::jsonb),
  'excludedRows', coalesce((
    select jsonb_agg(table_name order by table_name)
    from catalogue_excluded_rows
  ), '[]'::jsonb)
)::text;
commit;
drop table catalogue_manifest_entries, catalogue_excluded_rows;
`
}

export function buildCatalogueSequenceSql() {
  const allowlist = CATALOGUE_TABLES.map((table) => `'${table}'`).join(', ')
  return `do $catalogue_sequence_reset$
declare
  table_name text;
  sequence_name text;
  maximum_id bigint;
  sequence_increment bigint;
  sequence_minimum bigint;
  sequence_maximum bigint;
  next_sequence_value bigint;
begin
  foreach table_name in array array[${allowlist}]::text[]
  loop
    sequence_name := pg_get_serial_sequence(format('dpg_app.%I', table_name), 'id');
    if sequence_name is not null then
      execute format('select max(id)::bigint from dpg_app.%I', table_name) into maximum_id;
      if maximum_id is not null then
        select seqincrement, seqmin, seqmax
          into sequence_increment, sequence_minimum, sequence_maximum
          from pg_sequence where seqrelid = sequence_name::regclass;
        if sequence_increment is null or sequence_increment <= 0 then
          raise exception 'catalogue_sequence_increment_invalid';
        end if;
        next_sequence_value := maximum_id + sequence_increment;
        if next_sequence_value < sequence_minimum or next_sequence_value > sequence_maximum then
          raise exception 'catalogue_sequence_value_out_of_range';
        end if;
        execute format('alter sequence %s restart with %s', sequence_name::regclass, next_sequence_value);
      end if;
    end if;
  end loop;
end
$catalogue_sequence_reset$;
`
}

export function buildCatalogueRestoreIdentitySql() {
  const catalogueTables = CATALOGUE_TABLES.map((table) => `'${table}'`).join(', ')
  return `do $catalogue_restore_identity$
declare
  relation record;
  catalogue_tables text[] := array[${catalogueTables}]::text[];
  support_relations text[] := array[
    'dpg_control.target_contract', 'dpg_control.runtime_migration_ledger',
    'dpg_control.leo538_restore_manifest', 'dpg_v1.categories', 'dpg_v1.role_capabilities'
  ];
  relation_is_catalogue boolean;
  relation_is_support boolean;
begin
  if current_database() <> 'postgres'
     or session_user <> 'dpg_catalogue_restore_login'
     or current_user <> 'dpg_catalogue_restore' then
    raise exception 'catalogue_restore_identity_mismatch';
  end if;

  if not exists (
    select 1 from pg_roles
    where rolname = 'dpg_catalogue_restore_login'
      and rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole
      and not rolinherit and not rolreplication and not rolbypassrls
  ) or not exists (
    select 1 from pg_roles
    where rolname = 'dpg_catalogue_restore'
      and not rolcanlogin and not rolsuper and not rolcreatedb and not rolcreaterole
      and not rolinherit and not rolreplication and rolbypassrls
  ) then
    raise exception 'catalogue_restore_role_attributes_invalid';
  end if;

  if (select count(*) from pg_auth_members
      where member = (select oid from pg_roles where rolname = 'dpg_catalogue_restore_login')) <> 1
     or not exists (
       select 1 from pg_auth_members m
       join pg_roles capability on capability.oid = m.roleid
       join pg_roles login on login.oid = m.member
       where capability.rolname = 'dpg_catalogue_restore'
         and login.rolname = 'dpg_catalogue_restore_login'
         and not m.admin_option and not m.inherit_option and m.set_option
     )
     or exists (
       select 1 from pg_auth_members m
       join pg_roles granted on granted.oid = m.roleid
       join pg_roles member_role on member_role.oid = m.member
       where (granted.rolname in ('dpg_catalogue_restore', 'dpg_catalogue_restore_login')
          or member_role.rolname = 'dpg_catalogue_restore')
         and not (granted.rolname = 'dpg_catalogue_restore'
          and member_role.rolname = 'dpg_catalogue_restore_login')
     ) then
    raise exception 'catalogue_restore_membership_invalid';
  end if;

  if not has_schema_privilege(current_user, 'dpg_app', 'USAGE')
     or not has_schema_privilege(current_user, 'dpg_control', 'USAGE')
     or not has_schema_privilege(current_user, 'dpg_v1', 'USAGE')
     or exists (
       select 1 from pg_namespace n
       where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
         and has_schema_privilege(current_user, n.oid, 'CREATE')
     )
     or has_database_privilege(current_user, current_database(), 'CREATE')
     or (select count(*) from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where (n.nspname || '.' || c.relname) = any(support_relations)
           and c.relkind in ('r', 'p')) <> cardinality(support_relations) then
    raise exception 'catalogue_restore_schema_or_support_contract_invalid';
  end if;

  if (select count(*) from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'dpg_app' and c.relname = any(catalogue_tables)
        and c.relkind in ('r', 'p')) <> cardinality(catalogue_tables) then
    raise exception 'catalogue_restore_table_set_incomplete';
  end if;

  for relation in
    select c.oid, c.relname, n.nspname, c.relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('dpg_app', 'dpg_control', 'dpg_v1', 'public', 'auth', 'storage')
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    relation_is_catalogue := relation.nspname = 'dpg_app'
      and relation.relname = any(catalogue_tables)
      and relation.relkind in ('r', 'p');
    relation_is_support := (relation.nspname || '.' || relation.relname) = any(support_relations);

    if relation_is_catalogue then
      if not has_table_privilege(current_user, relation.oid, 'SELECT')
         or not has_table_privilege(current_user, relation.oid, 'INSERT')
         or has_table_privilege(current_user, relation.oid, 'UPDATE')
         or has_table_privilege(current_user, relation.oid, 'DELETE')
         or has_table_privilege(current_user, relation.oid, 'TRUNCATE')
         or has_table_privilege(current_user, relation.oid, 'REFERENCES')
         or has_table_privilege(current_user, relation.oid, 'TRIGGER') then
        raise exception 'catalogue_restore_catalogue_grants_invalid';
      end if;
    elsif relation_is_support then
      if not has_table_privilege(current_user, relation.oid, 'SELECT')
         or has_table_privilege(current_user, relation.oid, 'INSERT')
         or has_table_privilege(current_user, relation.oid, 'UPDATE')
         or has_table_privilege(current_user, relation.oid, 'DELETE')
         or has_table_privilege(current_user, relation.oid, 'TRUNCATE')
         or has_table_privilege(current_user, relation.oid, 'REFERENCES')
         or has_table_privilege(current_user, relation.oid, 'TRIGGER') then
        raise exception 'catalogue_restore_support_grants_invalid';
      end if;
    elsif has_table_privilege(current_user, relation.oid, 'SELECT')
       or has_table_privilege(current_user, relation.oid, 'INSERT')
       or has_table_privilege(current_user, relation.oid, 'UPDATE')
       or has_table_privilege(current_user, relation.oid, 'DELETE')
       or has_table_privilege(current_user, relation.oid, 'TRUNCATE')
       or has_table_privilege(current_user, relation.oid, 'REFERENCES')
       or has_table_privilege(current_user, relation.oid, 'TRIGGER') then
      raise exception 'catalogue_restore_unrelated_grant_present';
    end if;
  end loop;

  for relation in
    select sequence.oid, n.nspname,
      exists (
        select 1 from pg_depend dependency
        join pg_class table_object on table_object.oid = dependency.refobjid
        where dependency.classid = 'pg_class'::regclass
          and dependency.objid = sequence.oid
          and dependency.refclassid = 'pg_class'::regclass
          and dependency.deptype in ('a', 'i')
          and table_object.relnamespace = 'dpg_app'::regnamespace
          and table_object.relname = any(catalogue_tables)
      ) as allowlisted_sequence
    from pg_class sequence
    join pg_namespace n on n.oid = sequence.relnamespace
    where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
      and sequence.relkind = 'S'
  loop
    if relation.nspname = 'dpg_app' and relation.allowlisted_sequence then
      if not exists (select 1 from pg_class where oid = relation.oid
                     and relowner = (select oid from pg_roles where rolname = 'dpg_catalogue_restore')) then
        raise exception 'catalogue_restore_sequence_owner_invalid';
      end if;
    elsif has_sequence_privilege(current_user, relation.oid, 'USAGE')
       or has_sequence_privilege(current_user, relation.oid, 'SELECT')
       or has_sequence_privilege(current_user, relation.oid, 'UPDATE') then
      raise exception 'catalogue_restore_unrelated_sequence_grant_present';
    end if;
  end loop;

  if exists (
    select 1
    from pg_proc function_object
    join pg_namespace n on n.oid = function_object.pronamespace
    where n.nspname in ('dpg_app', 'dpg_control', 'dpg_v1', 'dpg_v1_api', 'public')
      and has_schema_privilege(current_user, n.oid, 'USAGE')
      and has_function_privilege(current_user, function_object.oid, 'EXECUTE')
  ) then
    raise exception 'catalogue_restore_function_execute_present';
  end if;
end
$catalogue_restore_identity$;
`
}

export function buildRuntimeBaselinePreflightSql() {
  const tableList = CATALOGUE_TABLES.map((table) => `'${table}'`).join(', ')
  return `do $runtime_baseline_preflight$
declare
  table_name text;
  table_has_rows boolean;
  catalogue_tables text[] := array[${tableList}]::text[];
begin
  if current_setting('server_version_num')::integer not between 170000 and 179999 then
    raise exception 'runtime_baseline_postgres_version_mismatch';
  end if;
  if pg_database_size(current_database()) >= 367001600 then
    raise exception 'runtime_baseline_database_size_limit';
  end if;
  if not exists (
    select 1 from dpg_control.target_contract
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
    raise exception 'runtime_baseline_target_contract_mismatch';
  end if;
  if to_regclass('dpg_control.runtime_migration_ledger') is not null
     or to_regnamespace('dpg_v1') is not null
     or to_regnamespace('dpg_v1_api') is not null
     or to_regclass('dpg_v1.products') is not null
     or to_regprocedure('dpg_v1_api.public_product_get(uuid)') is not null
     or to_regprocedure('dpg_v1_api.catalogue_media_register(jsonb,text)') is not null
     or to_regprocedure('dpg_v1_api.order_intake_create(jsonb,text)') is not null
     or exists (select 1 from pg_roles where rolname = 'dpg_backup') then
    raise exception 'runtime_baseline_migration_state_changed';
  end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'dpg_app' and c.relkind in ('r','p')
        and (not c.relrowsecurity or not c.relforcerowsecurity)) <> 13 then
    raise exception 'runtime_baseline_rls_gap_set_changed';
  end if;
  if exists (select 1 from auth.users) or exists (select 1 from storage.objects) then
    raise exception 'runtime_baseline_auth_storage_not_empty';
  end if;
  foreach table_name in array catalogue_tables loop
    if to_regclass(format('dpg_app.%I', table_name)) is null then
      raise exception 'runtime_baseline_catalogue_table_missing';
    end if;
    execute format('select exists (select 1 from dpg_app.%I)', table_name) into table_has_rows;
    if table_has_rows then
      raise exception 'runtime_baseline_catalogue_not_empty';
    end if;
  end loop;
end
$runtime_baseline_preflight$;

select pg_database_size(current_database())::bigint::text || '|' ||
  (select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'dpg_app' and c.relkind in ('r','p')
     and (not c.relrowsecurity or not c.relforcerowsecurity)) || '|' ||
  cardinality(array[${tableList}]::text[])::text;
`
}

export function validateCatalogueSourceManifest(manifest, expectedIdentity) {
  const violations = []
  if (!manifest || typeof manifest !== 'object' || manifest.formatVersion !== 2) {
    return ['source manifest format changed']
  }
  if (!same(manifest.target, EXPECTED_TARGET)) violations.push('source target contract changed')

  const identity = manifest.artifactIdentity
  if (!identity
    || !Number.isInteger(identity.prNumber)
    || !SAFE_SHA.test(identity.candidateSha ?? '')
    || !SAFE_SHA.test(identity.controlSha ?? '')
    || !SAFE_SHA.test(identity.mergeSha ?? '')
    || !/^\d+$/.test(identity.workflowRunId ?? '')
    || identity.manifestVersion !== 2
    || identity.prNumber !== expectedIdentity.prNumber
    || identity.candidateSha !== expectedIdentity.candidateSha
    || identity.controlSha !== expectedIdentity.controlSha
    || identity.mergeSha !== expectedIdentity.mergeSha
    || identity.workflowRunId !== expectedIdentity.workflowRunId) {
    violations.push('source artifact identity changed')
  }

  if (!Array.isArray(manifest.data) || manifest.data.some((entry) => !validDataEntry(entry))) {
    violations.push('source data manifest is invalid')
  } else {
    const names = manifest.data.map((entry) => entry.tableName)
    if (CATALOGUE_TABLES.some((table) => names.filter((name) => name === table).length !== 1)) {
      violations.push('source catalogue table set changed')
    }
  }
  return [...new Set(violations)]
}

function validateCatalogueManifest(manifest) {
  const violations = []
  if (!manifest || manifest.contract !== CATALOGUE_RESTORE_CONTRACT || !Array.isArray(manifest.tables)) {
    return ['catalogue manifest format changed']
  }
  const names = manifest.tables.map((entry) => entry?.tableName)
  if (manifest.tables.length !== CATALOGUE_TABLES.length
    || CATALOGUE_TABLES.some((table) => names.filter((name) => name === table).length !== 1)
    || names.some((table) => !CATALOGUE_TABLES.includes(table))) {
    violations.push('catalogue table set changed')
  }
  if (manifest.tables.some((entry) => !entry
    || !SAFE_TABLE.test(entry.tableName ?? '')
    || !Number.isInteger(entry.rowCount)
    || entry.rowCount < 0
    || !SAFE_HASH.test(entry.sha256 ?? ''))) {
    violations.push('catalogue manifest entry is invalid')
  }
  if (!Array.isArray(manifest.excludedRows)
    || manifest.excludedRows.some((table) => typeof table !== 'string' || !SAFE_TABLE.test(table))) {
    violations.push('excluded row report is invalid')
  }
  return [...new Set(violations)]
}

export function compareCatalogueManifests(expected, actual) {
  const violations = [...validateCatalogueManifest(expected), ...validateCatalogueManifest(actual)]
  const tables = new Set()
  if (violations.length > 0) return { violations: [...new Set(violations)], tables: [] }

  if (actual.excludedRows.length > 0) {
    violations.push('excluded rows are present')
    for (const table of actual.excludedRows) tables.add(table)
  }

  const actualByTable = new Map(actual.tables.map((entry) => [entry.tableName, entry]))
  let countChanged = false
  let hashChanged = false
  for (const entry of expected.tables) {
    const actualEntry = actualByTable.get(entry.tableName)
    if (entry.rowCount !== actualEntry.rowCount) {
      countChanged = true
      tables.add(entry.tableName)
    }
    if (entry.sha256 !== actualEntry.sha256) {
      hashChanged = true
      tables.add(entry.tableName)
    }
  }
  if (countChanged) violations.push('catalogue row counts changed')
  if (hashChanged) violations.push('catalogue row hashes changed')

  return {
    violations: [...new Set(violations)],
    tables: [...tables].sort(),
  }
}

async function main() {
  const [mode, ...args] = process.argv.slice(2)
  if (mode === 'table-args') {
    process.stdout.write(`${catalogueTableArguments().filter((_, index) => index % 2 === 1).map((table) => `--table=${table}`).join('\n')}\n`)
    return
  }
  if (mode === 'snapshot-sql') {
    process.stdout.write(buildCatalogueSnapshotSql())
    return
  }
  if (mode === 'rehearsal-target-check-sql') {
    process.stdout.write(buildRehearsalTargetCheckSql())
    return
  }
  if (mode === 'sequence-sql') {
    process.stdout.write(buildCatalogueSequenceSql())
    return
  }
  if (mode === 'catalogue-restore-identity-sql') {
    process.stdout.write(buildCatalogueRestoreIdentitySql())
    return
  }
  if (mode === 'baseline-preflight-sql') {
    process.stdout.write(buildRuntimeBaselinePreflightSql())
    return
  }
  if (mode === 'validation-sql') {
    const manifest = JSON.parse(await readFile(args[0], 'utf8'))
    process.stdout.write(buildCatalogueValidationSql(manifest))
    return
  }
  if (mode === 'validate-source') {
    const [manifestPath, prNumber, candidateSha, controlSha, workflowRunId, mergeSha] = args
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    const violations = validateCatalogueSourceManifest(manifest, {
      prNumber: Number(prNumber), candidateSha, controlSha, workflowRunId, mergeSha,
    })
    if (violations.length > 0) throw new Error('source_manifest_contract_failed')
    process.stdout.write('CATALOGUE_REHOME_SOURCE status=PASS\n')
    return
  }
  if (mode === 'compare') {
    const [expectedPath, actualPath] = args
    const expected = JSON.parse(await readFile(expectedPath, 'utf8'))
    const actual = JSON.parse(await readFile(actualPath, 'utf8'))
    const result = compareCatalogueManifests(expected, actual)
    if (result.violations.length > 0) {
      const tables = result.tables.length > 0 ? result.tables.join(',') : 'none'
      process.stderr.write(`CATALOGUE_REHOME_COMPARE status=FAIL tables=${tables}\n`)
      process.exitCode = 1
      return
    }
    process.stdout.write('CATALOGUE_REHOME_COMPARE status=PASS\n')
    return
  }
  throw new Error('unsupported_mode')
}

if (process.argv[1]?.endsWith('/catalogue-restore-contract.mjs')) void main().catch((error) => {
  process.stderr.write(`CATALOGUE_REHOME_CONTRACT status=FAIL error=${error instanceof Error ? error.message.replaceAll(/\s+/g, '_') : 'unknown'}\n`)
  process.exitCode = 1
})
