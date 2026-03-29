const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../../prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf-8');

// 1. Add relations to product_categories
if (!schema.includes('dien_product_types  dien_product_types[]')) {
  schema = schema.replace(
    'tbvs_product_types  tbvs_product_types[]\n}',
    'tbvs_product_types  tbvs_product_types[]\n  dien_product_types  dien_product_types[]\n  khoa_product_types  khoa_product_types[]\n}'
  );
}

// 2. Extract bep_ models
const modelRegex = /\/\/\/ This model contains row level security(?:[\s\S]*?)model bep_(\w+) \{([\s\S]*?)\n\}/g;
let match;
const templates = [];

while ((match = modelRegex.exec(schema)) !== null) {
  templates.push({
    name: match[1], // e.g., brands, product_types
    body: match[2]
  });
}

if (templates.length > 0) {
  const prefixes = ['dien', 'khoa'];
  let addition = '\n';
  
  for (const prefix of prefixes) {
    if (schema.includes(`model ${prefix}_products {`)) continue;
    
    for (const t of templates) {
      let newBody = t.body
        .replace(/bep_/g, `${prefix}_`)
        .replace(/idx_bep_/g, `idx_${prefix}_`);
      
      addition += `/// This model contains row level security and requires additional setup for migrations. Visit https://pris.ly/d/row-level-security for more info.\n`;
      addition += `model ${prefix}_${t.name} {${newBody}\n}\n\n`;
    }
  }

  schema += addition;
  fs.writeFileSync(schemaPath, schema);
  console.log('Successfully injected schemas for Dien and Khoa');
} else {
  console.error('No bep_ templates found?');
}
