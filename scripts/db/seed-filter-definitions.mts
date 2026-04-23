/**
 * C1: Seed filter_definitions cho Sen Tắm (sub=3) + Lavabo (sub=2)
 * 
 * Sen Tắm filters (từ specs keys phổ biến):
 * - Chế độ (nhiệt độ, bình thường...)
 * - Kích thước bát sen
 * - Lớp mạ (màu)
 * 
 * Lavabo filters:
 * - Hình dáng (treo tường, đặt bàn, âm bàn...)
 * - Lỗ bắt vòi (1 lỗ, 3 lỗ...)
 * - Màu sắc
 * - Chất liệu
 */
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const isDryRun = !process.argv.includes('--execute');

type FilterDef = {
  subcategory_id: number;
  filter_key: string;
  filter_label: string;
  filter_type: string;
  options: object;
  sort_order: number;
  is_active: boolean;
};

const SEN_TAM_FILTERS: FilterDef[] = [
  {
    subcategory_id: 3,
    filter_key: 'Chế độ',
    filter_label: 'Chế độ nhiệt',
    filter_type: 'checkbox',
    options: { source: 'specs', values: ['Nhiệt độ', 'Ổn nhiệt', 'Nóng lạnh', 'Thường'] },
    sort_order: 1,
    is_active: true,
  },
  {
    subcategory_id: 3,
    filter_key: 'Kích thước bát sen',
    filter_label: 'Kích thước bát sen',
    filter_type: 'checkbox',
    options: { source: 'specs', values: ['200mm', '250mm', '300mm', '400mm', '500mm'] },
    sort_order: 2,
    is_active: true,
  },
  {
    subcategory_id: 3,
    filter_key: 'Lớp mạ (màu)',
    filter_label: 'Màu mạ',
    filter_type: 'checkbox',
    options: { source: 'specs', values: ['Crom/Nikel', 'Vàng', 'Đen', 'Trắng', 'Inox'] },
    sort_order: 3,
    is_active: true,
  },
  {
    subcategory_id: 3,
    filter_key: 'Chất liệu',
    filter_label: 'Chất liệu',
    filter_type: 'checkbox',
    options: { source: 'specs', values: ['Đồng', 'Thép không gỉ', 'ABS', 'Kẽm đúc'] },
    sort_order: 4,
    is_active: true,
  },
];

const LAVABO_FILTERS: FilterDef[] = [
  {
    subcategory_id: 2,
    filter_key: 'Hình dáng',
    filter_label: 'Kiểu lắp đặt',
    filter_type: 'checkbox',
    options: { source: 'specs', values: ['Treo tường', 'Đặt bàn', 'Âm bàn', 'Đặt trên bàn', 'Bán âm', 'Chân đế'] },
    sort_order: 1,
    is_active: true,
  },
  {
    subcategory_id: 2,
    filter_key: 'Lỗ bắt vòi',
    filter_label: 'Lỗ bắt vòi',
    filter_type: 'checkbox',
    options: { source: 'specs', values: ['Không lỗ', '1 lỗ', '2 lỗ', '3 lỗ'] },
    sort_order: 2,
    is_active: true,
  },
  {
    subcategory_id: 2,
    filter_key: 'Lỗ xả tràn nước',
    filter_label: 'Xả tràn',
    filter_type: 'checkbox',
    options: { source: 'specs', values: ['Có', 'Không'] },
    sort_order: 3,
    is_active: true,
  },
  {
    subcategory_id: 2,
    filter_key: 'Màu sắc',
    filter_label: 'Màu sắc',
    filter_type: 'checkbox',
    options: { source: 'specs', values: ['Trắng', 'Trắng Trứng', 'Đen', 'Xám'] },
    sort_order: 4,
    is_active: true,
  },
  {
    subcategory_id: 2,
    filter_key: 'Chất liệu',
    filter_label: 'Chất liệu',
    filter_type: 'checkbox',
    options: { source: 'specs', values: ['Sứ', 'Đá tổng hợp', 'Thủy tinh', 'Thép không gỉ'] },
    sort_order: 5,
    is_active: true,
  },
];

async function main() {
  console.log(`\n🚀 C1: Seed filter_definitions Sen Tắm + Lavabo — Mode: ${isDryRun ? '🔍 DRY RUN' : '⚡ EXECUTE'}\n`);

  const allDefs = [...SEN_TAM_FILTERS, ...LAVABO_FILTERS];
  console.log(`📊 Filters to seed: ${allDefs.length} (${SEN_TAM_FILTERS.length} Sen Tắm + ${LAVABO_FILTERS.length} Lavabo)`);

  // Check existing
  const existing = await p.filter_definitions.count({
    where: { subcategory_id: { in: [2, 3] } }
  });
  console.log(`📊 Existing filter_definitions for sub 2,3: ${existing}`);

  if (!isDryRun) {
    for (const def of allDefs) {
      // Upsert by subcategory_id + filter_key
      const exists = await p.filter_definitions.findFirst({
        where: { subcategory_id: def.subcategory_id, filter_key: def.filter_key }
      });

      if (exists) {
        await p.filter_definitions.update({
          where: { id: exists.id },
          data: { options: def.options, is_active: true, filter_label: def.filter_label }
        });
        console.log(`  ↺ Updated: [sub=${def.subcategory_id}] ${def.filter_key}`);
      } else {
        await p.filter_definitions.create({ data: def as any });
        console.log(`  ✅ Created: [sub=${def.subcategory_id}] ${def.filter_key}`);
      }
    }
    console.log('\n✅ C1 filter_definitions seeded');
  } else {
    console.log('\n📝 Preview:');
    allDefs.forEach(d => console.log(`  [sub=${d.subcategory_id}] "${d.filter_key}" → label="${d.filter_label}"`));
    console.log(`\n💡 Run với --execute để seed ${allDefs.length} filter_definitions`);
  }
}
main().catch(e => { console.error('❌', e.message); process.exit(1); }).finally(() => p.$disconnect());
