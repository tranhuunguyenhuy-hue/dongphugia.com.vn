ALTER TABLE product_variant_groups
ADD COLUMN IF NOT EXISTS axes jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS variant_options jsonb NOT NULL DEFAULT '[]'::jsonb;
