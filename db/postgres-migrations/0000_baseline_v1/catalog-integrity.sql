-- PostgreSQL Baseline v1: catalog integrity overlay.
-- This layer is disposable-only until a separate Production adoption gate.

-- Approved R0 integrity rules.
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_taxon_assignments_primary_product
  ON product_taxon_assignments (product_id)
  WHERE is_primary IS TRUE;

-- One filter definition key per subcategory; NULL subcategories remain global.
CREATE UNIQUE INDEX IF NOT EXISTS uq_filter_def_subcat
  ON filter_definitions (subcategory_id, filter_key);
