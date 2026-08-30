\set ON_ERROR_STOP on
begin;

-- All fixtures are synthetic and are rolled back at the end of this script.
insert into dpg_v1.categories (id, parent_id, sector, name, slug, is_leaf, sort_order) values
  ('11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'sanitary', 'Bồn cầu', 'bon-cau', false, 0),
  ('11000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000001', 'sanitary', 'Bồn cầu liền khối', 'bon-cau-lien-khoi', true, 0),
  ('11000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', 'kitchen', 'Chậu rửa bếp', 'chau-rua-bep', true, 0);

insert into dpg_v1.brands (id, name, slug) values
  ('12000000-0000-4000-8000-000000000001', 'LEO-561 Synthetic Brand', 'leo-561-synthetic-brand');

insert into dpg_v1.media_assets (
  id, kind, original_object_key, delivery_object_key, profile_version, sha256,
  mime_type, byte_size, width_px, height_px, provenance, state
) values
  ('13000000-0000-4000-8000-000000000001', 'IMAGE', 'private/aa/original.webp', 'public/aa/primary-v1.webp', 'product-v1', repeat('a', 64), 'image/webp', 1000, 1000, 1000, 'synthetic', 'READY'),
  ('13000000-0000-4000-8000-000000000002', 'IMAGE', 'private/bb/original.webp', 'public/bb/gallery-v1.webp', 'product-v1', repeat('b', 64), 'image/webp', 900, 900, 900, 'synthetic', 'READY'),
  ('13000000-0000-4000-8000-000000000003', 'DOCUMENT', 'private/cc/manual.pdf', 'public/cc/manual.pdf', null, repeat('c', 64), 'application/pdf', 2000, null, null, 'synthetic', 'READY');

-- A canonical Product is independent; Family membership is optional.
insert into dpg_v1.products (
  id, sku, model, name, slug, brand_id, primary_category_id, retail_price, availability
) values
  ('14000000-0000-4000-8000-000000000001', 'LEO561-P1', 'LEO561-M1', 'Synthetic Product One', 'synthetic-product-one',
   '12000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 1000000, 'IN_STOCK'),
  ('14000000-0000-4000-8000-000000000002', 'LEO561-P2', 'LEO561-M2', 'Synthetic Product Two', 'synthetic-product-two',
   '12000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 1200000, 'PREORDER'),
  ('14000000-0000-4000-8000-000000000003', 'LEO561-P3', 'LEO561-M3', 'Synthetic Product Three', 'synthetic-product-three',
   '12000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000003', 800000, 'CONTACT');

do $$
begin
  begin
    insert into dpg_v1.products (sku, model, name, slug, brand_id, primary_category_id, retail_price)
    values ('LEO561-BAD-CAT', 'LEO561-BAD-CAT', 'Bad category', 'bad-category',
      '12000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 1);
    raise exception 'non-leaf Product category unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'non-leaf Product category unexpectedly succeeded' then raise; end if;
  end;
end
$$;

insert into dpg_v1.product_families (id, family_key, name)
values ('15000000-0000-4000-8000-000000000001', 'synthetic:family', 'Synthetic Family');
insert into dpg_v1.product_family_configuration_groups (id, family_id, group_key, label, sort_order)
values ('15000000-0000-4000-8000-000000000002', '15000000-0000-4000-8000-000000000001', 'standard', 'Standard', 0);
insert into dpg_v1.product_family_memberships (family_id, product_id, configuration_group_id, sort_order) values
  ('15000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', '15000000-0000-4000-8000-000000000002', 0),
  ('15000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', '15000000-0000-4000-8000-000000000002', 1);

do $$
begin
  if not (select eligible and product_count = 2 from dpg_v1.product_family_navigation_eligibility where family_id = '15000000-0000-4000-8000-000000000001') then
    raise exception 'Family two-real-Product navigation contract failed';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'dpg_v1' and table_name = 'product_families'
      and column_name in ('price', 'retail_price', 'availability', 'slug', 'publication_status')
  ) then raise exception 'Family became commerce or PDP authority'; end if;
end
$$;

insert into dpg_v1.collections (id, title, slug) values
  ('16000000-0000-4000-8000-000000000001', 'Synthetic Collection', 'synthetic-collection');
insert into dpg_v1.collection_products (collection_id, product_id, sort_order) values
  ('16000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000002', 0),
  ('16000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', 1);

do $$
begin
  if (select string_agg(p.sku, ',' order by cp.sort_order)
      from dpg_v1.collection_products cp join dpg_v1.products p on p.id = cp.product_id
      where cp.collection_id = '16000000-0000-4000-8000-000000000001') <> 'LEO561-P2,LEO561-P1'
  then raise exception 'ordered Collection contract failed'; end if;
  begin
    insert into dpg_v1.collection_products (collection_id, product_id, sort_order)
    values ('16000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000003', 1);
    raise exception 'duplicate Collection order unexpectedly succeeded';
  exception when unique_violation then null;
  end;
end
$$;

insert into dpg_v1.attribute_definitions (
  id, attribute_key, label, value_type, canonical_unit, canonical_dimension, number_min, number_max
) values
  ('17000000-0000-4000-8000-000000000001', 'width_mm', 'Width', 'number', 'mm', 'length', 1, 5000),
  ('17000000-0000-4000-8000-000000000002', 'finish', 'Finish', 'enum', null, null, null, null),
  ('17000000-0000-4000-8000-000000000003', 'application', 'Application', 'multi_enum', null, null, null, null);
insert into dpg_v1.attribute_options (id, attribute_definition_id, option_key, label, sort_order) values
  ('17100000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-000000000002', 'white', 'White', 0),
  ('17100000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000003', 'floor', 'Floor', 0),
  ('17100000-0000-4000-8000-000000000003', '17000000-0000-4000-8000-000000000003', 'wall', 'Wall', 1);
insert into dpg_v1.category_attribute_policies (
  category_id, attribute_definition_id, pdp_sort_order, filterable, filter_sort_order, requirement_tier
) values
  ('11000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000001', 0, true, 0, 'deep'),
  ('11000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000002', 1, true, 1, 'none'),
  ('11000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000003', 2, true, 2, 'none');
insert into dpg_v1.product_attribute_values (
  id, product_id, attribute_definition_id, number_value, quality
) values ('17200000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-000000000001', 700, 'official');
insert into dpg_v1.product_attribute_values (
  id, product_id, attribute_definition_id, option_id, quality
) values ('17200000-0000-4000-8000-000000000002', '14000000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-000000000002', '17100000-0000-4000-8000-000000000001', 'verified');
insert into dpg_v1.product_attribute_values (
  id, product_id, attribute_definition_id, quality
) values ('17200000-0000-4000-8000-000000000003', '14000000-0000-4000-8000-000000000001', '17000000-0000-4000-8000-000000000003', 'verified');
insert into dpg_v1.product_attribute_multi_options (product_attribute_value_id, attribute_definition_id, option_id, sort_order) values
  ('17200000-0000-4000-8000-000000000003', '17000000-0000-4000-8000-000000000003', '17100000-0000-4000-8000-000000000002', 0),
  ('17200000-0000-4000-8000-000000000003', '17000000-0000-4000-8000-000000000003', '17100000-0000-4000-8000-000000000003', 1);

do $$
begin
  begin
    insert into dpg_v1.product_attribute_values (product_id, attribute_definition_id, text_value, quality)
    values ('14000000-0000-4000-8000-000000000002', '17000000-0000-4000-8000-000000000001', 'not-a-number', 'legacy');
    raise exception 'wrong typed value unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'wrong typed value unexpectedly succeeded' then raise; end if;
  end;
  begin
    insert into dpg_v1.product_attribute_values (product_id, attribute_definition_id, number_value, quality)
    values ('14000000-0000-4000-8000-000000000003', '17000000-0000-4000-8000-000000000001', 500, 'legacy');
    raise exception 'cross-category attribute unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'cross-category attribute unexpectedly succeeded' then raise; end if;
  end;
end
$$;

insert into dpg_v1.product_media (product_id, media_asset_id, role, sort_order, alt_text) values
  ('14000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000001', 'PRIMARY', 0, 'Synthetic primary'),
  ('14000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000002', 'GALLERY', 0, 'Synthetic gallery');
insert into dpg_v1.product_documents (product_id, media_asset_id, document_type, title, sort_order)
values ('14000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000003', 'TECHNICAL_SHEET', 'Synthetic technical sheet', 0);
insert into dpg_v1.product_source_provenance (product_id, source_kind, source_reference, quality, captured_at)
values ('14000000-0000-4000-8000-000000000001', 'manufacturer', 'synthetic:manufacturer:p1', 'official', clock_timestamp());

do $$
begin
  begin
    insert into dpg_v1.product_media (product_id, media_asset_id, role, sort_order, alt_text)
    values ('14000000-0000-4000-8000-000000000001', '13000000-0000-4000-8000-000000000002', 'PRIMARY', 0, 'Duplicate');
    raise exception 'duplicate primary image unexpectedly succeeded';
  exception when unique_violation then null;
  end;
  if exists (
    select 1 from dpg_v1.product_media pm join dpg_v1.media_assets ma on ma.id = pm.media_asset_id
    where ma.kind <> 'IMAGE'
  ) then raise exception 'document entered image gallery'; end if;
  if exists (
    select 1 from dpg_v1.product_documents pd join dpg_v1.media_assets ma on ma.id = pd.media_asset_id
    where ma.kind <> 'DOCUMENT'
  ) then raise exception 'image entered technical documents'; end if;
end
$$;

-- Publication fails closed until price, primary image, provenance, active leaf,
-- and required typed attributes are all present.
update dpg_v1.products set status = 'PUBLISHED', published_at = clock_timestamp(), version = version + 1
where id = '14000000-0000-4000-8000-000000000001';

do $$
begin
  if not (select eligible from dpg_v1.product_publication_eligibility where product_id = '14000000-0000-4000-8000-000000000001') then
    raise exception 'Product publication eligibility failed';
  end if;
  begin
    insert into dpg_v1.products (
      id, sku, model, name, slug, brand_id, primary_category_id, retail_price,
      availability, status, published_at
    ) values (
      '14000000-0000-4000-8000-000000000004', 'LEO561-NOPRICE', 'LEO561-NOPRICE',
      'No price Product', 'no-price-product', '12000000-0000-4000-8000-000000000001',
      '11000000-0000-4000-8000-000000000002', null, 'IN_STOCK', 'PUBLISHED', clock_timestamp()
    );
    raise exception 'published Product without price unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'published Product without price unexpectedly succeeded' then raise; end if;
  end;
end
$$;

insert into dpg_v1.content_entries (id, type, title, slug)
values ('18000000-0000-4000-8000-000000000001', 'BUYING_GUIDE', 'Synthetic Buying Guide', 'synthetic-buying-guide');
insert into dpg_v1.content_blocks (id, content_entry_id, block_type, payload, sort_order)
values ('18100000-0000-4000-8000-000000000001', '18000000-0000-4000-8000-000000000001', 'RICH_TEXT', '{"html":"<p>Synthetic</p>"}', 0);
insert into dpg_v1.content_blocks (id, content_entry_id, block_type, media_asset_id, payload, sort_order)
values ('18100000-0000-4000-8000-000000000002', '18000000-0000-4000-8000-000000000001', 'MEDIA', '13000000-0000-4000-8000-000000000002', '{"caption":"Synthetic media"}', 1);
insert into dpg_v1.content_product_references (content_entry_id, product_id, block_id, role, sort_order)
values ('18000000-0000-4000-8000-000000000001', '14000000-0000-4000-8000-000000000001', '18100000-0000-4000-8000-000000000001', 'featured', 0);
insert into dpg_v1.content_category_references (content_entry_id, category_id, role, sort_order)
values ('18000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002', 'related', 0);
insert into dpg_v1.content_brand_references (content_entry_id, brand_id, role, sort_order)
values ('18000000-0000-4000-8000-000000000001', '12000000-0000-4000-8000-000000000001', 'related', 0);

insert into dpg_v1.orders (
  id, order_number, source, status, payment_method, customer_name_snapshot,
  customer_phone_snapshot, subtotal, total
) values (
  '19000000-0000-4000-8000-000000000001', 'O-LEO561RETAIL', 'RETAIL', 'NEW', 'COD',
  'Synthetic Customer', '0900000000', 1500000, 1500000
);
insert into dpg_v1.order_lines (
  id, order_id, product_id, sort_order, product_sku_snapshot, product_model_snapshot,
  product_name_snapshot, brand_name_snapshot, primary_category_name_snapshot,
  availability_snapshot, quantity, unit_price, snapshot_at
) values (
  '19100000-0000-4000-8000-000000000001', '19000000-0000-4000-8000-000000000001',
  '14000000-0000-4000-8000-000000000001', 0, 'LEO561-P1', 'LEO561-M1',
  'Synthetic Product One', 'LEO-561 Synthetic Brand', 'Bồn cầu liền khối',
  'IN_STOCK', 1, 1000000, clock_timestamp()
);
insert into dpg_v1.products (
  id, sku, model, name, slug, brand_id, primary_category_id, retail_price
) values (
  '14000000-0000-4000-8000-000000000005', 'LEO561-NAV', 'LEO561-NAV',
  'Navigation-only Product', 'navigation-only-product',
  '12000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000003', 500000
);
insert into dpg_v1.order_lines (
  id, order_id, product_id, sort_order, product_sku_snapshot, product_model_snapshot,
  product_name_snapshot, brand_name_snapshot, primary_category_name_snapshot,
  availability_snapshot, quantity, unit_price, snapshot_at
) values (
  '19100000-0000-4000-8000-000000000002', '19000000-0000-4000-8000-000000000001',
  '14000000-0000-4000-8000-000000000005', 1, 'LEO561-NAV', 'LEO561-NAV',
  'Navigation-only Product', 'LEO-561 Synthetic Brand', 'Chậu rửa bếp',
  'CONTACT', 1, 500000, clock_timestamp()
);
delete from dpg_v1.products where id = '14000000-0000-4000-8000-000000000005';
update dpg_v1.products set name = 'Synthetic Product One Renamed', retail_price = 1500000,
  version = version + 1, updated_at = clock_timestamp()
where id = '14000000-0000-4000-8000-000000000001';

do $$
begin
  if not exists (
    select 1 from dpg_v1.order_lines
    where id = '19100000-0000-4000-8000-000000000001'
      and product_name_snapshot = 'Synthetic Product One' and unit_price = 1000000
  ) then raise exception 'Order snapshot changed with Product'; end if;
  if not exists (
    select 1 from dpg_v1.order_lines
    where id = '19100000-0000-4000-8000-000000000002'
      and product_id is null and product_name_snapshot = 'Navigation-only Product'
  ) then raise exception 'nullable Product navigation link did not preserve Order snapshot'; end if;
  begin
    update dpg_v1.order_lines set product_name_snapshot = 'Rewritten' where id = '19100000-0000-4000-8000-000000000001';
    raise exception 'Order snapshot rewrite unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'Order snapshot rewrite unexpectedly succeeded' then raise; end if;
  end;
  begin
    update dpg_v1.orders set total = total + 1 where id = '19000000-0000-4000-8000-000000000001';
    raise exception 'Order commercial header rewrite unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'Order commercial header rewrite unexpectedly succeeded' then raise; end if;
  end;
  begin
    update dpg_v1.orders set payment_status = 'PAID' where id = '19000000-0000-4000-8000-000000000001';
    raise exception 'direct payment projection rewrite unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'direct payment projection rewrite unexpectedly succeeded' then raise; end if;
  end;
end
$$;

insert into dpg_v1.quote_requests (
  id, request_number, customer_name, customer_phone, customer_email, project_context, customer_note
) values (
  '20000000-0000-4000-8000-000000000001', 'QR-LEO561-1', 'Synthetic Customer', '0900000000',
  'synthetic@example.invalid', 'Synthetic Project', 'Submitted note'
);
insert into dpg_v1.quote_request_lines (
  id, quote_request_id, product_id, sort_order, product_sku_snapshot, product_model_snapshot,
  product_name_snapshot, brand_name_snapshot, primary_category_name_snapshot,
  retail_price_snapshot, availability_snapshot, requested_quantity, snapshot_at
) values (
  '20100000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
  '14000000-0000-4000-8000-000000000001', 0, 'LEO561-P1', 'LEO561-M1',
  'Synthetic Product One Renamed', 'LEO-561 Synthetic Brand', 'Bồn cầu liền khối',
  1500000, 'IN_STOCK', 2, clock_timestamp()
);
insert into dpg_v1.quotes (
  id, quote_number, quote_request_id, status, version, customer_name_snapshot,
  customer_phone_snapshot, customer_email_snapshot, project_context_snapshot,
  subtotal, total, issued_at, expires_at
) values (
  '21000000-0000-4000-8000-000000000001', 'Q-LEO561-1', '20000000-0000-4000-8000-000000000001',
  'ISSUED', 3, 'Synthetic Customer', '0900000000', 'synthetic@example.invalid',
  'Synthetic Project', 2800000, 2800000, clock_timestamp(), clock_timestamp() + interval '7 days'
);
insert into dpg_v1.quote_lines (
  id, quote_id, product_id, sort_order, product_sku_snapshot, product_model_snapshot,
  product_name_snapshot, brand_name_snapshot, primary_category_name_snapshot,
  availability_snapshot, quantity, unit_price, line_discount, public_note, private_note, snapshot_at
) values (
  '21100000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001',
  '14000000-0000-4000-8000-000000000001', 0, 'LEO561-P1', 'LEO561-M1',
  'Synthetic Product One Renamed', 'LEO-561 Synthetic Brand', 'Bồn cầu liền khối',
  'IN_STOCK', 2, 1500000, 200000, 'Public line note', 'Private line note', clock_timestamp()
);
update dpg_v1.products set name = 'Synthetic Product One Changed Again', retail_price = 2000000,
  version = version + 1, updated_at = clock_timestamp()
where id = '14000000-0000-4000-8000-000000000001';

do $$
begin
  if not exists (
    select 1 from dpg_v1.quote_lines where id = '21100000-0000-4000-8000-000000000001'
      and product_name_snapshot = 'Synthetic Product One Renamed' and unit_price = 1500000
  ) then raise exception 'negotiated Quote snapshot changed with Product'; end if;
  if (select customer_note from dpg_v1.quote_requests where id = '20000000-0000-4000-8000-000000000001') <> 'Submitted note'
  then raise exception 'Quote Request was rewritten into negotiated Quote'; end if;
end
$$;

create temporary table leo561_conversion_results (label text primary key, order_id uuid not null);
insert into leo561_conversion_results values
  ('converted', dpg_v1.convert_quote_to_order('21000000-0000-4000-8000-000000000001', 3, 'leo561-convert-key-1')),
  ('replay', dpg_v1.convert_quote_to_order('21000000-0000-4000-8000-000000000001', 3, 'leo561-convert-key-1')),
  ('alternate-key', dpg_v1.convert_quote_to_order('21000000-0000-4000-8000-000000000001', 3, 'leo561-convert-key-2'));

do $$
begin
  if (select count(distinct order_id) from leo561_conversion_results) <> 1 then
    raise exception 'Quote conversion replay identity changed';
  end if;
  if (select count(*) from dpg_v1.orders where source_quote_id = '21000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'Quote conversion created duplicate Order';
  end if;
  if not exists (
    select 1 from dpg_v1.order_lines
    where order_id = (select order_id from leo561_conversion_results where label = 'converted')
      and product_name_snapshot = 'Synthetic Product One Renamed'
      and unit_price = 1500000 and line_discount = 200000
  ) then raise exception 'Quote conversion did not preserve negotiated snapshot'; end if;
  begin
    perform dpg_v1.convert_quote_to_order('21000000-0000-4000-8000-000000000001', 4, 'leo561-convert-key-1');
    raise exception 'idempotency key mismatch unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'idempotency key mismatch unexpectedly succeeded' then raise; end if;
  end;
end
$$;

insert into dpg_v1.payment_transactions (order_id, transaction_type, amount, reference, occurred_at)
values ('19000000-0000-4000-8000-000000000001', 'PAYMENT', 400000, 'synthetic-payment-1', clock_timestamp());
do $$
begin
  if (select payment_status from dpg_v1.orders where id = '19000000-0000-4000-8000-000000000001') <> 'PARTIALLY_PAID' then
    raise exception 'partial payment projection failed';
  end if;
end
$$;
insert into dpg_v1.payment_transactions (order_id, transaction_type, amount, reference, occurred_at)
values ('19000000-0000-4000-8000-000000000001', 'PAYMENT', 600000, 'synthetic-payment-2', clock_timestamp());
insert into dpg_v1.payment_transactions (order_id, transaction_type, amount, reference, occurred_at)
values ('19000000-0000-4000-8000-000000000001', 'REFUND', 100000, 'synthetic-refund-1', clock_timestamp());
do $$
begin
  if (select payment_status from dpg_v1.orders where id = '19000000-0000-4000-8000-000000000001') <> 'REFUNDED' then
    raise exception 'refund payment projection failed';
  end if;
end
$$;

insert into dpg_v1.staff_users (auth_user_id, email, display_name, status) values
  ('22000000-0000-4000-8000-000000000001', 'synthetic.staff@example.invalid', 'Synthetic Staff', 'active');
insert into dpg_v1.staff_user_roles (auth_user_id, role) values
  ('22000000-0000-4000-8000-000000000001', 'Product'),
  ('22000000-0000-4000-8000-000000000001', 'Marketing');
do $$
declare roles text[];
begin
  select array_agg(role::text order by role::text) into roles
  from dpg_v1.staff_user_roles where auth_user_id = '22000000-0000-4000-8000-000000000001';
  if roles <> array['Marketing', 'Product'] then raise exception 'fixed multi-role union boundary failed'; end if;
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'dpg_v1' and table_name in ('custom_roles', 'role_hierarchy', 'product_variants')
  ) then raise exception 'deprecated/custom authority entered canonical schema'; end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'dpg_v1' and table_name = 'products'
      and column_name in ('specs', 'variant_group', 'variant_group_id', 'is_master', 'original_price', 'price_display')
  ) then raise exception 'legacy Product compatibility field entered canonical authority'; end if;
  if exists (
    select 1 from pg_tables
    where schemaname = 'dpg_v1' and (not rowsecurity)
  ) then raise exception 'canonical private table missing fail-closed RLS prerequisite'; end if;
end
$$;

set constraints all immediate;

select jsonb_build_object(
  'leo561_canonical_v1_schema', 'PASS',
  'synthetic_only', true,
  'remote_mutation', false
) as sanitized_acceptance;

rollback;
