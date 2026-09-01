\set ON_ERROR_STOP on
begin;

-- All rows and provider proofs are synthetic. This is a rollback-only
-- acceptance harness; it does not upload, delete, or reconcile provider bytes.
do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'dpg_v1' and c.relname = 'media_variants'
      and c.relrowsecurity and c.relforcerowsecurity
  ) then
    raise exception 'LEO-565 media_variants is not forced through RLS';
  end if;
  if not exists (
    select 1 from pg_proc
    where oid = 'dpg_v1_api.catalogue_media_register(jsonb,text)'::regprocedure
      and not prosecdef
  ) then
    raise exception 'LEO-565 media registration boundary is not SECURITY INVOKER';
  end if;
  if not exists (
    select 1 from pg_proc
    where oid = 'dpg_v1_api.catalogue_media_mark_ready(uuid,jsonb,text)'::regprocedure
      and not prosecdef
  ) then
    raise exception 'LEO-565 provider verification boundary is not SECURITY INVOKER';
  end if;
  if has_table_privilege('dpg_backup', 'dpg_v1.media_assets', 'INSERT')
     or has_table_privilege('dpg_backup', 'dpg_v1.media_variants', 'UPDATE') then
    raise exception 'LEO-565 dpg_backup has a V1 write privilege';
  end if;
end
$$;

insert into dpg_v1.staff_users (auth_user_id, email, display_name, status)
values (
  '65000000-0000-4000-8000-000000000001',
  'leo565-product@example.invalid',
  'LEO-565 Product Staff',
  'active'
);
insert into dpg_v1.staff_user_roles (auth_user_id, role)
values ('65000000-0000-4000-8000-000000000001', 'Product');

insert into dpg_v1.brands (id, name, slug)
values (
  '65000000-0000-4000-8000-000000000002',
  'LEO-565 Synthetic Brand',
  'leo-565-synthetic-brand'
);
insert into dpg_v1.categories (
  id, parent_id, sector, name, slug, is_leaf, sort_order
)
values (
  '65000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  'kitchen',
  'LEO-565 Synthetic Category',
  'leo-565-synthetic-category',
  true,
  0
);
insert into dpg_v1.products (
  id, sku, model, name, slug, brand_id, primary_category_id,
  retail_price, availability, status
)
values (
  '65000000-0000-4000-8000-000000000004',
  'LEO565-P1',
  'LEO565-M1',
  'LEO-565 Synthetic Product',
  'leo-565-synthetic-product',
  '65000000-0000-4000-8000-000000000002',
  '65000000-0000-4000-8000-000000000003',
  125000,
  'IN_STOCK',
  'DRAFT'
);
insert into dpg_v1.product_source_provenance (
  id, product_id, source_kind, source_reference, quality, captured_at
)
values (
  '65000000-0000-4000-8000-000000000005',
  '65000000-0000-4000-8000-000000000004',
  'manufacturer',
  'synthetic:leo565:manufacturer',
  'official',
  clock_timestamp()
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '65000000-0000-4000-8000-000000000001',
  true
);

do $$
declare
  source_sha constant text := repeat('e', 64);
  original_key constant text := 'private/originals/v1/ee/' || repeat('e', 64) || '/source.png';
  primary_key constant text := 'public/images/product-v1/' || repeat('e', 64) || '/w1280.webp';
  registered jsonb;
  replayed jsonb;
  ready jsonb;
  media_id uuid;
begin
  registered := dpg_v1_api.catalogue_media_register(
    jsonb_build_object(
      'kind', 'IMAGE',
      'original_object_key', original_key,
      'delivery_object_key', primary_key,
      'profile_version', 'product-v1',
      'sha256', source_sha,
      'mime_type', 'image/png',
      'byte_size', 2048,
      'width_px', 1600,
      'height_px', 800,
      'provenance', 'upload:bunny-v1',
      'variants', jsonb_build_array(
        jsonb_build_object(
          'target_width_px', 320, 'width_px', 320, 'height_px', 160,
          'delivery_object_key', 'public/images/product-v1/' || source_sha || '/w320.webp',
          'sha256', repeat('1', 64), 'byte_size', 512,
          'mime_type', 'image/webp', 'profile_version', 'product-v1'
        ),
        jsonb_build_object(
          'target_width_px', 640, 'width_px', 640, 'height_px', 320,
          'delivery_object_key', 'public/images/product-v1/' || source_sha || '/w640.webp',
          'sha256', repeat('2', 64), 'byte_size', 768,
          'mime_type', 'image/webp', 'profile_version', 'product-v1'
        ),
        jsonb_build_object(
          'target_width_px', 1280, 'width_px', 1280, 'height_px', 640,
          'delivery_object_key', primary_key,
          'sha256', repeat('3', 64), 'byte_size', 1024,
          'mime_type', 'image/webp', 'profile_version', 'product-v1'
        )
      )
    ),
    'leo565-media-register-1'
  );
  media_id := (registered->>'media_asset_id')::uuid;
  if registered->>'state' <> 'PENDING'
     or registered->>'variant_count' <> '3'
     or (select state from dpg_v1.media_assets where id = media_id) <> 'PENDING' then
    raise exception 'LEO-565 media registration did not remain PENDING';
  end if;
  replayed := dpg_v1_api.catalogue_media_register(
    jsonb_build_object(
      'kind', 'IMAGE',
      'original_object_key', original_key,
      'delivery_object_key', primary_key,
      'profile_version', 'product-v1',
      'sha256', source_sha,
      'mime_type', 'image/png',
      'byte_size', 2048,
      'width_px', 1600,
      'height_px', 800,
      'provenance', 'upload:bunny-v1',
      'variants', jsonb_build_array(
        jsonb_build_object(
          'target_width_px', 320, 'width_px', 320, 'height_px', 160,
          'delivery_object_key', 'public/images/product-v1/' || source_sha || '/w320.webp',
          'sha256', repeat('1', 64), 'byte_size', 512,
          'mime_type', 'image/webp', 'profile_version', 'product-v1'
        ),
        jsonb_build_object(
          'target_width_px', 640, 'width_px', 640, 'height_px', 320,
          'delivery_object_key', 'public/images/product-v1/' || source_sha || '/w640.webp',
          'sha256', repeat('2', 64), 'byte_size', 768,
          'mime_type', 'image/webp', 'profile_version', 'product-v1'
        ),
        jsonb_build_object(
          'target_width_px', 1280, 'width_px', 1280, 'height_px', 640,
          'delivery_object_key', primary_key,
          'sha256', repeat('3', 64), 'byte_size', 1024,
          'mime_type', 'image/webp', 'profile_version', 'product-v1'
        )
      )
    ),
    'leo565-media-register-1'
  );
  if replayed <> registered then
    raise exception 'LEO-565 media registration replay changed the safe response';
  end if;

  begin
    perform dpg_v1_api.catalogue_media_mark_ready(
      media_id,
      jsonb_build_object(
        'provider', 'bunny',
        'original', jsonb_build_object(
          'key', original_key, 'sha256', source_sha,
          'byte_size', 2048, 'mime_type', 'image/png'
        ),
        'delivery', jsonb_build_array(
          jsonb_build_object(
            'key', primary_key, 'sha256', repeat('x', 64),
            'byte_size', 1024, 'mime_type', 'image/webp'
          )
        )
      ),
      'leo565-media-ready-invalid'
    );
    raise exception 'LEO-565 unverified provider bytes unexpectedly became READY';
  exception when others then
    if sqlerrm = 'LEO-565 unverified provider bytes unexpectedly became READY' then
      raise;
    end if;
  end;

  ready := dpg_v1_api.catalogue_media_mark_ready(
    media_id,
    jsonb_build_object(
      'provider', 'bunny',
      'original', jsonb_build_object(
        'key', original_key, 'sha256', source_sha,
        'byte_size', 2048, 'mime_type', 'image/png'
      ),
      'delivery', jsonb_build_array(
        jsonb_build_object(
          'key', 'public/images/product-v1/' || source_sha || '/w320.webp',
          'sha256', repeat('1', 64), 'byte_size', 512, 'mime_type', 'image/webp'
        ),
        jsonb_build_object(
          'key', 'public/images/product-v1/' || source_sha || '/w640.webp',
          'sha256', repeat('2', 64), 'byte_size', 768, 'mime_type', 'image/webp'
        ),
        jsonb_build_object(
          'key', primary_key, 'sha256', repeat('3', 64),
          'byte_size', 1024, 'mime_type', 'image/webp'
        )
      )
    ),
    'leo565-media-ready-1'
  );
  if ready->>'state' <> 'READY'
     or (select provider_name from dpg_v1.media_assets where id = media_id) <> 'bunny'
     or (select provider_verified_at is not null from dpg_v1.media_assets where id = media_id) is not true then
    raise exception 'LEO-565 provider verification did not produce READY media';
  end if;

  if (dpg_v1_api.catalogue_product_media_attach(
    '65000000-0000-4000-8000-000000000004',
    media_id,
    'PRIMARY',
    0,
    'Synthetic responsive primary',
    'leo565-media-attach-1'
  )->>'role') <> 'PRIMARY' then
    raise exception 'LEO-565 Product PRIMARY attachment failed';
  end if;

  begin
    update dpg_v1.media_assets
    set delivery_object_key = primary_key || '-changed'
    where id = media_id;
    raise exception 'LEO-565 public media key overwrite unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'LEO-565 public media key overwrite unexpectedly succeeded' then
      raise;
    end if;
  end;
end
$$;

select dpg_v1_api.catalogue_product_publish(
  '65000000-0000-4000-8000-000000000004',
  1,
  'leo565-publish-1'
);

reset role;
set local role anon;
do $$
declare
  product_payload jsonb;
begin
  product_payload := dpg_v1_api.public_product_get(
    '65000000-0000-4000-8000-000000000004'
  );
  if jsonb_array_length(product_payload->'media') <> 1
     or jsonb_array_length(product_payload->'media'->0->'variants') <> 3
     or product_payload->'media'->0->'variants'->2->>'target_width_px' <> '1280' then
    raise exception 'LEO-565 public Product responsive media projection failed';
  end if;
end
$$;

reset role;
set local role dpg_backup;
do $$
begin
  if (select count(*) from dpg_v1.media_assets) <> 1
     or (select count(*) from dpg_v1.media_variants) <> 3 then
    raise exception 'LEO-565 dpg_backup V1 read coverage failed';
  end if;
  begin
    update dpg_v1.media_assets set provenance = 'forbidden' where false;
    raise exception 'LEO-565 dpg_backup write unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'LEO-565 dpg_backup write unexpectedly succeeded' then raise; end if;
  end;
end
$$;

reset role;
select jsonb_build_object('leo565_media_foundation', 'PASS') as sanitized_acceptance;
rollback;
