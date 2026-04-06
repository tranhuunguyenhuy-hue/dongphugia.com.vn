#!/bin/bash
# =============================================================================
# LEO-366: Pre-migration data backup script
# Exports all product-related tables to CSV before destructive migration
# Usage: ./scripts/db/backup-before-migration.sh
# Requires: psql with DIRECT_URL connection string
# =============================================================================

set -euo pipefail

BACKUP_DIR="./scripts/db/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Creating backup directory: $BACKUP_DIR"

# Check for database URL
if [ -z "${DIRECT_URL:-}" ]; then
    echo "❌ Error: DIRECT_URL environment variable not set"
    echo "   Run: source .env.local (or export DIRECT_URL=...)"
    exit 1
fi

# List of tables to backup (all legacy + shared + content tables)
TABLES=(
    # Legacy product tables (will be DROPPED)
    "products"
    "product_images"
    "product_colors"
    "product_locations"
    "collections"
    "pattern_types"
    "product_categories"
    "sizes"
    "surfaces"
    "locations"
    "colors"
    "origins"
    "tbvs_products"
    "tbvs_product_images"
    "tbvs_product_types"
    "tbvs_subtypes"
    "tbvs_brands"
    "tbvs_materials"
    "tbvs_technologies"
    "tbvs_product_technologies"
    "bep_products"
    "bep_product_images"
    "bep_product_types"
    "bep_subtypes"
    "bep_brands"
    "nuoc_products"
    "nuoc_product_images"
    "nuoc_product_types"
    "nuoc_subtypes"
    "nuoc_brands"
    "nuoc_materials"
    "sango_products"
    "sango_product_images"
    "sango_product_types"
    # Preserved tables (backup for safety)
    "quote_requests"
    "banners"
    "blog_posts"
    "blog_categories"
    "blog_tags"
    "blog_post_tags"
    "partners"
    "projects"
    "redirects"
)

TOTAL=${#TABLES[@]}
SUCCESS=0
SKIPPED=0

for TABLE in "${TABLES[@]}"; do
    FILE="$BACKUP_DIR/$TABLE.csv"
    echo -n "  Exporting $TABLE... "
    
    if psql "$DIRECT_URL" -c "\COPY $TABLE TO '$FILE' WITH CSV HEADER" 2>/dev/null; then
        ROWS=$(wc -l < "$FILE")
        ROWS=$((ROWS - 1)) # subtract header
        echo "✅ ($ROWS rows)"
        SUCCESS=$((SUCCESS + 1))
    else
        echo "⚠️ skipped (table may not exist)"
        SKIPPED=$((SKIPPED + 1))
    fi
done

echo ""
echo "═══════════════════════════════════════"
echo "📊 Backup Summary"
echo "  Directory: $BACKUP_DIR"
echo "  Total: $TOTAL tables"
echo "  Success: $SUCCESS"
echo "  Skipped: $SKIPPED"
echo "═══════════════════════════════════════"
echo ""
echo "✅ Backup complete. Safe to run migration."
echo "   psql \$DIRECT_URL -f scripts/db/migration-v2-schema.sql"
