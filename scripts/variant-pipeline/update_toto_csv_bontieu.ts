import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.join(__dirname, '../../TOTO - TOTO.csv.csv');

function main() {
  const updates: Record<string, { old: string, newGroup: string }> = {
    'USWN900A#XW/HHF90603': { old: 'USWN900A', newGroup: 'USWN900' },
    'USWN900AE#XW/HHF90603': { old: 'USWN900AE', newGroup: 'USWN900' },
    'USWN900AS#XW/HHF90603': { old: 'USWN900AS', newGroup: 'USWN900' },
    'USWN902AEV#XW': { old: 'USWN902AEV', newGroup: 'USWN902' },
    'USWN902ASV#XW': { old: 'USWN902ASV', newGroup: 'USWN902' },
    'USWN925AEV#XW': { old: 'USWN925AEV', newGroup: 'USWN925' },
    'UT904HN#XW': { old: 'UT904HN', newGroup: 'UT904' },
    'UT904HR#XW': { old: 'UT904HR', newGroup: 'UT904' },
    'UT904N#W': { old: 'UT904N', newGroup: 'UT904' },
    'UT904R#XW': { old: 'UT904R', newGroup: 'UT904' },
    'UT447HR#W': { old: 'UT447HR', newGroup: 'UT447' },
    'UT447S#W': { old: 'UT447S', newGroup: 'UT447' }
  };

  const fileContent = fs.readFileSync(csvPath, 'utf8');
  const lines = fileContent.split('\n');
  
  let modifiedCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    for (const [sku, info] of Object.entries(updates)) {
      if (line.includes(`"${sku}"`) || line.includes(`${sku},`)) {
        // Need to replace the old group with the new group
        if (line.includes(`"${info.old}"`)) {
          lines[i] = line.replace(`"${info.old}"`, `"${info.newGroup}"`);
          modifiedCount++;
          console.log(`Updated CSV for ${sku} to ${info.newGroup}`);
        } else if (line.includes(`,${info.old},`)) {
          lines[i] = line.replace(`,${info.old},`, `,${info.newGroup},`);
          modifiedCount++;
          console.log(`Updated CSV for ${sku} to ${info.newGroup}`);
        }
      }
    }
  }

  if (modifiedCount > 0) {
    fs.writeFileSync(csvPath, lines.join('\n'), 'utf8');
    console.log(`\n✅ Đã cập nhật thành công ${modifiedCount} dòng trong file TOTO - TOTO.csv.csv!`);
  } else {
    console.log(`\n⚠️ Không tìm thấy dòng nào để cập nhật trong CSV.`);
  }
}

main();
