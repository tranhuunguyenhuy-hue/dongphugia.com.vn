import { Prisma } from '@prisma/client'
import { writePimAudit } from '@/lib/pim-audit'
import { productCanonicalFieldsSchema } from '@/lib/pim-validation'

/**
 * Transaction-only canonical Product projection. This module intentionally has
 * no server-action boundary; callers must provide an existing transaction.
 */
export async function syncProductCanonicalFields(tx: unknown, actorId: number, productId: number, input: unknown) {
  const parsed = productCanonicalFieldsSchema.safeParse(input)
  if (!parsed.success) throw new Error('PRODUCT_CANONICAL_FIELDS_INVALID')
  const assignments = parsed.data.taxon_assignments ?? []
  const primaryCount = assignments.filter((assignment) => assignment.is_primary).length
  if (assignments.length > 0 && primaryCount !== 1) throw new Error('PRODUCT_TAXON_REQUIRES_ONE_PRIMARY')

  const client = tx as Prisma.TransactionClient
  if (parsed.data.brand_id !== undefined) {
    if (parsed.data.brand_id !== null) {
      const brand = await client.brands.findUnique({ where: { id: parsed.data.brand_id }, select: { id: true, is_active: true } })
      if (!brand) throw new Error('BRAND_NOT_FOUND')
      if (!brand.is_active) throw new Error('BRAND_INACTIVE')
    }
    await client.products.update({ where: { id: productId }, data: { brand_id: parsed.data.brand_id } })
  }
  if (parsed.data.product_type_id !== undefined || parsed.data.product_sub_type_id !== undefined) {
    if (parsed.data.product_sub_type_id && !parsed.data.product_type_id) throw new Error('PRODUCT_SUBTYPE_PARENT_REQUIRED')
    if (parsed.data.product_type_id) {
      const type = await client.product_types.findUnique({ where: { id: parsed.data.product_type_id }, select: { id: true, is_active: true } })
      if (!type) throw new Error('PRODUCT_TYPE_NOT_FOUND')
      if (!type.is_active) throw new Error('PRODUCT_TYPE_INACTIVE')
    }
    if (parsed.data.product_sub_type_id) {
      const subtype = await client.product_sub_types.findUnique({ where: { id: parsed.data.product_sub_type_id }, select: { id: true, product_type_id: true, is_active: true } })
      if (!subtype) throw new Error('PRODUCT_SUB_TYPE_NOT_FOUND')
      if (!subtype.is_active) throw new Error('PRODUCT_SUB_TYPE_INACTIVE')
      if (subtype.product_type_id !== parsed.data.product_type_id) throw new Error('PRODUCT_SUBTYPE_PARENT_MISMATCH')
    }
    await client.products.update({ where: { id: productId }, data: { product_type_id: parsed.data.product_type_id ?? null, product_sub_type_id: parsed.data.product_sub_type_id ?? null } })
  }
  if (parsed.data.taxon_assignments !== undefined) {
    if (assignments.length > 0) {
      const taxons = await client.catalog_taxons.findMany({
        where: { id: { in: assignments.map((assignment) => assignment.taxon_id) } },
        select: { id: true, is_active: true, is_listing_enabled: true },
      })
      if (taxons.length !== new Set(assignments.map((assignment) => assignment.taxon_id)).size) throw new Error('PRODUCT_TAXON_NOT_FOUND')
      const taxonById = new Map(taxons.map((taxon) => [taxon.id, taxon]))
      const primary = assignments.find((assignment) => assignment.is_primary)
      const primaryTaxon = primary ? taxonById.get(primary.taxon_id) : null
      if (!primaryTaxon?.is_active || !primaryTaxon.is_listing_enabled) throw new Error('PRODUCT_PRIMARY_TAXON_NOT_PUBLIC')
    }
    await client.product_taxon_assignments.deleteMany({ where: { product_id: productId } })
    if (assignments.length > 0) {
      await client.product_taxon_assignments.createMany({
        data: assignments.map((assignment) => ({
          product_id: productId,
          taxon_id: assignment.taxon_id,
          is_primary: assignment.is_primary,
          role: assignment.is_primary ? 'primary' : 'secondary',
          sort_order: assignment.sort_order,
          source: 'manual',
          confidence: 100,
        })),
      })
    }
  }
  await writePimAudit(client, { userId: actorId, action: 'pim.product_canonical.updated', entityType: 'product', entityId: productId, changedFields: ['brand_id', 'product_type_id', 'product_sub_type_id', 'product_taxon_assignments'] })
}
