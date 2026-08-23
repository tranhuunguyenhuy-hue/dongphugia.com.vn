-- R5 Quote Item snapshot contract.
-- Additive and compatibility-safe: existing rows are not backfilled.

ALTER TABLE "quote_items"
  ADD COLUMN IF NOT EXISTS "product_sku_snapshot" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "product_name_snapshot" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "commerce_mode_snapshot" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "availability_snapshot" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "list_price_snapshot" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "sale_price_snapshot" DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS "snapshot_at" TIMESTAMPTZ;

ALTER TABLE "quote_items"
  ALTER COLUMN "product_id" DROP NOT NULL;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE t.relname = 'quote_items'
      AND c.contype = 'f'
      AND a.attname = 'product_id'
  LOOP
    EXECUTE format('ALTER TABLE "quote_items" DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE "quote_items"
  ADD CONSTRAINT "quote_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

ALTER TABLE "quote_items"
  ADD CONSTRAINT "quote_items_snapshot_complete_check"
  CHECK (
    "snapshot_at" IS NULL
    OR (
      "product_sku_snapshot" IS NOT NULL
      AND "product_name_snapshot" IS NOT NULL
      AND "commerce_mode_snapshot" IS NOT NULL
      AND "commerce_mode_snapshot" IN ('PUBLIC_PRICE', 'CONTACT_FOR_QUOTE')
      AND "availability_snapshot" IS NOT NULL
      AND "availability_snapshot" IN ('InStock', 'PreOrder', 'QuoteOnly', 'Discontinued')
    )
  );
