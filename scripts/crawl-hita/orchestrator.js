import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// As directed by Tech Lead
const brands = ['caesar', 'grohe', 'cotto', 'viglacera', 'american-standard', 'atmor', 'moen'];
let totalImages = 0;
let totalRows = 0;
let totalUpsells = 0;

for (const brand of brands) {
  console.log(`\n\n===========================================`);
  console.log(`🚀 STARTING BRAND: ${brand}`);
  console.log(`===========================================`);
  
  // Phase 3 (Skipped, already uploaded 33,740 images)
  // console.log(`\n--- Phase 3: Upload Images ---`);
  // let p3 = spawnSync('node', ['3-upload-images.js', `--brand=${brand}`], { encoding: 'utf8', cwd: __dirname });
  // console.log(p3.stdout);
  // if (p3.stderr) console.error(p3.stderr);
  
  // // Extract number using regex: "  ✅ Uploaded: ${done}"
  // let imgMatch = p3.stdout?.match(/✅ Uploaded:\s*(\d+)/);
  // if (imgMatch) totalImages += parseInt(imgMatch[1], 10);
  
  // Phase 4
  console.log(`\n--- Phase 4: Import DB ---`);
  let p4 = spawnSync('node', ['4-import-db.js', `--brand=${brand}`], { encoding: 'utf8', cwd: __dirname });
  console.log(p4.stdout);
  if (p4.stderr) console.error(p4.stderr);
  
  // Extract number using regex: "  ✅ Upserted: ${updated}"
  let rowMatch = p4.stdout.match(/✅ Upserted:\s*(\d+)/);
  if (rowMatch) totalRows += parseInt(rowMatch[1], 10);

  // Phase 5
  console.log(`\n--- Phase 5: Crawl Upsell ---`);
  let p5 = spawnSync('node', ['5-crawl-upsell.js', `--brand=${brand}`], { encoding: 'utf8', cwd: __dirname });
  console.log(p5.stdout);
  if (p5.stderr) console.error(p5.stderr);
  
  // Extract number using regex: "  🔗 Relationships inserted:    ${totalInserted}"
  let upsellMatch = p5.stdout.match(/🔗 Relationships inserted:\s*(\d+)/);
  if (upsellMatch) totalUpsells += parseInt(upsellMatch[1], 10);
}

const summary = {
  totalImages,
  totalRows,
  totalUpsells
};

const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'phase345-summary.json'), JSON.stringify(summary, null, 2));

console.log(`\n\n🎉 ALL DONE!`);
console.log(`Summary:`);
console.log(`- Images uploaded: ${totalImages}`);
console.log(`- DB rows inserted: ${totalRows}`);
console.log(`- Upsell relationships: ${totalUpsells}`);
