-- Phase 2 Admin: bounded, capability-checked search for guest order inbox.
-- Source only. Apply only through the approved local/hosted migration gates.

do $preflight$
begin
  if to_regprocedure('public.phase2_admin_order_list(text,integer,integer)') is null
     or to_regprocedure('dpg_app.leo542_actor_context()') is null
     or to_regprocedure('dpg_app.leo542_admin_can(text)') is null
     or to_regprocedure('public.phase2_admin_order_search(text,text,integer,integer)') is not null then
    raise exception 'DPG_PHASE2_ADMIN_SEARCH_PREFLIGHT_FAILED';
  end if;
end
$preflight$;

set role dpg_migration;
set search_path = pg_catalog, dpg_app, public;

create function public.phase2_admin_order_search(
  p_status text,
  p_search text,
  p_limit integer,
  p_offset integer
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, dpg_app
as $$
declare
  v_actor record;
  v_search text := lower(btrim(coalesce(p_search, '')));
begin
  select * into v_actor from dpg_app.leo542_actor_context();
  if v_actor.actor_kind <> 'admin'
     or not (dpg_app.leo542_admin_can('orders:read') or dpg_app.leo542_admin_can('orders:read_assigned')) then
    raise exception 'FORBIDDEN';
  end if;
  if p_status is not null and p_status not in ('pending', 'received', 'confirmed', 'inventory_check', 'completed', 'cancelled') then
    raise exception 'INVALID_ORDER_STATUS';
  end if;
  if length(v_search) > 100 then raise exception 'INVALID_SEARCH'; end if;
  if p_limit is null or p_offset is null or p_limit < 1 or p_limit > 50 or p_offset < 0 or p_offset > 10000 then
    raise exception 'INVALID_PAGINATION';
  end if;

  return jsonb_build_object(
    'orders', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc, x.id desc)
      from (
        select o.id, o.order_number, o.customer_name, o.customer_phone,
          o.status, o.payment_status, o.total, o.shipping_fee_status, o.assigned_to, o.created_at
        from dpg_app.orders o
        where o.order_origin = 'public_web'
          and (p_status is null or o.status = p_status)
          and (v_search = ''
            or strpos(lower(coalesce(o.order_number, '')), v_search) > 0
            or strpos(lower(coalesce(o.customer_name, '')), v_search) > 0
            or strpos(lower(coalesce(o.customer_phone, '')), v_search) > 0)
        order by o.created_at desc, o.id desc
        limit p_limit offset p_offset
      ) x
    ), '[]'::jsonb),
    'total', (
      select count(*)
      from dpg_app.orders o
      where o.order_origin = 'public_web'
        and (p_status is null or o.status = p_status)
        and (v_search = ''
          or strpos(lower(coalesce(o.order_number, '')), v_search) > 0
          or strpos(lower(coalesce(o.customer_name, '')), v_search) > 0
          or strpos(lower(coalesce(o.customer_phone, '')), v_search) > 0)
    )
  );
end
$$;

reset role;
revoke all on function public.phase2_admin_order_search(text,text,integer,integer)
  from public, anon, service_role;
grant execute on function public.phase2_admin_order_search(text,text,integer,integer)
  to authenticated;

do $postflight$
begin
  if not exists (
    select 1 from pg_proc p
    where p.oid = 'public.phase2_admin_order_search(text,text,integer,integer)'::regprocedure
      and not p.prosecdef and pg_get_userbyid(p.proowner) = 'dpg_migration'
  ) or has_function_privilege('anon', 'public.phase2_admin_order_search(text,text,integer,integer)', 'EXECUTE')
    or has_function_privilege('service_role', 'public.phase2_admin_order_search(text,text,integer,integer)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.phase2_admin_order_search(text,text,integer,integer)', 'EXECUTE') then
    raise exception 'DPG_PHASE2_ADMIN_SEARCH_POSTFLIGHT_FAILED';
  end if;
end
$postflight$;
