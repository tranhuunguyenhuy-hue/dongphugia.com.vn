ALTER TABLE products
  ADD COLUMN IF NOT EXISTS publication_status varchar(30) NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS pdp_visibility varchar(30) NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS listing_visibility varchar(30) NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS search_visibility varchar(30) NOT NULL DEFAULT 'visible',
  ADD COLUMN IF NOT EXISTS listing_tier integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS listing_priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listing_reason varchar(50),
  ADD COLUMN IF NOT EXISTS data_quality_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sale_status varchar(40) NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS price_state varchar(40) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS list_price decimal(15, 2),
  ADD COLUMN IF NOT EXISTS sale_price decimal(15, 2),
  ADD COLUMN IF NOT EXISTS price_source varchar(40) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS price_confidence varchar(40) NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS price_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS sellable_status varchar(40) NOT NULL DEFAULT 'sellable',
  ADD COLUMN IF NOT EXISTS seo_indexing varchar(40) NOT NULL DEFAULT 'index',
  ADD COLUMN IF NOT EXISTS sitemap_include boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS canonical_product_id integer,
  ADD COLUMN IF NOT EXISTS source_system varchar(40) NOT NULL DEFAULT 'hita',
  ADD COLUMN IF NOT EXISTS source_confidence varchar(40) NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS last_crawled_at timestamptz,
  ADD COLUMN IF NOT EXISTS crawl_status varchar(40) NOT NULL DEFAULT 'fresh';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_canonical_product_id_fkey'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_canonical_product_id_fkey
      FOREIGN KEY (canonical_product_id) REFERENCES products(id)
      ON UPDATE NO ACTION ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_public_listing
  ON products (publication_status, listing_visibility, listing_tier, listing_priority DESC);

CREATE INDEX IF NOT EXISTS idx_products_search_visibility
  ON products (publication_status, search_visibility);

CREATE INDEX IF NOT EXISTS idx_products_seo
  ON products (seo_indexing, sitemap_include);

CREATE INDEX IF NOT EXISTS idx_products_sale_status
  ON products (sale_status, price_state);

CREATE INDEX IF NOT EXISTS idx_products_canonical_product
  ON products (canonical_product_id);
