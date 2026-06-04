#!/bin/bash
cd /Users/m-ac/Projects/dongphugia/scripts/crawl-hita

echo "=== PATCH JSON ==="
node patch-json.js

echo "=== RE-RUN PHASE 4 ATMOR ==="
node 4-import-db.js --brand=atmor

echo "=== RE-RUN PHASE 4 MOEN ==="
node 4-import-db.js --brand=moen

echo "=== INVESTIGATE INAX ==="
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../../.env' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('products')
  .select('sku, hita_product_id')
  .eq('brand_id', (async () => { const { data } = await sb.from('brands').select('id').eq('slug','inax').single(); return data.id; })())
  .limit(10)
  .then(({ data }) => console.log(JSON.stringify(data, null, 2)));
"

echo "=== INVESTIGATE TOTO ==="
find ~/ -name "*.json" -path "*toto*" 2>/dev/null | head -20
find ~/ -name "urls.json" -path "*crawl*" 2>/dev/null | head -20
