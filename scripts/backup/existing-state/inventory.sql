set local search_path = pg_catalog, public, extensions;
set local timezone = 'UTC';
set local datestyle = 'ISO, YMD';
with relations as (
 select jsonb_agg(jsonb_build_object(
  'name',n.nspname||'.'||c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),
  'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,
  'acl',coalesce((select jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable) order by a.grantee,a.privilege_type,a.grantor)
   from aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner))) a),'[]'::jsonb),
  'shape',encode(sha256(convert_to(jsonb_build_object(
   'columns',(select jsonb_agg(jsonb_build_array(att.attname,format_type(att.atttypid,att.atttypmod),att.attnotnull,att.attidentity,att.attgenerated,coalesce(pg_get_expr(ad.adbin,ad.adrelid),''),att.attcollation::regcollation::text) order by att.attnum) from pg_attribute att left join pg_attrdef ad on ad.adrelid=att.attrelid and ad.adnum=att.attnum where att.attrelid=c.oid and att.attnum>0 and not att.attisdropped),
   'constraints',(select jsonb_agg(jsonb_build_array(con.conname,pg_get_constraintdef(con.oid)) order by con.conname) from pg_constraint con where con.conrelid=c.oid),
   'indexes',(select jsonb_agg(pg_get_indexdef(i.indexrelid) order by ci.relname) from pg_index i join pg_class ci on ci.oid=i.indexrelid where i.indrelid=c.oid),
   'triggers',(select jsonb_agg(jsonb_build_array(t.tgname,pg_get_triggerdef(t.oid),t.tgenabled) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal),
   'view',case when c.relkind in ('v','m') then pg_get_viewdef(c.oid,true) else null end,
   'partition',case when c.relkind='p' then pg_get_partkeydef(c.oid) else null end,
   'bound',pg_get_expr(c.relpartbound,c.oid),
   'sequence',(select jsonb_build_array(s.seqstart,s.seqincrement,s.seqmax,s.seqmin,s.seqcache,s.seqcycle) from pg_sequence s where s.seqrelid=c.oid)
  )::text,'UTF8')),'hex'),
  'policies',coalesce((select jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',array(select case when x=0 then 'PUBLIC' else pg_get_userbyid(x) end from unnest(p.polroles) x order by case when x=0 then 'PUBLIC' else pg_get_userbyid(x) end),'usingHash',case when p.polqual is null then null else encode(sha256(convert_to(pg_get_expr(p.polqual,p.polrelid),'UTF8')),'hex') end,'checkHash',case when p.polwithcheck is null then null else encode(sha256(convert_to(pg_get_expr(p.polwithcheck,p.polrelid),'UTF8')),'hex') end) order by p.polname) from pg_policy p where p.polrelid=c.oid),'[]'::jsonb)
 ) order by n.nspname,c.relname) as value
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('dpg_app','dpg_control','dpg_v1') and c.relkind in ('r','p','S','v','m','f')
), schemas as (
 select jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',coalesce((select jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable) order by a.grantee,a.privilege_type,a.grantor) from aclexplode(coalesce(nspacl,acldefault('n',nspowner))) a),'[]'::jsonb)) order by nspname) value
 from pg_namespace where nspname in ('dpg_app','dpg_control','dpg_v1')
), roles as (
 select jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'super',rolsuper,'createDb',rolcreatedb,'createRole',rolcreaterole,'inherit',rolinherit,'replication',rolreplication,'bypassRls',rolbypassrls,'limit',rolconnlimit,'settingsHash',encode(sha256(convert_to(coalesce((select jsonb_agg(jsonb_build_array(coalesce(d.datname,'*'),s.setconfig) order by s.setdatabase)::text from pg_db_role_setting s left join pg_database d on d.oid=s.setdatabase where s.setrole=r.oid),''),'UTF8')),'hex')) order by rolname) value from pg_roles r where rolname like 'dpg\_%' escape '\'
), memberships as (
 select coalesce(jsonb_agg(jsonb_build_array(g.rolname,m.rolname,a.admin_option,a.inherit_option,a.set_option) order by g.rolname,m.rolname),'[]'::jsonb) value from pg_auth_members a join pg_roles g on g.oid=a.roleid join pg_roles m on m.oid=a.member where g.rolname like 'dpg\_%' escape '\' or m.rolname like 'dpg\_%' escape '\'
), routines as (
 select coalesce(jsonb_agg(jsonb_build_object('name',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')','owner',pg_get_userbyid(p.proowner),'definitionHash',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),'aclHash',encode(sha256(convert_to(coalesce(p.proacl::text,''),'UTF8')),'hex')) order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)),'[]'::jsonb) value from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind in ('f','p') and (n.nspname in ('dpg_app','dpg_control','dpg_v1') or (n.nspname='public' and p.proname like 'runtime\_%' escape '\'))
), defaults as (
 select coalesce(jsonb_agg(jsonb_build_array(pg_get_userbyid(d.defaclrole),coalesce(n.nspname,'*'),d.defaclobjtype,d.defaclacl::text) order by d.defaclrole,d.defaclnamespace,d.defaclobjtype),'[]'::jsonb) value from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where n.nspname in ('dpg_app','dpg_control','dpg_v1') or pg_get_userbyid(d.defaclrole) like 'dpg\_%' escape '\'
), types as (
 select coalesce(jsonb_agg(jsonb_build_array(n.nspname||'.'||t.typname,t.typtype,pg_get_userbyid(t.typowner),encode(sha256(convert_to(jsonb_build_array(t.typbasetype::regtype::text,t.typnotnull,t.typdefault,(select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid))::text,'UTF8')),'hex')) order by n.nspname,t.typname),'[]'::jsonb) value from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('dpg_app','dpg_control','dpg_v1')
)
select jsonb_build_object('version',1,'target','bonxyxluzlxfkdetryoo','schemas',schemas.value,'relations',relations.value,'roles',roles.value,'memberships',memberships.value,'routines',routines.value,'defaults',defaults.value,'types',types.value,'publicReadViews',(select coalesce(jsonb_agg(jsonb_build_object('name',n.nspname||'.'||c.relname,'definitionHash',encode(sha256(convert_to(pg_get_viewdef(c.oid,true),'UTF8')),'hex'),'aclHash',encode(sha256(convert_to(c.relacl::text,'UTF8')),'hex'),'extension',e.extname) order by c.relname),'[]'::jsonb) from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_depend d on d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e' join pg_extension e on e.oid=d.refobjid where n.nspname='extensions' and c.relkind='v' and c.relname in ('pg_stat_statements','pg_stat_statements_info') and e.extname='pg_stat_statements')) as inventory from schemas,relations,roles,memberships,routines,defaults,types;
