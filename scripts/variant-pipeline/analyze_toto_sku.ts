import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const csvPath = path.join(__dirname, '../../TOTO - TOTO.csv.csv');

function main() {
  const fileContent = fs.readFileSync(csvPath, 'utf8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true });

  const suffixes = {} as Record<string, number>;

  records.forEach((row: any) => {
    const sku = row['Mã SP (SKU)'];
    if (!sku) return;

    // Look at the first part of a combo
    const mainPart = sku.split('/')[0];
    
    // Remove color code
    const baseCode = mainPart.split('#')[0];
    
    // Match the pattern: Letters + Numbers + SuffixLetters
    const match = baseCode.match(/^[A-Za-z]+[0-9]+([A-Za-z]*)$/);
    if (match && match[1]) {
      const suffix = match[1];
      suffixes[suffix] = (suffixes[suffix] || 0) + 1;
    }
  });

  console.log('\nTop Suffixes (After numbers, before # or /):');
  Object.entries(suffixes).sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(x => console.log(`  ${x[0]}: ${x[1]}`));
}

main();
