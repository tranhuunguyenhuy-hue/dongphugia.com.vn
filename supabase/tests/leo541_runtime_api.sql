-- LEO-541 sanitized acceptance test.
-- Run only after the Owner approves the exact isolated target and applies the
-- migration. All writes are synthetic and rolled back. This script prints no
-- customer, product, auth material, or database-row payload.
\set ON_ERROR_STOP on
begin;

-- Unauthenticated execution must fail at the function ACL boundary.
set local role anon;
do $$
begin
  begin
    perform public.runtime_order_list(1, 0);
    raise exception 'LEO-541 anonymous RPC unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end
$$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

do $$
declare
  v_owner_id constant uuid := '11111111-1111-4111-8111-111111111111';
  other_id constant uuid := '22222222-2222-4222-8222-222222222222';
  product_id integer;
  order_id integer;
  quote_id integer;
  first_response jsonb;
  replay_response jsonb;
  other_response jsonb;
  before_count integer;
  after_count integer;
  audit_count integer;
  idempotency_count integer;
begin
  select min(id) into product_id from dpg_app.products
   where is_active and publication_status='public' and pdp_visibility='public'
     and sellable_status='sellable' and stock_status in ('in_stock','pre_order','contact');
  if product_id is null then raise exception 'LEO-541 synthetic product fixture unavailable'; end if;

  first_response := public.runtime_order_create(
    jsonb_build_object('customer_name','LEO-541 synthetic owner','customer_phone','0900000001',
      'items',jsonb_build_array(jsonb_build_object('productId',product_id,'quantity',1,'installOption','none'))),
    'leo541-order-create-1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  replay_response := public.runtime_order_create(
    jsonb_build_object('customer_name','LEO-541 synthetic owner','customer_phone','0900000001',
      'items',jsonb_build_array(jsonb_build_object('productId',product_id,'quantity',1,'installOption','none'))),
    'leo541-order-create-1','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  if first_response <> replay_response then raise exception 'LEO-541 duplicate replay assertion failed'; end if;
  order_id := (first_response->>'order_id')::integer;

  if public.runtime_order_get(order_id) is null then raise exception 'LEO-541 owner read assertion failed'; end if;
  perform public.runtime_order_update(order_id, '{"status":"confirmed"}'::jsonb, 'leo541-order-update-1', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  if (public.runtime_order_get(order_id)->>'status') <> 'confirmed' then raise exception 'LEO-541 CRUD update assertion failed'; end if;
  begin
    perform public.runtime_order_update(order_id, '{"status":"cancelled"}'::jsonb, 'leo541-order-update-1', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    raise exception 'LEO-541 idempotency conflict unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'IDEMPOTENCY_KEY_REUSED' then raise; end if;
  end;

  first_response := public.runtime_quote_create(
    jsonb_build_object('name','LEO-541 synthetic owner','phone','0900000001','message','synthetic',
      'products',jsonb_build_array(jsonb_build_object('product_id',product_id,'quantity',1,'note','synthetic'))),
    'leo541-quote-create-1','dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  replay_response := public.runtime_quote_create(
    jsonb_build_object('name','LEO-541 synthetic owner','phone','0900000001','message','synthetic',
      'products',jsonb_build_array(jsonb_build_object('product_id',product_id,'quantity',1,'note','synthetic'))),
    'leo541-quote-create-1','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  if first_response <> replay_response then raise exception 'LEO-541 quote duplicate replay assertion failed'; end if;
  quote_id := (first_response->>'quote_id')::integer;
  select count(*) into audit_count from dpg_app.runtime_audit_events a
   where a.owner_id=v_owner_id and a.resource_id in (order_id::text, quote_id::text);
  if audit_count < 3 then raise exception 'LEO-541 sanitized audit assertion failed'; end if;
  select count(*) into idempotency_count from dpg_app.runtime_idempotency_records i
   where i.owner_id=v_owner_id and i.resource_id in (order_id::text, quote_id::text);
  if idempotency_count < 3 then raise exception 'LEO-541 idempotency record assertion failed'; end if;

  perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
  other_response := public.runtime_order_get(order_id);
  if other_response is not null then raise exception 'LEO-541 cross-owner read unexpectedly succeeded'; end if;
  other_response := public.runtime_order_update(order_id, '{"status":"cancelled"}'::jsonb, 'leo541-cross-owner-1', 'ffffffff-ffff-4fff-8fff-ffffffffffff');
  if other_response is not null then raise exception 'LEO-541 cross-owner update unexpectedly succeeded'; end if;
  if public.runtime_quote_get(quote_id) is not null then raise exception 'LEO-541 cross-owner quote read unexpectedly succeeded'; end if;

  perform set_config('request.jwt.claims', jsonb_build_object('sub',v_owner_id::text,'role','authenticated')::text, true);
  if public.runtime_order_delete(order_id, 'leo541-order-delete-1', '99999999-9999-4999-8999-999999999999') is null then raise exception 'LEO-541 order delete assertion failed'; end if;
  if public.runtime_order_get(order_id) is not null then raise exception 'LEO-541 order delete visibility assertion failed'; end if;
  if public.runtime_quote_delete(quote_id, 'leo541-quote-delete-1', '88888888-8888-4888-8888-888888888888') is null then raise exception 'LEO-541 quote delete assertion failed'; end if;
  if public.runtime_quote_get(quote_id) is not null then raise exception 'LEO-541 quote delete visibility assertion failed'; end if;
  select count(*) into before_count from dpg_app.orders o where o.owner_id=v_owner_id;
  begin
    perform public.runtime_order_create(
      jsonb_build_object('customer_name','LEO-541 rollback fixture','customer_phone','0900000002',
        'items',jsonb_build_array(jsonb_build_object('productId',product_id,'quantity',0,'installOption','none'))),
      'leo541-rollback-1','11111111-2222-4333-8444-555555555555');
    raise exception 'LEO-541 invalid order unexpectedly succeeded';
  exception when others then null;
  end;
  select count(*) into after_count from dpg_app.orders o where o.owner_id=v_owner_id;
  if before_count <> after_count then raise exception 'LEO-541 transaction rollback assertion failed'; end if;
end
$$;

rollback;
