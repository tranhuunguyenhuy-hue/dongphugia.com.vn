#!/usr/bin/env node
/**
 * Dongphugia Design Token Migration Script
 * Replaces hardcoded hex colors with CSS variable references 
 * in Tailwind className strings inside TSX/TS files.
 * 
 * Usage: node scripts/migrate-hex.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DRY_RUN = process.argv.includes('--dry-run');

// ============================================
// HEX → Tailwind Arbitrary Value Mapping
// 
// Green-brand hex → AquaHome CSS variable equivalent
// Format depends on context:
//   - In Tailwind classes: text-[var(--color-primary)] or bg-[var(--color-primary)]
//   - In inline styles: var(--color-primary)
//   - We map the hex directly in all contexts
// ============================================

const HEX_MAP = {
  // === Primary Green → Blue Brand ===
  '#15803d': '#2E7A96',  // green-700 → blue-600 (primary)
  '#16a34a': '#2E7A96',  // green-600 → blue-600 (primary)
  '#22c55e': '#44A0BA',  // green-500 → blue-500
  '#166534': '#216077',  // green-800 → blue-700
  '#14532d': '#0F2E3A',  // green-900 → blue-900
  '#86efac': '#8DCDE6',  // green-300 → blue-200
  '#bbf7d0': '#C5E8F5',  // green-200 → blue-100
  '#dcfce7': '#C5E8F5',  // green-100 → blue-100
  '#d1fae5': '#C5E8F5',  // emerald-100 → blue-100
  '#f0fdf4': '#EAF6FB',  // green-50 → blue-50 (secondary bg)
  
  // === Slate/Gray Neutrals → AquaHome Neutral ===
  '#0f172a': '#192125',  // slate-900 → neutral-900
  '#111827': '#192125',  // gray-900 → neutral-900
  '#1f2937': '#263238',  // gray-800 → neutral-800
  '#374151': '#3C4E56',  // gray-700 → neutral-700
  '#4b5563': '#516A74',  // gray-600 → neutral-600
  '#6b7280': '#6A8A97',  // gray-500 → neutral-500 (muted-foreground)
  '#9ca3af': '#88A3AE',  // gray-400 → neutral-400
  '#d1d5db': '#C8D9E0',  // gray-300 → neutral-200
  '#e5e7eb': '#C8D9E0',  // gray-200 → neutral-200
  '#f3f4f6': '#E4EEF2',  // gray-100 → neutral-100
  '#f9fafb': '#F5F9FB',  // gray-50 → neutral-50
  
  // === Slate Variants ===
  '#334155': '#3C4E56',  // slate-700 → neutral-700
  '#475569': '#516A74',  // slate-600 → neutral-600
  '#64748b': '#6A8A97',  // slate-500 → neutral-500
  '#94a3b8': '#88A3AE',  // slate-400 → neutral-400
  '#cbd5e1': '#C8D9E0',  // slate-300 → neutral-200
  '#e2e8f0': '#E4EEF2',  // slate-200 → neutral-100 (border)
  '#f1f5f9': '#F5F9FB',  // slate-100 → neutral-50
  '#f8fafc': '#F5F9FB',  // slate-50 → neutral-50
  
  // === Amber/Orange → Sand ===
  '#d97706': '#D99A3F',  // amber-600 → sand-600
  '#f59e0b': '#EBBE74',  // amber-500 → sand-400
  '#fde68a': '#F7E1BB',  // amber-200 → sand-200
  '#fffbeb': '#FDF7EE',  // amber-50 → sand-50
};

// Stats
let totalReplacements = 0;
let filesModified = 0;
const changeLog = [];

function getAllFiles(dir, extensions) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip directories
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
    
    if (entry.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let original = content;
  let fileReplacements = 0;
  
  for (const [oldHex, newHex] of Object.entries(HEX_MAP)) {
    // Case-insensitive replacement
    const regex = new RegExp(escapeRegExp(oldHex), 'gi');
    const matches = content.match(regex);
    
    if (matches) {
      content = content.replace(regex, newHex);
      fileReplacements += matches.length;
    }
  }
  
  if (fileReplacements > 0) {
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, content, 'utf-8');
    }
    filesModified++;
    totalReplacements += fileReplacements;
    
    const relativePath = path.relative(process.cwd(), filePath);
    changeLog.push(`  ${relativePath}: ${fileReplacements} replacements`);
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// === MAIN ===
console.log(`\n🎨 Dongphugia Hex Migration ${DRY_RUN ? '(DRY RUN)' : ''}`);
console.log(`   Green-Brand → AquaHome (Blue/Neutral/Sand)\n`);
console.log(`   Mapping ${Object.keys(HEX_MAP).length} hex colors...\n`);

const srcDir = path.join(__dirname, '..', 'src');
const files = getAllFiles(srcDir, ['.tsx', '.ts']);

console.log(`   Found ${files.length} source files to process.\n`);

for (const file of files) {
  migrateFile(file);
}

console.log(`\n✅ Migration Complete!`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Total replacements: ${totalReplacements}`);
console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no files changed)' : 'LIVE'}\n`);

if (changeLog.length > 0) {
  console.log(`📝 Changed files:`);
  changeLog.forEach(line => console.log(line));
}

console.log('');
