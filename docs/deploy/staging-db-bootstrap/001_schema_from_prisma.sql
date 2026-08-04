-- Dong Phu Gia staging database bootstrap schema
-- Generated from prisma/schema.prisma at commit 348f51a571749db8463b39b2d77cb2d42a751aaa
-- Prisma CLI: 5.22.0
-- Generation command: prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- Scope: PostgreSQL schema bootstrap for an empty Supabase staging database only.
-- Do not execute against production. Review runbook before use.

-- CreateTable
CREATE TABLE "banners" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(200),
    "image_url" VARCHAR(500) NOT NULL,
    "link_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "brand_id" INTEGER,
    "category_id" INTEGER,
    "position" VARCHAR(50) DEFAULT 'HERO',

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colors" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "hex_code" VARCHAR(7),

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "origins" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,

    CONSTRAINT "origins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "image_url" VARCHAR(1000) NOT NULL,
    "alt_text" VARCHAR(300),
    "image_type" VARCHAR(20) NOT NULL DEFAULT 'gallery',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "slug" VARCHAR(500) NOT NULL,
    "category_id" INTEGER NOT NULL,
    "subcategory_id" INTEGER,
    "brand_id" INTEGER,
    "origin_id" INTEGER,
    "color_id" INTEGER,
    "material_id" INTEGER,
    "price" DECIMAL(15,2),
    "price_display" VARCHAR(50) DEFAULT 'Liên hệ báo giá',
    "description" TEXT,
    "features" TEXT,
    "specs" JSONB NOT NULL DEFAULT '{}',
    "warranty_months" INTEGER,
    "image_main_url" VARCHAR(1000),
    "stock_status" VARCHAR(20) NOT NULL DEFAULT 'in_stock',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "source_url" VARCHAR(1000),
    "hita_product_id" VARCHAR(100),
    "seo_title" VARCHAR(200),
    "seo_description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "product_type" VARCHAR(50),
    "product_sub_type" VARCHAR(50),
    "component_skus" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "display_name" VARCHAR(500),
    "original_price" DECIMAL(15,2),
    "search_vector" tsvector,
    "is_combo" BOOLEAN NOT NULL DEFAULT false,
    "variant_group" VARCHAR(50),
    "is_promotion" BOOLEAN NOT NULL DEFAULT false,
    "online_discount_amount" DECIMAL(15,2),
    "is_master" BOOLEAN NOT NULL DEFAULT true,
    "is_home_featured" BOOLEAN NOT NULL DEFAULT false,
    "variant_type" VARCHAR(30),
    "variant_label" VARCHAR(100),
    "product_type_id" INTEGER,
    "product_sub_type_id" INTEGER,
    "variant_group_id" INTEGER,
    "variant_options" JSONB NOT NULL DEFAULT '[]',
    "publication_status" VARCHAR(30) NOT NULL DEFAULT 'public',
    "pdp_visibility" VARCHAR(30) NOT NULL DEFAULT 'public',
    "listing_visibility" VARCHAR(30) NOT NULL DEFAULT 'default',
    "search_visibility" VARCHAR(30) NOT NULL DEFAULT 'visible',
    "listing_tier" INTEGER NOT NULL DEFAULT 2,
    "listing_priority" INTEGER NOT NULL DEFAULT 0,
    "listing_reason" VARCHAR(50),
    "data_quality_score" INTEGER NOT NULL DEFAULT 0,
    "sale_status" VARCHAR(40) NOT NULL DEFAULT 'available',
    "price_state" VARCHAR(40) NOT NULL DEFAULT 'unknown',
    "list_price" DECIMAL(15,2),
    "sale_price" DECIMAL(15,2),
    "price_source" VARCHAR(40) NOT NULL DEFAULT 'unknown',
    "price_confidence" VARCHAR(40) NOT NULL DEFAULT 'medium',
    "price_updated_at" TIMESTAMPTZ(6),
    "sellable_status" VARCHAR(40) NOT NULL DEFAULT 'sellable',
    "seo_indexing" VARCHAR(40) NOT NULL DEFAULT 'index',
    "sitemap_include" BOOLEAN NOT NULL DEFAULT true,
    "canonical_product_id" INTEGER,
    "source_system" VARCHAR(40) NOT NULL DEFAULT 'hita',
    "source_confidence" VARCHAR(40) NOT NULL DEFAULT 'medium',
    "last_crawled_at" TIMESTAMPTZ(6),
    "crawl_status" VARCHAR(40) NOT NULL DEFAULT 'fresh',

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_relationships" (
    "id" SERIAL NOT NULL,
    "parent_id" INTEGER NOT NULL,
    "child_sku" VARCHAR(200) NOT NULL,
    "child_id" INTEGER,
    "relationship_type" VARCHAR(50) NOT NULL DEFAULT 'component',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "component_type" VARCHAR(30) NOT NULL DEFAULT 'component',
    "quantity" INTEGER,
    "resolution_status" VARCHAR(30) NOT NULL DEFAULT 'unresolved',
    "source" VARCHAR(50),

    CONSTRAINT "product_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redirects" (
    "id" SERIAL NOT NULL,
    "old_url" VARCHAR(500) NOT NULL,
    "new_url" VARCHAR(500) NOT NULL,
    "status_code" INTEGER DEFAULT 301,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_requests" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(200),
    "message" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quote_number" VARCHAR(30),
    "admin_notes" TEXT,
    "customer_id" INTEGER,
    "shipping_fee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "vat_rate" INTEGER NOT NULL DEFAULT 10,
    "assigned_to" INTEGER,

    CONSTRAINT "quote_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" SERIAL NOT NULL,
    "quote_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "admin_quantity" INTEGER,
    "admin_unit_price" DECIMAL(15,2),

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(200),
    "source" VARCHAR(50) DEFAULT 'MANUAL',
    "notes" TEXT,
    "last_interacted_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "thumbnail_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "seo_title" VARCHAR(200),
    "seo_description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_post_tags" (
    "post_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "blog_post_tags_pkey" PRIMARY KEY ("post_id","tag_id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "slug" VARCHAR(300) NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL DEFAULT '',
    "category_id" INTEGER NOT NULL,
    "thumbnail_url" TEXT,
    "cover_image_url" TEXT,
    "seo_title" VARCHAR(200),
    "seo_description" VARCHAR(500),
    "seo_keywords" VARCHAR(500),
    "reading_time" INTEGER,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ(6),
    "author_name" VARCHAR(100) NOT NULL DEFAULT 'Đông Phú Gia',
    "author_avatar" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_tags" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "post_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blog_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "logo_url" VARCHAR(500),
    "description" TEXT,
    "tier" VARCHAR(50) DEFAULT 'Vàng',
    "gradient_class" VARCHAR(100),
    "link_url" VARCHAR(500),
    "is_active" BOOLEAN DEFAULT true,
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "location" VARCHAR(200),
    "thumbnail_url" VARCHAR(500),
    "description" TEXT,
    "category" VARCHAR(100),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_featured" BOOLEAN DEFAULT false,
    "is_active" BOOLEAN DEFAULT true,
    "sort_order" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "logo_url" VARCHAR(1000),
    "description" TEXT,
    "origin_country" VARCHAR(100),
    "website_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "thumbnail_url" VARCHAR(1000),
    "icon_name" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "seo_title" VARCHAR(200),
    "seo_description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "banner_url" VARCHAR(1000),

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filter_definitions" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER,
    "subcategory_id" INTEGER,
    "filter_key" VARCHAR(100) NOT NULL,
    "filter_label" VARCHAR(200) NOT NULL,
    "filter_type" VARCHAR(50) NOT NULL DEFAULT 'select',
    "options" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "product_type_id" INTEGER,
    "spec_definition_id" INTEGER,

    CONSTRAINT "filter_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "product_name" VARCHAR(500) NOT NULL,
    "product_sku" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "total_price" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "order_number" VARCHAR(20) NOT NULL,
    "customer_name" VARCHAR(200) NOT NULL,
    "customer_phone" VARCHAR(20) NOT NULL,
    "customer_email" VARCHAR(200),
    "customer_address" TEXT,
    "note" TEXT,
    "subtotal" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "shipping_fee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
    "payment_method" VARCHAR(50),
    "payment_status" VARCHAR(30) NOT NULL DEFAULT 'unpaid',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "vat_rate" INTEGER NOT NULL DEFAULT 0,
    "assigned_at" TIMESTAMPTZ(6),
    "assigned_to" INTEGER,
    "internal_note" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_feature_values" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "feature_id" INTEGER NOT NULL,
    "value" VARCHAR(500),

    CONSTRAINT "product_feature_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_taxons" (
    "id" SERIAL NOT NULL,
    "parent_id" INTEGER,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "canonical_path" VARCHAR(500) NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" VARCHAR(40) NOT NULL DEFAULT 'type',
    "status" VARCHAR(40) NOT NULL DEFAULT 'active',
    "seo_title" VARCHAR(200),
    "seo_description" VARCHAR(500),
    "is_indexable" BOOLEAN NOT NULL DEFAULT true,
    "is_listing_enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "catalog_taxons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_taxon_assignments" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "taxon_id" INTEGER NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "source" VARCHAR(40) NOT NULL DEFAULT 'manual',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" VARCHAR(40) NOT NULL DEFAULT 'primary',
    "confidence" INTEGER NOT NULL DEFAULT 100,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "product_taxon_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_taxonomy_mappings" (
    "id" SERIAL NOT NULL,
    "source" VARCHAR(40) NOT NULL,
    "source_category_slug" VARCHAR(255),
    "source_category_name" VARCHAR(255),
    "source_category_path" VARCHAR(1000),
    "taxon_id" INTEGER,
    "mapping_type" VARCHAR(40) NOT NULL DEFAULT 'taxon',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_key" VARCHAR(255) NOT NULL,
    "source_breadcrumb" TEXT,
    "source_url_pattern" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 100,
    "mapping_rule" JSONB NOT NULL DEFAULT '{}',
    "reviewed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "external_taxonomy_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_attribute_values" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "taxon_id" INTEGER,
    "attribute_key" VARCHAR(120) NOT NULL,
    "value_text" TEXT NOT NULL,
    "value_slug" VARCHAR(120) NOT NULL,
    "source" VARCHAR(40) NOT NULL DEFAULT 'manual',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attribute_label" VARCHAR(200),
    "confidence" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "product_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_features" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "icon_name" VARCHAR(50),
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcategories" (
    "id" SERIAL NOT NULL,
    "category_id" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "thumbnail_url" VARCHAR(1000),
    "hero_image_url" VARCHAR(1000),
    "icon_name" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "seo_title" VARCHAR(200),
    "seo_description" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_secondary_subcategories" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "subcategory_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_secondary_subcategories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'sale',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "avatar_url" VARCHAR(500),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "username" VARCHAR(100),

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" INTEGER,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_import_decisions" (
    "id" SERIAL NOT NULL,
    "crawl_snapshot_id" INTEGER NOT NULL,
    "target_product_id" INTEGER,
    "decision" VARCHAR(40) NOT NULL DEFAULT 'needs_review',
    "reason" VARCHAR(200),
    "taxonomy_confidence" VARCHAR(20),
    "price_confidence" VARCHAR(20),
    "media_confidence" VARCHAR(20),
    "specs_confidence" VARCHAR(20),
    "reviewer_id" INTEGER,
    "reviewed_at" TIMESTAMPTZ(6),
    "import_payload" JSONB,
    "import_result" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_import_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_product_snapshots" (
    "id" SERIAL NOT NULL,
    "crawl_run_id" INTEGER NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "source_url" VARCHAR(1000) NOT NULL,
    "source_product_id" VARCHAR(100),
    "brand_slug" VARCHAR(100),
    "sku" VARCHAR(200),
    "raw_payload" JSONB NOT NULL,
    "normalized_payload" JSONB,
    "content_hash" VARCHAR(100),
    "status" VARCHAR(30) NOT NULL DEFAULT 'crawled',
    "skipped_reason" VARCHAR(100),
    "qa_flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_product_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawl_runs" (
    "id" SERIAL NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "brand_slug" VARCHAR(100),
    "status" VARCHAR(30) NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "input" JSONB NOT NULL DEFAULT '{}',
    "summary" JSONB NOT NULL DEFAULT '{}',
    "created_by" INTEGER,

    CONSTRAINT "crawl_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_descriptions" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "raw_html" TEXT,
    "clean_html" TEXT,
    "clean_issues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" VARCHAR(50) NOT NULL DEFAULT 'manual',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_descriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_documents" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "source_url" VARCHAR(1000),
    "document_type" VARCHAR(30) NOT NULL DEFAULT 'DOCUMENT',
    "file_ext" VARCHAR(20),
    "file_size" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_package_items" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "label" VARCHAR(300) NOT NULL,
    "child_sku" VARCHAR(200),
    "child_id" INTEGER,
    "component_type" VARCHAR(50) NOT NULL DEFAULT 'included_item',
    "quantity" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "resolution_status" VARCHAR(30) NOT NULL DEFAULT 'unresolved',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_source_mappings" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER,
    "source" VARCHAR(50) NOT NULL,
    "source_product_id" VARCHAR(100),
    "source_url" VARCHAR(1000) NOT NULL,
    "sku" VARCHAR(200),
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_crawl_run_id" INTEGER,
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',

    CONSTRAINT "product_source_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_spec_values" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "spec_definition_id" INTEGER NOT NULL,
    "option_id" INTEGER,
    "value_text" VARCHAR(500),
    "value_number" DECIMAL(15,4),
    "value_json" JSONB,
    "raw_key" VARCHAR(200),
    "raw_value" TEXT,
    "source" VARCHAR(50) NOT NULL DEFAULT 'manual',
    "confidence" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_spec_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_sub_types" (
    "id" SERIAL NOT NULL,
    "product_type_id" INTEGER NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_sub_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_types" (
    "id" SERIAL NOT NULL,
    "subcategory_id" INTEGER NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "filter_policy" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant_groups" (
    "id" SERIAL NOT NULL,
    "group_key" VARCHAR(100) NOT NULL,
    "base_sku" VARCHAR(100),
    "variant_type" VARCHAR(50) NOT NULL,
    "label" VARCHAR(200),
    "source" VARCHAR(50) NOT NULL DEFAULT 'manual',
    "confidence" VARCHAR(20) NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "axes" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "product_variant_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spec_definitions" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "data_type" VARCHAR(30) NOT NULL DEFAULT 'text',
    "unit" VARCHAR(30),
    "is_filterable" BOOLEAN NOT NULL DEFAULT false,
    "is_pdp_visible" BOOLEAN NOT NULL DEFAULT true,
    "is_reserved" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "normalize_rule" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spec_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spec_options" (
    "id" SERIAL NOT NULL,
    "spec_definition_id" INTEGER NOT NULL,
    "value" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "spec_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "colors_slug_key" ON "colors"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "origins_slug_key" ON "origins"("slug");

-- CreateIndex
CREATE INDEX "idx_product_images_product" ON "product_images"("product_id");

-- CreateIndex
CREATE INDEX "idx_product_images_type" ON "product_images"("image_type");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "idx_products_active" ON "products"("is_active");

-- CreateIndex
CREATE INDEX "idx_products_promotion" ON "products"("is_promotion");

-- CreateIndex
CREATE INDEX "idx_products_canonical_product" ON "products"("canonical_product_id");

-- CreateIndex
CREATE INDEX "idx_products_brand" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "idx_products_category" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "idx_products_created" ON "products"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_products_featured" ON "products"("is_featured");

-- CreateIndex
CREATE INDEX "idx_products_home_featured" ON "products"("is_home_featured");

-- CreateIndex
CREATE INDEX "idx_products_hita_id" ON "products"("hita_product_id");

-- CreateIndex
CREATE INDEX "idx_products_sort" ON "products"("sort_order");

-- CreateIndex
CREATE INDEX "idx_products_specs" ON "products" USING GIN ("specs");

-- CreateIndex
CREATE INDEX "idx_products_subcategory" ON "products"("subcategory_id");

-- CreateIndex
CREATE INDEX "idx_products_sub_type_active" ON "products"("subcategory_id", "product_type");

-- CreateIndex
CREATE INDEX "idx_products_product_type" ON "products"("product_type");

-- CreateIndex
CREATE INDEX "idx_products_is_combo" ON "products"("is_combo");

-- CreateIndex
CREATE INDEX "idx_products_variant_group" ON "products"("variant_group");

-- CreateIndex
CREATE INDEX "idx_products_public_listing" ON "products"("publication_status", "listing_visibility", "listing_tier", "listing_priority" DESC);

-- CreateIndex
CREATE INDEX "idx_products_search_visibility" ON "products"("publication_status", "search_visibility");

-- CreateIndex
CREATE INDEX "idx_products_seo" ON "products"("seo_indexing", "sitemap_include");

-- CreateIndex
CREATE INDEX "idx_products_sale_status" ON "products"("sale_status", "price_state");

-- CreateIndex
CREATE INDEX "idx_products_product_sub_type_id" ON "products"("product_sub_type_id");

-- CreateIndex
CREATE INDEX "idx_products_product_type_id" ON "products"("product_type_id");

-- CreateIndex
CREATE INDEX "idx_products_sub_typeid_active" ON "products"("subcategory_id", "product_type_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_products_subtypeid_active" ON "products"("product_sub_type_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_products_variant_group_id" ON "products"("variant_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_category_id_slug_key" ON "products"("category_id", "slug");

-- CreateIndex
CREATE INDEX "idx_prel_parent" ON "product_relationships"("parent_id");

-- CreateIndex
CREATE INDEX "idx_prel_child" ON "product_relationships"("child_id");

-- CreateIndex
CREATE INDEX "idx_prel_child_sku" ON "product_relationships"("child_sku");

-- CreateIndex
CREATE INDEX "idx_prel_component_type" ON "product_relationships"("component_type");

-- CreateIndex
CREATE INDEX "idx_prel_resolution_status" ON "product_relationships"("resolution_status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_rel" ON "product_relationships"("parent_id", "child_sku", "relationship_type");

-- CreateIndex
CREATE UNIQUE INDEX "redirects_old_url_key" ON "redirects"("old_url");

-- CreateIndex
CREATE UNIQUE INDEX "quote_requests_quote_number_key" ON "quote_requests"("quote_number");

-- CreateIndex
CREATE INDEX "idx_quote_requests_number" ON "quote_requests"("quote_number");

-- CreateIndex
CREATE INDEX "idx_quote_requests_created" ON "quote_requests"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_quote_requests_status" ON "quote_requests"("status");

-- CreateIndex
CREATE INDEX "idx_quote_requests_phone" ON "quote_requests"("phone");

-- CreateIndex
CREATE INDEX "idx_quote_requests_customer" ON "quote_requests"("customer_id");

-- CreateIndex
CREATE INDEX "idx_quote_requests_assigned" ON "quote_requests"("assigned_to");

-- CreateIndex
CREATE INDEX "idx_quote_items_quote" ON "quote_items"("quote_id");

-- CreateIndex
CREATE INDEX "idx_quote_items_product" ON "quote_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "idx_customers_phone" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "idx_customers_interaction" ON "customers"("last_interacted_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "blog_categories"("slug");

-- CreateIndex
CREATE INDEX "idx_blog_categories_slug" ON "blog_categories"("slug");

-- CreateIndex
CREATE INDEX "idx_blog_post_tags_post" ON "blog_post_tags"("post_id");

-- CreateIndex
CREATE INDEX "idx_blog_post_tags_tag" ON "blog_post_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "idx_blog_posts_category" ON "blog_posts"("category_id");

-- CreateIndex
CREATE INDEX "idx_blog_posts_featured" ON "blog_posts"("is_featured");

-- CreateIndex
CREATE INDEX "idx_blog_posts_published" ON "blog_posts"("published_at");

-- CreateIndex
CREATE INDEX "idx_blog_posts_slug" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "idx_blog_posts_status" ON "blog_posts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "blog_tags_slug_key" ON "blog_tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "partners_slug_key" ON "partners"("slug");

-- CreateIndex
CREATE INDEX "idx_partners_active" ON "partners"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "idx_projects_active" ON "projects"("is_active");

-- CreateIndex
CREATE INDEX "idx_projects_featured" ON "projects"("is_featured");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE INDEX "idx_brands_active" ON "brands"("is_active");

-- CreateIndex
CREATE INDEX "idx_brands_featured" ON "brands"("is_featured");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "idx_categories_active" ON "categories"("is_active");

-- CreateIndex
CREATE INDEX "idx_filter_def_category" ON "filter_definitions"("category_id");

-- CreateIndex
CREATE INDEX "idx_filter_def_subcategory" ON "filter_definitions"("subcategory_id");

-- CreateIndex
CREATE INDEX "idx_filter_def_product_type" ON "filter_definitions"("product_type_id");

-- CreateIndex
CREATE INDEX "idx_filter_def_spec_definition" ON "filter_definitions"("spec_definition_id");

-- CreateIndex
CREATE INDEX "idx_filter_def_sub_active_sort" ON "filter_definitions"("subcategory_id", "is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "materials_slug_key" ON "materials"("slug");

-- CreateIndex
CREATE INDEX "idx_order_items_order" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "idx_order_items_product" ON "order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "idx_orders_created" ON "orders"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_orders_number" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "idx_orders_payment" ON "orders"("payment_status");

-- CreateIndex
CREATE INDEX "idx_orders_status" ON "orders"("status");

-- CreateIndex
CREATE INDEX "idx_orders_assigned" ON "orders"("assigned_to");

-- CreateIndex
CREATE INDEX "idx_pfv_feature" ON "product_feature_values"("feature_id");

-- CreateIndex
CREATE INDEX "idx_pfv_product" ON "product_feature_values"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_feature_values_product_id_feature_id_key" ON "product_feature_values"("product_id", "feature_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_catalog_taxons_canonical_path" ON "catalog_taxons"("canonical_path");

-- CreateIndex
CREATE INDEX "idx_catalog_taxons_parent" ON "catalog_taxons"("parent_id");

-- CreateIndex
CREATE INDEX "idx_catalog_taxons_slug" ON "catalog_taxons"("slug");

-- CreateIndex
CREATE INDEX "idx_catalog_taxons_active" ON "catalog_taxons"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_catalog_taxons_parent_slug" ON "catalog_taxons"("parent_id", "slug");

-- CreateIndex
CREATE INDEX "idx_product_taxon_assignments_taxon" ON "product_taxon_assignments"("taxon_id");

-- CreateIndex
CREATE INDEX "idx_product_taxon_assignments_product" ON "product_taxon_assignments"("product_id");

-- CreateIndex
CREATE INDEX "idx_product_taxon_assignments_source" ON "product_taxon_assignments"("source");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_taxon_assignments_product_taxon" ON "product_taxon_assignments"("product_id", "taxon_id");

-- CreateIndex
CREATE INDEX "idx_external_taxonomy_mappings_source" ON "external_taxonomy_mappings"("source");

-- CreateIndex
CREATE INDEX "idx_external_taxonomy_mappings_source_category_slug" ON "external_taxonomy_mappings"("source_category_slug");

-- CreateIndex
CREATE INDEX "idx_external_taxonomy_mappings_taxon" ON "external_taxonomy_mappings"("taxon_id");

-- CreateIndex
CREATE INDEX "idx_external_taxonomy_mappings_source_key" ON "external_taxonomy_mappings"("source_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_external_taxonomy_mappings_source_slug" ON "external_taxonomy_mappings"("source", "source_category_slug");

-- CreateIndex
CREATE UNIQUE INDEX "uq_external_taxonomy_mappings_source_key" ON "external_taxonomy_mappings"("source", "source_key");

-- CreateIndex
CREATE INDEX "idx_product_attribute_values_product" ON "product_attribute_values"("product_id");

-- CreateIndex
CREATE INDEX "idx_product_attribute_values_taxon" ON "product_attribute_values"("taxon_id");

-- CreateIndex
CREATE INDEX "idx_product_attribute_values_key_value" ON "product_attribute_values"("attribute_key", "value_slug");

-- CreateIndex
CREATE INDEX "idx_product_attribute_values_source" ON "product_attribute_values"("source");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_attribute_values_product_key_value" ON "product_attribute_values"("product_id", "attribute_key", "value_slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_features_slug_key" ON "product_features"("slug");

-- CreateIndex
CREATE INDEX "idx_subcategories_active" ON "subcategories"("is_active");

-- CreateIndex
CREATE INDEX "idx_subcategories_category" ON "subcategories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "subcategories_category_id_slug_key" ON "subcategories"("category_id", "slug");

-- CreateIndex
CREATE INDEX "idx_prod_sec_subcat_product" ON "product_secondary_subcategories"("product_id");

-- CreateIndex
CREATE INDEX "idx_prod_sec_subcat_subcat" ON "product_secondary_subcategories"("subcategory_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_secondary_subcategories_product_id_subcategory_id_key" ON "product_secondary_subcategories"("product_id", "subcategory_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_key" ON "admin_users"("username");

-- CreateIndex
CREATE INDEX "idx_admin_users_email" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "idx_admin_users_role" ON "admin_users"("role");

-- CreateIndex
CREATE INDEX "idx_admin_users_active" ON "admin_users"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "idx_admin_sessions_token" ON "admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "idx_admin_sessions_user" ON "admin_sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_admin_sessions_expires" ON "admin_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs_user" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_created" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_logs_action" ON "audit_logs"("action");

-- CreateIndex
CREATE UNIQUE INDEX "crawl_import_decisions_crawl_snapshot_id_key" ON "crawl_import_decisions"("crawl_snapshot_id");

-- CreateIndex
CREATE INDEX "idx_crawl_import_decisions_decision" ON "crawl_import_decisions"("decision");

-- CreateIndex
CREATE INDEX "idx_crawl_import_decisions_target" ON "crawl_import_decisions"("target_product_id");

-- CreateIndex
CREATE INDEX "idx_crawl_snapshots_run" ON "crawl_product_snapshots"("crawl_run_id");

-- CreateIndex
CREATE INDEX "idx_crawl_snapshots_sku" ON "crawl_product_snapshots"("sku");

-- CreateIndex
CREATE INDEX "idx_crawl_snapshots_source_product" ON "crawl_product_snapshots"("source_product_id");

-- CreateIndex
CREATE INDEX "idx_crawl_snapshots_status" ON "crawl_product_snapshots"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_crawl_snapshots_source_url_run" ON "crawl_product_snapshots"("source", "source_url", "crawl_run_id");

-- CreateIndex
CREATE INDEX "idx_crawl_runs_source_brand" ON "crawl_runs"("source", "brand_slug");

-- CreateIndex
CREATE INDEX "idx_crawl_runs_started" ON "crawl_runs"("started_at");

-- CreateIndex
CREATE INDEX "idx_crawl_runs_status" ON "crawl_runs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "product_descriptions_product_id_key" ON "product_descriptions"("product_id");

-- CreateIndex
CREATE INDEX "idx_product_descriptions_source" ON "product_descriptions"("source");

-- CreateIndex
CREATE INDEX "idx_product_documents_product" ON "product_documents"("product_id");

-- CreateIndex
CREATE INDEX "idx_product_documents_type" ON "product_documents"("document_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_documents_product_url" ON "product_documents"("product_id", "url");

-- CreateIndex
CREATE INDEX "idx_product_package_items_child" ON "product_package_items"("child_id");

-- CreateIndex
CREATE INDEX "idx_product_package_items_child_sku" ON "product_package_items"("child_sku");

-- CreateIndex
CREATE INDEX "idx_product_package_items_product" ON "product_package_items"("product_id");

-- CreateIndex
CREATE INDEX "idx_product_package_items_resolution" ON "product_package_items"("resolution_status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_package_items_product_label" ON "product_package_items"("product_id", "label");

-- CreateIndex
CREATE INDEX "idx_product_source_mappings_product" ON "product_source_mappings"("product_id");

-- CreateIndex
CREATE INDEX "idx_product_source_mappings_sku" ON "product_source_mappings"("sku");

-- CreateIndex
CREATE INDEX "idx_product_source_mappings_source_product" ON "product_source_mappings"("source", "source_product_id");

-- CreateIndex
CREATE INDEX "idx_product_source_mappings_status" ON "product_source_mappings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_source_mappings_source_url" ON "product_source_mappings"("source", "source_url");

-- CreateIndex
CREATE INDEX "idx_product_spec_values_definition_option" ON "product_spec_values"("spec_definition_id", "option_id");

-- CreateIndex
CREATE INDEX "idx_product_spec_values_definition_text" ON "product_spec_values"("spec_definition_id", "value_text");

-- CreateIndex
CREATE INDEX "idx_product_spec_values_product" ON "product_spec_values"("product_id");

-- CreateIndex
CREATE INDEX "idx_product_spec_values_source" ON "product_spec_values"("source");

-- CreateIndex
CREATE INDEX "idx_product_spec_values_text" ON "product_spec_values"("value_text");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_spec_option" ON "product_spec_values"("product_id", "spec_definition_id", "option_id");

-- CreateIndex
CREATE INDEX "idx_product_sub_types_active" ON "product_sub_types"("is_active");

-- CreateIndex
CREATE INDEX "idx_product_sub_types_type" ON "product_sub_types"("product_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_sub_types_type_slug" ON "product_sub_types"("product_type_id", "slug");

-- CreateIndex
CREATE INDEX "idx_product_types_active" ON "product_types"("is_active");

-- CreateIndex
CREATE INDEX "idx_product_types_subcategory" ON "product_types"("subcategory_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_types_sub_slug" ON "product_types"("subcategory_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_groups_group_key_key" ON "product_variant_groups"("group_key");

-- CreateIndex
CREATE INDEX "idx_product_variant_groups_base_sku" ON "product_variant_groups"("base_sku");

-- CreateIndex
CREATE INDEX "idx_product_variant_groups_type" ON "product_variant_groups"("variant_type");

-- CreateIndex
CREATE UNIQUE INDEX "spec_definitions_key_key" ON "spec_definitions"("key");

-- CreateIndex
CREATE INDEX "idx_spec_definitions_filterable" ON "spec_definitions"("is_filterable");

-- CreateIndex
CREATE INDEX "idx_spec_definitions_pdp_visible" ON "spec_definitions"("is_pdp_visible");

-- CreateIndex
CREATE INDEX "idx_spec_options_active" ON "spec_options"("is_active");

-- CreateIndex
CREATE INDEX "idx_spec_options_definition" ON "spec_options"("spec_definition_id");

-- CreateIndex
CREATE INDEX "idx_spec_options_definition_value" ON "spec_options"("spec_definition_id", "value");

-- CreateIndex
CREATE UNIQUE INDEX "uq_spec_options_definition_slug" ON "spec_options"("spec_definition_id", "slug");

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "banners" ADD CONSTRAINT "banners_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_canonical_product_id_fkey" FOREIGN KEY ("canonical_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "colors"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_origin_id_fkey" FOREIGN KEY ("origin_id") REFERENCES "origins"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_product_sub_type_id_fkey" FOREIGN KEY ("product_sub_type_id") REFERENCES "product_sub_types"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_variant_group_id_fkey" FOREIGN KEY ("variant_group_id") REFERENCES "product_variant_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_relationships" ADD CONSTRAINT "product_relationships_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_relationships" ADD CONSTRAINT "product_relationships_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "blog_post_tags" ADD CONSTRAINT "blog_post_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "blog_tags"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "blog_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "filter_definitions" ADD CONSTRAINT "filter_definitions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "filter_definitions" ADD CONSTRAINT "filter_definitions_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "filter_definitions" ADD CONSTRAINT "filter_definitions_spec_definition_id_fkey" FOREIGN KEY ("spec_definition_id") REFERENCES "spec_definitions"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "filter_definitions" ADD CONSTRAINT "filter_definitions_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_feature_values" ADD CONSTRAINT "product_feature_values_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "product_features"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_feature_values" ADD CONSTRAINT "product_feature_values_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "catalog_taxons" ADD CONSTRAINT "catalog_taxons_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "catalog_taxons"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_taxon_assignments" ADD CONSTRAINT "product_taxon_assignments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_taxon_assignments" ADD CONSTRAINT "product_taxon_assignments_taxon_id_fkey" FOREIGN KEY ("taxon_id") REFERENCES "catalog_taxons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "external_taxonomy_mappings" ADD CONSTRAINT "external_taxonomy_mappings_taxon_id_fkey" FOREIGN KEY ("taxon_id") REFERENCES "catalog_taxons"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_taxon_id_fkey" FOREIGN KEY ("taxon_id") REFERENCES "catalog_taxons"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subcategories" ADD CONSTRAINT "subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_secondary_subcategories" ADD CONSTRAINT "product_secondary_subcategories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_secondary_subcategories" ADD CONSTRAINT "product_secondary_subcategories_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_import_decisions" ADD CONSTRAINT "crawl_import_decisions_crawl_snapshot_id_fkey" FOREIGN KEY ("crawl_snapshot_id") REFERENCES "crawl_product_snapshots"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "crawl_import_decisions" ADD CONSTRAINT "crawl_import_decisions_target_product_id_fkey" FOREIGN KEY ("target_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "crawl_product_snapshots" ADD CONSTRAINT "crawl_product_snapshots_crawl_run_id_fkey" FOREIGN KEY ("crawl_run_id") REFERENCES "crawl_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_descriptions" ADD CONSTRAINT "product_descriptions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_documents" ADD CONSTRAINT "product_documents_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_package_items" ADD CONSTRAINT "product_package_items_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_package_items" ADD CONSTRAINT "product_package_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_source_mappings" ADD CONSTRAINT "product_source_mappings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_spec_values" ADD CONSTRAINT "product_spec_values_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "spec_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_spec_values" ADD CONSTRAINT "product_spec_values_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_spec_values" ADD CONSTRAINT "product_spec_values_spec_definition_id_fkey" FOREIGN KEY ("spec_definition_id") REFERENCES "spec_definitions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_sub_types" ADD CONSTRAINT "product_sub_types_product_type_id_fkey" FOREIGN KEY ("product_type_id") REFERENCES "product_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "product_types" ADD CONSTRAINT "product_types_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "spec_options" ADD CONSTRAINT "spec_options_spec_definition_id_fkey" FOREIGN KEY ("spec_definition_id") REFERENCES "spec_definitions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

