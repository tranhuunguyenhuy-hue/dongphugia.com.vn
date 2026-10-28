-- Issue #160: reviewed minimal integrity parity for the 27 empty destination tables.
-- Metadata-only comparison 2026-10-28; no source/data/trigger/RLS changes.
-- Execute only after encrypted affected-state/schema checkpoint and exact target attestation.
begin;
do $empty_target$
declare item text; occupied boolean;
begin
 foreach item in array array['brands','catalog_taxons','categories','colors','external_taxonomy_mappings','filter_definitions','materials','origins','product_attribute_values','product_descriptions','product_documents','product_feature_values','product_features','product_images','product_package_items','product_relationships','product_secondary_subcategories','product_source_mappings','product_spec_values','product_sub_types','product_taxon_assignments','product_types','product_variant_groups','products','spec_definitions','spec_options','subcategories']
 loop
  execute format('select exists(select 1 from dpg_app.%I)',item) into occupied;
  if occupied then raise exception 'DIRECT_PREPARE_TARGET_NOT_EMPTY'; end if;
 end loop;
end $empty_target$;
alter table dpg_app."brands" add constraint direct_parity_0 UNIQUE (slug);
alter table dpg_app."categories" add constraint direct_parity_1 UNIQUE (slug);
alter table dpg_app."colors" add constraint direct_parity_2 UNIQUE (slug);
alter table dpg_app."materials" add constraint direct_parity_3 UNIQUE (slug);
alter table dpg_app."origins" add constraint direct_parity_4 UNIQUE (slug);
alter table dpg_app."product_descriptions" add constraint direct_parity_5 UNIQUE (product_id);
alter table dpg_app."product_descriptions" alter column "clean_issues" set not null;
alter table dpg_app."product_documents" add constraint direct_parity_7 UNIQUE (product_id, url);
alter table dpg_app."product_feature_values" add constraint direct_parity_8 UNIQUE (product_id, feature_id);
alter table dpg_app."product_features" add constraint direct_parity_9 UNIQUE (slug);
alter table dpg_app."product_package_items" add constraint direct_parity_10 UNIQUE (product_id, label);
alter table dpg_app."product_source_mappings" add constraint direct_parity_11 UNIQUE (source, source_url);
alter table dpg_app."product_spec_values" add constraint direct_parity_12 UNIQUE (product_id, spec_definition_id, option_id);
alter table dpg_app."product_sub_types" add constraint direct_parity_13 UNIQUE (product_type_id, slug);
alter table dpg_app."product_types" add constraint direct_parity_14 UNIQUE (subcategory_id, slug);
alter table dpg_app."product_variant_groups" add constraint direct_parity_15 UNIQUE (group_key);
alter table dpg_app."products" add constraint direct_parity_16 CHECK (((stock_status)::text = ANY ((ARRAY['in_stock'::character varying, 'out_of_stock'::character varying, 'discontinued'::character varying, 'contact'::character varying, 'pre_order'::character varying])::text[])));
alter table dpg_app."products" add constraint direct_parity_17 UNIQUE (category_id, slug);
alter table dpg_app."products" add constraint direct_parity_18 UNIQUE (sku);
alter table dpg_app."spec_definitions" add constraint direct_parity_19 UNIQUE (key);
alter table dpg_app."spec_options" add constraint direct_parity_20 UNIQUE (spec_definition_id, slug);
alter table dpg_app."spec_options" alter column "aliases" set not null;
alter table dpg_app."subcategories" add constraint direct_parity_22 UNIQUE (category_id, slug);
commit;
