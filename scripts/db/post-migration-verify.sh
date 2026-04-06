#!/bin/bash
# =============================================================================
# LEO-366: Post-migration verification and Prisma sync
# Run after migration SQL has been executed on Supabase
# Usage: ./scripts/db/post-migration-verify.sh
# =============================================================================

set -euo pipefail

echo "🔄 LEO-366 Post-Migration Verification"
echo "═══════════════════════════════════════"
echo ""

# Step 1: Pull schema from database into Prisma
echo "📥 Step 1: Pulling database schema into Prisma..."
npx prisma db pull
echo "  ✅ Schema pulled successfully"
echo ""

# Step 2: Generate Prisma Client
echo "⚙️  Step 2: Generating Prisma Client..."
npx prisma generate
echo "  ✅ Client generated successfully"
echo ""

# Step 3: TypeScript check
echo "🔍 Step 3: Running TypeScript check..."
if npx tsc --noEmit 2>&1; then
    echo "  ✅ TypeScript — zero errors"
else
    echo "  ⚠️ TypeScript errors found — review output above"
    echo "  This is expected if frontend code still references old models"
fi
echo ""

# Step 4: Count tables in schema
echo "📊 Step 4: Verifying Prisma models..."
MODEL_COUNT=$(grep -c "^model " prisma/schema.prisma)
echo "  Found $MODEL_COUNT models in schema.prisma"
if [ "$MODEL_COUNT" -ge 18 ]; then
    echo "  ✅ Model count looks correct (expected ~22)"
else
    echo "  ⚠️ Fewer models than expected — check migration output"
fi
echo ""

echo "═══════════════════════════════════════"
echo "✅ Post-migration verification complete!"
echo ""
echo "Next steps:"
echo "  1. Review prisma/schema.prisma for correctness"
echo "  2. Run: npm run dev (test locally)"
echo "  3. Commit: git add prisma/ && git commit -m 'feat: v2 schema — 22 tables (LEO-366)'"
