-- LEO-542 Phase A corrective migration: make Admin/Publishing read RPCs
-- fail closed for the wrong principal instead of returning an empty result.
-- No tables, policies, grants, roles, or authority mappings are changed.

begin;

do $$
begin
  if not exists (
    select 1 from dpg_control.target_contract
    where singleton
      and project_name = 'dongphugia-runtime'
      and region = 'ap-southeast-1'
      and environment = 'preview'
      and production_writes_allowed is false
  ) then
    raise exception 'LEO542_TARGET_CONTRACT_FAILED';
  end if;
end
$$;

create or replace function public.leo542_admin_commerce_list(p_resource text, p_limit integer default 25, p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog, dpg_app as $$
begin
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then raise exception 'INVALID_PAGINATION'; end if;
  if p_resource = 'orders' then
    if not (dpg_app.leo542_admin_can('orders:read') or dpg_app.leo542_admin_can('orders:read_assigned')) then raise exception 'FORBIDDEN'; end if;
    return coalesce((select jsonb_agg(to_jsonb(x)) from (
      select id,order_number,customer_name,customer_phone,status,payment_status,total,assigned_to,created_at,updated_at
      from dpg_app.orders order by created_at desc,id desc limit p_limit offset p_offset
    ) x),'[]'::jsonb);
  elsif p_resource = 'quotes' then
    if not (dpg_app.leo542_admin_can('quotes:read') or dpg_app.leo542_admin_can('quotes:read_assigned')) then raise exception 'FORBIDDEN'; end if;
    return coalesce((select jsonb_agg(to_jsonb(x)) from (
      select id,quote_number,name,phone,status,assigned_to,created_at,updated_at
      from dpg_app.quote_requests order by created_at desc,id desc limit p_limit offset p_offset
    ) x),'[]'::jsonb);
  elsif p_resource = 'customers' then
    if not dpg_app.leo542_admin_can('customers:read') then raise exception 'FORBIDDEN'; end if;
    return coalesce((select jsonb_agg(to_jsonb(x)) from (
      select id,full_name,phone,email,created_at,updated_at from dpg_app.customers
      order by created_at desc,id desc limit p_limit offset p_offset
    ) x),'[]'::jsonb);
  end if;
  raise exception 'INVALID_RESOURCE';
end $$;

create or replace function public.leo542_admin_commerce_get(p_resource text, p_id integer)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog, dpg_app as $$
begin
  if p_resource = 'orders' then
    if not (dpg_app.leo542_admin_can('orders:read') or dpg_app.leo542_admin_can('orders:read_assigned')) then raise exception 'FORBIDDEN'; end if;
    return (select to_jsonb(x) from (select * from dpg_app.orders where id=p_id) x);
  elsif p_resource = 'quotes' then
    if not (dpg_app.leo542_admin_can('quotes:read') or dpg_app.leo542_admin_can('quotes:read_assigned')) then raise exception 'FORBIDDEN'; end if;
    return (select to_jsonb(x) from (select * from dpg_app.quote_requests where id=p_id) x);
  elsif p_resource = 'customers' then
    if not dpg_app.leo542_admin_can('customers:read') then raise exception 'FORBIDDEN'; end if;
    return (select to_jsonb(x) from (select * from dpg_app.customers where id=p_id) x);
  end if;
  raise exception 'INVALID_RESOURCE';
end $$;

create or replace function public.leo542_admin_content_snapshot()
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog, dpg_app as $$
begin
  if not (dpg_app.leo542_admin_can('categories:read') or dpg_app.leo542_admin_can('products:read') or dpg_app.leo542_admin_can('blog:read')) then
    raise exception 'FORBIDDEN';
  end if;
  return jsonb_build_object(
    'banners',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from dpg_app.banners order by sort_order,id limit 200) x),'[]'::jsonb),
    'partners',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from dpg_app.partners order by sort_order,id limit 200) x),'[]'::jsonb),
    'projects',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from dpg_app.projects order by created_at desc,id limit 200) x),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from dpg_app.categories order by sort_order,id) x),'[]'::jsonb),
    'brands',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from dpg_app.brands order by sort_order,id) x),'[]'::jsonb),
    'taxons',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from dpg_app.catalog_taxons order by depth,sort_order,id limit 500) x),'[]'::jsonb),
    'product_types',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from dpg_app.product_types order by sort_order,id limit 300) x),'[]'::jsonb),
    'spec_definitions',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from dpg_app.spec_definitions order by sort_order,id limit 300) x),'[]'::jsonb)
  );
end $$;

create or replace function public.leo542_admin_blog_list(p_limit integer default 25,p_offset integer default 0,p_status text default null)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,dpg_app as $$
begin
  if not dpg_app.leo542_admin_can('blog:read') then raise exception 'FORBIDDEN'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
    select id,title,slug,status,version,published_at,updated_at,thumbnail_url,cover_image_url
    from dpg_app.blog_posts where p_status is null or status=p_status order by updated_at desc,id desc limit p_limit offset p_offset
  ) x);
end $$;

create or replace function public.leo542_admin_blog_get(p_post_id integer)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,dpg_app as $$
begin
  if not dpg_app.leo542_admin_can('blog:read') then raise exception 'FORBIDDEN'; end if;
  return (select to_jsonb(x) from (select * from dpg_app.blog_posts where id=p_post_id) x);
end $$;

create or replace function public.leo542_admin_product_list(p_limit integer default 25,p_offset integer default 0,p_publication_status text default null)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,dpg_app as $$
begin
  if not dpg_app.leo542_admin_can('products:read') then raise exception 'FORBIDDEN'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
    select id,sku,name,slug,publication_status,pdp_visibility,listing_visibility,search_visibility,image_main_url,version,updated_at
    from dpg_app.products where p_publication_status is null or publication_status=p_publication_status order by updated_at desc,id desc limit p_limit offset p_offset
  ) x);
end $$;

create or replace function public.leo542_admin_product_get(p_product_id integer)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,dpg_app as $$
begin
  if not dpg_app.leo542_admin_can('products:read') then raise exception 'FORBIDDEN'; end if;
  return (select to_jsonb(x) from (select * from dpg_app.products where id=p_product_id) x);
end $$;

create or replace function public.leo542_publishing_post_list(p_limit integer default 25,p_offset integer default 0,p_status text default null)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,dpg_app as $$
begin
  if not dpg_app.leo542_machine_can('posts:write') then raise exception 'FORBIDDEN'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
    select id,external_id,title,slug,status,version,published_at,updated_at from dpg_app.blog_posts
    where publishing_identity_id=(select machine_identity_id from dpg_app.leo542_actor_context()) and (p_status is null or status=p_status)
    order by updated_at desc,id desc limit p_limit offset p_offset
  )x);
end $$;

create or replace function public.leo542_publishing_post_get(p_post_id integer,p_external_id text default null)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,dpg_app as $$
begin
  if not dpg_app.leo542_machine_can('posts:write') then raise exception 'FORBIDDEN'; end if;
  return (select to_jsonb(x) from (select * from dpg_app.blog_posts where publishing_identity_id=(select machine_identity_id from dpg_app.leo542_actor_context()) and ((p_post_id is not null and id=p_post_id) or (p_external_id is not null and external_id=p_external_id)))x);
end $$;

create or replace function public.leo542_publishing_media_list(p_limit integer default 25,p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,dpg_app as $$
begin
  if not dpg_app.leo542_machine_can('media:write') then raise exception 'FORBIDDEN'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) from (
    select id,purpose,status,source_mime,source_bytes,source_sha256,primary_url,variants,created_at,updated_at
    from dpg_app.publishing_managed_media where identity_id=(select machine_identity_id from dpg_app.leo542_actor_context())
    order by created_at desc,id limit p_limit offset p_offset
  )x);
end $$;

commit;
