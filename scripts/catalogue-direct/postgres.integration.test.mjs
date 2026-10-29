// @vitest-environment node
import pg from 'pg'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CATALOGUE_TABLES, CATALOGUE_RESTORE_ORDER, insertSql, rowsSql, provisioningSql, assertSchema, HEADROOM_BODY } from './contract.mjs'
import { metadata, assertTargetPrivate, attestRole } from './run.mjs'
import { RLS_EVENT_BODY } from './platform-boundary.mjs'
import { setupState, assertBeforeSetup } from './setup-state.mjs'

const url = process.env.POSTGRES_SNAPSHOT_INTEGRATION_URL
describe.skipIf(!url)('direct data-only mapping on isolated PostgreSQL', () => {
  it('allows the PG17 non-superuser creator to attest a new role without retaining SET authority',async()=>{
    const base=new URL(url)
    expect(['127.0.0.1','localhost','[::1]']).toContain(base.hostname)
    const client=new pg.Client({connectionString:url});await client.connect()
    const creator=`direct_creator_${process.pid}`,proof=`direct_proof_${process.pid}`
    try {
      await client.query(`create role ${creator} nologin nosuperuser createrole bypassrls`)
      await client.query(`set session authorization ${creator};begin;set local createrole_self_grant='set'`)
      await client.query(`create role ${proof} nologin nosuperuser nocreaterole noinherit bypassrls`)
      await client.query(`set local role ${proof}`)
      expect((await client.query('select current_user as name')).rows[0].name).toBe(proof)
      await client.query(`reset role;grant ${proof} to ${creator} with set false;commit`)
      expect((await client.query('select pg_has_role($1,$2,\'SET\') as allowed',[creator,proof])).rows[0].allowed).toBe(false)
    } finally {
      await client.query('rollback;reset session authorization')
      await client.query(`drop role if exists ${proof};drop role if exists ${creator}`)
      await client.end()
    }
  })
  it('preserves all 27 table hashes, precision, FK/keys and rolls back rows AND sequence restart', async () => {
    const base = new URL(url)
    // This fixture must never connect to either approved remote database or any arbitrary host.
    expect(['127.0.0.1', 'localhost', '[::1]']).toContain(base.hostname)
    const admin = new pg.Client({ connectionString: url })
    await admin.connect()
    const database = `direct_fixture_${process.pid}_${Date.now()}`
    let client, createdRole = false, createdGuest = false, createdAuthenticated = false
    const guest = `direct_guest_${process.pid}`
    // PostgreSQL roles are cluster-wide, so never collide with another parallel
    // fixture that happens to create the canonical Supabase role.
    const authenticatedRole = `direct_authenticated_${process.pid}_${Date.now()}`
    try {
      await admin.query(`create database ${database}`)
      base.pathname = '/' + database
      client = new pg.Client({ connectionString: base.toString() }); await client.connect()
      await client.query('create schema dpg_app')
      for (const namespace of ['public', 'dpg_app']) for (const table of CATALOGUE_TABLES) {
        await client.query(`create table ${namespace}.${table}(id serial primary key,label text,amount numeric(30,2),payload jsonb);
          alter table ${namespace}.${table} enable row level security;
          alter table ${namespace}.${table} force row level security`)
      }
      await client.query('alter table public.products add foreign key(id) references public.brands(id)')
      await client.query('alter table dpg_app.products add foreign key(id) references dpg_app.brands(id)')
      const parity = readFileSync(new URL('./target-parity.sql', import.meta.url), 'utf8')
      const extraColumns = new Map(CATALOGUE_TABLES.map((t) => [t, new Set()]))
      for (const match of parity.matchAll(/alter table dpg_app\."([a-z_]+)" add constraint \w+ UNIQUE \(([^)]+)\)/g)) {
        for (const column of match[2].split(', ')) extraColumns.get(match[1]).add(column)
      }
      extraColumns.get('products').add('stock_status')
      extraColumns.get('product_descriptions').add('clean_issues')
      extraColumns.get('spec_options').add('aliases')
      for (const namespace of ['public', 'dpg_app']) {
        for (const [table, columns] of extraColumns) for (const column of columns) {
          await client.query(`alter table ${namespace}.${table} add column if not exists ${column} text default '${column === 'stock_status' ? 'in_stock' : ''}'`)
        }
        // Both sides are synthetic. Apply the same reviewed parity definitions to
        // prove constraints/nullability without touching either real database.
        if (namespace === 'dpg_app') {
          const failing = parity.replace('\ncommit;', "\ndo $fixture_fail$ begin raise exception 'INJECTED_PREPARE_FAILURE'; end $fixture_fail$;\ncommit;")
          await expect(client.query(failing)).rejects.toMatchObject({ code: 'P0001' })
          await client.query('rollback')
          expect((await client.query("select count(*)::text as n from pg_constraint where connamespace='dpg_app'::regnamespace and conname like 'direct_parity_%'")).rows[0].n).toBe('0')
        }
        await client.query(parity.replaceAll('dpg_app.', `${namespace}.`))
      }
      for (const table of CATALOGUE_TABLES) {
        await client.query(`insert into public.${table}(id,label,amount,payload) values (1,$1,9007199254740993123.25,$2)`,
          ['Tiếng Việt\nquote"\\', JSON.stringify({ text: 'a\nb', nullable: null })])
      }
      await client.query('set search_path=pg_catalog')
      assertSchema(await metadata(client, 'public'), await metadata(client, 'dpg_app'))
      await client.query(`create role ${guest} nologin`); createdGuest = true
      await client.query(`alter default privileges in schema dpg_app grant execute on functions to ${guest}`)
      const failedProvision = provisioningSql('import').replace('\ncommit;', "\ndo $fixture_fail$ begin raise exception 'INJECTED_ROLE_FAILURE'; end $fixture_fail$;\ncommit;")
      await expect(client.query(failedProvision)).rejects.toMatchObject({ code: 'P0001' })
      await client.query('rollback')
      expect((await client.query("select to_regrole('dpg_direct_import') as role")).rows[0].role).toBeNull()
      await client.query(provisioningSql('import')); createdRole = true
      const beforeSetup=await setupState(client,'dpg_app')
      expect(beforeSetup.tables).toHaveLength(27)
      expect(beforeSetup.sequence_state).toHaveLength(27)
      assertBeforeSetup(beforeSetup,await setupState(client,'dpg_app'))
      const drift=structuredClone(beforeSetup); drift.tables[0].owner='different_owner'
      expect(()=>assertBeforeSetup(beforeSetup,drift)).toThrow('SETUP_BEFORE_STATE_CHANGED')
      await client.query('create policy fixture_restrictive on dpg_app.brands as restrictive using(true)')
      await expect(setupState(client,'dpg_app')).rejects.toThrow('SETUP_POLICY_SEMANTICS')
      await client.query('drop policy fixture_restrictive on dpg_app.brands')
      await client.query(`create function dpg_app.fixture_guard() returns trigger language plpgsql as 'begin return null; end';
        create trigger leo538_free_tier_headroom after insert or update on dpg_app.brands
        for each statement execute function dpg_app.fixture_guard();
        alter table dpg_app.brands disable trigger leo538_free_tier_headroom`)
      await expect(setupState(client,'dpg_app')).rejects.toThrow('SETUP_TRIGGER_SEMANTICS')
      await client.query('drop trigger leo538_free_tier_headroom on dpg_app.brands; drop function dpg_app.fixture_guard()')
      // Only extension-owned platform views and the exact non-callable event
      // trigger are exempt. Arbitrary views/SECURITY DEFINER routines still fail.
      await client.query('create schema extensions; create extension pg_stat_statements with schema extensions')
      await client.query(`create function public.rls_auto_enable() returns event_trigger language plpgsql
        security definer set search_path=pg_catalog as $event$${RLS_EVENT_BODY}$event$`)
      await client.query(`create schema dpg_control;
        create function dpg_control.enforce_free_tier_headroom_statement() returns trigger language plpgsql
        security definer set search_path=pg_catalog as $guard$${HEADROOM_BODY}$guard$;
        revoke all on function dpg_control.enforce_free_tier_headroom_statement() from public`)
      await client.query('set role dpg_direct_import')
      expect((await client.query("select has_schema_privilege(current_user,'dpg_control','USAGE') as allowed")).rows[0].allowed).toBe(false)
      await expect(client.query("select to_regprocedure('dpg_control.enforce_free_tier_headroom_statement()')")).rejects.toMatchObject({code:'42501'})
      await attestRole(client,'import')
      await client.query('reset role')
      await client.query("create function public.unrelated_definer() returns integer language sql security definer as 'select 1'")
      await client.query('set role dpg_direct_import')
      await expect(attestRole(client,'import')).rejects.toThrow('ROLE_AUTHORITY_BOUNDARY')
      await client.query('reset role; drop function public.unrelated_definer(); drop extension pg_stat_statements')
      await client.query('create view extensions.pg_stat_statements as select 1 as harmless; grant select on extensions.pg_stat_statements to public')
      await client.query('set role dpg_direct_import')
      await expect(attestRole(client,'import')).rejects.toThrow('ROLE_TABLE_BOUNDARY')
      await client.query('reset role; drop view extensions.pg_stat_statements')
      expect((await client.query("select has_function_privilege($1,'dpg_app.direct_catalogue_restart(text,text,bigint)','EXECUTE') as allowed", [guest])).rows[0].allowed).toBe(false)
      const source = new Map()
      const columns = new Map((await metadata(client, 'public')).map((t) => [t.name, t.columns.map((c) => c.name)]))
      for (const table of CATALOGUE_RESTORE_ORDER) source.set(table, (await client.query(rowsSql('public', table))).rows.map((r) => r.row_text))
      await client.query('set session authorization dpg_direct_import')
      await client.query('begin')
      for (const table of CATALOGUE_RESTORE_ORDER) await client.query(insertSql(table, columns.get(table)),
        ['[' + source.get(table).join(',') + ']'])
      await client.query("select dpg_app.direct_catalogue_restart('products','id',2)")
      expect((await client.query('select last_value::text,is_called from dpg_app.products_id_seq')).rows[0])
        .toEqual({ last_value: '2', is_called: false })
      await expect(client.query('insert into dpg_app.products(id) values(1)')).rejects.toMatchObject({ code: '23505' })
      await client.query('rollback')
      expect((await client.query('select count(*)::text as n from dpg_app.products')).rows[0].n).toBe('0')
      expect((await client.query('select last_value::text,is_called from dpg_app.products_id_seq')).rows[0])
        .toEqual({ last_value: '1', is_called: false })
      await client.query('begin')
      for (const table of CATALOGUE_RESTORE_ORDER) {
        await client.query(insertSql(table, columns.get(table)), ['[' + source.get(table).join(',') + ']'])
        expect((await client.query(rowsSql('dpg_app', table))).rows.map((r) => r.row_text)).toEqual(source.get(table))
        await client.query('select dpg_app.direct_catalogue_restart($1,$2,2)', [table, 'id'])
      }
      await client.query('commit')
      await expect(client.query('delete from dpg_app.products')).rejects.toMatchObject({ code: '42501' })
      await expect(client.query("select dpg_app.direct_catalogue_restart('admin_sessions','id',2)")).rejects.toMatchObject({ code: 'P0001' })
      await expect(client.query("select dpg_app.direct_catalogue_restart('products','id',1)")).rejects.toMatchObject({ code: 'P0001' })
      await client.query('reset session authorization')
      await expect(client.query("select dpg_app.direct_catalogue_restart('products','id',2)")).rejects.toMatchObject({ code: 'P0001' })
      await client.query(`create role ${authenticatedRole} nologin`); createdAuthenticated = true
      await assertTargetPrivate(client, authenticatedRole)
      await client.query(`alter table dpg_app.products add column is_active boolean default true,
        add column publication_status varchar default 'public',add column pdp_visibility varchar default 'public',
        add column sellable_status varchar default 'sellable';
        grant usage on schema dpg_app to ${authenticatedRole};grant select on dpg_app.products to ${authenticatedRole};
        create policy leo541_products_select_public on dpg_app.products for select to ${authenticatedRole}
        using(is_active and publication_status='public' and pdp_visibility='public' and sellable_status='sellable')`)
      await assertTargetPrivate(client, authenticatedRole)
      await client.query(`set row_security=on;set role ${authenticatedRole}`)
      expect((await client.query('select count(*)::int as n from dpg_app.products')).rows[0].n).toBe(1)
      await client.query('reset role')
      await client.query("update dpg_app.products set publication_status='private'")
      await client.query(`set row_security=on;set role ${authenticatedRole}`)
      expect((await client.query('select count(*)::int as n from dpg_app.products')).rows[0].n).toBe(0)
      await client.query('reset role')
      await client.query(`create policy unexpected_public_read on dpg_app.products to ${authenticatedRole} using(true)`)
      await expect(assertTargetPrivate(client, authenticatedRole)).rejects.toThrow('TARGET_PUBLIC_EXPOSURE')
      await client.query(`drop policy unexpected_public_read on dpg_app.products;grant select on dpg_app.brands to ${authenticatedRole}`)
      await expect(assertTargetPrivate(client, authenticatedRole)).rejects.toThrow('TARGET_PUBLIC_EXPOSURE')
      await client.query(`revoke select on dpg_app.brands from ${authenticatedRole};alter table dpg_app.products no force row level security`)
      await expect(assertTargetPrivate(client, authenticatedRole)).rejects.toThrow('TARGET_PUBLIC_EXPOSURE')
      await client.query('alter table dpg_app.products force row level security')
      await assertTargetPrivate(client, authenticatedRole)
      await client.query('grant select on dpg_app.products to public')
      await expect(assertTargetPrivate(client, authenticatedRole)).rejects.toThrow('TARGET_PUBLIC_EXPOSURE')
      await client.query('revoke select on dpg_app.products from public')
      await assertTargetPrivate(client, authenticatedRole)
      await expect(client.query(parity)).rejects.toMatchObject({ code: 'P0001' })
    } finally {
      if (client) { try { await client.query('rollback'); await client.query('reset session authorization') } catch { /* fixture cleanup */ } await client.end() }
      await admin.query(`drop database if exists ${database} with (force)`)
      if (createdRole) await admin.query('revoke connect on database postgres from dpg_direct_import; drop role dpg_direct_import')
      if (createdAuthenticated) await admin.query(`drop role ${authenticatedRole}`)
      if (createdGuest) await admin.query(`drop role ${guest}`)
      await admin.end()
    }
  }, 90000)
})
