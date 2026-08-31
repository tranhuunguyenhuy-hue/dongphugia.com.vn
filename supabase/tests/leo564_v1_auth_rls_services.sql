-- LEO-564 Round 1 sanitized acceptance matrix.
--
-- Run only against a disposable/local database after applying LEO-561 and
-- LEO-564. All fixtures are synthetic and the transaction is rolled back.
-- This script emits no customer, Auth, token, or database-row payload.

begin;

create temporary table leo564_test_results (
  result_key text primary key,
  payload jsonb not null
) on commit drop;
grant select, insert on leo564_test_results to anon, authenticated;

-- The migration must force RLS on every canonical relation and expose no
-- writable canonical relation in the reviewed API schema.
do $$
declare
  table_name text;
  required_tables constant text[] := array[
    'staff_users', 'staff_user_roles', 'role_capabilities',
    'service_idempotency_records', 'media_assets', 'brands', 'categories',
    'product_families', 'product_family_configuration_groups', 'products',
    'product_family_memberships', 'product_source_provenance', 'collections',
    'collection_products', 'attribute_definitions', 'attribute_options',
    'category_attribute_policies', 'product_attribute_values',
    'product_attribute_multi_options', 'product_media', 'product_documents',
    'content_entries', 'content_blocks', 'content_product_references',
    'content_category_references', 'content_brand_references',
    'quote_requests', 'quote_request_lines', 'quotes', 'quote_lines',
    'quote_shares', 'orders', 'order_lines', 'payment_transactions',
    'commerce_idempotency_records'
  ];
begin
  foreach table_name in array required_tables loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'dpg_v1' and c.relname = table_name
        and c.relrowsecurity and c.relforcerowsecurity
    ) then
      raise exception 'LEO-564 canonical table is not forced through RLS: %', table_name;
    end if;
  end loop;
  if to_regclass('dpg_v1_api.orders') is not null
     or to_regclass('dpg_v1_api.quotes') is not null
     or to_regclass('dpg_v1_api.staff_users') is not null then
    raise exception 'LEO-564 API schema exposed a canonical relation';
  end if;
end
$$;

-- Synthetic staff identities cover the fixed roles, union semantics, invited
-- and disabled fail-closed states, and the last-active-Admin invariant.
insert into dpg_v1.staff_users (auth_user_id, email, display_name, status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'union@example.invalid', 'Union Staff', 'active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'product@example.invalid', 'Product Staff', 'active'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'marketing@example.invalid', 'Marketing Staff', 'active'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'admin@example.invalid', 'Admin Staff', 'active'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'invited@example.invalid', 'Invited Staff', 'invited'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'disabled@example.invalid', 'Disabled Staff', 'disabled');

insert into dpg_v1.staff_user_roles (auth_user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Product'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Sales'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Product'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Marketing'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Admin'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Product'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'Admin');

insert into dpg_v1.brands (id, name, slug) values
  ('52000000-0000-4000-8000-000000000001', 'LEO-564 Synthetic Brand', 'leo-564-synthetic-brand');

insert into dpg_v1.categories (id, parent_id, sector, name, slug, is_leaf, sort_order) values
  ('53000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004',
   'kitchen', 'LEO-564 Synthetic Category', 'leo-564-synthetic-category', true, 0);

insert into dpg_v1.products (
  id, sku, model, name, slug, brand_id, primary_category_id, retail_price,
  availability, status
) values (
  '55000000-0000-4000-8000-000000000001', 'LEO564-P1', 'LEO564-M1',
  'LEO-564 Synthetic Product', 'leo-564-synthetic-product',
  '52000000-0000-4000-8000-000000000001',
  '53000000-0000-4000-8000-000000000001', 125000, 'IN_STOCK', 'DRAFT'
);

insert into dpg_v1.product_source_provenance (
  id, product_id, source_kind, source_reference, quality, captured_at
) values (
  '56000000-0000-4000-8000-000000000001',
  '55000000-0000-4000-8000-000000000001',
  'catalogue', 'synthetic:leo564:product-1', 'verified', clock_timestamp()
);

insert into dpg_v1.media_assets (
  id, kind, original_object_key, delivery_object_key, profile_version, sha256,
  mime_type, byte_size, width_px, height_px, provenance, state
) values (
  '54000000-0000-4000-8000-000000000001', 'IMAGE',
  'private/leo564/original.webp', 'public/leo564/product-v1.webp', 'product-v1',
  repeat('d', 64), 'image/webp', 1024, 1200, 1200, 'synthetic', 'READY'
);

-- Multi-role union and least-privilege checks.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
do $$
declare context jsonb;
begin
  select dpg_v1_api.staff_context() into context;
  if context->>'status' <> 'active'
     or not ((context->'roles') ? 'Product')
     or not ((context->'roles') ? 'Sales')
     or not ((context->'capabilities') ? 'catalogue.publish')
     or not ((context->'capabilities') ? 'sales.quote.create')
     or not ((context->'capabilities') ? 'sales.order.payment.update') then
    raise exception 'LEO-564 multi-role union assertion failed';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
do $$
begin
  if not dpg_v1_api.staff_can('catalogue.publish')
     or dpg_v1_api.staff_can('sales.quote.create')
     or dpg_v1_api.staff_can('not-a-v1-capability') then
    raise exception 'LEO-564 Product least-privilege assertion failed';
  end if;
  begin
    perform dpg_v1_api.sales_order_list();
    raise exception 'LEO-564 Product sales read unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
  end;
end
$$;

select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);
do $$
begin
  if not dpg_v1_api.staff_can('marketing.content.publish')
     or dpg_v1_api.staff_can('catalogue.publish') then
    raise exception 'LEO-564 Marketing least-privilege assertion failed';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', true);
do $$
declare context jsonb;
begin
  select dpg_v1_api.staff_context() into context;
  if context <> '{}'::jsonb or dpg_v1_api.staff_can('catalogue.read') then
    raise exception 'LEO-564 invited identity did not fail closed';
  end if;
  if exists (select 1 from dpg_v1.staff_users where auth_user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee')
     or exists (select 1 from dpg_v1.staff_user_roles where auth_user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee') then
    raise exception 'LEO-564 invited identity retained direct RLS visibility';
  end if;
end
$$;

select set_config('request.jwt.claim.sub', 'ffffffff-ffff-4fff-8fff-ffffffffffff', true);
do $$
declare context jsonb;
begin
  select dpg_v1_api.staff_context() into context;
  if context <> '{}'::jsonb or dpg_v1_api.staff_can('admin.staff.read') then
    raise exception 'LEO-564 disabled identity did not fail closed';
  end if;
  if exists (select 1 from dpg_v1.staff_users where auth_user_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff')
     or exists (select 1 from dpg_v1.staff_user_roles where auth_user_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff') then
    raise exception 'LEO-564 disabled identity retained direct RLS visibility';
  end if;
end
$$;

-- Product publication is a readiness-checked, optimistic, idempotent service.
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
do $$
begin
  begin
    perform dpg_v1_api.catalogue_product_publish(
      '55000000-0000-4000-8000-000000000001', 1, 'leo564-product-publish-fail'
    );
    raise exception 'LEO-564 incomplete Product publication unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'PRODUCT_NOT_PUBLISHABLE' then raise; end if;
  end;
  if (select status from dpg_v1.products where id = '55000000-0000-4000-8000-000000000001') <> 'DRAFT'
     or (select version from dpg_v1.products where id = '55000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'LEO-564 Product publication rollback assertion failed';
  end if;
end
$$;

reset role;
insert into dpg_v1.product_media (
  product_id, media_asset_id, role, sort_order, alt_text
) values (
  '55000000-0000-4000-8000-000000000001',
  '54000000-0000-4000-8000-000000000001', 'PRIMARY', 0, 'Synthetic primary'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
insert into leo564_test_results (result_key, payload)
values ('product-publish', dpg_v1_api.catalogue_product_publish(
  '55000000-0000-4000-8000-000000000001', 1, 'leo564-product-publish-ok'
));
do $$
begin
  if (select payload->>'status' from leo564_test_results where result_key = 'product-publish') <> 'PUBLISHED'
     or (select (payload->>'version')::integer from leo564_test_results where result_key = 'product-publish') <> 2 then
    raise exception 'LEO-564 Product publication success assertion failed';
  end if;
  begin
    perform dpg_v1_api.catalogue_product_publish(
      '55000000-0000-4000-8000-000000000001', 1, 'leo564-product-publish-stale'
    );
    raise exception 'LEO-564 stale Product publication unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'STALE_PRODUCT_VERSION' then raise; end if;
  end;
end
$$;

-- Public catalogue projection is visible after publication and does not
-- expose a draft Product through the API view.
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
declare public_product jsonb;
begin
  select dpg_v1_api.public_product_get('55000000-0000-4000-8000-000000000001') into public_product;
  if public_product->>'name' <> 'LEO-564 Synthetic Product'
     or public_product ? 'private_note' then
    raise exception 'LEO-564 public Product projection assertion failed';
  end if;
end
$$;

-- Guest Order intake ignores forged commercial facts, snapshots canonical
-- Product facts atomically, and replays the same safe receipt byte-for-byte.
insert into leo564_test_results (result_key, payload)
values ('guest-order', dpg_v1_api.order_intake_create(
  jsonb_build_object(
    'customer', jsonb_build_object('name', 'Synthetic Guest', 'phone', '0900000001', 'email', 'guest@example.invalid'),
    'shipping', jsonb_build_object('address', 'Synthetic address'),
    'payment_method', 'COD',
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', '55000000-0000-4000-8000-000000000001',
      'quantity', 2, 'unit_price', 1, 'name', 'Forged Product', 'line_total', 1
    ))
  ), 'leo564-guest-order-1'
));
insert into leo564_test_results (result_key, payload)
values ('guest-order-replay', dpg_v1_api.order_intake_create(
  jsonb_build_object(
    'customer', jsonb_build_object('name', 'Synthetic Guest', 'phone', '0900000001', 'email', 'guest@example.invalid'),
    'shipping', jsonb_build_object('address', 'Synthetic address'),
    'payment_method', 'COD',
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', '55000000-0000-4000-8000-000000000001',
      'quantity', 2, 'unit_price', 1, 'name', 'Forged Product', 'line_total', 1
    ))
  ), 'leo564-guest-order-1'
));
do $$
begin
  if (select payload from leo564_test_results where result_key = 'guest-order') <>
     (select payload from leo564_test_results where result_key = 'guest-order-replay') then
    raise exception 'LEO-564 guest Order replay assertion failed';
  end if;
  if (select (payload->>'total')::numeric from leo564_test_results where result_key = 'guest-order') <> 250000 then
    raise exception 'LEO-564 forged commercial total was accepted';
  end if;
  begin
    perform dpg_v1_api.order_intake_create(
      jsonb_build_object(
        'customer', jsonb_build_object('name', 'Different Guest', 'phone', '0900000002'),
        'shipping', jsonb_build_object('address', 'Different address'),
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', '55000000-0000-4000-8000-000000000001', 'quantity', 1
        ))
      ), 'leo564-guest-order-1'
    );
    raise exception 'LEO-564 reused guest Order key unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'IDEMPOTENCY_KEY_REUSED' then raise; end if;
  end;
end
$$;

reset role;
do $$
declare v_order_id uuid;
begin
  select (payload->>'order_id')::uuid into v_order_id
  from leo564_test_results where result_key = 'guest-order';
  if (select ol.product_name_snapshot from dpg_v1.order_lines ol where ol.order_id = v_order_id) <> 'LEO-564 Synthetic Product'
     or (select ol.unit_price from dpg_v1.order_lines ol where ol.order_id = v_order_id) <> 125000
     or (select ol.line_total from dpg_v1.order_lines ol where ol.order_id = v_order_id) <> 250000 then
    raise exception 'LEO-564 Order commercial snapshot assertion failed';
  end if;
end
$$;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

-- Invalid guest intake rolls back its idempotency reservation and all rows.
do $$
begin
  begin
    perform dpg_v1_api.order_intake_create(
      jsonb_build_object(
        'customer', jsonb_build_object('name', 'Invalid Guest', 'phone', '0900000003'),
        'shipping', jsonb_build_object('address', 'Invalid address'),
        'items', jsonb_build_array(jsonb_build_object(
          'product_id', '55000000-0000-4000-8000-000000000001', 'quantity', 0
        ))
      ), 'leo564-guest-order-invalid'
    );
    raise exception 'LEO-564 invalid guest Order unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'INVALID_ORDER_LINE' then raise; end if;
  end;
  if exists (
    select 1 from dpg_v1.service_idempotency_records
    where scope_key = 'guest' and operation = 'order_intake.create'
      and key_hash = dpg_v1.sha256_text('leo564-guest-order-invalid')
  ) then
    raise exception 'LEO-564 invalid guest Order left a reservation';
  end if;
end
$$;

-- Guest Quote Request intake preserves the submitted request and Product
-- snapshot, while the API schema exposes no list/search/table path to anon.
insert into leo564_test_results (result_key, payload)
values ('guest-quote-request', dpg_v1_api.quote_request_intake_create(
  jsonb_build_object(
    'customer', jsonb_build_object('name', 'Synthetic Quote Guest', 'phone', '0900000004'),
    'project_context', 'Synthetic project',
    'customer_note', 'Synthetic note',
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', '55000000-0000-4000-8000-000000000001', 'quantity', 2,
      'retail_price_snapshot', 1, 'product_name_snapshot', 'Forged Product'
    ))
  ), 'leo564-guest-quote-request-1'
));
do $$
declare
  direct_rows_visible boolean := false;
begin
  begin
    select exists (select 1 from dpg_v1.quote_requests)
       or exists (select 1 from dpg_v1.orders)
       or exists (select 1 from dpg_v1.quote_request_lines)
       or exists (select 1 from dpg_v1.order_lines)
      into direct_rows_visible;
  exception when insufficient_privilege then
    direct_rows_visible := false;
  end;
  if direct_rows_visible then
    raise exception 'LEO-564 guest isolation exposed another intake';
  end if;
  begin
    perform dpg_v1_api.sales_quote_request_list();
    raise exception 'LEO-564 guest staff query unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
    when others then
    if sqlerrm <> 'FORBIDDEN' then raise; end if;
  end;
end
$$;
do $$
begin
  if to_regclass('dpg_v1_api.quote_requests') is not null
     or to_regclass('dpg_v1_api.orders') is not null then
    raise exception 'LEO-564 guest API exposed a private relation';
  end if;
end
$$;

-- Marketing publication also fails closed and rolls back until its typed
-- block is present; then the public projection becomes visible.
reset role;
do $$
declare v_request_id uuid;
begin
  select (payload->>'quote_request_id')::uuid into v_request_id
  from leo564_test_results where result_key = 'guest-quote-request';
  if (select qrl.product_name_snapshot from dpg_v1.quote_request_lines qrl where qrl.quote_request_id = v_request_id) <> 'LEO-564 Synthetic Product'
     or (select qrl.retail_price_snapshot from dpg_v1.quote_request_lines qrl where qrl.quote_request_id = v_request_id) <> 125000 then
    raise exception 'LEO-564 Quote Request snapshot assertion failed';
  end if;
end
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);
insert into leo564_test_results (result_key, payload)
values ('content-create', dpg_v1_api.marketing_content_create(
  jsonb_build_object('type', 'GUIDE', 'title', 'LEO-564 Synthetic Guide', 'slug', 'leo-564-synthetic-guide'),
  'leo564-content-create-1'
));
do $$
declare content_id uuid;
begin
  select (payload->>'content_entry_id')::uuid into content_id
  from leo564_test_results where result_key = 'content-create';
  begin
    perform dpg_v1_api.marketing_content_publish(content_id, 1, 'leo564-content-publish-fail');
    raise exception 'LEO-564 incomplete Content publication unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'CONTENT_NOT_PUBLISHABLE' then raise; end if;
  end;
  if (select status from dpg_v1.content_entries where id = content_id) <> 'DRAFT'
     or (select version from dpg_v1.content_entries where id = content_id) <> 1 then
    raise exception 'LEO-564 Content publication rollback assertion failed';
  end if;
  perform dpg_v1_api.marketing_content_update(
    content_id, 1,
    jsonb_build_object('blocks', jsonb_build_array(jsonb_build_object(
      'block_type', 'RICH_TEXT', 'payload', jsonb_build_object('html', '<p>Synthetic</p>')
    ))),
    'leo564-content-update-1'
  );
  if (dpg_v1_api.marketing_content_publish(content_id, 2, 'leo564-content-publish-ok')->>'status') <> 'PUBLISHED' then
    raise exception 'LEO-564 Content publication success assertion failed';
  end if;
end
$$;

-- Marketing Collection publication depends on the already-published Product.
insert into leo564_test_results (result_key, payload)
values ('collection-create', dpg_v1_api.marketing_collection_create(
  jsonb_build_object(
    'title', 'LEO-564 Synthetic Collection', 'slug', 'leo-564-synthetic-collection',
    'product_ids', jsonb_build_array('55000000-0000-4000-8000-000000000001')
  ), 'leo564-collection-create-1'
));
do $$
declare collection_id uuid;
begin
  select (payload->>'collection_id')::uuid into collection_id
  from leo564_test_results where result_key = 'collection-create';
  if (dpg_v1_api.marketing_collection_publish(collection_id, 1, 'leo564-collection-publish-ok')->>'status') <> 'PUBLISHED' then
    raise exception 'LEO-564 Collection publication assertion failed';
  end if;
end
$$;

-- Sales Quote creation/negotation/share uses submitted snapshots, generates a
-- high-entropy share token, and returns only the customer-safe share view.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
insert into leo564_test_results (result_key, payload)
values ('quote-create', dpg_v1_api.sales_quote_create(
  jsonb_build_object(
    'quote_request_id', (select payload->>'quote_request_id' from leo564_test_results where result_key = 'guest-quote-request'),
    'shipping_fee', 5000, 'private_note', 'staff-only synthetic note'
  ), 'leo564-quote-create-1'
));
do $$
declare quote_id uuid; updated jsonb; published jsonb;
begin
  select (payload->>'quote_id')::uuid into quote_id
  from leo564_test_results where result_key = 'quote-create';
  updated := dpg_v1_api.sales_quote_update(
    quote_id, 1,
    jsonb_build_object(
      'shipping_fee', 7500,
      'lines', jsonb_build_array(jsonb_build_object(
        'product_id', '55000000-0000-4000-8000-000000000001',
        'quantity', 2, 'unit_price', 130000, 'line_discount', 10000,
        'public_note', 'Synthetic public note', 'private_note', 'Synthetic private line note'
      ))
    ),
    'leo564-quote-update-1'
  );
  if updated->>'status' <> 'DRAFT' or (updated->>'version')::integer <> 2
     or (updated->>'total')::numeric <> 257500 then
    raise exception 'LEO-564 negotiated Quote assertion failed';
  end if;
  published := dpg_v1_api.sales_quote_publish(quote_id, 2, 'leo564-quote-publish-1');
  if published->>'status' <> 'ISSUED'
     or length(published->>'share_token') <> 64
     or published->>'share_token' !~ '^[0-9a-f]{64}$' then
    raise exception 'LEO-564 Quote share token assertion failed';
  end if;
  insert into leo564_test_results (result_key, payload)
  values ('quote-publish', published);
end
$$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
do $$
declare public_quote jsonb; share_token text;
begin
  select payload->>'share_token' into share_token
  from leo564_test_results where result_key = 'quote-publish';
  public_quote := dpg_v1_api.shareable_quote_read(share_token);
  if public_quote->>'status' <> 'ISSUED'
     or public_quote ? 'private_note'
     or public_quote ? 'quote_id'
     or public_quote->'lines'->0 ? 'product_id'
     or public_quote->'lines'->0 ? 'private_note' then
    raise exception 'LEO-564 Shareable Quote projection leaked private data';
  end if;
  begin
    perform dpg_v1_api.shareable_quote_read('deadbeefdeadbeefdeadbeefdeadbeef');
    raise exception 'LEO-564 invalid Quote share unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'QUOTE_SHARE_NOT_FOUND' then raise; end if;
  end;
end
$$;

-- Sales order lifecycle/payment projection and immutable transaction facts.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
do $$
declare v_order_id uuid; before_updated_at timestamptz; payment jsonb;
begin
  select (payload->>'order_id')::uuid into v_order_id
  from leo564_test_results where result_key = 'guest-order';
  select updated_at into before_updated_at from dpg_v1.orders where id = v_order_id;
  if (dpg_v1_api.sales_order_lifecycle_update(
    v_order_id, 'CONTACTED', before_updated_at, 'leo564-order-contacted-1'
  )->>'status') <> 'CONTACTED' then
    raise exception 'LEO-564 Order lifecycle assertion failed';
  end if;
  payment := dpg_v1_api.sales_order_payment_update(
    v_order_id, 'PAYMENT', 100000, 'LEO564-PAYMENT-1', clock_timestamp(), 'leo564-order-payment-1'
  );
  if payment->>'payment_status' <> 'PARTIALLY_PAID'
     or (payment->>'paid_amount')::numeric <> 100000 then
    raise exception 'LEO-564 payment projection assertion failed';
  end if;
  begin
    delete from dpg_v1.payment_transactions pt where pt.order_id = v_order_id;
    raise exception 'LEO-564 immutable payment transaction unexpectedly deleted';
  exception
    when insufficient_privilege then null;
    when others then
    if sqlerrm <> 'IMMUTABLE_COMMERCIAL_SNAPSHOT' then raise; end if;
  end;
end
$$;

-- Share revocation is fail-closed before Quote conversion.
do $$
declare quote_id uuid; share_token text;
begin
  select (payload->>'quote_id')::uuid, payload->>'share_token'
    into quote_id, share_token
  from leo564_test_results where result_key = 'quote-publish';
  perform dpg_v1_api.sales_quote_revoke_share(quote_id, 'leo564-quote-revoke-share-1');
  reset role;
  set local role anon;
  if dpg_v1_api.shareable_quote_read(share_token) is not null then
    raise exception 'LEO-564 revoked Quote share unexpectedly returned data';
  end if;
exception when others then
  if sqlerrm = 'QUOTE_SHARE_NOT_FOUND' then
    null;
  else
    raise;
  end if;
end
$$;

-- The nested role switch above ends the anonymous check; return to the
-- authenticated union context for atomic Quote -> Order conversion and
-- replay. (The quote itself remains convertible after share revocation.)
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
do $$
declare v_quote_id uuid; converted jsonb; replay jsonb; v_order_id uuid;
begin
  select (payload->>'quote_id')::uuid into v_quote_id
  from leo564_test_results where result_key = 'quote-publish';
  converted := dpg_v1_api.sales_quote_convert(v_quote_id, 3, 'leo564-quote-convert-1');
  replay := dpg_v1_api.sales_quote_convert(v_quote_id, 3, 'leo564-quote-convert-1');
  if converted <> replay or converted->>'status' <> 'CONVERTED' then
    raise exception 'LEO-564 Quote conversion replay assertion failed';
  end if;
  v_order_id := (converted->>'order_id')::uuid;
  if (select o.source from dpg_v1.orders o where o.id = v_order_id) <> 'QUOTE'
     or (select count(*) from dpg_v1.order_lines ol where ol.order_id = v_order_id) <> 1
     or (select o.total from dpg_v1.orders o where o.id = v_order_id) <> 257500 then
    raise exception 'LEO-564 Quote conversion snapshot assertion failed';
  end if;
end
$$;

-- Admin staff operation boundary and last-active-Admin protection.
select set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', true);
do $$
begin
  if jsonb_array_length(dpg_v1_api.staff_user_list()) < 6 then
    raise exception 'LEO-564 staff list assertion failed';
  end if;
  if (dpg_v1_api.staff_user_provision(
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'invited@example.invalid',
    'Reconciled Invited Staff', array['Product']::dpg_v1.staff_role[], 'leo564-staff-provision-1'
  )->>'status') <> 'invited' then
    raise exception 'LEO-564 invited staff provision assertion failed';
  end if;
  if (dpg_v1_api.staff_user_assign_roles(
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    array['Sales', 'Marketing']::dpg_v1.staff_role[], 'leo564-staff-roles-1'
  )->>'status') <> 'invited' then
    raise exception 'LEO-564 invited staff role assignment assertion failed';
  end if;
  if (dpg_v1_api.staff_user_disable(
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'leo564-staff-disable-1'
  )->>'status') <> 'disabled' then
    raise exception 'LEO-564 staff disable assertion failed';
  end if;
  begin
    perform dpg_v1_api.staff_user_disable(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'leo564-last-admin-disable-1'
    );
    raise exception 'LEO-564 last active Admin disable unexpectedly succeeded';
  exception when others then
    if sqlerrm <> 'LAST_ACTIVE_ADMIN' then raise; end if;
  end;
end
$$;

reset role;
select jsonb_build_object('leo564_v1_auth_rls_services', 'PASS') as sanitized_acceptance;
rollback;
