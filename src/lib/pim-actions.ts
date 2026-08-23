'use server'

import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/auth/get-current-user'
import { toWriteFreezeActionResult } from '@/lib/write-freeze'
import { writePimAudit } from '@/lib/pim-audit'
import {
  assertSafeDocumentUrl,
  brandInputSchema,
  catalogTaxonInputSchema,
  productCanonicalFieldsSchema,
  productDocumentInputSchema,
  productSpecValueInputSchema,
  productSubTypeInputSchema,
  productTypeInputSchema,
  specDefinitionInputSchema,
  specOptionInputSchema,
} from '@/lib/pim-validation'
import { resolveProductCommerce } from '@/lib/product-commerce'
import { syncProductCanonicalFields } from '@/lib/pim-canonical'
import { buildPimPilotParityReport, type PimPilotProduct } from '@/lib/pim-pilot'

function actionError(error: unknown) {
  const freezeResult = toWriteFreezeActionResult(error)
  if (freezeResult) return freezeResult
  return { success: false, message: error instanceof Error ? error.message : 'PIM_ACTION_FAILED' }
}

function normalizedOptional(value: string | null | undefined) {
  return value && value.trim() !== '' ? value : null
}

async function assertTaxonParent(tx: unknown, parentId: number | null | undefined, currentId?: number) {
  const client = tx as Prisma.TransactionClient
  const visited = new Set<number>()
  let cursor = parentId ?? null
  while (cursor !== null) {
    if (cursor === currentId || visited.has(cursor)) throw new Error('TAXON_PARENT_CYCLE')
    visited.add(cursor)
    const parent = await client.catalog_taxons.findUnique({ where: { id: cursor }, select: { id: true, parent_id: true } })
    if (!parent) throw new Error('TAXON_PARENT_NOT_FOUND')
    cursor = parent.parent_id
  }
}

export async function createBrand(input: unknown) {
  const actor = await requirePermission('brands:write')
  const parsed = brandInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  const data = parsed.data
  try {
    const brand = await prisma.$transaction(async (tx) => {
      const created = await tx.brands.create({
        data: {
          ...data,
          logo_url: normalizedOptional(data.logo_url),
          website_url: normalizedOptional(data.website_url),
          description: normalizedOptional(data.description),
          origin_country: normalizedOptional(data.origin_country),
        },
      })
      await writePimAudit(tx, {
        userId: actor.id,
        action: 'pim.brand.created',
        entityType: 'brand',
        entityId: created.id,
        changedFields: ['name', 'slug', 'is_active'],
      })
      return created
    })
    revalidateTag('brands', 'max')
    return { success: true, id: brand.id }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateBrand(id: number, input: unknown) {
  const actor = await requirePermission('brands:write')
  const parsed = brandInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  const data = parsed.data
  try {
    await prisma.$transaction(async (tx) => {
      await tx.brands.update({
        where: { id },
        data: {
          ...data,
          logo_url: normalizedOptional(data.logo_url),
          website_url: normalizedOptional(data.website_url),
          description: normalizedOptional(data.description),
          origin_country: normalizedOptional(data.origin_country),
          updated_at: new Date(),
        },
      })
      await writePimAudit(tx, {
        userId: actor.id,
        action: 'pim.brand.updated',
        entityType: 'brand',
        entityId: id,
        changedFields: Object.keys(data),
      })
    })
    revalidateTag('brands', 'max')
    revalidatePath('/admin/pim/brands')
    return { success: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function setBrandActive(id: number, input: unknown) {
  const actor = await requirePermission('brands:write')
  const parsed = z.object({ is_active: z.boolean() }).safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.brands.update({ where: { id }, data: { is_active: parsed.data.is_active, updated_at: new Date() } })
      await writePimAudit(tx, { userId: actor.id, action: 'pim.brand.activation.updated', entityType: 'brand', entityId: id, changedFields: ['is_active'] })
    })
    revalidateTag('brands', 'max')
    revalidatePath('/admin/pim/brands')
    return { success: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function createCatalogTaxon(input: unknown) {
  const actor = await requirePermission('taxonomy:write')
  const parsed = catalogTaxonInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  const data = parsed.data
  try {
    const taxon = await prisma.$transaction(async (tx) => {
      await assertTaxonParent(tx, data.parent_id)
      const created = await tx.catalog_taxons.create({ data })
      await writePimAudit(tx, {
        userId: actor.id,
        action: 'pim.taxon.created',
        entityType: 'catalog_taxon',
        entityId: created.id,
        changedFields: ['parent_id', 'name', 'slug', 'canonical_path', 'is_active', 'is_listing_enabled'],
      })
      return created
    })
    revalidateTag('products', 'max')
    return { success: true, id: taxon.id }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateCatalogTaxon(id: number, input: unknown) {
  const actor = await requirePermission('taxonomy:write')
  const parsed = catalogTaxonInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  const data = parsed.data
  if (data.parent_id === id) return { success: false, message: 'TAXON_PARENT_CYCLE' }
  try {
    await prisma.$transaction(async (tx) => {
      await assertTaxonParent(tx, data.parent_id, id)
      await tx.catalog_taxons.update({ where: { id }, data: { ...data, updated_at: new Date() } })
      await writePimAudit(tx, {
        userId: actor.id,
        action: 'pim.taxon.updated',
        entityType: 'catalog_taxon',
        entityId: id,
        changedFields: Object.keys(data),
      })
    })
    revalidateTag('products', 'max')
    revalidatePath('/admin/pim/taxonomy')
    return { success: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function setCatalogTaxonState(id: number, input: unknown) {
  const actor = await requirePermission('taxonomy:write')
  const parsed = z.object({ is_active: z.boolean(), is_listing_enabled: z.boolean() }).safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.catalog_taxons.update({ where: { id }, data: { ...parsed.data, updated_at: new Date() } })
      await writePimAudit(tx, { userId: actor.id, action: 'pim.taxon.state.updated', entityType: 'catalog_taxon', entityId: id, changedFields: ['is_active', 'is_listing_enabled'] })
    })
    revalidateTag('products', 'max')
    revalidatePath('/admin/pim/taxonomy')
    return { success: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function setProductTaxonomy(productId: number, input: unknown) {
  const actor = await requirePermission('taxonomy:write')
  const parsed = productCanonicalFieldsSchema.pick({ taxon_assignments: true }).safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  const assignments = parsed.data.taxon_assignments ?? []
  const primaryCount = assignments.filter((assignment) => assignment.is_primary).length
  if (assignments.length > 0 && primaryCount !== 1) {
    return { success: false, message: 'PRODUCT_TAXON_REQUIRES_ONE_PRIMARY' }
  }
  try {
    await prisma.$transaction(async (tx) => {
      await syncProductCanonicalFields(tx, actor.id, productId, { taxon_assignments: assignments })
    })
    revalidateTag('products', 'max')
    return { success: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function createProductType(input: unknown) {
  const actor = await requirePermission('product_types:write')
  const parsed = productTypeInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  try {
    const type = await prisma.$transaction(async (tx) => {
      const created = await tx.product_types.create({ data: { ...parsed.data, filter_policy: parsed.data.filter_policy as Prisma.InputJsonValue } })
      await writePimAudit(tx, { userId: actor.id, action: 'pim.product_type.created', entityType: 'product_type', entityId: created.id, changedFields: Object.keys(parsed.data) })
      return created
    })
    revalidateTag('product_types', 'max')
    return { success: true, id: type.id }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateProductType(id: number, input: unknown) {
  const actor = await requirePermission('product_types:write')
  const parsed = productTypeInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.product_types.update({ where: { id }, data: { ...parsed.data, filter_policy: parsed.data.filter_policy as Prisma.InputJsonValue, updated_at: new Date() } })
      await writePimAudit(tx, { userId: actor.id, action: 'pim.product_type.updated', entityType: 'product_type', entityId: id, changedFields: Object.keys(parsed.data) })
    })
    revalidateTag('product_types', 'max')
    return { success: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function setProductTypeActive(id: number, input: unknown) {
  const actor = await requirePermission('product_types:write')
  const parsed = z.object({ is_active: z.boolean() }).safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.product_types.update({ where: { id }, data: { is_active: parsed.data.is_active } })
      await writePimAudit(tx, { userId: actor.id, action: 'pim.product_type.activation.updated', entityType: 'product_type', entityId: id, changedFields: ['is_active'] })
    })
    revalidateTag('product_types', 'max')
    revalidatePath('/admin/pim/types')
    return { success: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function createProductSubType(input: unknown) {
  const actor = await requirePermission('product_types:write')
  const parsed = productSubTypeInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  try {
    const subtype = await prisma.$transaction(async (tx) => {
      const parent = await tx.product_types.findUnique({ where: { id: parsed.data.product_type_id }, select: { id: true } })
      if (!parent) throw new Error('PRODUCT_TYPE_NOT_FOUND')
      const created = await tx.product_sub_types.create({ data: parsed.data })
      await writePimAudit(tx, { userId: actor.id, action: 'pim.product_sub_type.created', entityType: 'product_sub_type', entityId: created.id, changedFields: Object.keys(parsed.data) })
      return created
    })
    revalidateTag('product_types', 'max')
    return { success: true, id: subtype.id }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateProductSubType(id: number, input: unknown) {
  const actor = await requirePermission('product_types:write')
  const parsed = productSubTypeInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  try {
    await prisma.$transaction(async (tx) => {
      const parent = await tx.product_types.findUnique({ where: { id: parsed.data.product_type_id }, select: { id: true } })
      if (!parent) throw new Error('PRODUCT_TYPE_NOT_FOUND')
      await tx.product_sub_types.update({ where: { id }, data: parsed.data })
      await writePimAudit(tx, { userId: actor.id, action: 'pim.product_sub_type.updated', entityType: 'product_sub_type', entityId: id, changedFields: Object.keys(parsed.data) })
    })
    revalidateTag('product_types', 'max')
    return { success: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function setProductSubTypeActive(id: number, input: unknown) {
  const actor = await requirePermission('product_types:write')
  const parsed = z.object({ is_active: z.boolean() }).safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.product_sub_types.update({ where: { id }, data: { is_active: parsed.data.is_active } })
      await writePimAudit(tx, { userId: actor.id, action: 'pim.product_sub_type.activation.updated', entityType: 'product_sub_type', entityId: id, changedFields: ['is_active'] })
    })
    revalidateTag('product_types', 'max')
    revalidatePath('/admin/pim/types')
    return { success: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function createSpecDefinition(input: unknown) {
  const actor = await requirePermission('specifications:write')
  const parsed = specDefinitionInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  try {
    const definition = await prisma.$transaction(async (tx) => {
      const created = await tx.spec_definitions.create({ data: { ...parsed.data, normalize_rule: parsed.data.normalize_rule as Prisma.InputJsonValue } })
      await writePimAudit(tx, { userId: actor.id, action: 'pim.spec_definition.created', entityType: 'spec_definition', entityId: created.id, changedFields: Object.keys(parsed.data) })
      return created
    })
    revalidateTag('subcategory-spec-filters', 'max')
    return { success: true, id: definition.id }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateSpecDefinition(id: number, input: unknown) {
  const actor = await requirePermission('specifications:write')
  const parsed = specDefinitionInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.spec_definitions.update({ where: { id }, data: { ...parsed.data, normalize_rule: parsed.data.normalize_rule as Prisma.InputJsonValue, updated_at: new Date() } })
      await writePimAudit(tx, { userId: actor.id, action: 'pim.spec_definition.updated', entityType: 'spec_definition', entityId: id, changedFields: Object.keys(parsed.data) })
    })
    revalidateTag('subcategory-spec-filters', 'max')
    return { success: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function createSpecOption(input: unknown) {
  const actor = await requirePermission('specifications:write')
  const parsed = specOptionInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  try {
    const option = await prisma.$transaction(async (tx) => {
      const definition = await tx.spec_definitions.findUnique({ where: { id: parsed.data.spec_definition_id }, select: { id: true } })
      if (!definition) throw new Error('SPEC_DEFINITION_NOT_FOUND')
      const created = await tx.spec_options.create({ data: parsed.data })
      await writePimAudit(tx, { userId: actor.id, action: 'pim.spec_option.created', entityType: 'spec_option', entityId: created.id, changedFields: Object.keys(parsed.data) })
      return created
    })
    revalidateTag('subcategory-spec-filters', 'max')
    return { success: true, id: option.id }
  } catch (error) {
    return actionError(error)
  }
}

export async function upsertProductSpecValues(productId: number, input: unknown) {
  const actor = await requirePermission('specifications:write')
  if (!Array.isArray(input)) return { success: false, message: 'SPEC_VALUES_MUST_BE_ARRAY' }
  const parsed = input.map((value) => productSpecValueInputSchema.safeParse(value))
  const invalid = parsed.find((result) => !result.success)
  if (invalid && !invalid.success) return { success: false, errors: invalid.error.flatten().fieldErrors }
    const values = parsed.map((result) => (result as { success: true; data: typeof productSpecValueInputSchema._output }).data)
  try {
    await prisma.$transaction(async (tx) => {
      const definitionIds = Array.from(new Set(values.map((value) => value.spec_definition_id)))
      const definitions = await tx.spec_definitions.findMany({ where: { id: { in: definitionIds } }, select: { id: true, data_type: true } })
      if (definitions.length !== new Set(values.map((value) => value.spec_definition_id)).size) throw new Error('SPEC_DEFINITION_NOT_FOUND')
      const definitionById = new Map(definitions.map((definition) => [definition.id, definition.data_type]))
      if (values.some((value) => definitionById.get(value.spec_definition_id) === 'number' && (value.value_number == null || !Number.isFinite(value.value_number)))) throw new Error('SPEC_NUMBER_VALUE_INVALID')
      const optionIds = Array.from(new Set(values.flatMap((value) => value.option_id ? [value.option_id] : [])))
      if (optionIds.length > 0) {
        const options = await tx.spec_options.findMany({ where: { id: { in: optionIds } }, select: { id: true, spec_definition_id: true } })
        if (options.length !== optionIds.length) throw new Error('SPEC_OPTION_NOT_FOUND')
        const definitionByOption = new Map(options.map((option) => [option.id, option.spec_definition_id]))
        if (values.some((value) => value.option_id != null && definitionByOption.get(value.option_id) !== value.spec_definition_id)) throw new Error('SPEC_OPTION_DEFINITION_MISMATCH')
      }
      await tx.product_spec_values.deleteMany({ where: { product_id: productId } })
      if (values.length > 0) {
        await tx.product_spec_values.createMany({
          data: values.map((value) => ({
            product_id: productId,
            spec_definition_id: value.spec_definition_id,
            option_id: value.option_id ?? null,
            value_text: value.value_text ?? null,
            value_number: value.value_number ?? null,
            value_json: value.value_json == null ? Prisma.JsonNull : value.value_json as Prisma.InputJsonValue,
            raw_key: value.raw_key ?? null,
            raw_value: value.raw_value ?? null,
            source: 'manual',
            confidence: 'high',
            sort_order: value.sort_order,
          })),
        })
      }
      await writePimAudit(tx, { userId: actor.id, action: 'pim.product_specs.replaced', entityType: 'product', entityId: productId, changedFields: ['product_spec_values'] })
    })
    revalidateTag('products', 'max')
    return { success: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function addProductDocument(productId: number, input: unknown) {
  const actor = await requirePermission('documents:write')
  const parsed = productDocumentInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  try {
    assertSafeDocumentUrl(parsed.data.url)
    if (parsed.data.source_url) assertSafeDocumentUrl(parsed.data.source_url)
    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.product_documents.create({ data: { product_id: productId, ...parsed.data, source_url: normalizedOptional(parsed.data.source_url) } })
      await writePimAudit(tx, { userId: actor.id, action: 'pim.product_document.created', entityType: 'product_document', entityId: created.id, changedFields: Object.keys(parsed.data) })
      return created
    })
    revalidateTag('products', 'max')
    return { success: true, id: document.id }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateProductDocument(id: number, input: unknown) {
  const actor = await requirePermission('documents:write')
  const parsed = productDocumentInputSchema.safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  try {
    assertSafeDocumentUrl(parsed.data.url)
    if (parsed.data.source_url) assertSafeDocumentUrl(parsed.data.source_url)
    await prisma.$transaction(async (tx) => {
      await tx.product_documents.update({ where: { id }, data: { ...parsed.data, source_url: normalizedOptional(parsed.data.source_url) } })
      await writePimAudit(tx, { userId: actor.id, action: 'pim.product_document.updated', entityType: 'product_document', entityId: id, changedFields: Object.keys(parsed.data) })
    })
    revalidateTag('products', 'max')
    return { success: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function removeProductDocument(id: number) {
  const actor = await requirePermission('documents:write')
  try {
    await prisma.$transaction(async (tx) => {
      await tx.product_documents.delete({ where: { id } })
      await writePimAudit(tx, { userId: actor.id, action: 'pim.product_document.removed', entityType: 'product_document', entityId: id, changedFields: ['document'] })
    })
    revalidateTag('products', 'max')
    return { success: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateProductCommerce(productId: number, input: unknown) {
  const actor = await requirePermission('commerce:write')
  const parsed = zCommerce.safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.products.findUnique({ where: { id: productId }, select: { list_price: true, sale_price: true, original_price: true, price: true, stock_status: true } })
      if (!current) throw new Error('PRODUCT_NOT_FOUND')
      const next = {
        ...current,
        ...parsed.data,
        list_price: parsed.data.list_price === undefined ? current.list_price : parsed.data.list_price,
        sale_price: parsed.data.sale_price === undefined ? current.sale_price : parsed.data.sale_price,
      }
      if (next.sale_price !== null && (next.list_price === null || next.sale_price >= next.list_price)) throw new Error('INVALID_CANONICAL_SALE_PRICE')
      resolveProductCommerce({ listPrice: next.list_price, salePrice: next.sale_price, originalPrice: next.original_price, compatibilityPrice: next.price, stockStatus: next.stock_status })
      await tx.products.update({ where: { id: productId }, data: { list_price: next.list_price, sale_price: next.sale_price, stock_status: parsed.data.stock_status, price_updated_at: new Date(), price_source: 'manual', price_confidence: 'high', updated_at: new Date() } })
      await writePimAudit(tx, { userId: actor.id, action: 'pim.product_commerce.updated', entityType: 'product', entityId: productId, changedFields: Object.keys(parsed.data) })
    })
    revalidateTag('products', 'max')
    revalidatePath(`/admin/products/${productId}`)
    return { success: true }
  } catch (error) {
    return actionError(error)
  }
}

const zCommerce = z.object({
  list_price: z.coerce.number().positive().optional().nullable(),
  sale_price: z.coerce.number().positive().optional().nullable(),
  stock_status: z.enum(['in_stock', 'pre_order', 'contact', 'discontinued']),
})

export async function updateProductVisibility(productId: number, input: unknown) {
  const actor = await requirePermission('visibility:write')
  const parsed = visibilitySchema.safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.products.update({ where: { id: productId }, data: { ...parsed.data, updated_at: new Date() } })
      await writePimAudit(tx, { userId: actor.id, action: 'pim.product_visibility.updated', entityType: 'product', entityId: productId, changedFields: Object.keys(parsed.data) })
    })
    revalidateTag('products', 'max')
    revalidatePath(`/admin/products/${productId}`)
    return { success: true }
  } catch (error) {
    return actionError(error)
  }
}

export async function updateProductSeo(productId: number, input: unknown) {
  const actor = await requirePermission('seo:write')
  const parsed = seoSchema.safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.products.update({ where: { id: productId }, data: { seo_title: normalizedOptional(parsed.data.seo_title), seo_description: normalizedOptional(parsed.data.seo_description), seo_indexing: parsed.data.seo_indexing, sitemap_include: parsed.data.sitemap_include, updated_at: new Date() } })
      await writePimAudit(tx, { userId: actor.id, action: 'pim.product_seo.updated', entityType: 'product', entityId: productId, changedFields: Object.keys(parsed.data) })
    })
    revalidateTag('products', 'max')
    revalidatePath(`/admin/products/${productId}`)
    return { success: true }
  } catch (error) {
    return actionError(error)
  }
}

/** Read-only, deterministic CMS-8 pilot report. It never writes or backfills. */
export async function getPimPilotParityReport(input: unknown = {}) {
  await requirePermission('products:read')
  const parsed = z.object({ take: z.coerce.number().int().min(1).max(500).default(100), category_id: z.coerce.number().int().positive().optional() }).safeParse(input)
  if (!parsed.success) return { success: false, errors: parsed.error.flatten().fieldErrors }
  const rows = await prisma.products.findMany({
    where: parsed.data.category_id ? { category_id: parsed.data.category_id } : undefined,
    orderBy: { id: 'asc' },
    take: parsed.data.take,
    select: {
      id: true,
      sku: true,
      slug: true,
      brand_id: true,
      product_type_id: true,
      product_sub_type_id: true,
      product_type: true,
      categories: { select: { slug: true, name: true } },
      subcategories: { select: { slug: true, name: true } },
      list_price: true,
      sale_price: true,
      original_price: true,
      price: true,
      stock_status: true,
      is_active: true,
      sellable_status: true,
      publication_status: true,
      pdp_visibility: true,
      listing_visibility: true,
      search_visibility: true,
      seo_indexing: true,
      sitemap_include: true,
      product_taxon_assignments: {
        select: {
          is_primary: true,
          catalog_taxons: { select: { slug: true, name: true, canonical_path: true, parent_id: true, is_active: true, is_listing_enabled: true } },
        },
      },
      _count: { select: { product_documents: true, product_spec_values: true } },
    },
  })
  const products: PimPilotProduct[] = rows.map((row) => ({
    ...row,
    document_count: row._count.product_documents,
    normalized_spec_count: row._count.product_spec_values,
    listPrice: row.list_price,
    salePrice: row.sale_price,
    originalPrice: row.original_price,
    compatibilityPrice: row.price,
    stockStatus: row.stock_status,
  }))
  return { success: true, report: buildPimPilotParityReport(products) }
}

const visibilitySchema = z.object({
  publication_status: z.enum(['draft', 'public']),
  pdp_visibility: z.enum(['public', 'hidden']),
  listing_visibility: z.enum(['default', 'low_priority', 'hidden']),
  search_visibility: z.enum(['visible', 'hidden']),
  sellable_status: z.enum(['sellable', 'not_sellable', 'discontinued']),
  seo_indexing: z.enum(['index', 'noindex']),
  sitemap_include: z.boolean(),
})

const seoSchema = z.object({
  seo_title: z.string().max(200).optional().nullable(),
  seo_description: z.string().max(500).optional().nullable(),
  seo_indexing: z.enum(['index', 'noindex']),
  sitemap_include: z.boolean(),
})
