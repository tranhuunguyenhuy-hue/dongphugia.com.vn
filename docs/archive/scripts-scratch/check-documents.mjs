/**
 * check-documents.mjs
 * Analyze products with attached documents (PDFs) from TOTO crawl
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  PHÂN TÍCH TÀI LIỆU ĐÍNH KÈM (PDF) - SẢN PHẨM TOTO')
  console.log('═══════════════════════════════════════════════════════════════')

  // Use raw SQL to find products with documents key in specs
  const productsWithDocs = await prisma.$queryRaw`
    SELECT 
      p.id, p.sku, p.name, p.specs, p.product_type, p.source_url, p.brand_id,
      s.name as subcat_name, s.slug as subcat_slug,
      c.name as cat_name,
      b.name as brand_name
    FROM products p
    LEFT JOIN subcategories s ON p.subcategory_id = s.id
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.specs ? 'documents'
    ORDER BY p.id
  `

  console.log(`\n📊 Tổng sản phẩm có key "documents" trong specs: ${productsWithDocs.length}`)

  // Filter non-empty documents
  const withNonEmptyDocs = productsWithDocs.filter(p => {
    const docs = p.specs?.documents
    if (!docs) return false
    if (Array.isArray(docs)) return docs.length > 0
    if (typeof docs === 'string') return docs.trim().length > 0
    if (typeof docs === 'object') return Object.keys(docs).length > 0
    return false
  })

  const withEmptyDocs = productsWithDocs.length - withNonEmptyDocs.length

  console.log(`✅ Có tài liệu thực tế (non-empty): ${withNonEmptyDocs.length}`)
  console.log(`❌ Có key nhưng rỗng: ${withEmptyDocs}`)

  // Analyze document structure
  let totalDocLinks = 0
  const docTitles = {}
  const subcatCounts = {}
  const urlDomains = {}
  const sampleDocs = []
  let pdfCount = 0
  let nonPdfCount = 0

  for (const p of withNonEmptyDocs) {
    const docs = p.specs.documents
    const subName = p.subcat_name || 'N/A'
    subcatCounts[subName] = (subcatCounts[subName] || 0) + 1

    if (Array.isArray(docs)) {
      totalDocLinks += docs.length
      for (const doc of docs) {
        if (typeof doc === 'object' && doc !== null) {
          const title = doc.title || doc.name || 'untitled'
          docTitles[title] = (docTitles[title] || 0) + 1
          
          const url = doc.url || doc.link || doc.href || ''
          if (url) {
            if (url.toLowerCase().includes('.pdf')) pdfCount++
            else nonPdfCount++
            try {
              const domain = new URL(url).hostname
              urlDomains[domain] = (urlDomains[domain] || 0) + 1
            } catch {
              urlDomains['invalid-url'] = (urlDomains['invalid-url'] || 0) + 1
            }
          }
        } else if (typeof doc === 'string') {
          if (doc.toLowerCase().includes('.pdf')) pdfCount++
          else nonPdfCount++
          try {
            const domain = new URL(doc).hostname
            urlDomains[domain] = (urlDomains[domain] || 0) + 1
          } catch {}
        }
      }
      
      if (sampleDocs.length < 10) {
        sampleDocs.push({
          sku: p.sku,
          name: p.name.substring(0, 70),
          brand: p.brand_name,
          subcat: subName,
          docCount: docs.length,
          docs: docs.slice(0, 5),
        })
      }
    } else if (typeof docs === 'string') {
      totalDocLinks++
      if (docs.toLowerCase().includes('.pdf')) pdfCount++
      else nonPdfCount++
    } else if (typeof docs === 'object') {
      const keys = Object.keys(docs)
      totalDocLinks += keys.length
    }
  }

  // Summary
  console.log(`\n📄 Tổng số link tài liệu: ${totalDocLinks}`)
  console.log(`📈 Trung bình tài liệu/SP: ${withNonEmptyDocs.length > 0 ? (totalDocLinks / withNonEmptyDocs.length).toFixed(1) : 0}`)
  console.log(`📎 PDF files: ${pdfCount}`)
  console.log(`🔗 Non-PDF: ${nonPdfCount}`)

  // By subcategory
  console.log('\n── Phân bố theo danh mục con ──')
  const sortedSubcats = Object.entries(subcatCounts).sort((a, b) => b[1] - a[1])
  for (const [name, count] of sortedSubcats) {
    console.log(`  ${name}: ${count} SP`)
  }

  // Document titles
  if (Object.keys(docTitles).length > 0) {
    console.log('\n── Loại tài liệu (theo title) — Top 30 ──')
    const sortedTypes = Object.entries(docTitles).sort((a, b) => b[1] - a[1])
    for (const [type, count] of sortedTypes.slice(0, 30)) {
      console.log(`  "${type}": ${count}`)
    }
    if (sortedTypes.length > 30) {
      console.log(`  ... và ${sortedTypes.length - 30} loại khác`)
    }
  }

  // URL domains
  if (Object.keys(urlDomains).length > 0) {
    console.log('\n── Nguồn tài liệu (domain) ──')
    const sortedDomains = Object.entries(urlDomains).sort((a, b) => b[1] - a[1])
    for (const [domain, count] of sortedDomains) {
      console.log(`  ${domain}: ${count} links`)
    }
  }

  // Samples
  console.log('\n── 10 Mẫu đại diện ──')
  for (const s of sampleDocs) {
    console.log(`\n  SKU: ${s.sku} [${s.brand}]`)
    console.log(`  Tên: ${s.name}`)
    console.log(`  Danh mục: ${s.subcat}`)
    console.log(`  Số tài liệu: ${s.docCount}`)
    for (const d of s.docs) {
      if (typeof d === 'object') {
        console.log(`    📄 "${d.title || d.name || '?'}" → ${(d.url || d.link || '?').substring(0, 100)}`)
      } else {
        console.log(`    📄 ${String(d).substring(0, 120)}`)
      }
    }
  }

  // Non-TOTO with documents
  const totoBrand = await prisma.brands.findFirst({ where: { slug: 'toto' } })
  const nonTotoDocs = withNonEmptyDocs.filter(p => p.brand_name !== 'TOTO')
  console.log(`\n── SP không phải TOTO có documents: ${nonTotoDocs.length} ──`)
  for (const p of nonTotoDocs.slice(0, 5)) {
    console.log(`  ${p.sku} [${p.brand_name}] — ${p.name.substring(0, 50)}`)
  }

  // TOTO without documents
  const totoTotal = await prisma.products.count({ where: { brand_id: totoBrand?.id } })
  const totoWithDocs = withNonEmptyDocs.filter(p => p.brand_name === 'TOTO').length
  console.log(`\n── TOTO Coverage ──`)
  console.log(`  Tổng SP TOTO: ${totoTotal}`)
  console.log(`  Có tài liệu: ${totoWithDocs} (${((totoWithDocs/totoTotal)*100).toFixed(1)}%)`)
  console.log(`  Thiếu tài liệu: ${totoTotal - totoWithDocs} (${(((totoTotal - totoWithDocs)/totoTotal)*100).toFixed(1)}%)`)

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  PHÂN TÍCH HOÀN TẤT')
  console.log('═══════════════════════════════════════════════════════════════')
}

main().catch(console.error).finally(() => prisma.$disconnect())
