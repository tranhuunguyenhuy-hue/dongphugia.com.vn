ALTER TABLE catalog_taxons
  ADD COLUMN IF NOT EXISTS kind varchar(40) NOT NULL DEFAULT 'type',
  ADD COLUMN IF NOT EXISTS status varchar(40) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS seo_title varchar(200),
  ADD COLUMN IF NOT EXISTS seo_description varchar(500),
  ADD COLUMN IF NOT EXISTS is_indexable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_listing_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE product_taxon_assignments
  ADD COLUMN IF NOT EXISTS role varchar(40) NOT NULL DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS confidence integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE external_taxonomy_mappings
  ADD COLUMN IF NOT EXISTS source_key varchar(255),
  ADD COLUMN IF NOT EXISTS source_breadcrumb text,
  ADD COLUMN IF NOT EXISTS source_url_pattern text,
  ADD COLUMN IF NOT EXISTS confidence integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS mapping_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS reviewed boolean NOT NULL DEFAULT false;

ALTER TABLE external_taxonomy_mappings
  ALTER COLUMN source_category_slug DROP NOT NULL;

UPDATE external_taxonomy_mappings
SET source_key = COALESCE(
  NULLIF(source_key, ''),
  NULLIF(source_category_slug, ''),
  md5(COALESCE(source_category_path, source_category_name, source || ':' || id::text))
)
WHERE source_key IS NULL OR source_key = '';

ALTER TABLE external_taxonomy_mappings
  ALTER COLUMN source_key SET NOT NULL;

ALTER TABLE product_attribute_values
  ALTER COLUMN value_text TYPE text USING value_text::text;

ALTER TABLE product_attribute_values
  ADD COLUMN IF NOT EXISTS attribute_label varchar(200),
  ADD COLUMN IF NOT EXISTS confidence integer NOT NULL DEFAULT 100;

CREATE UNIQUE INDEX IF NOT EXISTS uq_external_taxonomy_mappings_source_key
  ON external_taxonomy_mappings (source, source_key);

CREATE INDEX IF NOT EXISTS idx_external_taxonomy_mappings_source_key
  ON external_taxonomy_mappings (source_key);

UPDATE catalog_taxons
SET
  kind = CASE
    WHEN parent_id IS NULL THEN 'category'
    ELSE 'type'
  END,
  status = 'active',
  is_indexable = true,
  is_listing_enabled = true,
  updated_at = now();
