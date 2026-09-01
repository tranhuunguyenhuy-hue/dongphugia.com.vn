-- LEO-565 Round 1: V1 media metadata, provider verification, and backup scope.
--
-- Source/local only. Round 1 does not select a Bunny resource, upload bytes,
-- mutate Cloudflare, change a remote Supabase project, or migrate legacy
-- media. Bunny is the byte/delivery authority only after the later Preview
-- Owner Gate approves the exact resources and credentials.

alter table dpg_v1.media_assets
  add column provider_name text,
  add column provider_verified_at timestamptz;

alter table dpg_v1.media_assets
  add constraint leo565_media_assets_provider_check
    check (provider_name is null or provider_name = 'bunny'),
  add constraint leo565_media_assets_provider_verified_check
    check (provider_verified_at is null or provider_name = 'bunny'),
  add constraint leo565_media_assets_size_limit_check
    check (byte_size between 1 and 5242880),
  add constraint leo565_media_assets_key_contract_check
    check (
      (
        kind = 'IMAGE'
        and profile_version = 'product-v1'
        and original_object_key ~ '^private/originals/v1/[0-9a-f]{2}/[0-9a-f]{64}/source\.(jpg|png|webp)$'
        and delivery_object_key ~ '^public/images/product-v1/[0-9a-f]{64}/w(320|640|1280)\.webp$'
        and original_object_key = 'private/originals/v1/'
          || left(btrim(sha256), 2) || '/' || btrim(sha256)
          || '/source.' || case mime_type
            when 'image/jpeg' then 'jpg'
            when 'image/png' then 'png'
            when 'image/webp' then 'webp'
          end
        and delivery_object_key = 'public/images/product-v1/'
          || btrim(sha256) || '/w' || regexp_replace(delivery_object_key, '^.*/w([0-9]+)\.webp$', '\1')
          || '.webp'
      )
      or (
        kind = 'DOCUMENT'
        and profile_version is null
        and original_object_key ~ '^private/originals/v1/[0-9a-f]{2}/[0-9a-f]{64}/source\.pdf$'
        and delivery_object_key ~ '^public/documents/v1/[0-9a-f]{64}/document\.pdf$'
        and original_object_key = 'private/originals/v1/'
          || left(btrim(sha256), 2) || '/' || btrim(sha256) || '/source.pdf'
        and delivery_object_key = 'public/documents/v1/'
          || btrim(sha256) || '/document.pdf'
      )
    ),
  add constraint leo565_media_assets_pending_provider_check
    check (
      state <> 'PENDING'
      or (provider_name is null and provider_verified_at is null)
    );

create table dpg_v1.media_variants (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references dpg_v1.media_assets(id) on delete restrict,
  target_width_px integer not null,
  width_px integer not null,
  height_px integer not null,
  delivery_object_key text not null,
  sha256 char(64) not null,
  byte_size bigint not null,
  mime_type text not null,
  profile_version text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  updated_by uuid references dpg_v1.staff_users(auth_user_id) on delete set null,
  constraint leo565_media_variants_target_check check (target_width_px in (320, 640, 1280)),
  constraint leo565_media_variants_dimensions_check check (
    width_px > 0 and height_px > 0 and width_px <= target_width_px
  ),
  constraint leo565_media_variants_size_check check (byte_size between 1 and 5242880),
  constraint leo565_media_variants_sha256_check check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint leo565_media_variants_mime_check check (mime_type = 'image/webp'),
  constraint leo565_media_variants_profile_check check (profile_version = 'product-v1'),
  constraint leo565_media_variants_key_check check (
    delivery_object_key ~ '^public/images/product-v1/[0-9a-f]{64}/w(320|640|1280)\.webp$'
    and delivery_object_key !~ '^[a-z][a-z0-9+.-]*://'
  ),
  unique (media_asset_id, target_width_px),
  unique (delivery_object_key)
);

create function dpg_v1.validate_media_asset_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dpg_v1
as $$
begin
  if tg_op = 'UPDATE' then
    if old.kind is distinct from new.kind
       or old.original_object_key is distinct from new.original_object_key
       or old.delivery_object_key is distinct from new.delivery_object_key
       or old.profile_version is distinct from new.profile_version
       or old.sha256 is distinct from new.sha256
       or old.mime_type is distinct from new.mime_type
       or old.byte_size is distinct from new.byte_size
       or old.width_px is distinct from new.width_px
       or old.height_px is distinct from new.height_px then
      raise exception 'MEDIA_ASSET_IDENTITY_IMMUTABLE';
    end if;
    if old.state = 'TOMBSTONED' and new.state <> 'TOMBSTONED' then
      raise exception 'MEDIA_ASSET_TOMBSTONE_IMMUTABLE';
    end if;
    if old.state = 'READY' and new.state not in ('READY', 'TOMBSTONED') then
      raise exception 'MEDIA_ASSET_READY_STATE_IMMUTABLE';
    end if;
    if old.state = 'READY'
       and (old.provider_name is distinct from new.provider_name
         or old.provider_verified_at is distinct from new.provider_verified_at) then
      raise exception 'MEDIA_ASSET_PROVIDER_VERIFICATION_IMMUTABLE';
    end if;
  end if;

  if new.state = 'PENDING'
     and (new.provider_name is not null or new.provider_verified_at is not null) then
    raise exception 'MEDIA_ASSET_PENDING_PROVIDER_FORBIDDEN';
  end if;

  if new.state = 'READY' then
    if new.provider_name <> 'bunny' or new.provider_verified_at is null then
      raise exception 'MEDIA_ASSET_READY_REQUIRES_PROVIDER_VERIFICATION';
    end if;
    if new.kind = 'IMAGE' then
      if not exists (
        select 1 from dpg_v1.media_variants variant
        where variant.media_asset_id = new.id
          and variant.delivery_object_key = new.delivery_object_key
      ) then
        raise exception 'MEDIA_ASSET_READY_PRIMARY_VARIANT_MISSING';
      end if;
      if (select count(*) from dpg_v1.media_variants variant
          where variant.media_asset_id = new.id) not between 1 and 3 then
        raise exception 'MEDIA_ASSET_READY_VARIANT_COUNT_INVALID';
      end if;
      if exists (
        select 1 from dpg_v1.media_variants variant
        where variant.media_asset_id = new.id
          and (variant.profile_version <> 'product-v1'
            or variant.mime_type <> 'image/webp'
            or variant.width_px > variant.target_width_px)
      ) then
        raise exception 'MEDIA_ASSET_READY_VARIANT_CONTRACT_INVALID';
      end if;
    elsif exists (
      select 1 from dpg_v1.media_variants variant
      where variant.media_asset_id = new.id
    ) then
      raise exception 'MEDIA_DOCUMENT_CANNOT_HAVE_VARIANTS';
    end if;
  end if;
  return new;
end
$$;

create trigger media_assets_validate_mutation
before insert or update on dpg_v1.media_assets
for each row execute function dpg_v1.validate_media_asset_mutation();

create function dpg_v1.validate_media_variant_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, dpg_v1
as $$
declare
  asset_kind dpg_v1.media_kind;
  asset_profile text;
  asset_state dpg_v1.media_state;
  asset_sha char(64);
begin
  select kind, profile_version, state, sha256
    into asset_kind, asset_profile, asset_state, asset_sha
  from dpg_v1.media_assets
  where id = new.media_asset_id;
  if not found or asset_kind <> 'IMAGE' or asset_profile <> 'product-v1' then
    raise exception 'MEDIA_VARIANT_REQUIRES_PRODUCT_IMAGE';
  end if;
  if new.width_px > (select width_px from dpg_v1.media_assets where id = new.media_asset_id)
     or new.height_px > (select height_px from dpg_v1.media_assets where id = new.media_asset_id) then
    raise exception 'MEDIA_VARIANT_UPSCALE_REJECTED';
  end if;
  if new.delivery_object_key <> 'public/images/product-v1/'
       || btrim(asset_sha) || '/w' || new.target_width_px || '.webp' then
    raise exception 'MEDIA_VARIANT_KEY_NOT_CONTENT_ADDRESSED';
  end if;
  if asset_state in ('READY', 'TOMBSTONED') then
    raise exception 'MEDIA_VARIANT_IMMUTABLE_AFTER_PROVIDER_VERIFICATION';
  end if;
  if tg_op = 'UPDATE' and (
    old.media_asset_id is distinct from new.media_asset_id
    or old.target_width_px is distinct from new.target_width_px
    or old.width_px is distinct from new.width_px
    or old.height_px is distinct from new.height_px
    or old.delivery_object_key is distinct from new.delivery_object_key
    or old.sha256 is distinct from new.sha256
    or old.byte_size is distinct from new.byte_size
    or old.mime_type is distinct from new.mime_type
    or old.profile_version is distinct from new.profile_version
  ) then
    raise exception 'MEDIA_VARIANT_IDENTITY_IMMUTABLE';
  end if;
  if tg_op = 'INSERT' and (
    select count(*) from dpg_v1.media_variants variant
    where variant.media_asset_id = new.media_asset_id
  ) >= 3 then
    raise exception 'MEDIA_VARIANT_COUNT_OUT_OF_BOUNDS';
  end if;
  return new;
end
$$;

create trigger media_variants_attribution
before insert or update on dpg_v1.media_variants
for each row execute function dpg_v1.enforce_staff_attribution();
create trigger media_variants_validate_mutation
before insert or update on dpg_v1.media_variants
for each row execute function dpg_v1.validate_media_variant_mutation();

alter table dpg_v1.media_variants enable row level security;
alter table dpg_v1.media_variants force row level security;
revoke all on table dpg_v1.media_variants from public, anon, authenticated, service_role;
grant select on table dpg_v1.media_variants to anon, authenticated;
grant insert, update on table dpg_v1.media_variants to authenticated;

drop policy v1_media_public_select on dpg_v1.media_assets;
create policy v1_media_public_select on dpg_v1.media_assets
for select to anon using (
  state = 'READY'
  and (
    exists (
      select 1
      from dpg_v1.product_media pm
      join dpg_v1.products p on p.id = pm.product_id
      where pm.media_asset_id = media_assets.id and p.status = 'PUBLISHED'
    )
    or exists (
      select 1
      from dpg_v1.product_documents pd
      join dpg_v1.products p on p.id = pd.product_id
      where pd.media_asset_id = media_assets.id
        and pd.is_public and p.status = 'PUBLISHED'
    )
    or exists (
      select 1 from dpg_v1.content_entries entry
      where entry.hero_media_id = media_assets.id and entry.status = 'PUBLISHED'
    )
    or exists (
      select 1
      from dpg_v1.content_blocks block
      join dpg_v1.content_entries entry on entry.id = block.content_entry_id
      where block.media_asset_id = media_assets.id and entry.status = 'PUBLISHED'
    )
  )
);

create policy v1_media_variant_public_select on dpg_v1.media_variants
for select to anon using (exists (
  select 1
  from dpg_v1.product_media pm
  join dpg_v1.products p on p.id = pm.product_id
  join dpg_v1.media_assets ma on ma.id = pm.media_asset_id
  where pm.media_asset_id = media_variants.media_asset_id
    and ma.state = 'READY' and p.status = 'PUBLISHED'
));
create policy v1_media_variant_staff_select on dpg_v1.media_variants
for select to authenticated using (dpg_v1.staff_has_capability('catalogue.read'));
create policy v1_media_variant_write on dpg_v1.media_variants
for all to authenticated
using (dpg_v1.staff_has_capability('catalogue.update'))
with check (dpg_v1.staff_has_capability('catalogue.update'));

revoke delete on table dpg_v1.media_assets, dpg_v1.media_variants from authenticated;

alter table dpg_v1.service_idempotency_records
  drop constraint service_idempotency_operation_check,
  drop constraint service_idempotency_resource_check;
alter table dpg_v1.service_idempotency_records
  add constraint service_idempotency_operation_check check (operation in (
    'order_intake.create', 'quote_request_intake.create',
    'catalogue.product.create', 'catalogue.product.update',
    'catalogue.product.publish', 'catalogue.product.archive',
    'catalogue.media.register', 'catalogue.media.ready',
    'catalogue.media.attach', 'catalogue.media.tombstone',
    'marketing.content.create', 'marketing.content.update',
    'marketing.content.publish', 'marketing.content.archive',
    'marketing.collection.create', 'marketing.collection.update',
    'marketing.collection.publish', 'marketing.collection.archive',
    'sales.order.lifecycle.update', 'sales.order.payment.update',
    'sales.order.archive', 'sales.quote.create', 'sales.quote.update',
    'sales.quote.publish', 'sales.quote.archive', 'sales.quote.revoke_share',
    'staff.user.provision', 'staff.user.assign_roles', 'staff.user.disable'
  )),
  add constraint service_idempotency_resource_check check (resource_type in (
    'order', 'quote_request', 'product', 'content_entry', 'collection',
    'quote', 'staff_user', 'media_asset'
  ));

create function dpg_v1.validate_media_provider_verification(
  p_media_asset_id uuid,
  p_verification jsonb
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, dpg_v1
as $$
declare
  asset dpg_v1.media_assets%rowtype;
  original jsonb;
  delivery jsonb;
  item jsonb;
begin
  select * into asset
  from dpg_v1.media_assets
  where id = p_media_asset_id
  for update;
  if not found then raise exception 'MEDIA_ASSET_NOT_FOUND'; end if;
  if asset.state <> 'PENDING' then raise exception 'MEDIA_ASSET_NOT_PENDING'; end if;
  if p_verification is null or jsonb_typeof(p_verification) is distinct from 'object'
     or exists (
       select 1 from jsonb_object_keys(p_verification) as keys(key_name)
       where keys.key_name not in ('provider', 'original', 'delivery')
     )
     or not (p_verification ?& array['provider', 'original', 'delivery']) then
    raise exception 'MEDIA_PROVIDER_VERIFICATION_INVALID';
  end if;
  if p_verification->>'provider' <> 'bunny' then
    raise exception 'MEDIA_PROVIDER_UNSUPPORTED';
  end if;

  original := p_verification->'original';
  if jsonb_typeof(original) is distinct from 'object'
     or exists (
       select 1 from jsonb_object_keys(original) as keys(key_name)
       where keys.key_name not in ('key', 'sha256', 'byte_size', 'mime_type')
     )
     or not (original ?& array['key', 'sha256', 'byte_size', 'mime_type'])
     or original->>'key' <> asset.original_object_key
     or original->>'sha256' <> asset.sha256
     or original->>'mime_type' <> asset.mime_type
     or original->>'byte_size' !~ '^[0-9]+$'
     or (original->>'byte_size')::bigint <> asset.byte_size then
    raise exception 'MEDIA_PROVIDER_ORIGINAL_MISMATCH';
  end if;

  delivery := p_verification->'delivery';
  if jsonb_typeof(delivery) is distinct from 'array' then
    raise exception 'MEDIA_PROVIDER_DELIVERY_INVALID';
  end if;
  if asset.kind = 'IMAGE' then
    if jsonb_array_length(delivery) <> (
      select count(*) from dpg_v1.media_variants variant
      where variant.media_asset_id = asset.id
    ) then
      raise exception 'MEDIA_PROVIDER_DELIVERY_COUNT_MISMATCH';
    end if;
    for item in select value from jsonb_array_elements(delivery) loop
      if jsonb_typeof(item) is distinct from 'object'
         or exists (
           select 1 from jsonb_object_keys(item) as keys(key_name)
           where keys.key_name not in ('key', 'sha256', 'byte_size', 'mime_type')
         )
         or not (item ?& array['key', 'sha256', 'byte_size', 'mime_type'])
         or item->>'byte_size' !~ '^[0-9]+$'
         or not exists (
           select 1 from dpg_v1.media_variants variant
           where variant.media_asset_id = asset.id
             and variant.delivery_object_key = item->>'key'
             and variant.sha256 = item->>'sha256'
             and variant.byte_size = (item->>'byte_size')::bigint
             and variant.mime_type = item->>'mime_type'
         ) then
        raise exception 'MEDIA_PROVIDER_DELIVERY_MISMATCH';
      end if;
    end loop;
    if exists (
      select 1 from dpg_v1.media_variants variant
      where variant.media_asset_id = asset.id
        and not exists (
          select 1
          from jsonb_array_elements(delivery) candidate
          where candidate->>'key' = variant.delivery_object_key
            and candidate->>'sha256' = variant.sha256
            and candidate->>'byte_size' ~ '^[0-9]+$'
            and (candidate->>'byte_size')::bigint = variant.byte_size
            and candidate->>'mime_type' = variant.mime_type
        )
    ) then
      raise exception 'MEDIA_PROVIDER_DELIVERY_MISMATCH';
    end if;
  else
    if jsonb_array_length(delivery) <> 1 then
      raise exception 'MEDIA_PROVIDER_DELIVERY_COUNT_MISMATCH';
    end if;
    item := delivery->0;
    if jsonb_typeof(item) is distinct from 'object'
       or exists (
         select 1 from jsonb_object_keys(item) as keys(key_name)
         where keys.key_name not in ('key', 'sha256', 'byte_size', 'mime_type')
       )
       or not (item ?& array['key', 'sha256', 'byte_size', 'mime_type'])
       or item->>'key' <> asset.delivery_object_key
       or item->>'sha256' <> asset.sha256
       or item->>'mime_type' <> asset.mime_type
       or item->>'byte_size' !~ '^[0-9]+$'
       or (item->>'byte_size')::bigint <> asset.byte_size then
      raise exception 'MEDIA_PROVIDER_DELIVERY_MISMATCH';
    end if;
  end if;
end
$$;

create function dpg_v1_api.catalogue_media_register(
  p_input jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('catalogue.update');
  idem record;
  input_key text;
  media_id uuid;
  response jsonb;
  request_hash char(64);
  idempotency_key_hash char(64);
  variant_count integer;
  variant_item jsonb;
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'INVALID_MEDIA_INPUT';
  end if;
  for input_key in select jsonb_object_keys(p_input) loop
    if input_key not in (
      'kind', 'original_object_key', 'delivery_object_key', 'profile_version',
      'sha256', 'mime_type', 'byte_size', 'width_px', 'height_px',
      'provenance', 'variants'
    ) then
      raise exception 'UNKNOWN_MEDIA_FIELD';
    end if;
  end loop;
  if not (p_input ?& array[
    'kind', 'original_object_key', 'delivery_object_key', 'sha256',
    'mime_type', 'byte_size', 'provenance', 'variants'
  ]) then
    raise exception 'INVALID_MEDIA_INPUT';
  end if;
  if p_input->>'kind' not in ('IMAGE', 'DOCUMENT')
     or p_input->>'sha256' !~ '^[0-9a-f]{64}$'
     or p_input->>'byte_size' !~ '^[1-9][0-9]*$'
     or p_input->>'provenance' <> 'upload:bunny-v1'
     or jsonb_typeof(p_input->'variants') <> 'array' then
    raise exception 'INVALID_MEDIA_INPUT';
  end if;
  if p_input->>'kind' = 'IMAGE' then
    if p_input->>'profile_version' <> 'product-v1'
       or p_input->>'mime_type' not in ('image/jpeg', 'image/png', 'image/webp')
       or p_input->>'width_px' !~ '^[1-9][0-9]*$'
       or p_input->>'height_px' !~ '^[1-9][0-9]*$'
       or jsonb_array_length(p_input->'variants') not between 1 and 3 then
      raise exception 'INVALID_MEDIA_INPUT';
    end if;
  else
    if p_input->>'profile_version' is not null
       or p_input->>'mime_type' <> 'application/pdf'
       or p_input->>'width_px' is not null
       or p_input->>'height_px' is not null
       or jsonb_array_length(p_input->'variants') <> 0 then
      raise exception 'INVALID_MEDIA_INPUT';
    end if;
  end if;

  for variant_item in select value from jsonb_array_elements(p_input->'variants') loop
    if jsonb_typeof(variant_item) is distinct from 'object'
       or exists (
           select 1 from jsonb_object_keys(variant_item) as keys(key_name)
           where keys.key_name not in (
           'target_width_px', 'width_px', 'height_px',
           'delivery_object_key', 'sha256', 'byte_size',
           'mime_type', 'profile_version'
         )
       )
       or not (variant_item ?& array[
         'target_width_px', 'width_px', 'height_px',
         'delivery_object_key', 'sha256', 'byte_size',
         'mime_type', 'profile_version'
       ]) then
      raise exception 'INVALID_MEDIA_VARIANT_INPUT';
    end if;
  end loop;

  request_hash := dpg_v1.sha256_json(p_input);
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'catalogue.media.register', request_hash,
    p_idempotency_key, 'media_asset', null
  );
  if idem.replay then return idem.safe_response; end if;
  idempotency_key_hash := idem.key_hash;
  media_id := gen_random_uuid();

  insert into dpg_v1.media_assets (
    id, kind, original_object_key, delivery_object_key, profile_version,
    sha256, mime_type, byte_size, width_px, height_px, provenance, state
  ) values (
    media_id,
    (p_input->>'kind')::dpg_v1.media_kind,
    p_input->>'original_object_key',
    p_input->>'delivery_object_key',
    p_input->>'profile_version',
    p_input->>'sha256',
    p_input->>'mime_type',
    (p_input->>'byte_size')::bigint,
    nullif(p_input->>'width_px', '')::integer,
    nullif(p_input->>'height_px', '')::integer,
    p_input->>'provenance',
    'PENDING'
  );

  insert into dpg_v1.media_variants (
    media_asset_id, target_width_px, width_px, height_px,
    delivery_object_key, sha256, byte_size, mime_type, profile_version
  )
  select
    media_id, variant.target_width_px, variant.width_px, variant.height_px,
    variant.delivery_object_key, variant.sha256, variant.byte_size,
    variant.mime_type, variant.profile_version
  from jsonb_to_recordset(p_input->'variants') as variant(
    target_width_px integer,
    width_px integer,
    height_px integer,
    delivery_object_key text,
    sha256 char(64),
    byte_size bigint,
    mime_type text,
    profile_version text
  );

  select count(*)::integer into variant_count
  from dpg_v1.media_variants variant
  where variant.media_asset_id = media_id;
  if p_input->>'kind' = 'IMAGE'
     and not exists (
       select 1
       from dpg_v1.media_variants variant
       where variant.media_asset_id = media_id
         and variant.delivery_object_key = p_input->>'delivery_object_key'
         and variant.target_width_px = (
           select max(max_variant.target_width_px)
           from dpg_v1.media_variants max_variant
           where max_variant.media_asset_id = media_id
         )
     ) then
    raise exception 'MEDIA_PRIMARY_VARIANT_INVALID';
  end if;

  response := jsonb_build_object(
    'media_asset_id', media_id,
    'state', 'PENDING',
    'variant_count', variant_count,
    'delivery_object_key', p_input->>'delivery_object_key'
  );
  update dpg_v1.service_idempotency_records as records
  set resource_id = media_id, safe_response = response
  where records.scope_key = actor_id::text and records.operation = 'catalogue.media.register'
    and records.key_hash = idempotency_key_hash;
  return response;
end
$$;

create function dpg_v1_api.catalogue_media_mark_ready(
  p_media_asset_id uuid,
  p_verification jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('catalogue.update');
  idem record;
  request_hash char(64);
  idempotency_key_hash char(64);
  response jsonb;
  asset dpg_v1.media_assets%rowtype;
begin
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'media_asset_id', p_media_asset_id,
    'verification', p_verification
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'catalogue.media.ready', request_hash,
    p_idempotency_key, 'media_asset', p_media_asset_id
  );
  if idem.replay then return idem.safe_response; end if;
  idempotency_key_hash := idem.key_hash;

  select * into asset
  from dpg_v1.media_assets
  where id = p_media_asset_id
  for update;
  if not found then raise exception 'MEDIA_ASSET_NOT_FOUND'; end if;
  perform dpg_v1.validate_media_provider_verification(p_media_asset_id, p_verification);
  update dpg_v1.media_assets
  set provider_name = 'bunny',
      provider_verified_at = clock_timestamp(),
      state = 'READY'
  where id = p_media_asset_id;

  response := jsonb_build_object(
    'media_asset_id', p_media_asset_id,
    'state', 'READY',
    'provider', 'bunny'
  );
  update dpg_v1.service_idempotency_records as records
  set resource_id = p_media_asset_id, safe_response = response
  where scope_key = actor_id::text and operation = 'catalogue.media.ready'
    and records.key_hash = idempotency_key_hash;
  return response;
end
$$;

create function dpg_v1_api.catalogue_product_media_attach(
  p_product_id uuid,
  p_media_asset_id uuid,
  p_role dpg_v1.product_media_role,
  p_sort_order integer,
  p_alt_text text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('catalogue.update');
  idem record;
  request_hash char(64);
  idempotency_key_hash char(64);
  response jsonb;
  reference_id uuid;
begin
  if p_product_id is null or p_media_asset_id is null or p_role is null
     or p_sort_order is null or p_sort_order < 0
     or nullif(btrim(p_alt_text), '') is null then
    raise exception 'INVALID_PRODUCT_MEDIA_INPUT';
  end if;
  if p_role = 'PRIMARY' and p_sort_order <> 0 then
    raise exception 'INVALID_PRODUCT_MEDIA_ORDER';
  end if;
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'product_id', p_product_id, 'media_asset_id', p_media_asset_id,
    'role', p_role, 'sort_order', p_sort_order, 'alt_text', btrim(p_alt_text)
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'catalogue.media.attach', request_hash,
    p_idempotency_key, 'product', p_product_id
  );
  if idem.replay then return idem.safe_response; end if;
  idempotency_key_hash := idem.key_hash;

  insert into dpg_v1.product_media (
    product_id, media_asset_id, role, sort_order, alt_text
  ) values (
    p_product_id, p_media_asset_id, p_role, p_sort_order, btrim(p_alt_text)
  ) returning id into reference_id;
  response := jsonb_build_object(
    'product_media_id', reference_id,
    'product_id', p_product_id,
    'media_asset_id', p_media_asset_id,
    'role', p_role,
    'sort_order', p_sort_order
  );
  update dpg_v1.service_idempotency_records as records
  set resource_id = p_product_id, safe_response = response
  where scope_key = actor_id::text and operation = 'catalogue.media.attach'
    and records.key_hash = idempotency_key_hash;
  return response;
end
$$;

create function dpg_v1_api.catalogue_product_document_attach(
  p_product_id uuid,
  p_media_asset_id uuid,
  p_document_type text,
  p_title text,
  p_sort_order integer,
  p_is_public boolean,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('catalogue.update');
  idem record;
  request_hash char(64);
  idempotency_key_hash char(64);
  response jsonb;
  reference_id uuid;
begin
  if p_product_id is null or p_media_asset_id is null
     or p_document_type not in (
       'TECHNICAL_SHEET', 'INSTALLATION_GUIDE', 'WARRANTY',
       'CERTIFICATE', 'OTHER'
     )
     or nullif(btrim(p_title), '') is null
     or p_sort_order is null or p_sort_order < 0 then
    raise exception 'INVALID_PRODUCT_DOCUMENT_INPUT';
  end if;
  request_hash := dpg_v1.sha256_json(jsonb_build_object(
    'product_id', p_product_id, 'media_asset_id', p_media_asset_id,
    'document_type', p_document_type, 'title', btrim(p_title),
    'sort_order', p_sort_order, 'is_public', coalesce(p_is_public, true)
  ));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'catalogue.media.attach', request_hash,
    p_idempotency_key, 'product', p_product_id
  );
  if idem.replay then return idem.safe_response; end if;
  idempotency_key_hash := idem.key_hash;

  insert into dpg_v1.product_documents (
    product_id, media_asset_id, document_type, title, sort_order, is_public
  ) values (
    p_product_id, p_media_asset_id, p_document_type, btrim(p_title),
    p_sort_order, coalesce(p_is_public, true)
  ) returning id into reference_id;
  response := jsonb_build_object(
    'product_document_id', reference_id,
    'product_id', p_product_id,
    'media_asset_id', p_media_asset_id,
    'document_type', p_document_type,
    'sort_order', p_sort_order
  );
  update dpg_v1.service_idempotency_records as records
  set resource_id = p_product_id, safe_response = response
  where scope_key = actor_id::text and operation = 'catalogue.media.attach'
    and records.key_hash = idempotency_key_hash;
  return response;
end
$$;

create function dpg_v1_api.catalogue_media_tombstone(
  p_media_asset_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
declare
  actor_id uuid := dpg_v1.require_capability('catalogue.update');
  idem record;
  request_hash char(64);
  idempotency_key_hash char(64);
  response jsonb;
  asset dpg_v1.media_assets%rowtype;
begin
  request_hash := dpg_v1.sha256_json(jsonb_build_object('media_asset_id', p_media_asset_id));
  select * into idem
  from dpg_v1.reserve_idempotency(
    actor_id::text, 'catalogue.media.tombstone', request_hash,
    p_idempotency_key, 'media_asset', p_media_asset_id
  );
  if idem.replay then return idem.safe_response; end if;
  idempotency_key_hash := idem.key_hash;
  select * into asset
  from dpg_v1.media_assets
  where id = p_media_asset_id
  for update;
  if not found then raise exception 'MEDIA_ASSET_NOT_FOUND'; end if;
  if exists (select 1 from dpg_v1.product_media where media_asset_id = p_media_asset_id)
     or exists (select 1 from dpg_v1.product_documents where media_asset_id = p_media_asset_id)
     or exists (select 1 from dpg_v1.content_entries where hero_media_id = p_media_asset_id)
     or exists (select 1 from dpg_v1.content_blocks where media_asset_id = p_media_asset_id)
     or exists (select 1 from dpg_v1.brands where logo_media_id = p_media_asset_id) then
    raise exception 'MEDIA_ASSET_HAS_REFERENCES';
  end if;
  update dpg_v1.media_assets
  set state = 'TOMBSTONED'
  where id = p_media_asset_id and state <> 'TOMBSTONED';
  response := jsonb_build_object(
    'media_asset_id', p_media_asset_id,
    'state', 'TOMBSTONED',
    'provider_objects_deleted', false
  );
  update dpg_v1.service_idempotency_records as records
  set resource_id = p_media_asset_id, safe_response = response
  where scope_key = actor_id::text and operation = 'catalogue.media.tombstone'
    and records.key_hash = idempotency_key_hash;
  return response;
end
$$;

create or replace function dpg_v1_api.public_product_get(p_product_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, dpg_v1_api, dpg_v1
as $$
  select to_jsonb(row_data) || jsonb_build_object(
    'media', coalesce((
      select jsonb_agg(to_jsonb(media_row) order by media_row.sort_order, media_row.id)
      from (
        select pm.id, pm.role, pm.sort_order, pm.alt_text, ma.delivery_object_key,
          coalesce((
            select jsonb_agg(jsonb_build_object(
              'target_width_px', variant.target_width_px,
              'width_px', variant.width_px,
              'height_px', variant.height_px,
              'delivery_object_key', variant.delivery_object_key,
              'sha256', variant.sha256,
              'byte_size', variant.byte_size,
              'mime_type', variant.mime_type,
              'profile_version', variant.profile_version
            ) order by variant.target_width_px)
            from dpg_v1.media_variants variant
            where variant.media_asset_id = ma.id
          ), '[]'::jsonb) as variants
        from dpg_v1.product_media pm
        join dpg_v1.media_assets ma on ma.id = pm.media_asset_id
        where pm.product_id = row_data.id and ma.state = 'READY'
      ) media_row
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(to_jsonb(document_row) order by document_row.sort_order, document_row.id)
      from (
        select pd.id, pd.document_type, pd.title, pd.sort_order, ma.delivery_object_key
        from dpg_v1.product_documents pd
        join dpg_v1.media_assets ma on ma.id = pd.media_asset_id
        where pd.product_id = row_data.id and pd.is_public and ma.state = 'READY'
      ) document_row
    ), '[]'::jsonb)
  )
  from dpg_v1_api.public_products row_data
  where row_data.id = p_product_id
$$;

-- dpg_backup receives only explicit SELECT on the canonical V1 tables. RLS
-- policies are also explicit because this role is deliberately non-bypassRLS.
revoke all on schema dpg_v1 from dpg_backup;
grant usage on schema dpg_v1 to dpg_backup;
revoke all on all functions in schema dpg_v1 from dpg_backup;
revoke all on table
  dpg_v1.staff_users, dpg_v1.staff_user_roles, dpg_v1.role_capabilities,
  dpg_v1.media_assets, dpg_v1.media_variants, dpg_v1.brands, dpg_v1.categories,
  dpg_v1.product_families, dpg_v1.product_family_configuration_groups,
  dpg_v1.products, dpg_v1.product_family_memberships,
  dpg_v1.product_source_provenance, dpg_v1.collections,
  dpg_v1.collection_products, dpg_v1.attribute_definitions,
  dpg_v1.attribute_options, dpg_v1.category_attribute_policies,
  dpg_v1.product_attribute_values, dpg_v1.product_attribute_multi_options,
  dpg_v1.product_media, dpg_v1.product_documents, dpg_v1.content_entries,
  dpg_v1.content_blocks, dpg_v1.content_product_references,
  dpg_v1.content_category_references, dpg_v1.content_brand_references,
  dpg_v1.quote_requests, dpg_v1.quote_request_lines, dpg_v1.quotes,
  dpg_v1.quote_lines, dpg_v1.quote_shares, dpg_v1.orders,
  dpg_v1.order_lines, dpg_v1.payment_transactions,
  dpg_v1.commerce_idempotency_records, dpg_v1.service_idempotency_records
from dpg_backup;
grant select on table
  dpg_v1.staff_users, dpg_v1.staff_user_roles, dpg_v1.role_capabilities,
  dpg_v1.media_assets, dpg_v1.media_variants, dpg_v1.brands, dpg_v1.categories,
  dpg_v1.product_families, dpg_v1.product_family_configuration_groups,
  dpg_v1.products, dpg_v1.product_family_memberships,
  dpg_v1.product_source_provenance, dpg_v1.collections,
  dpg_v1.collection_products, dpg_v1.attribute_definitions,
  dpg_v1.attribute_options, dpg_v1.category_attribute_policies,
  dpg_v1.product_attribute_values, dpg_v1.product_attribute_multi_options,
  dpg_v1.product_media, dpg_v1.product_documents, dpg_v1.content_entries,
  dpg_v1.content_blocks, dpg_v1.content_product_references,
  dpg_v1.content_category_references, dpg_v1.content_brand_references,
  dpg_v1.quote_requests, dpg_v1.quote_request_lines, dpg_v1.quotes,
  dpg_v1.quote_lines, dpg_v1.quote_shares, dpg_v1.orders,
  dpg_v1.order_lines, dpg_v1.payment_transactions,
  dpg_v1.commerce_idempotency_records, dpg_v1.service_idempotency_records
to dpg_backup;

create policy leo565_backup_staff_users_select on dpg_v1.staff_users for select to dpg_backup using (true);
create policy leo565_backup_staff_user_roles_select on dpg_v1.staff_user_roles for select to dpg_backup using (true);
create policy leo565_backup_role_capabilities_select on dpg_v1.role_capabilities for select to dpg_backup using (true);
create policy leo565_backup_media_assets_select on dpg_v1.media_assets for select to dpg_backup using (true);
create policy leo565_backup_media_variants_select on dpg_v1.media_variants for select to dpg_backup using (true);
create policy leo565_backup_brands_select on dpg_v1.brands for select to dpg_backup using (true);
create policy leo565_backup_categories_select on dpg_v1.categories for select to dpg_backup using (true);
create policy leo565_backup_product_families_select on dpg_v1.product_families for select to dpg_backup using (true);
create policy leo565_backup_product_family_groups_select on dpg_v1.product_family_configuration_groups for select to dpg_backup using (true);
create policy leo565_backup_products_select on dpg_v1.products for select to dpg_backup using (true);
create policy leo565_backup_product_family_memberships_select on dpg_v1.product_family_memberships for select to dpg_backup using (true);
create policy leo565_backup_product_provenance_select on dpg_v1.product_source_provenance for select to dpg_backup using (true);
create policy leo565_backup_collections_select on dpg_v1.collections for select to dpg_backup using (true);
create policy leo565_backup_collection_products_select on dpg_v1.collection_products for select to dpg_backup using (true);
create policy leo565_backup_attribute_definitions_select on dpg_v1.attribute_definitions for select to dpg_backup using (true);
create policy leo565_backup_attribute_options_select on dpg_v1.attribute_options for select to dpg_backup using (true);
create policy leo565_backup_category_attribute_policies_select on dpg_v1.category_attribute_policies for select to dpg_backup using (true);
create policy leo565_backup_product_attribute_values_select on dpg_v1.product_attribute_values for select to dpg_backup using (true);
create policy leo565_backup_product_attribute_multi_options_select on dpg_v1.product_attribute_multi_options for select to dpg_backup using (true);
create policy leo565_backup_product_media_select on dpg_v1.product_media for select to dpg_backup using (true);
create policy leo565_backup_product_documents_select on dpg_v1.product_documents for select to dpg_backup using (true);
create policy leo565_backup_content_entries_select on dpg_v1.content_entries for select to dpg_backup using (true);
create policy leo565_backup_content_blocks_select on dpg_v1.content_blocks for select to dpg_backup using (true);
create policy leo565_backup_content_product_references_select on dpg_v1.content_product_references for select to dpg_backup using (true);
create policy leo565_backup_content_category_references_select on dpg_v1.content_category_references for select to dpg_backup using (true);
create policy leo565_backup_content_brand_references_select on dpg_v1.content_brand_references for select to dpg_backup using (true);
create policy leo565_backup_quote_requests_select on dpg_v1.quote_requests for select to dpg_backup using (true);
create policy leo565_backup_quote_request_lines_select on dpg_v1.quote_request_lines for select to dpg_backup using (true);
create policy leo565_backup_quotes_select on dpg_v1.quotes for select to dpg_backup using (true);
create policy leo565_backup_quote_lines_select on dpg_v1.quote_lines for select to dpg_backup using (true);
create policy leo565_backup_quote_shares_select on dpg_v1.quote_shares for select to dpg_backup using (true);
create policy leo565_backup_orders_select on dpg_v1.orders for select to dpg_backup using (true);
create policy leo565_backup_order_lines_select on dpg_v1.order_lines for select to dpg_backup using (true);
create policy leo565_backup_payment_transactions_select on dpg_v1.payment_transactions for select to dpg_backup using (true);
create policy leo565_backup_commerce_idempotency_select on dpg_v1.commerce_idempotency_records for select to dpg_backup using (true);
create policy leo565_backup_service_idempotency_select on dpg_v1.service_idempotency_records for select to dpg_backup using (true);

revoke all on function dpg_v1.validate_media_asset_mutation(),
  dpg_v1.validate_media_variant_mutation(),
  dpg_v1.validate_media_provider_verification(uuid, jsonb)
from public, anon, service_role, dpg_backup;
grant execute on function dpg_v1.validate_media_provider_verification(uuid, jsonb)
to authenticated;
revoke all on function dpg_v1_api.catalogue_media_register(jsonb, text),
  dpg_v1_api.catalogue_media_mark_ready(uuid, jsonb, text),
  dpg_v1_api.catalogue_product_media_attach(uuid, uuid, dpg_v1.product_media_role, integer, text, text),
  dpg_v1_api.catalogue_product_document_attach(uuid, uuid, text, text, integer, boolean, text),
  dpg_v1_api.catalogue_media_tombstone(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function dpg_v1_api.catalogue_media_register(jsonb, text),
  dpg_v1_api.catalogue_media_mark_ready(uuid, jsonb, text),
  dpg_v1_api.catalogue_product_media_attach(uuid, uuid, dpg_v1.product_media_role, integer, text, text),
  dpg_v1_api.catalogue_product_document_attach(uuid, uuid, text, text, integer, boolean, text),
  dpg_v1_api.catalogue_media_tombstone(uuid, text)
to authenticated;
