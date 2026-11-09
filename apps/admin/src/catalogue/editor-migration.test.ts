import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261106213000_phase2_admin_catalogue_editor.sql'), 'utf8')

describe('Phase 2 Admin Product editor migration', () => {
  it('keeps invoker capability checks and authenticated-only execution', () => {
    expect(migration.match(/security invoker/g)).toHaveLength(2)
    expect(migration).toContain("dpg_app.leo542_admin_can('products:read')")
    expect(migration).toContain("dpg_app.leo542_admin_can('products:write')")
    expect(migration).toContain("dpg_app.leo542_admin_can('commerce:write')")
    expect(migration).toContain("dpg_app.leo542_admin_can('visibility:write')")
    expect(migration).toContain("dpg_app.leo542_admin_can('seo:write')")
    expect(migration).toContain('grant create on schema public to dpg_migration')
    expect(migration).toContain('revoke create on schema public from dpg_migration')
    expect(migration).toContain('from public, anon, service_role')
    expect(migration).toContain('to authenticated')
  })

  it('keeps variant membership fixed and accepts only verified high-confidence option groups', () => {
    expect(migration).toContain("v_group.confidence <> 'high'")
    expect(migration).toContain("v_group.source not like 'hita-normalized-%'")
    expect(migration).toContain('DUPLICATE_VARIANT_OPTION')
    expect(migration).toContain('phase2:admin-product-variant-group:')
    expect(migration).not.toMatch(/from dpg_app\.product_variant_groups vg[\s\S]{0,180}for update/i)
    expect(migration).not.toMatch(/set\s+variant_group\s*=|set\s+variant_group_id\s*=/i)
  })

  it('downgrades changed prices to unverified, version-checks and writes audit/idempotency', () => {
    expect(migration).toContain("price_state = case when p_input ?| array['price','sale_price','online_discount_amount'] then 'unknown'")
    expect(migration).toContain("price_confidence = case when p_input ?| array['price','sale_price','online_discount_amount'] then 'low'")
    expect(migration).toContain("raise exception 'STALE_VERSION'")
    expect(migration).toContain('phase2.admin.product.update')
    expect(migration).toContain('insert into dpg_app.audit_logs')
    expect(migration).toContain("'phase2.product.updated', 'product', v_product.id,")
    expect(migration).not.toContain("'phase2.product.updated', 'product', v_product.id::text,")
  })

  it('rejects public publication when price provenance is unverified or empty', () => {
    expect(migration).toContain("raise exception 'UNVERIFIED_PRODUCT_PUBLICATION'")
    expect(migration).toContain("v_old.price_state = 'priced'")
    expect(migration).toContain("v_old.price_confidence = 'high'")
    expect(migration).toContain("v_old.price_source in ('hita','manual')")
  })
})
