/**
 * Variant Data Pipeline — Shared Utilities
 *
 * Core functions for:
 * - Parsing combo SKUs across all brands/patterns
 * - Detecting component types (body, lid, shower_head, etc.)
 * - Generating standardized SEO-friendly names
 */

// ──────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────

export type ComponentType =
  | 'body'        // Thân bồn cầu, chậu lavabo, bồn tắm
  | 'lid'         // Nắp bồn cầu (cơ, điện tử)
  | 'basin'       // Chậu lavabo
  | 'pedestal'    // Chân chậu lavabo
  | 'cabinet'     // Tủ lavabo
  | 'frame'       // Khung treo tường (Duravit)
  | 'flush_plate' // Nút xả (Duravit)
  | 'shower_head' // Bát sen / tay sen
  | 'mixer'       // Vòi sen / mixer
  | 'valve'       // Van điều chỉnh
  | 'rail'        // Thanh trượt sen
  | 'drain'       // Bộ xả
  | 'faucet'      // Vòi chậu
  | 'holder'      // Giá đỡ
  | 'hose'        // Dây sen
  | 'color'       // Color variant (Am.Standard EasySet)
  | 'component';  // Fallback

export interface ParsedComponent {
  sku: string;
  type: ComponentType;
  label: string; // Human-readable label
}

export interface ParsedCombo {
  isCombo: boolean;
  variantGroup: string | null;
  displayModel?: string; // Full model code for naming (e.g., MS855DT3) — different from variantGroup (MS855)
  components: ParsedComponent[];
  comboType: 'plus' | 'slash' | 'hash' | 'space' | 'color' | 'none';
}

// ──────────────────────────────────────────
// TOTO SUFFIX → LID MAPPING (Bồn Cầu)
// ──────────────────────────────────────────

export const TOTO_LID_SUFFIX_MAP: Record<string, { lid: string; label: string }> = {
  // DT/RT/GT = đóng êm (nắp thường) — D=đất, R=ra tường, G=gắn tường
  'DT2':   { lid: 'TC393VS',       label: 'nắp đóng êm TC393VS' },
  'DT3':   { lid: 'TC385VS',       label: 'nắp đóng êm TC385VS' },
  'DT8':   { lid: 'TC600VS',       label: 'nắp đóng êm TC600VS' },
  'RT2':   { lid: 'TC393VS',       label: 'nắp đóng êm TC393VS' },
  'RT3':   { lid: 'TC385VS',       label: 'nắp đóng êm TC385VS' },
  'RT8':   { lid: 'TC600VS',       label: 'nắp đóng êm TC600VS' },
  'GT2':   { lid: 'TC393VS',       label: 'nắp đóng êm TC393VS' },
  'GT3':   { lid: 'TC385VS',       label: 'nắp đóng êm TC385VS' },
  'GT8':   { lid: 'TC600VS',       label: 'nắp đóng êm TC600VS' },
  // N-prefix variants (body sub-variant: DN, RN, etc.)
  'NT2':   { lid: 'TC393VS',       label: 'nắp đóng êm TC393VS' },
  'NT3':   { lid: 'TC385VS',       label: 'nắp đóng êm TC385VS' },
  'NT8':   { lid: 'TC600VS',       label: 'nắp đóng êm TC600VS' },
  // DE/RE/GE/NE = nắp rửa cơ
  'DE2':   { lid: 'TCW07S',        label: 'nắp rửa cơ TCW07S' },
  'DE4':   { lid: 'TCW1211A',      label: 'nắp rửa cơ TCW1211A' },
  'RE2':   { lid: 'TCW07S',        label: 'nắp rửa cơ TCW07S' },
  'RE4':   { lid: 'TCW1211A',      label: 'nắp rửa cơ TCW1211A' },
  'GE2':   { lid: 'TCW07S',        label: 'nắp rửa cơ TCW07S' },
  'GE4':   { lid: 'TCW1211A',      label: 'nắp rửa cơ TCW1211A' },
  'NE2':   { lid: 'TCW07S',        label: 'nắp rửa cơ TCW07S' },
  'NE4':   { lid: 'TCW1211A',      label: 'nắp rửa cơ TCW1211A' },
  // DW/RW/GW/NW = Washlet (nắp điện tử)
  'DW11':  { lid: 'TCF4911Z',      label: 'nắp điện tử Washlet S7 TCF4911Z' },
  'RW11':  { lid: 'TCF4911Z',      label: 'nắp điện tử Washlet S7 TCF4911Z' },
  'GW11':  { lid: 'TCF4911Z',      label: 'nắp điện tử Washlet S7 TCF4911Z' },
  'NW11':  { lid: 'TCF4911Z',      label: 'nắp điện tử Washlet S7 TCF4911Z' },
  // CDW/CRW/CGW/CNW = Washlet giấu dây (single body prefix)
  'CDW12': { lid: 'TCF4911EZ',     label: 'nắp điện tử Washlet S7 TCF4911EZ giấu dây' },
  'CRW12': { lid: 'TCF4911EZ',     label: 'nắp điện tử Washlet S7 TCF4911EZ giấu dây' },
  'CGW12': { lid: 'TCF4911EZ',     label: 'nắp điện tử Washlet S7 TCF4911EZ giấu dây' },
  'CNW12': { lid: 'TCF4911EZ',     label: 'nắp điện tử Washlet S7 TCF4911EZ giấu dây' },
  // Compound body prefix + Washlet giấu dây (e.g., CS769CDRW12 = C+DR+W12)
  'CDRW12': { lid: 'TCF4911EZ',    label: 'nắp điện tử Washlet S7 TCF4911EZ giấu dây' },
  'CGRW12': { lid: 'TCF4911EZ',    label: 'nắp điện tử Washlet S7 TCF4911EZ giấu dây' },
  // DRW = Washlet (dual prefix)
  'DRW12': { lid: 'TCF4911EZ',     label: 'nắp điện tử Washlet S7 TCF4911EZ giấu dây' },
  'DRW14': { lid: 'TCF24410AAA',   label: 'nắp điện tử Washlet C5 TCF24410AAA' },
};

// ──────────────────────────────────────────
// INAX LID → DESCRIPTIVE LABEL MAPPING
// ──────────────────────────────────────────

export const INAX_LID_LABEL_MAP: Record<string, string> = {
  // Nắp điện tử
  'CW-H17VN': 'nắp điện tử CW-H17VN',
  'CW-H18VN': 'nắp điện tử CW-H18VN',
  'CW-KA22AVN': 'nắp điện tử CW-KA22AVN',
  'CW-KB22AVN': 'nắp điện tử CW-KB22AVN',
  // Nắp rửa cơ
  'CW-S15VN': 'nắp rửa cơ CW-S15VN',
  'CW-S32VN': 'nắp rửa cơ CW-S32VN',
  'CW-S32VN-1': 'nắp rửa cơ CW-S32VN-1',
};

// ──────────────────────────────────────────
// TOTO SEN TẮM PREFIX → COMPONENT TYPE
// ──────────────────────────────────────────

export const TOTO_SHOWER_PREFIX_MAP: Record<string, ComponentType> = {
  'DM':    'body',         // Cây sen
  'DBX':   'body',         // Bộ sen
  'DB':    'body',         // Bộ sen
  'DM9':   'body',         // Cây sen cao cấp
  'TBS':   'mixer',        // Vòi sen
  'TBG':   'mixer',        // Vòi sen
  'TVSM':  'mixer',        // Vòi sen (thermo mixer)
  'TBV':   'valve',        // Van
  'TBN':   'valve',        // Van
  'TBP':   'valve',        // Van
  'TBJ':   'rail',         // Thanh trượt
  'DGH':   'shower_head',  // Bát sen
  'TBW':   'shower_head',  // Bát sen / tay sen
};

// ──────────────────────────────────────────
// CORE FUNCTIONS
// ──────────────────────────────────────────

/**
 * Parse a product SKU and determine if it's a combo, what components it has,
 * and what variant group it belongs to.
 */
export function parseComboSKU(
  sku: string,
  brandSlug: string,
  productName: string,
  subcategorySlug: string
): ParsedCombo {
  // 1. PLUS pattern: "AC-959A+CW-S15VN/BW1" (INAX, Caesar, MOEN, Duravit, ATMOR)
  if (sku.includes('+')) {
    return parsePlusCombo(sku, brandSlug, subcategorySlug);
  }

  // 2. TOTO hash-only: "MS855DT3#XW" (Bồn Cầu only)
  if (brandSlug === 'toto' && subcategorySlug === 'bon-cau' && sku.includes('#') && !sku.includes('/')) {
    return parseTotoHashCombo(sku, productName);
  }

  // 3. SLASH pattern: "CW542HME5U#NW1/TCF794CZ#NW1" (TOTO multi-category)
  if (brandSlug === 'toto' && sku.includes('/')) {
    return parseTotoSlashCombo(sku, subcategorySlug);
  }

  // 4. Caesar slash: "SH110/50211MCW" (Sen Tắm)
  if (brandSlug === 'caesar' && sku.includes('/') && subcategorySlug === 'sen-tam') {
    return parseCaesarSlashCombo(sku);
  }

  // 5. Viglacera space+parens: 'VI66 (NAP V1102)' (Bồn Cầu)
  if (brandSlug === 'viglacera' && /\(NAP\s/i.test(sku)) {
    return parseViglaceraCombo(sku);
  }

  // 6. American Standard EasySet color variant
  if (brandSlug === 'american-standard' && sku.startsWith('EasySet')) {
    return parseEasySetColor(sku);
  }

  // Not a combo
  return { isCombo: false, variantGroup: null, components: [], comboType: 'none' };
}

/**
 * Parse "+" delimited combos (INAX, Caesar, MOEN, Duravit, ATMOR, COTTO)
 */
function parsePlusCombo(sku: string, brandSlug: string, subcategorySlug: string): ParsedCombo {
  // Strip color suffix like /BW1, /WT
  const cleanSku = sku.replace(/\/[A-Z0-9]+$/, '');
  const parts = cleanSku.split('+').map(p => p.trim());

  const components: ParsedComponent[] = parts.map((part, i) => {
    const type = detectPlusComponentType(part, i, brandSlug, subcategorySlug);
    // Enrich label for INAX lids using descriptive mapping
    let label = part;
    if (type === 'lid' && INAX_LID_LABEL_MAP[part]) {
      label = INAX_LID_LABEL_MAP[part];
    }
    return { sku: part, type, label };
  });

  // Variant group = first component (body)
  const variantGroup = components[0]?.sku || null;

  return {
    isCombo: true,
    variantGroup,
    components,
    comboType: 'plus',
  };
}

/**
 * Parse TOTO hash-only: "MS855DT3#XW"
 * Body = MS855, suffix = DT3 → lid = TC385VS
 */
function parseTotoHashCombo(sku: string, productName: string): ParsedCombo {
  // Strip color code: MS855DT3#XW → MS855DT3
  const skuBase = sku.replace(/#.*$/, '');

  // Try to match a known suffix from our mapping table
  // Sort suffixes by length descending so longer ones match first (CDW12 before DW11)
  const sortedSuffixes = Object.keys(TOTO_LID_SUFFIX_MAP).sort((a, b) => b.length - a.length);

  let bodyPart = '';
  let lidInfo: { lid: string; label: string } | null = null;

  for (const suffix of sortedSuffixes) {
    if (skuBase.endsWith(suffix)) {
      bodyPart = skuBase.slice(0, -suffix.length);
      lidInfo = TOTO_LID_SUFFIX_MAP[suffix];
      break;
    }
  }

  // If no suffix matched, try extracting lid from product name
  if (!bodyPart) {
    const baseMatch = skuBase.match(/^([A-Z]+\d+)/);
    bodyPart = baseMatch ? baseMatch[1] : skuBase;

    const tcMatch = productName.match(/(TC\w+|TCW\w+|TCF\w+)/i);
    if (tcMatch) {
      lidInfo = { lid: tcMatch[1], label: `nắp ${tcMatch[1]}` };
    }
  }

  // If still no body, check name for lid references
  if (!bodyPart) {
    const hasLid = /nắp|Washlet|TCW|TCF/i.test(productName);
    return { isCombo: hasLid, variantGroup: null, components: [], comboType: hasLid ? 'hash' : 'none' };
  }

  const components: ParsedComponent[] = [
    { sku: bodyPart, type: 'body', label: bodyPart },
  ];

  if (lidInfo) {
    components.push({ sku: lidInfo.lid, type: 'lid', label: lidInfo.label });
  }

  return {
    isCombo: true,
    variantGroup: bodyPart,
    displayModel: skuBase, // Full model: MS855DT3, CS767RT2, etc.
    components,
    comboType: 'hash',
  };
}

/**
 * Parse TOTO slash: "CW542HME5U#NW1/TCF794CZ#NW1/WH172AT/MB175M#SS"
 */
function parseTotoSlashCombo(sku: string, subcategorySlug: string): ParsedCombo {
  const parts = sku.split('/').map(p => p.replace(/#.*$/, '').trim());

  const components: ParsedComponent[] = parts.map((part, i) => ({
    sku: part,
    type: detectTotoComponentType(part, i, subcategorySlug),
    label: part,
  }));

  // Variant group = body component
  const body = components.find(c => c.type === 'body');
  const variantGroup = body?.sku || parts[0];

  return {
    isCombo: true,
    variantGroup,
    components,
    comboType: 'slash',
  };
}

/**
 * Parse Caesar slash Sen Tắm: "SH110/50211MCW"
 */
function parseCaesarSlashCombo(sku: string): ParsedCombo {
  const parts = sku.split('/').map(p => p.trim());
  const components: ParsedComponent[] = parts.map((part, i) => ({
    sku: part,
    type: i === 0 ? 'shower_head' : 'hose',
    label: part,
  }));

  return {
    isCombo: true,
    variantGroup: parts[0],
    components,
    comboType: 'slash',
  };
}

/**
 * Parse Viglacera: "VI66 (NAP V1102)"
 */
function parseViglaceraCombo(sku: string): ParsedCombo {
  const match = sku.match(/^(\S+)\s*\(NAP\s+(\S+)\)/i);
  if (!match) return { isCombo: false, variantGroup: null, components: [], comboType: 'none' };

  return {
    isCombo: true,
    variantGroup: match[1],
    components: [
      { sku: match[1], type: 'body', label: match[1] },
      { sku: match[2], type: 'lid', label: `nắp ${match[2]}` },
    ],
    comboType: 'space',
  };
}

/**
 * Parse American Standard EasySet color variant
 */
function parseEasySetColor(sku: string): ParsedCombo {
  const parts = sku.split(' - ');
  const model = parts[0].trim();   // "EasySet Enjoyment"
  const color = parts[1]?.trim();  // "Matte Black"

  return {
    isCombo: false, // Color variant, NOT a combo
    variantGroup: model,
    components: [
      { sku: sku, type: 'color', label: color || 'Default' },
    ],
    comboType: 'color',
  };
}

// ──────────────────────────────────────────
// COMPONENT TYPE DETECTION
// ──────────────────────────────────────────

/**
 * Detect component type for plus-delimited SKU parts
 */
function detectPlusComponentType(
  sku: string,
  index: number,
  brandSlug: string,
  subcategorySlug: string
): ComponentType {
  const upper = sku.toUpperCase();

  // Bồn Cầu patterns
  if (subcategorySlug === 'bon-cau') {
    if (index === 0) return 'body';
    if (/^CW-?S?\d/i.test(sku)) return 'lid';     // INAX: CW-S15VN
    if (/^TAF|^SB-/i.test(sku)) return 'lid';      // Caesar: TAF050, SB-1250
    if (/^TC\d/i.test(sku)) return 'lid';           // TOTO: TC393VS
    if (/^TCW|^TCF/i.test(sku)) return 'lid';       // TOTO: TCW07S, TCF4911Z
    if (/^WD\d|^WH\d/i.test(sku)) return 'frame';  // Duravit: WD10, WH172
    if (/^00\d{4}/i.test(sku)) return 'flush_plate';// Duravit: 002090
    return 'lid'; // Default for second part in bon-cau
  }

  // Sen Tắm patterns
  if (subcategorySlug === 'sen-tam') {
    if (index === 0) return 'body';
    if (/^T\d{5}/i.test(sku)) return 'shower_head'; // MOEN: T57140
    if (/^\d{6}/i.test(sku)) return 'valve';         // MOEN: 120067
    if (/^S\d{3}/i.test(sku)) return 'shower_head';  // Caesar: S393C
    if (/^BS\d/i.test(sku)) return 'rail';           // Caesar: BS124
    return 'component';
  }

  // Lavabo patterns
  if (subcategorySlug === 'lavabo') {
    if (index === 0) return 'basin';
    if (/^EH|^P\d/i.test(sku)) return 'pedestal';    // Caesar/INAX: EH05024ASV
    if (/^PB-/i.test(sku)) return 'cabinet';
    return 'pedestal';
  }

  return index === 0 ? 'body' : 'component';
}

/**
 * Detect TOTO component type from SKU prefix
 */
function detectTotoComponentType(
  sku: string,
  index: number,
  subcategorySlug: string
): ComponentType {
  const upper = sku.toUpperCase();

  // Bồn Cầu
  if (subcategorySlug === 'bon-cau') {
    if (/^CW\d/i.test(sku)) return index === 0 ? 'body' : 'body';
    if (/^TCF/i.test(sku)) return 'lid';
    if (/^TC\d/i.test(sku)) return 'lid';
    if (/^WH/i.test(sku)) return 'frame';
    if (/^MB/i.test(sku)) return 'flush_plate';
    if (index === 0) return 'body';
    return 'component';
  }

  // Sen Tắm
  if (subcategorySlug === 'sen-tam') {
    if (/^DM|^DBX|^DB\d/i.test(sku)) return 'body';
    if (/^TBS|^TBG/i.test(sku)) return 'mixer';
    if (/^DGH|^TBW/i.test(sku)) return 'shower_head';
    if (/^TBN|^TBV|^TBP/i.test(sku)) return 'valve';
    if (/^TBJ/i.test(sku)) return 'rail';
    if (index === 0) return 'body';
    return 'component';
  }

  // Lavabo
  if (subcategorySlug === 'lavabo') {
    if (/^LW|^L\d/i.test(sku)) return 'basin';
    if (/^TL\d/i.test(sku)) return 'faucet';
    if (/^T\d{3}/i.test(sku)) return 'holder';
    if (/^TX/i.test(sku)) return 'drain';
    if (index === 0) return 'basin';
    return 'component';
  }

  // Bồn Tắm
  if (subcategorySlug === 'bon-tam') {
    if (/^PAY|^PJY|^PPY|^P\w{2}\d/i.test(sku)) return 'body';
    if (/^TBN/i.test(sku)) return 'drain';
    if (/^TBG|^TBS/i.test(sku)) return 'faucet';
    if (index === 0) return 'body';
    return 'component';
  }

  // Vòi Chậu
  if (subcategorySlug === 'voi-chau') {
    if (/^TLG|^TLS|^TL\d/i.test(sku)) return 'faucet';
    if (/^TX|^T\d/i.test(sku)) return 'drain';
    if (index === 0) return 'faucet';
    return 'component';
  }

  return index === 0 ? 'body' : 'component';
}

// ──────────────────────────────────────────
// NAME GENERATION (SEO-OPTIMIZED)
// ──────────────────────────────────────────

/**
 * Extract product type from existing name
 * e.g., "Bồn cầu 1 khối INAX AC-959A..." → "Bồn cầu 1 khối"
 */
export function extractProductType(name: string): string {
  // Common prefixes to extract — order matters (longer/more specific first)
  const patterns = [
    /^(Bộ bồn cầu xổm)/i,
    /^(Bộ bồn cầu(?:\s+\d\s+khối|\s+treo tường|\s+liền khối)?)/i,
    /^(Bồn cầu(?:\s+\d\s+khối|\s+treo tường|\s+liền khối)?)/i,
    // Sen Tắm — capture full type including "nóng lạnh", "đứng", etc.
    /^(Sen tắm cây đứng(?:\s+nóng lạnh)?)/i,
    /^(Sen cây tắm đứng(?:\s+nóng lạnh)?)/i,
    /^(Bộ sen cây(?:\s+tắm)?(?:\s+đứng)?(?:\s+nóng lạnh)?)/i,
    /^(Bộ sen tắm(?:\s+cây)?(?:\s+đứng)?(?:\s+nóng lạnh)?)/i,
    /^(Bộ sen âm(?:\s+tường)?(?:\s+nhiệt độ)?(?:\s+nóng lạnh)?(?:\s+\d\s+đường)?)/i,
    /^(Sen cây(?:\s+tắm)?(?:\s+đứng)?(?:\s+nóng lạnh)?)/i,
    /^(Bộ vòi sen(?:\s+cây)?(?:\s+âm tường)?(?:\s+nóng lạnh)?)/i,
    /^(Vòi sen cây(?:\s+nóng lạnh)?)/i,
    /^(Tay sen)/i,
    /^(Bộ sen(?:\s+tay)?)/i,
    // Lavabo — more specific patterns first
    /^(Tủ chậu(?:\s+cabinet)?(?:\s+treo)?)/i,
    /^(Chậu(?:\s+rửa(?:\s+mặt)?)?\s+lavabo(?:\s+treo tường|\s+đặt bàn|\s+âm bàn|\s+dương vành|\s+bán âm)?)/i,
    /^(Chậu lavabo(?:\s+treo tường)?)/i,
    /^(Chậu treo tường)/i,
    /^(Chậu rửa(?:\s+mặt)?(?:\s+lavabo)?)/i,
    // Others
    // Bathtub — specific patterns first
    /^(Bồn tắm(?:\s+massage)?(?:\s+yếm|\s+đặt sàn|\s+nằm|\s+đứng|\s+góc)?)/i,
    /^(Vòi(?:\s+xả)?\s+bồn tắm(?:\s+nằm)?(?:\s+nóng lạnh)?(?:\s+đặt sàn)?)/i,
    /^(Bộ vòi bồn tắm(?:\s+đặt sàn)?)/i,
    // Urinal
    /^(Bồn tiểu(?:\s+nam)?(?:\s+treo tường|\s+đặt sàn)?(?:\s+cảm ứng)?)/i,
    /^(Van xả(?:\s+tiểu nam)?(?:\s+cảm ứng)?)/i,
    // PKBC
    /^(Trụ(?:\s+xả|\s+cấp)?)/i,
    // Others
    /^(Bộ vòi(?:\s+chậu|\s+sen)?)/i,
    /^(Vòi(?:\s+chậu|\s+rửa)?)/i,
  ];

  let productType = '';
  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      productType = match[1].trim();
      break;
    }
  }

  if (!productType) {
    productType = name.split(/\s+/).slice(0, 3).join(' ');
  }

  // If the type doesn't already include toilet subtype, search the full name
  // TOTO names often have format: "Bồn cầu TOTO {SKU} 2 khối nắp..."
  if (/^Bồn cầu$/i.test(productType) || /^Bộ bồn cầu$/i.test(productType)) {
    const subtypeMatch = name.match(/(\d\s+khối|treo tường|liền khối)/i);
    if (subtypeMatch) {
      productType = `${productType} ${subtypeMatch[1]}`;
    }
  }

  return productType;
}

/**
 * Generate standardized SEO-friendly name for a combo product
 *
 * Pattern: "{type} {Brand} {body} kèm {component_description}"
 */
export function generateStandardName(
  productType: string,
  brandName: string,
  components: ParsedComponent[],
  displayModel?: string,
): string {
  const body = components.find(c => c.type === 'body' || c.type === 'basin');
  const accessories = components.filter(c => c.type !== 'body' && c.type !== 'basin');

  // Use displayModel (full SKU base like MS855DT3) if available, otherwise body.sku
  const modelName = displayModel || body?.sku || components.map(c => c.sku).join(' ');

  if (!body || accessories.length === 0) {
    return `${productType} ${brandName} ${modelName}`;
  }

  // Build rich accessory description with Vietnamese type prefixes
  const accessoryDesc = accessories.map(c => formatComponentLabel(c)).join(', ');

  return `${productType} ${brandName} ${modelName} kèm ${accessoryDesc}`;
}

/**
 * Format a component with human-readable Vietnamese prefix
 */
function formatComponentLabel(comp: ParsedComponent): string {
  // If label already has a rich description (from TOTO_LID_SUFFIX_MAP), use it
  if (comp.label !== comp.sku) return comp.label;

  // Otherwise add type prefix
  const prefixMap: Partial<Record<ComponentType, string>> = {
    lid: 'nắp',
    basin: 'chậu',
    pedestal: 'chân',
    cabinet: 'tủ',
    frame: 'khung treo',
    flush_plate: 'nút xả',
    shower_head: 'bát sen',
    mixer: 'vòi sen',
    valve: 'van',
    rail: 'thanh trượt',
    drain: 'bộ xả',
    faucet: 'vòi',
    holder: 'giá đỡ',
    hose: 'dây sen',
  };

  const prefix = prefixMap[comp.type];
  return prefix ? `${prefix} ${comp.sku}` : comp.sku;
}

/**
 * Generate a URL-safe slug from a product name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
